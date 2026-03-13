# Synth Hackathon Quickstart

This is the fastest path to get Synth running and demo-ready.

Want to learn more about how AWS is integrated in the application? Read [`../architecture/aws-amazon-nova-integration-deep-dive.md`](../architecture/aws-amazon-nova-integration-deep-dive.md).

## 1. Install and seed

```bash
npm install
npm run setup
```

## 2. Configure env

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL`
- `DIRECT_URL`
- `AWS_REGION`
- `BEDROCK_NOVA_TEXT_MODEL_ID`
- `BEDROCK_NOVA_MULTIMODAL_MODEL_ID`
- `S3_BUCKET_AUDIO_UPLOADS`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`

## 3. Run locally

```bash
npm run dev
```

## 4. Verify before demo day

```bash
npm run verify
```

## 5. Demo account

- Email: `admin@synth.health`
- Password: `synth2025`

## 6. Recommended judging flow

1. Open `/` and generate a transcript or audio preview with an image artifact.
2. Sign in and open Sarah Johnson.
3. Show `Patient Twin` for the longitudinal story.
4. Open `Evidence Lab` and run reconciliation.
5. Approve one suggested action into the chart.
6. Open the latest SOAP note and patient share flow.

## 7. Where the AWS story lives in code

- `src/lib/ai/nova.ts`
- `src/lib/aws/transcribe.ts`
- `src/lib/clinical/clinical-notes.ts`
- `src/lib/clinical/visit-artifacts.ts`
- `src/lib/clinical/reconciliation.ts`
- `src/app/api/landing/soap-preview/route.ts`
- `src/app/api/chat/route.ts`

## 8. Top-level repo map

- `src/app` routes and APIs
- `src/components` UI grouped by feature
- `src/lib/ai` Nova and Bedrock
- `src/lib/aws` AWS config and Transcribe
- `src/lib/auth` auth and route guards
- `src/lib/clinical` clinical logic
- `src/lib/data` Prisma and storage helpers
- `src/lib/demo` seeded demo data
- `docs` pitch and architecture docs
