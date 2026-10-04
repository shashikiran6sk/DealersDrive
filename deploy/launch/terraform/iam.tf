data "aws_iam_policy_document" "host_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}
resource "aws_iam_role" "host" {
  name               = "${local.name}-host"
  assume_role_policy = data.aws_iam_policy_document.host_trust.json
}
resource "aws_iam_instance_profile" "host" {
  name = local.name
  role = aws_iam_role.host.name
}
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.host.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/AmazonSSMManagedInstanceCore"
}
resource "aws_iam_role_policy" "host" {
  role = aws_iam_role.host.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["ssm:GetParameter"], Resource = [for name in ["runtime", "migration", "release"] : "arn:aws:ssm:${var.region}:${local.account}:parameter${local.prefix}/${name}"] },
    { Effect = "Allow", Action = ["ssm:PutParameter"], Resource = "arn:aws:ssm:${var.region}:${local.account}:parameter${local.prefix}/release" },
    { Effect = "Allow", Action = ["kms:Decrypt"], Resource = var.config_kms_key_arn, Condition = { StringEquals = { "kms:ViaService" = "ssm.${var.region}.amazonaws.com" } } },
    { Effect = "Allow", Action = ["sts:AssumeRole"], Resource = aws_iam_role.runtime.arn },
    { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
    { Effect = "Allow", Action = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"], Resource = [for r in aws_ecr_repository.image : r.arn] },
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.application.arn}:*" },
    { Effect = "Allow", Action = ["cloudwatch:PutMetricData"], Resource = "*", Condition = { StringEquals = { "cloudwatch:namespace" = "DealersDrive/Production" } } },
    { Effect = "Allow", Action = ["ec2:AssociateAddress"], Resource = [aws_eip.api.arn, "arn:aws:ec2:${var.region}:${local.account}:instance/*"] },
  ] })
}
locals {
  oidc_host = replace(var.github_oidc_provider_arn, "/^.*oidc-provider\\//", "")
}
resource "aws_iam_role" "deploy" {
  name = "${local.name}-github-deploy"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = "sts:AssumeRoleWithWebIdentity", Principal = { Federated = var.github_oidc_provider_arn }, Condition = { StringEquals = {
    "${local.oidc_host}:aud" = "sts.amazonaws.com",
    "${local.oidc_host}:sub" = "repo:${var.github_repository}:environment:${var.github_environment}"
  } } }] })
}
resource "aws_iam_role_policy" "deploy" {
  role = aws_iam_role.deploy.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
    { Effect = "Allow", Action = ["ecr:BatchCheckLayerAvailability", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload", "ecr:PutImage", "ecr:BatchGetImage"], Resource = [for r in aws_ecr_repository.image : r.arn] },
    { Effect = "Allow", Action = ["ssm:GetParameter", "ssm:PutParameter"], Resource = "arn:aws:ssm:${var.region}:${local.account}:parameter${local.prefix}/release" },
    { Effect = "Allow", Action = ["ec2:DescribeInstances", "ssm:GetCommandInvocation"], Resource = "*" },
    { Effect = "Allow", Action = ["ssm:SendCommand"], Resource = "arn:aws:ssm:${var.region}::document/AWS-RunShellScript" },
    { Effect = "Allow", Action = ["ssm:SendCommand"], Resource = "arn:aws:ec2:${var.region}:${local.account}:instance/*", Condition = { StringEquals = { "ssm:resourceTag/Application" = "dealers-drive", "ssm:resourceTag/Environment" = "production" } } },
  ] })
}
resource "aws_iam_role" "runtime" {
  name               = "${local.name}-runtime"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Action = "sts:AssumeRole", Principal = { AWS = aws_iam_role.host.arn } }] })
}
resource "aws_iam_role_policy" "runtime" {
  role = aws_iam_role.runtime.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["s3:ListBucket"], Resource = aws_s3_bucket.media.arn },
    { Effect = "Allow", Action = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource = ["${aws_s3_bucket.media.arn}/vehicles/*", "${aws_s3_bucket.media.arn}/dealers/*", "${aws_s3_bucket.media.arn}/derivatives/*"] }
  ] })
}
