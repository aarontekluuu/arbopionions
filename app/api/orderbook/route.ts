import { NextRequest, NextResponse } from "next/server";
import type { OrderbookResponse, ApiError } from "@/lib/types";

/**
 * Generate mock orderbook data for a token
 * In production, this would fetch from Opinion API
 */
function generateMockOrderbook(tokenId: string): OrderbookResponse {
  // Use tokenId hash for deterministic mock data
  const hash = tokenId.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

  const seed = Math.abs(hash) / 2147483647;
  const basePrice = 0.3 + seed * 0.4; // 0.30 - 0.70 range

  const bestBid = {
    price: parseFloat((basePrice - 0.01 - seed * 0.02).toFixed(3)),
    size: Math.floor(100 + seed * 500),
  };

  const bestAsk = {
    price: parseFloat((basePrice + 0.01 + seed * 0.02).toFixed(3)),
    size: Math.floor(100 + seed * 400),
  };

  const spread = parseFloat((bestAsk.price - bestBid.price).toFixed(4));
  const midPrice = parseFloat(((bestBid.price + bestAsk.price) / 2).toFixed(4));

  return {
    tokenId,
    orderbook: {
      tokenId,
      bestBid,
      bestAsk,
      spread,
      midPrice,
    },
    timestamp: Date.now(),
  };
}

/**
 * GET /api/orderbook?tokenId=<tokenId>
 *
 * Returns orderbook data for a token (best bid/ask, spread)
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<OrderbookResponse | ApiError>> {
  try {
    const { searchParams } = request.nextUrl;
    const tokenId = searchParams.get("tokenId");

    if (!tokenId) {
      return NextResponse.json(
        { error: "MISSING_PARAM", message: "tokenId is required" },
        { status: 400 }
      );
    }

    // For MVP, return mock data
    // In production, fetch from Opinion API
    const response = generateMockOrderbook(tokenId);

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/orderbook] Error:", errorMessage);

    return NextResponse.json(
      { error: "API_ERROR", message: "Failed to fetch orderbook data" },
      { status: 500 }
    );
  }
}

