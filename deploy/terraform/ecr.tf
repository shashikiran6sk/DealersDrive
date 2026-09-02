# ---------------------------------------------------------------------------
# Image registries.
#
# Three repositories, because release.yml builds three images from one commit:
# the API, the migrator (the same Dockerfile, an earlier stage, so it still has
# the Prisma CLI) and the web app.
#
# `image_tag_mutability = IMMUTABLE` is the load-bearing setting. The whole
# promotion model rests on `sha-<commit>` meaning one specific set of bytes
# forever — promote.yml verifies a tag exists and rolls it out without
# rebuilding, and a rollback is redeploying an older tag. A mutable tag would
# make "the image dev tested" and "the image production runs" two different
# things that happen to share a name.
# ---------------------------------------------------------------------------
locals {
  ecr_repositories = {
    api      = "dealers-drive/api"
    migrator = "dealers-drive/migrator"
    web      = "dealers-drive/web"
  }
}

resource "aws_ecr_repository" "this" {
  for_each = local.ecr_repositories

  name                 = each.value
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

# Untagged layers are build cache that nothing can deploy; expire them quickly.
# Tagged images are kept deep enough that a rollback still has somewhere to go
# after a busy week — 30 images is roughly a month of merges at current pace.
resource "aws_ecr_lifecycle_policy" "this" {
  for_each = aws_ecr_repository.this

  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after a day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Keep the last 30 sha- tags, so a rollback always has a target"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["sha-"]
          countType     = "imageCountMoreThan"
          countNumber   = 30
        }
        action = { type = "expire" }
      },
    ]
  })
}
