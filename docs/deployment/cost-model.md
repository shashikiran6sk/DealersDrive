# Cost model

USD/month, 730 hours, Mumbai, on-demand Linux/ARM where specified, no tax,
credits, reserved commitments or speculative startup credits. Public AWS
regional catalog snapshots published September–October 2026 were checked on
2026-10-03. This is an independent resource model, **not an account bill audit**.

## Previous deployment

| Resource                                    |                  Qty | Runs when idle?                             |       Approx monthly idle cost | Necessary at launch?                             |
| ------------------------------------------- | -------------------: | ------------------------------------------- | -----------------------------: | ------------------------------------------------ |
| NAT gateway                                 |                    2 | yes, fixed $0.056/hour each                 |                         $81.76 | no                                               |
| NAT processing                              |                usage | no, $0.056/GB                               |               $0 at zero bytes | no                                               |
| ALB hours                                   |                    1 | yes, $0.0239/hour                           |                         $17.45 | no                                               |
| ALB LCUs                                    |                usage | usage, $0.008/LCU-hour                      |       near $0 at zero requests | only with ALB                                    |
| Public IPv4                                 |           at least 4 | yes, $0.005/address-hour                    |                         $14.60 | one EIP for launch                               |
| Fargate API, x86 .5 CPU / 1 GiB             |                    1 | yes                                         |                         $18.93 | API compute needed; this size/platform optional  |
| Fargate worker, same size                   |                    1 | yes                                         |                         $18.93 | processing needed; dedicated compute unnecessary |
| RDS PG micro + 20 GiB gp3                   |                    1 | yes                                         |                         $17.95 | durable DB needed                                |
| RDS PG small instead                        |                    1 | yes                                         |                         $33.28 | only if measured memory/CPU requires it          |
| CloudWatch logs/metrics/alarms              |         usage/config | logs usage; metrics/alarms fixed            |                $0–10 allowance | basic monitoring needed                          |
| ECR                                         |            stored GB | retained image storage                      |                ~$0.10/GB-month | yes                                              |
| S3                                          | stored GB + requests | storage fixed to retained bytes             |           $0.025/GB + requests | yes                                              |
| Data transfer                               |                usage | no                                          |               $0 at zero bytes | yes when used                                    |
| Route 53                                    |      1 existing zone | yes, zone charge                            |           ~$0.50 + query usage | DNS needed; no second zone                       |
| Standard SSM parameters                     |               3–many | no per-parameter fee within standard limits |                    $0 baseline | yes                                              |
| Secrets Manager                             |           if present | yes per secret                              |   ~$0.40/secret + API requests | one RDS managed master secret justified          |
| Migrator                                    |              one-off | no                                          | seconds/minutes per deployment | yes                                              |
| IGW, VPC, subnets, SGs, S3 gateway endpoint |              several | no resource hourly fee                      |                             $0 | selected subset                                  |

Minimum modeled historical baseline is **~$170/month** with two continuously
running NATs and micro RDS, before retained logs/storage. A small RDS moves it
above $185. That would accrue ~$17 over three full days, not precisely the
reported $10. Different active durations, one NAT, credits, RDS size, or incomplete
billing aggregation can explain the difference. The supplied history proves
functionality; it does not prove continuously billed quantities. Do not invent
invoice attribution. NAT hours dominate before any NAT data processing.

Rates: [EC2/NAT/EBS catalog](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/ap-south-1/index.json),
[Fargate catalog](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonECS/current/ap-south-1/index.json),
[RDS catalog](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRDS/current/ap-south-1/index.json),
[ALB catalog](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSELB/current/ap-south-1/index.json),
[IPv4 catalog](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonVPC/current/ap-south-1/index.json),
[S3 catalog](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/ap-south-1/index.json).
Catalog URLs are live; recalculate before purchasing.

## Launch floor

