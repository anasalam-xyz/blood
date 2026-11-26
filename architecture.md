# Architecture: BloodNet

Full-stack TypeScript. One Next.js app plus two internal packages in a pnpm workspace. No Python, no database, no external services.

## 1. Principles
1. **Pure core.** All forecasting, projection, risk, and matching logic lives in a dependency-free TS package. It is unit-testable and runs anywhere.
2. **Deterministic.** Seeded PRNG and a fixed "today" so the demo never surprises you.
3. **Thin web layer.** Route handlers call core functions; the UI renders results. No business logic in components.
4. **Cut infrastructure, not logic.** In-memory state, polling instead of websockets.

## 2. Monorepo layout (pnpm workspaces, no Turborepo to save setup time)
```
bloodnet/
├─ package.json                  # private, scripts: dev, build, test
├─ pnpm-workspace.yaml           # packages: ["apps/*", "packages/*"]
├─ tsconfig.base.json
├─ docs/  (prd.md, architecture.md)
├─ packages/
│  ├─ core/                      # @bloodnet/core: pure logic
│  │  └─ src/
│  │     ├─ types.ts
│  │     ├─ compatibility.ts
│  │     ├─ geo.ts               # haversine
│  │     ├─ forecast.ts          # WMA x DOW x trend, backtest WAPE
│  │     ├─ projection.ts        # FEFO roll-forward, stockout date, wastage
│  │     ├─ risk.ts
│  │     ├─ matching.ts          # donor selection and allocation
│  │     ├─ recommendations.ts   # string templates
│  │     ├─ analyze.ts           # orchestrates everything -> Analysis
│  │     ├─ simulate.ts          # emergency injection, apply transfer
│  │     └─ index.ts
│  └─ data/                      # @bloodnet/data: seed generator
│     └─ src/ (prng.ts, sites.ts, generate.ts, index.ts)
└─ apps/
   └─ web/                       # Next.js 15 App Router, Tailwind
      ├─ app/
      │  ├─ page.tsx             # single-page dashboard
      │  ├─ layout.tsx
      │  └─ api/
      │     ├─ analysis/route.ts            # GET
      │     ├─ sites/[id]/route.ts          # GET detail + history + forecast
      │     ├─ transfers/approve/route.ts   # POST
      │     ├─ simulate/emergency/route.ts  # POST
      │     └─ reset/route.ts               # POST
      ├─ components/ (Heatmap, AlertsFeed, SiteMap, DetailPanel, ForecastChart,
      │               ExpiryTimeline, RecommendationList, SimulateButton, Header)
      └─ lib/ (store.ts, api.ts, format.ts)
```
Web app imports packages with `transpilePackages: ["@bloodnet/core", "@bloodnet/data"]` in `next.config.ts`. Packages export raw TS (`"main": "src/index.ts"`), so no build step.

## 3. Stack
| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript | Single codebase for UI and API |
| Styling | Tailwind CSS | Fast |
| Charts | Recharts | Confidence band via stacked Area |
| Map | react-leaflet + OpenStreetMap tiles | No API key; load with `dynamic(..., { ssr: false })` |
| State (client) | React state + SWR or `setInterval` polling | Simple 5s refresh |
| Tests | Vitest, core package only | Protect the logic with a handful of tests |
| Package manager | pnpm | Workspaces |

