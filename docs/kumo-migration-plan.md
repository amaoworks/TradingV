# Kumo Frontend Migration Plan

## Objective

Migrate the existing TradingV web frontend from Vue 3 + Naive UI to a Kumo-based frontend without losing behavior, API coverage, routing, realtime updates, or visual correctness.

Kumo is a React component system. The migration is therefore a frontend rewrite from Vue to React while preserving the backend API contract and user workflows.

## Current Baseline

- Baseline commit before migration: `06d148a Improve dev startup and sidebar shell`
- Active frontend stack:
  - React
  - ReactDOM
  - React Router
  - Vite
  - TypeScript
  - Kumo UI
  - Axios
  - klinecharts
  - marked
- Legacy Vue/Naive/Pinia/Vue Router sources and dependencies have been removed.
- Backend integration entrypoint:
  - `web/frontend/src/api.ts`
  - Vite dev proxy for `/api` and `/ws`
- Kumo reference:
  - Official component registry: `https://kumo-ui.com/api/component-registry`
  - `@cloudflare/kumo` v2.5.0 from the installed package metadata
  - React/ReactDOM-based component imports
  - Standalone CSS supported for non-Tailwind projects

## Current Migration Status

- Default Vite entrypoint now mounts `src/main.kumo.tsx`.
- Default production build is `npm run build`, which runs `tsc -p tsconfig.kumo.json && vite build`.
- Legacy Vue build script has been removed.
- Kumo pages implemented and wired:
  - `/`
  - `/analyze`
  - `/screener`
  - `/progress/:id`
  - `/holdings`
  - `/schedule`
  - `/paper`
  - `/backtest`
  - `/quality`
  - `/history`
  - `/report/:id`
  - `/settings`
- All required user-facing routes now have React/Kumo parity pages.
- Active Kumo imports are from `@cloudflare/kumo`; no new Naive UI usage is being added to the React app.

## Route Parity Tracker

| Route | Status | Required parity scope |
| --- | --- | --- |
| `/` | Implemented | Dashboard metrics, recent runs, portfolio/watchlist panels |
| `/analyze` | Implemented | Natural-language parse, form submission, analyst/model controls |
| `/screener` | Implemented | Screener form, results table, progress stream controls |
| `/progress/:id` | Implemented | WebSocket status, timeline, debate turns, report navigation |
| `/holdings` | Implemented | CRUD, CSV import, quote refresh, latest signal, K-line access |
| `/schedule` | Implemented | CRUD, trigger, bulk-from-holdings, enable/disable state |
| `/paper` | Implemented | Account state, orders, positions, NAV, K-line drawer |
| `/backtest` | Implemented | Run list, create dialog, source/universe options, detail metrics, NAV curve, trades, delete |
| `/quality` | Implemented | Decision-quality dashboard, scoring controls, calibration, breakdowns, heatmap, decisions |
| `/history` | Implemented | Run list, filters, pagination, route navigation |
| `/settings` | Implemented | API keys, provider/model metadata, app preferences |
| `/report/:id` | Implemented | Report detail, causal chain, event cards, debate sections, markdown output, paper-order |

## Non-Negotiable Requirements

- Existing backend API paths must remain unchanged.
- Existing WebSocket workflows must remain functional.
- Existing user-visible routes must keep working:
  - `/`
  - `/analyze`
  - `/screener`
  - `/progress/:id`
  - `/holdings`
  - `/schedule`
  - `/paper`
  - `/backtest`
  - `/quality`
  - `/history`
  - `/report/:id`
  - `/settings`
- Existing i18n coverage must remain available for `zh-CN` and `en-US`.
- No backend code should be modified for this migration unless a frontend-blocking API defect is proven.
- The final frontend must not depend on Vue, Naive UI, Pinia, or Vue Router.
- Build output must be served by the same backend static deployment path.

## Migration Strategy

The migration will be completed in controlled stages. The existing Vue implementation stays as the functional reference until the React/Kumo implementation passes equivalent build, route, and interaction checks.

### Stage 1: React/Kumo Foundation

- Add React, ReactDOM, React Router, and Kumo dependencies.
- Replace Vue entrypoints with React entrypoints only after a minimal Kumo shell builds.
- Preserve Vite, TypeScript, and existing asset/public layout.
- Introduce shared API client compatible with current backend routes.
- Introduce Kumo standalone CSS import or equivalent Kumo tokens.