| Component                                                      | Monthly estimate | Type                                       |
| -------------------------------------------------------------- | ---------------: | ------------------------------------------ |
| t4g.small, 2 GiB, API + worker + Caddy                         |            $8.18 | fixed                                      |
| 20 GiB EBS gp3                                                 |            $1.82 | fixed                                      |
| One EIP                                                        |            $3.65 | fixed                                      |
| RDS t4g.micro, Single-AZ                                       |           $15.33 | fixed                                      |
| RDS 20 GiB gp3                                                 |            $2.62 | fixed                                      |
| Managed master secret                                          |           ~$0.40 | fixed + calls                              |
| DNS existing hosted zone                                       |           ~$0.50 | fixed + queries                            |
| Logs, custom metrics, 12 alarms, dashboard                     |             $3–8 | bounded configuration + usage              |
| ECR retained layers                                            |          $0.20–2 | retained bytes                             |
| S3, CDN, transfer at essentially zero traffic                  |             $0–1 | usage/retained bytes                       |
| Standard SSM, ASG control plane, Budget alerts, SNS low-volume |              ~$0 | configuration/usage                        |
| **AWS launch total**                                           |      **~$38–45** | mostly durable DB + warm host              |
| Vercel Pro, one seat                                           |  **$20 + usage** | separate frontend business cost            |
| **Application hosting floor**                                  |      **~$58–65** | excludes providers/domain registration/tax |

The $50 AWS budget alerts at $25/$40/$50 and forecast >$50. It monitors the
whole account so untagged resources cannot hide costs. It does not cap spend.
Confirm SNS subscriptions; budgets are not instant circuit breakers.

