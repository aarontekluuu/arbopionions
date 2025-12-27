/**
 * Polymarket API client (server-side only)
 *
 * Features:
 * - REST API and GraphQL Subgraph integration
 * - Market data fetching
 * - Price/order book data (CLOB model)
 * - Rate limiting and retry logic
 *
 * Documentation: https://docs.polymarket.com
 */

import "server-only";

// --- Types for Polymarket API responses ---

export interface PolymarketMarket {
  id: string;
  slug: string;
  question: string;
  description?: string;
  conditionId: string;
  endDate: string;
  resolutionSource?: string;
  image?: string;
  active: boolean;
  archived: boolean;
  liquidity: string;
  volume: string;
  [key: string]: any;
}

export interface PolymarketMarketsResponse {
  data: PolymarketMarket[];
  cursor?: string;
}

export interface PolymarketTokenPrice {
  conditionId: string;
  tokenId: string;
  price: number; // 0-1
  timestamp: number;
}

export interface PolymarketOrderBook {
  conditionId: string;
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
}

// --- Configuration ---

const TIMEOUT_MS = 7000;
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 500;

// --- Helper Functions ---

function getConfig() {
  const apiKey = process.env.POLYMARKET_API_KEY;
  const baseUrl = process.env.POLYMARKET_API_BASE_URL || "https://clob.polymarket.com";

  // API key is optional for public endpoints
  return { apiKey, baseUrl };
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
      const response = await fetchWithTimeout(url, options, TIMEOUT_MS);

      if (response.ok) {
        return response;
      }

      if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
        await sleep(backoffMs);
        backoffMs *= 2;
        continue;
      }

      throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.name === "AbortError" || lastError.message.includes("aborted")) {
        lastError = new Error(`Polymarket API request timed out after ${TIMEOUT_MS}ms`);
      }

      if (attempt < MAX_RETRIES) {
        await sleep(backoffMs);
        backoffMs *= 2;
        continue;
      }
    }
  }

  throw lastError || new Error("Polymarket API request failed");
}

// --- Public API ---

/**
 * Fetch markets from Polymarket using GraphQL Subgraph
 * 
 * @param limit - Maximum number of markets to fetch
 * @param skip - Offset for pagination
 * @returns Array of PolymarketMarket objects
 */
export async function fetchPolymarketMarkets(
  limit: number = 20,
  skip: number = 0
): Promise<PolymarketMarket[]> {
  const { baseUrl } = getConfig();

  try {
    // Use CLOB REST API instead of deprecated GraphQL subgraph
    const url = new URL(`${baseUrl}/markets`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(skip));
    url.searchParams.set("active", "true");
    url.searchParams.set("closed", "false");

    const response = await fetchWithRetry(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Polymarket API] Error response:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText.substring(0, 500),
      });
      throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();

    // CLOB API returns array directly or wrapped in data/next_cursor structure
    const markets: any[] = Array.isArray(data) ? data : (data?.data || data?.markets || []);

    // Map CLOB response to PolymarketMarket format
    return markets.map((m: any) => ({
      id: m.condition_id || m.id || "",
      slug: m.market_slug || m.slug || "",
      question: m.question || m.title || "",
      description: m.description || "",
      conditionId: m.condition_id || m.conditionId || "",
      endDate: m.end_date_iso || m.endDate || "",
      resolutionSource: m.resolution_source || "",
      image: m.image || "",
      active: m.active ?? true,
      archived: m.archived ?? false,
      liquidity: String(m.liquidity || "0"),
      volume: String(m.volume || m.volume_num_24hr || "0"),
      // Include token info for price fetching
      tokens: m.tokens || [],
    }));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Polymarket API] Failed to fetch markets:`, errorMessage);
    throw error;
  }
}

/**
 * Fetch price data for a specific market using CLOB API
 */
export async function fetchPolymarketMarketPrice(
  conditionId: string
): Promise<PolymarketTokenPrice | null> {
  const { baseUrl } = getConfig();

  // Use CLOB API to get current prices
  const url = new URL(`${baseUrl}/book`);
  url.searchParams.set("token_id", conditionId);

  try {
    const response = await fetchWithRetry(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const orderBook: PolymarketOrderBook = await response.json();
    
    // Calculate mid price from order book
    const bestBid = orderBook.bids[0]?.price || 0;
    const bestAsk = orderBook.asks[0]?.price || 1;
    const midPrice = (bestBid + bestAsk) / 2;
    
    return {
      conditionId,
      tokenId: conditionId, // Polymarket uses conditionId as token identifier
      price: midPrice,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.warn(`[Polymarket API] Failed to fetch price for ${conditionId}:`, error);
    return null;
  }
}

/**
 * Fetch order book for a market
 */
export async function fetchPolymarketOrderBook(
  conditionId: string
): Promise<PolymarketOrderBook | null> {
  const { baseUrl } = getConfig();

  const url = new URL(`${baseUrl}/book`);
  url.searchParams.set("token_id", conditionId);

  try {
    const response = await fetchWithRetry(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn(`[Polymarket API] Failed to fetch order book for ${conditionId}:`, error);
    return null;
  }
}





