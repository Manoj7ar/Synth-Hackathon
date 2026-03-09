function readEnv(name: string) {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

const DEFAULT_NOVA_MODEL_ID = 'us.amazon.nova-2-lite-v1:0'

export function getAppName() {
  return readEnv('APP_NAME') ?? 'synth'
}

export function getAwsRegion() {
  return readEnv('AWS_REGION')
}

export function getNovaTextModelId() {
  return readEnv('BEDROCK_NOVA_TEXT_MODEL_ID') ?? DEFAULT_NOVA_MODEL_ID
}

export function getNovaMultimodalModelId() {
  return (
    readEnv('BEDROCK_NOVA_MULTIMODAL_MODEL_ID') ??
    readEnv('BEDROCK_NOVA_TEXT_MODEL_ID') ??
    DEFAULT_NOVA_MODEL_ID
  )
}

export function getNovaFastModelId() {
  return (
    readEnv('BEDROCK_NOVA_FAST_MODEL_ID') ??
    readEnv('BEDROCK_NOVA_TEXT_MODEL_ID') ??
    DEFAULT_NOVA_MODEL_ID
  )
}

export function isNovaConfigured() {
  return Boolean(getAwsRegion() && getNovaTextModelId() && getNovaMultimodalModelId())
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
