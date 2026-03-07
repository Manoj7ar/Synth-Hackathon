# Amazon Nova Hackathon Submission Notes (Synth Nova)

Source of truth for the hackathon page:
- https://amazon-nova.devpost.com/

## Submission Snapshot

- Project: Synth Nova
- Recommended category: Agentic AI
- Public repo: https://github.com/Manoj7ar/Synth-Hackathon
- Submission deadline: March 16, 2026 at 5:00 PM PDT

## One-Line Pitch

Synth Nova turns clinician-patient visit transcripts into structured clinical outputs and a grounded patient-safe follow-up chat using Amazon Nova through Amazon Bedrock.

## Amazon Nova Usage

Amazon Nova is used via Amazon Bedrock for:

- conversation summarization in `src/lib/clinical-notes.ts`
- SOAP note generation in `src/lib/clinical-notes.ts`
- grounded clinician/patient chat in `src/app/api/chat/route.ts`
- assistant and report generation in `src/app/api/assistant/route.ts` and `src/app/api/soap-actions/[visitId]/report/route.ts`

Core provider:

- `src/lib/nova.ts`

## Recommended Demo Flow

1. Open the landing page and show transcript preview or browser live transcript.
2. Sign in as the demo clinician.
3. Save a visit and open the generated summary plus SOAP notes.
4. Show the patient share experience and ask grounded questions.
5. Ask about blood pressure history to show citations and the trend visualization.
6. End on the technology/AWS architecture page and mention Bedrock + Amazon Nova explicitly.

## Demo Credentials

- Email: `admin@synth.health`
- Password: `synth2025`

## Submission Checklist

The Devpost submission should include:

- a concise text description focused on the user problem, Amazon Nova usage, and why this matters
- a video of 3 minutes or less showing the working product
- the hashtag `#AmazonNova` in the video
- the repository URL
- clear setup or testing steps
- demo credentials if judges need to sign in

If a private repo is ever used instead of the public repo, share access with:

- `testing@devpost.com`
- `Amazon-Nova-hackathon@amazon.com`

## Judging Criteria Mapping

- Technical Implementation (60%): Bedrock + Amazon Nova integration, grounded chat, visit-to-SOAP workflow, AWS deployment scaffold
- Enterprise or Community Impact (20%): clinician documentation compression and clearer patient follow-up guidance
- Creativity and Innovation (20%): visit-linked patient chat, tool trace, and blood-pressure trend visualization over saved clinical context

## Known Scope Limits

- server-side audio transcription is intentionally disabled in this build
- this is a hackathon prototype, not a compliance-certified healthcare deployment
- AWS deployment still assumes existing VPC networking and outbound access for ECS tasks

## Final Devpost Framing

Use language that keeps Amazon Nova at the center:

- transcript to summary and SOAP note generation with Amazon Nova
- grounded patient-safe follow-up chat with source tags
- AWS-native deployment path using ECS, RDS, Bedrock, Secrets Manager, and CloudWatch
