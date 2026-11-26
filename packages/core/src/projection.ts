import type { Batch, Forecast } from "./types";

function getDaysUntilExpiry(expiryDate: string, today: string): number {
  const exp = new Date(expiryDate + "T00:00:00Z").getTime();
  const tod = new Date(today + "T00:00:00Z").getTime();
  return Math.round((exp - tod) / 86400000);
}

export interface ProjectionResult {
  daysOfCover: number;
  stockoutDay: number | null;
  p90StockoutDay: number | null;
  wastageUnits: number;
  expiringWithin3d: number;
  unitsOnHand: number;
}

interface SimulatedBatch {
  id: string;
  units: number;
  daysUntilExpiry: number;
}

function simulateProjection(
  initialBatches: SimulatedBatch[],
  dailyDemand: number[]
): { stockoutDay: number | null; wastageUnits: number } {
  // Clone batches
  let batches = initialBatches.map((b) => ({ ...b }));
  let wastageUnits = 0;
  let stockoutDay: number | null = null;

  for (let d = 0; d < dailyDemand.length; d++) {
    // 1. Drop batches where expiry <= d
    const validBatches: SimulatedBatch[] = [];
    for (const b of batches) {
      if (b.daysUntilExpiry <= d) {
        wastageUnits += b.units;
      } else {
        validBatches.push(b);
      }
    }
    batches = validBatches;

    // 2. Subtract demand in FEFO order (soonest expiry first)
    batches.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
    let needed = dailyDemand[d];

    for (let i = 0; i < batches.length && needed > 0; i++) {
      const take = Math.min(batches[i].units, needed);
      batches[i].units -= take;
      needed -= take;
    }

    // Clean up empty batches
    batches = batches.filter((b) => b.units > 0);

    // 3. If demand exceeds stock, stockout occurs on day d
    if (needed > 1e-4) {
      stockoutDay = d;
      break;
    }
  }

  return { stockoutDay, wastageUnits };
}

export function projectInventory(
  batches: Batch[],
  forecast: Forecast,
  today: string
): ProjectionResult {
  const unitsOnHand = batches.reduce((sum, b) => sum + b.units, 0);

  // Compute initial batches with days until expiry
  const simBatches: SimulatedBatch[] = batches.map((b) => ({
    id: b.id,
    units: b.units,
    daysUntilExpiry: getDaysUntilExpiry(b.expiryDate, today),
  }));

  // Units expiring within 3 days
  const expiringWithin3d = simBatches
    .filter((b) => b.daysUntilExpiry <= 3)
    .reduce((sum, b) => sum + b.units, 0);

  const meanDemands = forecast.daily.map((d) => d.mean);
  const p90Demands = forecast.daily.map((d) => d.p90);

  const meanRun = simulateProjection(simBatches, meanDemands);
  const p90Run = simulateProjection(simBatches, p90Demands);

  const daysOfCover =
    meanRun.stockoutDay !== null ? meanRun.stockoutDay : 14;

  return {
    daysOfCover,
    stockoutDay: meanRun.stockoutDay,
    p90StockoutDay: p90Run.stockoutDay,
    wastageUnits: meanRun.wastageUnits,
    expiringWithin3d,
    unitsOnHand,
  };
}
