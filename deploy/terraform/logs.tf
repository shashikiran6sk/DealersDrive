# ---------------------------------------------------------------------------
# Log groups.
#
# Created here rather than left to ECS's auto-create, for one reason: a group
# ECS creates has no retention, which means logs accumulate forever and the bill
# grows without anyone choosing it.
#
# The migration group is separate and matters more than it looks: when a
# migration fails, _deploy.yml stops the deployment and tells the operator to
# read this exact group. A missing group turns a clear failure into a hunt.
# ---------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "api" {
  name              = "/dealers-drive/${var.environment}/api"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/dealers-drive/${var.environment}/web"
  retention_in_days = var.log_retention_days
}

# R40. The worker's own group, not a stream inside the API's.
#
# The two processes fail in different ways and are read for different reasons —
# "is the API up" versus "why has that dealer not had their approval email" —
# and a single group makes the second question a grep through the first.
resource "aws_cloudwatch_log_group" "worker" {
  name              = "/dealers-drive/${var.environment}/worker"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "migrate" {
  name              = "/dealers-drive/${var.environment}/migrate"
  retention_in_days = var.log_retention_days
}
