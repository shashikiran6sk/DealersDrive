# ---------------------------------------------------------------------------
# Production.
#
# The numbers here are a starting point sized for launch, not a measurement.
# Revisit them after the first month of real traffic — and when you do, change
# them here, in a pull request, rather than in the console. That is the whole
# reason this file exists.
# ---------------------------------------------------------------------------
environment       = "production"
region            = "ap-south-1"
github_repository = "shashikiran6sk/dealers-drive"

domain_name     = "www.dealers-drive.com"
certificate_arn = "arn:aws:acm:ap-south-1:<account>:certificate/<id>"

vpc_id             = "vpc-<id>"
private_subnet_ids = ["subnet-<private-a>", "subnet-<private-b>"]
public_subnet_ids  = ["subnet-<public-a>", "subnet-<public-b>"]

# 1 vCPU / 2 GiB. `sharp` is the reason for the memory: image processing runs in
# the API task (WORKER_INLINE=true), and a 12-megapixel photo is not small.
api_cpu    = "1024"
api_memory = "2048"
# 75% of the task memory. The remainder is the Node runtime, the native heap
# sharp allocates outside V8, and enough slack that GC pressure shows up as
# latency rather than as a task that vanishes.
api_node_heap_mb  = 1536
api_desired_count = 2
api_min_capacity  = 2
api_max_capacity  = 8

web_cpu           = "512"
web_memory        = "1024"
web_node_heap_mb  = 768
web_desired_count = 2
web_min_capacity  = 2
web_max_capacity  = 8

log_retention_days = 90

# On, always. The load balancer is the DNS target; deleting it by accident is
# an outage that a `terraform destroy` in the wrong directory can cause.
enable_deletion_protection = true

alarm_email = "ops@dealers-drive.in"

# Ten server errors in five minutes is not noise in production.
api_5xx_alarm_threshold = 10
