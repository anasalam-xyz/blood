import { NextRequest, NextResponse } from "next/server";
import { getWorld, setWorld } from "@/lib/store";
import { applyEmergency, analyze } from "@bloodnet/core";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    let siteId = "aiims-patna";
    try {
      const body = await request.json();
      if (body?.siteId) siteId = body.siteId;
    } catch {
      // Body is optional
    }

    const world = getWorld();
    const updatedWorld = applyEmergency(world, siteId);
    setWorld(updatedWorld);

    const newAnalysis = analyze(updatedWorld);
    return NextResponse.json({
      success: true,
      shockSiteId: siteId,
      analysis: newAnalysis,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
