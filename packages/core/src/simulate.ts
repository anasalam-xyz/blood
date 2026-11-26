import type { Batch, Shock, Transfer, World } from "./types";

export function applyEmergency(
  world: World,
  targetSiteId = "aiims-patna"
): World {
  const shock: Shock = {
    siteId: targetSiteId,
    groups: ["O+", "O-", "A+", "B+"],
    multiplier: 4.0,
    fromDay: 0,
    toDay: 2,
    label: `Emergency Trauma Influx at ${targetSiteId}`,
  };

  // Drain 30% of existing stock at target site
  const updatedBatches = world.batches.map((b) => {
    if (b.siteId === targetSiteId) {
      const remainingUnits = Math.max(0, Math.floor(b.units * 0.7));
      return { ...b, units: remainingUnits };
    }
    return { ...b };
  }).filter((b) => b.units > 0);

  return {
    ...world,
    batches: updatedBatches,
    shocks: [...world.shocks, shock],
  };
}

export function applyTransfer(world: World, transfer: Transfer): World {
  let unitsToMove = transfer.units;
  const newBatches: Batch[] = [];
  let nextBatchId = Date.now();

  const updatedBatches: Batch[] = [];

  for (const b of world.batches) {
    if (
      unitsToMove > 0 &&
      b.siteId === transfer.fromSiteId &&
      b.group === transfer.fromGroup &&
      transfer.batchIds.includes(b.id)
    ) {
      const take = Math.min(b.units, unitsToMove);
      b.units -= take;
      unitsToMove -= take;

      // Create new batch at recipient site
      newBatches.push({
        id: `moved-${nextBatchId++}`,
        siteId: transfer.toSiteId,
        group: transfer.toGroup,
        units: take,
        expiryDate: b.expiryDate, // Expiry preserved
      });

      if (b.units > 0) {
        updatedBatches.push(b);
      }
    } else {
      updatedBatches.push(b);
    }
  }

  return {
    ...world,
    batches: [...updatedBatches, ...newBatches],
  };
}
