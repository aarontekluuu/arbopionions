import "server-only";

import { fetchMarkets, fetchTokenPrices } from "@/lib/opinionClient";
import { getOpinionMarketUrl, platformUrls } from "@/lib/links";
import { fetchPolymarketMarkets } from "@/lib/polymarketClient";
import type {
  MarketPriceSnapshot,
  PlatformSource,
} from "@/lib/types";

const DEFAULT_TIMEOUT_MS = 10_000;

function normalizePrice(raw: unknown): number | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  const parsed = typeof raw === "string" ? Number.parseFloat(raw) : Number(raw);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (parsed < 0) {
    return null;
  }

  if (parsed > 1 && parsed <= 100) {
    return parsed / 100;
  }

  if (parsed > 1) {
    return null;
  }

  return parsed;
}

function normalizeTimestamp(raw: unknown): number {
  if (raw === null || raw === undefined) {
    return Date.now();
  }

  const parsed = typeof raw === "string" ? Number.parseFloat(raw) : Number(raw);

  if (!Number.isFinite(parsed)) {
    return Date.now();
  }

  if (parsed < 1_000_000_000_000) {
    return parsed * 1000;
  }

  return parsed;
}

async function fetchJson(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Request failed (${response.status}): ${errorText || response.statusText}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractLimitlessYesPrice(market: any): number | null {
  const prices = Array.isArray(market?.prices) ? market.prices : [];

  if (prices.length > 0) {
    for (const entry of prices) {
      const candidate =
        typeof entry === "number" || typeof entry === "string"
          ? entry
          : entry?.price ??
            entry?.value ??
            entry?.probability ??
            entry?.yesPrice ??
            entry?.yes_price ??
            entry?.yes;
      const normalized = normalizePrice(candidate);
      if (normalized !== null) {
        return normalized;
      }
    }
  }

  return normalizePrice(
    market?.yesPrice ??
      market?.yes_price ??
      market?.price ??
      market?.probability
  );
}

export async function fetchOpinionMarketPrices(
  limit: number
): Promise<MarketPriceSnapshot[]> {
  if (!process.env.OPINION_API_KEY || !process.env.OPINION_OPENAPI_BASE_URL) {
    throw new Error("Opinion API credentials are missing");
  }

  const markets = await fetchMarkets(limit);
  const tokenIds = markets.map((market) => market.yesTokenId).filter(Boolean);
  const pricesByToken = await fetchTokenPrices(tokenIds);

  const snapshots: MarketPriceSnapshot[] = [];

  for (const market of markets) {
    const priceInfo = pricesByToken[market.yesTokenId];
    const price = normalizePrice(priceInfo?.price);

    if (price === null) {
      continue;
    }

    snapshots.push({
      platform: "opinion",
      marketId: String(market.marketId),
      marketTitle: market.marketTitle,
      price,
      updatedAt: normalizeTimestamp(priceInfo?.timestamp),
      url: getOpinionMarketUrl(market.marketId, market.topicId, market.marketTitle),
    });
  }

  return snapshots;
}

export async function fetchPolymarketPrices(
  limit: number
): Promise<MarketPriceSnapshot[]> {
  try {
    // Fetch markets using CLOB REST API
    const markets = await fetchPolymarketMarkets(limit, 0);

    if (!markets || markets.length === 0) {
      console.warn("[Polymarket] No markets returned from CLOB API");
      return [];
    }

    const snapshots: MarketPriceSnapshot[] = [];

    for (const market of markets) {
      // CLOB API includes token prices in the response
      const marketAny = market as any;
      const tokens = marketAny.tokens || [];
      
      // Try to extract price from tokens (YES token is typically first)
      let price: number | null = null;
      
      if (tokens.length > 0) {
        // Look for YES token price
        const yesToken = tokens.find((t: any) => t.outcome === "Yes" || t.outcome_index === 0);
        if (yesToken) {
          price = normalizePrice(yesToken.price);
        }
        // Fallback to first token
        if (price === null && tokens[0]?.price !== undefined) {
          price = normalizePrice(tokens[0].price);
        }
      }
      
      // Also try direct price fields on market
      if (price === null) {
        price = normalizePrice(
          marketAny.outcomePrices?.[0] ??
          marketAny.yes_price ??
          marketAny.price ??
          marketAny.probability
        );
      }

      if (price === null) {
        continue;
      }

      snapshots.push({
        platform: "polymarket",
        marketId: market.id || market.conditionId,
        marketTitle: market.question,
        price,
        updatedAt: Date.now(),
        url: market.slug ? platformUrls.polymarket(market.slug) : undefined,
      });
    }

    return snapshots;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Polymarket] Failed to fetch markets:`, errorMessage);
    // Return empty array gracefully instead of throwing
    return [];
  }
}

export async function fetchKalshiPrices(
  limit: number
): Promise<MarketPriceSnapshot[]> {
  try {
    // DFlow API (branded as Kalshi in UI)
    const baseUrl = (process.env.KALSHI_API_BASE_URL ||
      "https://prediction-markets-api.dflow.net/api/v1").replace(/\/$/, "");
    const url = new URL(`${baseUrl}/markets`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("page", "1");

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    // DFlow API is public, no authentication needed
    const data = await fetchJson(url.toString(), { headers });

    let markets: any[] = [];
    if (Array.isArray(data)) {
      markets = data;
    } else if (Array.isArray(data?.markets)) {
      markets = data.markets;
    } else if (Array.isArray(data?.data)) {
      markets = data.data;
    } else if (Array.isArray(data?.result)) {
      markets = data.result;
    } else if (Array.isArray(data?.items)) {
      markets = data.items;
    }

    if (markets.length === 0) {
      console.warn("[Kalshi] No markets returned from DFlow API");
      return [];
    }

    const snapshots: MarketPriceSnapshot[] = [];

    for (const market of markets) {
      // DFlow market structure - adjust field names based on actual API response
      const price = normalizePrice(
        market?.price ??
          market?.probability ??
          market?.yes_price ??
          market?.yesPrice ??
          market?.outcomes?.[0]?.price ??
          market?.outcomes?.[0]?.probability ??
          market?.last_price ??
          market?.lastPrice
      );

      if (price === null) {
        continue;
      }

      const marketId =
        market?.market_id ?? market?.marketId ?? market?.id ?? market?.ticker ?? "unknown";

      snapshots.push({
        platform: "kalshi", // Keep "kalshi" for UI branding, but using DFlow backend
        marketId: String(marketId),
        marketTitle: String(
          market?.title ??
            market?.question ??
            market?.market_title ??
            market?.name ??
            market?.ticker ??
            "Unknown"
        ),
        price,
        updatedAt: normalizeTimestamp(
          market?.updated_at ??
            market?.updatedAt ??
            market?.last_updated ??
            market?.lastUpdated
        ),
        url: marketId !== "unknown" ? platformUrls.kalshi(String(marketId)) : undefined,
      });
    }

    return snapshots;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Kalshi] Failed to fetch markets:`, errorMessage);
    return [];
  }
}

