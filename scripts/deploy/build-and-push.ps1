param(
  [Parameter(Mandatory = $true)]
  [string]$ImageTag,
  [Parameter(Mandatory = $true)]
  [string]$AwsRegion,
  [Parameter(Mandatory = $true)]
  [string]$EcrRepositoryUri
)

$ErrorActionPreference = 'Stop'

Write-Host "Building Docker image..."
docker build -t synth-nova:$ImageTag .

Write-Host "Tagging image for ECR..."
docker tag synth-nova:$ImageTag "$EcrRepositoryUri:$ImageTag"

Write-Host "Push requires ECR login (run aws ecr get-login-password ... | docker login first)."
Write-Host "Pushing image..."
docker push "$EcrRepositoryUri:$ImageTag"

Write-Host "Done. Update Terraform variable app_image_uri to $EcrRepositoryUri:$ImageTag and deploy."

