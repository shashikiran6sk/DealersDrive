# Scaling and availability runbook

Launch is one warm t4g.small host (2 vCPU, 2 GiB), ASG min/desired/max **1/1/1**.
ASG replaces failed EC2 instances; it does **not** horizontally autoscale this
single-EIP/Caddy topology. Do not raise max without adding shared ingress.
Software crashes restart through Docker; repeated failed readiness restarts the
runtime once after three one-minute failures. The EC2 hardware health check
handles replacement. A dead OS/AZ can cause minutes of downtime while a new host
boots, reattaches the EIP and pulls the current release. This is the launch
availability tradeoff, not zero-downtime HA. RDS data is off-host.

| Trigger                                                                                                 | Action                                                                                                                        | Cost implication                                                                   |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| CPU >60% for 15 min, credit balance falling, or p95 API >500ms for 15 min after query/network diagnosis | profile requests and image work; upgrade host to t4g.medium if memory/CPU bursts fit; prefer ECS transition for sustained CPU | medium ~$16.35/month compute versus $8.18; EIP/EBS unchanged                       |
| Host memory >75% for 3 min, OOM, or native image decode peaks                                           | inspect container RSS/native memory, bound upload concurrency; increase host memory before more concurrency                   | medium doubles RAM; don't merely raise Node heap                                   |
| DB CPU >70% for 15 min or free RAM <100MB                                                               | inspect slow queries/indexes first, then micro→small→medium                                                                   | micro→small compute +$15.33/month; larger tier current pricing                     |
| DB connections >70, or >70% of live SHOW max_connections                                                | lower pools/max replicas; reserve 20% for maintenance; add pooler only after evidence                                         | pool caps free; RDS Proxy adds a fixed floor                                       |
| Oldest email >30sec for 3 min, DLQ/permanent failures >0, or provider rate-limit bursts                 | inspect provider/retry causes; bound sends; separate worker capacity only for healthy demand; consider SQS payload/relay ADR  | new compute or metered function cost, not CPU autoscaling copied from API          |
| Oldest unpublished outbox >60sec for 3 min or attempts≥10                                               | repair failed subscriber; replay with original event ID after reconciling delivery records                                    | no architecture upgrade for a broken subscriber                                    |
| 5xx >1% over ≥100 requests/5min (or ≥5 errors while low-volume)                                         | inspect deploy/DB/provider logs; rollback compatible code, escalate recurrent faults                                          | avoid scaling on external-provider failures                                        |
| CDN hit ratio <80% on ≥10k repeat-popular requests/day                                                  | inspect URL cardinality, TTL, status, edge Age/X-Cache, publication churn; tune only within visibility SLA                    | origin load may dominate; longer TTL needs explicit revocation/invalidation design |
| Image egress >1TiB/month or media API materially consumes CPU                                           | verify 320/640 candidates and compression; implement publication-aware S3 projection with OAC                                 | egress becomes usage cost; API/DB savings from S3 origin                           |
| Uptime requirement ≥99.9%, meaningful paid users, or host maintenance cannot interrupt service          | two API replicas across AZs, ALB, Multi-AZ RDS and rolling deployments                                                        | adds ALB/IP/replica + DB standby costs                                             |

## Growth topology

Keep Next on Vercel, PostgreSQL schema/Prisma, media domain, StoragePort and job
payloads. Reuse and correct `deploy/terraform` as the managed ECS growth stack:
ALB across existing two public subnets; ARM Fargate APIs with public IPs,
SG ingress **only from ALB SG**, no internet access to task port; isolated RDS
with DB ingress from API/worker/migrator SGs. Public outbound plus IGW removes
NAT safely. No public DB. Worker has no port mappings or ALB.

Initial growth API: .25 vCPU/.5GiB only after RSS validation, otherwise .5/1;
min/desired=2 for HA, max=4 initially. Target tracking CPU 60% and ALB requests
per target calibrated by a bounded load test (initial planning value 300/minute,
not an asserted capacity). Scale-out cooldown60sec, scale-in300sec. Memory75%
alarms inform sizing; latency errors inform investigation. Cap scale-out to the
DB budget: API5+boss3 per replica, worker3+boss3, migrator≤5, operations/admin
reserve10; at four APIs the planned ceiling is ~53 plus queue internal
connections. Query live `SHOW max_connections`; don't infer capacity from the
instance label. Launch ordinary process ceilings are 5+3+3+3=14, plus migration,
one-shot metrics and admin reserve. Dedicated listeners/maintenance require
headroom. No RDS Proxy until pooling is an observed problem.

Worker initially one replica, localConcurrency1. Queue pressure drives future
replicas (depth per worker and oldest age), **not API CPU**. Before >1 consumer,
add a durable exclusive delivery lease/advisory lock: SENT + unique event/template/
recipient and provider keys protect normal sequential replay, but concurrent
PENDING jobs/provider-timeout ambiguity need reconciliation. Resend's dedupe
window is bounded; never blindly resend an ambiguous old delivery.

If moving to SQS, preserve DB transactional outbox; add a bounded relay, render
safe immutable payloads, and keep durable delivery claims outside the queue.
Use batch1 initially, no batching window, Lambda30sec/512MiB, visibility≥180sec,
5 receives then DLQ, 14day retention, partial-batch failure responses and reserved
concurrency matched to provider/DB limits. Lambda cannot reach both private RDS
and public Resend without an egress solution; avoid reintroducing NAT through an
unexamined worker switch. Neither queue provides exactly once.

## Media growth

The launch custom CloudFront origin checks ACTIVE dealer, current cover and
ACTIVE/RESERVED listing before serving. TTL60sec bounds visibility staleness
under normal operation; already downloaded images cannot be revoked. Do not
extend cache lifetime without explicit policy. At growth, publish approved
content-hashed variants to a separate S3 prefix and revoke through lifecycle
outbox events, with OAC/deny-public policy and invalidation on withdrawal. Private
originals/documents must remain separate from that origin. Image components and
width URLs need no product rewrite; origin routing changes behind the domain.

## Database recovery / availability

Single-AZ launch has encrypted storage, automated seven-day PITR, deletion
protection and final snapshot. RPO target ~5 minutes of restorable history; RTO
planning target1–2h, verified only by restore drill. Restore a **new** RDS instance,
confirm migrations/data/session integrity, set new runtime/migration URLs, deploy
and verify writes before DNS/user reopening. Multi-AZ introduces standby failover
when business uptime requires it; it is not a backup substitute. Keep backups
through destructive migration risk windows. Snapshot after major milestones.

Retain S3 originals/version history (noncurrent versions30days); reconcile object
and DB recovery before restoring deleted listings. No cross-region DR at launch.
Recover IaC from encrypted/versioned state, config from SSM/KMS and controlled
secret escrow, application from Git SHA/ECR. Test restore before accepting an
RPO/RTO commitment. Enable RDS storage growth alerts before the100GiB cap.
