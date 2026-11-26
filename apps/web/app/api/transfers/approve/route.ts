import { NextRequest, NextResponse } from "next/server";
import { getWorld, setWorld } from "@/lib/store";
import { applyTransfer, analyze } from "@bloodnet/core";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    let body: { transferId?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const { transferId } = body;
    if (!transferId || typeof transferId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid transferId" },
        { status: 400 }
      );
    }

    const world = getWorld();
    const currentAnalysis = analyze(world);

    const transfer = currentAnalysis.transfers.find((t) => t.id === transferId);
    if (!transfer) {
      return NextResponse.json(
        { error: `Transfer with id ${transferId} not found` },
        { status: 404 }
      );
    }

    const updatedWorld = applyTransfer(world, transfer);
    setWorld(updatedWorld);

    const newAnalysis = analyze(updatedWorld);
    return NextResponse.json({
      success: true,
      transfer,
      analysis: newAnalysis,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
