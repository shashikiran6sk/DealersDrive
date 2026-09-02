# ---------------------------------------------------------------------------
# Inputs.
#
# The split that matters here is between *shape* and *value*. Everything below
# describes shape — how many tasks, how much memory, when to alarm — and is
# reviewed in a pull request like any other code. No secret is an input: those
# are SSM parameters written out of band (ssm.tf).
# ---------------------------------------------------------------------------

variable "environment" {
  description = "dev or production. Names every resource and scopes the SSM prefix."
  type        = string

  validation {
    condition     = contains(["dev", "production"], var.environment)
    error_message = "environment must be dev or production."
  }
}

variable "region" {
  description = "AWS region. Mumbai, because the dealers are in Tamil Nadu."
  type        = string
  default     = "ap-south-1"
}

variable "github_repository" {
  description = <<-EOT
    owner/repo, e.g. shashikiran6sk/dealers-drive.

    This is what narrows the OIDC trust policy. Without it, the role trusts the
    GitHub OIDC provider — which every GitHub Actions workflow in the world can
    obtain a token from.
  EOT
  type        = string
}

variable "vpc_id" {
  description = "The VPC the tasks run in."
  type        = string
}

variable "private_subnet_ids" {
  description = "Subnets for the tasks. Private: nothing reaches a task except through the load balancer."
  type        = list(string)
}

variable "public_subnet_ids" {
  description = "Subnets for the load balancer."
  type        = list(string)
}

variable "domain_name" {
  description = "The hostname this environment serves, e.g. dev.dealers-drive.com."
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate for domain_name."
  type        = string
}

# ── capacity ──────────────────────────────────────────────────────────────
#
# Sized per environment in envs/*.tfvars. These used to exist only as console
# state, which meant a capacity change was invisible to review and a rebuild
# from scratch was archaeology.

variable "api_cpu" {
  description = "Fargate CPU units for one API task."
  type        = string
  default     = "512"
}

variable "api_memory" {
  description = <<-EOT
    Memory (MiB) for one API task.

    `api_node_heap_mb` must stay meaningfully below this — see its own comment.
  EOT
  type        = string
  default     = "1024"
}

variable "api_node_heap_mb" {
  description = <<-EOT
    V8 old-space limit for the API, as --max-old-space-size.

    Set BELOW the task memory so the garbage collector applies back-pressure
    before the kernel OOM-killer does. A Node process whose heap ceiling equals
    its container limit does not get a slow GC — it gets killed mid-request,
    with no error and no stack, and the symptom is "tasks restart under load
    and nobody knows why". ~75% of the task memory is the usual headroom, the
    rest being the runtime itself, native buffers (sharp) and the stack.
  EOT
  type        = number
  default     = 768
}

variable "api_desired_count" {
  description = <<-EOT
    Baseline API tasks.

    Two is the floor for anything that must survive a deployment or a single
    task dying, and it is only safe because the rate limiter now counts in
    shared state rather than in process memory (CACHE_DRIVER=postgres). With
    the old in-process counter, N tasks meant N times every limit.
  EOT
  type        = number
  default     = 2
}

variable "api_min_capacity" {
  description = "Autoscaling floor for the API."
  type        = number
  default     = 2
}

variable "api_max_capacity" {
  description = "Autoscaling ceiling for the API. A ceiling is also a spend control."
  type        = number
  default     = 6
}

variable "web_cpu" {
  description = "Fargate CPU units for one web task."
  type        = string
  default     = "512"
}

variable "web_memory" {
  description = "Memory (MiB) for one web task."
  type        = string
  default     = "1024"
}

variable "web_node_heap_mb" {
  description = "V8 old-space limit for the web task. Same reasoning as api_node_heap_mb."
  type        = number
  default     = 768
}

variable "web_desired_count" {
  description = "Baseline web tasks."
  type        = number
  default     = 2
}

variable "web_min_capacity" {
  description = "Autoscaling floor for the web app."
  type        = number
  default     = 2
}

variable "web_max_capacity" {
  description = "Autoscaling ceiling for the web app."
  type        = number
  default     = 6
}

variable "cpu_target_percent" {
  description = <<-EOT
    Target average CPU for the scaling policy.

    60 rather than 80: scaling out takes a Fargate cold start plus the health
    check's start period, and a target set close to the ceiling means the
    decision to add a task is made after the tasks that must serve during the
    wait are already saturated.
  EOT
  type        = number
  default     = 60
}

variable "memory_target_percent" {
  description = "Target average memory for the scaling policy."
  type        = number
  default     = 70
}

# ── observability ─────────────────────────────────────────────────────────

variable "log_retention_days" {
  description = "CloudWatch log retention. Long enough to investigate last week's incident."
  type        = number
  default     = 30
}

variable "alarm_email" {
  description = <<-EOT
    Where an alarm goes. Empty disables the SNS subscription but still creates
    the alarms, so the console shows the state even before anyone is on call.

    Keep the list of things that page a human short (ARCHITECTURE §22.2). Every
    alarm here is one a person can act on at 3am.
  EOT
  type        = string
  default     = ""
}

variable "api_5xx_alarm_threshold" {
  description = "5xx responses in five minutes before the API alarm fires."
  type        = number
  default     = 10
}

variable "enable_deletion_protection" {
  description = "Load balancer deletion protection. On in production, always."
  type        = bool
  default     = false
}
