# Production Backlog

## Prioritization Model

- `P0`: required before production launch.
- `P1`: required for stable scale-out after first production release.
- `P2`: optimization and operational maturity.

## Epic 1: Platform Foundation (P0)

Goal: move from prototype runtime to production-grade runtime and delivery.

### Stories

1. `P0` Replace local SQLite with managed PostgreSQL
- Deliverables: Prisma configured for PostgreSQL, migration files under `prisma/migrations`, documented local Postgres bootstrap.
- Acceptance criteria: app can run with Postgres end-to-end, migrations apply on clean DB.

2. `P0` Establish CI quality gate
- Deliverables: GitHub Actions workflow for install, Prisma generate/migrate, build, and tests.
- Acceptance criteria: PRs and pushes run CI; red pipeline blocks merge.

3. `P0` Define release strategy and environments
- Deliverables: `dev/stage/prod` deployment strategy, environment variable contract, rollback approach.
- Acceptance criteria: documented release checklist and rollback runbook.

## Epic 2: Identity, Access, and Security (P0)

Goal: protect customer and engagement data for enterprise usage.

### Stories

1. `P0` Integrate enterprise SSO (OIDC/SAML)
- Deliverables: SSO login path, disable demo auth in production.
- Acceptance criteria: only enterprise identities can access production.

2. `P0` Implement role-based access control
- Deliverables: roles (`Admin`, `Planner`, `Viewer`) and authorization checks on APIs.
- Acceptance criteria: unauthorized actions are denied and audited.

3. `P0` Secret and configuration hardening
- Deliverables: secrets manager usage, zero plaintext secrets in repo.
- Acceptance criteria: secret scanning passes; production secrets rotated and documented.

4. `P1` Security scanning and dependency governance
- Deliverables: SCA + container scan in CI, dependency update policy.
- Acceptance criteria: high/critical vulnerabilities block release.

## Epic 3: Functional Reliability and Quality (P0)

Goal: ensure consistent behavior across sizing, exports, and navigation.

### Stories

1. `P0` Unit test baseline for core business logic
- Deliverables: tests for spread normalization, sizing calculations, CSV/PDF output builders.
- Acceptance criteria: tests run in CI with deterministic results.

2. `P0` API integration tests
- Deliverables: test coverage for auth, scenario selection, engagement save, export endpoints.
- Acceptance criteria: core API flows pass against ephemeral database.

3. `P1` E2E user journey tests
- Deliverables: full wizard tests (mixed sizing, expert mode gating, back navigation, export).
- Acceptance criteria: critical user journey passes on each release candidate.

## Epic 4: Observability and Operations (P1)

Goal: make production supportable with measurable SLAs.

### Stories

1. `P1` Structured logging and request correlation
- Deliverables: request IDs, structured API logs, error context.
- Acceptance criteria: incidents are traceable end-to-end.

2. `P1` Error monitoring and alerting
- Deliverables: runtime error tracking, alert thresholds for export/import/auth failures.
- Acceptance criteria: alerts fire within SLA for critical failure patterns.

3. `P1` Backup, restore, and DR checks
- Deliverables: automated backup policy and restore test cadence.
- Acceptance criteria: restore drill succeeds within target RTO/RPO.

## Epic 5: Product Governance and Adoption (P1)

Goal: run controlled rollout and collect operational/product feedback.

### Stories

1. `P1` Pilot rollout playbook
- Deliverables: test cohort plan, feedback triage workflow, issue severity policy.
- Acceptance criteria: pilot completes with documented decisions for GA.

2. `P1` Analytics and KPI instrumentation
- Deliverables: funnel metrics, completion rates by step, export success metrics.
- Acceptance criteria: weekly KPI dashboard for product steering.

3. `P2` Documentation and enablement pack
- Deliverables: admin guide, user guide, implementation notes, FAQ.
- Acceptance criteria: onboarding can be completed without engineering support.

## Delivery Waves

- Wave 1 (Now): Epic 1 stories 1-2 and Epic 3 story 1.
- Wave 2: Epic 2 + Epic 3 story 2.
- Wave 3: Epic 4 + Epic 5 + Epic 3 story 3.
