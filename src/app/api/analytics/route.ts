import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function formatDayKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'clinician') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const medication = searchParams.get('medication')

    if (type === 'medication' && medication) {
      return NextResponse.json({
        source: 'database_stub',
        medication,
        totalMentions: 0,
        dosages: [],
        uniquePatients: 0,
      })
    }

    const visits = await prisma.visit.findMany({
      where: { clinicianId: session.user.id },
      select: { id: true, status: true, startedAt: true, finalizedAt: true },
      orderBy: { startedAt: 'asc' },
      take: 500,
    })

    const buckets = new Map<string, number>()
    for (const visit of visits) {
      const key = formatDayKey(visit.startedAt)
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }

    return NextResponse.json({
      source: 'database_only',
      totals: {
        visits: visits.length,
        finalized: visits.filter((visit) => visit.status === 'finalized').length,
        draft: visits.filter((visit) => visit.status !== 'finalized').length,
      },
      visitsOverTime: Array.from(buckets.entries()).map(([date, count]) => ({ date, count })),
      topMedications: [],
      topSymptoms: [],
      note: 'Elastic analytics are disabled in the Amazon Nova hackathon build.',
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}

