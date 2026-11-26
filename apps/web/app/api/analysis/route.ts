import { NextResponse } from "next/server";
import { getAnalysis } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const analysis = getAnalysis();
  return NextResponse.json(analysis);
}