## 4. Data model (`packages/core/src/types.ts`)
```ts
type BloodGroup = "O-"|"O+"|"A-"|"A+"|"B-"|"B+"|"AB-"|"AB+";
type SiteType = "hospital" | "blood_bank";
interface Site { id: string; name: string; type: SiteType; lat: number; lng: number; city: string; }
interface Batch { id: string; siteId: string; group: BloodGroup; units: number; expiryDate: string; } // ISO date
interface DailyUse { date: string; siteId: string; group: BloodGroup; units: number; }
interface World { today: string; sites: Site[]; batches: Batch[]; history: DailyUse[]; shocks: Shock[]; }
interface Shock { siteId: string; groups: BloodGroup[]; multiplier: number; fromDay: number; toDay: number; label: string; }

interface Forecast { siteId; group; daily: { day: number; mean: number; p90: number }[]; wape: number; }
type Risk = "critical" | "high" | "medium" | "safe";
interface CellAnalysis {
  siteId; group; unitsOnHand: number; daysOfCover: number; stockoutDay: number | null;
  expiringWithin3d: number; wastageUnits: number; risk: Risk; forecast: Forecast;
}
interface Transfer { id; fromSiteId; toSiteId; fromGroup; toGroup; units; distanceKm; etaHours; batchIds: string[]; oldestExpiryDays: number; reason: string; }
interface Analysis { generatedAt; cells: CellAnalysis[]; alerts: Alert[]; transfers: Transfer[]; recommendations: string[]; kpis: { atRiskCells; resolvedByTransfers; projectedWastage; networkWape }; }
```

## 5. Core algorithms

### 5.1 Forecast (`forecast.ts`)
Input: 90-day history for one site × group.
1. **DOW index:** mean per weekday ÷ overall mean (clamped 0.5-1.8).
2. **Deseasonalise** each day by its DOW index.
3. **Level:** linearly weighted average of the last 14 deseasonalised days.
4. **Trend:** slope of the last 28 days, damped (×0.9^d) and clamped to ±10% of level per week.
5. **Forecast day d:** `(level + trend·d) × DOW[d] × seasonMultiplier × shockMultiplier(d)`.
6. **Uncertainty:** sigma = std of residuals from a backtest; `p90 = mean + 1.28σ`.
7. **Backtest:** fit on days 1-76, predict 77-90, report **WAPE** = Σ|err| / Σactual (MAPE is unstable at low volume).

### 5.2 Expiry-aware projection (`projection.ts`)
For day 0 to 14:
1. Drop batches with `expiry <= day`; add their units to wastage.
2. Subtract demand from batches in **FEFO** order.
3. If demand exceeds stock, `stockoutDay = day`, stop.
Run twice: with `mean` demand (expected) and with `p90` (pessimistic). `daysOfCover` is the expected stockout day, or 14 if none.

### 5.3 Risk (`risk.ts`)
`<2 critical`, `<4 high`, `<7 medium`, else `safe`. Escalate one level if the p90 stockout is `<2` days.

### 5.4 Matching (`matching.ts`)
```
recipients = cells where risk in {critical, high, medium}, sorted by severity then daysOfCover
for each recipient:
  need = forecast7d(mean) + buffer − usable(7d, FEFO)
  for each donor site ≠ recipient:
    for each compatible donor group (exact first; O- last-resort):
      surplus = usable(donor,group) − forecast7d(donor,group) − buffer(donor,group)
      skip if surplus <= 0 or donor would become at-risk
      eligible batches = those with expiry > today + etaDays + 1
      cost = w1·distanceKm + w2·daysUntilExpiry (lower = more urgent, preferred) + w3·compatPenalty
  greedily allocate from lowest cost, FEFO within donor; decrement simulated donor surplus
emit Transfer[] (merge batches per donor)
```
Buffer = 1 day of forecast demand (2 days for O-, B-, AB-, A-).

Compatibility map (red cells, donor to recipients):
`O-`→all · `O+`→O+,A+,B+,AB+ · `A-`→A-,A+,AB-,AB+ · `A+`→A+,AB+ · `B-`→B-,B+,AB-,AB+ · `B+`→B+,AB+ · `AB-`→AB-,AB+ · `AB+`→AB+

### 5.5 Recommendations (`recommendations.ts`)
Template: `Transfer {units} units {group} from {from} to {to} ({km} km, oldest batch expires in {d} days). Resolves {risk} shortage; {to} cover rises from {a} to {b} days.`

## 6. Application state and API

