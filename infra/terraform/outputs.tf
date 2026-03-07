output "alb_dns_name" {
  value       = aws_lb.app.dns_name
  description = "Load balancer DNS for the app"
}

output "app_url" {
  value       = "http://${aws_lb.app.dns_name}"
  description = "Temporary public HTTP URL for the deployed app"
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.app.name
}

output "ecs_service_name" {
  value = aws_ecs_service.app.name
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "rds_endpoint" {
  value       = aws_db_instance.postgres.address
  description = "RDS PostgreSQL endpoint"
}

output "uploads_bucket" {
  value = aws_s3_bucket.uploads.bucket
}

output "app_env_secret_arn" {
  value = aws_secretsmanager_secret.app_env.arn
}

output "app_env_secret_name" {
  value       = aws_secretsmanager_secret.app_env.name
  description = "Secrets Manager secret name used by the ECS task"
}
