# Deploy and operate

This runbook uses Terraform, GitHub Actions and the AWS SDK. **No AWS CLI is
required.** Infrastructure/account actions below are future operator procedures;
this audit did not inspect or change an AWS account. Launch implementation is
separate from historical ECS support in `deploy/terraform`.

## Provisioning prerequisites

Use an authenticated operator/IaC identity, existing Route53 hosted zone and
GitHub OIDC provider. Supply nonsecret values using the example tfvars. KMS key
must permit the host role to decrypt SSM SecureStrings through SSM, and have
recoverable administration. State requires a separate encrypted, versioned,
public-blocked S3 bucket with least-privilege access and a DynamoDB lock table
(Terraform1.9). Configure the backend with bucket/key/region/dynamodb_table;
never put credentials or parameter values in tfvars/state.

```sh
terraform -chdir=deploy/launch/terraform init -backend-config=/secure/path/backend.hcl
terraform -chdir=deploy/launch/terraform fmt -check -recursive
terraform -chdir=deploy/launch/terraform validate
terraform -chdir=deploy/launch/terraform plan -var-file=/secure/path/production.tfvars -out=launch.tfplan
# Review additions, existing DNS ownership and deletion protection before apply.
terraform -chdir=deploy/launch/terraform apply launch.tfplan
```

A real plan necessarily reads target AWS resources; it was **not** run in this
account-independent audit. CI uses `terraform init -backend=false`, validate
and **mock-provider** plan tests without credentials. No unvalidated template
should be applied. Existing DNS records must be imported/adopted deliberately;
never destroy infrastructure to resolve a name collision. ALB/NAT are absent.

Verify DNS and ACM validation, S3 restrictions, private RDS/SGs, EIP association,
SSM host registration and SNS email confirmation in the console. The first host
boot intentionally waits for configuration/release; check cloud-init/systemd
logs through SSM, not SSH. User data installs pinned Compose/Python SDK and
verifies Compose download checksum. Amazon Linux patches are an operator duty:
replace the host from an updated AMI during a announced maintenance window;
keep RDS/data off-host. Launch is not rolling multi-host HA.

## DB roles and production configuration

Connect through SSM port forwarding or an operator session on the host over
strict RDS TLS. Retrieve RDS-managed master password with an operator identity;
**the host/application roles cannot read that master secret**. Run the reviewed
bootstrap SQL as master, choose strong generated owner/runtime passwords through
parameterized SQL or interactive `psql \password`, and use these separate URLs:
owner for Prisma migrations, runtime for application CRUD and pg-boss ownership.
Do not use `pnpm db:bootstrap` (its target is missing), demo seeds, migrate reset,
or the master identity in application configuration.

Store **JSON string-to-string objects**, not shell scripts, as standard SSM
SecureStrings outside Terraform state:

