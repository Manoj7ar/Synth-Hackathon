import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isNovaConfigured } from '@/lib/nova'

export async function POST() {
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

    return NextResponse.json(
      {
        error:
          'Server audio transcription is not available in this environment. Use the browser live transcript in /transcribe, or paste a transcript into the landing preview flow.',
      },
      { status: 503 }
    )
  } catch (error) {
    console.error('Transcribe error:', error)
    const message = error instanceof Error ? error.message : 'Transcription failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

