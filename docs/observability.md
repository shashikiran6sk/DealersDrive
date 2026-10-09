# Grafana Cloud observability

The API exposes Prometheus-compatible OpenMetrics, ships its existing structured
Pino logs to Grafana Cloud Loki, and provisions six dashboards plus production
alert rules. Grafana Cloud hosts the metrics, logs, dashboards and alerting; this
repository does not deploy Prometheus, Loki, Grafana, or a collector.

The monitored API scope is the functionality currently mounted by the backend:
dealer directory, dealer search, dealer portfolio/details, authentication and
OAuth, dealer actions, admin actions, health, supporting media/config routes,
and their Prisma operations. There are no car-search-specific metrics,
dashboards, or alerts.

## Data flow

```text
API /internal/metrics -- HTTPS + bearer --> Grafana Cloud managed scraper --> Metrics
API Pino JSON -------- batched HTTPS ----> Grafana Cloud Loki -------------> Logs
repository JSON/YAML -------------------> Grafana Cloud dashboards + alerts
```

The managed Metrics Endpoint scraper is intentionally used instead of operating
a Prometheus or Alloy service. It scrapes every 60 seconds. The endpoint is only
enabled by deployment configuration, requires a random bearer token of at least
32 characters, and emits no application data.

Logs go to stdout (visible through `docker logs dd-api` with Docker's `json-file`
driver) while a Pino worker-thread transport batches a second copy to Loki.
Pino JSON must retain numeric `level` values: info=30, warn=40, error=50.
Pino 10.3.1 multi-target routing compares each target's numeric threshold with
the parsed JSON level; a formatter returning `level: "info"` fails that comparison
and drops the record from **both** targets. Keep Pino's default level formatter.
Main currently locks Pino 10.4.0, which resolves known string labels before this
comparison; the test-only 10.3.1 alias retains the production failure reproduction.
Numeric JSON remains the documented convention and works with both versions.
Both targets accept trace and above; the application's `LOG_LEVEL` filters
records before transport. pino-loki maps numeric severity to Loki's `level`
label (`info`, `warning`, `error`, etc.) using its built-in defaults.

Loki credentials use Basic authentication over TLS and should come from a Cloud
Access Policy token scoped only to `logs:write`. Production uses the full push
URL, including `/loki/api/v1/push`; never put credentials in the URL.

### Delivery and failure limits

pino-loki 3 batches every five seconds and retains at most 10,000 unsent records,
dropping the oldest when that buffer fills. Each push has a ten-second timeout.
HTTP 401/403/429/500, connection refusal, DNS failure, and timeout are caught by
the transport; application requests and stdout continue. Failed batches are
discarded without retry. Raw remote response bodies and exception text are
suppressed (`silenceErrors: true`) because they bypass application redaction and
can echo credentials. Monitor missing ingestion in Grafana; silence does not
establish successful delivery.

The buffer cap applies to unsent records in pino-loki, **not all logging memory**:
overlapping pushes and Pino's upstream worker queue also consume memory. The
shared worker does not implement end-to-end backpressure. Both destinations
depend on that worker, so a terminal worker failure can stop both outputs. A
generic stderr diagnostic identifies transport failure without printing its
error or options. Restart after correcting configuration. Independent main-thread
stdout and a bounded remote queue are a follow-up if stronger isolation is needed.

Closing a transport normally sends its buffered batch, but API and worker
entrypoints currently call `process.exit()` after their application drain.
Explicit exit, forced shutdown, crashes, and already in-flight pushes can lose
logs; neither `logger.flush()` nor transport readiness proves Loki receipt.
thread-stream's ten-second synchronous close deadline can also race the
ten-second Loki request timeout when explicitly closing a stalled transport.
Reliable shutdown delivery would require coordinated transport close within the
existing shutdown deadline. This fix preserves the existing lifecycle.

Redaction applies before fan-out, including session headers and known credential
fields at the root and one nesting level. It is not a recursive scrubber or a
free-text filter: do not log request/authentication payloads, customer/KYC
documents, arbitrary deeply nested objects, credentials, or sensitive messages.

## Application configuration

| Variable                     | Purpose                                           |
| ---------------------------- | ------------------------------------------------- |
| `METRICS_ENABLED`            | Mount the protected `/internal/metrics` endpoint. |
| `METRICS_SCRAPE_TOKEN`       | Random bearer token, minimum 32 characters.       |
| `DB_SLOW_OPERATION_MS`       | Slow Prisma operation threshold; default 500 ms.  |
| `GRAFANA_CLOUD_LOGS_ENABLED` | Enable the Loki transport in addition to stdout.  |
| `GRAFANA_CLOUD_LOKI_URL`     | Full Grafana Cloud Loki push URL.                 |
| `GRAFANA_CLOUD_LOKI_USER`    | Hosted Logs user/instance ID.                     |
| `GRAFANA_CLOUD_LOKI_TOKEN`   | Cloud Access Policy token scoped to `logs:write`. |

