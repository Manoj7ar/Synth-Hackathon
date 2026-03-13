import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { prisma } from '@/lib/data/prisma'
import { generateShareToken } from '@/lib/data/share-token'
import {
  deriveChiefComplaint,
  generateConversationSummary,
  generateSoapNotesFromTranscript,
  type TranscriptSegment,
} from '@/lib/clinical/clinical-notes'
import {
  extractClinicalImageArtifact,
  formatArtifactsForClinicalPrompt,
  type NormalizedVisitArtifact,
} from '@/lib/clinical/visit-artifacts'

interface SaveTranscribePayload {
  patientName?: string
  transcript?: TranscriptSegment[]
}

interface ParsedSaveRequest {
  patientName?: string
  transcript: TranscriptSegment[]
  evidenceArtifacts: NormalizedVisitArtifact[]
}

function validateTranscript(input: unknown): TranscriptSegment[] {
  if (!Array.isArray(input)) return []

  return input
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const candidate = item as Record<string, unknown>
      const speaker = candidate.speaker
      const text = candidate.text
      const startMs = candidate.start_ms
      const endMs = candidate.end_ms

      if (
        (speaker !== 'clinician' && speaker !== 'patient') ||
        typeof text !== 'string' ||
        typeof startMs !== 'number' ||
        typeof endMs !== 'number'
      ) {
        return null
      }

      return {
        speaker,
        text: text.trim(),
        start_ms: startMs,
        end_ms: endMs,
      } as TranscriptSegment
    })
    .filter((segment): segment is TranscriptSegment => Boolean(segment?.text))
}

async function parseSaveRequest(req: NextRequest): Promise<ParsedSaveRequest> {
  const contentType = req.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const patientNameValue = formData.get('patientName')
    const transcriptValue = formData.get('transcript')
    const evidenceImageValue = formData.get('evidenceImage')

    let transcript: TranscriptSegment[] = []
    if (typeof transcriptValue === 'string' && transcriptValue.trim()) {
      try {
        transcript = validateTranscript(JSON.parse(transcriptValue))
      } catch {
        transcript = []
      }
    }

    const evidenceArtifacts: NormalizedVisitArtifact[] = []
    if (evidenceImageValue instanceof File && evidenceImageValue.size > 0) {
      evidenceArtifacts.push(await extractClinicalImageArtifact(evidenceImageValue))
    }

    return {
      patientName: typeof patientNameValue === 'string' ? patientNameValue.trim() : undefined,
      transcript,
      evidenceArtifacts,
    }
  }

  const payload = (await req.json()) as SaveTranscribePayload
  return {
    patientName: payload.patientName?.trim(),
    transcript: validateTranscript(payload.transcript),
    evidenceArtifacts: [],
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'clinician') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { patientName, transcript, evidenceArtifacts } = await parseSaveRequest(req)

    if (!patientName) {
      return NextResponse.json({ error: 'Patient name is required' }, { status: 400 })
    }

    if (transcript.length === 0) {
      return NextResponse.json({ error: 'Transcript is empty' }, { status: 400 })
    }

    const additionalEvidenceContext = formatArtifactsForClinicalPrompt(evidenceArtifacts)
    const [summary, soapNotes] = await Promise.all([
      generateConversationSummary(transcript, {
        additionalEvidenceContext: additionalEvidenceContext || undefined,
      }),
      generateSoapNotesFromTranscript(transcript, {
        additionalEvidenceContext: additionalEvidenceContext || undefined,
      }),
    ])
    const chiefComplaint = deriveChiefComplaint(transcript)

    const result = await prisma.$transaction(async (tx) => {
      const patient = await tx.patient.create({
        data: {
          displayName: patientName,
        },
      })

      const visit = await tx.visit.create({
        data: {
          patientId: patient.id,
          clinicianId: session.user.id,
          status: 'finalized',
          chiefComplaint,
          finalizedAt: new Date(),
        },
      })

      const documentation = await tx.visitDocumentation.create({
        data: {
          visitId: visit.id,
          transcriptJson: JSON.stringify(transcript),
          summary,
          soapNotes,
          additionalNotes: '',
        },
      })

      if (evidenceArtifacts.length > 0) {
        await Promise.all(
          evidenceArtifacts.map((artifact) =>
            tx.visitArtifact.create({
              data: {
                visitId: visit.id,
                kind: artifact.kind,
                label: artifact.label,
                mimeType: artifact.mimeType,
                sourceName: artifact.sourceName ?? null,
                extractedText: artifact.extractedText || null,
                summary: artifact.summary,
                structuredJson:
                  artifact.structuredJson ??
                  JSON.stringify({
                    findings: artifact.findings,
                    evidenceSnippets: artifact.evidenceSnippets,
                    medications: artifact.medications,
                    vitals: artifact.vitals,
                    instructions: artifact.instructions,
                    extractedText: artifact.extractedText,
                    summary: artifact.summary,
                  }),
              },
            })
          )
        )
      }

      const shareLink = await tx.shareLink.create({
        data: {
          visitId: visit.id,
          patientId: patient.id,
          token: generateShareToken(),
        },
      })

      return {
        visitId: visit.id,
        patientId: patient.id,
        patientName: patient.displayName,
        documentationId: documentation.id,
        shareToken: shareLink.token,
        artifactCount: evidenceArtifacts.length,
      }
    })

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Save transcription error:', error)
    return NextResponse.json({ error: 'Failed to save transcription' }, { status: 500 })
  }
}

