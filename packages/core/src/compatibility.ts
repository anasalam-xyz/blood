import type { BloodGroup } from "./types";

// Donor to compatible recipients mapping
export const RED_CELL_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  "O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
  "O+": ["O+", "A+", "B+", "AB+"],
  "A-": ["A-", "A+", "AB-", "AB+"],
  "A+": ["A+", "AB+"],
  "B-": ["B-", "B+", "AB-", "AB+"],
  "B+": ["B+", "AB+"],
  "AB-": ["AB-", "AB+"],
  "AB+": ["AB+"],
};

export function isCompatible(donor: BloodGroup, recipient: BloodGroup): boolean {
  return RED_CELL_COMPATIBILITY[donor]?.includes(recipient) ?? false;
}

export function getCompatibleDonors(recipient: BloodGroup): BloodGroup[] {
  const donors: BloodGroup[] = [];
  for (const [donor, recipients] of Object.entries(RED_CELL_COMPATIBILITY) as [
    BloodGroup,
    BloodGroup[]
  ][]) {
    if (recipients.includes(recipient)) {
      donors.push(donor);
    }
  }

  // Sort order: exact group first, then other cross-matches, and O- last if recipient is not O-
  return donors.sort((a, b) => {
    if (a === recipient) return -1;
    if (b === recipient) return 1;
    if (a === "O-" && recipient !== "O-") return 1;
    if (b === "O-" && recipient !== "O-") return -1;
    return a.localeCompare(b);
  });
}

export function getCompatibilityPenalty(
  donor: BloodGroup,
  recipient: BloodGroup
): number {
  if (donor === recipient) return 0;
  if (donor === "O-" && recipient !== "O-") return 100; // O- is scarce, last resort
  return 40;
}
