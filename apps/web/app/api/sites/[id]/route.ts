import { NextRequest, NextResponse } from "next/server";
import { getWorld, getAnalysis } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const world = getWorld();
  const analysis = getAnalysis();

  const site = world.sites.find((s) => s.id === id);
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  // Last 30 days history
  const todayDate = new Date(world.today + "T00:00:00Z");
  const thirtyDaysAgo = new Date(todayDate.getTime() - 30 * 86400000)
    .toISOString()
    .split("T")[0];

  const siteHistory = world.history.filter(
    (h) => h.siteId === id && h.date >= thirtyDaysAgo
  );

  const siteBatches = world.batches.filter((b) => b.siteId === id);
  const siteCells = analysis.cells.filter((c) => c.siteId === id);

  return NextResponse.json({
    site,
    batches: siteBatches,
    history: siteHistory,
    cells: siteCells,
  });
}
