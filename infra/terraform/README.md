# Terraform Scaffold (AWS Production-ish Hackathon Deploy)

This folder provides a starting Terraform configuration for deploying the Synth Nova app to AWS with:

- ECS Fargate
- ALB
- ECR
- RDS PostgreSQL
- S3
- CloudWatch Logs
- Bedrock/Nova IAM permissions
- Secrets Manager secret for app env values

## What You Must Provide

- Existing `vpc_id`
- Existing `public_subnet_ids`
- Existing `private_subnet_ids`
- A built/pushed app image URI (`app_image_uri`)
- `db_password`
- `nextauth_url`
- `next_public_app_url`

## Important Notes

- This is a hackathon-oriented scaffold, not a hardened production baseline.
- You still need to write the secret JSON values to the created Secrets Manager secret (DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET).
- Add HTTPS (`aws_lb_listener` with ACM cert on 443) before a public demo domain.
- If you want a fully private RDS bootstrap, run Prisma migrations from CI or a one-off ECS task.

## Suggested Next Steps

1. `terraform init`
2. Create a `terraform.tfvars` file with your VPC/subnets/image URI
3. `terraform plan`
4. `terraform apply`
5. Populate the Secrets Manager secret values
6. Force new ECS deployment

