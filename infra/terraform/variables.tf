variable "aws_region" {
  type        = string
  description = "AWS region for all resources and Bedrock access"
  default     = "us-east-1"
}

variable "project_name" {
  type        = string
  default     = "synth-nova"
}

variable "environment" {
  type        = string
  default     = "hackathon"
}

variable "tags" {
  type        = map(string)
  default     = {}
}

variable "vpc_id" {
  type        = string
  description = "Existing VPC ID"
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Public subnets for ALB"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private subnets for ECS and RDS"
}

variable "app_image_uri" {
  type        = string
  description = "ECR image URI (tagged) for the Next.js app"
}

variable "app_cpu" {
  type    = number
  default = 512
}

variable "app_memory" {
  type    = number
  default = 1024
}

variable "app_desired_count" {
  type    = number
  default = 1
}

variable "log_retention_days" {
  type    = number
  default = 14
}

variable "db_engine_version" {
  type    = string
  default = "16.3"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_allocated_storage" {
  type    = number
  default = 20
}

variable "db_name" {
  type    = string
  default = "synth"
}

variable "db_username" {
  type    = string
  default = "synth"
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "RDS password for initial DB bootstrap (use Secrets Manager in real deployments)"
}

variable "s3_bucket_name" {
  type        = string
  default     = ""
  description = "Optional explicit bucket name"
}

variable "bedrock_nova_text_model_id" {
  type    = string
  default = "amazon.nova-lite-v1:0"
}

variable "bedrock_nova_fast_model_id" {
  type    = string
  default = "amazon.nova-micro-v1:0"
}

variable "cognito_issuer" {
  type        = string
  default     = ""
  description = "Amazon Cognito issuer URL for NextAuth"
}

variable "cognito_client_id" {
  type        = string
  default     = ""
  description = "Amazon Cognito app client ID"
}

variable "allow_legacy_credentials" {
  type        = bool
  default     = false
  description = "Allow local credentials auth alongside Cognito"
}

variable "transcribe_language_code" {
  type        = string
  default     = "en-US"
  description = "AWS Transcribe language code for server-side transcription"
}

variable "nextauth_url" {
  type        = string
  description = "Public URL used by NextAuth (e.g. https://app.example.com)"
}

variable "next_public_app_url" {
  type        = string
  description = "Public app URL exposed to the frontend"
}

