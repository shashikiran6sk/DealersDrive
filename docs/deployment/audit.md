# Phase 1 — audit report

Audit date: 2026-10-03. Source baseline: `d6ae115` on latest `main`.
No account inventory or billing API is used. Historical infrastructure comes
from the user's deployment log and timestamped screenshot archive. Estimates
describe resources, not an attribution of the user's actual invoice.

## Application map

```text
Browser → Vercel / Next.js 15.5 / React 19
            ├─ server components, server actions, BFF routes
            ├─ OAuth rewrites → Express 5 / Node 24
            └─ public images → MEDIA_BASE_URL

Express modular monolith
  ├─ Prisma 7 / adapter-pg → PostgreSQL 16
  │    ├─ identity, sessions, dealer memberships and permissions
  │    ├─ listings, enquiries, moderation, support, audit
  │    ├─ shared rate limits and config versions
  │    ├─ transactional outbox
  │    └─ pg-boss schema
  ├─ presigned upload / private read → S3-compatible StoragePort
  ├─ Google OAuth / MSG91 phone proof / Google Maps
  └─ worker process → outbox → event bus → pg-boss → Resend
```

`apps/api/src/container.ts`, `routes.ts`, `server.ts`, `index.ts`, `worker.ts`
are the composition, route, HTTP and process entry points. `apps/sandbox` is
Storybook, not a production runtime. `packages/contracts` shares strict Zod
contracts; `packages/config` shares build/lint settings.

Authentication is stored in PostgreSQL, not JWT-only or memory-only. Google
OAuth and MSG91 support dealer/customer identity; admin Google access checks
the allowlist. Dealer OWNER/MANAGER/STAFF permissions and active membership
are enforced on the API. Vercel uses host-only session cookies, forwards them
in server-side calls, and rewrites OAuth navigations to preserve one browser
origin. Keep the existing design and production guards.

Public reads can use Next's data cache (typically 60 seconds; directory data
600 seconds). Authenticated reads use `no-store`. Some public routes remain
dynamic even when their data fetches are cached. The frontend must be close to
the API; configure Vercel function region Mumbai where the plan supports it.

## Runtime and database

Prisma uses the JavaScript `pg` driver through `PrismaPg`. The current code
does not explicitly cap its pool: the driver default is ten connections per
process. pg-boss separately creates a pool, also defaulting to ten. API and
worker both build a complete container and both start pg-boss. Potential
launch demand is therefore **40 pooled connections**, plus migration/admin
connections and any dedicated queue listener. This is not forty connections
opened immediately, but it is a real concurrency ceiling.

Rate limits use PostgreSQL atomic counters. Redis is unnecessary. Transaction
timeout is 20 seconds, maximum acquisition wait 10 seconds. Tenant writes and
lifecycle transitions use transactions and row locks. Search is PostgreSQL,
including indexed listing queries; no search cluster is needed. Config version
polling is request-driven; the outbox worker polls every two seconds.

Readiness probes the database and counter table; queue/storage/gateway entries
currently say `ok` without being probed. Liveness is separate. Readiness should
not depend on Resend or Google. API SIGTERM stops readiness, drains HTTP, closes
the queue/cache/Prisma; worker SIGTERM closes the same resources. Outbox stop
currently clears its timer without awaiting an active drain.

RDS instance type/HA/backup settings are not reproducibly described in current
Terraform. Historical TLS was `sslmode=require`; this encrypts the connection
but is not a substitute for explicit certificate/hostname verification. Launch
needs a trusted RDS CA bundle and strict TLS, restricted SG ingress, seven-day
PITR, deletion protection and final snapshots. Single-AZ is an explicit launch
tradeoff: durable storage/backups, but no automatic standby failover. Target
RPO approximately five minutes within the available PITR window; RTO 1–2 hours
is a planning target to verify with a restore drill, not a measured guarantee.

## Background jobs: actual versus declared

| Job                                                                                                                       | Producer                                         | Consumer                        | Purpose/frequency                                                                                                                                       | Runtime                                           |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `notification.email`                                                                                                      | notification event subscriptions                 | notifications service in worker | dealer application received/resubmitted/approved/rejected/changes requested, suspension/reinstatement; profile proposal submitted/decided; event-driven | DB reads, template rendering, HTTPS provider call |
| transactional outbox                                                                                                      | dealer/admin writes, inside business transaction | worker outbox publisher         | durable domain-event relay, 2-second poll, up to 50 rows                                                                                                | DB + queue writes                                 |
| `media.process`, `media.gc-orphans`                                                                                       | none                                             | none                            | declared placeholders                                                                                                                                   | not implemented                                   |
| `search.index-listing`, `search.remove-listing`, `search.reindex-dealer`                                                  | none                                             | none                            | declared placeholders; current search reads DB                                                                                                          | not implemented                                   |
| `notification.enquiry-to-dealer`, `notification.listing-reviewed`, `notification.dealer-reviewed`, `notification.invoice` | none                                             | none                            | declared placeholders                                                                                                                                   | not implemented                                   |
| `listings.expire-sweep`, `counters.reconcile`, `cache.sweep-counters`, `rc.sweep-lookups`                                 | none                                             | none                            | declared placeholders                                                                                                                                   | not implemented                                   |