Acceptance:
- `npm run build` succeeds.
- App renders a Kumo shell at `/`.
- Existing Vite proxy still forwards `/api` and `/ws`.

### Stage 2: Shared App Infrastructure

- Implement route table matching the current Vue routes.
- Implement i18n dictionaries using existing locale source text.
- Implement theme/language controls in React.
- Implement layout shell, sidebar, topbar, responsive behavior, and mobile behavior with Kumo components/styles.

Acceptance:
- All required routes render non-empty pages.
- Sidebar collapsed/expanded/mobile states are visually verified.
- No Vue/Naive runtime imports remain in active app code.

### Stage 3: Page Migration

Migrate pages by workflow risk:

1. Dashboard
2. History
3. Settings
4. New Analysis
5. Analysis Progress
6. Screener
7. Holdings
8. Schedule
9. Paper Trading
10. Backtest + Backtest Detail
11. Quality
12. Report Detail

Each page must preserve:
- API calls
- Loading states
- Empty/error states
- Route navigation
- Modals/drawers/forms
- Tables and action buttons
- Existing i18n text coverage

Acceptance per page:
- Page builds.
- Page route renders.
- API calls match current Vue implementation.
- Primary workflow can be exercised against mocked or live backend.

### Stage 4: Components and Visualization

Migrate shared components:

- ModelPicker
- DebateThread
- EventReport
- CausalChain
- KLineChart
- BacktestDetail

Acceptance:
- Report detail and progress pages show structured reports/debate/event sections.
- Charts render nonblank with stable sizing.
- Markdown rendering remains safe and readable.

### Stage 5: Cleanup

- Remove Vue, Naive UI, Pinia, Vue Router, and Vue compiler dependencies. Done.
- Remove `.vue` source files after React equivalents are verified. Done.
- Remove obsolete CSS overrides for Naive internals. Done.
- Update frontend README and developer scripts. Done.

Acceptance:
- `rg "vue|naive-ui|pinia|vue-router|\\.vue" web/frontend/src web/frontend/package.json` shows no active app dependency.
- `npm run build` succeeds.
- Dev startup script still works with automatic ports.
- Visual screenshots pass desktop, small-height, and mobile checks.

## Verification Matrix

| Area | Evidence Required |
| --- | --- |
| Build | `npm run build` succeeds |
| Routes | Each route renders a non-empty React/Kumo page |
| API contract | API paths and payload shapes match the Vue baseline |
| WebSocket | Progress and screener streams connect and update state |
| Layout | Desktop/mobile/collapsed sidebar screenshots |
| i18n | `zh-CN` and `en-US` switch without missing core navigation labels |
| Removal | Vue/Naive dependencies removed only after page parity |

## Latest Verification

Checked on 2026-06-08:

- `npm run build` succeeds for `web/frontend`.
- `src/react/App.tsx` wires all public routes listed in the route parity tracker.
- Active package dependencies contain React, Kumo, React Router, Vite,
  klinecharts, marked, axios, and zod; no Vue, Naive UI, Pinia, or Vue Router
  dependency remains.
- Legacy `.vue` source files, Vue entrypoints, Vue router/store files,
  `index.kumo.html`, and `tsconfig.app.json` have been removed.
- Documentation now describes React + Kumo as the active frontend stack.
- The only build caveat observed is Vite's large chunk size warning; it does
  not block the production build.

## Risks

- Kumo is React-based, so this is a framework migration rather than a styling patch.
- Tables, forms, date pickers, drawers, modals, charts, and WebSocket pages are the highest-risk areas.
- Some Naive UI widgets may not have one-to-one Kumo replacements; these must be rebuilt with Kumo primitives and local React components.
- The final migration should avoid keeping a mixed Vue/React production runtime because that would preserve the old framework and fail the objective.

## Documentation Requirements

- Keep `README.md`, `README.zh-CN.md`, `web/frontend/README.md`, and this plan aligned with the active Kumo route state.
- Public README workflow steps must not promise a Kumo page that is still a placeholder.
- When a route is migrated, update the route parity tracker before or in the same change as the implementation.
- Do not document Vue, Naive UI, Pinia, or Vue Router as active frontend dependencies.

## Immediate Next Steps

1. Run any additional manual workflow checks against live backend data as needed.
2. Consider code-splitting large route bundles if bundle size becomes a production concern.
