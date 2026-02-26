function readEnv(name: string) {
  const value = process.env[name]?.trim()
  return value ? value : undefined
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

export function getAppVersion() {
  return process.env.npm_package_version ?? '0.0.0'
}