There are **14 registered queue names, one active job consumer, and no active
cron registrations**. Listing/enquiry/complaint email, reminders, analytics,
moderation automation and storage GC must not be claimed as working. They
need separate product requirements. The worker's additional current work is
outbox relay, not image processing or lifecycle scheduling.

Email retries: five retries, 30-second initial delay and exponential backoff.
Other declared queues default to three retries. Job expiry, retention, deletion,
concurrency, polling and dead-letter policy are inherited from the installed
pg-boss version rather than pinned by this application. Failed queue jobs and
`NotificationDelivery` rows are separate records. Outbox gives up after ten
attempts. There is no configured dedicated DLQ or queue-pressure alarm.

Existing idempotency is useful: `template:eventId:lowercaseRecipient` is unique
in `notification_deliveries` and is sent as Resend's idempotency key. SENT rows
are skipped on replay. Concurrent PENDING attempts are not exclusively claimed;
provider deduplication has a bounded retention window, so this is not universal
exactly-once delivery. Preserve and strengthen it; never promise exactly once.

Three correctness gaps require implementation:

1. The event bus logs subscriber errors and resolves, so the outbox can mark a
   failed enqueue as published. Business writes have already committed; relay
   errors should propagate so the outbox retries.
2. `FOR UPDATE SKIP LOCKED` is executed outside an enclosing transaction; the
   lock ends before publishing. Use a transaction around claim/publish/mark,
   with replay-safe event IDs; queue writes must not be silently dropped.
3. Resend HTTP 429 and 408 are classified as permanent failures, and calls
   have no timeout. They need bounded calls and retryable classification.

## Media path and performance

Actual path: authenticated presign → browser PUT → private S3-compatible
object → commit → media READY → listing response's mediaId/width URL → media
HTTP handler → Prisma visibility check → storage GET → browser.

Vehicle originals use `vehicles/<vehicleId>/<mediaId>/original.<ext>`; dealer
covers use slug-scoped UUID keys. Originals/private documents use signed reads
for administration. Uploaded content/size/signatures are checked for vehicle
photos; dealer yard commit currently only checks object existence. Immutable
IDs are sound, but upload URLs can be reused until expiry, so overwriting
originals must never overwrite cached generated derivatives.

**Source-confirmed problems in the current revision:**

- `DERIVATIVE_WIDTHS=[320,640,1024,1600]` and `srcsetFor()` exist, but no Sharp
  processor generates variants. READY images can have `variants={}`.
- The handler falls back to the original. A `640.webp` path may return JPEG
  original bytes with JPEG content type. The URL alone proves no resizing.
- Cards have a fixed 640 URL, no `srcset` or `sizes`. Detail thumbnails use
  the full 1600 URL. Dealer covers have no responsive selection.
- Media bytes pass through the API and a DB query for each uncached request.
- The handler advertises one-year `immutable`, despite visibility changing on
  withdrawal/suspension/deletion. This is unsafe revocation semantics.
- There is no Next image optimization pipeline/remotePatterns; these components
  use ordinary `<img>`. The hero is high-priority; cards are selectively eager.

Historical slow loading plausibly combined large originals, fixed image sizes,
uncached origin delivery, geographic network cost and lazy-load timing. These
are hypotheses about the old deployment: its exact source SHA, waterfall and
image samples have not been supplied. Do not assert S3 itself was slow.

CloudFront is justified, but it cannot reduce oversized images by itself. Use
real WebP variants, responsive selection, smaller thumbnails and caching
together. Keep originals/private documents inaccessible through the CDN.

For launch, CloudFront caches the existing **API visibility-checking media
origin**; private S3 remains behind the API. This avoids publishing unpublished
or withdrawn images through a bucket URL that bypasses the application's
visibility rule. CDN/public browser TTL is bounded at 60 seconds; no year-long
visibility cache. This is an intentional variation from direct CloudFront→S3.
OAC is appropriate for a future S3-only published-media projection, not for
this HTTPS custom origin. Do not add a permissive S3 origin as a shortcut.

## Infrastructure and deployment audit

