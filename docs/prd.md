# PRD: BloodNet, Predictive Blood Shortage Network (2-hour prototype)

## 1. Problem
Hospitals and blood banks manage blood inventory in isolation. Shortages are discovered when a unit is already needed, while another site nearby holds surplus units that will expire unused. The result is both emergencies and wastage.

## 2. Product vision
A centralized platform that forecasts shortages per **site × blood group** days ahead, ranks where and what is at risk, and recommends **expiry-aware transfers** between sites so teams act before an emergency.

## 3. Users
| User | Need |
|---|---|
| Regional coordinator (primary) | See the whole network, spot risk early, approve transfers |
| Hospital blood bank officer | Know my days of cover per group, what to request or send |
| Hospital administrator | Confidence that emergency demand is covered |

## 4. Goals and non-goals
**Goals (prototype)**
- Forecast 7-day demand per site × group with uncertainty.
- Project stock forward with batch expiry (FEFO) and predict stockout dates.
- Score risk, then surface high-risk groups and locations.
- Recommend transfers that reduce shortage and wastage together.
- Show it live: map, heatmap, alerts, "simulate emergency".

**Non-goals**
Authentication, real hospital integrations (HL7/FHIR), donor management, trained ML models, database persistence, websockets, mobile app, regulatory compliance. These are roadmap items.

## 5. Scope and acceptance criteria

### P0 (must ship)
| ID | Feature | Acceptance criteria |
|---|---|---|
| F1 | Synthetic network | 6 sites, 8 groups, 90 days of consumption, batch inventory with expiry. Seeded and deterministic. |
| F2 | Demand forecast | 7-day forecast per site × group with p90 upper band. Backtest on last 14 days reports **WAPE** (shown in the UI footer). |
| F3 | Expiry-aware projection | Day-by-day stock roll-forward, FEFO consumption, expired batches dropped and counted as wastage. Outputs stockout date and days of cover. |
| F4 | Risk scoring | Critical <2 days, High <4, Medium <7, else Safe. Escalate one level if p90 demand stocks out in <2 days. |
| F5 | Heatmap grid | Sites × groups matrix coloured by risk. Click a cell to open the detail panel. |
| F6 | Alerts feed | Sorted by time-to-stockout, shows site, group, days of cover. |
| F7 | Matching engine | For each at-risk cell, propose donor sites using compatibility, safe surplus, distance, and batch expiry urgency. Donor never becomes at-risk because of a transfer. |
| F8 | Recommendations | Human-readable lines, e.g. "Transfer 12 units O+ from X to Y (14 km, oldest batch expires in 3 days)". |
| F9 | Approve transfer | Button moves batches (expiry preserved), analysis recomputes, risk visibly drops. |
| F10 | Simulate emergency | One click injects a demand spike plus immediate stock drain at one site. Alerts fire and new matches appear. Reset button restores seed state. |

### P1 (if time allows)
| ID | Feature | Acceptance criteria |
|---|---|---|
| F11 | Map view | Leaflet map, markers coloured by worst risk, popup lists at-risk groups, transfer lines for recommendations. |
| F12 | Detail panel charts | Forecast line with confidence band over history, batch expiry timeline. |
| F13 | Auto-refresh | UI polls every 5 seconds. |

### P2 (stretch)
- Claude API natural-language briefing generated from structured output (only after everything else works).
- Wastage KPI: units expiring unused, before vs after recommendations.

## 6. Key rules (product logic)
- **Forecast:** deseasonalised weighted moving average × day-of-week index, plus a damped linear trend and a seasonal multiplier. Sigma from backtest residuals.
- **Surplus:** `usable stock − 7-day forecast − safety buffer`, where the buffer is 1 day of forecast demand (2 for rare groups).
- **Compatibility:** red-cell donor to recipient map. Exact group match is preferred. Cross-group is allowed with a ranking penalty. **O- is a last-resort donor** because it is scarce.
- **Transit feasibility:** a batch must still have at least 1 day of life left after estimated travel time (40 km/h average).
- **Ranking:** distance, expiry urgency (soonest expiry first), and compatibility penalty combine into one cost score. Allocation is greedy, most severe recipient first.

## 7. Success metrics (for the demo)
- WAPE on the 14-day holdout shown for the aggregate forecast.
- Seeded scenario flags at least 3 at-risk cells; recommendations resolve at least 80% of them.
- Approve then risk drops, verified live.
- Simulated emergency to updated alerts and matches in under 2 seconds.

## 8. Demo scenario (about 3 minutes)
1. Map and heatmap are mostly green, with a few flagged cells (e.g. O- at PMCH, B- at IGIMS).
2. Open a flagged cell and show the forecast and projected stockout date.
3. Show the recommended transfer using soon-to-expire units from a nearby surplus site.
4. Approve, and the cell turns green.
5. Hit **Simulate emergency** (road accident at AIIMS Patna), watch alerts fire, then approve the new match.

## 9. Honest limitations (say these out loud)
- Data is synthetic; forecasting is a statistical baseline, not a trained ML model.
- Compatibility logic is simplified (red cells only, no component types, no crossmatch).
- Single-instance in-memory state; no persistence.

## 10. Roadmap
Prophet or LightGBM forecasting with real data, HL7/FHIR and e-Raktkosh integration, donor outreach module, platelet and plasma shelf-life handling, multi-day transfer logistics, role-based access.

## 11. Risks
| Risk | Mitigation |
|---|---|
| Time overrun | Build in the order P0, then P1. Core logic first, UI second. Drop the map before dropping the heatmap. |
| Non-deterministic demo | Seeded PRNG, fixed "today", one-click reset. |
| Leaflet SSR issues in Next.js | Dynamic import with `ssr: false`, fix marker icons. |
| Judge asks "is this real ML?" | Disclose it as a backtested statistical baseline with a clear upgrade path. |
