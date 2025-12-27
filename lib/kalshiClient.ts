/**
 * Kalshi API client (server-side only)
 *
 * Features:
 * - REST API integration with RSA-PSS signature authentication
 * - Market data fetching
 * - Price/order book data
 * - Rate limiting and retry logic
 *
 * Documentation: https://docs.kalshi.com
 */

import "server-only";

// --- Types for Kalshi API responses ---

export interface KalshiMarket {
  event_ticker: string;
  title: string;
  subtitle?: string;
  yes_bid: number; // Price to buy YES (0-1)
  yes_ask: number; // Price to sell YES (0-1)
  no_bid: number; // Price to buy NO (0-1)
  no_ask: number; // Price to sell NO (0-1)
  volume: number;
  open_time: string;
  close_time: string;
  status: string;
  category: string;
  [key: string]: any;
}

export interface KalshiMarketsResponse {
  markets: KalshiMarket[];
  cursor?: string; // For pagination
}

export interface KalshiTokenPrice {
  event_ticker: string;
  yes_price: number;
  no_price: number;
  timestamp: number;
}

// --- Configuration ---

const TIMEOUT_MS = 7000;
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 500;

// --- Helper Functions ---

function getConfig() {
  const apiKey = process.env.KALSHI_API_KEY;
  const privateKey = process.env.KALSHI_PRIVATE_KEY;
  const baseUrl = process.env.KALSHI_API_BASE_URL || "https://api.calendar.kalshi.com/trade-api/v2";

  if (!apiKey) {
    throw new Error("KALSHI_API_KEY environment variable is not set");
  }

  if (!privateKey) {
    throw new Error("KALSHI_PRIVATE_KEY environment variable is not set (required for RSA-PSS signing)");
  }

  return { apiKey, privateKey, baseUrl };
}

/**
 * Generate RSA-PSS signature for Kalshi API authentication
 * Note: This is a placeholder - actual implementation requires crypto library
 */
async function generateSignature(
  method: string,
  path: string,
  body: string,
  timestamp: string,
  privateKey: string
): Promise<string> {
  // TODO: Implement RSA-PSS signing using Node.js crypto module
  // This requires the private key to be in PEM format
  // For now, return placeholder
  throw new Error("Kalshi RSA-PSS signing not yet implemented. Requires crypto implementation.");
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

      throw new Error(`Kalshi API error: ${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.name === "AbortError" || lastError.message.includes("aborted")) {
        lastError = new Error(`Kalshi API request timed out after ${TIMEOUT_MS}ms`);
      }

      if (attempt < MAX_RETRIES) {
        await sleep(backoffMs);
        backoffMs *= 2;
        continue;
      }
    }
  }

  throw lastError || new Error("Kalshi API request failed");
}

// --- Public API ---

/**
 * Fetch markets from Kalshi API
 * 
 * @param limit - Maximum number of markets to fetch
 * @param cursor - Optional cursor for pagination
 * @returns Array of KalshiMarket objects
 */
export async function fetchKalshiMarkets(
  limit: number = 20,
  cursor?: string
): Promise<KalshiMarket[]> {
  const { apiKey, privateKey, baseUrl } = getConfig();

  const url = new URL(`${baseUrl}/markets`);
  url.searchParams.set("limit", String(limit));
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  // TODO: Implement RSA-PSS authentication
  // For now, this will fail until authentication is implemented
  const timestamp = new Date().toISOString();
  
  try {
    // Placeholder - actual implementation needs signature
    const signature = await generateSignature("GET", "/markets", "", timestamp, privateKey);
    
    const response = await fetchWithRetry(url.toString(), {
      method: "GET",
      headers: {
        "X-Kalshi-Api-Key": apiKey,
        "X-Kalshi-Timestamp": timestamp,
        "X-Kalshi-Signature": signature,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Kalshi API] Error response:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText.substring(0, 500),
      });
      throw new Error(`Kalshi API error: ${response.status} ${response.statusText}`);
    }

    const data: KalshiMarketsResponse = await response.json();
    return data.markets || [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Kalshi API] Failed to fetch markets:`, errorMessage);
    throw error;
  }
}

/**
 * Fetch price data for a specific market
 */
export async function fetchKalshiMarketPrice(
  eventTicker: string
): Promise<KalshiTokenPrice | null> {
  const { apiKey, privateKey, baseUrl } = getConfig();

  const url = new URL(`${baseUrl}/markets/${eventTicker}`);

  const timestamp = new Date().toISOString();
  
  try {
    const signature = await generateSignature("GET", `/markets/${eventTicker}`, "", timestamp, privateKey);
    
    const response = await fetchWithRetry(url.toString(), {
      method: "GET",
      headers: {
        "X-Kalshi-Api-Key": apiKey,
        "X-Kalshi-Timestamp": timestamp,
        "X-Kalshi-Signature": signature,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const market: KalshiMarket = await response.json();
    
    return {
      event_ticker: market.event_ticker,
      yes_price: (market.yes_bid + market.yes_ask) / 2, // Mid price
      no_price: (market.no_bid + market.no_ask) / 2,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.warn(`[Kalshi API] Failed to fetch price for ${eventTicker}:`, error);
    return null;
  }
}







