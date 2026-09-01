# Dealers-Drive

A B2B2C used-car marketplace for Tamil Nadu. Independent dealers list inventory;
buyers browse publicly without an account. Only dealers and platform admins
authenticate.

|                     |                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Specs**           | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/API-SPEC.md`](docs/API-SPEC.md) · [`docs/DESIGN-SPEC.md`](docs/DESIGN-SPEC.md) |
| **Engineering log** | [`CONTEXT.md`](CONTEXT.md) — read this before changing `apps/api`                                                                      |
| **API reference**   | http://localhost:4000/api/docs once running                                                                                            |
| **Postman**         | [`docs/postman/`](docs/postman) — import the collection + environment and run the whole API                                            |
| **Deployment**      | [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — local → dev → production, the pipeline, and what it costs                                 |

## Layout

```
apps/
  web/        Next.js 15 · App Router · TypeScript strict · Tailwind v4
  api/        Express 5 · TypeScript strict · modular monolith
packages/
  contracts/  Zod schemas shared by both apps — the source of truth for every wire shape
  config/     shared eslint + tsconfig presets
```

## Requirements

|                            |            Manual            | Docker |   Docker Compose    |
| -------------------------- | :--------------------------: | :----: | :-----------------: |
| Node 22 (`nvm use`)        |              ✓               |   —    |          —          |
| pnpm 9 (`corepack enable`) |              ✓               |   —    |          —          |
| Docker Engine 24+          | ✓ (Postgres, MinIO, Mailpit) |   ✓    | ✓ (with Compose v2) |

Three ways to run this, in increasing order of "nothing on my machine but Docker":

1. [**Manually**](#1-manually) — apps on the host, backing services in Docker. The
   development loop: hot reload, `pnpm test`, Prisma Studio.
2. [**With Docker**](#2-with-docker) — build the two images and run the containers
   yourself. Useful for understanding what Compose is doing for you.
3. [**With Docker Compose**](#3-with-docker-compose) — `pnpm app:up` for the
   whole product. Use this if you just want to see it work.

All three end up at the same place: http://localhost:3000, with the API on
http://localhost:4000 and Swagger on http://localhost:4000/api/docs.

---

## 1. Manually

Backing services in Docker, both apps on the host with hot reload.

```bash
corepack enable
pnpm install
cp .env.example .env      # the defaults work for local development as-is
docker compose up -d      # postgres, minio, mailpit — the apps are NOT started

cd apps/api
pnpm db:migrate           # apply the migrations
pnpm db:seed              # build the world: 5 dealers, 23 vehicles, 18 live listings
cd ../..

pnpm dev                  # web + api together
```

`docker compose up -d` starts only the three backing services. The API and web
containers live behind a Compose _profile_, so this command means exactly what
it has always meant — see [option 3](#3-with-docker-compose).

Then open http://localhost:3000. The marketplace, the admin console and Swagger
all work immediately. **Dealer sign-in needs a Google OAuth client of your own** —
five minutes, and the API tells you exactly what to set if you skip it (see
[Authentication](#authentication)).

---

## 2. With Docker

Two images, built from the repo root because both apps import
`@dealers-drive/contracts` from a sibling workspace — the build context has to
be the whole monorepo.

**Both images build offline** — no API, no database, nothing running. Every
route that reads data is `dynamic = 'force-dynamic'`, so `next build`
prerenders nothing that would call the API, and the resulting image carries no
environment's data. That is what lets one image be built once and promoted from
development to production unchanged (docs/DEPLOYMENT.md §B1).

The order below still matters at *run* time — the API must be migrated and
answering before the web container starts serving — but not at build time.

```bash
# 1. The API, and the migration image — the same Dockerfile at an earlier
#    stage. It keeps the dev dependencies, because `prisma` (the CLI) and `tsx`
#    (the seed runs TypeScript directly) are both dev dependencies.
docker build -f apps/api/Dockerfile -t dealers-drive-api .
docker build -f apps/api/Dockerfile --target migrator -t dealers-drive-migrator .
```

Then a network, a database, migrations, and the API. Stop the Compose stack
first if it is running — these container names and host ports are the same ones
Compose claims:

```bash
docker compose --profile app down
docker network create dealers-drive

