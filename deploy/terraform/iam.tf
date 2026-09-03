# ---------------------------------------------------------------------------
# Identities.
#
# Four of them, and the split is the point:
#
#   execution role  — what ECS itself uses to pull the image and read the SSM
#                     parameters *before* the container starts. The container
#                     never holds these permissions.
#   api task role   — what the running API can do. Today: almost nothing. It
#                     talks to Postgres and to Cloudflare R2, neither of which
#                     is AWS IAM, so an empty role is the honest answer and a
#                     wide one would be a lie waiting to be exploited.
#   migrate task role — the same, for the one-off migration task.
#   GitHub roles    — assumed from CI over OIDC. No long-lived AWS key exists
#                     anywhere in the repository (§20.7).
#
# The two GitHub roles are separate on purpose. The CI role can push images and
# nothing else; the deploy role can roll out and nothing else. A compromised
# build cannot deploy, and a compromised deploy cannot publish new bytes.
# ---------------------------------------------------------------------------

# ── what ECS uses to start a task ─────────────────────────────────────────
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${local.name}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# The managed policy above covers ECR and CloudWatch Logs but NOT SSM, so the
# parameter reads are granted explicitly — and scoped to this environment's
# prefix, so a dev task definition cannot resolve a production secret even if
# someone pastes the wrong ARN into it.
data "aws_iam_policy_document" "execution_secrets" {
  statement {
    sid     = "ReadThisEnvironmentsParameters"
    actions = ["ssm:GetParameters"]
    resources = [
      "arn:aws:ssm:${var.region}:${local.account_id}:parameter${local.ssm_prefix}/*",
    ]
  }

  statement {
    sid       = "DecryptThoseParameters"
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "${local.name}-execution-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

# ── what the running containers can do ────────────────────────────────────
#
# Deliberately empty. The API's dependencies are Postgres (a connection string)
# and R2 (an access key), neither of which is AWS IAM. The roles exist so that
# adding a permission later is a diff rather than a new resource, and so that
# every task has an identity CloudTrail can name.
resource "aws_iam_role" "api_task" {
  name               = "${local.name}-api-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role" "migrate_task" {
  name               = "${local.name}-migrate-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role" "web_task" {
  name               = "${local.name}-web-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

# ── what GitHub Actions can do ────────────────────────────────────────────
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Scoped to this repository. Without this condition ANY GitHub Actions
    # workflow in the world could assume the role — the trust is in the OIDC
    # provider, and the subject is the only thing that narrows it.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:*"]
    }
  }
}

resource "aws_iam_role" "github_ci" {
  name               = "${local.name}-github-ci"
  description        = "release.yml. Pushes images. Cannot deploy."
  assume_role_policy = data.aws_iam_policy_document.github_assume.json
}

data "aws_iam_policy_document" "github_ci" {
  statement {
    sid       = "GetAnEcrToken"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "PushToTheThreeRepositories"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
      "ecr:BatchGetImage",
      "ecr:DescribeImages",
    ]
    resources = [for repo in aws_ecr_repository.this : repo.arn]
  }
}

resource "aws_iam_role_policy" "github_ci" {
  name   = "${local.name}-github-ci"
  role   = aws_iam_role.github_ci.id
  policy = data.aws_iam_policy_document.github_ci.json
}

resource "aws_iam_role" "github_deploy" {
  name               = "${local.name}-github-deploy"
  description        = "_deploy.yml. Rolls out an existing image. Cannot build one."
  assume_role_policy = data.aws_iam_policy_document.github_assume.json
}

data "aws_iam_policy_document" "github_deploy" {
  # _deploy.yml's first step: fail in five seconds if the SHA was never built.
  statement {
    sid       = "VerifyTheImageExists"
    actions   = ["ecr:DescribeImages", "ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "RollOutTheServices"
    actions = [
      "ecs:DescribeServices",
      "ecs:DescribeTaskDefinition",
      "ecs:DescribeTasks",
      "ecs:ListTasks",
      "ecs:RegisterTaskDefinition",
      "ecs:UpdateService",
      "ecs:RunTask",
    ]
    resources = ["*"]
  }

  # Registering a task definition means naming the roles it runs as, and that
  # is a privilege-escalation path if it is not constrained: without this
  # statement's resource list, the deploy role could register a task definition
  # using any role in the account and then run it.
  statement {
    sid     = "PassOnlyTheseRoles"
    actions = ["iam:PassRole"]
    resources = [
      aws_iam_role.execution.arn,
      aws_iam_role.api_task.arn,
      aws_iam_role.web_task.arn,
      aws_iam_role.migrate_task.arn,
    ]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "${local.name}-github-deploy"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}
