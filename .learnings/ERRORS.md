# Errors Log

Tracks command failures, exceptions, and unexpected behaviours encountered during development.
See the self-improvement skill for the full logging format and workflow.

---

## [ERR-20260222-001] prisma-migrate-deploy

**Logged**: 2026-02-22T14:00:00Z
**Priority**: high
**Status**: pending
**Area**: infra

### Summary
`prisma migrate deploy` runs at container startup; if `DATABASE_URL` is not set or the database is unreachable, the container will crash before Next.js starts.

### Error
```
Error: P1001: Can't reach database server at `<host>`:`<port>`
```

### Context
- The `scripts/start-production.sh` script runs `prisma migrate deploy` before `next start`.
- If the database is not yet ready (e.g., cold start race condition in Docker Compose), the migration command fails and the process exits non-zero.
- The readiness probe at `/api/health/ready` will catch this, but the container may restart-loop before the probe is checked.

### Suggested Fix
Add a `wait-for-it` or `pg_isready` loop in `start-production.sh` before running migrations to handle database startup latency.

### Metadata
- Reproducible: yes
- Related Files: scripts/start-production.sh, docker-compose.yml
- See Also: (none yet)

---

## [ERR-20260222-002] next-build-type-errors

**Logged**: 2026-02-22T14:00:00Z
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
`npm run build` can succeed even when `npm run typecheck` reports type errors because Next.js 15 does not fail the build on TypeScript errors by default.

### Error
```
Type error: ... (only visible via `tsc --noEmit`, not `next build`)
```

### Context
- `next.config.ts` does not set `typescript.ignoreBuildErrors: false` explicitly.
- Developers may ship type-unsafe code if they only run `npm run build` without `npm run typecheck`.

### Suggested Fix
Add `typescript: { ignoreBuildErrors: false }` to `next.config.ts`, or enforce `npm run typecheck` as a required CI step before build.

### Metadata
- Reproducible: yes
- Related Files: next.config.ts, package.json
- See Also: (none yet)

---
