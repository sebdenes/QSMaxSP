# Engineering Pipeline

## Branching and Delivery

1. Create feature branches from `main`.
2. Open PR with test evidence.
3. Merge only when CI is green.
4. Tag release (`vX.Y.Z`) to publish desktop artifacts.

## Required CI Checks

The `CI` workflow executes:

- `npm run typecheck`
- `npm test`
- `npm run test:integration`
- `npm run build`

## Desktop Release Workflow

Workflow: `.github/workflows/desktop-release.yml`

- Manual run (`workflow_dispatch`) for pilot builds.
- Automatic release build on version tags (`v*`).
- Produces:
  - macOS ZIP (`QSMaxSP-*.zip`)
  - Windows portable EXE artifacts

## Triage Loop

1. Bugs enter via issue template.
2. Product owner sets priority (`P0/P1/P2`).
3. Fix branch references issue ID.
4. PR template includes regression test checklist.
5. Tag patch release after merge (`vX.Y.Z`).

## Definition of Done

- Acceptance criteria satisfied.
- CI green.
- Desktop smoke tested on changed platform.
- README and release notes updated.
