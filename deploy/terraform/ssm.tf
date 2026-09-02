# ---------------------------------------------------------------------------
# Secrets — the shape, never the values.
#
# This is the file that makes "no secret is in git" and "the infrastructure is
# in git" both true at once.
#
# Terraform declares that a parameter EXISTS and that the task role may read it.
# The value is written out of band, once, by a human:
#
#   aws ssm put-parameter --type SecureString --overwrite \
#     --name /dealers-drive/dev/SESSION_SECRET \
#     --value "$(openssl rand -base64 48)"
#
# `ignore_changes = [value]` is what keeps it that way. Without it, every
# `terraform apply` would overwrite the real secret with the placeholder below,
# and the placeholder would have had to be a real secret in a tfvars file to
# avoid that — which is the outcome this design exists to prevent.
#
# The API refuses to boot if any of these is missing or still a local default
# (apps/api/src/config/env.ts), so a parameter left at PLACEHOLDER fails loudly
# at deploy rather than quietly at runtime.
# ---------------------------------------------------------------------------
locals {
  # Read by the API at task start, via the task definition's `secrets` block.
  api_secret_names = [
    "DATABASE_URL",
    "SESSION_SECRET",
    "UPLOAD_SIGNING_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ]

  # The migrator needs the database and nothing else. Giving it the OAuth
  # credentials and the object-storage keys would widen the blast radius of a
  # compromised migration for no benefit.
  migrate_secret_names = ["DATABASE_URL"]
}

resource "aws_ssm_parameter" "api" {
  for_each = toset(local.api_secret_names)

  name  = "${local.ssm_prefix}/${each.value}"
  type  = "SecureString"
  value = "PLACEHOLDER — set with `aws ssm put-parameter --overwrite`"

  lifecycle {
    ignore_changes = [value]
  }
}
