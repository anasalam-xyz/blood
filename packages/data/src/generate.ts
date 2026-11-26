import type {
  BloodGroup,
  DailyUse,
  Batch,
  World,
  Site,
} from "@bloodnet/core";
import { mulberry32 } from "./prng";
import { SITES } from "./sites";

export const BLOOD_GROUPS: BloodGroup[] = [
  "O-",
  "O+",
  "A-",
  "A+",
  "B-",
  "B+",
  "AB-",
  "AB+",
];

export const FIXED_TODAY = "2026-11-26";

// Demand share proportions per group (sum approx 1.0)
const GROUP_SHARE: Record<BloodGroup, number> = {
  "O+": 0.36,
  "B+": 0.31,
  "A+": 0.22,
  "AB+": 0.07,
  "O-": 0.02,
  "B-": 0.01,
  "A-": 0.01,
  "AB-": 0.005,
};

// Base total daily volume per site
const SITE_VOLUME: Record<string, number> = {
  pmch: 36,
  "aiims-patna": 30,
  igims: 24,
  "red-cross-patna": 20,
  skmch: 20,
  amch: 18,
};

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

export function generateWorld(seed = 42): World {
  const rand = mulberry32(seed);

  const sites: Site[] = [...SITES];
  const history: DailyUse[] = [];
  const batches: Batch[] = [];

  // 1. Generate 90 days of daily consumption (day 0 = 90 days ago, day 89 = yesterday)
  const todayDate = new Date(FIXED_TODAY + "T00:00:00Z");
  const dates: string[] = [];
  for (let i = 90; i >= 1; i--) {
    const d = new Date(todayDate.getTime() - i * 86400000);
    dates.push(d.toISOString().split("T")[0]);
  }

  // Pre-define 3 emergency spikes in history
  // Day 32 (PMCH), Day 60 (AIIMS Patna), Day 78 (SKMCH)
  for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
    const dateStr = dates[dayIndex];
    const dateObj = new Date(dateStr + "T00:00:00Z");
    const dayOfWeek = dateObj.getUTCDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dowMultiplier = isWeekend ? 0.8 : 1.2;

    // +25% seasonal bump in last 21 days (dayIndex >= 69)
    const seasonMultiplier = dayIndex >= 69 ? 1.25 : 1.0;

    for (const site of sites) {
      const baseSiteVol = SITE_VOLUME[site.id] ?? 20;

      // Spike checks
      let spikeMultiplier = 1.0;
      if (dayIndex === 32 && site.id === "pmch") spikeMultiplier = 2.4;
      if (dayIndex === 60 && site.id === "aiims-patna") spikeMultiplier = 2.6;
      if (dayIndex === 78 && site.id === "skmch") spikeMultiplier = 2.2;

      for (const group of BLOOD_GROUPS) {
        const share = GROUP_SHARE[group];
        const meanDemand = baseSiteVol * share * dowMultiplier * seasonMultiplier * spikeMultiplier;

        // Gaussian / Poisson approximation noise
        const u1 = Math.max(1e-6, rand());
        const u2 = rand();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        const noise = z0 * Math.sqrt(Math.max(0.5, meanDemand * 0.4));
        let units = Math.round(meanDemand + noise);
        if (units < 0) units = 0;

        // Ensure small groups get occasional positive demand
        if (meanDemand > 0.05 && units === 0 && rand() < meanDemand * 1.5) {
          units = 1;
        }

        history.push({
          date: dateStr,
          siteId: site.id,
          group,
          units,
        });
      }
    }
  }

  // 2. Generate inventory / batches as of today
  let batchIdCounter = 1;

  for (const site of sites) {
    for (const group of BLOOD_GROUPS) {
      const share = GROUP_SHARE[group];
      const baseSiteVol = SITE_VOLUME[site.id] ?? 20;
      const expectedDailyDemand = baseSiteVol * share * 1.1; // seasonal level

      // Deliberate Flag 1: PMCH O- is low (< 2 days cover)
      if (site.id === "pmch" && group === "O-") {
        batches.push({
          id: `b-${batchIdCounter++}`,
          siteId: site.id,
          group,
          units: 1,
          expiryDate: addDays(FIXED_TODAY, 3),
        });
        continue;
      }

      // Deliberate Flag 2: IGIMS B- is low (< 3 days cover)
      if (site.id === "igims" && group === "B-") {
        batches.push({
          id: `b-${batchIdCounter++}`,
          siteId: site.id,
          group,
          units: 1,
          expiryDate: addDays(FIXED_TODAY, 2),
        });
        continue;
      }

      // Deliberate Flag 3: AIIMS Patna A+ expiring soon (high wastage + cliff stockout)
      if (site.id === "aiims-patna" && group === "A+") {
        // Daily demand is ~6.6. We give 7 units expiring in 1 day, 7 units expiring in 2 days, and none after!
        batches.push({
          id: `b-${batchIdCounter++}`,
          siteId: site.id,
          group,
          units: 7,
          expiryDate: addDays(FIXED_TODAY, 1),
        });
        batches.push({
          id: `b-${batchIdCounter++}`,
          siteId: site.id,
          group,
          units: 7,
          expiryDate: addDays(FIXED_TODAY, 2),
        });
        continue;
      }

      // Deliberate Flag 4: Red Cross Blood Bank has HIGH SURPLUS of O+ and B+ with older batches
      if (site.id === "red-cross-patna" && group === "O+") {
        // Daily demand is ~7. Surplus with older batches expiring in 4-15 days
        batches.push(
          {
            id: `b-${batchIdCounter++}`,
            siteId: site.id,
            group,
            units: 16,
            expiryDate: addDays(FIXED_TODAY, 4),
          },
          {
            id: `b-${batchIdCounter++}`,
            siteId: site.id,
            group,
            units: 20,
            expiryDate: addDays(FIXED_TODAY, 6),
          },
          {
            id: `b-${batchIdCounter++}`,
            siteId: site.id,
            group,
            units: 25,
            expiryDate: addDays(FIXED_TODAY, 12),
          },
          {
            id: `b-${batchIdCounter++}`,
            siteId: site.id,
            group,
            units: 30,
            expiryDate: addDays(FIXED_TODAY, 24),
          }
        );
        continue;
      }

      if (site.id === "red-cross-patna" && group === "B+") {
        batches.push(
          {
            id: `b-${batchIdCounter++}`,
            siteId: site.id,
            group,
            units: 14,
            expiryDate: addDays(FIXED_TODAY, 5),
          },
          {
            id: `b-${batchIdCounter++}`,
            siteId: site.id,
            group,
            units: 18,
            expiryDate: addDays(FIXED_TODAY, 8),
          },
          {
            id: `b-${batchIdCounter++}`,
            siteId: site.id,
            group,
            units: 24,
            expiryDate: addDays(FIXED_TODAY, 18),
          }
        );
        continue;
      }

      // Also give Red Cross some O- surplus for universal donor matching
      if (site.id === "red-cross-patna" && group === "O-") {
        batches.push(
          {
            id: `b-${batchIdCounter++}`,
            siteId: site.id,
            group,
            units: 8,
            expiryDate: addDays(FIXED_TODAY, 5),
          },
          {
            id: `b-${batchIdCounter++}`,
            siteId: site.id,
            group,
            units: 10,
            expiryDate: addDays(FIXED_TODAY, 14),
          }
        );
        continue;
      }

      // Also give SKMCH or Red Cross some B- surplus to supply IGIMS
      if (site.id === "red-cross-patna" && group === "B-") {
        batches.push(
          {
            id: `b-${batchIdCounter++}`,
            siteId: site.id,
            group,
            units: 5,
            expiryDate: addDays(FIXED_TODAY, 6),
          },
          {
            id: `b-${batchIdCounter++}`,
            siteId: site.id,
            group,
            units: 6,
            expiryDate: addDays(FIXED_TODAY, 15),
          }
        );
        continue;
      }

      // Normal sites / groups: 3-5 batches, 7 to 14 days of cover, expiry 4-35 days
      const targetDaysCover = 7 + rand() * 7;
      let targetUnits = Math.round(expectedDailyDemand * targetDaysCover);
      if (targetUnits < 3) targetUnits = Math.max(3, Math.round(expectedDailyDemand * 8));

      const numBatches = 3 + Math.floor(rand() * 3); // 3 to 5 batches
      let remainingUnits = targetUnits;

      for (let b = 0; b < numBatches; b++) {
        const isLast = b === numBatches - 1;
        const bUnits = isLast
          ? Math.max(1, remainingUnits)
          : Math.max(1, Math.round(remainingUnits / (numBatches - b)));
        remainingUnits -= bUnits;

        // Expiry staggered from 6 to 35 days
        const expiryDays = Math.round(6 + (b / numBatches) * 26 + rand() * 4);
        batches.push({
          id: `b-${batchIdCounter++}`,
          siteId: site.id,
          group,
          units: bUnits,
          expiryDate: addDays(FIXED_TODAY, expiryDays),
        });
      }
    }
  }

  return {
    today: FIXED_TODAY,
    sites,
    batches,
    history,
    shocks: [],
  };
}
