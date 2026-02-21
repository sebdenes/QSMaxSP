# Staging Runbook

## 1) Prerequisites

- Docker and Docker Compose installed.
- PostgreSQL connection string available for staging.
- Environment variables configured (`DATABASE_URL`, `ALLOW_SELF_SIGNUP`, `ALLOW_DEMO_LOGIN`).
- GitHub Actions workflow permissions allow package publishing (`packages: write`).

## 2) Build and Push Staging Image (GitHub Actions)

Workflow file: `.github/workflows/deploy-staging.yml`

Manual trigger:

1. Open GitHub repository `Actions` tab.
2. Select `Deploy Staging Image`.
3. Click `Run workflow`.
4. Optional: provide `image_tag` (for example `staging-qa1`).
5. Choose whether to also update `staging-latest`.

Published image path:

- `ghcr.io/<owner>/<repo>`

Typical tags pushed by workflow:

- `sha-<commit-sha>`
- `staging-<run-number>`
- `staging-latest` (optional)
- custom `image_tag` (optional)

## 3) Pull and Start Staging Container

```bash
docker pull ghcr.io/<owner>/<repo>:staging-latest

docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:postgres@host.docker.internal:5432/quicksizer?schema=public" \
  -e ALLOW_SELF_SIGNUP="false" \
  -e ALLOW_DEMO_LOGIN="false" \
  -e NODE_ENV="production" \
  --name quicksizer-staging \
  ghcr.io/<owner>/<repo>:staging-latest
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

- Run CI green (`typecheck`, unit tests, integration tests, build, container build).
- Validate login and role restrictions.
- Validate engagement save/export flows.
- Confirm `ALLOW_SELF_SIGNUP=false` and `ALLOW_DEMO_LOGIN=false` in staging/production.

## 6) Rollback

- Re-run previous container image tag.
- Do not roll back DB schema manually without migration plan.
