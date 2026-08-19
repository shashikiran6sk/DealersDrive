# syntax=docker/dockerfile:1
#
# Multi-stage, workspace-aware build for apps/api.
#
# Build from the REPO ROOT — the build context is the whole monorepo, because
# the API imports `@dealers-drive/contracts` from a sibling workspace:
#
#   docker build -f apps/api/Dockerfile -t dealers-drive-api .
#
# Two useful targets:
#   --target runner    (default) the HTTP process. Production dependencies only.
#   --target migrator  dev dependencies kept, so `prisma migrate deploy` and
#                      `pnpm db:seed` (which runs through tsx) both work.

FROM node:22-alpine AS base
# openssl: Prisma's query engine links against it on musl.
# libc6-compat: the glibc shim `sharp` and `@node-rs/argon2` prebuilds expect.
RUN apk add --no-cache openssl libc6-compat
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=true
RUN corepack enable
WORKDIR /app

# --- dependencies (cached until a manifest or the lockfile changes) ---------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile

# --- build ------------------------------------------------------------------
FROM deps AS build
COPY . .
# The generated Prisma client is a build artefact, not a checked-in file, and
# nothing that imports `@prisma/client` type-checks until it exists.
RUN pnpm --filter @dealers-drive/api exec prisma generate \
 && pnpm --filter @dealers-drive/contracts build \
 && pnpm --filter @dealers-drive/api build

# --- migrator ---------------------------------------------------------------
# Schema owner. Runs to completion and exits; it is not a server.
#   docker run --rm dealers-drive-migrator pnpm --filter @dealers-drive/api db:migrate:deploy
# It keeps dev dependencies on purpose: `prisma` (the CLI) and `tsx` (the seed
# runs TypeScript directly) are both devDependencies, and a production-only
# install would have neither.
FROM build AS migrator
ENV NODE_ENV=development
WORKDIR /app/apps/api
# Non-root, like the runtime image. Nothing here writes to the filesystem —
# `prisma migrate deploy` and `db:bootstrap` only talk to the database — so the
# root the build stage left behind buys nothing and is one more thing a
# compromised migration could use. Verified: both commands run as `node`.
USER node
CMD ["pnpm", "db:migrate:deploy"]

# --- runtime ----------------------------------------------------------------
FROM base AS runner
# The commit this image was built from. It configures nothing — it names the
# artifact, and `/health/ready` reports it so a deploy (and a promotion) can
# verify which build is actually serving.
ARG GIT_SHA=unknown
ENV NODE_ENV=production \
    GIT_SHA=$GIT_SHA
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile --prod --filter @dealers-drive/api...

# `prisma generate` has to run against the *production* install: the client it
# writes lives beside the copy of @prisma/client this image will actually load.
# The CLI itself is a dev dependency, so it is fetched for this one command and
# never becomes part of the image's dependency tree.
COPY apps/api/prisma apps/api/prisma
RUN pnpm dlx prisma@6.19.3 generate --schema=apps/api/prisma/schema.prisma \
 && rm -rf /pnpm/store /root/.local/share/pnpm /root/.cache

COPY --from=build /app/packages/contracts/dist packages/contracts/dist
COPY --from=build /app/apps/api/dist apps/api/dist

# STORAGE_DRIVER=local writes here, relative to the working directory. Creating
# it owned by `node` matters: Docker seeds a fresh named volume from the image,
# ownership included, and a root-owned mount point is unwritable to this user.
RUN mkdir -p /app/.storage && chown node:node /app/.storage

# Render (and most PaaS) inject $PORT; env.ts coerces and validates it.
ENV PORT=4000
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node
CMD ["node", "apps/api/dist/index.js"]
