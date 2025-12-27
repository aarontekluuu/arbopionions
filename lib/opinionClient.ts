/**
 * Opinion OpenAPI client (server-side only)
 *
 * Features:
 * - Fetch with API key header
 * - 7s timeout
 * - Retry with exponential backoff on 429/5xx (max 2 retries)
 * - Concurrency limiter (max 10 inflight requests)
 */

import "server-only";

// --- Types for Opinion API responses ---

export interface OpinionMarket {
  // Primary fields from API (camelCase)
  marketId: number;
  marketTitle: string;
  yesTokenId: string;
  noTokenId: string;
  volume24h: string;
  status: number;
  statusEnum: string;
  questionId?: string; // May be used for topicId mapping
  
  // TopicId can appear in various formats - we'll try all of them
  topic_id?: number | string; // Legacy snake_case variant
  topicId?: number | string; // CamelCase variant
  topic_id_number?: number | string; // Alternative naming
  topicIdNumber?: number | string; // CamelCase variant
  topic_id_string?: string; // String variant
  topicIdString?: string; // CamelCase string variant
  topic?: { 
    id?: number | string; 
    topic_id?: number | string;
    topic_id_number?: number | string;
  }; // Nested topic object
  
  // Additional fields from API
  marketType?: number;
  childMarkets?: any;
  yesLabel?: string;
  noLabel?: string;
  rules?: string;
  conditionId?: string;
  resultTokenId?: string;
  volume?: string;
  volume7d?: string;
  quoteToken?: string;
  chainId?: string;
  createdAt?: number;
  cutoffAt?: number;
  resolvedAt?: number;
  
  // Allow additional fields from API (for flexibility)
  [key: string]: any;
}

export interface OpinionMarketsResponse {
  data: OpinionMarket[];
}

export interface OpinionTokenPrice {
  token_id: string;
  price: string;
  timestamp: number;
}

export interface OpinionTokenPriceResponse {
  data: OpinionTokenPrice;
}

// --- Configuration ---

const TIMEOUT_MS = 7000;
const MAX_RETRIES = 2;
const MAX_CONCURRENT = 10;
const INITIAL_BACKOFF_MS = 500;
const API_PAGE_SIZE = 15; // Opinion API actually returns max 15 markets per page (not 16)

// --- Concurrency Limiter ---

class ConcurrencyLimiter {
  private inflight = 0;
  private queue: Array<() => void> = [];

  constructor(private maxConcurrent: number) {}

  async acquire(): Promise<void> {
    if (this.inflight < this.maxConcurrent) {
      this.inflight++;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.inflight++;
        resolve();
      });
    });
  }

  release(): void {
    this.inflight--;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}

const limiter = new ConcurrencyLimiter(MAX_CONCURRENT);

// --- Helper Functions ---

function getConfig() {
  const apiKey = process.env.OPINION_API_KEY;
  const baseUrl = process.env.OPINION_OPENAPI_BASE_URL;

  if (!apiKey) {
    throw new Error("OPINION_API_KEY environment variable is not set");
  }

  if (!baseUrl) {
    throw new Error("OPINION_OPENAPI_BASE_URL environment variable is not set");
  }

  // Remove any trailing whitespace/newlines from baseUrl
  const cleanBaseUrl = baseUrl.trim();

  return { apiKey, baseUrl: cleanBaseUrl };
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit
): Promise<Response> {
  let lastError: Error | null = null;
  let backoffMs = INITIAL_BACKOFF_MS;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await limiter.acquire();

      try {
        const response = await fetchWithTimeout(url, options, TIMEOUT_MS);

        if (response.ok) {
          return response;
        }

        if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
          // Wait before retry
          await sleep(backoffMs);
          backoffMs *= 2;
          continue;
        }

        // Non-retryable error or max retries exceeded
        throw new Error(
          `Opinion API error: ${response.status} ${response.statusText}`
        );
      } finally {
        limiter.release();
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if it's an abort error (timeout)
      if (
        lastError.name === "AbortError" ||
        lastError.message.includes("aborted")
      ) {
        lastError = new Error(`Opinion API request timed out after ${TIMEOUT_MS}ms`);
      }

      if (attempt < MAX_RETRIES) {
        await sleep(backoffMs);
        backoffMs *= 2;
        continue;
      }
    }
  }

  throw lastError || new Error("Opinion API request failed");
}

// --- Public API ---

/**
 * Fetch a single page of markets from Opinion API
 * Internal helper function for pagination
 * 
 * @param pageLimit - Number of markets to fetch in this page (max API_PAGE_SIZE)
 * @param offset - Offset for pagination
 * @returns Object with markets array and total count (if available)
 */
