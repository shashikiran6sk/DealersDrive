# api / modules/health

Parent: [api](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/api/src/modules/health/health.docs.ts`

### `const READINESS: JsonSchema =`

Shared by the 200 and the 503 — the same body, a different verdict.

### `export const healthDocs: ModuleDocs =`

E2 · E3. Deliberately outside `/v1`: infrastructure probes these, not clients,
so they must not move when the API version does.

## `apps/api/src/modules/health/health.routes.ts`

### `const ROUTES: HealthRoute[] = [getLive, getReady]`

E2 · E3 — liveness and readiness.

/health/live — the process is up. Never touches a dependency, and never
fails during a graceful drain: a liveness probe that goes
red while the task is finishing its in-flight work gets the
container killed mid-drain (§20.10).
/health/ready — the process can serve _new_ traffic. 503 with the failing
check named when a dependency is down, and 503 immediately
on SIGTERM so the target group stops routing to this task
before the listener closes. Deploys gate on it (§20.3).