**State:** a server singleton on `globalThis.__world` (survives hot reload in dev). `lib/store.ts` exposes `getWorld()`, `setWorld()`, `resetWorld()`. Every mutating endpoint changes the world, then returns a fresh `Analysis`.

| Endpoint | Method | Behaviour |
|---|---|---|
| `/api/analysis` | GET | `analyze(world)` returns `Analysis` |
| `/api/sites/[id]` | GET | Site, per-group history (last 30 days), forecast, batches |
| `/api/transfers/approve` | POST `{transferId}` | Moves batches to the recipient (expiry preserved), returns new analysis |
| `/api/simulate/emergency` | POST `{siteId?}` | Adds a `Shock` and drains X% of stock at the site, returns new analysis |
| `/api/reset` | POST | Regenerates the seed world |

Analysis is cheap (6 sites × 8 groups), so recompute on every request; no caching.

**Deployment caveat:** serverless instances do not share memory. Run the demo from `pnpm build && pnpm start` locally. A Vercel deploy is fine as a shareable link, but treat the in-memory state as best effort and keep the Reset button visible.

## 7. Seed data (`packages/data`)
- `mulberry32(seed)` PRNG, fixed `today = 2026-11-26`.
- **Sites (approximate coordinates, Bihar region so transfers are realistic):**

| Site | Type | City | lat | lng |
|---|---|---|---|---|
| PMCH | hospital | Patna | 25.6205 | 85.1580 |
| AIIMS Patna | hospital | Patna | 25.5576 | 85.0517 |
| IGIMS | hospital | Patna | 25.6135 | 85.1180 |
| Red Cross Blood Bank | blood_bank | Patna | 25.6100 | 85.1400 |
| SKMCH | hospital | Muzaffarpur | 26.1200 | 85.3900 |
| AMCH | hospital | Gaya | 24.7950 | 85.0100 |

- **Base demand per group** (share of total): O+ 36%, B+ 31%, A+ 22%, AB+ 7%, O- 2%, B- 1%, A- 1%, AB- 0.5%.
- **Patterns:** weekday > weekend (×1.2 / ×0.8), +25% seasonal bump in last 21 days, Poisson-like noise, 2-3 emergency spikes in history.
- **Inventory:** 3-6 batches per site × group, expiry 1-35 days, 42-day shelf life (red cells). Deliberately make: PMCH O- low, IGIMS B- low, AIIMS A+ expiring soon, Red Cross Blood Bank O+ and B+ high surplus with older batches.
- **Seed check:** a unit test asserts at least 3 non-safe cells and at least one valid transfer.

## 8. UI composition (`app/page.tsx`)
```
┌ Header: title · WAPE badge · Simulate emergency · Reset · last refresh ┐
├──────────────┬──────────────────────────┬───────────────────────────┤
│ Alerts feed  │ Heatmap grid (sites ×    │ Detail panel:             │
│ (by time to  │ groups, risk colours)    │  forecast + band chart    │
│  stockout)   │ SiteMap (Leaflet) below  │  batch expiry timeline    │
│              │                          │  recommendations + Approve│
└──────────────┴──────────────────────────┴───────────────────────────┘
```
Selected cell lives in one React state (`{siteId, group}`); all panels read it. Poll `/api/analysis` every 5 seconds.

Risk colours: critical red, high orange, medium amber, safe green.

## 9. Testing (Vitest, `packages/core` only)
- Forecast returns non-negative values; WAPE is finite.
- Projection: FEFO order respected; expired batches counted as wastage.
- Matching: never recommends an incompatible group; donor never drops below its buffer; batches expiring before arrival are excluded.
- Seed scenario produces the expected demo flags.

## 10. Build order (maps to the 2-hour plan)
1. Workspace scaffold, types, seed data (15 min)
2. Forecast, projection, risk and tests (30 min)
3. Heatmap, alerts, detail panel with API routes (30 min)
4. Matching, recommendations, approve flow (20 min)
5. Simulate emergency, polling, Leaflet map (15 min)
6. Polish, README, rehearse (10 min)
