# ---------------------------------------------------------------------------
# Alarms.
#
# "Keep this list short" is the design rule (ARCHITECTURE §22.2). Every alarm
# below is one a person can act on when woken by it; an alarm nobody acts on
# trains everybody to ignore the ones that matter.
#
# Deliberately NOT alarmed:
#   · CPU or memory crossing a threshold — that is autoscaling's job, and an
#     alarm on it fires every time the system works correctly.
#   · 4xx rates — those are clients being clients.
#   · Individual task restarts — ECS replaces a task and the service is fine.
# ---------------------------------------------------------------------------
resource "aws_sns_topic" "alarms" {
  name = "${local.name}-alarms"
}

resource "aws_sns_topic_subscription" "email" {
  count = var.alarm_email == "" ? 0 : 1

  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

locals {
  alarm_actions = [aws_sns_topic.alarms.arn]

  # The dimension pair the ALB metrics need. Both are suffixes of the ARN,
  # which is why they look like this rather than like a name.
  lb_dimension = {
    LoadBalancer = aws_lb.this.arn_suffix
  }
}

# ── the site is down ──────────────────────────────────────────────────────
#
# The one alarm that is unambiguous. No healthy targets means every request is
# failing, regardless of what any other metric says.
resource "aws_cloudwatch_metric_alarm" "api_no_healthy_targets" {
  alarm_name          = "${local.name}-api-no-healthy-targets"
  alarm_description   = "No healthy API tasks. Every /v1 request is failing."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HealthyHostCount"
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "LessThanThreshold"

  dimensions = merge(local.lb_dimension, {
    TargetGroup = aws_lb_target_group.api.arn_suffix
  })

  # A deploy briefly has zero *reporting* targets; treating missing as breaching
  # would page on every rollout.
  treat_missing_data = "notBreaching"
  alarm_actions      = local.alarm_actions
  ok_actions         = local.alarm_actions
}

resource "aws_cloudwatch_metric_alarm" "web_no_healthy_targets" {
  alarm_name          = "${local.name}-web-no-healthy-targets"
  alarm_description   = "No healthy web tasks. The marketplace is not rendering."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HealthyHostCount"
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "LessThanThreshold"

  dimensions = merge(local.lb_dimension, {
    TargetGroup = aws_lb_target_group.web.arn_suffix
  })

  treat_missing_data = "notBreaching"
  alarm_actions      = local.alarm_actions
  ok_actions         = local.alarm_actions
}

# ── the application is erroring ───────────────────────────────────────────
#
# Target 5xx, not ELB 5xx: this counts responses the application actually
# produced, so it does not fire for a load balancer that briefly had nowhere to
# send a request during a deploy.
resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "${local.name}-api-5xx"
  alarm_description   = "The API is returning server errors. Check the traceId in the newest log lines."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = var.api_5xx_alarm_threshold
  comparison_operator = "GreaterThanThreshold"

  dimensions = merge(local.lb_dimension, {
    TargetGroup = aws_lb_target_group.api.arn_suffix
  })

  treat_missing_data = "notBreaching"
  alarm_actions      = local.alarm_actions
  ok_actions         = local.alarm_actions
}

# ── the service cannot hold its capacity ──────────────────────────────────
#
# Running fewer tasks than desired for ten minutes is not a blip. It usually
# means tasks are failing their health check and being replaced in a loop,
# which the circuit breaker will already have tried and failed to fix.
resource "aws_cloudwatch_metric_alarm" "api_running_below_desired" {
  alarm_name          = "${local.name}-api-running-below-desired"
  alarm_description   = "API tasks are not staying up. Likely a crash loop or a failing readiness check."
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  threshold           = var.api_min_capacity
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions

  metric_query {
    id          = "running"
    return_data = true

    metric {
      namespace   = "ECS/ContainerInsights"
      metric_name = "RunningTaskCount"
      stat        = "Minimum"
      period      = 300

      dimensions = {
        ClusterName = aws_ecs_cluster.this.name
        ServiceName = aws_ecs_service.api.name
      }
    }
  }
}

# ── the site got slow ─────────────────────────────────────────────────────
#
# p95 rather than average, because an average hides the tail that users
# actually feel. Two consecutive five-minute periods, so one slow report does
# not page anyone.
resource "aws_cloudwatch_metric_alarm" "api_latency" {
  alarm_name          = "${local.name}-api-latency-p95"
  alarm_description   = "API p95 latency above two seconds. Usually the database, occasionally a missing index."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  extended_statistic  = "p95"
  period              = 300
  evaluation_periods  = 2
  threshold           = 2
  comparison_operator = "GreaterThanThreshold"

  dimensions = merge(local.lb_dimension, {
    TargetGroup = aws_lb_target_group.api.arn_suffix
  })

  treat_missing_data = "notBreaching"
  alarm_actions      = local.alarm_actions
  ok_actions         = local.alarm_actions
}
