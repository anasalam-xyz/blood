import type { Risk } from "./types";

export function evaluateRisk(
  daysOfCover: number,
  p90StockoutDay: number | null
): Risk {
  let risk: Risk = "safe";

  if (daysOfCover < 2) {
    risk = "critical";
  } else if (daysOfCover < 4) {
    risk = "high";
  } else if (daysOfCover < 7) {
    risk = "medium";
  } else {
    risk = "safe";
  }

  // Escalate one level if the p90 stockout is < 2 days
  if (p90StockoutDay !== null && p90StockoutDay < 2) {
    if (risk === "safe") risk = "medium";
    else if (risk === "medium") risk = "high";
    else if (risk === "high") risk = "critical";
  }

  return risk;
}
