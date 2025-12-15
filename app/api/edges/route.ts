import { NextRequest, NextResponse } from "next/server";
import { computeEdges } from "@/lib/edge";
import { getMockMarkets, getMockLatestPrices } from "@/lib/mock";
import type { EdgesResponse, ApiError, Market, TokenPrice } from "@/lib/types";
import { apiRateLimiter, getClientIdentifier } from "@/lib/rateLimit";
import { validateLimitParam } from "@/lib/validation";
import { getCorsHeaders, sanitizeError, addSecurityHeaders } from "@/lib/security";

// --- Configuration ---

const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 5;
const MAX_LIMIT = 40;
const CACHE_TTL_MS = 10_000; // 10 seconds
const MAX_STALE_AGE_MS = 60_000; // 1 minute max stale

// --- Cache State ---

interface CacheEntry {
  data: EdgesResponse;
  expiresAt: number;
}

let cache: CacheEntry | null = null;
let inflightPromise: Promise<EdgesResponse> | null = null;

// --- Helper Functions ---

function parseLimit(searchParams: URLSearchParams): number {
  const limitParam = searchParams.get("limit");

  if (limitParam === null) {
    return DEFAULT_LIMIT;
  }

  // Validate length first to prevent resource exhaustion
  if (!validateLimitParam(limitParam)) {
    return DEFAULT_LIMIT;
  }

  const parsed = parseInt(limitParam, 10);

  if (Number.isNaN(parsed)) {
    return DEFAULT_LIMIT;
  }

  // Clamp to valid range
  return Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, parsed));
}

function isCacheValid(): boolean {
  return cache !== null && Date.now() < cache.expiresAt;
}

function isStaleCacheValid(): boolean {
  if (!cache) return false;
  const age = Date.now() - cache.expiresAt;
  return age < MAX_STALE_AGE_MS;
}

/**
 * Check if Opinion API is configured
 */
function isOpinionConfigured(): boolean {
  return !!(
    process.env.OPINION_API_KEY && process.env.OPINION_OPENAPI_BASE_URL
  );
}

/**
 * Fetch data from Opinion API
 */
async function fetchFromOpinionAPI(limit: number): Promise<EdgesResponse> {
  // Dynamic import to avoid bundling in client
  const { fetchMarkets, fetchTokenPrices } = await import(
    "@/lib/opinionClient"
  );

  const opinionMarkets = await fetchMarkets(limit);

  if (opinionMarkets.length === 0) {
    return {
      updatedAt: Date.now(),
      stale: false,
      list: [],
    };
  }

  // Log API response structure for debugging (only in development)
  if (process.env.NODE_ENV === "development" && opinionMarkets.length > 0) {
    const sampleMarket = opinionMarkets[0];
    console.log("[DEBUG] Opinion API Response Structure:", {
      totalMarkets: opinionMarkets.length,
      sampleMarket: {
        market_id: sampleMarket.market_id,
        topic_id: (sampleMarket as any).topic_id,
        topicId: (sampleMarket as any).topicId,
        topic_id_number: (sampleMarket as any).topic_id_number,
        topicIdNumber: (sampleMarket as any).topicIdNumber,
        topic: (sampleMarket as any).topic,
        title: sampleMarket.title,
        allKeys: Object.keys(sampleMarket),
        fullSample: JSON.stringify(sampleMarket, null, 2).substring(0, 1000),
      },
    });
  }

  // Convert to internal Market type
  const markets: Market[] = opinionMarkets.map((m, index) => {
    // Try to extract topic_id from various possible field names
    // Check common variations: topic_id, topicId, topic_id_number, topicIdNumber
    const rawTopicId = 
      (m as any).topic_id ?? 
      (m as any).topicId ?? 
      (m as any).topic_id_number ??
      (m as any).topicIdNumber ??
      (m as any).topic?.id ??
      (m as any).topic?.topic_id ??
      undefined;

    // Validate and convert to number
    let topicId: number | undefined = undefined;
    if (rawTopicId !== undefined && rawTopicId !== null) {
      const parsed = Number(rawTopicId);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed) && parsed > 0) {
        topicId = parsed;
      }
    }

    // Log topicId extraction for first few markets in development
    if (process.env.NODE_ENV === "development" && index < 3) {
      console.log(`[DEBUG] Market ${index + 1} topicId extraction:`, {
        market_id: m.market_id,
        title: m.title.substring(0, 50),
        rawTopicId,
        extractedTopicId: topicId,
        topicIdSource: 
          (m as any).topic_id !== undefined ? 'topic_id' :
          (m as any).topicId !== undefined ? 'topicId' :
          (m as any).topic_id_number !== undefined ? 'topic_id_number' :
          (m as any).topicIdNumber !== undefined ? 'topicIdNumber' :
          (m as any).topic?.id !== undefined ? 'topic.id' :
          (m as any).topic?.topic_id !== undefined ? 'topic.topic_id' :
          'NOT_FOUND',
      });
    }

    return {
      marketId: m.market_id,
      topicId,
      marketTitle: m.title,
      yesTokenId: m.yes_token_id,
      noTokenId: m.no_token_id,
      volume24h: m.volume_24h,
      statusEnum: m.status,
    };
  });

  // Log summary of topicId extraction
  if (process.env.NODE_ENV === "development") {
    const marketsWithTopicId = markets.filter(m => m.topicId !== undefined).length;
    console.log(`[DEBUG] TopicId extraction summary: ${marketsWithTopicId}/${markets.length} markets have topicId`);
    
    // Log first 3 markets with their topicId (URL generation happens later in computeEdges)
    if (markets.length > 0) {
      markets.slice(0, 3).forEach((market, idx) => {
        console.log(`[DEBUG] Market ${idx + 1} topicId details:`, {
          marketId: market.marketId,
          topicId: market.topicId,
          title: market.marketTitle.substring(0, 50),
          hasTopicId: market.topicId !== undefined,
        });
      });
    }
  }

  // Collect all token IDs
  const tokenIds = markets.flatMap((m) => [m.yesTokenId, m.noTokenId]);

  // Fetch prices
  const opinionPrices = await fetchTokenPrices(tokenIds);

  // Convert to internal TokenPrice type
  const pricesByToken: Record<string, TokenPrice> = {};
  for (const [tokenId, price] of Object.entries(opinionPrices)) {
    pricesByToken[tokenId] = {
      tokenId: price.token_id,
      price: price.price,
      timestamp: price.timestamp,
    };
  }

  // Log sample price format for validation (only in development)
  if (process.env.NODE_ENV === "development" && Object.keys(pricesByToken).length > 0) {
    const sampleTokenId = Object.keys(pricesByToken)[0];
    const samplePrice = pricesByToken[sampleTokenId];
    const sampleOpinionPrice = opinionPrices[sampleTokenId];
    console.log("[DEBUG] Price format from API:", {
      tokenId: sampleTokenId,
      rawPriceFromAPI: sampleOpinionPrice?.price,
      priceType: typeof sampleOpinionPrice?.price,
      priceValue: samplePrice.price,
    });
  }

  // Compute edges
  const edges = computeEdges(markets, pricesByToken);

  return {
    updatedAt: Date.now(),
    stale: false,
    list: edges,
  };
}

