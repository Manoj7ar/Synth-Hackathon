import { NextResponse } from 'next/server'
import { getAppVersion, isNovaConfigured } from '@/lib/config'
import { getPrismaDatabaseUrl } from '@/lib/prisma'

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'synth-nova',
    version: getAppVersion(),
    checks: {
      databaseEnvPresent: Boolean(getPrismaDatabaseUrl()),
      novaConfigured: isNovaConfigured(),
    },
    timestamp: new Date().toISOString(),
  })
}

