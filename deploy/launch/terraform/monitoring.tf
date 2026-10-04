resource "aws_sns_topic" "alerts" { name = "${local.name}-alerts" }
resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}
locals {
  custom_alarms = {
    CPUPercent       = { comparison = "GreaterThanThreshold", threshold = 60, periods = 15 }
    Availability     = { comparison = "LessThanThreshold", threshold = 1, periods = 3 }
    WorkerAlive      = { comparison = "LessThanThreshold", threshold = 1, periods = 3 }
    MemoryPercent    = { comparison = "GreaterThanThreshold", threshold = 75, periods = 3 }
    QueueAgeSeconds  = { comparison = "GreaterThanThreshold", threshold = 30, periods = 3 }
    FailedJobs       = { comparison = "GreaterThanThreshold", threshold = 0, periods = 1 }
    OutboxAgeSeconds = { comparison = "GreaterThanThreshold", threshold = 60, periods = 3 }
  }
}
resource "aws_cloudwatch_metric_alarm" "custom" {
  for_each            = local.custom_alarms
  alarm_name          = "${local.name}-${each.key}"
  namespace           = "DealersDrive/Production"
  metric_name         = each.key
  dimensions          = { Application = "dealers-drive" }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = each.value.periods
  comparison_operator = each.value.comparison
  threshold           = each.value.threshold
  treat_missing_data  = contains(["Availability", "WorkerAlive"], each.key) ? "breaching" : "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
}
resource "aws_cloudwatch_metric_alarm" "database" {
  for_each            = { CPUUtilization = 70, DatabaseConnections = 70, FreeableMemory = 100000000 }
  alarm_name          = "${local.name}-db-${each.key}"
  namespace           = "AWS/RDS"
  metric_name         = each.key
  dimensions          = { DBInstanceIdentifier = aws_db_instance.this.id }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  comparison_operator = each.key == "FreeableMemory" ? "LessThanThreshold" : "GreaterThanThreshold"
  threshold           = each.value
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
resource "aws_cloudwatch_log_metric_filter" "latency" {
  name           = "api-latency"
  log_group_name = aws_cloudwatch_log_group.application.name
  pattern        = "{ $.durationMs = * && $.status_code = * }"
  metric_transformation {
    name      = "ApiLatencyMs"
    namespace = "DealersDrive/Production"
    value     = "$.durationMs"
    unit      = "Milliseconds"
  }
}
resource "aws_cloudwatch_log_metric_filter" "errors" {
  name           = "api-errors"
  log_group_name = aws_cloudwatch_log_group.application.name
  pattern        = "{ $.status_code >= 500 }"
  metric_transformation {
    name          = "ApiErrors"
    namespace     = "DealersDrive/Production"
    value         = "1"
    default_value = 0
  }
}
resource "aws_cloudwatch_metric_alarm" "latency" {
  alarm_name          = "${local.name}-api-latency"
  namespace           = "DealersDrive/Production"
  metric_name         = "ApiLatencyMs"
  extended_statistic  = "p95"
  period              = 300
  evaluation_periods  = 3
  comparison_operator = "GreaterThanThreshold"
  threshold           = 500
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
resource "aws_cloudwatch_metric_alarm" "errors" {
  alarm_name          = "${local.name}-api-errors"
  namespace           = "DealersDrive/Production"
  metric_name         = "ApiErrors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 5
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
resource "aws_budgets_budget" "monthly" {
  name         = "dealers-drive-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  # Whole-account protection includes legacy/untagged resources; workload tags
  # allow separate Cost Explorer attribution without hiding surprise spend.
  dynamic "notification" {
    for_each = [50, 80, 100]
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.alarm_email]
    }
  }
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alarm_email]
  }
}
resource "aws_cloudwatch_dashboard" "health" {
  dashboard_name = "DealersDrive-production"
  dashboard_body = jsonencode({ widgets = [
    { type = "metric", x = 0, y = 0, width = 12, height = 6, properties = { region = var.region, title = "Availability / worker", metrics = [["DealersDrive/Production", "Availability", "Application", "dealers-drive"], [".", "WorkerAlive", ".", "."]], period = 60 } },
    { type = "metric", x = 12, y = 0, width = 12, height = 6, properties = { region = var.region, title = "API latency p95", metrics = [["DealersDrive/Production", "ApiLatencyMs"]], stat = "p95", period = 300 } },
    { type = "metric", x = 0, y = 6, width = 12, height = 6, properties = { region = var.region, title = "DB CPU / connections", metrics = [["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.this.id], [".", "DatabaseConnections", ".", "."]], period = 300 } },
    { type = "metric", x = 12, y = 6, width = 12, height = 6, properties = { region = var.region, title = "Queue / outbox age", metrics = [["DealersDrive/Production", "QueueAgeSeconds", "Application", "dealers-drive"], [".", "OutboxAgeSeconds", ".", "."], [".", "FailedJobs", ".", "."]], period = 60 } }
  ] })
}
