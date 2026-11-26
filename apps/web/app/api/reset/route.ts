import { NextResponse } from "next/server";
import { resetWorld, getAnalysis } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST() {
  resetWorld();
  const analysis = getAnalysis();
  return NextResponse.json({
    success: true,
    message: "World reset to initial seed state",
    analysis,
  });
}
