# ---------------------------------------------------------------------------
# The cluster, the task definitions and the services.
#
# READ THIS BEFORE CHANGING ANYTHING HERE.
#
# Terraform owns the *shape* of a task definition — CPU, memory, environment,
# which SSM parameters are readable, the health check, the log group. It does
# NOT own the image. `.github/workflows/_deploy.yml` fetches the live definition
# at deploy time, replaces exactly the image field, and registers a new
# revision. That is what makes a deploy a rollout rather than a `terraform
# apply`, and what keeps a promotion to production a five-second registry
# lookup (§20.1).
#
# The two coexist because of the `lifecycle` blocks on the services:
#
#   ignore_changes = [task_definition]  Terraform will not drag the service back
#                                       to the revision it last wrote, which
#                                       would silently roll production back to
#                                       an older image.
#   ignore_changes = [desired_count]    autoscaling owns this number at runtime;
#                                       `desired_count` here is only the value a
#                                       brand-new service starts at.
#
# So: change capacity or configuration here and apply, then deploy to pick it
# up. Change the image by deploying. Never by applying.
# ---------------------------------------------------------------------------
resource "aws_ecs_cluster" "this" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name       = aws_ecs_cluster.this.name
  capacity_providers = ["FARGATE"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

locals {
  # A placeholder, and it stays one. The first deploy replaces it; every deploy
  # after that replaces whatever the previous one wrote. Terraform never reads
  # it back, because the services ignore task_definition changes.
  placeholder_image = {
    for key, repo in aws_ecr_repository.this : key => "${repo.repository_url}:sha-PLACEHOLDER"
  }

  # Configuration that is not secret. Every value here is environment-specific
  # and read at RUNTIME — none of it is baked into the image, which is the rule
  # that lets one artifact be promoted from dev to production (§20.1).
  api_environment = [
    { name = "NODE_ENV", value = "production" },
    { name = "APP_ENV", value = var.environment },
    { name = "PORT", value = "4000" },
    { name = "HOST", value = "0.0.0.0" },
    { name = "LOG_LEVEL", value = "info" },

    { name = "WEB_ORIGIN", value = "https://${var.domain_name}" },
    { name = "WEB_BASE_URL", value = "https://${var.domain_name}" },
    { name = "API_BASE_URL", value = "https://${var.domain_name}" },
    { name = "MEDIA_BASE_URL", value = "https://${var.domain_name}/media" },
    { name = "GOOGLE_CALLBACK_URL", value = "https://${var.domain_name}/v1/auth/google/callback" },

    # Empty in every environment, deliberately. Host-only cookies cannot cross
    # environments; a parent-domain cookie would send a dev session to
    # production.
    { name = "SESSION_COOKIE_DOMAIN", value = "" },
    { name = "AUTH_MODE", value = "cookie" },

    { name = "STORAGE_DRIVER", value = "r2" },
    { name = "S3_REGION", value = "auto" },
    { name = "S3_FORCE_PATH_STYLE", value = "true" },

    # Shared state, not process memory. With more than one task the in-process
    # counter permitted N times every rate limit and reported nothing; `env.ts`
    # now refuses `memory` in production for exactly that reason (§18).
    { name = "CACHE_DRIVER", value = "postgres" },

    # Fail readiness, then wait, then close the listener. This value must be
    # comfortably longer than the target group's
    # interval x unhealthy_threshold (15s x 3 = 45s is the detection ceiling;
    # in practice the load balancer stops routing well before that), and
    # `stopTimeout` below must exceed drain + shutdown together.
    { name = "SHUTDOWN_DRAIN_MS", value = "5000" },
    { name = "SHUTDOWN_TIMEOUT_MS", value = "15000" },

    # Below the container limit, so V8 applies back-pressure before the kernel
    # OOM-killer does. See the api_node_heap_mb variable.
    { name = "NODE_OPTIONS", value = "--max-old-space-size=${var.api_node_heap_mb}" },

    { name = "PAYMENT_PROVIDER", value = "development" },
    { name = "MAIL_DRIVER", value = "console" },
    { name = "SMS_DRIVER", value = "console" },
    { name = "JOBS_ENABLED", value = "true" },

    # One task runs the schedules. See the comment on the API service below —
    # this is the reason api_desired_count is not simply "however many we like".
    { name = "WORKER_INLINE", value = "true" },
    { name = "RATE_LIMIT_ENABLED", value = "true" },
    { name = "DOCS_ENABLED", value = var.environment == "production" ? "false" : "true" },
  ]

  api_secrets = [
    for name in local.api_secret_names : {
      name      = name
      valueFrom = aws_ssm_parameter.api[name].arn
    }
  ]

  migrate_secrets = [
    for name in local.migrate_secret_names : {
      name      = name
      valueFrom = aws_ssm_parameter.api[name].arn
    }
  ]
}

# ── the API ───────────────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.api_task.arn

  runtime_platform {
    cpu_architecture        = "X86_64"
    operating_system_family = "LINUX"
  }

  container_definitions = jsonencode([
    {
      name        = "api"
      image       = local.placeholder_image.api
      essential   = true
      environment = local.api_environment
      secrets     = local.api_secrets

      portMappings = [
        { name = "api", containerPort = 4000, protocol = "tcp", appProtocol = "http" },
      ]

      healthCheck = {
        command = [
          "CMD-SHELL",
          "node -e \"fetch('http://127.0.0.1:4000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\"",
        ]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "api"
        }
      }

      # Must exceed SHUTDOWN_DRAIN_MS + SHUTDOWN_TIMEOUT_MS (5s + 15s). ECS
      # sends SIGKILL when this elapses, and a SIGKILL mid-drain is exactly the
      # cut-off request the drain exists to prevent.
      stopTimeout = 25
    },
  ])

  lifecycle {
    # A deploy registers a new revision with a new image. Terraform recreating
    # this resource is normal and harmless — the service ignores it.
    create_before_destroy = true
  }
}

