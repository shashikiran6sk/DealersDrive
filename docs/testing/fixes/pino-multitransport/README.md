# Pino multitransport incident — PR #290

Product: [PR #290](https://github.com/shashikiran6sk/DealersDrive/pull/290),
branch `fix/production-pino-multitransport-logging`, commit
`96e799020855ea53ee48cdb4510b46734b68e9ac`, based on main `5ce6df5`.
This folder is evidence only on `testing_evidence`; it is never merged or deployed.

## Root cause and regression proof

Pino 10.3.1 `lib/worker.js` receives parsed metadata from
`pino-abstract-transport` and assigns `lastLevel` to its multistream. In
`lib/multistream.js`, `dest.level <= level` compares the numeric target threshold
with that value. The application formatter returned a string, so e.g.
`30 <= 'info'` is false (numeric coercion yields NaN). Routing stops before either
the stdout or Loki target receives the line; worker readiness still succeeds.

Main now locks Pino 10.4.0, whose multistream resolves known string labels, but
the application still serialized string severity. The test-only
`pino-production-repro` alias pins the exact incident version 10.3.1 without
changing production dependencies. The real multi-target reproduction writes
zero records with the old formatter and numeric JSON with the default formatter.
Actual application configuration is also exercised under both versions; the
fixture's synchronous Node 24 resolve hook selects the pinned version for that
one child process. No Pino/HTTP transport mocks are used.

`baseline-regression.txt` runs the new numeric-level assertions against the
unchanged main logger in a separate worktree: **2 fail, 21 pass**, as expected.
`logger-regressions.txt` runs the corrected implementation: **38 pass**, including
15 runtime cases. Both were executed using Node 24 and the repository's pnpm
9.15.9. The permanent reproduction and regressions are in the product PR.

## Local validation

| Check                                            | Result                                  | Evidence                         |
| ------------------------------------------------ | --------------------------------------- | -------------------------------- |
| `pnpm lint` including formatting/docs references | PASS                                    | `lint.txt`                       |
| `pnpm typecheck`                                 | PASS, all workspaces                    | `typecheck.txt`                  |
| Logger unit + real runtime suite                 | PASS, 38 tests                          | `logger-regressions.txt`         |
| `pnpm test` with isolated PostgreSQL             | PASS, 4,943 tests                       | `full-suite.txt`                 |
| Production build                                 | PASS with environment proxy passthrough | `build-with-proxy.txt`           |
| Docker logger/middleware under production config | PASS, Loki on/off                       | `docker-logger-runtime.txt`      |
| Docker actual compiled API + worker entrypoints  | PASS with local adapters                | `docker-application-runtime.txt` |

The full local suite started before the last two runtime cases were added; it
includes API 3,028 / 152 files, web 1,488 / 125 files, contracts 427 / 15 files.
The final 38-test logger run includes both new cases and the controlled
connection-refusal correction. CI tests the complete final commit independently.
API coverage passed the 90% gate: statements 96.01%, branches 90.50%, functions
97.84%, lines 97.05%. The existing container/queue and telemetry suites passed.

The default build initially failed fetching Google Fonts because Turbo's strict
environment filtering removed proxy variables (`build-proxy-filtered-failure.txt`).
`TURBO_ENV_MODE=loose NEXT_TELEMETRY_DISABLED=1 pnpm build` preserved the provided
proxy/CA settings and passed. No font, build, network policy, or infrastructure
code was changed to obtain that result.

## Runtime evidence and boundaries

All receivers were loopback or an internal Docker network. All credentials are
explicit test placeholders. Child processes use empty temporary working
directories to prevent dotenv from reading a developer/production `.env`.
The ordinary test environment now explicitly disables/clears Grafana forwarding.
No production endpoint, secret store, EC2 host, Grafana resource, or customer
record was accessed.

The production-configured fixture imports the actual logger, request context,
request logger, request metrics and metrics router; real HTTP routes cover
200/404/500, normalized paths, traceId, response/DB measurements and authenticated
metrics. Local receivers verify the exact Basic authentication and push path,
numeric JSON, Loki severity labels, batching and stdout/remote record equality.
Tests exercise 401/403/429/500, connection refusal, DNS failure, the ten-second
request timeout, a full buffer dropping oldest records, pending-batch close and
terminal worker failure. Existing known-field redaction and serialized-error
suppression are checked in both destination copies.

Docker uses Node 24 and the compiled production application code, read-only
dependency/build mounts, no source `.env` mount, and `json-file` logging. The
first Docker probe runs the production-configured logger/middleware fixture:
seven stdout records in each mode and seven authenticated receiver records with
forwarding enabled. The additional probe runs actual `dist/index.js` and
`dist/worker.js` against a separately migrated `pino_logger_runtime` database.
Its storage/mail/OTP/cache use local test adapters and NODE_ENV=test so startup
does not need cloud services; logging and metrics use their actual configuration.
It verifies readiness, `/v1/config/public`, a 404, authenticated `/internal/metrics`,
seven API stdout records in each mode, actual worker boot/drain output, and
receiver records for the normal route and `dealers-drive worker started`.
This is an equivalent isolated runtime check, **not a build of the production
Dockerfile image**. Shell probes and the test-only env/receiver are retained here
for review; their `/workspace/DealersDrive` paths name the verification workspace.

## Delivery and security limits

HTTP/network failures are caught by pino-loki and do not block stdout or API
requests. Raw upstream errors/response bodies are suppressed because they bypass
Pino redaction; a terminal transport error produces a generic stderr message.
Failed batches are discarded without retry. The 10,000-record limit bounds the
unsent pino-loki buffer, not total memory or Pino's upstream worker queue.
The shared worker remains a common failure point: its termination leaves HTTP
available but can stop both outputs. Explicit process exit and shutdown can lose
buffered/in-flight records, and thread-stream's ten-second close deadline can
race the Loki request timeout. Stronger destination isolation and coordinated
shutdown are follow-ups documented in the product observability guide.

Known-field redaction is preserved at the root/one nesting level; it is not a
recursive sanitizer or free-text filter. Sensitive request/authentication/KYC/
customer payloads and deeper uncontrolled objects must not be logged.
Production rollout and validation remain unperformed. The operator checklist in
`docs/observability.md` covers immutable image identity, preserving Parameter Store
secrets, API/worker-only rollout, readiness, stdout/Loki/traceId/metrics and rollback.

## CI

All five workflow jobs passed on the final product commit: repository
lint/typecheck/test/build, dependency audit, Terraform formatting/validation,
Semgrep, and Gitleaks. The additional Vercel status also passed.
[CI #530](https://github.com/shashikiran6sk/DealersDrive/actions/runs/37969983818)
and [Security #730](https://github.com/shashikiran6sk/DealersDrive/actions/runs/37969983777)
completed successfully. Final results are in `ci-results.json`; the full CI
verification log is in `ci-verify-log.txt`. The product PR remains open and
unmerged.
