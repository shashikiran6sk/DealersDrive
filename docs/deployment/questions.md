# Concrete architecture answers

1. **Compute choice:** shared warm ARM EC2 avoids ALB/NAT/separate worker floors
   while preserving current Express/timers and Mumbai DB latency; host operations
   and single-node outages are explicitly accepted at launch.
2. **Idle compute:** t4g.small ~$8.18 +20GiB disk$1.82 +EIP$3.65/month.
3. **Autoscaling:** launch ASG1/1/1 provides replacement, not horizontal scaling.
   Docker/supervisor restarts crashes. Growth adds ALB/ECS min2/max4, CPU60%
   and calibrated requests/target with DB connection ceilings.
4. **NAT needed?** No.
5. **Why pay for NAT?** Nothing in launch requires private compute egress.
6. **Safe elimination:** public host only80/443, API loopback, worker no ports,
   DB private SG reference. IGW gives outbound; S3 gateway endpoint free.
7. **Subnets:** publicA/B for alternative replacement AZs/future ALB; DB A/B
   isolated for RDS subnet group/future standby. Public default routeIGW; DB
   local routes only. No application-private or NAT subnets.
8. **PostgreSQL:** RDS PG16 micro for Mumbai latency, ordinary Prisma support,
   seven-day PITR and controlled networking; no self-hosted durable state.
9. **Connections:** Prisma5 API/3worker and boss3each, metrics ephemeral,
   migration≤5 plus admin reserve; compare live SHOW max_connections. StrictTLS.
10. **DB scaling:** optimize queries, micro→small/larger, Multi-AZ on uptime
    trigger, pooler only for connection pressure, replicas only for read demand.
11. **Queue choice:** pg-boss preserves durable outbox+DB delivery state; only
    one active consumer and no heavy/scheduled implemented jobs justify SQS now.
12. **Worker container:** already fits required API host, warm polling, same image;
    Lambda would still need relay/render/dedupe/DB connectivity and egress design.
13. **Worker idle:** $0 incremental instance charge while host capacity fits,
    with real DB polling/memory overhead; former separate Fargate ~$18.93/month.
14. **Spikes:** queued durable work, concurrency1 and retries; age/depth alarms;
    split/scale worker or migrate suitable jobs when measured demand justifies it.
15. **Delivery failures:** bounded10sec request; 408/429/5xx transient retry,
    retry5 exponential30sec; permanent failures recorded; exhaustion DLQ14days.
    SENT/event-recipient/provider keys suppress ordinary duplicates, with manual
    reconciliation for ambiguous sends outside provider's dedupe window.
16. **Slow images:** current source lacked real variants, fixed card candidates,
    oversized thumbnails and per-image API/DB origin work. Historical exact
    waterfall unavailable; absence of CDN alone doesn't prove S3 was slow.
17. **CloudFront:** caches public authorized WebP responses at India edges,
    reducing repeated origin latency/work; resizing fixes oversized transfer.
18. **Variants:** real320/640/1024/1600 WebP generated before READY; content hash,
    pixel limit40million, serialized decoding, metadata stripped, browser srcset.
19. **Caching:** private content-keyed derivative objects, originalsno-store;
    publicURL max-age60/s-maxage60/must-revalidate; CDNmax60, no private route cache.
20. **Zero-traffic cost:** ~$38–45 AWS/month, ~$58–65 with one Vercel Pro seat,
    providers/tax/domain and future usage additional.
21. **Largest floors:** durable RDS$18, warm host/disk/EIP$14, bounded monitoring.
22. **Growth spend:** DB/compute capacity and media bandwidth, request/log volume;
    ALB/replicas/Multi-AZ only when measurable workload or uptime needs them.
23. **Compute crash:** Docker restart; repeated readiness failure bounded restart;
    ASG replacement for EC2 failure, EIP reattachment, release pointer redeploy.
24. **DB outage:** readiness503, requests fail safely, outbox/queue remain durable;
    retries and alerts; Single-AZ repair/PITR versus future standby failover.
25. **Email outage:** requests/business commits independent, durable jobs backoff,
    failures/age alarms, DLQ/reconciliation; provider outage doesn't fail API health.
26. **Migrations:** serialized host deploy lock, one-off schema-owner container,
    visible logs, exit status gate, never migrations in every API replica.
27. **Rollback:** previous SHA images + desired pointer restored; no downgrade
    migrations; schema compatibility mandatory, otherwise forward fix/PITR review.
28. **Healthy release:** readiness DB/cache checks and exact image SHA, public
    HTTPS smoke test, dashboard/queue metrics; full business/provider/CDN checks
    required before claiming production validation.
