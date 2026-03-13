import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { decideReconciliationAction } from '@/lib/clinical/reconciliation'

type ActionDecisionPayload = {
  decision?: 'approve' | 'dismiss'
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string; actionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'clinician') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = (await req.json()) as ActionDecisionPayload
    const decision = payload.decision === 'dismiss' ? 'dismiss' : 'approve'
    const { runId, actionId } = await params

    const run = await decideReconciliationAction({
      runId,
      actionId,
      clinicianId: session.user.id,
      decision,
    })

    if (!run) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, run })
  } catch (error) {
    console.error('Apply reconciliation action error:', error)
    return NextResponse.json({ error: 'Failed to apply reconciliation action' }, { status: 500 })
  }
}
