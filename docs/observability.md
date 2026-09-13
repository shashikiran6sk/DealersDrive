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

Logs still go to stdout (and therefore the existing CloudWatch log groups) while
a Pino worker-thread transport batches a second copy to Loki. The buffer is
bounded at 10,000 entries so an ingestion outage cannot consume unbounded API
memory. Loki credentials use Basic authentication over TLS and should come from
a Cloud Access Policy token scoped only to `logs:write`.

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
