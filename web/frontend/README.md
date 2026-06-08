# TradingV Frontend

The active frontend is a React + Kumo app mounted from `src/main.kumo.tsx`.
Kumo component coverage is tracked against `https://kumo-ui.com/api/component-registry`.

Active React code lives under `src/react` and must not import Vue, Naive UI,
Pinia, or Vue Router.

## Commands

```bash
npm run dev
npm run build
```

## Route parity

| Route | Kumo status | Notes |
| --- | --- | --- |
| `/` | Implemented | Dashboard |
| `/analyze` | Implemented | New analysis form, natural-language parse, model picker |
| `/screener` | Implemented | Screener workflow and stream controls |
| `/progress/:id` | Implemented | WebSocket progress and debate turns |
| `/holdings` | Implemented | Holdings CRUD, import, latest signal, K-line access |
| `/schedule` | Implemented | Schedule CRUD, trigger, bulk-from-holdings |
| `/paper` | Implemented | Account, orders, positions, NAV, K-line drawer |
| `/backtest` | Implemented | Backtest run list, create dialog, detail, curve, trades |
| `/quality` | Implemented | Decision quality dashboard, calibration, dimensions, heatmap, decisions |
| `/history` | Implemented | Run history table and navigation |
| `/settings` | Implemented | API keys, providers, language/theme controls |
| `/report/:id` | Implemented | Report detail, causal chain, event report, debate sections, paper-order |

## Verification

Latest migration audit:

- `npm run build` succeeds.
- Route table in `src/react/App.tsx` covers every public Web Studio route.
- Vue, Naive UI, Pinia, Vue Router, and `.vue` sources are removed from the
  active frontend package.
- The remaining Vite warning is bundle-size related only.

Use these checks after each route migration:

```bash
npm run build
rg "from ['\\\"](vue|naive-ui|pinia|vue-router)" src/react
```

For visual changes, run the Vite dev server and capture the route in desktop
and constrained/mobile viewports.

## Documentation upkeep

When a route moves from pending to implemented, update:

- this route parity table
- `../../docs/kumo-migration-plan.md`
- the root `README.md` and `README.zh-CN.md` if public-facing workflow text
  changes
