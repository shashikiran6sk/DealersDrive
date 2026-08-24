# Day 15 — Media: upload, storage, processing, delivery

> **Track:** Week 3 · The domain
> **Time:** ~4 hours · **Prerequisite:** Day 14
> **Goal in one sentence:** explain a presigned PUT from first principles, and
> why the API never sees a single image byte on the upload path.

---

## 1. Why today matters

A used-car marketplace *is* photographs. A dealer uploads twelve 8 MB photos from
a phone on a yard's 4G, and that has to work without costing the API anything.

The naive approach — `POST /upload` with the file in the body — puts every byte
through your Node process: memory, CPU, event loop, bandwidth, twice. At any
scale that is the first thing to fall over.

The pattern that fixes it is **presigned URLs**, and it is one of the most
transferable things in this entire path. You will use it in every system you ever
build that accepts files.

---

## 2. Read first

| Source | Sections | ~min |
|---|---|---|
| `docs/ENGINEER-ONBOARDING.md` | **Part 14** — all of it (14.1 → 14.8) | 45 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 34-D1 → D4** — filesystem vs object storage, presigned URLs, signed reads, CDN | 30 |
| `docs/ENGINEER-ONBOARDING.md` | **§33.3** — object storage, media and the CDN | 20 |
| [S3 — Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html) | the concept section | 10 |

---

## 3. Open these files, in this order

| # | File | What to look for |
|---|---|---|
| 1 | `apps/api/src/platform/storage/storage.port.ts` | The port. **No S3 concept leaks through it** — no bucket, no region, no SigV4 |
| 2 | `apps/api/src/platform/storage/factory.ts` | One variable, three adapters |
| 3 | `apps/api/src/platform/storage/s3.adapter.ts` | `presignPut()`. **Find `signableHeaders`** and read the comment — content-type and content-length are *signed*, not hints |
| 4 | `apps/api/src/platform/storage/local.adapter.ts` | The same *contract*, implemented with an HMAC. A deliberate miniature of SigV4 |
| 5 | `apps/api/src/modules/media/media.routes.ts` | `PUT /uploads` — the local stand-in for R2, verifying HMAC, expiry, type and length before a byte is written |
| 6 | `apps/api/src/modules/media/media.service.ts` | `presign()` → `commit()` → `process()` → `serve()`. The whole lifecycle in one file |
| 7 | `apps/api/src/modules/media/media.service.ts` | `process()` specifically. Magic-byte check, **full re-decode**, EXIF strip, four derivatives, blurhash |
| 8 | `apps/api/src/platform/media/urls.ts` | Media addressed by **id and width**, never by storage key |
| 9 | `apps/web/src/features/vehicle/photo-uploader.tsx` | The client. Compress → presign → **PUT direct to storage** → commit → poll |
| 10 | `apps/web/src/app/api/dealer/media/presign/route.ts` | The BFF handler. Only the *signing* call is proxied |
| 11 | `apps/api/src/modules/dealers/dealers.service.ts` | Find the KYC document path. `signedReadUrl` — a completely different delivery model |

---

## 4. Do

### 4.1 Watch the three-step upload in DevTools

Open the dealer console → add a vehicle → photos. DevTools → Network, then upload
one photo. You should see exactly three requests:

| # | Request | Host | Carries the bytes? |
|---|---|---|---|
| 1 | `POST /api/dealer/media/presign` | localhost:3000 | no — metadata only |
| 2 | `PUT <signed url>` | **:4000 or :9000, not :3000** | **yes** |
| 3 | `POST /api/dealer/media/<id>` (commit) | localhost:3000 | no |
| 4+ | `GET /api/dealer/media/<id>` (poll) | localhost:3000 | no |

**Request 2 goes to a different host from the rest of the page.** That is the
whole point. Note its `Content-Type` and `Content-Length` headers — those exact
values are baked into the signature.

### 4.2 Break the signature four ways

Copy a presigned URL from §4.1 (it lives for 300 seconds) and try:

```bash
URL='<paste the presigned url>'

# 1. wrong content-type
curl -X PUT "$URL" -H 'Content-Type: text/plain' --data-binary @some.jpg -i | head -3

# 2. wrong length (send a different file)
curl -X PUT "$URL" -H 'Content-Type: image/jpeg' --data-binary @different.jpg -i | head -3

# 3. tampered signature — change one character in the URL
# 4. wait 6 minutes, then retry
```

Every one is refused **by the storage layer**, before a byte is stored. Read
`local.adapter.ts` `verifySignature()` and `media.routes.ts`'s `PUT /uploads` to
see exactly which check caught each.

> This is why `commit()` can trust what it finds. The object store has already
> guaranteed the bytes match what was declared.

### 4.3 Watch processing happen

```sql
SELECT id, status, "mimeType", bytes, width, height,
       left(blurhash, 12) AS blurhash, variants, warnings
FROM media ORDER BY "createdAt" DESC LIMIT 3;
```

Upload a photo and watch the row go `PENDING` → `READY`, with `variants`
filling in with four widths. Then look at what landed:

```bash
find apps/api/.storage/vehicles -type f | tail -10     # STORAGE_DRIVER=local
```

One `original` plus `320.webp`, `640.webp`, `1024.webp`, `1600.webp`.

### 4.4 Prove EXIF is stripped

