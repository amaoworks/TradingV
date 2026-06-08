# Kumo Frontend Migration Plan

## Objective

Migrate the existing TradingV web frontend from Vue 3 + Naive UI to a Kumo-based frontend without losing behavior, API coverage, routing, realtime updates, or visual correctness.

Kumo is a React component system. The migration is therefore a frontend rewrite from Vue to React while preserving the backend API contract and user workflows.

## Current Baseline

- Baseline commit before migration: `06d148a Improve dev startup and sidebar shell`
- Current frontend stack:
  - Vue 3
  - Vite
  - TypeScript
  - Naive UI
  - Pinia
  - Vue Router
  - Axios
  - Chart.js / vue-chartjs
  - klinecharts
- Backend integration entrypoint:
  - `web/frontend/src/api.ts`
  - Vite dev proxy for `/api` and `/ws`
- Kumo reference:
  - `@cloudflare/kumo` v2.5.0 from official docs page metadata
  - React/ReactDOM-based component imports
  - Standalone CSS supported for non-Tailwind projects

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

- Remove Vue, Naive UI, Pinia, Vue Router, and Vue compiler dependencies.
- Remove `.vue` source files after React equivalents are verified.
- Remove obsolete CSS overrides for Naive internals.
- Update frontend README and developer scripts.

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

## Risks

- Kumo is React-based, so this is a framework migration rather than a styling patch.
- Tables, forms, date pickers, drawers, modals, charts, and WebSocket pages are the highest-risk areas.
- Some Naive UI widgets may not have one-to-one Kumo replacements; these must be rebuilt with Kumo primitives and local React components.
- The final migration should avoid keeping a mixed Vue/React production runtime because that would preserve the old framework and fail the objective.

## Immediate Next Steps

1. Install React/Kumo dependencies.
2. Create React app entry and Kumo shell.
3. Port shared API client and route skeleton.
4. Migrate Dashboard as the first parity page.
5. Verify build and route rendering before expanding to more pages.
