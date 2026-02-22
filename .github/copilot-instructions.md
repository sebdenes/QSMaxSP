# GitHub Copilot Instructions — QSMaxSP

## Project
Next.js 15 + TypeScript + Prisma/PostgreSQL web app for sizing SAP Premium Service engagements.
Package manager: **npm** (not pnpm or yarn).

## Critical Rules

### Scenario Data Alignment
Category keys in domain data files MUST exactly match `SCENARIO_TYPES` strings in
`components/QuickSizerApp.tsx`. A mismatch silently produces empty T-shirt sizing cards.
Always run the diagnostic script after any scenario rename or workbook import.

### Auth Environment Variables
`AUTH_DISABLED` and `NEXT_PUBLIC_AUTH_DISABLED` must always be changed **together**.
Setting only one causes a split-brain auth state.

### Workbook Import Filter
When parsing the Excel workbook, only use rows where `Custom == 0` (group header rows).
Line item rows inflate service day totals.

### PDF Export
The `/api/engagements/:id/export?format=pdf` endpoint intentionally returns `400`.
Do not re-enable without a tracked backlog item.

### TypeScript Build
`npm run build` does NOT fail on TypeScript errors. Always run `npm run typecheck` separately.

## Self-Improvement
After solving non-obvious issues, log to `.learnings/` using the self-improvement skill format:
- Errors → `.learnings/ERRORS.md`
- Corrections/best practices → `.learnings/LEARNINGS.md`
- Missing features → `.learnings/FEATURE_REQUESTS.md`

Promote broadly applicable learnings to `CLAUDE.md` and this file.
