# ---------------------------------------------------------------------------
# Autoscaling.
#
# This file is the direct answer to the review finding that Dealers-Drive had
# no versioned scaling policy at all: capacity existed only as console state,
# so a change was invisible to review and a rebuild from scratch was
# archaeology.
#
# Target tracking rather than step scaling, on two metrics. Target tracking is
# the right default because it needs one number a person can reason about
# ("keep average CPU near 60%") instead of a ladder of thresholds that has to be
# re-tuned whenever the workload shifts.
#
# Both metrics matter for a Node service and for different reasons: CPU catches
# request volume, memory catches the slow leak and the large-response path.
# Whichever policy asks for MORE tasks wins — Application Auto Scaling takes the
# maximum, never the average — so adding the memory policy can only ever make
# the service scale out sooner.
# ---------------------------------------------------------------------------

# ── the API ───────────────────────────────────────────────────────────────
resource "aws_appautoscaling_target" "api" {
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.api_min_capacity
  max_capacity       = var.api_max_capacity
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${local.name}-api-cpu"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.api.service_namespace
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }

    target_value = var.cpu_target_percent

    # Scale out promptly, scale in slowly. The asymmetry is deliberate: adding
    # a task costs a little money, removing one too eagerly costs latency for
    # every request that arrives during the next cold start. Five minutes is
    # long enough that a lull between two bursts does not cause a flap.
    scale_out_cooldown = 60
    scale_in_cooldown  = 300
  }
}

resource "aws_appautoscaling_policy" "api_memory" {
  name               = "${local.name}-api-memory"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.api.service_namespace
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }

    target_value       = var.memory_target_percent
    scale_out_cooldown = 60
    scale_in_cooldown  = 300
  }
}

# ── the web app ───────────────────────────────────────────────────────────
resource "aws_appautoscaling_target" "web" {
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.web.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = var.web_min_capacity
  max_capacity       = var.web_max_capacity
}

resource "aws_appautoscaling_policy" "web_cpu" {
  name               = "${local.name}-web-cpu"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.web.service_namespace
  resource_id        = aws_appautoscaling_target.web.resource_id
  scalable_dimension = aws_appautoscaling_target.web.scalable_dimension

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }

    target_value       = var.cpu_target_percent
    scale_out_cooldown = 60
    scale_in_cooldown  = 300
  }
}

resource "aws_appautoscaling_policy" "web_memory" {
  name               = "${local.name}-web-memory"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = aws_appautoscaling_target.web.service_namespace
  resource_id        = aws_appautoscaling_target.web.resource_id
  scalable_dimension = aws_appautoscaling_target.web.scalable_dimension

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }

    target_value       = var.memory_target_percent
    scale_out_cooldown = 60
    scale_in_cooldown  = 300
  }
}
