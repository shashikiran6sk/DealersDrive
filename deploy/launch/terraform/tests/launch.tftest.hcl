mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = { account_id = "123456789012" }
  }
  mock_data "aws_iam_policy_document" {
    defaults = { json = "{}" }
  }
  mock_data "aws_partition" {
    defaults = { partition = "aws" }
  }
  mock_data "aws_availability_zones" {
    defaults = { names = ["ap-south-1a", "ap-south-1b"] }
  }
  mock_data "aws_ssm_parameter" {
    defaults = { value = "ami-0123456789abcdef0" }
  }
}
mock_provider "aws" { alias = "edge" }
variables {
  zone_id                  = "Z123456789"
  alarm_email              = "operator@example.com"
  github_oidc_provider_arn = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
  config_kms_key_arn       = "arn:aws:kms:ap-south-1:123456789012:key/11111111-1111-4111-8111-111111111111"
}
run "launch_boundaries" {
  command = plan
  assert {
    condition     = !aws_db_instance.this.publicly_accessible && aws_db_instance.this.storage_encrypted && aws_db_instance.this.backup_retention_period == 7 && aws_db_instance.this.deletion_protection
    error_message = "Launch must preserve private, encrypted, backed-up PostgreSQL."
  }
  assert {
    condition     = length(aws_subnet.public) == 2 && length(aws_subnet.database) == 2 && length(aws_route_table.database.route) == 0
    error_message = "Use two replacement AZs and isolated DB route tables without NAT."
  }
  assert {
    condition     = aws_autoscaling_group.this.min_size == 1 && aws_autoscaling_group.this.max_size == 1 && aws_autoscaling_group.this.desired_capacity == 1
    error_message = "Launch is one supervised host, not unused HA capacity."
  }
  assert {
    condition     = aws_cloudfront_cache_policy.media.max_ttl == 60 && aws_s3_bucket_public_access_block.media.block_public_policy
    error_message = "Media visibility must expire quickly and S3 must remain private."
  }
  assert {
    condition     = aws_cloudwatch_log_group.application.retention_in_days == 14 && aws_budgets_budget.monthly.limit_amount == "50"
    error_message = "Logs must be bounded and monthly billing protection enabled."
  }
}
