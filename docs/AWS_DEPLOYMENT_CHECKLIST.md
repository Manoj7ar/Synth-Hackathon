# AWS Deployment Checklist

This checklist is the intended Phase 1 deployment path for Synth on AWS with the current Prisma-backed auth flow.

Phase 2 support is now included for:

- Amazon Cognito clinician authentication
- AWS Transcribe server-side audio transcription

## Inputs You Need

- AWS account with Bedrock model access enabled
- Target AWS region
- Existing VPC
- Public subnets for ALB
- Private subnets for ECS and RDS
- Docker available locally or in CI
- AWS CLI authenticated for ECR, ECS, Secrets Manager, and Terraform usage

## Runtime Values You Must Provide

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `AWS_REGION`
- `BEDROCK_NOVA_TEXT_MODEL_ID`
- `BEDROCK_NOVA_FAST_MODEL_ID`
- `TRANSCRIBE_LANGUAGE_CODE`

Optional for Cognito auth:

- `COGNITO_ISSUER`
- `COGNITO_CLIENT_ID`
- `COGNITO_CLIENT_SECRET`
- `ALLOW_LEGACY_CREDENTIALS`

## Deployment Steps

### 1. Build and push the app image

Use:

```powershell
./scripts/deploy/build-and-push.ps1 -ImageTag <tag> -AwsRegion <region> -EcrRepositoryUri <account>.dkr.ecr.<region>.amazonaws.com/<repo>
```

### 2. Fill Terraform variables

Copy:

- `infra/terraform/terraform.tfvars.example`

Create:

- `infra/terraform/terraform.tfvars`

Set:

- VPC and subnet IDs
- image URI
- public app URLs
- database password
- optional model overrides

### 3. Apply infrastructure

From `infra/terraform/`:

```bash
terraform init
terraform plan
terraform apply
```

Capture these outputs:

- `alb_dns_name`
- `app_url`
- `rds_endpoint`
- `app_env_secret_name`
- `uploads_bucket`

### 4. Write runtime secrets

Use the helper script:

```powershell
./scripts/deploy/set-app-secrets.ps1 `
  -SecretId <secret-name-or-arn> `
  -DatabaseUrl "postgresql://..." `
  -DirectUrl "postgresql://..." `
  -NextAuthSecret "<secret>" `
  -CognitoClientSecret "<optional-secret>" `
  -AwsRegion <region>
```

### 5. Run Prisma migrations against RDS

Recommended command:

```bash
npx prisma migrate deploy
```

Run this from an environment that can reach the deployed RDS instance.

### 6. Force or verify ECS rollout

Make sure the ECS service is using the intended image and fresh secret values.

### 7. Validate the deployment

Check:

- `/api/health`
- login and signup
- transcript save flow
- SOAP generation
- patient share link
- patient chat
- Cognito login if configured
- server transcription if configured

## Expected Health Check State

`/api/health` should report:

- `databaseEnvPresent: true`
- `databaseReachable: true`
- `novaConfigured: true`
- `authConfigured: true`
- `publicUrlConfigured: true`

`uploadsBucketConfigured` may be `true` even if audio transcription is still inactive.

If Cognito and Transcribe are configured, `/api/health` will also report:

- `cognitoConfigured: true`
- `transcribeConfigured: true`