`deploy/terraform` manages ECS/ALB/IAM/SSM/ECR/alarms but accepts externally
created VPC/subnets/certificate and does not own RDS, media bucket or CDN.
Production tfvars still contain placeholder resource IDs, oversized API
capacity (two 1-vCPU/2-GiB tasks), 90-day logging, R2 settings, and an ECS web
service although the current frontend is on Vercel. Repository OIDC trust
example uses `dealers-drive`, not actual `DealersDrive`. These are deployment
drift, not evidence of what the old account actually ran.

API Dockerfile is multistage, non-root, has readiness healthcheck, and builds
separate runner/migrator targets. The migrator carries the build workspace and
dev dependencies; runtime installs production dependencies and downloads Prisma
CLI transiently during client generation. Measure sizes before changing it.
`db:bootstrap` names a file that is absent: don't invoke it in production.
Demo seed truncates data and must never run during production deployment.

CI runs frozen install, Prisma generation, format/lint/docs/typecheck/tests/build,
Terraform format/validate, dependency audit. API integration tests use real PG16.
Release/promote pin SHA images and gate one-off migration before rollout.
The reusable deploy pipeline can skip AWS explicitly while Vercel deploys.
Existing single-box scripts run local PG/MinIO and build on the host; those
are historical/demo support, not the recommended durable production setup.

GitHub configuration inspection found environment names `dev`, `Preview`,
`Production`, with no visible deployment variables/secrets. The existing
workflow's lowercase `production` is another configuration mismatch to address.
No AWS account was inspected. Deployment must not be reported as successful
until real credentials/configuration and remote evidence exist.

## Previous cost causes and alternatives

See [cost-model.md](cost-model.md) for rates, assumptions, tables and three
traffic scenarios. The strongest fixed-cost drivers are two NAT gateways, ALB,
two always-on Fargate workloads and RDS. Tiny traffic does not turn them off.
NAT processing, LCUs, storage and egress are usage components; they cannot be
assigned the whole bill merely because NAT exists. The user's $10/3 days
annualizes to roughly $101/month, but elapsed runtime and exact counts matter.

| Architecture                             |  Idle backend estimate/month | Latency/scaling                                        | Operations/HA                                             | Migration                                  |
| ---------------------------------------- | ---------------------------: | ------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------ |
| Historical ECS, two NAT                  |                    ~$159–180 | warm; API 1–2 tasks                                    | managed compute; DB/replica HA depends on configuration   | recreate existing pattern                  |
| Optimized ECS, ARM, public tasks, no NAT |                      ~$61–75 | warm; native horizontal scaling                        | ALB+private RDS; one API initially                        | low                                        |
| EC2 API+worker, private RDS              |                      ~$38–45 | warm; vertical first, ECS/ALB next                     | host patching; automatic restart/replacement; single host | moderate infrastructure, no domain rewrite |
| EC2 ASG + ALB                            |                      ~$64–85 | warm; horizontal once health/deploy routing configured | automated host replacement; two hosts needed for HA       | moderate                                   |
| App Runner + suitable managed DB         |         ~$35–65, conditional | memory idle charge; request scaling                    | VPC egress complications; unavailable to new customers    | unsuitable new launch choice               |
| Lambda HTTP API + RDS                    | ~$20–35 plus egress solution | cold-start tail; concurrency limited by DB             | private DB+email egress complicates near-zero networking  | largest runtime adaptation                 |
| Lambda + Neon + SQS                      |    can be usage-only at zero | cold API+DB and Singapore network                      | less polling needed; external DB security/restore plan    | large relay/runtime change                 |

Ranges exclude Vercel, provider charges/tax and business usage. They are not
equal-availability comparisons. Lambda is technically compatible with Express
via an adapter, but this process starts timers/queue initialization, uses DB
sessions/counters and sync media operations. Presigned uploads avoid multipart
gateway limits, but init, shutdown, connection budgets, request limits, migrations
and outbox wakeups still need adaptation. Provisioned concurrency would buy
performance with fixed cost. This is not a free switch.

Neon is ordinary PostgreSQL with managed pooling and inexpensive storage; its
closest listed region is Singapore, not Mumbai. With continuous polling even
0.25 CU costs ~$19.35/month before storage/history, so its scale-to-zero benefit
does not apply unchanged. Supabase Pro starts at $25 with daily backups;
PITR is a separately priced capability. Aurora Serverless v2 auto-pause can
reduce compute but active connections/polling defeat that, and resume latency
is inappropriate as a hidden tradeoff. RDS micro with local API/DB traffic and
PITR is the preferred launch database. See provider links in the cost model.

## Mandatory worker decision

**Decision: KEEP PG-BOSS, with a separate worker container sharing the API's
small EC2 host.** Do not pay for a dedicated Fargate worker at launch.

