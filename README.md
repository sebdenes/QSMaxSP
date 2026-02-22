# Max Success Plan Premium Services Quicksizer

Business-facing quicksizer for configuring SAP premium service engagements with a guided 6-step flow.

## End-User Experience

Users do not need Docker, Node.js, or database setup.

- Download desktop package from release artifacts.
- Unzip.
- Launch app.
- Save projects locally and export CSV.

## Functional Scope

- Guided flow: Context, Scope, Scenarios, Sizing, Expert Mode, Review.
- Per-scenario sizing supports mixed `S`, `M`, `L`, and `Custom` in one plan.
- Expert Mode activates only when at least one selected scenario uses Custom sizing.
- CSV export includes:
  - engagement metadata
  - scenario summary
  - service allocation detail
  - scenario totals
  - grand total
- PDF export is intentionally disabled.

## Tech Stack

- Next.js 15 + TypeScript
- Prisma + SQLite (embedded local database)
- Electron desktop runtime (portable executable packaging)

## Developer Setup (No Docker)

```bash
cp .env.example .env
npm install
npm run db:init:reset
```

Run locally:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3000
```

App URL: `http://127.0.0.1:3000`

## Quality Validation

```bash
npm run typecheck
npm test
npm run test:integration
npm run build
```

## Build Executables

macOS ZIP:

```bash
npm run desktop:dist:mac
```

Windows portable EXE bundle:

```bash
npm run desktop:dist:win
```

Artifacts are generated in `dist/`.

## Release Pipeline

- CI workflow: `.github/workflows/ci.yml`
- Desktop release workflow: `.github/workflows/desktop-release.yml`
  - Manual trigger for pilot builds
  - Auto-trigger on tags matching `v*`

## SharePoint Distribution

1. Download generated artifacts from GitHub Actions (or local `dist/`).
2. Upload only the final desktop artifact files to SharePoint.
3. Share a single instruction: “Download ZIP, unzip, open app.”

## Key Paths

- Frontend: `app/page.tsx`, `components/QuickSizerApp.tsx`
- API routes: `app/api/**`
- Auth: `app/api/auth/**`, `lib/auth.ts`
- Export logic: `lib/exporters.ts`
- Sizing logic: `lib/quickSizer.ts`
- Prisma schema: `prisma/schema.prisma`
- Desktop runtime: `electron/main.cjs`
- CI/release docs: `docs/ENGINEERING_PIPELINE.md`, `docs/PRODUCTION_BACKLOG.md`
