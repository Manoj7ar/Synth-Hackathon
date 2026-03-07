function readEnv(name: string) {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

export function getAppName() {
  return readEnv('APP_NAME') ?? 'synth'
}

export function getAwsRegion() {
  return readEnv('AWS_REGION')
}

export function getNovaTextModelId() {
  return readEnv('BEDROCK_NOVA_TEXT_MODEL_ID') ?? 'amazon.nova-lite-v1:0'
}

export function getNovaFastModelId() {
  return (
    readEnv('BEDROCK_NOVA_FAST_MODEL_ID') ??
    readEnv('BEDROCK_NOVA_TEXT_MODEL_ID') ??
    'amazon.nova-micro-v1:0'
  )
}

export function isNovaConfigured() {
  return Boolean(getAwsRegion())
}

export function getNextAuthUrl() {
  return readEnv('NEXTAUTH_URL')
}

export function getPublicAppUrl() {
  return readEnv('NEXT_PUBLIC_APP_URL')
}

export function isAuthConfigured() {
  return Boolean(getNextAuthUrl() && readEnv('NEXTAUTH_SECRET'))
}

export function isPublicUrlConfigured() {
  return Boolean(getPublicAppUrl())
}

export function getUploadsBucketName() {
  return readEnv('S3_BUCKET_AUDIO_UPLOADS')
}

export function isUploadsBucketConfigured() {
  return Boolean(getUploadsBucketName())
}

export function getTranscribeLanguageCode() {
  return readEnv('TRANSCRIBE_LANGUAGE_CODE') ?? 'en-US'
}

export function isAwsTranscribeConfigured() {
  return Boolean(getAwsRegion() && getUploadsBucketName())
}

export function getAppVersion() {
  return process.env.npm_package_version ?? '0.0.0'
}