/**
 * Fetch data from mock API (fallback for development)
 */
async function fetchFromMockAPI(limit: number): Promise<EdgesResponse> {
  const markets = getMockMarkets(limit);

  if (markets.length === 0) {
    return {
      updatedAt: Date.now(),
      stale: false,
      list: [],
    };
  }

  const tokenIds = markets.flatMap((m) => [m.yesTokenId, m.noTokenId]);
  const pricesByToken = getMockLatestPrices(tokenIds);

  // Convert mock prices to TokenPrice type
  const tokenPrices: Record<string, TokenPrice> = {};
  for (const [tokenId, price] of Object.entries(pricesByToken)) {
    tokenPrices[tokenId] = {
      tokenId: price.tokenId,
      price: price.price,
      timestamp: price.timestamp,
    };
  }

  const edges = computeEdges(markets, tokenPrices);

  return {
    updatedAt: Date.now(),
    stale: false,
    list: edges,
  };
}

/**
 * Fetch edges with request coalescing
 */
async function fetchEdgesWithCoalescing(
  limit: number
): Promise<EdgesResponse> {
  // If there's already a request in flight, wait for it
  if (inflightPromise) {
    return inflightPromise;
  }

  // Create new request
  inflightPromise = (async () => {
    try {
      let response: EdgesResponse;
      let dataSource: "api" | "mock" = "api";

      if (isOpinionConfigured()) {
        response = await fetchFromOpinionAPI(limit);
        dataSource = "api";
      } else {
        // In production, fail if API not configured (don't use mock)
        if (process.env.NODE_ENV === "production") {
          const missingVars: string[] = [];
          if (!process.env.OPINION_API_KEY) {
            missingVars.push("OPINION_API_KEY");
          }
          if (!process.env.OPINION_OPENAPI_BASE_URL) {
            missingVars.push("OPINION_OPENAPI_BASE_URL");
          }
          
          const errorMessage = `Opinion API not configured. Missing environment variables: ${missingVars.join(", ")}`;
          console.error(`[/api/edges] ${errorMessage}`);
          throw new Error(errorMessage);
        }
        
        // Only use mock in development
        if (process.env.NODE_ENV === "development") {
          const missingVars: string[] = [];
          if (!process.env.OPINION_API_KEY) {
            missingVars.push("OPINION_API_KEY");
          }
          if (!process.env.OPINION_OPENAPI_BASE_URL) {
            missingVars.push("OPINION_OPENAPI_BASE_URL");
          }
          console.warn(
            `[/api/edges] Opinion API not configured, using mock data. Missing: ${missingVars.join(", ")}`
          );
        }
        response = await fetchFromMockAPI(limit);
        dataSource = "mock";
      }

      // Add data source to response metadata (we'll add header in route handler)
      (response as any).__dataSource = dataSource;

      // Update cache
      cache = {
        data: response,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };

      return response;
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}

// --- Route Handler ---

/**
 * GET /api/edges
 *
 * Returns computed market edges with YES/NO complement pricing.
 *
 * Query Parameters:
 * - limit (number): Number of markets to return (default: 20, min: 5, max: 200)
 *
 * Response:
 * - updatedAt (number): Timestamp of when data was computed
 * - stale (boolean): Whether the data is from cache due to API failure
 * - list (MarketEdge[]): Array of market edges sorted by volume24h desc
 * - error (string, optional): Error message if stale
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<EdgesResponse | ApiError>> {
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
    const limit = parseLimit(searchParams);

    // Check if API is configured before proceeding
    if (!isOpinionConfigured() && process.env.NODE_ENV === "production") {
      const missingVars: string[] = [];
      if (!process.env.OPINION_API_KEY) {
        missingVars.push("OPINION_API_KEY");
      }
      if (!process.env.OPINION_OPENAPI_BASE_URL) {
        missingVars.push("OPINION_OPENAPI_BASE_URL");
      }
      
      const apiError: ApiError = {
        error: "API_NOT_CONFIGURED",
        message: `Opinion API not configured. Please set the following environment variables in Vercel: ${missingVars.join(", ")}`,
      };

      const errorResponse = NextResponse.json(apiError, {
        status: 503,
        headers: getCorsHeaders(),
      });
      errorResponse.headers.set("X-Data-Source", "none");
      return addSecurityHeaders(errorResponse);
    }

    // Return cached data if valid
    if (isCacheValid() && cache) {
      const response = NextResponse.json(cache.data, {
        headers: getCorsHeaders(),
      });
      response.headers.set("X-RateLimit-Limit", "60");
      response.headers.set(
        "X-RateLimit-Remaining",
        String(apiRateLimiter.getRemaining(clientId))
      );
      // Add data source header (from cache)
      const dataSource = (cache.data as any).__dataSource || (isOpinionConfigured() ? "api" : "mock");
      response.headers.set("X-Data-Source", dataSource);
      return addSecurityHeaders(response);
    }

    // Fetch fresh data
    const response = await fetchEdgesWithCoalescing(limit);
    const jsonResponse = NextResponse.json(response, {
      headers: getCorsHeaders(),
    });
    jsonResponse.headers.set("X-RateLimit-Limit", "60");
    jsonResponse.headers.set(
      "X-RateLimit-Remaining",
      String(apiRateLimiter.getRemaining(clientId))
    );
    // Add data source header
    const dataSource = (response as any).__dataSource || (isOpinionConfigured() ? "api" : "mock");
    jsonResponse.headers.set("X-Data-Source", dataSource);
    return addSecurityHeaders(jsonResponse);
  } catch (error) {
    // Sanitize error message (never log API keys)
    const errorMessage = sanitizeError(error);
    
    if (process.env.NODE_ENV === "development") {
      console.error("[/api/edges] Error fetching data:", errorMessage);
    }

    // Check if error is about API not being configured
    if (errorMessage.includes("Opinion API not configured") || errorMessage.includes("Missing environment variables")) {
      const missingVars: string[] = [];
      if (!process.env.OPINION_API_KEY) {
        missingVars.push("OPINION_API_KEY");
      }
      if (!process.env.OPINION_OPENAPI_BASE_URL) {
        missingVars.push("OPINION_OPENAPI_BASE_URL");
      }
      
      const apiError: ApiError = {
        error: "API_NOT_CONFIGURED",
        message: `Opinion API not configured. Please set the following environment variables in Vercel: ${missingVars.join(", ")}`,
      };

      const errorResponse = NextResponse.json(apiError, {
        status: 503,
        headers: getCorsHeaders(),
      });
      errorResponse.headers.set("X-Data-Source", "none");
      return addSecurityHeaders(errorResponse);
    }

    // Return stale cached data if available and not too old
    if (isStaleCacheValid() && cache) {
      const staleResponse: EdgesResponse = {
        ...cache.data,
        stale: true,
        error: "Opinion API temporarily unavailable",
      };
      const response = NextResponse.json(staleResponse, {
        headers: getCorsHeaders(),
      });
      return addSecurityHeaders(response);
    }

    // No cache available, return error
    const apiError: ApiError = {
      error: "API_ERROR",
      message: "Failed to fetch market data. Please try again later.",
    };

    const errorResponse = NextResponse.json(apiError, {
      status: 503,
      headers: getCorsHeaders(),
    });
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
