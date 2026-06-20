# syntax=docker/dockerfile:1

# Bally's Dashboard — single-container image.
# Uses Debian slim (glibc) so better-sqlite3 installs from prebuilt binaries on
# both linux/amd64 and linux/arm64 (no compiler toolchain needed). amd64 is the
# primary target; arm64 builds from the same file (ADR 0009 / Q10).

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN corepack enable

# --- deps: install production + dev deps for the build -----------------------
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# --- builder: compile the standalone Next.js output -------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# --- runner: minimal runtime image ------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 \
    DATABASE_PATH=/app/data/ballys.db

# Run as non-root.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone server + static assets.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Migrations are read at runtime by instrumentation.ts.
COPY --from=builder --chown=nextjs:nodejs /app/src/db/migrations ./src/db/migrations

# Data volume (sqlite db + uploaded icons).
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data
VOLUME ["/app/data"]

USER nextjs
EXPOSE 3000

# Readiness probe: healthy only once the DB is migrated + reachable (not just the
# process up). start-period covers boot migrations.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
