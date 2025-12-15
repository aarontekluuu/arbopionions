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
  market_id: number;
  topic_id?: number; // May exist in API response - use for URL generation
  topicId?: number; // Alternative field name
  topic_id_number?: number; // Another possible field name
  topic?: { id?: number; topic_id?: number }; // Nested topic object
  title: string;
  yes_token_id: string;
  no_token_id: string;
  volume_24h: string;
  status: string;
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

  return { apiKey, baseUrl };
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

  const response = await fetchWithRetry(url.toString(), {
    method: "GET",
    headers: {
      apikey: apiKey,
      Accept: "application/json",
    },
  });

  const data: OpinionMarketsResponse = await response.json();
  const markets = data.data || [];
  
  // Log API response details in development for debugging
  if (process.env.NODE_ENV === "development" && markets.length > 0) {
    console.log(`[Opinion API] Fetched ${markets.length} markets from ${url.toString()}`);
  }
  
  return markets;
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

  try {
    const response = await fetchWithRetry(url.toString(), {
      method: "GET",
      headers: {
        apikey: apiKey,
        Accept: "application/json",
      },
    });

    const data: OpinionTokenPriceResponse = await response.json();
    return data.data || null;
  } catch {
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
  const results = await Promise.all(
    tokenIds.map(async (tokenId) => {
      const price = await fetchTokenPrice(tokenId);
      return { tokenId, price };
    })
  );

  const priceMap: Record<string, OpinionTokenPrice> = {};
  for (const { tokenId, price } of results) {
    if (price) {
      priceMap[tokenId] = price;
    }
  }

  return priceMap;
}
