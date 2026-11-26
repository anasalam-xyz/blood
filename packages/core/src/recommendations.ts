import type { CellAnalysis, Site, Transfer } from "./types";

export function generateRecommendations(
  transfers: Transfer[],
  sites: Site[],
  cells: CellAnalysis[]
): string[] {
  const siteMap = new Map<string, Site>(sites.map((s) => [s.id, s]));
  const cellMap = new Map<string, CellAnalysis>(
    cells.map((c) => [`${c.siteId}:${c.group}`, c])
  );

  return transfers.map((t) => {
    const fromSite = siteMap.get(t.fromSiteId);
    const toSite = siteMap.get(t.toSiteId);
    const fromName = fromSite?.name ?? t.fromSiteId;
    const toName = toSite?.name ?? t.toSiteId;

    const toCell = cellMap.get(`${t.toSiteId}:${t.toGroup}`);
    const risk = toCell?.risk ?? "at-risk";
    const initialCover = toCell ? Math.round(toCell.daysOfCover * 10) / 10 : 0;

    // Estimate new days of cover with transferred units
    const dailyDemand =
      toCell && toCell.forecast.daily.length > 0
        ? toCell.forecast.daily.slice(0, 7).reduce((s, d) => s + d.mean, 0) / 7
        : 1;
    const addedCover = Math.round((t.units / Math.max(0.5, dailyDemand)) * 10) / 10;
    const newCover = Math.min(14, Math.round((initialCover + addedCover) * 10) / 10);

    const groupStr =
      t.fromGroup === t.toGroup
        ? t.fromGroup
        : `${t.fromGroup} (compatible with ${t.toGroup})`;

    return `Transfer ${t.units} units ${groupStr} from ${fromName} to ${toName} (${t.distanceKm} km, oldest batch expires in ${t.oldestExpiryDays} days). Resolves ${risk} shortage; ${toName} cover rises from ${initialCover} to ${newCover} days.`;
  });
}
