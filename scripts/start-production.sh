#!/usr/bin/env sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required"
  exit 1
fi

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Starting Next.js server..."
exec npm run start -- --hostname 0.0.0.0 --port "${PORT:-3000}"
