# Amazon Nova Hackathon Submission Notes (Synth Nova)

## Project Summary

Synth Nova is an AI clinical visit copilot that transforms visit transcripts into structured clinical outputs (summary + SOAP note) and provides a grounded patient-safe chat assistant over the saved visit record.

## Amazon Nova Usage (Required)

Amazon Nova is used via Amazon Bedrock for:

- Conversation summarization (`src/lib/clinical-notes.ts`)
- SOAP note generation (`src/lib/clinical-notes.ts`)
- Patient/clinician grounded chat generation (`src/app/api/chat/route.ts`)
- Assistant/report text generation (`src/app/api/assistant/route.ts`, `src/app/api/soap-actions/[visitId]/report/route.ts`)

Core provider implementation:

- `src/lib/nova.ts`

## AWS Architecture (Production-ish Hackathon Setup)

- ECS Fargate: Next.js application runtime
- ALB: traffic routing
- ECR: container images
- RDS PostgreSQL: transactional app data
- Bedrock (Amazon Nova): LLM inference
- S3: optional uploads / artifacts
- Secrets Manager: runtime secrets
- CloudWatch Logs: logs + health visibility

Terraform scaffold:

- `infra/terraform/main.tf`
- `infra/terraform/variables.tf`
- `infra/terraform/outputs.tf`

## Demo Flow (Recommended)

1. Login as clinician
2. Create/save visit from transcript text (or browser live transcript)
3. Show Nova-generated summary and SOAP notes
4. Open patient share link
5. Ask patient-facing questions and show grounded/cited response
6. Show `/api/health` and briefly mention AWS deployment architecture

## Known Limitations (Hackathon Scope)

- Server-side audio transcription disabled in current Nova hackathon build
- Elasticsearch/Kibana analytics intentionally removed to focus on Nova-driven core workflow
- Not a compliance-certified healthcare deployment (demo/prototype)

## Judging Criteria Mapping

- Technical Implementation (60%): Bedrock/Nova integration + AWS deployment + end-to-end workflow
- Idea (25%): Clinical workflow compression (transcript -> SOAP -> patient-safe guidance)
- UX (15%): Simple demoable flow with grounded answers and share-link patient experience

