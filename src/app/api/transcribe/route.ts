import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAwsTranscribeConfigured, isNovaConfigured } from '@/lib/config'
import { transcribeAudioFile } from '@/lib/transcribe'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isNovaConfigured()) {
      return NextResponse.json(
        {
          error:
            'Server transcription is unavailable because Amazon Nova is not configured. Set AWS_REGION and Bedrock model env vars. You can still use the live browser transcript and save it.',
        },
        { status: 503 }
      )
    }

    if (!isAwsTranscribeConfigured()) {
      return NextResponse.json(
        {
          error:
            'AWS Transcribe is not configured. Set AWS_REGION and S3_BUCKET_AUDIO_UPLOADS for server-side transcription.',
        },
        { status: 503 }
      )
    }

    const formData = await req.formData()
    const audio = formData.get('audio')

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'Audio file is required.' }, { status: 400 })
    }

    const result = await transcribeAudioFile(audio)

    return NextResponse.json({
      success: true,
      transcript: result.transcript,
      duration_ms: result.duration_ms,
    })
  } catch (error) {
    console.error('Transcribe error:', error)
    const message = error instanceof Error ? error.message : 'Transcription failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
