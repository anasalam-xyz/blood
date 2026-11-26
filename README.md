# BloodNet — Predictive Blood Shortage & Autonomous Transfer Network

BloodNet is a predictive supply chain and inventory rebalancing platform designed for regional hospital networks and blood banks. It forecasts shortages per **site × blood group** days in advance, ranks at-risk inventory, and recommends **expiry-aware transfers** between sites so clinical teams can intervene before a stockout or wastage occurs.

---

## Architecture Overview

Built as a high-performance, full-stack TypeScript monorepo with `pnpm`:

```
bloodnet/
├── packages/
│   ├── core/         # Pure TypeScript engine: forecasting, FEFO projection, risk, matching
│   └── data/         # Deterministic seed generator (6 sites, 8 groups, 90d history, batch inventory)
├── apps/
│   └── web/          # Next.js 15 (App Router), Tailwind CSS, Recharts, Leaflet Map
├── docs/             # PRD and Architecture specifications
└── README.md         # Setup and demonstration guide
```

- **Pure Core Logic:** Zero runtime dependencies in `packages/core`. Unit tested with Vitest.
- **Statistical Forecasting Baseline:** Deseasonalised weighted moving average, day-of-week index, damped linear trend, and empirical residual variance ($\sigma$) with backtested WAPE holdout scoring.
- **Expiry-Aware FEFO Projection:** Projects day-by-day consumption over 14 days; tracks stockout day and wastage units.
- **Autonomous Matching Engine:** Matches shortage recipients with surplus donors using Haversine transit feasibility, shelf-life constraints, and red-cell compatibility rules (O- universal donor preserved as last resort).

---

## Getting Started

### Prerequisites
- Node.js >= 20.x
- pnpm >= 9.x / 10.x / 12.x

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Run Tests
```bash
pnpm test
```
All unit tests in `packages/core` test forecasting sanity, FEFO roll-forward, wastage tracking, compatibility constraints, and the deterministic seed scenario.

### 3. Build & Run Production Dashboard
```bash
pnpm build
pnpm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

*(For local development with live reload: `pnpm dev`)*

---

## 3-Minute Demonstration Script

Follow this step-by-step walkthrough to present the working prototype:

1. **Initial Regional Overview (Mostly Safe Network):**
   - Notice the **Network Heatmap** and **Regional Map**. Most cells are green (`safe`), but planted emergency flags highlight real risks:
     - **PMCH `O-`** is critical (cover $<2$ days).
     - **IGIMS `B-`** is at risk (cover $<3$ days).
     - **AIIMS Patna `A+`** faces imminent batch expiry.
   - Note the **Holdout WAPE badge** in the header displaying the aggregate forecasting accuracy.

2. **Inspect a Critical Cell:**
   - Click on the **PMCH `O-`** cell in the Heatmap or the Alerts Feed.
   - The **Detail Panel** immediately reveals:
     - 14-day demand forecast with shaded $p90$ confidence band.
     - Batch expiry timeline showing 1 unit on hand expiring in 3 days.
     - Stockout projected on Day D+1.

3. **Autonomous Transfer Recommendation:**
   - Review the **Recommended Transfer** card in the Detail Panel:
     - Shows recommended transfer from **Red Cross Blood Bank** (surplus site) to **PMCH**.
     - Distance: ~1.8 km, transit time: ~0.5h.
     - Oldest donor batch expiration date is preserved and guaranteed to arrive before expiring.

4. **Approve Transfer (Live Risk Drop):**
   - Click the **"Approve"** button on the transfer card.
   - The batches transfer instantly in-memory.
   - The PMCH `O-` cell increases its cover to $\ge 7$ days and transitions from **Critical (Red)** to **Safe (Green)**.

5. **Simulate Regional Emergency:**
   - Click the **"⚡ Simulate Emergency"** button in the header (simulating a mass trauma influx at AIIMS Patna).
   - In $<2$ seconds:
     - Stock at AIIMS Patna drains by 30% and a $4\times$ demand shock is injected across major blood groups.
     - High-priority alerts appear in the Alerts Feed.
     - The matching engine recalculates and surfaces new optimal transfers from surplus sites.

6. **Reset Scenario:**
   - Click **"↺ Reset"** in the header to return the network to its pristine, reproducible initial seed state.

---

## Honest Limitations

- **Synthetic Data Baseline:** Demand is generated using regional population proportions and deterministic PRNG; the forecast is a statistical moving-average baseline with backtested WAPE, not a black-box deep learning model.
- **Simplified Clinical Rules:** Implements red blood cell antigen compatibility; does not model platelet shelf-life (5 days), frozen plasma thawing logistics, or patient-specific cross-matching.
- **In-Memory Singleton:** Designed as a real-time reactive prototype running on server memory without database latency.
