/**
 * Predict.fun API client (server-side only)
 *
 * NOTE: This is a placeholder implementation.
 * Predict.fun API documentation is not publicly available.
 * This module will need to be updated once API access is obtained.
 *
 * Features (to be implemented):
 * - Market data fetching
 * - Price/order book data
 * - Rate limiting and retry logic
 */

import "server-only";

// --- Types for Predict.fun API responses (placeholder) ---

export interface PredictFunMarket {
  id: string;
  title: string;
  description?: string;
  yesPrice: number;
  noPrice: number;
  volume24h?: number;
  status: string;
  [key: string]: any;
}

export interface PredictFunMarketsResponse {
  data: PredictFunMarket[];
  total?: number;
}

export interface PredictFunTokenPrice {
  marketId: string;
  yesPrice: number;
  noPrice: number;
  timestamp: number;
}

// --- Configuration ---

const TIMEOUT_MS = 7000;
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 500;

// --- Helper Functions ---

function getConfig() {
  const apiKey = process.env.PREDICTFUN_API_KEY;
  const baseUrl = process.env.PREDICTFUN_API_BASE_URL;

  // For now, return placeholder - will be configured once API is available
  if (!baseUrl) {
    console.warn("[Predict.fun API] Base URL not configured. API integration pending.");
  }

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

      throw new Error(`Predict.fun API error: ${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.name === "AbortError" || lastError.message.includes("aborted")) {
        lastError = new Error(`Predict.fun API request timed out after ${TIMEOUT_MS}ms`);
      }

      if (attempt < MAX_RETRIES) {
        await sleep(backoffMs);
        backoffMs *= 2;
        continue;
      }
    }
  }

  throw lastError || new Error("Predict.fun API request failed");
}

// --- Public API (Placeholder) ---

/**
 * Fetch markets from Predict.fun API
 * 
 * PLACEHOLDER: This function will need to be implemented once API access is obtained.
 * 
 * @param limit - Maximum number of markets to fetch
 * @param offset - Optional offset for pagination
 * @returns Array of PredictFunMarket objects
 */
export async function fetchPredictFunMarkets(
  limit: number = 20,
  offset?: number
): Promise<PredictFunMarket[]> {
  const { apiKey, baseUrl } = getConfig();

  if (!baseUrl) {
    console.warn("[Predict.fun API] Not configured. Returning empty array.");
    return [];
  }

  // TODO: Implement actual API call once documentation is available
  // This is a placeholder structure
  const url = new URL(`${baseUrl}/markets`);
  url.searchParams.set("limit", String(limit));
  if (offset) {
    url.searchParams.set("offset", String(offset));
  }

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetchWithRetry(url.toString(), {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Predict.fun API] Error response:`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText.substring(0, 500),
      });
      throw new Error(`Predict.fun API error: ${response.status} ${response.statusText}`);
    }

    const data: PredictFunMarketsResponse = await response.json();
    return data.data || [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Predict.fun API] Failed to fetch markets:`, errorMessage);
    // Return empty array instead of throwing for placeholder
    return [];
  }
}

/**
 * Fetch price data for a specific market
 * 
 * PLACEHOLDER: This function will need to be implemented once API access is obtained.
 */
export async function fetchPredictFunMarketPrice(
  marketId: string
): Promise<PredictFunTokenPrice | null> {
  const { apiKey, baseUrl } = getConfig();

  if (!baseUrl) {
    return null;
  }

  // TODO: Implement actual API call once documentation is available
  const url = new URL(`${baseUrl}/markets/${marketId}/price`);

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetchWithRetry(url.toString(), {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      return null;
    }

    const data: PredictFunTokenPrice = await response.json();
    return data;
  } catch (error) {
    console.warn(`[Predict.fun API] Failed to fetch price for ${marketId}:`, error);
    return null;
  }
}








