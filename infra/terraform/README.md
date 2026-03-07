# Terraform Scaffold (AWS Deploy)

This folder provides a starting Terraform configuration for deploying the Synth app to AWS with:

- ECS Fargate
- ALB
- ECR
- RDS PostgreSQL
- S3
- CloudWatch Logs
- Bedrock/Nova IAM permissions
- Secrets Manager secret for app env values

## What You Must Provide

- A built/pushed app image URI (`app_image_uri`)

Optional overrides:

- Existing `vpc_id`
- Existing `public_subnet_ids`
- Existing `private_subnet_ids`
- `db_password`
- `nextauth_url`
- `next_public_app_url`

## Important Notes

- This scaffold is designed to get Synth deployed quickly on AWS with the core services the app expects.
- Terraform now creates a VPC, public subnets, private subnets, NAT gateway, database password, and initial app secret values when you do not supply them.
- Add HTTPS (`aws_lb_listener` with ACM cert on 443) before a public demo domain.
- If you supply your own VPC, ECS tasks still need outbound access through NAT or the required VPC endpoints.
- If you want a fully private RDS bootstrap, run Prisma migrations from CI or a one-off ECS task.

## Suggested Next Steps

1. `terraform init`
2. Create a `terraform.tfvars` file with your image URI and any optional overrides
3. `terraform plan`
4. `terraform apply`
5. Run Prisma migrations against the created database
6. Force new ECS deployment if you update secrets after the first apply