async function fetchMarketsPage(
  pageLimit: number,
  offset: number
): Promise<{ markets: OpinionMarket[]; total?: number }> {
  const { apiKey, baseUrl } = getConfig();

  const url = new URL(`${baseUrl}/market`);
  url.searchParams.set("status", "activated");
  url.searchParams.set("sortBy", "5"); // Sort by volume
  url.searchParams.set("limit", String(pageLimit));
    url.searchParams.set("offset", String(offset));

  console.log(`[Opinion API] Fetching markets page: offset=${offset}, limit=${pageLimit}`);

  try {
    const response = await fetchWithRetry(url.toString(), {
      method: "GET",
      headers: {
        apikey: apiKey,
        Accept: "application/json",
      },
    });

    console.log(`[Opinion API] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Opinion API] Error response:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText.substring(0, 500),
      });
      throw new Error(`Opinion API error: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();
    
    // Check for error response structure (errno, errmsg, result)
    if (data.errno !== undefined && data.errno !== 0) {
      const errorMsg = data.errmsg || "Unknown API error";
      const errorNo = data.errno;
      console.error(`[Opinion API] API returned error:`, {
        errno: errorNo,
        errmsg: errorMsg,
        fullResponse: JSON.stringify(data).substring(0, 1000),
      });
      
      if (errorMsg.includes("United States") || errorMsg.includes("restricted jurisdictions")) {
        throw new Error(`Opinion API geo-blocking: ${errorMsg}. The API is not available from Vercel's server locations. Consider using a proxy or different hosting region.`);
      }
      
      throw new Error(`Opinion API error ${errorNo}: ${errorMsg}`);
    }
    
    // Handle different response structures
    let markets: OpinionMarket[] = [];
    
    if (data.result && Array.isArray(data.result.list)) {
      markets = data.result.list;
      const pageNum = Math.floor(offset / pageLimit) + 1;
      console.log(`[Opinion API] Page ${pageNum}: Using result.list format, found ${markets.length} markets`);
      
      // IMPORTANT: Extract total BEFORE we check for pagination
      // The total is in data.result.total when using result.list format
      if (data.result.total !== undefined && typeof data.result.total === 'number') {
        // This will be captured in the total extraction below
      }
    } else if (Array.isArray(data.data)) {
      markets = data.data;
      console.log(`[Opinion API] Page ${offset / pageLimit + 1}: Using data.data format, found ${markets.length} markets`);
    } else if (Array.isArray(data.result)) {
      markets = data.result;
      console.log(`[Opinion API] Page ${offset / pageLimit + 1}: Using result array format, found ${markets.length} markets`);
    } else if (Array.isArray(data)) {
      markets = data;
      console.log(`[Opinion API] Page ${offset / pageLimit + 1}: Using direct array format, found ${markets.length} markets`);
    }
    
    // Extract total count from response if available
    // The API returns total in data.result.total when using result.list format
    let total: number | undefined = undefined;
    if (data.result) {
      // Check for total in result object (common structure)
      if (typeof data.result.total === 'number') {
        total = data.result.total;
        console.log(`[Opinion API] Total markets available (from result.total): ${total}`);
      }
      // Also check for count or other pagination fields
      if (total === undefined && typeof data.result.count === 'number') {
        total = data.result.count;
        console.log(`[Opinion API] Total markets available (from result.count): ${total}`);
      }
    }
    // Check top-level total
    if (total === undefined && data.total !== undefined && typeof data.total === 'number') {
      total = data.total;
      console.log(`[Opinion API] Total markets available (from data.total): ${total}`);
    }
    
    // Log full result structure for debugging if total not found
    if (total === undefined && data.result) {
      console.log(`[Opinion API] Total not found in response. Result keys:`, Object.keys(data.result));
    }
    
    // Comprehensive debug logging
    console.log(`[Opinion API] Page fetch details:`, {
      offset,
      pageLimit,
      marketsReturned: markets.length,
      totalAvailable: total,
      hasTotal: total !== undefined,
      responseStructure: {
        hasResult: !!data.result,
        hasData: !!data.data,
        resultKeys: data.result ? Object.keys(data.result) : [],
        dataKeys: Object.keys(data),
      },
    });
    
    return { markets, total };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Opinion API] Failed to fetch markets page (offset=${offset}):`, errorMessage);
    throw error;
  }
}

/**
 * Fetch activated markets from Opinion API with automatic pagination
 * 
 * When the requested limit exceeds the API's page size (16), this function
 * automatically makes multiple requests to fetch all requested markets.
 * 
 * @param limit - Maximum number of markets to fetch
 * @param offset - Optional starting offset (for manual pagination, usually not needed)
 * @returns Array of OpinionMarket objects
 */
export async function fetchMarkets(
  limit: number,
  offset?: number
): Promise<OpinionMarket[]> {
  const startOffset = offset || 0;
  
  // Always use pagination to handle cases where API returns fewer markets per page than expected
  // This ensures we fetch all available markets up to the requested limit
  console.log(`[Opinion API] Fetching ${limit} markets with pagination (page size: ${API_PAGE_SIZE})`);
  
  const allMarkets: OpinionMarket[] = [];
  let currentOffset = startOffset;
  let remaining = limit;
  let totalAvailable: number | undefined = undefined;
  let pageCount = 0;
  let consecutiveEmptyPages = 0;
  const MAX_EMPTY_PAGES = 2; // Stop after 2 consecutive empty pages
  
  // Fetch pages until we have enough markets or no more are available
  while (remaining > 0) {
    pageCount++;
    const pageLimit = Math.min(API_PAGE_SIZE, remaining);
    console.log(`[Opinion API] Pagination loop: page ${pageCount}, requesting ${pageLimit} markets at offset ${currentOffset}, ${remaining} remaining`);
    
    const pageResult = await fetchMarketsPage(pageLimit, currentOffset);
    const pageMarkets = pageResult.markets;
    
    // Capture total count from first page if available
    if (totalAvailable === undefined && pageResult.total !== undefined) {
      totalAvailable = pageResult.total;
      console.log(`[Opinion API] Total markets available from API: ${totalAvailable}`);
    }
    
    // If we got no markets, increment empty page counter
    if (pageMarkets.length === 0) {
      consecutiveEmptyPages++;
      console.log(`[Opinion API] Empty page at offset ${currentOffset} (consecutive empty: ${consecutiveEmptyPages})`);
      
      if (consecutiveEmptyPages >= MAX_EMPTY_PAGES) {
        console.log(`[Opinion API] Stopping after ${consecutiveEmptyPages} consecutive empty pages`);
        break;
      }
      
      // Try next page with same offset increment
      currentOffset += pageLimit;
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }
    
    // Reset empty page counter if we got markets
    consecutiveEmptyPages = 0;
    
    console.log(`[Opinion API] Page ${pageCount} result: got ${pageMarkets.length} markets, adding to collection (had ${allMarkets.length}, will have ${allMarkets.length + pageMarkets.length})`);
    
    allMarkets.push(...pageMarkets);
    currentOffset += pageMarkets.length;
    remaining -= pageMarkets.length;
    
    console.log(`[Opinion API] After page ${pageCount}: collected ${allMarkets.length}/${limit} markets, ${remaining} remaining, currentOffset=${currentOffset}${totalAvailable ? `, totalAvailable=${totalAvailable}` : ''}`);
    
    // Check if we've reached the total available markets
    if (totalAvailable !== undefined && currentOffset >= totalAvailable) {
      console.log(`[Opinion API] Reached total available markets (${totalAvailable})`);
      break;
    }
    
    // If we got fewer markets than requested, check if we should continue
    // IMPORTANT: API consistently returns 15 markets per page regardless of requested limit
    // We MUST continue fetching if we still need more markets
    if (pageMarkets.length < pageLimit) {
      // If we know the total and we've reached it, break
      if (totalAvailable !== undefined && currentOffset >= totalAvailable) {
        console.log(`[Opinion API] Reached end of available markets (got ${pageMarkets.length}, total: ${totalAvailable})`);
        break;
      }
      
      // CRITICAL: If we still need more markets, we MUST continue
      // The API returns 15 markets per page, so we need multiple pages
      if (remaining > 0) {
        console.log(`[Opinion API] Got ${pageMarkets.length} markets (less than requested ${pageLimit}), MUST continue fetching (${remaining} remaining, total available: ${totalAvailable || 'unknown'})`);
        // Continue to next page - CRITICAL: don't break here!
      } else {
        // We've reached our requested limit, stop
        console.log(`[Opinion API] Reached requested limit of ${limit} markets`);
        break;
      }
    }
    
    // If we got exactly the page size (15) but still need more, continue
    // This is the normal case - API returns 15 per page, we need multiple pages
    if (pageMarkets.length === pageLimit && remaining > 0) {
      console.log(`[Opinion API] Got full page (${pageMarkets.length} markets), continuing to fetch more (${remaining} remaining)`);
    }
    
    // Small delay between pages to avoid rate limiting
    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`[Opinion API] Pagination complete: fetched ${allMarkets.length} markets (requested: ${limit}, pages: ${pageCount}${totalAvailable ? `, total available: ${totalAvailable}` : ''})`);
  
  // If we got fewer than requested, log a warning with detailed diagnostics
  if (allMarkets.length < limit) {
    if (totalAvailable !== undefined && allMarkets.length >= totalAvailable) {
      console.log(`[Opinion API] Fetched all available markets (${allMarkets.length}/${totalAvailable})`);
    } else {
      console.warn(`[Opinion API] WARNING: Only fetched ${allMarkets.length} markets out of ${limit} requested.`);
      console.warn(`  - Total available from API: ${totalAvailable || 'unknown'}`);
      console.warn(`  - Pages fetched: ${pageCount}`);
      console.warn(`  - Final offset: ${currentOffset}`);
      console.warn(`  - Remaining needed: ${remaining}`);
      console.warn(`  - This may indicate:`);
      console.warn(`    * API pagination issue (API may be ignoring offset parameter)`);
      console.warn(`    * API rate limiting`);
      console.warn(`    * API returning fewer markets than requested per page`);
    }
  }
  
  return allMarkets;
}

/**
 * Fetch latest price for a single token
 */
export async function fetchTokenPrice(
  tokenId: string
): Promise<OpinionTokenPrice | null> {
  const { apiKey, baseUrl } = getConfig();

  const url = new URL(`${baseUrl}/token/latest-price`);
  url.searchParams.set("token_id", tokenId);

  console.log(`[PRICES] Fetching price for token: ${tokenId.substring(0, 20)}... from ${url.toString()}`);

  try {
    const response = await fetchWithRetry(url.toString(), {
      method: "GET",
      headers: {
        apikey: apiKey,
        Accept: "application/json",
      },
    });

    console.log(`[PRICES] Price API response status: ${response.status} ${response.statusText} for token ${tokenId.substring(0, 20)}...`);

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[PRICES] Price API error for token ${tokenId}:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText.substring(0, 200),
      });
      return null;
    }

    const data: any = await response.json();
    
    console.log(`[PRICES] Price API response structure for token ${tokenId.substring(0, 20)}...:`, {
      hasData: !!data,
      keys: Object.keys(data),
      errno: data.errno,
      errmsg: data.errmsg,
      hasResult: !!data.result,
      hasDataField: !!data.data,
      responsePreview: JSON.stringify(data).substring(0, 300),
    });
    
    // Check for error response structure (errno, errmsg, result)
    // errno: 0 means success, non-zero means error
    if (data.errno !== undefined && data.errno !== 0) {
      const errorMsg = data.errmsg || "Unknown API error";
      console.warn(`[PRICES] Price API returned error for token ${tokenId.substring(0, 20)}...:`, {
        errno: data.errno,
        errmsg: errorMsg,
        fullResponse: JSON.stringify(data).substring(0, 500),
      });
      return null;
    }
    
    // Handle different response structures:
    // - Success with result directly containing price data (errno: 0, result: { tokenId, price, timestamp } })
    // - Success with result.data (errno: 0, result: { data: {...} })
    // - Success with data.data (legacy format)
    // - Direct data object
    let price: OpinionTokenPrice | null = null;
    
    if (data.result && data.result.tokenId && data.result.price !== undefined) {
      // New format: { errno: 0, errmsg: "", result: { tokenId, price, timestamp, ... } }
      // Map tokenId to token_id for our interface
      price = {
        token_id: data.result.tokenId,
        price: data.result.price,
        timestamp: data.result.timestamp || Date.now(),
      };
      console.log(`[PRICES] Using result format (direct) for token ${tokenId.substring(0, 20)}...`);
    } else if (data.result && data.result.data) {
      // Nested format: { errno: 0, errmsg: "", result: { data: {...} } }
      price = data.result.data;
      console.log(`[PRICES] Using result.data format for token ${tokenId.substring(0, 20)}...`);
    } else if (data.data) {
      // Legacy format: { data: {...} }
      price = data.data;
      console.log(`[PRICES] Using data.data format for token ${tokenId.substring(0, 20)}...`);
    } else if (data.token_id && data.price !== undefined) {
      // Direct price object
      price = data;
      console.log(`[PRICES] Using direct price object for token ${tokenId.substring(0, 20)}...`);
    } else {
      console.warn(`[PRICES] Could not extract price from response for token ${tokenId.substring(0, 20)}...:`, {
        responseKeys: Object.keys(data),
        responsePreview: JSON.stringify(data).substring(0, 500),
      });
    }
    
    if (price) {
      console.log(`[PRICES] Successfully extracted price for token ${tokenId.substring(0, 20)}...:`, {
        token_id: price.token_id,
        price: price.price,
        timestamp: price.timestamp,
      });
    }
    
    return price;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[PRICES] Exception fetching price for token ${tokenId}:`, errorMessage);
    // Return null for individual price failures
    return null;
  }
}

