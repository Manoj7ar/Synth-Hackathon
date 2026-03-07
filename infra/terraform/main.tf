terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name_prefix        = "${var.project_name}-${var.environment}"
  create_network     = var.vpc_id == ""
  selected_azs       = slice(data.aws_availability_zones.available.names, 0, min(2, length(data.aws_availability_zones.available.names)))
  public_subnet_cidrs  = [for index, _ in local.selected_azs : cidrsubnet("10.42.0.0/16", 8, index)]
  private_subnet_cidrs = [for index, _ in local.selected_azs : cidrsubnet("10.42.0.0/16", 8, index + 100)]
  vpc_id             = local.create_network ? aws_vpc.app[0].id : var.vpc_id
  public_subnet_ids  = local.create_network ? aws_subnet.public[*].id : var.public_subnet_ids
  private_subnet_ids = local.create_network ? aws_subnet.private[*].id : var.private_subnet_ids
  db_password        = var.db_password != "" ? var.db_password : random_password.db[0].result
  nextauth_url       = var.nextauth_url != "" ? var.nextauth_url : "http://${aws_lb.app.dns_name}"
  app_url            = var.next_public_app_url != "" ? var.next_public_app_url : local.nextauth_url
  database_host      = aws_db_instance.postgres.address
  database_url       = "postgresql://${var.db_username}:${local.db_password}@${local.database_host}:5432/${var.db_name}"
  common_tags = merge({
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Hackathon   = "amazon-nova"
  }, var.tags)
}

resource "aws_vpc" "app" {
  count = local.create_network ? 1 : 0

  cidr_block           = "10.42.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc"
  })
}

resource "aws_internet_gateway" "app" {
  count = local.create_network ? 1 : 0

  vpc_id = aws_vpc.app[0].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-igw"
  })
}

resource "aws_subnet" "public" {
  count = local.create_network ? length(local.selected_azs) : 0

  vpc_id                  = aws_vpc.app[0].id
  availability_zone       = local.selected_azs[count.index]
  cidr_block              = local.public_subnet_cidrs[count.index]
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-${count.index + 1}"
    Tier = "public"
  })
}

resource "aws_subnet" "private" {
  count = local.create_network ? length(local.selected_azs) : 0

  vpc_id            = aws_vpc.app[0].id
  availability_zone = local.selected_azs[count.index]
  cidr_block        = local.private_subnet_cidrs[count.index]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-${count.index + 1}"
    Tier = "private"
  })
}

resource "aws_eip" "nat" {
  count = local.create_network ? 1 : 0

  domain = "vpc"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nat-eip"
  })
}

resource "aws_nat_gateway" "app" {
  count = local.create_network ? 1 : 0

  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nat"
  })

  depends_on = [aws_internet_gateway.app]
}

resource "aws_route_table" "public" {
  count = local.create_network ? 1 : 0

  vpc_id = aws_vpc.app[0].id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.app[0].id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-rt"
  })
}

resource "aws_route_table_association" "public" {
  count = local.create_network ? length(aws_subnet.public) : 0

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public[0].id
}

resource "aws_route_table" "private" {
  count = local.create_network ? 1 : 0

  vpc_id = aws_vpc.app[0].id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.app[0].id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-rt"
  })
}

resource "aws_route_table_association" "private" {
  count = local.create_network ? length(aws_subnet.private) : 0

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[0].id
}

resource "random_password" "db" {
  count = var.db_password == "" ? 1 : 0

  length           = 24
  special          = true
  override_special = "!@#%^*-_=+?"
}

resource "random_password" "nextauth" {
  length  = 48
  special = false
}

resource "aws_ecr_repository" "app" {
  name                 = "${local.name_prefix}-app"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.common_tags
}

resource "aws_s3_bucket" "uploads" {
  bucket = var.s3_bucket_name != "" ? var.s3_bucket_name : "${local.name_prefix}-uploads"
  tags   = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name_prefix}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_db_subnet_group" "app" {
  name       = "${local.name_prefix}-db-subnets"
  subnet_ids = local.private_subnet_ids
  tags       = local.common_tags
}

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "ALB security group"
  vpc_id      = local.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