resource "aws_ecs_service" "api" {
  name            = "${local.name}-api"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  # Long enough for the container to boot, connect to Postgres, start pg-boss
  # and answer /health/ready. Too short and a cold task is killed for failing a
  # check it never had time to pass, which looks like a crash loop.
  health_check_grace_period_seconds = 60

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 4000
  }

  # The safety net that makes `wait-for-service-stability` in _deploy.yml mean
  # something. If the new tasks never pass the target group's health check, ECS
  # rolls the service back to the previous task definition on its own — and the
  # workflow fails because the rollout never stabilised.
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  # 100/200 is a genuinely zero-downtime rollout: every existing task keeps
  # serving until the replacements are healthy. It costs double capacity for
  # the length of a deploy, which for a two-task service is four tasks for a
  # couple of minutes.
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  lifecycle {
    # See the header. The image is the deploy pipeline's, the count is
    # autoscaling's, and neither belongs to Terraform.
    ignore_changes = [task_definition, desired_count]
  }

  depends_on = [aws_lb_listener.https]
}

# ── the web app ───────────────────────────────────────────────────────────
resource "aws_ecs_task_definition" "web" {
  family                   = "${local.name}-web"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.web_cpu
  memory                   = var.web_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.web_task.arn

  runtime_platform {
    cpu_architecture        = "X86_64"
    operating_system_family = "LINUX"
  }

  container_definitions = jsonencode([
    {
      name      = "web"
      image     = local.placeholder_image.web
      essential = true

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "APP_ENV", value = var.environment },
        { name = "PORT", value = "3000" },

        # Server-to-server, through the load balancer. The browser never sees
        # this value: Next is a BFF here, so the browser talks to the site and
        # Next talks to the API.
        { name = "API_BASE_URL", value = "https://${var.domain_name}" },
        { name = "WEB_BASE_URL", value = "https://${var.domain_name}" },

        { name = "NODE_OPTIONS", value = "--max-old-space-size=${var.web_node_heap_mb}" },
        { name = "NEXT_TELEMETRY_DISABLED", value = "1" },
      ]

      # No secrets. The web app holds none — every credential belongs to the
      # API, which is the whole reason the browser never calls the API directly.

      portMappings = [
        { name = "web", containerPort = 3000, protocol = "tcp", appProtocol = "http" },
      ]

      healthCheck = {
        command = [
          "CMD-SHELL",
          "node -e \"fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\"",
        ]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.web.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "web"
        }
      }

      stopTimeout = 20
    },
  ])

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_ecs_service" "web" {
  name            = "${local.name}-web"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_desired_count
  launch_type     = "FARGATE"

  health_check_grace_period_seconds = 60

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  depends_on = [aws_lb_listener.https]
}

# ── migrations ────────────────────────────────────────────────────────────
#
# A family with no service. `_deploy.yml` registers a revision pinned to the
# migrator image for the commit being deployed, runs ONE task, waits for it to
# stop, and reads the exit code. It is not a server and must never be one:
# a migration that runs on every task start is N replicas racing to alter the
# same tables.
resource "aws_ecs_task_definition" "migrate" {
  family                   = "${local.name}-migrate"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.migrate_task.arn

  runtime_platform {
    cpu_architecture        = "X86_64"
    operating_system_family = "LINUX"
  }

  container_definitions = jsonencode([
    {
      name      = "migrate"
      image     = local.placeholder_image.migrator
      essential = true

      # NODE_ENV=development is correct and deliberate: the migrator keeps its
      # dev dependencies because `prisma` (the CLI) and `tsx` (the seed runs
      # TypeScript directly) are both devDependencies. It touches nothing but
      # the database.
      environment = [
        { name = "NODE_ENV", value = "development" },
        { name = "APP_ENV", value = var.environment },
      ]

      secrets = local.migrate_secrets

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.migrate.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "migrate"
        }
      }
    },
  ])

  lifecycle {
    create_before_destroy = true
  }
}