All integrations are disabled by default. When the application is deployed,
inject these values through the deployment platform's secret manager. Never put
tokens in an image, task definition, compose file, committed env file, dashboard,
or URL. Use independent credentials for each environment.

## Operations

### Verification and troubleshooting

After deployment, make a normal API request with a non-sensitive `x-trace-id`.
Check `docker logs --since 5m dd-api` for structured request completion with
numeric severity and the same `traceId`; check `docker logs --since 5m dd-worker`
for worker records when work runs. In Grafana Explore, select the hosted Loki
data source and query `{service="dealers-drive-api",environment="production"}`.
Allow at least one batching interval, then use `| json | traceId="<test-trace>"`
to correlate the request. Readiness and a live transport thread alone do not
prove delivery. `/internal/metrics` must still answer an authenticated scrape.

If output is missing, check the deployed image SHA and numeric level first.
For transport initialization failures, check the generic Docker stderr diagnostic,
packaged `pino-loki` dependency, and validated configuration. Check the push URL,
instance ID, token scope, DNS, TLS connectivity, throttling, and Grafana ingestion
status using the secret manager and provider UI. Do not dump container environment,
Parameter Store values, Authorization headers, or enable pino-loki debug output.
Temporarily disabling forwarding through the approved deployment process restores
direct Pino stdout while a worker/configuration failure is investigated.

### Post-merge rollout and rollback

1. Record the previous image tag/digest for both `dd-api` and `dd-worker`.
   Confirm the approved fix is on main and CI is green. The release workflow
   builds the API image tagged `sha-<commit>`; verify its `GIT_SHA`.
2. Deploy that immutable image through the existing production CI/CD procedure.
   The repository's release workflow builds images; its automatic development
   deploy job is currently disabled. Follow the established EC2 rollout rather
   than assuming a merge deploys production automatically.
3. Preserve existing Parameter Store secrets and observability configuration.
   Replace only API and worker containers with the corrected image; no database
   migration, infrastructure, Compose, or Grafana resource changes are needed.
4. Verify `/health/ready` and its build version, make a normal request, then check
   Docker stdout and Loki ingestion using the steps above. Verify `traceId`,
   worker output, and authenticated `/internal/metrics` collection.
5. If API or logging behavior regresses, redeploy the recorded previous image
   for both containers through the same procedure, preserving secrets. If that
   image has the original Loki issue, use the approved configuration rollback
   to set `GRAFANA_CLOUD_LOGS_ENABLED=false` and restore direct stdout. Recheck
   readiness, stdout, worker behavior, and metrics. Production validation is an
   operator's post-merge step; local/CI evidence does not establish it.

## Metric catalogue

Every series has `environment` and `service`. HTTP metrics add only the bounded
`method`, normalized `route`, and `status_code` dimensions. Prisma metrics add
generated model/operation names and a two-value outcome. Raw URLs, route values,
query strings, SQL, Prisma arguments, OAuth codes, tokens, and request bodies are
never metric labels.

| Metric                                           | What it answers                                                                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `dealers_drive_http_requests_total`              | Total count, rate, method/route breakdown, and exact HTTP statuses including 2xx, 400, 401, 403, 404, 409, 429, 500 and all 5xx. |
| `dealers_drive_http_request_duration_seconds`    | Aggregatable histogram for average and p50/p95/p99 latency.                                                                      |
| `dealers_drive_http_request_extrema_seconds`     | Rolling five-minute minimum (`quantile="0"`) and maximum (`quantile="1"`).                                                       |
| `dealers_drive_http_request_db_duration_seconds` | Total cumulative database time attributed to each request.                                                                       |
| `dealers_drive_http_request_db_operations`       | Database operation count per request.                                                                                            |
| `dealers_drive_db_operations_total`              | Prisma operation count and success/error outcome.                                                                                |
| `dealers_drive_db_operation_duration_seconds`    | Per-model/per-operation DB latency histogram.                                                                                    |
| `dealers_drive_db_errors_total`                  | Database error count.                                                                                                            |
| `dealers_drive_db_slow_operations_total`         | Operations crossing `DB_SLOW_OPERATION_MS`.                                                                                      |
| `dealers_drive_oauth_attempts_total`             | Dealer/admin OAuth success, expected failure, internal error and bounded failure reason.                                         |
| `dealers_drive_service_up`                       | Scrape heartbeat used for missing-target availability alerts.                                                                    |

