param(
  [Parameter(Mandatory = $true)]
  [string]$SecretId,
  [Parameter(Mandatory = $true)]
  [string]$DatabaseUrl,
  [Parameter(Mandatory = $true)]
  [string]$DirectUrl,
  [Parameter(Mandatory = $true)]
  [string]$NextAuthSecret,
  [string]$AwsRegion = ""
)

$ErrorActionPreference = 'Stop'

$secretPayload = @{
  DATABASE_URL    = $DatabaseUrl
  DIRECT_URL      = $DirectUrl
  NEXTAUTH_SECRET = $NextAuthSecret
}

$secretPayload = $secretPayload | ConvertTo-Json -Compress

$cliArgs = @(
  'secretsmanager',
  'put-secret-value',
  '--secret-id', $SecretId,
  '--secret-string', $secretPayload
)

if ($AwsRegion) {
  $cliArgs += @('--region', $AwsRegion)
}

Write-Host "Writing app runtime secrets to Secrets Manager..."
aws @cliArgs
Write-Host "Done."
