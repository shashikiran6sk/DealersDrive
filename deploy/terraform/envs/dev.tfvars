# ---------------------------------------------------------------------------
# Development.
#
# Sized to be cheap and to prove the shape, not to carry load. Two tasks rather
# than one for a reason that is not about traffic: two is the smallest number
# that exercises the things that break at N>1 — the shared rate-limit counter,
# cross-instance config invalidation, and a rolling deploy that has to drain one
# task while another serves. A one-task dev environment would let all three
# regress silently and only fail in production.
# ---------------------------------------------------------------------------
environment       = "dev"
region            = "ap-south-1"
github_repository = "shashikiran6sk/dealers-drive"

domain_name     = "dev.dealers-drive.com"
certificate_arn = "arn:aws:acm:ap-south-1:<account>:certificate/<id>"

vpc_id             = "vpc-<id>"
private_subnet_ids = ["subnet-<private-a>", "subnet-<private-b>"]
public_subnet_ids  = ["subnet-<public-a>", "subnet-<public-b>"]

api_cpu           = "512"
api_memory        = "1024"
api_node_heap_mb  = 768
api_desired_count = 2
api_min_capacity  = 2
api_max_capacity  = 4

web_cpu           = "512"
web_memory        = "1024"
web_node_heap_mb  = 768
web_desired_count = 2
web_min_capacity  = 2
web_max_capacity  = 4

log_retention_days         = 14
enable_deletion_protection = false

# Dev pages nobody. The alarms still exist so their state is visible in the
# console, and so production is not the first place they are ever exercised.
alarm_email = ""

# Higher than production: dev is where a broken build is *supposed* to be found,
# and a handful of 5xx during a bad deploy is the system working.
api_5xx_alarm_threshold = 50
