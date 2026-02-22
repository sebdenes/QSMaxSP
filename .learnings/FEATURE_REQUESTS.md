# Feature Requests Log

Tracks user-requested capabilities and missing features.
See the self-improvement skill for the full logging format and workflow.

---

## [FEAT-20260222-001] pdf-export-re-enable

**Logged**: 2026-02-22T14:00:00Z
**Priority**: medium
**Status**: pending
**Area**: backend

### Requested Capability
Re-enable PDF export for engagement summaries (`/api/engagements/:id/export?format=pdf`).

### User Context
The CSV export is functional, but stakeholders may want a formatted PDF for sharing engagement proposals. The endpoint currently returns `400` by design.

### Complexity Estimate
medium

### Suggested Implementation
- Add a PDF generation library (e.g., `@react-pdf/renderer` or `puppeteer`).
- Implement the export logic in `lib/exporters.ts` mirroring the CSV structure.
- Remove the `400` guard in the export route handler.
- Add unit tests in `tests/exporters.unit.test.ts`.

### Metadata
- Frequency: first_time
- Related Features: CSV export (`lib/exporters.ts`)

---

## [FEAT-20260222-002] automated-cd-pipeline

**Logged**: 2026-02-22T14:00:00Z
**Priority**: high
**Status**: pending
**Area**: infra

### Requested Capability
Automatic deployment to staging on every merge to `main`, without requiring manual workflow dispatch.

### User Context
Currently the staging image must be manually triggered from the GitHub Actions tab. This slows down iteration and risks staging falling behind main.

### Complexity Estimate
simple

### Suggested Implementation
- Add `on: push: branches: [main]` trigger to `.github/workflows/deploy-staging.yml`.
- Optionally add a deployment environment gate for production promotion.

### Metadata
- Frequency: first_time
- Related Features: GHCR publish workflow, staging runbook

---

## [FEAT-20260222-003] e2e-test-suite

**Logged**: 2026-02-22T14:00:00Z
**Priority**: medium
**Status**: pending
**Area**: tests

### Requested Capability
End-to-end tests covering the full 6-step wizard journey (context → scope → scenarios → sizing → expert mode → save/export).

### User Context
Currently only unit and API integration tests exist. The full wizard flow (including back navigation, mixed sizing modes, and expert mode gating) is untested at the E2E level.

### Complexity Estimate
complex

### Suggested Implementation
- Use Playwright or Cypress.
- Cover: mixed T-shirt + custom sizing, expert mode activation/deactivation, back navigation, CSV export download.
- Run in CI as a separate job against a seeded ephemeral database.

### Metadata
- Frequency: first_time
- Related Features: API integration tests (`tests/api.integration.test.ts`)

---
