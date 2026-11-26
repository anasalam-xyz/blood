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

  // Drain 30% of existing stock at target site without mutating input batches
  const updatedBatches = world.batches
    .map((b) => {
      if (b.siteId === targetSiteId) {
        const remainingUnits = Math.max(0, Math.floor(b.units * 0.7));
        return { ...b, units: remainingUnits };
      }
      return { ...b };
    })
    .filter((b) => b.units > 0);

  return {
    ...world,
    batches: updatedBatches,
    shocks: [...world.shocks, shock],
  };
}

export function applyTransfer(world: World, transfer: Transfer): World {
  let unitsToMove = transfer.units;
  const newBatches: Batch[] = [];
  const updatedBatches: Batch[] = [];
  let seq = 1;

  // Sort batches by expiry date ascending so FEFO applies deterministically
  const sortedBatches = [...world.batches].sort((a, b) =>
    a.expiryDate.localeCompare(b.expiryDate)
  );

  for (const b of sortedBatches) {
    if (
      unitsToMove > 0 &&
      b.siteId === transfer.fromSiteId &&
      b.group === transfer.fromGroup &&
      transfer.batchIds.includes(b.id)
    ) {
      const take = Math.min(b.units, unitsToMove);
      const remaining = b.units - take;
      unitsToMove -= take;

      // Create new batch at recipient site with deterministic ID and preserved expiry
      newBatches.push({
        id: `moved-${transfer.id}-${b.id}-${seq++}`,
        siteId: transfer.toSiteId,
        group: transfer.toGroup,
        units: take,
        expiryDate: b.expiryDate,
      });

      if (remaining > 0) {
        updatedBatches.push({ ...b, units: remaining });
      }
    } else {
      updatedBatches.push({ ...b });
    }
  }

  return {
    ...world,
    batches: [...updatedBatches, ...newBatches],
  };
}