docker run -d --name dd-postgres --network dealers-drive \
  -e POSTGRES_USER=dealersdrive -e POSTGRES_PASSWORD=dealersdrive \
  -e POSTGRES_DB=dealersdrive -p 5432:5432 \
  postgres:16-alpine

DB=postgresql://dealersdrive:dealersdrive@dd-postgres:5432/dealersdrive

# 2. Schema first, as its own container that runs to completion. Migrations do
#    not belong in the API's boot path: two replicas starting together would
#    race to alter the same tables.
docker run --rm --network dealers-drive -e DATABASE_URL=$DB dealers-drive-migrator
docker run --rm --network dealers-drive -e DATABASE_URL=$DB dealers-drive-migrator pnpm db:seed

# 3. The API, published on the host so both the browser and the web build can
#    reach it.
docker run -d --name dd-api --network dealers-drive -p 4000:4000 \
  -e NODE_ENV=development -e DATABASE_URL=$DB \
  -v dd-storage:/app/.storage \
  dealers-drive-api

curl -fsS http://localhost:4000/health/ready   # wait for this before continuing
```

Then the web app. This image could have been built first — it takes no build
argument beyond `GIT_SHA`, which names the artifact rather than configuring it:

```bash
# 4. Web (Next.js). No API needed to build it, and nothing environment-specific
#    inside it: API_BASE_URL, WEB_BASE_URL and APP_ENV are read at runtime.
docker build -f apps/web/Dockerfile -t dealers-drive-web .

docker run -d --name dd-web --network dealers-drive -p 3000:3000 \
  -e API_BASE_URL=http://dd-api:4000 \
  dealers-drive-web
```

Four things in there are deliberate and worth understanding:

- **`-e NODE_ENV=development` on the API.** The image is a production _build_ —
  compiled JavaScript, production dependencies only — but `NODE_ENV=production`
  turns on the boot guards in `apps/api/src/config/env.ts`: it refuses the local
  default `SESSION_SECRET`, refuses `STORAGE_DRIVER=local`, and requires real
  Google OAuth credentials. Those guards are right, and this is a laptop.
  Running the image as production is what [`deploy/`](deploy/README.md) is for.
- **`DATABASE_URL` is the only variable the API needs.** Everything else falls
  back to a local default that is already correct — including
  `API_BASE_URL=http://localhost:4000`, which is what presigned upload URLs and
  media URLs are built from, and which has to be a _browser_-reachable address
  rather than a container name.
- **The web image takes no configuration at build time.** At runtime the
  container reads `API_BASE_URL`, `WEB_BASE_URL` and `APP_ENV` from the
  environment, which is why the same image runs in every environment — there is
  no `NEXT_PUBLIC_*` anywhere, because those are inlined at build time and would
  force one image per environment (`apps/web/src/lib/config.ts`, Rule 9). The
  only build argument is `GIT_SHA`, which `/api/health` reports so a deployment
  can prove which build is serving.
- **The web container talks to `http://dd-api:4000`, not to localhost.** Next is
  a backend-for-frontend here: the browser only ever talks to port 3000, and
  Next does the API calls server-side. `dd-api` is a Docker DNS name that
  resolves only inside the network, which is correct — nothing in the browser
  bundle needs it.

