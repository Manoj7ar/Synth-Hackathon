import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import {
  createReconciliationRun,
  listReconciliationRunsForPatient,
} from '@/lib/clinical/reconciliation'

type CreateRunPayload = {
  patientId?: string
  visitId?: string
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'clinician') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const patientId = req.nextUrl.searchParams.get('patientId')?.trim()
    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    const runs = await listReconciliationRunsForPatient({
      patientId,
      clinicianId: session.user.id,
    })

    if (!runs) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, runs })
  } catch (error) {
    console.error('List reconciliation runs error:', error)
    return NextResponse.json({ error: 'Failed to list reconciliation runs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'clinician') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = (await req.json()) as CreateRunPayload
    const patientId = payload.patientId?.trim() ?? ''
    const visitId = payload.visitId?.trim() || undefined

    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 })
    }

    const run = await createReconciliationRun({
      patientId,
      clinicianId: session.user.id,
      visitId,
    })

    if (!run) {
      return NextResponse.json({ error: 'Patient or visit not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, run })
  } catch (error) {
    console.error('Create reconciliation run error:', error)
    return NextResponse.json({ error: 'Failed to create reconciliation run' }, { status: 500 })
  }
}

