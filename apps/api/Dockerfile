# syntax=docker/dockerfile:1
#
# Multi-stage, workspace-aware build for apps/api.
# Build from the REPO ROOT:  docker build -f apps/api/Dockerfile -t dealers-drive-api .
#
# Day 2 hardens this (layer caching in CI, image-tag rollback, size budget).

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=true
RUN corepack enable
WORKDIR /app

# --- dependencies (cached on lockfile changes only) -------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile

# --- build ------------------------------------------------------------------
FROM deps AS build
COPY . .
RUN pnpm --filter @dealers-drive/contracts build \
 && pnpm --filter @dealers-drive/api build

# --- runtime ----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
COPY packages/config/package.json packages/config/
RUN pnpm install --frozen-lockfile --prod --filter @dealers-drive/api...

COPY --from=build /app/packages/contracts/dist packages/contracts/dist
COPY --from=build /app/apps/api/dist apps/api/dist

# Render (and most PaaS) inject $PORT; env.ts coerces and validates it.
ENV PORT=4000
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node
CMD ["node", "apps/api/dist/index.js"]
