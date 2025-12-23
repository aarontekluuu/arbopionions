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

  // CRITICAL: Log FULL API response structure to identify topicId field
  // This is essential for fixing market links
  if (opinionMarkets.length > 0) {
    const sampleMarket = opinionMarkets[0];
    const fullResponse = JSON.stringify(sampleMarket, null, 2);
    
    console.log("[CRITICAL] Opinion API Response Structure (Full):");
    console.log("=".repeat(80));
    console.log(fullResponse);
    console.log("=".repeat(80));
    console.log("[CRITICAL] All keys in response:", Object.keys(sampleMarket));
    console.log("[CRITICAL] Total markets fetched:", opinionMarkets.length);
    
    // Log first 3 markets for comparison
    if (opinionMarkets.length >= 3) {
      console.log("[CRITICAL] First 3 markets topicId fields:");
      for (let i = 0; i < 3; i++) {
        const m = opinionMarkets[i];
        console.log(`  Market ${i + 1} (ID: ${m.market_id}):`, {
          topic_id: (m as any).topic_id,
          topicId: (m as any).topicId,
          topic_id_number: (m as any).topic_id_number,
          topicIdNumber: (m as any).topicIdNumber,
          topic: (m as any).topic,
          topic_id_string: (m as any).topic_id_string,
          topicIdString: (m as any).topicIdString,
        });
      }
    }
  }

  // Convert to internal Market type
  const markets: Market[] = opinionMarkets.map((m, index) => {
    // Extract topic_id from API response
    // Try all possible field names and variations
    const rawTopicId = 
      (m as any).topic_id ?? 
      (m as any).topicId ?? 
      (m as any).topic_id_number ??
      (m as any).topicIdNumber ??
      (m as any).topic_id_string ??
      (m as any).topicIdString ??
      (m as any).topic?.id ??
      (m as any).topic?.topic_id ??
      (m as any).topic?.topic_id_number ??
      undefined;

    // Validate and convert to number
    let topicId: number | undefined = undefined;
    let topicIdSource = 'NOT_FOUND';
    
    if (rawTopicId !== undefined && rawTopicId !== null) {
      // Handle string or number
      const parsed = typeof rawTopicId === 'string' 
        ? parseFloat(rawTopicId) 
        : Number(rawTopicId);
        
      if (!Number.isNaN(parsed) && Number.isFinite(parsed) && parsed > 0) {
        topicId = Math.floor(parsed); // Ensure integer
        // Identify source for logging
        topicIdSource = 
          (m as any).topic_id !== undefined ? 'topic_id' :
          (m as any).topicId !== undefined ? 'topicId' :
          (m as any).topic_id_number !== undefined ? 'topic_id_number' :
          (m as any).topicIdNumber !== undefined ? 'topicIdNumber' :
          (m as any).topic_id_string !== undefined ? 'topic_id_string' :
          (m as any).topicIdString !== undefined ? 'topicIdString' :
          (m as any).topic?.id !== undefined ? 'topic.id' :
          (m as any).topic?.topic_id !== undefined ? 'topic.topic_id' :
          (m as any).topic?.topic_id_number !== undefined ? 'topic.topic_id_number' :
          'UNKNOWN';
      }
    }

    // Log topicId extraction for first 10 markets (critical for debugging)
    if (index < 10) {
      console.log(`[TOPICID] Market ${index + 1}:`, {
        market_id: m.market_id,
        title: m.title.substring(0, 60),
        rawTopicId,
        extractedTopicId: topicId,
        topicIdSource,
        hasTopicId: !!topicId,
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

  // Log summary of topicId extraction (CRITICAL for debugging)
  const marketsWithTopicId = markets.filter(m => m.topicId !== undefined).length;
  const marketsWithoutTopicId = markets.length - marketsWithTopicId;
  
  console.log("[TOPICID SUMMARY]:", {
    totalMarkets: markets.length,
    marketsWithTopicId,
    marketsWithoutTopicId,
    topicIdSuccessRate: `${((marketsWithTopicId / markets.length) * 100).toFixed(1)}%`,
  });
  
  // If we have markets without topicId, try to fetch them from detail endpoint
  // This is a fallback strategy to get topicId
  if (marketsWithoutTopicId > 0 && marketsWithoutTopicId <= 10) {
    // Only fetch details if reasonable number (avoid too many API calls)
    console.log(`[TOPICID] Attempting to fetch topicId for ${marketsWithoutTopicId} markets from detail endpoint...`);
    
    const { fetchMarketDetails } = await import("@/lib/opinionClient");
    const marketsToFix = markets.filter(m => m.topicId === undefined);
    
    // Fetch details for markets missing topicId (with concurrency limit)
    const detailPromises = marketsToFix.slice(0, 10).map(async (market) => {
      try {
        const details = await fetchMarketDetails(market.marketId);
        if (details) {
          // Try to extract topicId from detail response
          const detailTopicId = 
            (details as any).topic_id ?? 
            (details as any).topicId ?? 
            (details as any).topic_id_number ??
            (details as any).topicIdNumber ??
            (details as any).topic?.id ??
            (details as any).topic?.topic_id;
            
          if (detailTopicId !== undefined && detailTopicId !== null) {
            const parsed = typeof detailTopicId === 'string' 
              ? parseFloat(detailTopicId) 
              : Number(detailTopicId);
            if (!Number.isNaN(parsed) && Number.isFinite(parsed) && parsed > 0) {
              market.topicId = Math.floor(parsed);
              console.log(`[TOPICID] Fixed market ${market.marketId} with topicId ${market.topicId} from detail endpoint`);
            }
          }
        }
      } catch (error) {
        // Silently fail - we'll use search URL fallback
        if (process.env.NODE_ENV === "development") {
          console.warn(`[TOPICID] Failed to fetch details for market ${market.marketId}:`, error);
        }
      }
    });
    
    await Promise.all(detailPromises);
    
    // Recalculate after fixes
    const finalMarketsWithTopicId = markets.filter(m => m.topicId !== undefined).length;
    const finalMarketsWithoutTopicId = markets.length - finalMarketsWithTopicId;
    
    console.log("[TOPICID FINAL]:", {
      marketsWithTopicId: finalMarketsWithTopicId,
      marketsWithoutTopicId: finalMarketsWithoutTopicId,
      fixed: finalMarketsWithTopicId - marketsWithTopicId,
    });
  }
  
  if (marketsWithoutTopicId > 0) {
    console.warn(`[WARN] ${marketsWithoutTopicId} markets missing topicId - will use search URL fallback`);
    // Log first few markets without topicId for debugging
    const missingTopicId = markets.filter(m => m.topicId === undefined).slice(0, 5);
    missingTopicId.forEach(m => {
      console.warn(`  - Market ${m.marketId}: "${m.marketTitle.substring(0, 50)}"`);
    });
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
        const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
        if (isProduction) {
          const missingVars: string[] = [];
          if (!process.env.OPINION_API_KEY) {
            missingVars.push("OPINION_API_KEY");
          }
          if (!process.env.OPINION_OPENAPI_BASE_URL) {
            missingVars.push("OPINION_OPENAPI_BASE_URL");
          }
          
          const errorMessage = `Opinion API not configured. Missing environment variables: ${missingVars.join(", ")}`;
          console.error(`[/api/edges] ${errorMessage}`, {
            NODE_ENV: process.env.NODE_ENV,
            VERCEL_ENV: process.env.VERCEL_ENV,
            hasApiKey: !!process.env.OPINION_API_KEY,
            hasBaseUrl: !!process.env.OPINION_OPENAPI_BASE_URL,
          });
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
    // In Vercel, check for production environment (NODE_ENV or VERCEL_ENV)
    const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
    
    if (!isOpinionConfigured() && isProduction) {
      const missingVars: string[] = [];
      const presentVars: string[] = [];
      
      // Log environment info for debugging (without exposing values)
      const hasApiKey = !!process.env.OPINION_API_KEY;
      const hasBaseUrl = !!process.env.OPINION_OPENAPI_BASE_URL;
      const apiKeyLength = process.env.OPINION_API_KEY?.length || 0;
      const baseUrlLength = process.env.OPINION_OPENAPI_BASE_URL?.length || 0;
      
      console.error("[ENV DEBUG]", {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV,
        hasApiKey,
        hasBaseUrl,
        apiKeyLength,
        baseUrlLength,
        isProduction,
      });
      
      if (!hasApiKey) {
        missingVars.push("OPINION_API_KEY");
      } else {
        presentVars.push("OPINION_API_KEY");
      }
      
      if (!hasBaseUrl) {
        missingVars.push("OPINION_OPENAPI_BASE_URL");
      } else {
        presentVars.push("OPINION_OPENAPI_BASE_URL");
      }
      
      let message = `Opinion API not configured. Please set the following environment variables in Vercel: ${missingVars.join(", ")}`;
      if (presentVars.length > 0) {
        message += ` (Note: ${presentVars.join(", ")} ${presentVars.length === 1 ? "is" : "are"} already set, but ${missingVars.length === 1 ? "this variable is" : "these variables are"} missing)`;
      }
      message += ". After adding variables, redeploy your Vercel application for changes to take effect.";
      message += ` Current environment: ${process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown"}`;
      
      const apiError: ApiError = {
        error: "API_NOT_CONFIGURED",
        message,
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
      const presentVars: string[] = [];
      
      if (!process.env.OPINION_API_KEY) {
        missingVars.push("OPINION_API_KEY");
      } else {
        presentVars.push("OPINION_API_KEY");
      }
      
      if (!process.env.OPINION_OPENAPI_BASE_URL) {
        missingVars.push("OPINION_OPENAPI_BASE_URL");
      } else {
        presentVars.push("OPINION_OPENAPI_BASE_URL");
      }
      
      let message = `Opinion API not configured. Please set the following environment variables in Vercel: ${missingVars.join(", ")}`;
      if (presentVars.length > 0) {
        message += ` (Note: ${presentVars.join(", ")} ${presentVars.length === 1 ? "is" : "are"} already set, but ${missingVars.length === 1 ? "this variable is" : "these variables are"} missing)`;
      }
      message += ". After adding variables, redeploy your Vercel application for changes to take effect.";
      
      const apiError: ApiError = {
        error: "API_NOT_CONFIGURED",
        message,
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
