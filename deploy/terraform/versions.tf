# ---------------------------------------------------------------------------
# Provider and state.
#
# State lives in S3 with DynamoDB locking, in the same account as the thing it
# describes. Two people running `terraform apply` at once against an ECS service
# is exactly the case the lock exists for.
#
# The backend is deliberately partial: `bucket` and `dynamodb_table` are passed
# at init time, because dev and production are separate accounts and hard-coding
# either one here would make it possible to point production Terraform at the
# dev state file by forgetting a flag.
#
#   terraform init \
#     -backend-config=bucket=dd-tfstate-<env> \
#     -backend-config=key=dealers-drive/<env>.tfstate \
#     -backend-config=region=ap-south-1 \
#     -backend-config=dynamodb_table=dd-tflock-<env>
# ---------------------------------------------------------------------------
terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }

  backend "s3" {
    encrypt = true
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Application = "dealers-drive"
      Environment = var.environment
      ManagedBy   = "terraform"
      Repository  = "dealers-drive"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  name       = "dd-${var.environment}"

  # Every secret the API reads is an SSM parameter under this prefix. The
  # values are never in Terraform — see ssm.tf.
  ssm_prefix = "/dealers-drive/${var.environment}"
}
