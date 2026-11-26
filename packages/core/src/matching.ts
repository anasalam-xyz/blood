import type {
  Batch,
  BloodGroup,
  CellAnalysis,
  Site,
  Transfer,
} from "./types";
import { getCompatibleDonors, getCompatibilityPenalty } from "./compatibility";
import { haversineDistanceKm, estimateTransit } from "./geo";

function getDaysUntilExpiry(expiryDate: string, today: string): number {
  const exp = new Date(expiryDate + "T00:00:00Z").getTime();
  const tod = new Date(today + "T00:00:00Z").getTime();
  return Math.round((exp - tod) / 86400000);
}

const RARE_GROUPS: BloodGroup[] = ["O-", "B-", "A-", "AB-"];

function getBufferDays(group: BloodGroup): number {
  return RARE_GROUPS.includes(group) ? 2 : 1;
}

interface SimulatedDonorBatch {
  id: string;
  siteId: string;
  group: BloodGroup;
  units: number;
  expiryDate: string;
  daysUntilExpiry: number;
}

export function computeMatching(
  cells: CellAnalysis[],
  sites: Site[],
  batches: Batch[],
  today: string
): Transfer[] {
  const siteMap = new Map<string, Site>(sites.map((s) => [s.id, s]));
  const cellMap = new Map<string, CellAnalysis>(
    cells.map((c) => [`${c.siteId}:${c.group}`, c])
  );

  // Clone batches for simulation so we can mutate units allocated
  const donorBatches: SimulatedDonorBatch[] = batches.map((b) => ({
    id: b.id,
    siteId: b.siteId,
    group: b.group,
    units: b.units,
    expiryDate: b.expiryDate,
    daysUntilExpiry: getDaysUntilExpiry(b.expiryDate, today),
  }));

  // Track remaining surplus units per donor site:group
  const donorSurplusMap = new Map<string, number>();

  for (const cell of cells) {
    const key = `${cell.siteId}:${cell.group}`;
    const meanDaily = cell.forecast.daily.slice(0, 7).reduce((s, d) => s + d.mean, 0) / 7;
    const bufferUnits = meanDaily * getBufferDays(cell.group);
    const forecast7d = cell.forecast.daily.slice(0, 7).reduce((s, d) => s + d.mean, 0);

    // Surplus is units on hand exceeding 7d forecast + safety buffer
    const surplus = Math.max(0, Math.floor(cell.unitsOnHand - forecast7d - bufferUnits));
    donorSurplusMap.set(key, surplus);
  }

  // Filter and sort recipients: critical first, then high, then medium; then daysOfCover ascending
  const severityRank: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    safe: 3,
  };

  const recipients = cells
    .filter((c) => c.risk !== "safe")
    .sort((a, b) => {
      const diff = severityRank[a.risk] - severityRank[b.risk];
      if (diff !== 0) return diff;
      return a.daysOfCover - b.daysOfCover;
    });

  const transfers: Transfer[] = [];
  let transferCounter = 1;

  for (const recipient of recipients) {
    const rSite = siteMap.get(recipient.siteId);
    if (!rSite) continue;

    const meanDaily =
      recipient.forecast.daily.slice(0, 7).reduce((s, d) => s + d.mean, 0) / 7;
    const bufferUnits = meanDaily * getBufferDays(recipient.group);
    const forecast7d = recipient.forecast.daily
      .slice(0, 7)
      .reduce((s, d) => s + d.mean, 0);

    // Usable units over 7 days in FEFO
    let usable7d = recipient.unitsOnHand;
    // Estimated need to bring cover to 7 days + buffer
    let unitsNeeded = Math.ceil(forecast7d + bufferUnits - usable7d);
    if (unitsNeeded <= 0) continue;

    // Compatible donor groups
    const compDonors = getCompatibleDonors(recipient.group);

    // Candidate donor options
    interface CandidateOption {
      donorSite: Site;
      donorGroup: BloodGroup;
      batch: SimulatedDonorBatch;
      cost: number;
      distanceKm: number;
      etaHours: number;
    }

    const candidateBatches: CandidateOption[] = [];

    for (const dSite of sites) {
      if (dSite.id === recipient.siteId) continue;
      const distanceKm = haversineDistanceKm(
        dSite.lat,
        dSite.lng,
        rSite.lat,
        rSite.lng
      );
      const { etaHours, etaDays } = estimateTransit(distanceKm);

      for (const dGroup of compDonors) {
        const donorKey = `${dSite.id}:${dGroup}`;
        const currentSurplus = donorSurplusMap.get(donorKey) ?? 0;
        if (currentSurplus <= 0) continue;

        const compatPenalty = getCompatibilityPenalty(dGroup, recipient.group);

        // Find available donor batches
        const eligible = donorBatches.filter(
          (b) =>
            b.siteId === dSite.id &&
            b.group === dGroup &&
            b.units > 0 &&
            b.daysUntilExpiry > etaDays + 1 // Must survive transit + 1 day
        );

        for (const b of eligible) {
          // Cost formula: distance + sooner expiry preferred + compat penalty
          const cost =
            distanceKm * 1.0 + b.daysUntilExpiry * 2.0 + compatPenalty * 1.5;

          candidateBatches.push({
            donorSite: dSite,
            donorGroup: dGroup,
            batch: b,
            cost,
            distanceKm,
            etaHours,
          });
        }
      }
    }

    // Sort candidates by lowest cost
    candidateBatches.sort((a, b) => a.cost - b.cost);

    // Allocate greedily
    for (const cand of candidateBatches) {
      if (unitsNeeded <= 0) break;

      const donorKey = `${cand.donorSite.id}:${cand.donorGroup}`;
      const currentSurplus = donorSurplusMap.get(donorKey) ?? 0;
      if (currentSurplus <= 0 || cand.batch.units <= 0) continue;

      const allocUnits = Math.min(unitsNeeded, currentSurplus, cand.batch.units);
      if (allocUnits <= 0) continue;

      cand.batch.units -= allocUnits;
      donorSurplusMap.set(donorKey, currentSurplus - allocUnits);
      unitsNeeded -= allocUnits;

      const oldestExpiryDays = cand.batch.daysUntilExpiry;

      transfers.push({
        id: `t-${transferCounter++}`,
        fromSiteId: cand.donorSite.id,
        toSiteId: recipient.siteId,
        fromGroup: cand.donorGroup,
        toGroup: recipient.group,
        units: allocUnits,
        distanceKm: cand.distanceKm,
        etaHours: cand.etaHours,
        batchIds: [cand.batch.id],
        oldestExpiryDays,
        reason: `Resolves ${recipient.risk} shortage at ${rSite.name} with surplus ${cand.donorGroup} from ${cand.donorSite.name}`,
      });
    }
  }

  // Merge transfers that share fromSiteId, toSiteId, fromGroup, toGroup
  const mergedMap = new Map<string, Transfer>();
  for (const t of transfers) {
    const key = `${t.fromSiteId}->${t.toSiteId}:${t.fromGroup}->${t.toGroup}`;
    const existing = mergedMap.get(key);
    if (!existing) {
      mergedMap.set(key, { ...t });
    } else {
      existing.units += t.units;
      existing.batchIds = Array.from(new Set([...existing.batchIds, ...t.batchIds]));
      existing.oldestExpiryDays = Math.min(
        existing.oldestExpiryDays,
        t.oldestExpiryDays
      );
    }
  }

  return Array.from(mergedMap.values());
}