export async function fetchLimitlessPrices(
  limit: number
): Promise<MarketPriceSnapshot[]> {
  try {
    const effectiveLimit = Math.min(limit, 25);
    const baseUrl = (process.env.LIMITLESS_API_BASE_URL ||
      "https://api.limitless.exchange").replace(/\/$/, "");
    const url = new URL(`${baseUrl}/markets/active`);
    url.searchParams.set("limit", String(effectiveLimit));

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    const data = await fetchJson(url.toString(), { headers });
    const markets: any[] = Array.isArray(data?.data?.data)
      ? data.data.data
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];

    if (markets.length === 0) {
      console.warn("[Limitless] No markets returned from API");
      return [];
    }

    const snapshots: MarketPriceSnapshot[] = [];

    for (const market of markets) {
      const yesPrice = extractLimitlessYesPrice(market);

      if (yesPrice === null) {
        continue;
      }

      const marketId = market?.id ?? market?.address ?? market?.slug ?? "unknown";
      const marketTitle = market?.title ?? market?.question ?? market?.name ?? "Unknown";
      const updatedAt = normalizeTimestamp(
        market?.updatedAt ?? market?.updated_at ?? market?.timestamp ?? Date.now()
      );

      snapshots.push({
        platform: "limitless",
        marketId: String(marketId),
        marketTitle: String(marketTitle),
        price: yesPrice,
        updatedAt,
        url: market?.slug ? platformUrls.limitless(market.slug) : undefined,
      });
    }

    if (markets.length > 0 && snapshots.length === 0) {
      console.warn("[Limitless] Markets returned but none had parsable prices", {
        sampleKeys: Object.keys(markets[0] ?? {}),
      });
    }

    return snapshots;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Limitless] Failed to fetch markets:", errorMessage);
    return [];
  }
}

