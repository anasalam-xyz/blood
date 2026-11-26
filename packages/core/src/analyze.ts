import type {
  Alert,
  Analysis,
  BloodGroup,
  CellAnalysis,
  KPIs,
  World,
} from "./types";
import { computeForecast } from "./forecast";
import { projectInventory } from "./projection";
import { evaluateRisk } from "./risk";
import { computeMatching } from "./matching";
import { generateRecommendations } from "./recommendations";

const ALL_GROUPS: BloodGroup[] = [
  "O-",
  "O+",
  "A-",
  "A+",
  "B-",
  "B+",
  "AB-",
  "AB+",
];

export function analyze(world: World): Analysis {
  const cells: CellAnalysis[] = [];
  const alerts: Alert[] = [];
  const siteMap = new Map(world.sites.map((s) => [s.id, s.name]));

  let totalWapeSum = 0;
  let totalWapeWeight = 0;
  let totalProjectedWastage = 0;

  for (const site of world.sites) {
    for (const group of ALL_GROUPS) {
      // 1. Forecast demand
      const forecast = computeForecast(
        world.history,
        site.id,
        group,
        world.today,
        world.shocks
      );

      // 2. Filter batches for this cell
      const cellBatches = world.batches.filter(
        (b) => b.siteId === site.id && b.group === group
      );

      // 3. Project inventory forward
      const proj = projectInventory(cellBatches, forecast, world.today);

      // 4. Evaluate risk
      const risk = evaluateRisk(proj.daysOfCover, proj.p90StockoutDay);

      const cell: CellAnalysis = {
        siteId: site.id,
        group,
        unitsOnHand: proj.unitsOnHand,
        daysOfCover: proj.daysOfCover,
        stockoutDay: proj.stockoutDay,
        expiringWithin3d: proj.expiringWithin3d,
        wastageUnits: proj.wastageUnits,
        risk,
        forecast,
      };

      cells.push(cell);

      totalProjectedWastage += proj.wastageUnits;
      const meanVolume =
        forecast.daily.reduce((sum, d) => sum + d.mean, 0) / forecast.daily.length;
      totalWapeSum += forecast.wape * Math.max(1, meanVolume);
      totalWapeWeight += Math.max(1, meanVolume);

      // 5. Generate alert if at-risk
      if (risk !== "safe") {
        const siteName = siteMap.get(site.id) ?? site.id;
        const timeMsg =
          proj.stockoutDay !== null
            ? `Stockout projected in ${proj.stockoutDay} days`
            : `${proj.daysOfCover} days of cover remaining`;

        alerts.push({
          id: `alert-${site.id}-${group}`,
          siteId: site.id,
          siteName,
          group,
          risk,
          daysOfCover: proj.daysOfCover,
          stockoutDay: proj.stockoutDay,
          unitsOnHand: proj.unitsOnHand,
          message: `${risk.toUpperCase()}: ${group} at ${siteName} (${timeMsg}, ${proj.unitsOnHand} units on hand)`,
        });
      }
    }
  }

  // Sort alerts: critical first, then high, then medium; then daysOfCover ascending
  const severityRank: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    safe: 3,
  };

  alerts.sort((a, b) => {
    const diff = severityRank[a.risk] - severityRank[b.risk];
    if (diff !== 0) return diff;
    return a.daysOfCover - b.daysOfCover;
  });

  // 6. Matching transfers
  const transfers = computeMatching(cells, world.sites, world.batches, world.today);

  // 7. Recommendations
  const recommendations = generateRecommendations(transfers, world.sites, cells);

  // 8. KPIs
  const atRiskCells = cells.filter((c) => c.risk !== "safe").length;
  const resolvedRecipients = new Set(
    transfers.map((t) => `${t.toSiteId}:${t.toGroup}`)
  );
  const resolvedByTransfers = resolvedRecipients.size;

  const networkWape =
    totalWapeWeight > 0
      ? Math.round((totalWapeSum / totalWapeWeight) * 1000) / 1000
      : 0;

  const kpis: KPIs = {
    atRiskCells,
    resolvedByTransfers,
    projectedWastage: totalProjectedWastage,
    networkWape,
  };

  return {
    generatedAt: new Date().toISOString(),
    cells,
    alerts,
    transfers,
    recommendations,
    kpis,
  };
}
