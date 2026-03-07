# AWS Deployment Checklist

This checklist is the intended Phase 1 deployment path for Synth on AWS with the current Prisma-backed auth flow.

This deployment path includes AWS Transcribe server-side audio transcription and the current Prisma-backed clinician auth flow.

## Inputs You Need

- AWS account with Bedrock model access enabled
- Target AWS region
- Docker available locally or in CI
- AWS CLI authenticated for ECR, ECS, Secrets Manager, and Terraform usage

## Runtime Values You Must Provide

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_SECRET`
- `AWS_REGION`
- `BEDROCK_NOVA_TEXT_MODEL_ID`
- `BEDROCK_NOVA_FAST_MODEL_ID`
- `TRANSCRIBE_LANGUAGE_CODE`

Terraform can generate `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `NEXT_PUBLIC_APP_URL` for the default hackathon deployment path.

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

- image URI
- optional networking overrides
- optional public app URLs
- optional database password
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
- `vpc_id`
- `public_subnet_ids`
- `private_subnet_ids`

### 4. Write runtime secrets

This step is optional for the default hackathon deployment path because Terraform already writes the initial app secret values.

Use the helper script only if you want to override generated values after the first deploy:

```powershell
./scripts/deploy/set-app-secrets.ps1 `
  -SecretId <secret-name-or-arn> `
  -DatabaseUrl "postgresql://..." `
  -DirectUrl "postgresql://..." `
  -NextAuthSecret "<secret>" `
  -AwsRegion <region>
```

### 5. Run Prisma migrations against RDS

Recommended command:

```bash
npx prisma migrate deploy
```

Run this from an environment that can reach the deployed RDS instance.

### 6. Force or verify ECS rollout

Make sure the ECS service is using the intended image and fresh secret values. If you changed the secret after Terraform apply, force a new deployment.

### 7. Validate the deployment

Check:

- `/api/health`
- login and signup
- transcript save flow
- SOAP generation
- patient share link
- patient chat
- server transcription if configured

## Expected Health Check State

`/api/health` should report:

- `databaseEnvPresent: true`
- `databaseReachable: true`
- `novaConfigured: true`
- `authConfigured: true`
- `publicUrlConfigured: true`

`uploadsBucketConfigured` may be `true` even if audio transcription is still inactive.

If Transcribe is configured, `/api/health` will also report:

- `transcribeConfigured: true`
