# Synth Docs

This folder keeps the judge-facing and builder-facing documentation in one place.

Want to learn more about how AWS is integrated in the application? Start with [`architecture/aws-amazon-nova-integration-deep-dive.md`](architecture/aws-amazon-nova-integration-deep-dive.md).

## Start here

- `hackathon/HACKATHON_QUICKSTART.md` for the fastest local setup and demo flow
- `architecture/aws-amazon-nova-integration-deep-dive.md` for the detailed AWS and Amazon Nova implementation notes
- `../infra/terraform/README.md` for infrastructure provisioning details

## Repo map

- `src/app` contains the user-facing routes and API handlers
- `src/components` contains UI grouped by feature
- `src/lib/ai` contains Bedrock and Nova integration
- `src/lib/aws` contains AWS environment and Transcribe helpers
- `src/lib/auth` contains auth options and clinician guards
- `src/lib/clinical` contains clinical domain logic
- `src/lib/data` contains data access and token utilities
- `src/lib/demo` contains seeded demo content
- `src/lib/ui` contains UI-only shared helpers