export async function fetchPredictFunPrices(
  limit: number
): Promise<MarketPriceSnapshot[]> {
  try {
    // Only use API key from environment variable - the hardcoded key is invalid
    const apiKey = process.env.PREDICTFUN_API_KEY;
    
    // If no valid API key is configured, skip this platform gracefully
    if (!apiKey) {
      console.warn("[Predict.fun] No API key configured. Set PREDICTFUN_API_KEY environment variable.");
      return [];
    }
    
    const baseUrl = (process.env.PREDICTFUN_API_BASE_URL || "https://api.predict.fun")
      .replace(/\/$/, "");
    const url = new URL(`${baseUrl}/markets`);
    url.searchParams.set("limit", String(limit));

    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    const data = await fetchJson(url.toString(), { headers });
    
    // Handle various response structures
    let markets: any[] = [];
    if (Array.isArray(data)) {
      markets = data;
    } else if (data?.data && Array.isArray(data.data)) {
      markets = data.data;
    } else if (data?.result && Array.isArray(data.result)) {
      markets = data.result;
    } else if (data?.markets && Array.isArray(data.markets)) {
      markets = data.markets;
    } else if (data?.items && Array.isArray(data.items)) {
      markets = data.items;
    } else {
      console.warn("[Predict.fun] Unexpected API response structure:", {
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
        dataType: Array.isArray(data) ? "array" : typeof data,
      });
      return [];
    }

    if (markets.length === 0) {
      console.warn("[Predict.fun] No markets returned from API");
      return [];
    }

    const snapshots: MarketPriceSnapshot[] = [];

    for (const market of markets) {
      // Try multiple possible price field names
      const price = normalizePrice(
        market?.price ??
          market?.probability ??
          market?.yes_price ??
          market?.yesPrice ??
          market?.currentPrice ??
          market?.lastPrice ??
          market?.outcomes?.[0]?.price ??
          market?.outcomes?.[0]?.probability ??
          market?.tokens?.[0]?.price
      );

      if (price === null) {
        // Log in development to help debug API structure
        if (process.env.NODE_ENV === "development") {
          console.debug("[Predict.fun] Skipping market with no valid price:", {
            marketId: market?.id ?? market?.marketId,
            marketTitle: market?.question ?? market?.title,
            availableFields: Object.keys(market),
          });
        }
        continue;
      }

      const marketId = market?.id ?? market?.marketId ?? market?.market_id ?? market?.slug ?? "unknown";
      const marketTitle = market?.question ?? market?.title ?? market?.market_title ?? market?.name ?? "Unknown";

      snapshots.push({
        platform: "predictfun",
        marketId: String(marketId),
        marketTitle: String(marketTitle),
        price,
        updatedAt: normalizeTimestamp(
          market?.updated_at ??
            market?.updatedAt ??
            market?.last_updated ??
            market?.lastUpdated ??
            market?.timestamp
        ),
        url: market?.url ?? market?.link ?? undefined,
      });
    }

    return snapshots;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Predict.fun] Failed to fetch markets:`, errorMessage);
    // Return empty array gracefully instead of throwing
    return [];
  }
}

export const platformFetchers: Record<PlatformSource, (limit: number) => Promise<MarketPriceSnapshot[]>> = {
  opinion: fetchOpinionMarketPrices,
  kalshi: fetchKalshiPrices,
  polymarket: fetchPolymarketPrices,
  predictfun: fetchPredictFunPrices,
  limitless: fetchLimitlessPrices,
};
