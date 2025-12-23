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
 * Fetch activated markets from Opinion API
 * 
 * @param limit - Maximum number of markets to fetch
 * @param offset - Optional offset for pagination (if API supports it)
 * @returns Array of OpinionMarket objects
 */
export async function fetchMarkets(
  limit: number,
  offset?: number
): Promise<OpinionMarket[]> {
  const { apiKey, baseUrl } = getConfig();

  const url = new URL(`${baseUrl}/market`);
  url.searchParams.set("status", "activated");
  url.searchParams.set("sortBy", "5"); // Sort by volume
  url.searchParams.set("limit", String(limit));
  
  // Add offset if provided (for pagination support)
  if (offset !== undefined && offset > 0) {
    url.searchParams.set("offset", String(offset));
  }

  console.log(`[Opinion API] Fetching markets from: ${url.toString()}`);
  console.log(`[Opinion API] Config check:`, {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    baseUrl,
  });

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
        body: errorText.substring(0, 500), // First 500 chars
      });
      throw new Error(`Opinion API error: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();
    
    // Check for error response structure (errno, errmsg, result)
    // errno: 0 means success, non-zero means error
    if (data.errno !== undefined && data.errno !== 0) {
      const errorMsg = data.errmsg || "Unknown API error";
      const errorNo = data.errno;
      console.error(`[Opinion API] API returned error:`, {
        errno: errorNo,
        errmsg: errorMsg,
        fullResponse: JSON.stringify(data).substring(0, 1000),
      });
      
      // Check if it's a geo-blocking error
      if (errorMsg.includes("United States") || errorMsg.includes("restricted jurisdictions")) {
        throw new Error(`Opinion API geo-blocking: ${errorMsg}. The API is not available from Vercel's server locations. Consider using a proxy or different hosting region.`);
      }
      
      throw new Error(`Opinion API error ${errorNo}: ${errorMsg}`);
    }
    
    // Handle different response structures:
    // - Success with result.list (errno: 0, result: { list: [...] })
    // - Success with data.data (legacy format)
    // - Direct array (fallback)
    let markets: OpinionMarket[] = [];
    
    if (data.result && Array.isArray(data.result.list)) {
      // New format: { errno: 0, errmsg: "", result: { list: [...], total: ... } }
      markets = data.result.list;
      console.log(`[Opinion API] Using result.list format, found ${markets.length} markets`);
    } else if (Array.isArray(data.data)) {
      // Legacy format: { data: [...] }
      markets = data.data;
      console.log(`[Opinion API] Using data.data format, found ${markets.length} markets`);
    } else if (Array.isArray(data.result)) {
      // Alternative: { result: [...] }
      markets = data.result;
      console.log(`[Opinion API] Using result array format, found ${markets.length} markets`);
    } else if (Array.isArray(data)) {
      // Direct array
      markets = data;
      console.log(`[Opinion API] Using direct array format, found ${markets.length} markets`);
    }
    
    console.log(`[Opinion API] Response parsed:`, {
      hasData: !!data,
      hasDataArray: !!data.data,
      hasResult: !!data.result,
      marketsCount: markets.length,
      responseKeys: Object.keys(data),
    });
    
    // Log API response details (always log for topicId debugging)
    if (markets.length > 0) {
      console.log(`[Opinion API] Fetched ${markets.length} markets from ${url.toString()}`);
      
      // Log response metadata if available
      if (data.result && typeof data.result.total === 'number') {
        console.log(`[Opinion API] Total markets available: ${data.result.total}`);
      } else if (data.total !== undefined) {
        console.log(`[Opinion API] Total markets available: ${data.total}`);
      }
      if (data.page !== undefined) {
        console.log(`[Opinion API] Page: ${data.page}, Limit: ${data.limit}`);
      }
    } else {
      console.warn(`[Opinion API] No markets returned!`, {
        url: url.toString(),
        responseStructure: Object.keys(data),
        fullResponse: JSON.stringify(data).substring(0, 1000), // First 1000 chars
      });
    }
    
    return markets;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Opinion API] Failed to fetch markets:`, errorMessage);
    throw error;
  }
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
    // - Success with result.data (errno: 0, result: { data: {...} })
    // - Success with data.data (legacy format)
    // - Direct data object
    let price: OpinionTokenPrice | null = null;
    
    if (data.result && data.result.data) {
      // New format: { errno: 0, errmsg: "", result: { data: {...} } }
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
      return null;
    }

    const data: { data?: OpinionMarket } = await response.json();
    return data.data || null;
  } catch {
    return null;
  }
}
