# Synth Nova (Amazon Nova Hackathon Build)

Synth Nova is a clinical visit copilot built for the Amazon Nova Hackathon.
It converts visit transcripts into structured summaries and SOAP notes, then powers grounded patient-safe chat over the saved visit record.

## What Changed in This Hackathon Pivot

- Amazon Nova (via Amazon Bedrock) replaces Gemini for text generation
- Elasticsearch/Kibana integrations are removed from runtime paths
- Supabase runtime adapter is replaced with native Prisma + PostgreSQL
- Analytics and finalization flows are simplified for a lean hackathon MVP
- AWS deployment scaffolding added (Docker + Terraform skeleton)

## Core Demo Flow

1. Clinician signs in
2. Capture or paste transcript (browser live transcript path supported)
3. Save visit -> generate summary + SOAP notes with Amazon Nova
4. Open patient share link
5. Ask grounded patient questions with citations in chat

## Hackathon Scope Notes

- Server-side audio transcription is intentionally disabled in this build
- Use browser live transcript on `/transcribe` or transcript text in `/api/landing/soap-preview`
- This is a production-ish AWS deployment plan, not a compliance-certified healthcare deployment

## Environment Setup

Copy `.env.example` to `.env` and fill in values.

Required for local app + Nova generation:

- `DATABASE_URL`
- `DIRECT_URL`
- `AWS_REGION`
- `BEDROCK_NOVA_TEXT_MODEL_ID` (or use default)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`

Local Bedrock auth options:

- Use `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`, or
- Use AWS SSO / shared credentials profile in your shell, or
- Run in AWS with task role permissions (recommended for deployed environment)

## Local Development

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Open `http://localhost:3000`.

## AWS Deployment (Production-ish Hackathon Target)

Target stack:

- ECS Fargate (Next.js container)
- ALB
- ECR
- RDS PostgreSQL
- Bedrock (Amazon Nova)
- S3 (optional uploads)
- Secrets Manager
- CloudWatch Logs

Artifacts included in this repo:

- `Dockerfile`
- `.dockerignore`
- `infra/terraform/*`
- `docs/HACKATHON_SUBMISSION.md`

## Verification Checklist

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Note: after dependency changes, run `npm install` to update `node_modules` and `package-lock.json` before running checks.

## Health Endpoint

- `GET /api/health`

Returns basic status plus whether Nova and database env vars are configured.

## License

MIT (see `LICENSE`)

