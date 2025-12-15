import { NextRequest, NextResponse } from "next/server";
import { computeEdges } from "@/lib/edge";
import { getMockMarkets, getMockLatestPrices } from "@/lib/mock";
import type { EdgesResponse, ApiError, Market, TokenPrice } from "@/lib/types";

// --- Configuration ---

const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 5;
const MAX_LIMIT = 40;
const CACHE_TTL_MS = 10_000; // 10 seconds

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
    console.log("[DEBUG] Sample Opinion API market response:", {
      market_id: sampleMarket.market_id,
      topic_id: (sampleMarket as any).topic_id,
      title: sampleMarket.title,
      allKeys: Object.keys(sampleMarket),
    });
  }

  // Convert to internal Market type
  const markets: Market[] = opinionMarkets.map((m) => {
    // Try to extract topic_id from various possible field names
    const topicId = 
      (m as any).topic_id ?? 
      (m as any).topicId ?? 
      (m as any).topic_id_number ??
      undefined;

    return {
      marketId: m.market_id,
      topicId: topicId, // Use topic_id if available for URL generation
      marketTitle: m.title,
      yesTokenId: m.yes_token_id,
      noTokenId: m.no_token_id,
      volume24h: m.volume_24h,
      statusEnum: m.status,
    };
  });

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

      if (isOpinionConfigured()) {
        response = await fetchFromOpinionAPI(limit);
      } else {
        // Fall back to mock data in development
        console.warn(
          "[/api/edges] Opinion API not configured, using mock data"
        );
        response = await fetchFromMockAPI(limit);
      }

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
 * - limit (number): Number of markets to return (default: 20, min: 5, max: 40)
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
    const { searchParams } = request.nextUrl;
    const limit = parseLimit(searchParams);

    // Return cached data if valid
    if (isCacheValid() && cache) {
      return NextResponse.json(cache.data);
    }

    // Fetch fresh data
    const response = await fetchEdgesWithCoalescing(limit);
    return NextResponse.json(response);
  } catch (error) {
    // Log error (but never log API keys)
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[/api/edges] Error fetching data:", errorMessage);

    // Return stale cached data if available
    if (cache) {
      const staleResponse: EdgesResponse = {
        ...cache.data,
        stale: true,
        error: "Opinion API temporarily unavailable",
      };
      return NextResponse.json(staleResponse);
    }

    // No cache available, return error
    const apiError: ApiError = {
      error: "API_ERROR",
      message: "Failed to fetch market data. Please try again later.",
    };

    return NextResponse.json(apiError, { status: 503 });
  }
}
