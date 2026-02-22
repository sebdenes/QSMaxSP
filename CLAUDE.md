# CLAUDE.md — QSMaxSP Project Facts & Conventions

This file is injected into every Claude/AI agent session for this repository.
Keep entries concise and actionable. For full context, see `.learnings/`.

---

## Project Overview

**Max Success Plan Premium Services Quicksizer** — a Next.js 15 + TypeScript + Prisma/PostgreSQL
web app for configuring and sizing SAP Premium Service engagements via a 6-step guided wizard.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 18, TypeScript |
| Database ORM | Prisma 5.22 + PostgreSQL |
| Package manager | **npm** (not pnpm/yarn) — use `npm install` |
| Test runner | Node.js built-in `--test` with `tsx` |
| Container | Docker + Docker Compose |

---

## Key Paths

| Concern | Path |
|---------|------|
| Main UI entry | `app/page.tsx`, `components/QuickSizerApp.tsx` |
| Auth + single-user mode | `app/api/auth/*`, `lib/auth.ts` |
| Engagement APIs | `app/api/engagements/*` |
| Scenario APIs | `app/api/scenarios/*` |
| Workbook APIs | `app/api/workbook/route.ts`, `app/api/import-workbook/route.ts` |
| Export logic | `lib/exporters.ts` |
| Import logic | `scripts/importWorkbook.ts`, `lib/importWorkbook.ts`, `lib/domainSync.ts` |
| Domain data | `data/domain_model.json`, `data/totals.json`, `data/visibility.json` |

---

## Auth Mode

The app runs in **portable single-user mode** by default:
- `AUTH_DISABLED=true` (server-side)
- `NEXT_PUBLIC_AUTH_DISABLED=true` (client-side)

**Both variables must be changed together** to re-enable multi-user auth. Setting only one
causes a split-brain state. See `LRN-20260222-004` in `.learnings/LEARNINGS.md`.

---

## Scenario Data — Critical Rule

> **Category keys in `data/domain_model.json` (or `scenario-details.ts`) MUST exactly match
> the strings used in `SCENARIO_TYPES` in `components/QuickSizerApp.tsx`.**

A mismatch silently produces empty T-shirt sizing cards with no runtime error.

After any scenario rename, workbook import, or data regeneration, run:
```bash
python skills/sap-quicksizer-scenario-data/scripts/diagnose_scenario_data.py \
  <path-to-scenario-details.ts> \
  components/QuickSizerApp.tsx
```

See `LRN-20260222-001` in `.learnings/LEARNINGS.md` for full details.

---

## Workbook Import

- Use **only rows where `Custom == 0`** (group header rows) — these are SAP service packages.
- Line item rows (`Custom != 0`) are individual tasks; including them inflates day totals.
- Column indices (0-based): `name=col1`, `S=col4`, `M=col5`, `L=col6`.
- After generation, manually assign each sheet to the correct category key.

See `LRN-20260222-002` in `.learnings/LEARNINGS.md`.

---

## PDF Export

PDF export is **intentionally disabled** — the endpoint returns `400`. Do not re-enable
without a tracked backlog item. See `LRN-20260222-003` and `FEAT-20260222-001`.

---

## Quality Checks (run before every PR)

```bash
npm run typecheck      # TypeScript — must pass (build does NOT fail on type errors by default)
npm test               # Unit tests
npm run test:integration  # Integration tests (requires running DB)
npm run build          # Production build
```

---

## Known Gaps (from `.learnings/`)

| ID | Area | Summary |
|----|------|---------|
| `ERR-20260222-001` | infra | Container can crash-loop if DB not ready at startup — no `wait-for-it` guard |
| `ERR-20260222-002` | frontend | `next build` does not fail on TypeScript errors by default |
| `FEAT-20260222-002` | infra | No automated CD on merge to `main` — staging deploy is manual |
| `FEAT-20260222-003` | tests | No E2E test suite for the full wizard journey |
