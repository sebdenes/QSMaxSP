# Learnings Log

Tracks corrections, knowledge gaps, and best practices discovered during development.
See the self-improvement skill for the full logging format and workflow.

---

## [LRN-20260222-001] best_practice

**Logged**: 2026-02-22T14:00:00Z
**Priority**: high
**Status**: promoted
**Area**: frontend

### Summary
Scenario category keys in `scenario-details.ts` MUST exactly match the strings in `SCENARIO_TYPES` in `QuickSizer.tsx` — any mismatch silently produces empty T-shirt sizing cards.

### Details
The Quick Sizer wizard resolves sizing data via `SCENARIO_DETAILS[type as ScenarioType]?.[scenario]`.
The `type` value comes from `SCENARIO_TYPES` in the UI. If the category key in `scenario-details.ts`
differs even by whitespace or capitalisation, the lookup returns `undefined` and the card renders
empty with zero service days — no runtime error is thrown.

This is the single most common source of "empty" sizing cards and is non-obvious because the
failure is silent.

### Suggested Action
After any rename, regeneration, or workbook import, run the diagnostic script:
```bash
python skills/sap-quicksizer-scenario-data/scripts/diagnose_scenario_data.py \
  <path-to-scenario-details.ts> \
  <path-to-QuickSizer.tsx>
```
Also grep for exact string equality:
```bash
grep -n '"<scenario name>"' components/QuickSizerApp.tsx data/domain_model.json
```

### Metadata
- Source: sap-quicksizer-scenario-data skill
- Related Files: components/QuickSizerApp.tsx, data/domain_model.json
- Tags: scenario-data, t-shirt-sizing, silent-failure, data-alignment
- Pattern-Key: harden.scenario_category_key_alignment
- Recurrence-Count: 1
- First-Seen: 2026-02-22
- Last-Seen: 2026-02-22

---

## [LRN-20260222-002] best_practice

**Logged**: 2026-02-22T14:00:00Z
**Priority**: high
**Status**: promoted
**Area**: backend

### Summary
The workbook parser must use only rows where `Custom == 0` (group header rows) to avoid double-counting individual line items as service packages.

### Details
The Excel workbook has two row types per scenario sheet:
- **Group header rows** (`Custom == 0`): represent SAP service packages — these are the correct source for T-shirt day values.
- **Line item rows** (`Custom != 0`): individual tasks within a package — including these inflates service day totals.

Column indices (0-based): `name=col1`, `S=col4`, `M=col5`, `L=col6`.
Row 2 (index 1) contains package totals (`effortBySize`); rows 3+ are individual services (`servicesBySize`).

### Suggested Action
Always filter `Custom == 0` in `scripts/importWorkbook.ts` and `lib/importWorkbook.ts` before
extracting service day values.

### Metadata
- Source: sap-quicksizer-scenario-data skill
- Related Files: scripts/importWorkbook.ts, lib/importWorkbook.ts
- Tags: workbook-import, data-parsing, custom-column
- Pattern-Key: harden.workbook_custom_column_filter
- Recurrence-Count: 1
- First-Seen: 2026-02-22
- Last-Seen: 2026-02-22

---

## [LRN-20260222-003] best_practice

**Logged**: 2026-02-22T14:00:00Z
**Priority**: medium
**Status**: promoted
**Area**: backend

### Summary
PDF export is intentionally disabled; the `/api/engagements/:id/export?format=pdf` endpoint returns `400`. Do not attempt to re-enable without explicit product decision.

### Details
The README explicitly states: "Engagement PDF export is intentionally disabled in this build."
The route returns HTTP 400. This is a product-level decision, not a bug. Re-enabling it requires
updating `lib/exporters.ts` and the route handler, as well as adding PDF generation dependencies.

### Suggested Action
If PDF export is needed, create a tracked backlog item before touching the export route.

### Metadata
- Source: conversation
- Related Files: lib/exporters.ts, app/api/engagements/[id]/export/route.ts
- Tags: pdf-export, intentional-disable, product-decision
- Pattern-Key: simplify.pdf_export_disabled
- Recurrence-Count: 1
- First-Seen: 2026-02-22
- Last-Seen: 2026-02-22

---

## [LRN-20260222-004] best_practice

**Logged**: 2026-02-22T14:00:00Z
**Priority**: high
**Status**: promoted
**Area**: config

### Summary
The app runs in portable single-user mode by default (`AUTH_DISABLED=true`). Re-enabling multi-user auth requires setting both `AUTH_DISABLED=false` AND `NEXT_PUBLIC_AUTH_DISABLED=false`.

### Details
Two environment variables control auth mode:
- `AUTH_DISABLED` — server-side guard
- `NEXT_PUBLIC_AUTH_DISABLED` — client-side guard (controls login screen rendering)

Both must be changed together. Setting only one will cause a split-brain state where the server
expects auth but the client skips the login screen (or vice versa).

### Suggested Action
Document this two-variable contract in `.env.example` with a comment, and validate both are
consistent at startup (e.g., a startup assertion in `lib/auth.ts`).

### Metadata
- Source: conversation
- Related Files: lib/auth.ts, .env.example
- Tags: auth, environment-variables, single-user-mode, split-brain
- Pattern-Key: harden.auth_env_consistency
- Recurrence-Count: 1
- First-Seen: 2026-02-22
- Last-Seen: 2026-02-22

---

## [LRN-20260222-005] best_practice

**Logged**: 2026-02-22T14:00:00Z
**Priority**: medium
**Status**: pending
**Area**: infra

### Summary
The staging image is published to GHCR via a manual GitHub Actions workflow; there is no automated CD pipeline yet.

### Details
The workflow `.github/workflows/deploy-staging.yml` must be triggered manually from the Actions tab.
There is no automatic deploy on merge to `main`. This is a known gap documented in the production
backlog (Epic 1, Story 1).

### Suggested Action
Add a push-to-main trigger on the staging workflow as part of Wave 1 delivery (Epic 1).

### Metadata
- Source: conversation
- Related Files: .github/workflows/deploy-staging.yml, docs/PRODUCTION_BACKLOG.md
- Tags: ci-cd, staging, manual-deploy
- Pattern-Key: simplify.staging_cd_automation
- Recurrence-Count: 1
- First-Seen: 2026-02-22
- Last-Seen: 2026-02-22

---
