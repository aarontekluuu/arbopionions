import "server-only";

import { fetchMarkets, fetchTokenPrices } from "@/lib/opinionClient";
import { getOpinionMarketUrl, platformUrls } from "@/lib/links";
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

export async function fetchOpinionMarketPrices(
  limit: number
): Promise<MarketPriceSnapshot[]> {
  if (!process.env.OPINION_API_KEY || !process.env.OPINION_OPENAPI_BASE_URL) {
    throw new Error("Opinion API credentials are missing");
  }

  const markets = await fetchMarkets(limit);
  const tokenIds = markets.map((market) => market.yesTokenId).filter(Boolean);
  const pricesByToken = await fetchTokenPrices(tokenIds);

  return markets
    .map((market) => {
      const priceInfo = pricesByToken[market.yesTokenId];
      const price = normalizePrice(priceInfo?.price);

      if (price === null) {
        return null;
      }

      return {
        platform: "opinion",
        marketId: String(market.marketId),
        marketTitle: market.marketTitle,
        price,
        updatedAt: normalizeTimestamp(priceInfo?.timestamp),
        url: getOpinionMarketUrl(market.marketId, market.topicId, market.marketTitle),
      } satisfies MarketPriceSnapshot;
    })
    .filter((item): item is MarketPriceSnapshot => item !== null);
}

export async function fetchPolymarketPrices(
  limit: number
): Promise<MarketPriceSnapshot[]> {
  const baseUrl = (process.env.POLYMARKET_API_BASE_URL || "https://gamma-api.polymarket.com")
    .replace(/\/$/, "");
  const url = new URL(`${baseUrl}/markets`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("active", "true");

  const data = await fetchJson(url.toString(), {
    headers: {
      Accept: "application/json",
    },
  });

  const markets: any[] = Array.isArray(data)
    ? data
    : data?.data || data?.result || data?.markets || [];

  return markets
    .map((market) => {
      const price = normalizePrice(
        market?.yes_price ??
          market?.yesPrice ??
          market?.price ??
          market?.probability ??
          market?.last_price ??
          market?.outcomes?.[0]?.price ??
          market?.outcomes?.[0]?.probability
      );

      if (price === null) {
        return null;
      }

      const slug = market?.slug ?? market?.market_slug;

      return {
        platform: "polymarket",
        marketId: String(market?.id ?? market?.marketId ?? market?.market_id ?? slug ?? "unknown"),
        marketTitle: String(
          market?.question ?? market?.title ?? market?.market_title ?? slug ?? "Unknown"
        ),
        price,
        updatedAt: normalizeTimestamp(
          market?.updated_at ?? market?.updatedAt ?? market?.last_updated ?? market?.lastUpdated
        ),
        url: slug ? platformUrls.polymarket(slug) : undefined,
      } satisfies MarketPriceSnapshot;
    })
    .filter((item): item is MarketPriceSnapshot => item !== null);
}

export async function fetchKalshiPrices(
  limit: number
): Promise<MarketPriceSnapshot[]> {
  const baseUrl = (process.env.KALSHI_API_BASE_URL ||
    "https://trading-api.kalshi.com/trade-api/v2/markets").replace(/\/$/, "");
  const url = new URL(baseUrl);
  url.searchParams.set("limit", String(limit));

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (process.env.KALSHI_API_KEY) {
    headers.Authorization = `Bearer ${process.env.KALSHI_API_KEY}`;
  }

  const data = await fetchJson(url.toString(), { headers });
  const markets: any[] =
    data?.markets || data?.data?.markets || data?.result?.markets || data || [];

  return markets
    .map((market) => {
      const price = normalizePrice(
        market?.yes_ask ??
          market?.yesAsk ??
          market?.last_price ??
          market?.lastPrice ??
          market?.yes_bid ??
          market?.yesBid
      );

      if (price === null) {
        return null;
      }

      const ticker = market?.ticker ?? market?.market_id ?? market?.id;

      return {
        platform: "kalshi",
        marketId: String(ticker ?? "unknown"),
        marketTitle: String(
          market?.title ?? market?.subtitle ?? market?.event_title ?? market?.name ?? ticker ?? "Unknown"
        ),
        price,
        updatedAt: normalizeTimestamp(
          market?.updated_at ?? market?.updatedAt ?? market?.last_updated ?? market?.lastUpdated
        ),
        url: ticker ? platformUrls.kalshi(String(ticker)) : undefined,
      } satisfies MarketPriceSnapshot;
    })
    .filter((item): item is MarketPriceSnapshot => item !== null);
}

export async function fetchPredictFunPrices(
  limit: number
): Promise<MarketPriceSnapshot[]> {
  const baseUrl = (process.env.PREDICTFUN_API_BASE_URL || "https://predict.fun/api")
    .replace(/\/$/, "");
  const url = new URL(`${baseUrl}/markets`);
  url.searchParams.set("limit", String(limit));

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (process.env.PREDICTFUN_API_KEY) {
    headers.Authorization = `Bearer ${process.env.PREDICTFUN_API_KEY}`;
  }

  const data = await fetchJson(url.toString(), { headers });
  const markets: any[] = Array.isArray(data)
    ? data
    : data?.data || data?.result || data?.markets || [];

  return markets
    .map((market) => {
      const price = normalizePrice(
        market?.price ??
          market?.probability ??
          market?.yes_price ??
          market?.yesPrice ??
          market?.outcomes?.[0]?.price ??
          market?.outcomes?.[0]?.probability
      );

      if (price === null) {
        return null;
      }

      return {
        platform: "predictfun",
        marketId: String(market?.id ?? market?.marketId ?? market?.market_id ?? "unknown"),
        marketTitle: String(
          market?.question ?? market?.title ?? market?.market_title ?? "Unknown"
        ),
        price,
        updatedAt: normalizeTimestamp(
          market?.updated_at ?? market?.updatedAt ?? market?.last_updated ?? market?.lastUpdated
        ),
      } satisfies MarketPriceSnapshot;
    })
    .filter((item): item is MarketPriceSnapshot => item !== null);
}

export const platformFetchers: Record<PlatformSource, (limit: number) => Promise<MarketPriceSnapshot[]>> = {
  opinion: fetchOpinionMarketPrices,
  kalshi: fetchKalshiPrices,
  polymarket: fetchPolymarketPrices,
  predictfun: fetchPredictFunPrices,
};
