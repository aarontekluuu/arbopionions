import { NextResponse } from "next/server";
import { buildMarketsResponse } from "@/lib/marketAggregation";
import { addSecurityHeaders, getCorsHeaders } from "@/lib/security";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 40;

  try {
    const response = await buildMarketsResponse(Number.isFinite(limit) ? limit : 40);
    const json = NextResponse.json(response, { headers: getCorsHeaders() });
    return addSecurityHeaders(json);
  } catch (error) {
    const json = NextResponse.json(
      {
        error: "MARKETS_FETCH_FAILED",
        message: error instanceof Error ? error.message : "Unable to fetch markets",
      },
      { status: 500, headers: getCorsHeaders() }
    );
    return addSecurityHeaders(json);
  }
}
