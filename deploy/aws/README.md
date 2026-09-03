# Standing up dev and production on AWS

One-time setup. After this, deploying is a merge (dev) or an approval
(production), and nothing here is touched again — `deploy` changes the image
and nothing else.

Everything lives in **one AWS account, one region, one VPC, one load balancer**.
Two environments share that infrastructure and share nothing else: separate
databases, separate buckets, separate secrets, separate OAuth clients, separate
task roles. A dev deploy cannot reach a production credential because the role
it assumes is not allowed to read the parameter path it lives in.

```
                       ┌──────────────── one Application Load Balancer ─────────────────┐
  dev.dealers-drive.com├──/v1 /health /media /api/docs ─▶ tg-api-dev  ─▶ ECS  dd-api-dev │
                       └──everything else ──────────────▶ tg-web-dev  ─▶ ECS  dd-web-dev │

  www.dealers-drive.com├──/v1 /health /media ───────────▶ tg-api-prod ─▶ ECS  dd-api-prod │
                       └──everything else ──────────────▶ tg-web-prod ─▶ ECS  dd-web-prod │
     dealers-drive.com └──301 ─▶ www                                                      │
                       └───────────────────────────────────────────────────────────────┘
```

**Why one hostname per environment rather than a separate `api.` host:** the
session cookie stays host-only. `dev.dealers-drive.com` and
`www.dealers-drive.com` cannot read each other's cookies, so a dev session can
never be presented to production — no `SESSION_COOKIE_DOMAIN`, no CORS
preflight, no `SameSite` puzzle at the OAuth callback. Splitting the API onto
its own subdomain would require `.dealers-drive.com` as the cookie domain,
which is precisely the thing that leaks one environment into another.

Set these once per shell:

```bash
export AWS_REGION=ap-south-1                 # Mumbai: the buyers are in Tamil Nadu
export ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export DOMAIN=dealers-drive.com
export REPO=<github-owner>/dealers-drive
```

---

## 1. Container registries

Three repositories: the API, the Next.js server, and the migrator (the same
Dockerfile at an earlier stage, kept because the Prisma CLI is a dev
dependency and the runtime image installs production dependencies only).

```bash
for repo in api web migrator; do
  aws ecr create-repository \
    --repository-name "dealers-drive/$repo" \
    --image-scanning-configuration scanOnPush=true \
    --image-tag-mutability IMMUTABLE
done
```

`IMMUTABLE` is the important flag. `sha-<commit>` must mean one set of bytes
forever — a rollback to a tag that can be overwritten is not a rollback.

Then keep the registry from growing without bound, while keeping enough
history to roll back through:

```bash
cat > /tmp/lifecycle.json <<'JSON'
{"rules":[{"rulePriority":1,"description":"Keep the last 30 builds",
  "selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":30},
  "action":{"type":"expire"}}]}
JSON
for repo in api web migrator; do
  aws ecr put-lifecycle-policy --repository-name "dealers-drive/$repo" \
    --lifecycle-policy-text file:///tmp/lifecycle.json
done
```

## 2. GitHub's identity, and two roles

GitHub Actions authenticates with OIDC. **No AWS access key exists anywhere in
this repository** — a leaked workflow log or a compromised third-party action
cannot exfiltrate a credential that was never stored.

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com
```

Two roles, because building and deploying are different privileges:

| Role                       | Trusted for                         | May                                               |
| -------------------------- | ----------------------------------- | ------------------------------------------------- |
| `dd-gha-ci`                | `repo:$REPO:ref:refs/heads/main`    | push to the three ECR repositories                |
| `dd-gha-deploy-dev`        | `repo:$REPO:environment:dev`        | update the dev services, run the dev migrate task |
| `dd-gha-deploy-production` | `repo:$REPO:environment:production` | the same, for production only                     |

The `environment:` subject is what makes the production role unusable outside a
production deployment: GitHub only mints that token for a job that has entered
the `production` environment, and entering it requires the approval.

```bash
trust() { cat <<JSON
{"Version":"2012-10-17","Statement":[{
  "Effect":"Allow",
  "Principal":{"Federated":"arn:aws:iam::$ACCOUNT:oidc-provider/token.actions.githubusercontent.com"},
  "Action":"sts:AssumeRoleWithWebIdentity",
  "Condition":{
    "StringEquals":{"token.actions.githubusercontent.com:aud":"sts.amazonaws.com",
                    "token.actions.githubusercontent.com:sub":"$1"}}}]}
JSON
}

