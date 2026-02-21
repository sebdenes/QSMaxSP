# Staging Runbook

## 1) Prerequisites

- Docker and Docker Compose installed.
- PostgreSQL connection string available for staging.
- Environment variables configured (`DATABASE_URL`, `ALLOW_SELF_SIGNUP`, `ALLOW_DEMO_LOGIN`).

## 2) Build Container

```bash
docker build -t quicksizer:staging .
```

## 3) Start Staging Container

```bash
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/quicksizer?schema=public" \
  -e ALLOW_SELF_SIGNUP="false" \
  -e ALLOW_DEMO_LOGIN="false" \
  -e NODE_ENV="production" \
  --name quicksizer-staging \
  quicksizer:staging
```

The container startup script runs `prisma migrate deploy` before starting Next.js.

## 4) Health Checks

- Liveness: `GET /api/health/live`
- Readiness: `GET /api/health/ready`

Examples:

```bash
curl -i http://127.0.0.1:3000/api/health/live
curl -i http://127.0.0.1:3000/api/health/ready
```

`/api/health/ready` returns `503` when database connectivity is unavailable.

## 5) Release Checklist

- Run CI green (`typecheck`, unit tests, integration tests, build).
- Validate login and role restrictions.
- Validate engagement save/export flows.
- Confirm `ALLOW_SELF_SIGNUP=false` and `ALLOW_DEMO_LOGIN=false` in staging/production.

## 6) Rollback

- Re-run previous container image tag.
- Do not roll back DB schema manually without migration plan.
