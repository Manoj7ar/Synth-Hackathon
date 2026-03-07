import { NextResponse } from 'next/server'
import {
  getAppName,
  getAppVersion,
  getNextAuthUrl,
  getPublicAppUrl,
  getUploadsBucketName,
  isAuthConfigured,
  isAwsTranscribeConfigured,
  isNovaConfigured,
  isPublicUrlConfigured,
  isUploadsBucketConfigured,
} from '@/lib/config'
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
  const authConfigured = isAuthConfigured()
  const publicUrlConfigured = isPublicUrlConfigured()
  const uploadsBucketConfigured = isUploadsBucketConfigured()
  const transcribeConfigured = isAwsTranscribeConfigured()
  const ok = databaseReachable && novaConfigured && authConfigured && publicUrlConfigured

  return NextResponse.json(
    {
      ok,
      service: getAppName(),
      version: getAppVersion(),
      checks: {
        databaseEnvPresent,
        databaseReachable,
        novaConfigured,
        authConfigured,
        publicUrlConfigured,
        uploadsBucketConfigured,
        transcribeConfigured,
      },
      config: {
        nextauthUrl: getNextAuthUrl() ?? null,
        publicAppUrl: getPublicAppUrl() ?? null,
        uploadsBucket: getUploadsBucketName() ?? null,
      },
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  )
}