/**
 * Fetch latest prices for multiple tokens in parallel (with concurrency limit)
 */
export async function fetchTokenPrices(
  tokenIds: string[]
): Promise<Record<string, OpinionTokenPrice>> {
  if (tokenIds.length === 0) {
    console.warn("[PRICES] No token IDs provided to fetchTokenPrices");
    return {};
  }

  const uniqueTokenIds = [...new Set(tokenIds)];
  console.log(`[PRICES] Fetching prices for ${uniqueTokenIds.length} unique tokens (${tokenIds.length} total)`);

  const results = await Promise.allSettled(
    uniqueTokenIds.map(async (tokenId) => {
      try {
        const price = await fetchTokenPrice(tokenId);
        return { tokenId, price, success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`[PRICES] Failed to fetch price for token ${tokenId}:`, errorMessage);
        return { tokenId, price: null, success: false, error: errorMessage };
      }
    })
  );

  const priceMap: Record<string, OpinionTokenPrice> = {};
  let successCount = 0;
  let failureCount = 0;

  for (const result of results) {
    if (result.status === "fulfilled") {
      const { tokenId, price } = result.value;
      if (price) {
        priceMap[tokenId] = price;
        successCount++;
      } else {
        failureCount++;
      }
    } else {
      failureCount++;
      console.warn(`[PRICES] Promise rejected for token:`, result.reason);
    }
  }

  console.log(`[PRICES] Price fetch summary:`, {
    requested: uniqueTokenIds.length,
    successful: successCount,
    failed: failureCount,
    successRate: `${((successCount / uniqueTokenIds.length) * 100).toFixed(1)}%`,
  });

  return priceMap;
}