aws iam create-role --role-name dd-gha-ci \
  --assume-role-policy-document "$(trust "repo:$REPO:ref:refs/heads/main")"

for env in dev production; do
  aws iam create-role --role-name "dd-gha-deploy-$env" \
    --assume-role-policy-document "$(trust "repo:$REPO:environment:$env")"
done
```

Attach policies that are as narrow as the job. The deploy role needs
`ecs:UpdateService`, `ecs:RegisterTaskDefinition`, `ecs:DescribeTaskDefinition`,
`ecs:DescribeServices`, `ecs:RunTask`, `ecs:DescribeTasks`, `ecr:Describe*` and
`ecr:GetAuthorizationToken`, plus `iam:PassRole` restricted to the two task
roles for **its own environment**. That `PassRole` restriction is what stops a
dev deployment from launching a task wearing production's identity.

## 3. Network

One VPC, two public subnets in different availability zones, no NAT gateway.

Tasks run in public subnets with `assignPublicIp=ENABLED` and a security group
that accepts traffic **only from the load balancer**. That is a deliberate
trade: a NAT gateway is $35/month plus data processing, and it buys the ability
to say "the tasks have no public IP" — while the security group is what
actually stops traffic either way. Revisit it when there is revenue, or when
compliance asks; the change is subnets and a NAT, not an application change.

```bash
VPC=$(aws ec2 create-vpc --cidr-block 10.20.0.0/16 \
      --query Vpc.VpcId --output text)
# ...two subnets, an internet gateway, a route table. Any VPC layout works;
# what matters is two AZs and public egress for the ECR pull.
```

Three security groups:

| Group    | Inbound                                     | Why                                     |
| -------- | ------------------------------------------- | --------------------------------------- |
| `dd-alb` | 80, 443 from `0.0.0.0/0`                    | the only thing on the internet          |
| `dd-app` | 3000, 4000 from `dd-alb`; all from `dd-app` | tasks; the self-rule is Service Connect |
| `dd-rds` | 5432 from `dd-app`                          | the database, and nothing else          |

The database is never reachable from the internet, and never from a laptop. To
open a psql session, use SSM Session Manager port-forwarding through a task —
not a public endpoint, and not a bastion with a key somebody keeps.

## 4. Databases

Two instances. **Not two databases on one instance**: an accidental
`DATABASE_URL` with the wrong database name would still be pointing at
production's disk, its CPU and its connection limit, and one runaway dev query
would be a production incident.

```bash
aws rds create-db-instance \
  --db-instance-identifier dd-postgres-prod \
  --engine postgres --engine-version 16 \
  --db-instance-class db.t4g.small \
  --allocated-storage 20 --storage-type gp3 --storage-encrypted \
  --master-username dealersdrive --manage-master-user-password \
  --db-name dealersdrive \
  --no-publicly-accessible \
  --vpc-security-group-ids "$RDS_SG" --db-subnet-group-name dd-subnets \
  --backup-retention-period 7 --preferred-backup-window 18:00-19:00 \
  --deletion-protection \
  --enable-performance-insights

aws rds create-db-instance \
  --db-instance-identifier dd-postgres-dev \
  --engine postgres --engine-version 16 \
  --db-instance-class db.t4g.micro \
  --allocated-storage 20 --storage-type gp3 --storage-encrypted \
  --master-username dealersdrive --manage-master-user-password \
  --db-name dealersdrive \
  --no-publicly-accessible \
  --vpc-security-group-ids "$RDS_SG" --db-subnet-group-name dd-subnets \
  --backup-retention-period 1
