# Deploying Dealers-Drive to one EC2 box

> **This is the demo box, not the production pipeline.** It builds on the
> server, which means there is no artifact to roll back to and every release
> has a window where the site is down. It is documented, it works, and it is
> what the investor demo runs on.
>
> The three-environment deployment — local → `dev.dealers-drive.com` →
> `www.dealers-drive.com`, one image built per commit and promoted unchanged,
> with health gates, smoke tests, an approval and a rollback — is
> [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md), and its one-time setup is
> [`deploy/aws/README.md`](aws/README.md).

Everything the MVP needs runs on a single instance behind nginx: the Next.js
site, the Express API, Postgres and MinIO. One hostname serves the whole thing,
so the session cookie is host-only and the browser never has to reason about two
origins.

```
                  ┌──────────────────────── EC2 instance ───────────────────────┐
  investor ──443──┤  nginx                                                       │
                  │    /            → 127.0.0.1:3000   Next.js   (systemd)       │
                  │    /v1  /media  → 127.0.0.1:4000   Express   (systemd)       │
                  │                                                              │
  browser ──443───┤  s3.<domain>    → 127.0.0.1:9000   MinIO     (docker)        │
  (photo upload)  │                   127.0.0.1:5432   Postgres  (docker)        │
                  └──────────────────────────────────────────────────────────────┘
```

Only 22, 80 and 443 are ever open. Postgres, MinIO and both Node processes bind
to loopback, so they stay unreachable even if the security group is widened by
accident.

**Instance size:** t3.small (2 GB) is the floor and only because `bootstrap.sh`
adds 4 GB of swap — the Next.js build is what needs the memory, not the running
app. t3.medium builds in about a third of the time. 20 GB of disk is plenty.
Ubuntu 24.04 LTS.

Replace `__DOMAIN__` with your domain throughout. Commands run as `ubuntu`.

---

## 1. Security group

| Type  | Port | Source           | Why                       |
| ----- | ---- | ---------------- | ------------------------- |
| SSH   | 22   | **your IP only** | never `0.0.0.0/0`         |
| HTTP  | 80   | `0.0.0.0/0`      | redirect + ACME challenge |
| HTTPS | 443  | `0.0.0.0/0`      | the site                  |

Nothing else. Not 3000, not 4000, not 5432, not 9000 — nginx is the only door,
and opening 4000 would let someone bypass it.

Attach an **Elastic IP** before you touch DNS. A stopped instance without one
comes back on a different address and your domain silently points at nothing.

## 2. DNS

Three A records, all to the Elastic IP:

| Name  | Type | Value          |
| ----- | ---- | -------------- |
| `@`   | A    | `<elastic-ip>` |
| `www` | A    | `<elastic-ip>` |
| `s3`  | A    | `<elastic-ip>` |

`s3` is not optional if you want to demo adding a car with photos: the browser
uploads straight to the bucket with a presigned URL, and the SigV4 signature
covers the hostname it was signed for.

Wait for propagation before step 5 — certbot will fail otherwise:

```bash
dig +short __DOMAIN__ s3.__DOMAIN__
```

## 3. Provision the box

```bash
ssh ubuntu@<elastic-ip>
git clone <your-repo-url> ~/dealers-drive
bash ~/dealers-drive/deploy/bootstrap.sh
exec sudo su -l ubuntu     # pick up the new docker group
```

Installs Node 24, pnpm 9.15.9, Docker, nginx, certbot, 4 GB of swap and a ufw
rule set matching the table above. Safe to re-run.

## 4. Configuration

```bash
cd ~/dealers-drive
cp deploy/env.production.example .env
sed -i 's/__DOMAIN__/your-domain.com/g' .env
openssl rand -hex 32        # run three times, for the three CHANGE_ME secrets
nano .env
```

Fill in, at minimum:

- `POSTGRES_PASSWORD` **and** the same string inside `DATABASE_URL`
- `S3_SECRET_ACCESS_KEY` — MinIO's root password
- `SESSION_SECRET`, `UPLOAD_SIGNING_SECRET` — 32 random bytes each
- `DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD` — what you hand the investor
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — step 8

`apps/api/src/config/env.ts` validates all of this at boot and **refuses to
start** in production if a local development default survives, if `AUTH_MODE`
is `dev`, if storage is the filesystem, or if the Google client is missing. A
half-edited file fails immediately and loudly rather than serving an insecure
demo. `.env` is gitignored — it must never be committed.

## 5. nginx and TLS

```bash
sudo cp deploy/nginx/dealers-drive.conf /etc/nginx/sites-available/dealers-drive
sudo sed -i 's/__DOMAIN__/your-domain.com/g' /etc/nginx/sites-available/dealers-drive
sudo ln -sf /etc/nginx/sites-available/dealers-drive /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d your-domain.com -d www.your-domain.com -d s3.your-domain.com
```

Certbot rewrites the site file in place — adding `:443`, the certificate paths
and the HTTP→HTTPS redirect — and installs a renewal timer. Let it own the TLS
config; hand-editing it is how renewal quietly stops working.

`502 Bad Gateway` at this point is correct: nothing is listening yet.

TLS is not decoration here. Session cookies carry `Secure` in production, so
over plain HTTP the browser accepts the redirect from Google and then throws the
cookie away — sign-in appears to succeed and lands you back on the login page.

## 6. Services

```bash
sudo cp deploy/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable dealers-drive-api dealers-drive-web
```

Both units run out of `apps/api` and `apps/web` so dotenv resolves the same
repo-root `.env` from `../../` — one file, two processes, no copy to drift.

## 7. Build, migrate, seed, start

```bash
bash ~/dealers-drive/deploy/release.sh --seed
```

