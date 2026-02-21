# Max Success Plan Premium Services Quicksizer

Web application to configure and size premium SAP service engagements from workbook-driven scenario data.

## Current Product Scope

- Authenticated multi-user app with per-user engagement ownership.
- Guided 6-step flow:
  - Step 1: Context
  - Step 2: Scope
  - Step 3: Scenarios
  - Step 4: Sizing
  - Step 5: Expert Mode
  - Step 6: Review
- Scenario selection grouped by scenario type, with validation requiring at least one scenario per selected type.
- Per-scenario sizing supports mixed modes:
  - T-shirt sizing (`S`, `M`, `L`) per scenario.
  - Custom sizing per scenario with service-level days.
- Expert Mode is only active when at least one selected scenario is set to Custom.
- Back navigation is history-based and context-safe across all steps.
- Review page shows scenario/service lines, scenario totals, and grand totals.

## Exports

- Engagement CSV export includes:
  - Metadata block
  - Scenario summary block
  - Service allocation detail block
  - Scenario totals and grand total
- Engagement PDF export includes:
  - Structured plan header and summary
  - Service-level rows
  - Scenario totals and grand total
- PDF export has a built-in fallback renderer to prevent hard failures in edge cases.

## Tech Stack

- Next.js 15 + TypeScript
- Prisma + SQLite
- Workbook/domain artifacts in `data/*.json`

## Setup

```bash
cd "/Users/I048171/Desktop/ProjectQuicksizer"
cp .env.example .env
npm install
npm run db:generate
npm run db:push
npm run db:seed
```

Default seeded account:

- email: `demo@quicksizer.local`
- password: `demo1234`

## Run Locally

```bash
cd "/Users/I048171/Desktop/ProjectQuicksizer"
source ~/.zshrc >/dev/null 2>&1 || true
source ~/.zprofile >/dev/null 2>&1 || true
npm run dev -- --hostname 127.0.0.1 --port 3000
```

App URL:

- `http://127.0.0.1:3000`

## Deployment Status

- Render deployment config has been intentionally removed from this repository.
- There is no supported `render.yaml` or Render-specific startup script in the current code line.
- Recommended usage is local runtime (`npm run dev`) or your own self-hosted/container deployment setup.

## Local Troubleshooting

If port 3000 is already in use:

```bash
lsof -ti tcp:3000 | xargs kill -9 2>/dev/null || true
```

If you hit a Next.js chunk/module runtime error (for example missing `.next` chunk files), clear build cache and restart:

```bash
rm -rf .next
npm run build
npm run dev -- --hostname 127.0.0.1 --port 3000
```

## Workbook Import

Workbook import is CLI-based:

```bash
npm run import:workbook -- --source /absolute/path/to/MaxEngagementQuickSizer_V1.xlsx
```

## API Export Endpoints

- Engagement export:
  - `GET /api/engagements/:id/export?format=csv`
  - `GET /api/engagements/:id/export?format=pdf`
- Scenario export:
  - `GET /api/scenarios/:id/export?format=csv&showHidden=0`
  - `GET /api/scenarios/:id/export?format=pdf&showHidden=1`

All API routes require authentication.

## Key Paths

- Frontend: `app/page.tsx`, `components/QuickSizerApp.tsx`
- Auth: `app/api/auth/*`, `lib/auth.ts`, `lib/password.ts`
- Engagement APIs: `app/api/engagements/*`
- Scenario APIs: `app/api/scenarios/*`
- Workbook APIs: `app/api/workbook/route.ts`, `app/api/import-workbook/route.ts`
- Export logic: `lib/exporters.ts`
- Import logic: `scripts/importWorkbook.ts`, `lib/importWorkbook.ts`, `lib/domainSync.ts`
