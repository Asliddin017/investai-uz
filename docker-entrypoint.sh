#!/bin/sh
set -e

PRISMA="node /tools/node_modules/prisma/build/index.js"
SCHEMA="/tools/prisma/schema.prisma"

# schema.prisma has directUrl = env("DIRECT_URL"); on the server it is the same database.
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"

echo "[entrypoint] Applying migrations..."
$PRISMA migrate deploy --schema "$SCHEMA"

if [ "${SKIP_SEED:-0}" != "1" ]; then
  # Idempotent: creates only the admin login (password SEED_PASSWORD) unless SEED_DEMO=1.
  echo "[entrypoint] Seeding (idempotent)..."
  (cd /tools && node node_modules/tsx/dist/cli.mjs prisma/seed.ts)
fi

echo "[entrypoint] Starting Next.js on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec node /app/server.js
