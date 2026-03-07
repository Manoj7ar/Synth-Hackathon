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
  description = "Optional existing VPC ID. Leave empty to let Terraform create a VPC."
  default     = ""
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Optional existing public subnets for ALB. Leave empty to let Terraform create them."
  default     = []
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Optional existing private subnets for ECS and RDS. Leave empty to let Terraform create them."
  default     = []
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
  description = "Optional RDS password override. Leave empty to generate one automatically."
  default     = ""
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

variable "transcribe_language_code" {
  type        = string
  default     = "en-US"
  description = "AWS Transcribe language code for server-side transcription"
}

variable "nextauth_url" {
  type        = string
  description = "Optional public URL used by NextAuth. Leave empty to use the ALB DNS name."
  default     = ""
}

variable "next_public_app_url" {
  type        = string
  description = "Optional public app URL exposed to the frontend. Leave empty to use the ALB DNS name."
  default     = ""
}

