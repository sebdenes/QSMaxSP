# Max Success Plan Premium Services Quicksizer

Web application to configure and size premium SAP service engagements from workbook-driven scenario data.

## Portable Single-User Mode (Default)

The app now runs in portable single-user mode by default:

- No login screen.
- A local admin profile is auto-created on first run.
- Users can save and reload projects directly in the app (Step 6 + header selector).

Environment flags:

- `AUTH_DISABLED=true`
- `NEXT_PUBLIC_AUTH_DISABLED=true`

To re-enable full multi-user auth, set both to `false` and enable signup/demo login as needed.

## Current Product Scope

- Guided 6-step flow:
  - Step 1: Context
  - Step 2: Scope
  - Step 3: Scenarios
  - Step 4: Sizing
  - Step 5: Expert Mode
  - Step 6: Project Summary / Save
- Scenario selection grouped by scenario type with validation requiring at least one scenario per selected type.
- Per-scenario sizing supports mixed modes:
  - T-shirt sizing (`S`, `M`, `L`) per scenario.
  - Custom sizing per scenario with service-level days.
- Expert Mode is only active when at least one selected scenario is set to Custom.
- Back navigation is history-based and context-safe across all steps.
- Review page shows scenario/service lines, scenario totals, and grand totals.

## Exports

- Engagement CSV export includes metadata, scenario summary, service detail, scenario totals, and grand total.
- Engagement PDF export is intentionally disabled in this build (`/api/engagements/:id/export?format=pdf` returns `400`).

## Tech Stack

- Next.js 15 + TypeScript
- Prisma + PostgreSQL
- Workbook/domain artifacts in `data/*.json`

## Setup

```bash
git clone git@github.com:sebdenes/QSMaxSP.git
cd QSMaxSP
cp .env.example .env
docker compose up -d postgres
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

## Run Locally

```bash
npm run dev -- --hostname 127.0.0.1 --port 3000
```

App URL:

- `http://127.0.0.1:3000`

## Save Projects

- Use **Save Project** in Step 6.
- Reload saved projects from the header dropdown (**Load Saved Project**).

## Quality Checks

```bash
npm run typecheck
npm test
npm run test:integration
npm run build
```

## Health Endpoints

- Liveness: `GET /api/health/live`
- Readiness (DB check): `GET /api/health/ready`

## Key Paths

- Frontend: `app/page.tsx`, `components/QuickSizerApp.tsx`
- Auth + single-user mode: `app/api/auth/*`, `lib/auth.ts`
- Engagement APIs: `app/api/engagements/*`
- Scenario APIs: `app/api/scenarios/*`
- Workbook APIs: `app/api/workbook/route.ts`, `app/api/import-workbook/route.ts`
- Export logic: `lib/exporters.ts`
- Import logic: `scripts/importWorkbook.ts`, `lib/importWorkbook.ts`, `lib/domainSync.ts`