Request and database duration histograms carry `trace_id` as an OpenMetrics
exemplar. It is not a time-series label, so it enables a jump from a slow sample
to the matching Loki JSON log without creating unbounded series. Every request
log also contains `traceId`; request completion and rejection/failure logs add
`method`, normalized `route`, and `status_code`. Raw URLs, path parameter values,
and query strings are deliberately not logged because OAuth callbacks, IDs, and
search URLs can carry sensitive values.

The shared logger also censors user/dealer IDs, email recipients and subjects,
deduplication keys, URLs, free-form error strings, credentials, session headers,
and cookies before either stdout or Loki receives the record. Actor identity
belongs in the existing database audit log; observability correlation uses the
non-principal `traceId`.

`dealers_drive_http_request_db_duration_seconds` is cumulative operation time.
If a handler deliberately runs database calls in parallel, it can exceed wall
clock request time; that is useful as database work attribution, not CPU time.

## Connect Grafana Cloud after deployment

No Terraform or Grafana infrastructure is included. After the API has a stable,
public HTTPS address:

1. Set `METRICS_ENABLED=true` and inject a random `METRICS_SCRAPE_TOKEN` of at
   least 32 characters into the application.
2. In the Grafana Cloud Connections console, add a **Metrics Endpoint** pointing
   to `https://<api-host>/internal/metrics`, choose Bearer authentication, and
   enter the same scrape token. Grafana Cloud performs the scrape; no Prometheus
   or collector is required.
3. Create a Cloud Access Policy token scoped only to `logs:write`. Set the Loki
   URL, hosted logs user/instance ID, token, and
   `GRAFANA_CLOUD_LOGS_ENABLED=true` in the application secret store.
4. Import the six files in `observability/grafana/dashboards` through Grafana's
   dashboard import UI and select the hosted Prometheus/Loki data sources.

For repeatable dashboard publishing, create a Grafana service account with only
folder/dashboard write permissions and run:

```bash
pnpm observability:dashboards:build

GRAFANA_URL='https://example.grafana.net' \
GRAFANA_SERVICE_ACCOUNT_TOKEN='<secret>' \
GRAFANA_PROMETHEUS_UID='<metrics-data-source-uid>' \
GRAFANA_LOKI_UID='<logs-data-source-uid>' \
pnpm observability:dashboards:publish
```

The build is deterministic and keeps the JSON files reviewable. The publishing
script creates/updates only the `Dealers Drive Observability` folder and the six
dashboards with stable UIDs. It does not configure data sources, scrape jobs,
alert destinations, or infrastructure.

The managed dashboards are:

- API Overview — traffic, status, errors, availability, percentiles and
  average/min/max response time.
- Endpoint Performance — method/route requests, status, latency and DB time.
- Database Performance — operation latency, errors, slow operations and
  request-vs-DB time.
- Authentication & OAuth — semantic OAuth results plus auth endpoint behavior.
- Dealer APIs — directory, dealer search, portfolio, dealer actions and admin
  dealer actions only.
- Errors — 4xx/5xx and database trends beside correlated Loki logs.

## Production alerts

`observability/grafana/alerts.yaml` is a Prometheus-compatible Grafana Mimir
rule file. Once metrics are flowing, validate it and load it into Grafana Cloud
Metrics with `mimirtool rules lint` and `mimirtool rules load`. Configure
`MIMIR_ADDRESS`, `MIMIR_API_USER` (the metrics instance ID), and
`MIMIR_API_KEY` (a narrowly scoped access-policy token) in the shell or CI secret
store. The rules evaluate every minute and include:

- 5xx ratio above 5% for five minutes;
- meaningful 400/409/429 ratio above 20% for ten minutes;
- p95 above one second and p99 above two seconds;
- more than five slow DB operations in five minutes;
- any sustained database operation errors;
- no API metric heartbeat for five minutes;
- readiness 503 responses;
- request traffic above three times the one-hour baseline.

The rules carry `service`, `environment`, `severity`, and `team` labels and use
the stack's existing notification policy. Route critical alerts to the on-call
contact point and warning alerts to the operations channel in that policy; the
destination is intentionally not hard-coded in application source.

Tune thresholds from observed production baselines after the first stable week.
Do not add dealer/user IDs, paths with values, search text, database statements,
or error messages as metric or Loki labels.
