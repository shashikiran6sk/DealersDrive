# Day 19 — Docker images and the CI/CD pipeline

> **Track:** Week 4 · The surface, and running it
> **Time:** ~4 hours · **Prerequisite:** Day 18
> **Goal in one sentence:** describe exactly what happens between merging a pull
> request and the change being live in production.

---

## 1. Why today matters

Everything you have learned so far is about code. Today is about **the machinery
that moves it**, and one idea underpins all of it:

> **The artifact you test is the artifact you ship.**

One image, built once, tagged with the commit SHA, promoted. Production never
rebuilds — a rebuild would be different bytes from the ones dev has been running,
and then "we tested it on dev" means nothing.

Everything else — immutable ECR tags, `GIT_SHA` in the health response, the
smoke test that checks _which build is serving_ — exists to make that claim
verifiable rather than aspirational.

---

## 2. Read first

| Source                        | Sections                                                                                       | ~min |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | ---- |
| `docs/ENGINEER-ONBOARDING.md` | **Part 31** — all of it (31.1 → 31.8)                                                          | 55   |
| `docs/ENGINEER-ONBOARDING.md` | **Part 23** — §23.1 → §23.6                                                                    | 35   |
| `docs/ENGINEER-ONBOARDING.md` | **Part 34-E2, E3, E4, E6** — image, container, orchestration, health checks, graceful shutdown | 20   |
| `docs/DEPLOYMENT.md`          | §E (CI/CD) and §J (deployment workflow)                                                        | 20   |

---

## 3. Open these files, in this order

| #   | File                                           | What to look for                                                                                             |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | `apps/api/Dockerfile`                          | Four stages: `base`, `deps`, `build`, `runner` — plus `migrator`. Read every comment. Note `USER node`       |
| 2   | `apps/api/Dockerfile`                          | The `migrator` stage specifically. **Dev dependencies kept**, because `prisma` and `tsx` are devDependencies |
| 3   | `apps/web/Dockerfile`                          | The long comment about building with **nothing running**. That is a requirement, not a convenience           |
| 4   | `.github/workflows/ci.yml`                     | Three jobs. **No credentials anywhere** — a fork PR can run it in full                                       |
| 5   | `.github/workflows/security.yml`               | Semgrep and gitleaks. Note the weekly cron and the reason CodeQL was replaced                                |
| 6   | `.github/workflows/release.yml`                | On push to `main`. Builds three images, pushes to ECR, deploys **dev only**                                  |
| 7   | `.github/workflows/_deploy.yml`                | **The core file.** Reusable, identical for both environments, and it never builds an image                   |
| 8   | `.github/workflows/promote.yml`                | The manual trigger, the preflight, and the rollback switch                                                   |
| 9   | `scripts/smoke.sh`                             | Nine checks against the public URLs. Read the header comment on why it is read-only                          |
| 10  | `apps/api/src/modules/health/health.routes.ts` | `/health/live` vs `/health/ready`, and `version: env.GIT_SHA`                                                |
| 11  | `apps/api/src/index.ts`                        | The `SIGTERM` handler. Now read it properly — `forceExit.unref()` included                                   |

---

## 4. Do

### 4.1 Build the real images locally

```bash
docker build -f apps/api/Dockerfile --target runner  -t dd-api:local .
docker build -f apps/api/Dockerfile --target migrator -t dd-migrator:local .
docker build -f apps/web/Dockerfile --target runner  -t dd-web:local .
```

Note the trailing `.` — **the build context is the repository root**, because
both apps import `@dealers-drive/contracts` from a sibling workspace.

```bash
docker images | grep dd-
```

Then prove the dependency filtering worked:

```bash
docker run --rm dd-api:local sh -c \
  "ls node_modules | grep -i react || echo 'no react in this image'"
```

### 4.2 Prove the web image builds with nothing running

```bash
pnpm infra:down          # no database, no API
docker build -f apps/web/Dockerfile --target runner -t dd-web:test .
```

It succeeds. **If it did not, one image could not be promoted from dev to
production** — the build would have baked in whichever environment the build
machine could reach, including `robots.txt`. That is the same rule that bans
`NEXT_PUBLIC_*` (Day 16).

```bash
pnpm infra:up
```

### 4.3 Watch layer caching

```bash
docker build -f apps/api/Dockerfile --target runner -t dd-api:local .     # ~fast, cached
# now edit a .ts file
touch apps/api/src/server.ts
docker build -f apps/api/Dockerfile --target runner -t dd-api:local .
```

The `deps` layer is **not** re-run — only manifests were copied before
`pnpm install`. Now touch `apps/api/package.json` and rebuild: `pnpm install`
runs again. That is Day 2 §30.6, observed.

### 4.4 Run the whole thing as production images

```bash
pnpm app:up
```

`scripts/app-up.sh` builds the real images, runs the migrator to completion, then
starts everything in Docker. This is the closest local approximation to what runs
on AWS.

```bash
docker compose --profile app ps
curl -s http://localhost:4000/health/ready | jq
```

Note `version` — the `GIT_SHA` build argument. **That field is how a deploy tells
"the new image is serving" from "the old image is still serving and answering
exactly as well" — both are 200s.**

### 4.5 Run the smoke test locally

