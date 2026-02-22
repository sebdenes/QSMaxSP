# Desktop Product Backlog

## Prioritization

- `P0`: required before broad user rollout.
- `P1`: required for stability and scale after pilot.
- `P2`: optimization and product growth.

## Epic 1: Desktop Runtime Hardening (P0)

Goal: keep the app one-click for business users while preserving all sizing behavior.

### Stories

1. `P0` Package signed executables for macOS and Windows.
- Acceptance: downloadable ZIP artifacts from GitHub Actions release workflow.

2. `P0` Keep local data persistence with zero external dependencies.
- Acceptance: app starts with embedded SQLite DB and saves/reloads projects offline.

3. `P0` Maintain CSV export completeness for all sizing combinations.
- Acceptance: CSV includes scenario/service details, scenario totals, and grand total.

## Epic 2: Quality and Regression Safety (P0)

Goal: ensure fast, safe iteration for enhancements and bug fixes.

### Stories

1. `P0` CI quality gate on all PRs.
- Acceptance: typecheck, unit tests, integration tests, and production build must pass.

2. `P0` Desktop release pipeline.
- Acceptance: workflow builds macOS and Windows artifacts on-demand and on version tags.

3. `P1` Expand automated journey coverage.
- Acceptance: add scenario-level test matrix for mixed `S/M/L/Custom` and back-navigation behavior.

## Epic 3: Change Management for User Feedback (P1)

Goal: convert pilot feedback into controlled, traceable releases.

### Stories

1. `P1` Bug and feature issue templates.
- Acceptance: every request is logged with repro steps/acceptance criteria.

2. `P1` PR template with mandatory validation checklist.
- Acceptance: no merge without declared test evidence.

3. `P1` Release notes discipline.
- Acceptance: each tagged release includes user-facing changes and known limitations.

## Epic 4: Product Improvements from Pilot (P1)

Goal: evolve UX without reintroducing complexity.

### Stories

1. `P1` Scenario list usability and filtering improvements.
2. `P1` Improved in-app onboarding hints for non-expert users.
3. `P2` Optional lightweight telemetry (opt-in) for anonymous usage health.

## Delivery Waves

- Wave 1 (now): Epic 1 + Epic 2.
- Wave 2: Epic 3.
- Wave 3: Epic 4.
