# syntax=docker/dockerfile:1
#
# Multi-stage, workspace-aware build for apps/web.
#
# Build from the REPO ROOT — the build context is the whole monorepo, because
# the web app imports `@dealers-drive/contracts` from a sibling workspace:
#
#   docker build -f apps/web/Dockerfile -t dealers-drive-web .
#
# THIS BUILD NEEDS NOTHING RUNNING. No API, no database, no network beyond the
# registry — and that is a requirement, not a convenience.
#
# Every route that reads data is `export const dynamic = 'force-dynamic'`, so
# `next build` prerenders no page that calls the API. If it did, the image
# would contain HTML — and a robots.txt — built from whichever environment the
# build machine could reach, and one image could no longer be promoted from dev
# to production (ARCHITECTURE §20.1). It is the same rule that bans
# NEXT_PUBLIC_*: nothing environment-specific is baked in. API_BASE_URL,
# WEB_BASE_URL and APP_ENV are read at *runtime*, on the server
# (apps/web/src/lib/config.ts, §15.3, Rule 9).
#
# The only build argument is GIT_SHA, which identifies the artifact rather than
# configuring it.

FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=true
RUN corepack enable
WORKDIR /app

# --- dependencies (cached until a manifest or the lockfile changes) ---------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile

# --- build ------------------------------------------------------------------
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
# `next.config.ts` sets `typescript.ignoreBuildErrors: false`, so this step is
# also the web app's type check. A type error fails the image build.
RUN pnpm --filter @dealers-drive/contracts build \
 && pnpm --filter @dealers-drive/web build

# --- runtime ----------------------------------------------------------------
FROM base AS runner
# The commit this image was built from. It configures nothing — it names the
# artifact, and `/api/health` reports it so a deploy can tell the new tasks
# from the old ones.
ARG GIT_SHA=unknown
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    GIT_SHA=$GIT_SHA
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile --prod --filter @dealers-drive/web... \
 && rm -rf /pnpm/store /root/.local/share/pnpm /root/.cache

# Neither next.config.ts nor tsconfig.json ships, and that is deliberate.
#
# `next build` serialises the resolved config into
# `.next/required-server-files.json`, which is what `next start` actually reads
# — verified: `poweredByHeader: false` still holds with no config file present.
# Shipping the *TypeScript* config is worse than useless: Next insists on the
# `typescript` package before it will load a `.ts` config, tries to install it
# on boot, and dies with EACCES because this image runs as `node`.
COPY --from=build /app/packages/contracts/dist packages/contracts/dist
COPY --from=build /app/apps/web/.next apps/web/.next

ENV PORT=3000
EXPOSE 3000

# `/api/health` rather than a page: it renders no data and calls no upstream,
# so it answers the one question a health check should ask — is this process
# serving — and never fails because something else is down.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node
WORKDIR /app/apps/web
CMD ["node_modules/.bin/next", "start"]
