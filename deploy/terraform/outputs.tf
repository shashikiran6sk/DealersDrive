# ---------------------------------------------------------------------------
# Outputs.
#
# These are not decoration: every value below is a GitHub Actions variable or
# secret that the deploy workflows read. After `terraform apply`, this is the
# list to copy into Settings → Environments → <env>.
#
# `terraform output -json github_environment` prints them in one go.
# ---------------------------------------------------------------------------
output "github_environment" {
  description = "Everything .github/workflows needs for this environment."
  value = {
    AWS_REGION              = var.region
    ECS_CLUSTER             = aws_ecs_cluster.this.name
    ECS_SERVICE_API         = aws_ecs_service.api.name
    ECS_SERVICE_WEB         = aws_ecs_service.web.name
    ECS_TASK_FAMILY_API     = aws_ecs_task_definition.api.family
    ECS_TASK_FAMILY_WEB     = aws_ecs_task_definition.web.family
    ECS_TASK_FAMILY_MIGRATE = aws_ecs_task_definition.migrate.family
    ECS_SUBNETS             = join(",", var.private_subnet_ids)
    ECS_SECURITY_GROUP      = aws_security_group.tasks.id
    ECS_ASSIGN_PUBLIC_IP    = "DISABLED"
    MIGRATE_LOG_GROUP       = aws_cloudwatch_log_group.migrate.name
    ECR_REPO_API            = aws_ecr_repository.this["api"].name
    ECR_REPO_WEB            = aws_ecr_repository.this["web"].name
    ECR_REPO_MIGRATOR       = aws_ecr_repository.this["migrator"].name
    WEB_BASE_URL            = "https://${var.domain_name}"
    API_BASE_URL            = "https://${var.domain_name}"
    DEV_API_BASE_URL        = "https://${var.domain_name}"
  }
}

output "github_secrets" {
  description = "Role ARNs. AWS_CI_ROLE_ARN is a repository secret; AWS_DEPLOY_ROLE_ARN is per-environment."
  value = {
    AWS_CI_ROLE_ARN     = aws_iam_role.github_ci.arn
    AWS_DEPLOY_ROLE_ARN = aws_iam_role.github_deploy.arn
  }
}

output "alb_dns_name" {
  description = "Point the domain's ALIAS record here."
  value       = aws_lb.this.dns_name
}

output "alb_zone_id" {
  description = "Hosted zone for the ALIAS record."
  value       = aws_lb.this.zone_id
}

output "ssm_parameters_to_populate" {
  description = "Created empty. Set each one with `aws ssm put-parameter --overwrite` before the first deploy."
  value       = [for name in local.api_secret_names : "${local.ssm_prefix}/${name}"]
}
