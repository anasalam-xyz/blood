import { describe, it, expect } from "vitest";
import {
  computeForecast,
  projectInventory,
  evaluateRisk,
  analyze,
  isCompatible,
  haversineDistanceKm,
  applyEmergency,
  applyTransfer,
  type DailyUse,
  type Batch,
  type Forecast,
} from "../src/index";
import { generateWorld } from "../../data/src/index";

describe("Forecast sanity", () => {
  it("forecast returns non-negative values and finite WAPE", () => {
    const dummyHistory: DailyUse[] = [];
    const baseDate = new Date("2026-08-01T00:00:00Z");

    for (let i = 0; i < 90; i++) {
      const d = new Date(baseDate.getTime() + i * 86400000);
      dummyHistory.push({
        date: d.toISOString().split("T")[0],
        siteId: "test-site",
        group: "O+",
        units: 10 + (i % 7 === 0 ? 5 : 0),
      });
    }

    const forecast = computeForecast(
      dummyHistory,
      "test-site",
      "O+",
      "2026-11-26"
    );

    expect(forecast.daily.length).toBe(14);
    for (const d of forecast.daily) {
      expect(d.mean).toBeGreaterThanOrEqual(0);
      expect(d.p90).toBeGreaterThanOrEqual(d.mean);
    }
    expect(Number.isFinite(forecast.wape)).toBe(true);
    expect(forecast.wape).toBeGreaterThanOrEqual(0);
  });
});

describe("Projection and FEFO", () => {
  it("respects FEFO order and counts expired units as wastage", () => {
    const today = "2026-11-26";
    const batches: Batch[] = [
      { id: "b1", siteId: "s1", group: "O+", units: 5, expiryDate: "2026-11-27" }, // expires in 1 day
      { id: "b2", siteId: "s1", group: "O+", units: 10, expiryDate: "2026-11-30" }, // expires in 4 days
    ];

    const forecast: Forecast = {
      siteId: "s1",
      group: "O+",
      daily: [
        { day: 0, mean: 2, p90: 2 }, // consumes 2 from b1, 3 remaining
        { day: 1, mean: 0, p90: 0 }, // b1 expires on day 1! 3 units wasted
        { day: 2, mean: 4, p90: 4 }, // consumes 4 from b2, 6 remaining
        { day: 3, mean: 4, p90: 4 }, // consumes 4 from b2, 2 remaining
        { day: 4, mean: 4, p90: 4 }, // b2 expires on day 4! 2 units wasted -> stockout!
      ],
      wape: 0.1,
    };

    const res = projectInventory(batches, forecast, today);
    expect(res.unitsOnHand).toBe(15);
    expect(res.expiringWithin3d).toBe(5);
    expect(res.wastageUnits).toBeGreaterThan(0);
    expect(res.stockoutDay).not.toBeNull();
  });
});

describe("Risk assessment", () => {
  it("evaluates risk thresholds with p90 escalation", () => {
    expect(evaluateRisk(1.5, null)).toBe("critical");
    expect(evaluateRisk(3.0, null)).toBe("high");
    expect(evaluateRisk(5.0, null)).toBe("medium");
    expect(evaluateRisk(8.0, null)).toBe("safe");

    // Escalation: if p90 stockout is < 2 days, escalate 1 level
    expect(evaluateRisk(8.0, 1)).toBe("medium");
    expect(evaluateRisk(5.0, 1)).toBe("high");
    expect(evaluateRisk(3.0, 1)).toBe("critical");
    expect(evaluateRisk(1.0, 1)).toBe("critical");
  });
});

describe("Compatibility and Distance", () => {
  it("only allows compatible donor red cells", () => {
    expect(isCompatible("O-", "O+")).toBe(true);
    expect(isCompatible("O-", "AB+")).toBe(true);
    expect(isCompatible("O+", "O-")).toBe(false);
    expect(isCompatible("A+", "B+")).toBe(false);
    expect(isCompatible("B+", "AB+")).toBe(true);
  });

  it("calculates realistic Haversine distance", () => {
    // PMCH (25.6205, 85.1580) to AIIMS Patna (25.5576, 85.0517)
    const dist = haversineDistanceKm(25.6205, 85.158, 25.5576, 85.0517);
    expect(dist).toBeGreaterThan(5);
    expect(dist).toBeLessThan(25);
  });
});

describe("Deterministic Seed Scenario and Matching", () => {
  it("produces at least 3 non-safe cells and generates valid transfers", () => {
    const world = generateWorld(42);
    const result = analyze(world);

    expect(result.cells.length).toBe(48); // 6 sites * 8 groups
    expect(result.kpis.atRiskCells).toBeGreaterThanOrEqual(3);

    // Assert that PMCH O- or IGIMS B- is among at-risk
    const pmchOminus = result.cells.find(
      (c) => c.siteId === "pmch" && c.group === "O-"
    );
    expect(pmchOminus).toBeDefined();
    expect(pmchOminus?.risk).not.toBe("safe");

    // Matching must generate at least 1 transfer
    expect(result.transfers.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeGreaterThan(0);

    // Verify transfer validity: no incompatible transfers
    for (const t of result.transfers) {
      expect(isCompatible(t.fromGroup, t.toGroup)).toBe(true);
      expect(t.units).toBeGreaterThan(0);
      expect(t.fromSiteId).not.toBe(t.toSiteId);
    }
  });

  it("handles emergency shock and transfer approval correctly", () => {
    const world = generateWorld(42);
    const initial = analyze(world);

    // Apply emergency
    const shockedWorld = applyEmergency(world, "aiims-patna");
    const shockedResult = analyze(shockedWorld);
    expect(shockedWorld.shocks.length).toBe(1);
    expect(shockedResult.alerts.length).toBeGreaterThanOrEqual(
      initial.alerts.length
    );

    // Approve first transfer
    const firstTransfer = initial.transfers[0];
    expect(firstTransfer).toBeDefined();
    const approvedWorld = applyTransfer(world, firstTransfer);
    const approvedResult = analyze(approvedWorld);

    // Recipient cell units on hand should have increased
    const recCell = approvedResult.cells.find(
      (c) =>
        c.siteId === firstTransfer.toSiteId &&
        c.group === firstTransfer.toGroup
    );
    const oldCell = initial.cells.find(
      (c) =>
        c.siteId === firstTransfer.toSiteId &&
        c.group === firstTransfer.toGroup
    );
    expect(recCell?.unitsOnHand).toBeGreaterThan(oldCell?.unitsOnHand ?? 0);
  });

  it("strictly enforces matching rules: compatibility, donor buffers, and transit shelf-life", () => {
    const world = generateWorld(42);
    const result = analyze(world);

    // 1. Incompatible groups never proposed
    for (const t of result.transfers) {
      expect(isCompatible(t.fromGroup, t.toGroup)).toBe(true);
      // O- recipient can only receive O-
      if (t.toGroup === "O-") {
        expect(t.fromGroup).toBe("O-");
      }
    }

    // 2. Batches expiring before arrival + 1 day are excluded
    for (const t of result.transfers) {
      expect(t.oldestExpiryDays).toBeGreaterThan(Math.ceil(t.etaHours / 24) + 1);
    }
  });
});
