import { randomUUID } from 'crypto'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import {
  GetTranscriptionJobCommand,
  LanguageCode,
  MediaFormat,
  TranscribeClient,
  StartTranscriptionJobCommand,
} from '@aws-sdk/client-transcribe'
import { getAwsRegion, getTranscribeLanguageCode, getUploadsBucketName, isAwsTranscribeConfigured } from '@/lib/config'
import type { TranscriptSegment, TranscriptSpeaker } from '@/lib/clinical-notes'

type AwsTranscribeResponse = {
  results?: {
    transcripts?: Array<{ transcript?: string }>
    items?: Array<{
      start_time?: string
      end_time?: string
      type?: 'pronunciation' | 'punctuation'
      alternatives?: Array<{ content?: string }>
    }>
    speaker_labels?: {
      segments?: Array<{
        start_time?: string
        end_time?: string
        speaker_label?: string
      }>
    }
  }
}

const SUPPORTED_EXTENSIONS = new Set(['mp3', 'mp4', 'wav', 'flac', 'ogg', 'amr', 'webm', 'm4a'])

let s3Client: S3Client | null = null
let transcribeClient: TranscribeClient | null = null

function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({ region: getAwsRegion() })
  }
  return s3Client
}

function getTranscribeClient() {
  if (!transcribeClient) {
    transcribeClient = new TranscribeClient({ region: getAwsRegion() })
  }
  return transcribeClient
}

function detectExtension(file: File) {
  const byName = file.name.split('.').pop()?.toLowerCase()
  if (byName && SUPPORTED_EXTENSIONS.has(byName)) {
    return byName
  }

  const mime = file.type.toLowerCase()
  if (mime.includes('mpeg')) return 'mp3'
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('flac')) return 'flac'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('amr')) return 'amr'
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('m4a') || mime.includes('aac')) return 'm4a'

  return 'webm'
}

function getMediaFormat(file: File): MediaFormat {
  return detectExtension(file) as MediaFormat
}

function roleForSpeakerLabel(label: string, orderedLabels: string[]): TranscriptSpeaker {
  const labelIndex = orderedLabels.indexOf(label)
  if (labelIndex <= 0) return 'patient'
  if (labelIndex === 1) return 'clinician'
  return labelIndex % 2 === 0 ? 'patient' : 'clinician'
}

function splitFallbackTranscript(text: string): TranscriptSegment[] {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  const lines = normalized
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean)

  let cursorMs = 0
  return lines.map((line, index) => {
    const durationMs = Math.max(2000, Math.min(12000, line.length * 70))
    const segment: TranscriptSegment = {
      speaker: index % 2 === 0 ? 'patient' : 'clinician',
      start_ms: cursorMs,
      end_ms: cursorMs + durationMs,
      text: line,
    }
    cursorMs += durationMs
    return segment
  })
}

function parseTranscriptPayload(payload: AwsTranscribeResponse): TranscriptSegment[] {
  const transcriptText = payload.results?.transcripts?.[0]?.transcript?.trim() ?? ''
  const items = payload.results?.items ?? []
  const speakerSegments = payload.results?.speaker_labels?.segments ?? []

  if (items.length === 0 || speakerSegments.length === 0) {
    return splitFallbackTranscript(transcriptText)
  }

  const orderedLabels: string[] = []
  const speakerRanges = speakerSegments
    .map((segment) => {
      const label = segment.speaker_label ?? 'speaker_0'
      if (!orderedLabels.includes(label)) {
        orderedLabels.push(label)
      }

      return {
        label,
        start: Number(segment.start_time ?? '0'),
        end: Number(segment.end_time ?? segment.start_time ?? '0'),
      }
    })
    .filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end))

  const segments: TranscriptSegment[] = []
  let current: TranscriptSegment | null = null
  let lastPronunciationEndMs = 0

  for (const item of items) {
    const token = item.alternatives?.[0]?.content?.trim()
    if (!token) continue

    if (item.type === 'punctuation') {
      if (current) {
        current.text = `${current.text}${token}`
      }
      continue
    }

    const startMs = Math.max(0, Math.round(Number(item.start_time ?? '0') * 1000))
    const endMs = Math.max(startMs + 300, Math.round(Number(item.end_time ?? item.start_time ?? '0') * 1000))
    const speakerLabel =
      speakerRanges.find((range) => startMs / 1000 >= range.start && startMs / 1000 <= range.end + 0.05)?.label ??
      orderedLabels[0] ??
      'speaker_0'
    const speaker = roleForSpeakerLabel(speakerLabel, orderedLabels)

    if (!current || current.speaker !== speaker || startMs - lastPronunciationEndMs > 2000) {
      current = {
        speaker,
        start_ms: startMs,
        end_ms: endMs,
        text: token,
      }
      segments.push(current)
    } else {
      current.text = `${current.text} ${token}`.replace(/\s+/g, ' ').trim()
      current.end_ms = endMs
    }

    lastPronunciationEndMs = endMs
  }

  if (segments.length === 0) {
    return splitFallbackTranscript(transcriptText)
  }

  return segments.map((segment) => ({
    ...segment,
    text: segment.text.replace(/\s+([.,!?;:])/g, '$1').trim(),
  }))
}

function computeDurationMs(segments: TranscriptSegment[]) {
  return segments.reduce((max, segment) => Math.max(max, segment.end_ms), 0)
}

async function waitForTranscript(jobName: string) {
  const client = getTranscribeClient()
  const maxAttempts = 40

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await client.send(new GetTranscriptionJobCommand({ TranscriptionJobName: jobName }))
    const status = response.TranscriptionJob?.TranscriptionJobStatus

    if (status === 'COMPLETED') {
      const uri = response.TranscriptionJob?.Transcript?.TranscriptFileUri
      if (!uri) {
        throw new Error('AWS Transcribe completed without returning a transcript file URI.')
      }

      const transcriptResponse = await fetch(uri)
      if (!transcriptResponse.ok) {
        throw new Error('Unable to download the AWS Transcribe transcript output.')
      }

      return (await transcriptResponse.json()) as AwsTranscribeResponse
    }

    if (status === 'FAILED') {
      throw new Error(
        response.TranscriptionJob?.FailureReason || 'AWS Transcribe failed to process the recording.'
      )
    }

    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  throw new Error('AWS Transcribe timed out while processing the recording.')
}

export async function transcribeAudioFile(file: File) {
  if (!isAwsTranscribeConfigured()) {
    throw new Error('AWS Transcribe is not configured. Set AWS_REGION and S3_BUCKET_AUDIO_UPLOADS.')
  }

  const bucket = getUploadsBucketName()!
  const extension = detectExtension(file)
  const mediaFormat = getMediaFormat(file)
  const objectKey = `transcribe/input/${Date.now()}-${randomUUID()}.${extension}`
  const mediaUri = `s3://${bucket}/${objectKey}`
  const jobName = `synth-${Date.now()}-${randomUUID().slice(0, 8)}`
  const fileBuffer = Buffer.from(await file.arrayBuffer())

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: fileBuffer,
      ContentType: file.type || 'audio/webm',
    })
  )

  await getTranscribeClient().send(
    new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      LanguageCode: getTranscribeLanguageCode() as LanguageCode,
      MediaFormat: mediaFormat,
      Media: {
        MediaFileUri: mediaUri,
      },
      Settings: {
        ShowSpeakerLabels: true,
        MaxSpeakerLabels: 2,
      },
    })
  )

  const transcriptPayload = await waitForTranscript(jobName)
  const transcript = parseTranscriptPayload(transcriptPayload)

  return {
    transcript,
    duration_ms: computeDurationMs(transcript),
  }
}