```bash
./scripts/smoke.sh http://localhost:3000 http://localhost:4000
```

Read what it checks (Part 31.5's table). Note especially:

- it verifies **the running build's SHA** matches the deployed one
- it checks `robots.txt` against `APP_ENV` — the check that would have caught a
  production image shipping `Disallow: /`
- it is **read-only**: signs nobody in, writes no row. A smoke test that mutates
  production is one nobody dares run when they most need it

### 4.6 Prove graceful shutdown

```bash
docker compose --profile app stop api
```

Watch the logs: `shutting down` → in-flight requests drain → `shutdown complete`.
Read `index.ts` again and answer:

- Why is there a 10-second `forceExit` timer?
- What does `forceExit.unref()` prevent? (An un-unref'd timer keeps the Node
  event loop alive for its full duration, so a process that finished cleanly in
  200 ms would still sit there for ten seconds.)

Without this, every request in flight when ECS sends `SIGTERM` is a connection
reset in a dealer's browser — during a "zero downtime" deploy.

### 4.7 Walk the three moments on paper

Write out, from memory, then check against Part 31:

**Moment 1 — I open a PR.** Which workflows run? What credentials do they hold?
What are the five required checks?

**Moment 2 — I merge.** Which workflow fires? What does it build? Where does it
push? Which environment does it deploy? Which does it _not_?

**Moment 3 — someone promotes.** What does preflight check before a human is
asked to approve? Where is the approval gate actually configured? What is
`skip_dev_check` for, and why is it not the default?

### 4.8 Find the security discipline in `_deploy.yml`

```bash
grep -n -B3 "run: |" .github/workflows/_deploy.yml | head -40
```

Every `${{ }}` is bound to an **environment variable** and read as `$VAR` by the
shell. Read the comment:

> `$SHA` is data; `${{ inputs.sha }}` inside a script is code.

`inputs.sha` and `inputs.reason` arrive from a `workflow_dispatch` form — strings
a human typed. A string interpolated directly into a `run:` block is **executed
by the runner**. This is a real GitHub Actions vulnerability class, not a style
preference.

### 4.9 Understand the four reliability mechanisms

People conflate these. Separate them (§23.5):

| Mechanism                      | Configured where | Catches |
| ------------------------------ | ---------------- | ------- |
| Container `HEALTHCHECK`        |                  |         |
| ALB target group health check  |                  |         |
| ECS deployment circuit breaker |                  |         |
| `minimumHealthyPercent=100`    |                  |         |

Fill it in, then note the deliberate asymmetry: the API is checked on
`/health/ready` (which touches the database); the **web app** is checked on
`/api/health` (which touches nothing). Why? — so an API incident does not pull
the front end out of rotation and leave nothing to serve an error page.

---

## 5. Prove you understood it — Week 4 checkpoint (part 1)

> **Say this out loud, to another person, without notes:**
> _"I merged a PR. Describe everything that happens until the change is live in
> production — and what would happen if it were bad."_

Supporting questions:

1. Why does production never rebuild the image? → _§31.1, §31.6_
2. Why are ECR tags immutable, and why is nothing tagged `latest`? → _§31.4_
3. What does `GIT_SHA` configure? (Trick question.) → _§23.3_
4. Why must the web image build with nothing running? → _§23.3_
5. Why does the migrator stage keep dev dependencies? → _§23.3_
6. Why do migrations run **before** the new tasks take traffic, and what makes
   that safe? → _§31.5, §32.5_
7. Why API before web? → _§31.5_
8. What does the smoke test check that a health check cannot? → _§31.5_
9. Where is the production approval gate configured, and what does it also
   control? → _§31.6_
10. Name the four reliability mechanisms and what each catches. → _§23.5_
11. Why is every `${{ }}` bound to an env var first? → _§31.5_

---

## 6. Traps

- **`latest` cannot be rolled back to.** Immutable SHA tags are the entire
  rollback story.
- **A failed migration means nothing was deployed.** The workflow says so
  explicitly — the running version is untouched. That ordering is deliberate.
- **`secrets: inherit` is deliberately absent.** The called workflow declares
  `environment:` and reads that environment's own secrets. Inheriting would hand
  every repository secret to it for no benefit.
- **The rollback for a database is not a rollback.** Day 20.

---

## 7. Deliverable

- [ ] I built all three images locally and confirmed the API image has no React
- [ ] I built the web image with the database and API stopped
- [ ] I observed Docker layer caching hit and miss deliberately
- [ ] I ran the full stack with `pnpm app:up` and read `version` from `/health/ready`
- [ ] I ran `scripts/smoke.sh` locally and read every check
- [ ] I watched graceful shutdown and can explain `forceExit.unref()`
- [ ] I wrote out all three CI/CD moments from memory and checked them
- [ ] I filled in the four-reliability-mechanisms table
- [ ] **I answered the Week 4 checkpoint question out loud**

---

## 8. Going deeper (optional)

- Read `deploy/aws/README.md` end to end. It is how dev and production were
  actually stood up — thirteen sections, every command, every decision explained.
- Read [GitHub — Security hardening for Actions](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions),
  specifically the script-injection section. Then re-read `_deploy.yml` and see
  the discipline applied line by line.