Roughly 5–10 minutes the first time. It brings up Postgres and MinIO, installs
dependencies, generates the Prisma client, builds contracts and the API, runs
`prisma migrate deploy`, seeds the demo catalogue, starts the API, **waits for
`/health/ready`**, then builds and starts the web app.

That order is about starting, not building: the web build no longer calls the
API (every data-reading route is `force-dynamic`), but the API should be
migrated and answering before the site in front of it restarts.

`--seed` truncates every application table and rewrites the demo dealerships,
vehicles, photos and the admin account. Run it before a demo; never after
someone has been clicking around in one. Drop the flag for later deploys:

```bash
git pull && bash ~/dealers-drive/deploy/release.sh
```

## 8. Google sign-in

In the [Google Cloud console](https://console.cloud.google.com/apis/credentials)
→ **Credentials** → your OAuth 2.0 Client ID (type: Web application):

| Field                        | Value                                        |
| ---------------------------- | -------------------------------------------- |
| Authorized JavaScript origin | `https://__DOMAIN__`                         |
| Authorized redirect URI      | `https://__DOMAIN__/v1/auth/google/callback` |

Both, exactly — no trailing slash, `https` not `http`. Then put the client id
and secret in `.env` and `sudo systemctl restart dealers-drive-api`.

If the OAuth consent screen is still in **Testing**, only accounts listed under
_Test users_ can sign in. Add the investor's Google address there, or publish
the app. A demo that ends at "Access blocked: this app has not completed
verification" is a bad demo.

The client secret lives only in `.env` on the server. It is never committed,
never sent to the browser, and never returned by the API.

## 9. Verify

```bash
curl -fsS https://__DOMAIN__/health/ready            # {"status":"ok",...}
curl -fsS -o /dev/null -w '%{http_code}\n' https://__DOMAIN__/
sudo journalctl -u dealers-drive-api -u dealers-drive-web -n 50 --no-pager
```

Then, in a browser:

| Screen         | URL                               |
| -------------- | --------------------------------- |
| Marketplace    | `https://__DOMAIN__/`             |
| Car detail     | click any listing                 |
| Dealer sign-in | `https://__DOMAIN__/dealer/login` |
| Dealer console | after signing in with Google      |
| Admin sign-in  | `https://__DOMAIN__/admin/login`  |

Admin credentials are the `DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD` you set in
step 4. The plaintext is hashed with Argon2id at seed time and never stored,
logged or returned.

Walk the full loop once yourself before the investor does: sign in with Google
→ onboarding → add a vehicle **with a photo** (this is the path that proves the
`s3.__DOMAIN__` record works) → publish → open the listing in a private window
→ submit an enquiry → see it in the dealer inbox → approve the dealership from
the admin console.

## Operating it

```bash
sudo systemctl restart dealers-drive-api dealers-drive-web
sudo journalctl -u dealers-drive-api -f
docker compose -f deploy/docker-compose.prod.yml --env-file .env ps

# Database backup — take one before any demo you cannot afford to lose
docker exec dd-postgres pg_dump -U dealersdrive dealersdrive | gzip > ~/dd-$(date +%F).sql.gz

# MinIO console, without exposing it: tunnel from your laptop
ssh -L 9001:127.0.0.1:9001 ubuntu@<elastic-ip>   # then http://localhost:9001
```

## When something breaks

| Symptom                                                    | Cause                                                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `502 Bad Gateway`                                          | a Node process is down — `journalctl -u dealers-drive-api -n 50`                                           |
| API exits at boot with "Invalid environment configuration" | it names the variable; a `CHANGE_ME` or a local default survived in `.env`                                 |
| Sign-in loops back to `/dealer/login`                      | no TLS yet, or `WEB_BASE_URL`/`API_BASE_URL` is not the `https://` public URL                              |
| `redirect_uri_mismatch` at Google                          | the console URI is not character-for-character `https://__DOMAIN__/v1/auth/google/callback`                |
| "Access blocked … has not completed verification"          | consent screen is in Testing and the account is not a test user                                            |
| Photo upload fails in the browser                          | `s3.__DOMAIN__` missing from DNS or from the certbot `-d` list, or `S3_ENDPOINT` still points at localhost |
| Images 404 on the marketplace                              | `MEDIA_BASE_URL` is not `https://__DOMAIN__/media`                                                         |
| `next build` killed                                        | swap is missing — re-run `bootstrap.sh`, or use a bigger instance                                          |
| Certbot fails                                              | DNS has not propagated, or port 80 is closed in the security group                                         |

## What this deployment is, and is not

Honest framing for a demo box, so nothing here gets mistaken for production:

**Real:** Google OAuth against Google, Argon2id admin passwords, server-side
sessions revocable on logout, tenant isolation, TLS, presigned direct-to-bucket
uploads, the full image pipeline.

**Demo-grade on purpose:**

- **Postgres and MinIO are containers on this box.** One instance, one disk, no
  replicas. Take backups; `docker compose down -v` erases everything.
- **Mail and SMS print to the log** (`MAIL_DRIVER=console`, `SMS_DRIVER=console`).
  Nothing is sent. Dealer sign-in does not depend on either — Google verifies
  the address and there is no OTP anywhere in the product.
- **Payments settle instantly** (`PAYMENT_PROVIDER=development`). No money moves.
- **One process runs both HTTP and background jobs** (`WORKER_INLINE=true`).
  Fine for one box; it is why scaling out needs a separate worker entrypoint.
- **No Sentry.** The DSN validates but no SDK is installed.

Moving to real production is a configuration change, not a rewrite:
`STORAGE_DRIVER=r2` with Cloudflare keys, `DATABASE_URL` to RDS,
`SMS_DRIVER=msg91` once DLT registration clears — the adapters are written and
tested behind the same ports.