- `/dealers-drive/production/runtime`: `DATABASE_URL` (runtime user, TLS),
  `SESSION_SECRET` ≥32chars, `UPLOAD_SIGNING_SECRET` ≥32chars, `ADMIN_ALLOWLIST`,
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`
  (verified domain), `MSG91_AUTH_KEY`, `MSG91_WIDGET_ID`, `MSG91_WIDGET_TOKEN`,
  optional `GOOGLE_MAPS_API_KEY`; set `METRICS_ENABLED=true` with a ≥32char
  `METRICS_SCRAPE_TOKEN`, or leave metrics endpoint off. Set `LOG_LEVEL=info`,
  `SHUTDOWN_DRAIN_MS=5000`, `SHUTDOWN_TIMEOUT_MS=30000`.
- `/dealers-drive/production/migration`: `DATABASE_URL` with schema-owner user,
  RDS CA verification query options supported by Prisma CLI, never runtime master.
- `/dealers-drive/production/release`: nonsecret immutable release JSON, written
  by CI after publishing both images.

The host enforces production drivers/origins and mounts the RDS CA. Runtime
`DB_SSL_CA_FILE` forces certificate/hostname verification and removes URL
parameters that could override its SSL object. For the migration URL use
`sslmode=verify-full&sslrootcert=/run/rds-ca.pem`; validate CLI connectivity first.
Values with single quotes/newlines are deliberately rejected by the env writer;
use generated URL-encoded passwords and one-line values. Secrets never print.

Host role reads only these parameters, decrypts their specified key and deploys;
application credential_process exposes only renewable scoped S3 sessions.
Docker bridge IMDS traffic is blocked in DOCKER-USER; IMDSv2 is required and the
host daemon can still obtain log-driver credentials. Runtime/worker cannot read
migration parameters or assume the deploy role. Shared-host root compromise has
host-wide blast radius; no claim of a VM boundary between containers.

## Release

GitHub environment **Production** variable `LAUNCH_DEPLOY_ROLE_ARN` is the
Terraform output. Trust matches `shashikiran6sk/DealersDrive:environment:Production`.
Use protected main; retain required checks. Existing ECS promotion is an
alternative historical path, **not** this launch deployment. Do not enable both
paths against the same DNS/database. No merge is performed by this work.

Actions → **Launch production** → run on **main**. Verification precedes OIDC;
ARM64 immutable `sha-<40hex>` API/migrator images are built in a native ARM runner.
CI publishes the pointer and issues one serialized SSM deployment. Host pulls,
runs migrator once, requires its exit success, starts API/worker/Caddy, verifies
readiness and exact Git SHA. Logs are in `/dealers-drive/production/application`.
Failed migration stops rollout; failed API restores previous images. Rejected
SHA is parked until an explicit deploy retry or new SHA, preventing timer loops.
Replacement host consumes the same pointer. An existing immutable tag cannot be
overwritten; if retrying a build after publish, use the existing images or a
new commit. No `latest` deployment.

Vercel stays independent. Configure production `API_ORIGIN=https://api.dealers-drive.com`
and any documented frontend env values; choose Mumbai function region where
available. Set Google OAuth production redirect to the **frontend**
`https://www.dealers-drive.com/v1/auth/google/callback`; verify rewrites and
cookie behavior. API CORS allows exactly the production web origin. Set frontend
media origin via the API's MEDIA_BASE_URL; images need no Vercel optimizer.
Use Pro for commercial deployment. Vercel production from this branch is not
published until its reviewed version is intentionally promoted.

## Rollback and recovery

With a compatible database schema, SSM Run Command:

```sh
/opt/dealers-drive/venv/bin/python /opt/dealers-drive/host.py rollback
```

This deploys previous immutable images without rerunning migrations and updates
the desired pointer so the timer retains the rollback. The CI failure path also
restores the previous desired pointer. **Code rollback does not undo database
migrations.** Require expand/contract migrations and inspect compatibility before
release; destructive/incompatible migrations need a forward fix or reviewed PITR
recovery. Test in staging; automatic rollback cannot make an unsafe migration safe.
Vercel UI supports frontend rollback independently; check contracts compatibility.

Inspect/restart through SSM:

```sh
systemctl status dealers-drive-sync.timer dealers-drive-sync.service
journalctl -u dealers-drive-sync.service --since '30 minutes ago'
cd /opt/dealers-drive
# Commands need release/config environment: use host.py supervisor normally.
/opt/dealers-drive/venv/bin/python host.py deploy
```

The explicit deploy retries the pointer including migration gate. For incident
restart without migration, use the Docker container names shown by `docker ps`;
restart API/worker and verify readiness. CloudWatch streams separate API, worker
and migration logs; the dashboard shows availability, worker process, p95 API,
DB CPU/connections and queue/outbox age. Metrics report aggregate counts only.
Worker-running proves process existence, while queue age detects stalled work.

## Queue, media and recovery

Use read-only SQL for `pgboss.job` grouped by name/state, age from created_on,
`notification_deliveries` status and unpublished `outbox_events` attempts. Queue
email retries5/initial30sec/exponential, expiry120sec, retention7days; dedicated
DLQ retained14days. A permanent provider refusal is recorded FAILED even when
the queue handler completes; the aggregate metric includes these delivery rows.
Reconcile provider delivery ID/key before replay; preserve original event ID.
Never clear SENT rows to force retry. A provider failure does not fail readiness.

For existing READY images without variants run the **media:prepare** script
inside the migrator image with **runtime.env**, CA and scoped S3 credentials,
not migration.env; it scans in batches20, serially generates/persists variants.
New commits produce variants before READY. Private content-hashed object names
are immutable; public API/CDN URLs have bounded60sec visibility caching. Original
objects are private. The fallback generation path exists for legacy rows but
prewarm before opening traffic to avoid first-view decoding latency.

Recovery: see [scaling.md](scaling.md). Restore DB to new private instance; update
URLs and redeploy. Preserve S3 versions30days and reconcile orphan media. Retain
IaC state/KMS/SSM recovery access and a controlled secret escrow; don't rely on
one person's local shell. Perform a restore drill and record actual RPO/RTO.
