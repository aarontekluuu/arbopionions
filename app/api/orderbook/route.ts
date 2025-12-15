import { NextRequest, NextResponse } from "next/server";
import type { OrderbookResponse, ApiError } from "@/lib/types";
import { validateTokenId } from "@/lib/validation";
import { apiRateLimiter, getClientIdentifier } from "@/lib/rateLimit";
import { getCorsHeaders, sanitizeError, addSecurityHeaders } from "@/lib/security";

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
    // Rate limiting
    const clientId = getClientIdentifier(request);
    if (!apiRateLimiter.isAllowed(clientId)) {
      const response = NextResponse.json(
        {
          error: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please try again later.",
        },
        { status: 429, headers: getCorsHeaders() }
      );
      response.headers.set("X-RateLimit-Limit", "60");
      response.headers.set("X-RateLimit-Remaining", "0");
      response.headers.set(
        "X-RateLimit-Reset",
        String(Math.ceil(apiRateLimiter.getResetTime(clientId) / 1000))
      );
      return addSecurityHeaders(response);
    }

    const { searchParams } = request.nextUrl;
    const tokenId = searchParams.get("tokenId");

    // Validate tokenId parameter
    if (!tokenId) {
      const response = NextResponse.json(
        { error: "MISSING_PARAM", message: "tokenId is required" },
        { status: 400, headers: getCorsHeaders() }
      );
      return addSecurityHeaders(response);
    }

    // Validate tokenId format to prevent injection attacks
    if (!validateTokenId(tokenId)) {
      const response = NextResponse.json(
        {
          error: "INVALID_PARAM",
          message: "Invalid tokenId format",
        },
        { status: 400, headers: getCorsHeaders() }
      );
      return addSecurityHeaders(response);
    }

    // For MVP, return mock data
    // In production, fetch from Opinion API
    const response = generateMockOrderbook(tokenId);
    const jsonResponse = NextResponse.json(response, {
      headers: getCorsHeaders(),
    });
    jsonResponse.headers.set("X-RateLimit-Limit", "60");
    jsonResponse.headers.set(
      "X-RateLimit-Remaining",
      String(apiRateLimiter.getRemaining(clientId))
    );
    return addSecurityHeaders(jsonResponse);
  } catch (error) {
    const errorMessage = sanitizeError(error);
    
    if (process.env.NODE_ENV === "development") {
      console.error("[/api/orderbook] Error:", errorMessage);
    }

    const errorResponse = NextResponse.json(
      { error: "API_ERROR", message: "Failed to fetch orderbook data" },
      { status: 500, headers: getCorsHeaders() }
    );
    return addSecurityHeaders(errorResponse);
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(): Promise<NextResponse> {
  const response = new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
  return addSecurityHeaders(response);
}