/**
 * Fetch detailed market information by market ID
 * This can be used as a fallback to get topicId if it's missing from the list endpoint
 * 
 * @param marketId - Market ID to fetch details for
 * @returns Market details or null if not found
 */
export async function fetchMarketDetails(
  marketId: number
): Promise<OpinionMarket | null> {
  const { apiKey, baseUrl } = getConfig();

  const url = new URL(`${baseUrl}/market/${marketId}`);

  try {
    const response = await fetchWithRetry(url.toString(), {
      method: "GET",
      headers: {
        apikey: apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`[MARKET DETAILS] Failed to fetch market ${marketId}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: any = await response.json();
    
    // Handle different response structures
    let market: OpinionMarket | null = null;
    
    // Check for error response structure (errno, errmsg, result)
    if (data.errno !== undefined && data.errno !== 0) {
      const errorMsg = data.errmsg || "Unknown API error";
      console.warn(`[MARKET DETAILS] API error for market ${marketId}:`, {
        errno: data.errno,
        errmsg: errorMsg,
      });
      return null;
    }
    
    // Try different response structures
    if (data.result && data.result.data) {
      market = data.result.data;
    } else if (data.result && (data.result.marketId || data.result.market_id)) {
      // Result contains market directly
      market = data.result;
    } else if (data.data) {
      market = data.data;
    } else if (data.marketId || data.market_id) {
      // Direct market object
      market = data;
    }
    
    if (market) {
      // Log full response structure for debugging
      const allPossibleTopicIds = {
        topic_id: (market as any).topic_id,
        topicId: (market as any).topicId,
        topic_id_number: (market as any).topic_id_number,
        topicIdNumber: (market as any).topicIdNumber,
        topic_id_string: (market as any).topic_id_string,
        topicIdString: (market as any).topicIdString,
        topic: (market as any).topic,
        questionId: market.questionId,
        marketId: market.marketId,
      };
      
      console.log(`[MARKET DETAILS] Fetched market ${marketId}:`, {
        hasTopicId: !!(market as any).topicId || !!(market as any).topic_id,
        topicId: (market as any).topicId || (market as any).topic_id,
        allKeys: Object.keys(market),
        allPossibleTopicIds,
        // Log first 500 chars of full response for debugging
        responsePreview: JSON.stringify(market).substring(0, 500),
      });
    }
    
    return market;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[MARKET DETAILS] Exception fetching market ${marketId}:`, errorMessage);
    return null;
  }
}
