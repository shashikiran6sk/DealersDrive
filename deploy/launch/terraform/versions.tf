terraform {
  required_version = ">= 1.9.0"
  required_providers {
    aws = {
      source = "hashicorp/aws", version = "~> 5.70"
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
      Application = "dealers-drive", Environment = "production", ManagedBy = "terraform"
    }
  }
}
provider "aws" {
  alias  = "edge"
  region = "us-east-1"
  default_tags {
    tags = {
      Application = "dealers-drive", Environment = "production", ManagedBy = "terraform"
    }
  }
}
data "aws_caller_identity" "current" {
}
data "aws_availability_zones" "available" {
  state = "available"
}
data "aws_partition" "current" {
}
locals {
  name    = "dd-launch-production"
  prefix  = "/dealers-drive/production"
  account = data.aws_caller_identity.current.account_id
}
