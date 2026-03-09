import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getReconciliationRunDetail } from '@/lib/reconciliation'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'clinician') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { runId } = await params
    const run = await getReconciliationRunDetail({
      runId,
      clinicianId: session.user.id,
    })

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, run })
  } catch (error) {
    console.error('Get reconciliation run error:', error)
    return NextResponse.json({ error: 'Failed to fetch reconciliation run' }, { status: 500 })
  }
}