resource "aws_security_group" "app" {
  name        = "${local.name_prefix}-app-sg"
  description = "App security group"
  vpc_id      = local.vpc_id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

resource "aws_security_group" "db" {
  name        = "${local.name_prefix}-db-sg"
  description = "DB security group"
  vpc_id      = local.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

resource "aws_db_instance" "postgres" {
  identifier              = "${local.name_prefix}-postgres"
  engine                  = "postgres"
  engine_version          = var.db_engine_version
  instance_class          = var.db_instance_class
  allocated_storage       = var.db_allocated_storage
  db_name                 = var.db_name
  username                = var.db_username
  password                = local.db_password
  db_subnet_group_name    = aws_db_subnet_group.app.name
  vpc_security_group_ids  = [aws_security_group.db.id]
  skip_final_snapshot     = true
  publicly_accessible     = false
  backup_retention_period = 1
  multi_az                = false

  tags = local.common_tags
}

resource "aws_secretsmanager_secret" "app_env" {
  name = "${local.name_prefix}/app-env"
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "app_env" {
  secret_id = aws_secretsmanager_secret.app_env.id
  secret_string = jsonencode({
    DATABASE_URL    = local.database_url
    DIRECT_URL      = local.database_url
    NEXTAUTH_SECRET = random_password.nextauth.result
  })
}

resource "aws_ecs_cluster" "app" {
  name = "${local.name_prefix}-cluster"
  tags = local.common_tags
}

resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.name_prefix}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_task_execution_secret_access" {
  name = "${local.name_prefix}-ecs-execution-secret-access"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue"
      ]
      Resource = [aws_secretsmanager_secret.app_env.arn]
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "${local.name_prefix}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "bedrock_access" {
  name = "${local.name_prefix}-bedrock-access"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "transcribe:StartTranscriptionJob",
          "transcribe:GetTranscriptionJob"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [aws_secretsmanager_secret.app_env.arn]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.uploads.arn,
          "${aws_s3_bucket.uploads.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_lb" "app" {
  name               = substr("${local.name_prefix}-alb", 0, 32)
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = local.public_subnet_ids
  tags               = local.common_tags
}

resource "aws_lb_target_group" "app" {
  name        = substr("${local.name_prefix}-tg", 0, 32)
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = local.vpc_id
  target_type = "ip"

  health_check {
    path                = "/api/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = local.common_tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

resource "aws_ecs_task_definition" "app" {
  family                   = "${local.name_prefix}-task"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = tostring(var.app_cpu)
  memory                   = tostring(var.app_memory)
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "app"
      image     = var.app_image_uri
      essential = true
      portMappings = [{
        containerPort = 3000
        protocol      = "tcp"
      }]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.app.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
      environment = [
        { name = "APP_NAME", value = var.project_name },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "BEDROCK_NOVA_TEXT_MODEL_ID", value = var.bedrock_nova_text_model_id },
        { name = "BEDROCK_NOVA_FAST_MODEL_ID", value = var.bedrock_nova_fast_model_id },
        { name = "TRANSCRIBE_LANGUAGE_CODE", value = var.transcribe_language_code },
        { name = "NEXTAUTH_URL", value = local.nextauth_url },
        { name = "NEXT_PUBLIC_APP_URL", value = local.app_url },
        { name = "S3_BUCKET_AUDIO_UPLOADS", value = aws_s3_bucket.uploads.bucket },
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = "${aws_secretsmanager_secret.app_env.arn}:DATABASE_URL::" },
        { name = "DIRECT_URL", valueFrom = "${aws_secretsmanager_secret.app_env.arn}:DIRECT_URL::" },
        { name = "NEXTAUTH_SECRET", valueFrom = "${aws_secretsmanager_secret.app_env.arn}:NEXTAUTH_SECRET::" }
      ]
    }
  ])

  tags = local.common_tags
}

resource "aws_ecs_service" "app" {
  name            = "${local.name_prefix}-service"
  cluster         = aws_ecs_cluster.app.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.app_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.private_subnet_ids
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.http]
  tags       = local.common_tags
}