| Factor                    | pg-boss on shared host                                              | SQS + Lambda                                                          |
| ------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Idle / low traffic        | $0 incremental compute if it fits existing host; DB polling remains | almost $0 queue/function; relay and DB access still required          |
| Moderate/high cost        | host/DB utilization then worker scaling                             | metered calls/duration; controlled concurrent DB connections          |
| Delivery latency          | outbox poll + queue poll, warm worker                               | relay latency + cold function; low-volume batching can delay delivery |
| Reliability               | durable DB/outbox, fix relay correctness                            | durable queue; DB→SQS dual-write needs durable relay                  |
| Retry / DLQ               | retries built in; explicitly configure dead letter/retention        | visibility/retry/DLQ configuration; partial-batch failure             |
| DB dependency/connections | both relay and recipient/delivery reads                             | still needed unless render/snapshot/dedupe moved earlier              |
| Operations/deploy         | one image, two processes; query queue+DB                            | queue+DLQ+function+IAM+relay+function packaging                       |
| Local development         | existing PG16 and tests                                             | emulator or live queue; separate event integration tests              |
| Observability             | SQL backlog/age/failures and worker heartbeat                       | AWS queue/function metrics plus relay/delivery state                  |
| Scaling / isolation       | process limits; DB+host shared; split when pressure rises           | function isolation and automatic concurrency, cap provider/DB usage   |
| Vendor lock-in            | portable PostgreSQL queue                                           | AWS message integration; application port can limit lock-in           |

At 100 emails/month, assume 512 MiB Lambda, 1 second/email and three SQS
actions/email: roughly $0.001 paid execution/request cost before free allowances.
At 10k and 100k emails, about $0.10 and $1.00 respectively, excluding retries,
poll requests, relay, logs, provider and DB. Dedicated historical worker was
~$18.93/month; shared-host worker adds no separate instance bill. **SQS is
dramatically cheaper than a dedicated worker, but not cheaper than zero
incremental host compute.** A Lambda needing private RDS and public Resend
would reintroduce NAT unless networking/payload ownership is redesigned.

No hybrid queue at launch: no second class of implemented heavy jobs justifies
it. Revisit SQS when worker activity requires a larger host, queue p95 age
exceeds 30 seconds, or provider isolation becomes necessary. A future design
uses Node 24/512 MiB, 30-second timeout, batch size 1 initially, no batching
window, visibility ≥180 seconds, 14-day retention, five receives then DLQ,
partial-batch responses and bounded concurrency matched to provider limits.
Persist event-recipient idempotency and enforce claims; replay within provider
dedupe window or manually reconcile ambiguous sends. SQS is at-least-once.

## Recommended launch architecture

```text
                       India users
                   ┌────────┴──────────┐
                   ▼                   ▼
              Vercel Pro        CloudFront media HTTPS
              Next.js           60-second visibility cache
                   │                   │ cache miss
                   ▼                   ▼
              api.dealers-drive.com (DNS → stable EIP)
                   │ HTTPS / Caddy
     Mumbai VPC    ▼
     public subnets A/B (one host active, replacement can use either)
       EC2 ARM t4g.small / ASG desired=1
         ├─ API container / loopback HTTP
         ├─ worker container / no inbound ports
         ├─ one-off migrator / deployment lock
         └─ outbound IGW; no NAT
                   │ SG reference / strict PostgreSQL TLS
                   ▼
     isolated DB subnets A/B
       RDS PG16 t4g.micro Single-AZ / PITR / deletion protection

     API + worker → private S3 Mumbai (instance IAM, no static S3 keys)
     worker → Resend; API → Google / MSG91
     SSM SecureString → runtime; CloudWatch → bounded logs + alerts
     GitHub OIDC → ECR immutable images / SSM deployment
     AWS Budget → actual + forecast thresholds
```

Two public subnets permit replacement in either AZ and future ALB without a
network rebuild. Two isolated subnets satisfy RDS subnet-group requirements
and future standby placement. No separate application-private subnets: host
inbound is TLS/ACME only, API loopback, DB restricted to host SG. Public routes
serve internet ingress/egress; DB tables have no IGW/NAT default route. No paid
interface endpoints; the free S3 gateway endpoint can reduce cross-AZ path cost.

Launch accepts brief deploy/host/AZ recovery outages. Supervision, bounded
health recovery, off-host data, immutable release pointers and migration gates
are mandatory. It is not multi-host HA. Existing ECS patterns remain a growth
path; add ALB and API replicas only when measured demand or uptime requires it.
See [scaling.md](scaling.md) for measurable triggers and cost implications.

Implementation starts only after this report/decision. Production deployment,
cost plan and performance measurements remain to be validated, not assumed.