CloudWatch estimates include eight host/queue metrics plus two log-derived
metrics, alarms and one dashboard; shared free allowances may lower the bill.
Never use dealer IDs/request IDs as metric dimensions. Logs retain 14 days.
ECR retains 30 versions per repository; a large migrator history can exceed the
allowance. CPU credits use standard mode to bound cost, so sustained CPU requires
scaling rather than unlimited surplus charges. [CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/),
[ECR pricing](https://aws.amazon.com/ecr/pricing/), [Budget pricing](https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/).

## Traffic scenarios

Counts alone do not price browsing. Model A: <1k API requests, <1 GiB delivery,
<1 GiB stored media, <100 emails/month. B: 1m API requests, 5m image requests,
500 GiB delivery, 50 GiB media, 10k emails/month. C: 10m API requests, 30m image
requests, 5 TiB delivery, 500 GiB media, 100k emails/month. A count of registered
customers is not a concurrency estimate. Measure before resizing.

| Component                         |    Launch A |                  Early traction B |                                      Growth C |
| --------------------------------- | ----------: | --------------------------------: | --------------------------------------------: |
| Compute                           |          $8 | $16–32 (small/medium as measured) |                   $80–160 (replicas + worker) |
| Database/storage                  |         $18 |                            $33–70 |                    $150–350 (larger/Multi-AZ) |
| Network/EBS/IPv4/load balancer    |          $6 |                             $6–15 |           $35–60 (ALB + public tasks, no NAT) |
| Queue + additional worker compute |    included |                          included |          $0–25 depending on worker/SQS choice |
| Lambda                            |          $0 |                                $0 | ~$1 if email migrated; payload/relay excluded |
| CDN                               |         ~$0 |  ~$0 within shared PAYG allowance |                 ~$446 + requests, India-heavy |
| S3                                |         ~$0 |                               ~$2 |                                       ~$15–25 |
| Logs/alarms/registry/secrets/DNS  |       $6–13 |                             $8–20 |                                        $20–50 |
| **AWS total**                     |  **$38–45** |                       **$65–140** |                                **$747–1,217** |
| Frontend                          | $20 + usage |                       $20 + usage |              $20 + potentially material usage |

CloudFront PAYG includes 1 TiB and 10m requests monthly, shared across an account.
India's next bandwidth tier is $0.109/GB; AWS origin transfer to CloudFront is
free. Do not assume dedicated unused account allowances for every distribution.
At 5 TiB, 4 TiB paid × $0.109 ≈ $446. Requests beyond the allowance add regional
HTTPS fees. Verify current eligibility and tiers. Compression does little for
already compressed WebP; variant sizing reduces the main bandwidth cost.
[CloudFront PAYG](https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/).

Direct S3 saves no fixed CDN bill at launch, loses edge hits, and charges S3 GET
and internet egress on each retrieval. CloudFront caches visibility for 60 seconds;
actual hit ratio depends on bursts and popularity. A 90% hit ratio means 500k
origin image requests for scenario B; don't assume 90% if each image is seen
once. At growth, a publication-aware S3 projection can remove media DB/API work.

## Alternatives across the same demand assumptions

All include a practical DB/network/log baseline; CDN/S3 B ~$2 and C ~$470 are
common additions. Vercel/provider costs excluded. Broad capacity ranges reflect
measured memory/CPU and HA choices, not invented users-to-vCPU ratios.

| Architecture                         |                          A backend | B backend + media |                  C backend + media | Main cost constraint                                 |
| ------------------------------------ | ---------------------------------: | ----------------: | ---------------------------------: | ---------------------------------------------------- |
| Historical ECS / 2 NAT               |                           $170–190 |          $200–290 |                         $800–1,450 | NAT + ALB + worker floor                             |
| Optimized ARM Fargate / public tasks |                             $61–75 |           $90–160 |                         $750–1,250 | ALB/IP + DB; ARM .25/.5 costs ~$5.30/task            |
| Shared EC2 / private RDS             |                             $38–45 |           $65–140 | $750–1,220 after growth transition | one-host limits, then replicas                       |
| EC2 ASG / ALB                        |                             $64–85 |           $90–175 |                         $750–1,250 | ALB floor; patch/rollout management                  |
| App Runner                           |                 $35–65 conditional |           $70–180 |                 workload dependent | unavailable to new AWS customers since Apr 30, 2026  |
| Lambda HTTP API / RDS                | $20–35 plus internet egress design |           $90–230 |                         $750–1,400 | invocation duration, DB pooling and concurrency      |
| Lambda / Neon / SQS                  |      low usage floor after rewrite |           $60–200 |                         $700–1,400 | cold start, Singapore DB, durable relay/backup costs |

App Runner's historical memory idle rate does not make pg-boss polling a suitable
worker. A VPC connector also changes outbound internet routing. [AWS App Runner](https://aws.amazon.com/apprunner/).
Neon region list has Singapore but no Mumbai; 24/7 0.25 CU polling at $0.106/CU-hour
is ~$19.35 before storage/history. Supabase Pro is $25, PITR extra. Aurora
Serverless auto-pause requires no continuously active clients; don't apply
scale-to-zero pricing to this worker unchanged.
[Neon regions](https://raw.githubusercontent.com/neondatabase/website/main/content/docs/introduction/regions.md),
[Neon plans](https://raw.githubusercontent.com/neondatabase/website/main/content/docs/introduction/plans.md),
[Supabase pricing](https://supabase.com/pricing), [Supabase backups](https://supabase.com/docs/guides/platform/backups).
Vercel Hobby restricts commercial use; use Pro for this business.
[Vercel Hobby](https://vercel.com/docs/plans/hobby), [Vercel Pro](https://vercel.com/docs/plans/pro-plan).

Email SQS/Lambda cost is far below a dedicated $18.93 Fargate worker, but does
not eliminate the transactional relay or DB reads in current templates. For
100/10k/100k emails, 512 MiB and 1 second/email plus three SQS actions/email cost
approximately $0.001/$0.10/$1 before free allowances, retries, polling and logs.
The shared worker has $0 additional instance cost while it fits the host.
[Lambda pricing](https://aws.amazon.com/lambda/pricing/), [SQS pricing](https://aws.amazon.com/sqs/pricing/).
