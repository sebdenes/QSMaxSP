# Max Success Plan Premium Services Quicksizer

Web app generated from `Prototype4.xlsx` with authenticated, per-user engagement sizing.

## Stack

- Next.js 15 + TypeScript
- Prisma + SQLite
- Workbook artifacts in `data/*.json`
- XLSX parser: `scripts/import_workbook.py` (Python stdlib only)

## Implemented features

- Authentication and session management:
  - register/login/logout APIs
  - cookie-backed session storage
  - `GET /api/auth/me` for current user
- Per-user ownership:
  - every engagement is tied to `Engagement.ownerId`
  - users only see/update/delete/export their own engagements
- Engagement start flow:
  - after login, start with `customer name` and `durationYears` (`1-5`)
  - duration is persisted per engagement
- Quick sizing:
  - row-level size selections (`N/A/S/M/L/Custom`)
  - per-year spread (`Y1..Y5`) with total spread validation (`<= 100%`)
  - years beyond selected duration are automatically zeroed
- Scenario drill-down:
  - template vs effective values
  - override indicators
  - hidden row toggle
- Workbook import pipeline:
  - parse XLSX -> refresh `data/domain_model.json`, `data/totals.json`, `data/visibility.json`, `data/workbook_profile.json`
  - sync sections/services/scenarios/overrides to DB
  - record run status in `ImportRun`
- Exports:
  - engagement result export: CSV/PDF
  - scenario drill-down export: CSV/PDF (optional hidden rows)

## Setup

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:push
npm run db:seed
```

Seed creates a demo account:

- email: `demo@quicksizer.local`
- password: `demo1234`

## Run app

```bash
npm run dev
```

## Import workbook

CLI:

```bash
npm run import:workbook -- --source /absolute/path/to/MaxEngagementQuickSizer_V1.xlsx
```

In app:

- Log in
- Use **Workbook Re-import**
- Enter source path (example: `/Users/I048171/Downloads/MaxEngagementQuickSizer_V1.xlsx`)
- Click **Run Import**

## Export endpoints

- Engagement export:
  - `GET /api/engagements/:id/export?format=csv`
  - `GET /api/engagements/:id/export?format=pdf`
- Scenario export:
  - `GET /api/scenarios/:id/export?format=csv&showHidden=0`
  - `GET /api/scenarios/:id/export?format=pdf&showHidden=1`

All export and workbook routes require authentication.

## Key paths

- Frontend: `app/page.tsx`, `components/QuickSizerApp.tsx`
- Auth: `lib/auth.ts`, `lib/password.ts`, `app/api/auth/*`
- Engagement APIs: `app/api/engagements/*`
- Scenario APIs: `app/api/scenarios/*`
- Workbook APIs: `app/api/workbook/route.ts`, `app/api/import-workbook/route.ts`
- Export logic: `lib/exporters.ts`
- Import scripts: `scripts/import_workbook.py`, `scripts/importWorkbook.ts`
- Data/domain sync: `lib/domainSync.ts`, `lib/importWorkbook.ts`, `lib/scenarioDrilldown.ts`

## Publish for testers (Render)

This repo includes `render.yaml` for a web service deployment with a persistent disk for SQLite.

### 1. Push this repo to GitHub

Render deploys from your Git repository.

### 2. Create a Blueprint in Render

- In Render: **New +** -> **Blueprint**
- Select your repository
- Render will detect `render.yaml`

### 3. Confirm settings

- Plan: `starter` (required for persistent disk)
- `DATABASE_URL`: `file:/var/data/dev.db`
- Disk mount path: `/var/data`

### 4. Deploy

Render will:

- Build with `npm ci && npm run db:generate && npm run build`
- Start with `npm run start:render`
- On start, run `prisma db push`, seed initial domain data if DB is empty, and start Next.js

### 5. Share URL

After deploy completes, share the Render app URL with testers.

Notes:

- Demo account is created automatically: `demo@quicksizer.local / demo1234`
- Workbook re-import from local machine paths is not intended for cloud testers unless you add a file-upload based import flow.
