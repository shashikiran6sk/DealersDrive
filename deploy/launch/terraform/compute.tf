data "aws_ssm_parameter" "ami" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}
resource "aws_cloudwatch_log_group" "application" {
  name              = "/dealers-drive/production/application"
  retention_in_days = 14
}
resource "aws_ecr_repository" "image" {
  for_each             = toset(["api", "migrator"])
  name                 = "dealers-drive-launch-${each.key}"
  image_tag_mutability = "IMMUTABLE"
  encryption_configuration {
    encryption_type = "AES256"
  }
  image_scanning_configuration {
    scan_on_push = true
  }
}
resource "aws_ecr_lifecycle_policy" "image" {
  for_each   = aws_ecr_repository.image
  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1, description = "Keep 30 release images", selection = {
        tagStatus = "any", countType = "imageCountMoreThan", countNumber = 30
        }, action = {
        type = "expire"
      }

      }
    ]
    }
  )
}
locals {
  host_config = {
    runtime_role      = aws_iam_role.runtime.arn
    region            = var.region, api_domain = var.api_domain, media_domain = var.media_domain,
    web_origin        = var.web_origin, email = var.alarm_email, bucket = aws_s3_bucket.media.id,
    registry          = "${local.account}.dkr.ecr.${var.region}.amazonaws.com",
    eip_allocation    = aws_eip.api.id,
    runtime_parameter = "${local.prefix}/runtime", migration_parameter = "${local.prefix}/migration",
    release_parameter = "${local.prefix}/release"
  }
}
resource "aws_launch_template" "this" {
  name_prefix   = "${local.name}-"
  image_id      = data.aws_ssm_parameter.ami.value
  instance_type = var.instance_type
  iam_instance_profile {
    arn = aws_iam_instance_profile.host.arn
  }
  vpc_security_group_ids = [aws_security_group.host.id]
  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }
  credit_specification {
    cpu_credits = "standard"
  }
  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size           = 20
      volume_type           = "gp3"
      encrypted             = true
      delete_on_termination = true
    }

  }
  user_data = base64encode(templatefile("${path.module}/../user-data.sh.tftpl", {
    credential_process = filebase64("${path.module}/../credentials.cjs"),
    host_py            = filebase64("${path.module}/../host.py"),
    compose            = filebase64("${path.module}/../compose.yml"),
    caddy              = filebase64("${path.module}/../Caddyfile"),
    config             = base64encode(jsonencode(local.host_config))
    }
  ))
  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = local.name, Application = "dealers-drive", Environment = "production", ManagedBy = "terraform"
    }

  }
}
resource "aws_autoscaling_group" "this" {
  name                      = local.name
  min_size                  = 1
  desired_capacity          = 1
  max_size                  = 1
  vpc_zone_identifier       = aws_subnet.public[*].id
  health_check_type         = "EC2"
  health_check_grace_period = 600
  launch_template {
    id      = aws_launch_template.this.id
    version = aws_launch_template.this.latest_version
  }
  tag {
    key                 = "Application"
    value               = "dealers-drive"
    propagate_at_launch = true
  }
  tag {
    key                 = "Environment"
    value               = "production"
    propagate_at_launch = true
  }
  tag {
    key                 = "ManagedBy"
    value               = "terraform"
    propagate_at_launch = true
  }
  lifecycle {
    ignore_changes = [desired_capacity]
  }
  depends_on = [aws_route_table_association.public, aws_iam_role_policy.host, aws_iam_role_policy.runtime, aws_iam_role_policy_attachment.ssm, aws_route53_record.api]
}
