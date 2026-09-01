# Terraform — the production runtime, as code

Until this directory existed, the ECS services, autoscaling policies, alarms and
SSM parameters lived only as console state. That had two consequences worth
naming, because they are the reason this exists:

- **A capacity change was invisible.** Nobody reviewed "we doubled the task
  memory", because there was nothing to review.
- **Rebuilding was archaeology.** The only description of how production was
  wired was production itself.

What this directory does **not** own is the image. `.github/workflows/_deploy.yml`
fetches the live task definition, replaces exactly the image field, and registers
a new revision. Terraform owns the _shape_; the pipeline owns the _version_. The
two coexist because every service carries:

```hcl
lifecycle {
  ignore_changes = [task_definition, desired_count]
}
```

Without the first, `terraform apply` would drag production back to whichever
image Terraform last wrote — a silent rollback. Without the second, it would
fight autoscaling.

> **Rule of thumb.** Change capacity, configuration or alarms _here_, then
> deploy to pick it up. Change the running image by _deploying_, never by
> applying.

## What is here

| File             | Owns                                                            |
| ---------------- | --------------------------------------------------------------- |
| `versions.tf`    | Provider, partial S3 backend, common tags                       |
| `variables.tf`   | Every input, each documented with why the default is what it is |
| `ecr.tf`         | Three repositories, **immutable tags**, lifecycle expiry        |
| `iam.tf`         | Execution role, three task roles, two GitHub OIDC roles         |
| `ssm.tf`         | Secret _names_ — never values                                   |
| `logs.tf`        | Log groups with retention                                       |
| `alb.tf`         | Security groups, load balancer, target groups, path routing     |
| `ecs.tf`         | Cluster, three task definitions, two services                   |
| `autoscaling.tf` | Target-tracking policies on CPU and memory                      |
| `alarms.tf`      | SNS topic and the five alarms worth waking someone for          |
| `outputs.tf`     | Exactly the values the GitHub environments need                 |
| `envs/*.tfvars`  | Per-environment sizing                                          |

## Prerequisites

Terraform does not create these, because they are older than this application
and shared with everything else in the account:

- A VPC with at least two public and two private subnets, and a NAT path out of
  the private ones.
- An ACM certificate for the environment's hostname, in the same region.
- A Postgres database reachable from the private subnets, and its connection
  string in SSM (below).
- The GitHub OIDC identity provider. Once per account:

  ```sh
  aws iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com
  ```

- An S3 bucket and DynamoDB table for state, per environment.

## First run

```sh
cd deploy/terraform

terraform init \
  -backend-config=bucket=dd-tfstate-dev \
  -backend-config=key=dealers-drive/dev.tfstate \
  -backend-config=region=ap-south-1 \
  -backend-config=dynamodb_table=dd-tflock-dev

terraform plan  -var-file=envs/dev.tfvars
terraform apply -var-file=envs/dev.tfvars
```

The backend is partial on purpose. Dev and production are separate accounts, and
hard-coding either bucket here would make it possible to point production
Terraform at the dev state by forgetting a flag.

### Then: fill in the secrets

`terraform apply` creates each parameter with a placeholder and then never looks
at its value again (`ignore_changes = [value]`). Set them once, by hand:

```sh
terraform output -json ssm_parameters_to_populate

aws ssm put-parameter --type SecureString --overwrite \
  --name /dealers-drive/dev/SESSION_SECRET \
  --value "$(openssl rand -base64 48)"

aws ssm put-parameter --type SecureString --overwrite \
  --name /dealers-drive/dev/DATABASE_URL \
  --value 'postgresql://…'
```

A parameter left at `PLACEHOLDER` fails loudly at the first deploy rather than
quietly at runtime: `apps/api/src/config/env.ts` refuses to boot in production
when a required secret is missing or is still a local default.

### Then: wire up GitHub

```sh
terraform output -json github_environment
terraform output -json github_secrets
```

Copy those into **Settings → Environments → `dev`** (and `production`).
`AWS_CI_ROLE_ARN` is a _repository_ secret; `AWS_DEPLOY_ROLE_ARN` is an
_environment_ secret, which is what makes it structurally impossible for a dev
deploy to read a production credential.

Set required reviewers on the `production` environment. That approval gate is
the only thing standing between a `workflow_dispatch` and a production rollout.

### Then: DNS

```sh
terraform output alb_dns_name
terraform output alb_zone_id
```

An ALIAS record for the environment's hostname, pointing at the load balancer.

## Things that are the way they are for a reason

**Immutable ECR tags.** The whole promotion model rests on `sha-<commit>`
meaning one set of bytes forever. Promotion is a lookup and a rollout, and
rollback is redeploying an older tag. A mutable tag would make "the image dev
tested" and "the image production runs" two different things sharing a name.

**Two tasks minimum, in every environment.** Not for load — for correctness.
Two is the smallest number that exercises what breaks at N>1: the shared
rate-limit counter, cross-instance config invalidation, and a rolling deploy
that drains one task while another serves. A single-task dev environment lets
all three regress silently until production finds them.

**`NODE_OPTIONS=--max-old-space-size` below the task memory.** So V8 applies
back-pressure before the kernel OOM-killer does. A Node process whose heap
ceiling equals its container limit does not get a slow GC; it gets killed
mid-request with no error and no stack, and the symptom is "tasks restart under
load and nobody knows why".

**`deregistration_delay = 30`, `SHUTDOWN_DRAIN_MS = 5000`, `stopTimeout = 25`.**
These three are one mechanism. On SIGTERM the task fails `/health/ready`
immediately, keeps serving for five seconds while the load balancer notices,
then closes the listener and drains. `stopTimeout` must exceed drain + shutdown
or ECS sends SIGKILL mid-drain — which is exactly the cut-off request the drain
exists to prevent. Change one and check the other two.

**Scale out in 60s, scale in over 300s.** Adding a task costs a little money;
removing one too eagerly costs latency for every request that arrives during the
next cold start.

**`CACHE_DRIVER = postgres`.** Rate-limit windows are shared state. With the
in-process counter, N tasks permitted N times every limit and reported nothing —
and those limits are a spend control, because every phone reveal costs an SMS.
`env.ts` now refuses `memory` in production for that reason.

## Relationship to `deploy/docker-compose.prod.yml`

That file is the _other_ production topology: one VM, nginx, systemd, no AWS.
It is still supported and still documented in `deploy/README.md`. This directory
is the ECS path. They are alternatives, not layers — running both for the same
environment would give you two sources of truth for one site.