Photo uploads work out of the box because `STORAGE_DRIVER` defaults to `local`:
the API signs an upload URL on its own origin and terminates the PUT itself. To
run MinIO instead, see the note in [option 3](#3-with-docker-compose) — a
presigned S3 URL is signed over its host, and that has one consequence.

Tear it down with:

```bash
docker rm -f dd-web dd-api dd-postgres
docker network rm dealers-drive
docker volume rm dd-storage
```

---

## 3. With Docker Compose

The whole product — Postgres, MinIO, Mailpit, migrations, API, web.

```bash
cp .env.example .env    # optional: only Google OAuth is read from it
pnpm app:up --seed      # first run: also builds the demo data
pnpm app:up             # every run after that
```

Open http://localhost:3000.

`pnpm app:up` is [`scripts/app-up.sh`](scripts/app-up.sh). Compose does the
whole thing in one pass — the web image builds offline, so there is no ordering
constraint to work around:

```bash
docker compose --profile app up -d --build      # everything
docker compose run --rm seed                    # only with --seed
```

The script adds the readiness waits on `/health/ready` and `/api/health`, which
is all `docker compose up` cannot express. To check the result the way a deploy
does:

```bash
./scripts/smoke.sh http://localhost:3000 http://localhost:4000
```

```bash
docker compose --profile app logs -f api web  # follow the logs
docker compose --profile app down             # stop, keep the data
docker compose --profile app down -v          # stop and delete the volumes
```

Or through pnpm, which is the same thing with less typing:

| Command            | Does                                                        |
| ------------------ | ----------------------------------------------------------- |
| `pnpm app:up`      | build + start the full stack (`--seed` to reseed)           |
| `pnpm app:down`    | stop the full stack, keep the volumes                       |
| `pnpm app:logs`    | follow the api and web logs                                 |
| `pnpm app:seed`    | run the seed once (it TRUNCATES first — see below)          |
| `pnpm infra:up`    | backing services only, for [option 1](#1-manually)          |
| `pnpm infra:reset` | wipe the local volumes and restart the backing services     |

### What Compose is doing

| Service    | Profile | Notes                                                                       |
| ---------- | ------- | --------------------------------------------------------------------------- |
| `postgres` | —       | starts with a bare `docker compose up -d`                                   |
| `minio`    | —       | same                                                                        |
| `mailpit`  | —       | same                                                                        |
| `migrate`  | `app`   | `prisma migrate deploy`, runs to completion; the API waits on its exit code |
| `seed`     | `seed`  | never automatic — run it by hand                                            |
| `api`      | `app`   | waits for Postgres healthy **and** `migrate` exited 0                       |
| `web`      | `app`   | builds offline; waits for the API's health check before it starts           |

The app services carry `profiles: [app]`, which is why option 1's
`docker compose up -d` still starts only the three backing services.

**The seed is not automatic, on purpose.** `pnpm db:seed` truncates before it
writes, so wiring it into `up` would erase your data on every restart. Run
`docker compose run --rm seed` once against a fresh database.

### Two things that are not what you would guess

**Storage defaults to `local`, not MinIO.** A presigned S3 URL is signed over
its _host_: a URL the API signs as `http://minio:9000/…` is rejected when the
browser sends it to `localhost:9000`, because the signature covers a different
`Host` header. The `local` driver has no such problem — it signs
`http://localhost:4000/uploads?…`, which the browser can reach, and the API
terminates the PUT. To exercise the real S3 adapter instead, make one hostname
resolve from both sides:

```bash
echo '127.0.0.1 minio' | sudo tee -a /etc/hosts
DOCKER_STORAGE_DRIVER=minio docker compose --profile app up -d
```

**Mailpit receives nothing.** `MAIL_DRIVER=console` is the only mailer that
exists — there is no SMTP adapter yet (see
[Providers](#providers--local-and-production)). Mailpit stays in the file for
the day one is written.

### Google sign-in under Compose

`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are read from your root `.env`,
which Compose loads automatically. Register the same redirect URI as for local
development — `http://localhost:4000/v1/auth/google/callback` — because the API
container publishes port 4000 on the host and the browser reaches it there.
Without those two values everything works except the "Continue with Google"
button, which answers with a configuration error naming exactly what to set.

---

## Where things are

Sign in to the admin console at http://localhost:3000/admin/login with
`DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD` from your `.env` — by default
`ops@dealers-drive.in` / `dealers-drive-local-admin`. The seed hashes that
password with Argon2id; the plaintext is never stored.

| Service                        | URL                                                                  |
| ------------------------------ | -------------------------------------------------------------------- |
| Web                            | http://localhost:3000                                                |
| Dealer sign-in                 | http://localhost:3000/dealer/login                                   |
| Dealer onboarding              | http://localhost:3000/dealer/onboarding                              |
| Dealer console                 | http://localhost:3000/dealer                                         |
| Admin sign-in                  | http://localhost:3000/admin/login                                    |
| Admin console                  | http://localhost:3000/admin                                          |
| API                            | http://localhost:4000/health/live                                    |
| **API reference (Swagger UI)** | http://localhost:4000/api/docs                                       |
| OpenAPI JSON / YAML            | http://localhost:4000/api/docs/openapi.json · `.yaml`                |
| Postgres                       | `postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive` |
| MinIO console                  | http://localhost:9001 (dealersdrive / dealersdrive)                  |
| Mailpit inbox                  | http://localhost:8025                                                |

Deploying this to a server with a domain? See
[`deploy/README.md`](deploy/README.md) — one EC2 instance, nginx, Let's Encrypt,
about twenty minutes.

The seed models the **Vellore district** — `vellore`, `katpadi`, `arcot`,
`ranipet`, `gudiyattam`. There is no `chennai`, so `/cars?city=chennai`
legitimately returns nothing. That looks like a bug and is not one.

## Scripts

| Command            | Does                                           |
| ------------------ | ---------------------------------------------- |
| `pnpm dev`         | runs web + api together (turbo)                |
| `pnpm build`       | builds every workspace package                 |
| `pnpm lint`        | eslint, type-aware, across the repo            |
| `pnpm typecheck`   | tsc across the repo                            |
| `pnpm test`        | vitest across the repo (2 781 tests)           |
| `pnpm format`      | prettier write                                 |
| `pnpm infra:up`    | backing services only (`docker compose up -d`) |
| `pnpm infra:down`  | stops them                                     |
| `pnpm infra:reset` | wipes the local volumes and restarts           |
| `pnpm app:up`      | builds and starts the full stack in containers |
| `pnpm app:down`    | stops the full stack, keeps the volumes        |
| `pnpm app:logs`    | follows the api and web container logs         |
| `pnpm app:seed`    | runs the seed inside a one-shot container      |

And one script that is not a pnpm task:

| Command                                                            | Does                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `./scripts/smoke.sh <web-url> <api-url> [sha]` | the read-only checks every deployment gates on — run it against localhost too |

In `apps/api`:

| Command             | Does                                                        |
| ------------------- | ----------------------------------------------------------- |
| `pnpm db:migrate`     | `prisma migrate deploy` — applies the committed migrations. Safe everywhere |
| `pnpm db:migrate:new` | `prisma migrate dev --create-only` — writes a new migration for you to **read before applying**. Never point it at a database you care about: `migrate dev` reconciles the DB to `schema.prisma`, and `listing_search` is not in `schema.prisma`, so it will generate a `DROP TABLE` for it |
| `pnpm db:seed`      | rebuilds the seeded world (idempotent — it truncates first) |
| `pnpm db:bootstrap` | **deployed environments**: catalogue, packs, config, one admin. Creates what is missing, overwrites nothing, truncates nothing |
| `pnpm db:reset`     | migrate reset + seed                                        |
| `pnpm db:studio`    | Prisma Studio                                               |
| `pnpm test`         | the integration suite (needs Postgres running)              |
| `pnpm docs:postman` | regenerates `docs/postman/` from the OpenAPI document       |

`pnpm lint && pnpm typecheck && pnpm test && pnpm build` **must all pass** before
calling anything done.

## What works today

Everything below is implemented and verified end to end — by the 2 097-test
suite, and by driving the running app in a browser.

### Authentication

- **Dealer sign-in with Google** — authorization code flow with PKCE and an OIDC
  nonce, the state and verifier sealed into a signed ten-minute cookie, the
  identity token's issuer, audience, expiry and nonce all checked server-side
- **Dealer onboarding** — the four-step wizard a new Google account lands on:
  account, dealership, KYC documents, submit for verification. The verified
  Google address is shown, never asked for
- **Admin sign-in** — email and Argon2id password, rate-limited per account and
  per IP, with unknown-account and wrong-password answering identically
- **Sessions** — `dd_session`, opaque, HttpOnly, revocable on the next request;
  separate scopes for the two consoles

### Public marketplace

- **Homepage** — city-scoped featured cars, body-type tiles with live counts, a
  verified-dealer strip
- **Search** (`/cars`) — filter by city, make/model/variant, price, year, km,
  fuel, transmission, body type, owners, seats, airbags, colour, RTO and dealer;
  six sort orders; facet counts beside every option (zero-count options render
  disabled rather than vanishing); the URL is the only state store, so every
  result set is linkable and back/forward work
- **Vehicle detail** (`/car/[slug]`) — gallery with a keyboard-navigable lightbox
  (Tab trapped, Esc/←/→, focus restored to the opener), specification table,
  features, EMI estimate, similar cars, and
  `Vehicle`/`Offer`/`AutoDealer`/`BreadcrumbList` JSON-LD
- **Reveal contact** — the dealer's number is absent from page source and arrives
  only on click, rate-limited hourly and daily per IP, and recorded as a lead in
  the dealer's inbox
- **Enquiry form** — inline, no account, deduplicated per phone+vehicle over 24
  hours, honeypot-protected, with a reference number on success
- **Dealer directory and profile** (`/dealers`, `/dealers/[slug]`) — with a
  filterable portfolio per dealership
- **Saved cars** (`/saved`) — `localStorage`, hydrated through a BFF route; a car
  that has left the catalogue degrades to "unavailable" instead of breaking the
  page
- **SEO** — one indexing-policy resolver, `robots.ts`, `sitemap.ts`, canonicals

### Dealer console (`/dealer`)

- Dashboard: stats, credit balance, recent leads, listings needing attention
- Inventory with status tabs and search
- **Add-vehicle wizard** — catalogue-driven basics, details, real
  direct-to-storage photo upload (client-side compression, presign → PUT →
  commit → poll), drag-reorder, price, and a review step showing credits after
  publish
- Submit for review, which **holds one credit** atomically
- Enquiry inbox with live tab counts, status transitions and notes
- **Credit wallet and purchase** — packs, GST, invoice, immediate credit; the
  ledger shows every movement with its running balance
- Profile and KYC document upload — presigned straight to object storage, same
  contract as vehicle photos
- Sign out, which revokes the session row rather than forgetting a cookie

### Admin console (`/admin`)

- Platform metrics, moderation queue sorted oldest-first
- Listing review with advisory automated flags; approve / reject / request
  changes / take down
- Dealer verification, KYC review, suspend and reinstate (which pulls every one
  of that dealer's cars out of the catalogue, and back)
- Manual credit grants and adjustments, payments, platform configuration

### API

73 endpoints across public, dealer and admin surfaces, fully documented at
`/api/docs`. RFC 9457 problem responses throughout, `.strict()` validation on
every input, cursor and offset pagination, per-IP and per-dealer rate limits, a
transactional outbox + pg-boss for async work, and structured pino logs carrying
a `traceId` on every line.

## Authentication

Two doors, sharing nothing but the cookie mechanism.

**Dealers sign in with Google** (OAuth 2.0 authorization code + PKCE + OIDC
nonce). There is no dealer password and no dealer OTP anywhere in the product.
The account is found by Google's stable subject identifier (`sub`), never by the
email address — an account holder can change their email, and matching on the
string is how an expired domain would become somebody else's inventory. A Google
account with no dealership lands on onboarding; one with a dealership lands on
the console.

**Admins sign in with an email and an Argon2id password** at `/admin/login`.
There is no admin sign-up, no admin OTP and no Google path into the admin
console. Admin sessions are a separate scope with a 12-hour lifetime: a dealer's
cookie cannot reach an admin route and an admin's cannot reach a dealer one, even
for one human holding both seats.

Both end in the same place — an opaque `dd_session` cookie (32 random bytes,
HttpOnly, SameSite=Lax, only its SHA-256 stored) backed by a row in `sessions`.
That row is the point: signing out, suspending a dealership or revoking a session
takes effect on the very next request, with no token left believing otherwise.

### Setting up Google sign-in locally

1. Create an **OAuth 2.0 Client ID** (type: _Web application_) at
   <https://console.cloud.google.com/apis/credentials>.
2. Register exactly:
   - Authorized JavaScript origin — `http://localhost:3000`
   - Authorized redirect URI — `http://localhost:4000/v1/auth/google/callback`
3. Put the client id and secret in `.env` as `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`. Never commit the secret.

Without them everything else still runs, and `/dealer/login` says which two
variables are missing rather than showing a button that fails on click.

If you have no Google client and want the dealer console anyway, `AUTH_MODE=dev`
restores the old server-configured identity (`DEV_DEALER_SLUG`). It is refused in
production, and it logs a warning on every boot.

Everything _downstream_ of identity is production-grade and tested: the
permission table, dealer scoping on every repository call, ownership re-checked
inside the writing transaction, and cross-tenant reads answering **404 rather
than 403** so an id's existence is never leaked. `dealerId` is a property of the
resolved session and is never read from a request — there is no header, body
field or path parameter that could set it.

Payments are still mocked: the development provider settles inline through
the same function a Razorpay webhook will call, so no gateway page is involved —
while the credit ledger itself is append-only, row-locked and real.

See [`CONTEXT.md` §6](CONTEXT.md) for the full boundary between what is mocked
and what is not.

## Providers — local and production

Every row is the _same code_ on both sides. What changes is environment
configuration, never a service, a repository or a route.

| Capability      | Local                     | Production                    | Chosen by                 |
| --------------- | ------------------------- | ----------------------------- | ------------------------- |
| Database        | PostgreSQL 16 (docker)    | PostgreSQL                    | `DATABASE_URL`            |
| Object storage  | MinIO (`localhost:9000`)  | Cloudflare R2                 | `STORAGE_DRIVER` + `S3_*` |
| Dealer identity | Google OAuth (dev client) | Google OAuth (prod client)    | `GOOGLE_CLIENT_*`         |
| Admin identity  | email + Argon2id password | email + Argon2id password     | — (same everywhere)       |
| Sessions        | `dd_session` in Postgres  | `dd_session` in Postgres      | `SESSION_COOKIE_DOMAIN`   |
| SMS             | console                   | MSG91                         | `SMS_DRIVER`              |
| Email           | console                   | Resend _(adapter to write)_   | `MAIL_DRIVER`             |
| Payments        | development provider      | Razorpay _(adapter to write)_ | `PAYMENT_PROVIDER`        |
| API reference   | on                        | off unless asked              | `DOCS_ENABLED`            |

`STORAGE_DRIVER=minio` and `STORAGE_DRIVER=r2` build the **same S3 adapter** —
only `S3_ENDPOINT` and the keys differ. `local` writes to the filesystem instead
and needs no container; that is what the test suite uses.

`apps/api/src/config/env.ts` refuses to start when a combination is incomplete:
R2 without keys, MSG91 without an auth key, production without a Google client,
production still carrying a local development secret, or production on local disk
storage. None of them fall back silently.

## Testing the API in Postman

```bash
pnpm dev                                   # or: cd apps/api && pnpm dev
```

Import both files from [`docs/postman/`](docs/postman) — **Import → Files**:

| File                                     | What it is                                          |
| ---------------------------------------- | --------------------------------------------------- |
| `dealers-drive.postman_collection.json`  | 73 requests in 10 folders, one per documented route |
| `dealers-drive.postman_environment.json` | 21 variables, `baseUrl` = `http://localhost:4000`   |

Then select the environment and press **Run collection**. It passes from a clean
seed with no manual editing.

- **There is nothing to authorize.** No `Authorization` header, no bearer token —
  the API reads a server-configured identity (see [Authentication](#authentication)).
  To test as another dealership, restart the API with a different `DEV_DEALER_SLUG`.
- **The requests chain.** Test scripts capture ids as they appear —
  `GET /v1/catalog/bundle` fills in `makeId`/`modelId`/`colorId`/`cityId`, creating
  a vehicle fills `vehicleId`, submitting it fills `listingId`, and the moderation
  queue picks it up. Run the folders in order the first time; after that any single
  request works on its own.
- **Every response is checked against the error contract.** A collection-level
  test asserts that any status ≥ 400 is `application/problem+json` carrying `code`
  and `traceId`, with a matching `status` and no `stack` — so a leak shows up as a
  failed assertion rather than as a body nobody read.
- Optional query parameters ship **disabled**. The API is `.strict()`: an empty
  `?q=` filters for the empty string rather than meaning "no filter".
- **Thirteen of the 73 are non-2xx on a clean seed, and all thirteen are correct.**
  Each says so in its own description: a collection cannot PUT the file a presign
  was issued for, so both `commit` steps answer 422 `UPLOAD_MISSING` and the draft
  it creates has no photos (`TOO_FEW_PHOTOS`) and therefore nothing to publish,
  mark sold or reorder; renewing finds nothing expired; the invoice PDF is still
  rendering (`PDF_NOT_READY`); and the admin folder approves a listing before the
  reject and request-changes requests reach it. Open the request in Postman and the
  reason is under the description.

Headless, in CI or a terminal:

```bash
pnpm dlx newman run docs/postman/dealers-drive.postman_collection.json
```

The collection is **generated** from the same OpenAPI document Swagger UI serves —
`pnpm docs:postman` in `apps/api` rewrites it, and `tests/postman.test.ts` fails if
the committed file has drifted from the routes. Postman can also import
`http://localhost:4000/api/docs/openapi.json` directly, but that gives you neither
the id chaining nor the error-contract assertions.

## Roadmap

Ordered by what unblocks the most. In every case the abstraction already exists
and only the adapter is missing — [`CONTEXT.md` §12](CONTEXT.md) has the
step-by-step for each.

### 1. Payment integration (Razorpay)

`PaymentProvider` port exists with `DevelopmentPaymentProvider`. Remaining:

- `razorpay.provider.ts` — order creation, client-handshake verification, webhook
  signature verification
- `POST /v1/webhooks/razorpay` with raw-body verification. The `WebhookEvent`
  model already exists for idempotency, so **insert the event first** and let a
  duplicate delivery collide on `gatewayEventId`.
- Route the capture into the existing `settleCapturedPayment` — the only path
  that adds purchased credits. Do not write a second one.
- `settlement: 'deferred'` makes `verifyOrder` return 202 with
  `pollAfterSeconds`; that branch is already written and documented. Credits
  appear when the webhook lands, never because a client said so.
- Refunds: `admin:payment:refund` is in the permission table with no endpoint
  behind it yet.

### 2. Monitoring, logging and observability

Structured logging is already good — pino, one JSON line per event, a mixin that
stamps `traceId` (plus `userId`/`dealerId` after auth) on every line emitted
anywhere in a request, and a redact list covering `authorization`, `cookie`,
`set-cookie` and password fields. What is missing is somewhere for the logs to go
and something watching them:

- **Error tracking** — Sentry, at the marked TODO in `error-handler.ts`, tagged
  with `traceId`. 5xx only; a 422 `INSUFFICIENT_CREDITS` is not an exception.
- **Log shipping** — stdout to a hosted sink (Better Stack, Axiom, Datadog). No
  in-process transport; the container's stdout is the interface.
- **Metrics** — the four that matter here: enquiry-notification latency (it is
  the product), moderation queue depth and age, **credit-ledger drift**
  (`Dealer.creditBalance` vs the newest `balanceAfter` — always zero, so an alert
  on non-zero catches any future write path that bypasses `moveCredits`), and
  pg-boss failed-job count.
- **Tracing** — OpenTelemetry if a second service appears; the `traceId` in
  `request-context.ts` is the natural span id.
- **Uptime** — poll `/health/ready`, not `/health/live`: readiness names the
  failing dependency, liveness deliberately touches nothing.
- **Job and audit visibility** — pg-boss keeps state in the `pgboss` schema and
  nothing surfaces failed jobs yet; `GET /v1/admin/audit-logs` exists and is
  documented but has no console screen.

### 3. Real infrastructure adapters

Storage and SMS are done: `S3Storage` covers MinIO and R2 through one adapter
chosen by `STORAGE_DRIVER`, and `Msg91Sms` sits behind `SmsPort` (written against
MSG91's documented API, never exercised against a real account — India's DLT
registration of the entity, sender header and each template comes first).

Remaining: `ResendMailer` against `MailerPort`, which is still the console
adapter. Dealer sign-in does not depend on it — Google verifies the address and
there is no email OTP — so nothing is blocked on it.

### 4. PostgreSQL row-level security

Layers 1, 2 and 4 of the four-layer tenancy model are done and tested.
`withTenant` already issues `SET LOCAL app.dealer_id`, so the policies have a
hook waiting — the migration that creates them is not written.

### 5. Deployment

Two deployments exist, for two purposes.

**[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) is the real one** — local →
`dev.dealers-drive.com` → `www.dealers-drive.com`, on ECS Fargate, with one
image built per commit and promoted from development to production unchanged.
The pipeline is in [`.github/workflows/`](.github/workflows/) and the one-time
infrastructure setup is [`deploy/aws/README.md`](deploy/aws/README.md). Merging
to `main` deploys development automatically; production is a manual workflow
run behind a required approval, and a rollback is the same run with an older
commit.

**[`deploy/`](deploy/README.md) is the single box the investor demo runs on** —
nginx terminating TLS in front of Next.js and the API on one hostname, Postgres
and MinIO in Docker on loopback, systemd units, and a release script that builds
on the server. Honest about being demo-grade; see that file's closing section.

Still needed for real production: a separate worker entrypoint — today
`WORKER_INLINE=true` runs job handlers inside the HTTP process, which caps the
API at one task — the Sentry SDK (the DSN is validated and does nothing), and
the CloudWatch alarms.

### 6. Product work not started

Photo requests, team members, saved searches, deeper dealer analytics, and mobile
and tablet layouts (this build was scoped to desktop). Buyer accounts are
explicitly out of scope.

## Conventions that are enforced, not suggested

1. Only `*.routes.ts` imports from `express`. Services never see `req`/`res`.
2. Only `*.repository.ts` imports `prisma`.
3. Cross-module imports go through `*.facade.ts` only — ESLint blocks the rest.
4. Every dealer-scoped repository method takes `dealerId` as its first argument,
   so an unscoped query is a type error.
5. Every error response is RFC 9457 Problem Details with a `traceId`, produced by
   exactly one place: `apps/api/src/middleware/error-handler.ts`.
6. Money is integer paise everywhere. No floats, in either direction.
7. Every API input schema lives in `packages/contracts` and is `.strict()`.
8. Adding a route without documenting it in `<module>.docs.ts` **fails the test
   suite** — `tests/openapi.test.ts` walks the router and compares.

The numbered rules behind these are in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §5.5 and §8.3.
