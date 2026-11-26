import type { Analysis } from "@bloodnet/core";

export async function fetchAnalysis(): Promise<Analysis> {
  const res = await fetch("/api/analysis", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch analysis");
  return res.json();
}

export async function approveTransfer(transferId: string): Promise<Analysis> {
  const res = await fetch("/api/transfers/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transferId }),
  });
  if (!res.ok) throw new Error("Failed to approve transfer");
  const data = await res.json();
  return data.analysis;
}

export async function simulateEmergency(siteId = "aiims-patna"): Promise<Analysis> {
  const res = await fetch("/api/simulate/emergency", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ siteId }),
  });
  if (!res.ok) throw new Error("Failed to trigger emergency simulation");
  const data = await res.json();
  return data.analysis;
}

export async function resetNetwork(): Promise<Analysis> {
  const res = await fetch("/api/reset", {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to reset network");
  const data = await res.json();
  return data.analysis;
}