```

`--deletion-protection` on production only, and `--backup-retention-period 7`
gives point-in-time recovery to any second in the last week — which is the
actual database rollback story (docs/DEPLOYMENT.md §K).

## 5. Object storage — Cloudflare R2

Two buckets, `dd-media-dev` and `dd-media-prod`, and an API token scoped to
**one bucket each**. Sharing a token across environments makes the bucket
separation decorative: a dev deploy with a wrong `S3_BUCKET` would write into
production's photos.

R2 rather than S3 because the browser uploads and downloads the photos
directly, and R2 charges nothing for egress — on an image-heavy marketplace
that is the single largest line item avoided. The application needs no change:
`STORAGE_DRIVER=r2` is the same S3 adapter the local MinIO uses.

Each bucket needs a CORS rule allowing `PUT` from its own environment's origin
only:

```json
[
  {
    "AllowedOrigins": ["https://dev.dealers-drive.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

## 6. Secrets

Every secret is an SSM SecureString under a per-environment path. Parameter
Store rather than Secrets Manager: standard parameters are free, Secrets
Manager is $0.40 per secret per month, and nothing here needs automatic
rotation yet. Move `DATABASE_URL` to Secrets Manager the day RDS-managed
rotation is turned on.

```bash
put() { aws ssm put-parameter --name "$1" --value "$2" --type SecureString --overwrite; }

for env in dev production; do
  put "/dealers-drive/$env/SESSION_SECRET"       "$(openssl rand -hex 32)"
  put "/dealers-drive/$env/UPLOAD_SIGNING_SECRET" "$(openssl rand -hex 32)"
done
# DATABASE_URL, the Google client, the R2 keys and DEV_ADMIN_PASSWORD are
# pasted in the same way, per environment. Never the same value twice.
```

The full list, with what each one is for, is in `env.dev.example` and
`env.production.example` beside this file.

Two roles read them. The **execution role** (`dd-ecs-execution`, one, shared)
pulls images and resolves `secrets` at task start; grant it
`ssm:GetParameters` on `/dealers-drive/*`. The **task roles**
(`dd-api-task-dev`, `dd-api-task-prod`, …) are what the running container is,
and they need almost nothing — the application talks to Postgres and R2 with
credentials, not with IAM.

## 7. Certificate

One certificate covering both environments, in the same region as the load
balancer:

```bash
aws acm request-certificate --domain-name "$DOMAIN" \
  --subject-alternative-names "www.$DOMAIN" "dev.$DOMAIN" \
  --validation-method DNS
```

Add the CNAME records it asks for at the DNS provider, wait for `ISSUED`. ACM
renews it automatically for as long as those records stay in place — leave
them there.

## 8. Load balancer

Four target groups, all `ip` type (Fargate), each with the health check that
belongs to it:

```bash
tg() {
  aws elbv2 create-target-group --name "$1" --protocol HTTP --port "$2" \
    --vpc-id "$VPC" --target-type ip \
    --health-check-path "$3" --health-check-interval-seconds 15 \
    --healthy-threshold-count 2 --unhealthy-threshold-count 3 \
    --query 'TargetGroups[0].TargetGroupArn' --output text
}
TG_API_DEV=$(tg  tg-api-dev  4000 /health/ready)
TG_WEB_DEV=$(tg  tg-web-dev  3000 /api/health)
TG_API_PROD=$(tg tg-api-prod 4000 /health/ready)
TG_WEB_PROD=$(tg tg-web-prod 3000 /api/health)
```

The API is checked on `/health/ready`, which touches the database — a task that
cannot reach Postgres should not receive traffic. The web app is checked on
`/api/health`, which touches **nothing**: it must not fail because the API is
down, or an API incident would take the front end out of rotation and leave
nothing to serve an error page.

Listener rules, lowest priority number first:

| Priority | Condition                                                             | Action                               |
| -------- | --------------------------------------------------------------------- | ------------------------------------ |
| 10       | host `dev.$DOMAIN` · path `/v1/*` `/health/*` `/media/*` `/api/docs*` | forward `tg-api-dev`                 |
| 20       | host `dev.$DOMAIN`                                                    | forward `tg-web-dev`                 |
| 30       | host `www.$DOMAIN` · path `/v1/*` `/health/*` `/media/*`              | forward `tg-api-prod`                |
| 40       | host `www.$DOMAIN`                                                    | forward `tg-web-prod`                |
| 50       | host `$DOMAIN`                                                        | redirect 301 → `https://www.$DOMAIN` |

The API rule must come first, and it must name `/api/docs*` explicitly rather
than `/api/*`: the web app's own BFF routes live under `/api/dealer/*` and
`/api/vehicles/*`, and sending those to the API would break photo upload and
the enquiry inbox.

Port 80 gets one rule: redirect everything to 443. HSTS is set by helmet in the
application, so the redirect is the only HTTP the load balancer ever serves.

## 9. ECS

```bash
aws ecs create-cluster --cluster-name dealers-drive \
  --settings name=containerInsights,value=enabled \
  --service-connect-defaults namespace=dealers-drive
```

Register the six task definitions from `taskdef/` — three per environment, with
the environment-specific values from `env.dev.example` / `env.production.example`
substituted in. Then four services (two per environment):

```bash
aws ecs create-service \
  --cluster dealers-drive --service-name dd-api-dev \
  --task-definition dd-api-dev --desired-count 1 --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_A,$SUBNET_B],securityGroups=[$APP_SG],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=$TG_API_DEV,containerName=api,containerPort=4000" \
  --health-check-grace-period-seconds 60 \
  --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true},minimumHealthyPercent=100,maximumPercent=200" \
  --service-connect-configuration "enabled=true,namespace=dealers-drive,services=[{portName=api,discoveryName=dd-api-dev,clientAliases=[{port=4000,dnsName=dd-api-dev}]}]"
```

Two settings carry most of the reliability story:

**`deploymentCircuitBreaker={enable=true,rollback=true}`** — if the new tasks
never pass the target group health check, ECS stops the rollout and puts the
previous task definition back, by itself, without a workflow step and without a
person. That is the automatic rollback. `_deploy.yml` waits for stability and
therefore fails the deployment when this happens, so it is reported rather than
silent.

**`minimumHealthyPercent=100, maximumPercent=200`** — the new task must be
healthy before an old one is stopped. There is no window where the service has
fewer healthy tasks than it started with.

`desired-count`: 1 for both dev services and for `dd-api-prod`, 2 for
`dd-web-prod`. The API is capped at one task by `WORKER_INLINE=true` — the job
handlers run inside the HTTP process, so a second task runs every scheduled job
twice. Lifting that cap means the separate worker entrypoint described in
docs/DEPLOYMENT.md §C, not a bigger `desired-count`.

## 10. DNS

| Name      | Type                    | Value                                                                |
| --------- | ----------------------- | -------------------------------------------------------------------- |
| `$DOMAIN` | ALIAS / CNAME-flattened | the load balancer's DNS name                                         |
| `www`     | CNAME                   | the load balancer's DNS name                                         |
| `dev`     | CNAME                   | the load balancer's DNS name                                         |
| `media`   | CNAME                   | the R2 public bucket domain (optional, for a CDN in front of photos) |

Route 53 with an ALIAS record is the AWS-native answer and costs $0.50/month
per zone. Cloudflare DNS with CNAME flattening at the apex is free and is the
better choice if R2 is already in use — keep the records **DNS-only (grey
cloud)** for the app hostnames. Proxying them adds a second hop in front of the
load balancer, and the API's `trust proxy 1` would then read the Cloudflare
edge as the client address, breaking every per-IP rate limit that protects
dealer phone numbers.

## 11. GitHub

**Environments** (Settings → Environments):

|                              | `dev`               | `production`                      |
| ---------------------------- | ------------------- | --------------------------------- |
| Required reviewers           | none                | **you** (this is the manual gate) |
| Deployment branches          | `main`              | `main`                            |
| Secret `AWS_DEPLOY_ROLE_ARN` | `dd-gha-deploy-dev` | `dd-gha-deploy-production`        |

**Environment variables** (not secrets — none of these are sensitive):

```
AWS_REGION              ap-south-1
ECS_CLUSTER             dealers-drive
ECS_SERVICE_API         dd-api-dev            | dd-api-prod
ECS_SERVICE_WEB         dd-web-dev            | dd-web-prod
ECS_TASK_FAMILY_API     dd-api-dev            | dd-api-prod
ECS_TASK_FAMILY_WEB     dd-web-dev            | dd-web-prod
ECS_TASK_FAMILY_MIGRATE dd-migrate-dev        | dd-migrate-prod
ECS_SUBNETS             "subnet-aaa","subnet-bbb"
ECS_SECURITY_GROUP      sg-app
ECS_ASSIGN_PUBLIC_IP    ENABLED
MIGRATE_LOG_GROUP       /dealers-drive/dev/migrate | /dealers-drive/production/migrate
WEB_BASE_URL            https://dev.dealers-drive.com | https://www.dealers-drive.com
API_BASE_URL            https://dev.dealers-drive.com | https://www.dealers-drive.com
```

**Repository** level: secret `AWS_CI_ROLE_ARN` (the build role), variables
`AWS_REGION`, `ECR_REPO_API=dealers-drive/api`, `ECR_REPO_WEB=dealers-drive/web`,
`ECR_REPO_MIGRATOR=dealers-drive/migrator`, and
`DEV_API_BASE_URL=https://dev.dealers-drive.com` (promote.yml reads dev's
health endpoint through it, before entering any environment).

**Branch protection** on `main`: require the `CI / lint · typecheck · test ·
build`, `CI / images build`, `CI / dependency audit`, `Security / semgrep` and
`Security / gitleaks` checks, require a pull request, require the branch to be up to date, no force
pushes, no deletions. Include administrators — a rule you can wave through is a
rule you will wave through at 11pm.

## 12. Google OAuth

Two clients, one per environment, in the same Google Cloud project:

|                   | dev                                                     | production                                              |
| ----------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| Authorized origin | `https://dev.dealers-drive.com`                         | `https://www.dealers-drive.com`                         |
| Redirect URI      | `https://dev.dealers-drive.com/v1/auth/google/callback` | `https://www.dealers-drive.com/v1/auth/google/callback` |

Character for character, `https`, no trailing slash. One client with both URIs
registered would work and is the wrong answer: an OAuth client is only as
trustworthy as the least protected host on its redirect list.

The production consent screen must be **published**, not in Testing — a real
dealer is not on anybody's test-user list.

## 13. First deployment

1. Merge anything to `main`. `release.yml` builds three images and deploys dev.
2. Bootstrap the dev database — reference catalogue, credit packs, config
   defaults and one admin. It creates what is missing and overwrites nothing:

   ```bash
   aws ecs run-task --cluster dealers-drive \
     --task-definition dd-migrate-dev --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_A],securityGroups=[$APP_SG],assignPublicIp=ENABLED}" \
     --overrides '{"containerOverrides":[{"name":"migrate","command":["pnpm","db:bootstrap"]}]}'
   ```

3. Walk `https://dev.dealers-drive.com` end to end: sign in with Google,
   onboard, add a car with a photo, publish, enquire from a private window,
   approve the dealership from the admin console.
4. Actions → **Promote to Production** → Run workflow → approve.
5. Bootstrap production the same way as step 2, with `dd-migrate-prod`.

**Never run `pnpm db:seed` against dev or production.** It truncates every
application table before it writes. `db:bootstrap` is the deployed-environment
command; `db:seed` is for a laptop.
