# syntax=docker/dockerfile:1
#
# Multi-stage, workspace-aware build for apps/web.
#
# Build from the REPO ROOT — the build context is the whole monorepo, because
# the web app imports `@dealers-drive/contracts` from a sibling workspace:
#
#   docker build -f apps/web/Dockerfile -t dealers-drive-web .
#
# THE API MUST BE RUNNING, MIGRATED AND SEEDED BEFORE THIS IMAGE IS BUILT.
#
# The public marketplace pages are ISR (`export const revalidate`, ARCHITECTURE
# §15.1), which means `next build` prerenders them — and prerendering them
# *calls the API* over API_BASE_URL. With nothing listening the build fails on
# `/dealers`, `/sitemap.xml` and friends with ECONNREFUSED. This is the same
# ordering constraint `deploy/release.sh` documents, and it is why the compose
# file starts `api` before it builds `web`.
#
# BUILD_API_BASE_URL is the address the *builder* uses to reach the API, and it
# exists only during the build. `host.docker.internal` is the host as seen from
# a build container: on Docker Desktop it resolves out of the box, on Linux it
# needs `--add-host=host.docker.internal:host-gateway` (compose passes it).
#
# There is deliberately no NEXT_PUBLIC_* build argument, and this one is not a
# substitute for the runtime value: API_BASE_URL and WEB_BASE_URL are read at
# *runtime* on the server (apps/web/src/lib/config.ts, ARCHITECTURE §15.3,
# Rule 9), so the same image still runs in every environment.

FROM node:22-alpine AS base
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
ARG BUILD_API_BASE_URL=http://host.docker.internal:4000
ENV NEXT_TELEMETRY_DISABLED=1 \
    API_BASE_URL=$BUILD_API_BASE_URL
COPY . .
# `next.config.ts` sets `typescript.ignoreBuildErrors: false`, so this step is
# also the web app's type check. A type error fails the image build.
RUN pnpm --filter @dealers-drive/contracts build \
 && pnpm --filter @dealers-drive/web build

# --- runtime ----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
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

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node
WORKDIR /app/apps/web
CMD ["node_modules/.bin/next", "start"]