This is a privacy control, not a nicety — **the GPS coordinates of a dealer's
yard are PII**.

```bash
# a photo with GPS data, before upload
exiftool -gps:all your-photo.jpg          # brew install exiftool

# after processing
exiftool apps/api/.storage/vehicles/<...>/1024.webp
```

Nothing. Read `process()` in `media.service.ts`: it calls `.rotate()` to
auto-orient *from* EXIF and then re-encodes, which drops every tag with it.

Note it is stripped **twice** — the browser's canvas re-encode in
`photo-uploader.tsx` drops it before upload, and the server drops it again. The
comment says it plainly: the client-side strip is a courtesy, not the guarantee.

### 4.5 Understand why the server fully re-decodes

Read the comment on `process()`:

> *fully re-decodes rather than transforming in place — the only reliable defence
> against polyglot files*

A **polyglot** is a file that is a valid JPEG *and* a valid HTML/JS payload
depending on who parses it. Transforming in place can preserve the malicious
parts. Decoding to raw pixels and re-encoding cannot — the output is
reconstructed from pixel data alone.

Also note the magic-byte check: `Content-Type` is a *claim by the client* and is
never trusted. `sharp` reads the actual bytes.

### 4.6 The two delivery models, side by side

**Vehicle photos — public, immutable, cacheable:**

```bash
curl -sI "http://localhost:4000/media/vehicles/by-media/<mediaId>/640.webp" \
  | grep -i "cache-control\|cross-origin"
```

`public, max-age=31536000, immutable`. **One year, never revalidate.** Safe only
because a new upload gets a new media id and therefore a new URL — cache
invalidation, the hard problem, removed by construction.

**KYC documents — private, signed, minutes:**

```bash
grep -rn "signedReadUrl" apps/api/src
```

No public route exists for them at all. The only way one is ever served is a
short-lived signed URL, and every issue is audit-logged.

Fill in the contrast:

| | Vehicle photo | KYC document |
|---|---|---|
| Bucket | | |
| Delivery | | |
| Who may see it | | |
| CDN cacheable? | | |

### 4.7 Find the scaling issue waiting in the configuration

```bash
grep -n "MEDIA_BASE_URL" deploy/aws/env.production.example \
  apps/api/src/platform/media/urls.ts
```

In production today, `MEDIA_BASE_URL` points at **the API**. So every `<img>` on
every search page proxies bytes back through a Node process and out of the ALB.

Read §33.3. **This is the highest-leverage scaling change available, and it is
one environment variable.** Day 20 returns to it — but you found it today, in the
config, which is exactly how you should find these things.

---

## 5. Prove you understood it

1. What is wrong with `POST /upload` carrying the file body? → *§14.1*
2. Describe the three steps of the upload, and say which one carries the bytes. → *§14.2*
3. Why does the presign step exist at all — why not let the browser sign? → *§14.3*
4. What are `signableHeaders`, and what attack do they stop? → *§34-D2, `s3.adapter.ts`*
5. Why does `commit()` exist as a separate step? → *§14.4*
6. Why does the processor re-decode rather than transform in place? → *§14.2, `media.service.ts`*
7. Why is EXIF stripped, and why twice? → *`media.service.ts`, `photo-uploader.tsx`*
8. Why is media addressed by id and width rather than by storage key? → *`urls.ts`, §34-D4*
9. Why is `Cache-Control: immutable` safe here? → *§34-D4*
10. How does KYC document delivery differ, and why? → *§14.7, §34-D3*
11. Why are MinIO and R2 the same adapter? → *`s3.adapter.ts` doc comment*

---

## 6. Traps

- **Never trust `Content-Type`.** It is a claim. Check magic bytes.
- **helmet's default `Cross-Origin-Resource-Policy: same-origin`** blocks
  cross-origin image embedding. The media route sends `cross-origin`
  deliberately; the JSON API keeps the strict default. Already paid for once —
  `CONTEXT.md` §9.
- **The R2 bucket's CORS rule must allow `PUT` from that environment's origin
  only.** A shared rule makes the bucket separation decorative.
- **`STORAGE_DRIVER=local` is refused in production** — container filesystems are
  not durable. `env.ts` enforces it.

---

## 7. Deliverable

- [ ] I watched all three upload requests and confirmed only one carries bytes
- [ ] I broke a presigned URL four ways and located the check that caught each
- [ ] I watched a media row go `PENDING` → `READY` with four variants
- [ ] I proved EXIF is stripped from the output
- [ ] I can explain the polyglot defence in my own words
- [ ] I filled in the photo-vs-KYC delivery contrast table
- [ ] I found the `MEDIA_BASE_URL` scaling issue in the production config
- [ ] I have answered all eleven questions in §5

---

## 8. Going deeper — Week 3 checkpoint

> **Say this out loud, to another person, without notes:**
> *"A dealer publishes a car. Describe every row written, every credit moved,
> every job queued, and the exact moment the car becomes publicly visible."*

That question spans Days 11–15. If any part of it is vague, the day to repeat is
named in your own answer.

Optional reading:

- **Part 24, Journey 4** — a dealer uploads photos, written as a trace.
- **Part 25.4** — "What happens if…" for storage: the upload never happens,
  commit without an upload, a size mismatch, a wrong content type.
