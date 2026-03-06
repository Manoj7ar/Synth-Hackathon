import { NextResponse } from 'next/server'
import { getAppVersion, isNovaConfigured } from '@/lib/config'
import { getPrismaDatabaseUrl, prisma } from '@/lib/prisma'

export async function GET() {
  const databaseEnvPresent = Boolean(getPrismaDatabaseUrl())
  let databaseReachable = false

  if (databaseEnvPresent) {
    try {
      await prisma.$queryRaw`SELECT 1`
      databaseReachable = true
    } catch (error) {
      console.error('Health check database probe failed:', error)
    }
  }

  const novaConfigured = isNovaConfigured()
  const ok = databaseReachable && novaConfigured

  return NextResponse.json(
    {
      ok,
      service: 'synth-nova',
      version: getAppVersion(),
      checks: {
        databaseEnvPresent,
        databaseReachable,
        novaConfigured,
      },
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  )
}
