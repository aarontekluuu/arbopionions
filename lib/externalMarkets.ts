import type { Market, Platform, TokenPrice } from "./types";

export interface ExternalMarketBundle {
  markets: Market[];
  pricesByToken: Record<string, TokenPrice>;
  stats: {
    platform: Platform;
    fetched: number;
    parsed: number;
    skipped: number;
  };
}

interface MarketShape {
  id?: number | string;
  slug?: string;
  question?: string;
  title?: string;
  marketTitle?: string;
  name?: string;
  volume24hr?: number | string;
  volume24h?: number | string;
  volume?: number | string;
  yesPrice?: number | string;
  noPrice?: number | string;
  outcomes?: Array<string | { name?: string; label?: string }>;
  outcomePrices?: Array<number | string>;
  probabilities?: Array<number | string>;
  [key: string]: unknown;
}

const POLYMARKET_BASE_URL =
  process.env.POLYMARKET_API_BASE_URL || "https://gamma-api.polymarket.com";
const PREDICTFUN_BASE_URL =
  process.env.PREDICTFUN_API_BASE_URL || "https://api.predict.fun";

function normalizeOutcomeLabel(outcome: string | { name?: string; label?: string }) {
  if (typeof outcome === "string") return outcome.toLowerCase();
  return (outcome.name || outcome.label || "").toLowerCase();
}

function parseNumber(value: number | string | undefined): number | null {
  if (value === undefined || value === null) return null;
  const parsed = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringifyVolume(value: number | string | undefined): string {
  const parsed = parseNumber(value);
  return parsed !== null ? parsed.toFixed(2) : "0";
}

function stableIdFromString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function resolveMarketTitle(market: MarketShape): string | null {
  return (
    market.marketTitle ||
    market.question ||
    market.title ||
    market.name ||
    null
  );
}

function resolveOutcomePrices(market: MarketShape) {
  const outcomePrices =
    market.outcomePrices ||
    market.probabilities ||
    ([] as Array<number | string>);
  const outcomes = market.outcomes || [];

  if (outcomePrices.length < 2) return null;

  const labels = outcomes.map(normalizeOutcomeLabel);
  let yesIndex = labels.findIndex((label) => label === "yes");
  let noIndex = labels.findIndex((label) => label === "no");

  if (yesIndex === -1 || noIndex === -1) {
    yesIndex = 0;
    noIndex = 1;
  }

  const yesPrice = parseNumber(outcomePrices[yesIndex]);
  const noPrice = parseNumber(outcomePrices[noIndex]);

  if (yesPrice === null || noPrice === null) return null;

  return { yesPrice, noPrice };
}

async function fetchJson(url: string, apiKey?: string) {
  const response = await fetch(url, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchPolymarketBundle(
  limit: number
): Promise<ExternalMarketBundle> {
  const apiKey = process.env.POLYMARKET_API_KEY;
  const url = new URL(`${POLYMARKET_BASE_URL}/markets`);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", String(limit));

  const data = await fetchJson(url.toString(), apiKey);
  const marketsData: MarketShape[] = Array.isArray(data) ? data : data.markets || [];

  const bundle: ExternalMarketBundle = {
    markets: [],
    pricesByToken: {},
    stats: { platform: "polymarket", fetched: marketsData.length, parsed: 0, skipped: 0 },
  };

  marketsData.forEach((market) => {
    const title = resolveMarketTitle(market);
    const prices = resolveOutcomePrices(market);
    const slug = market.slug;
    if (!title || !prices || !slug) {
      bundle.stats.skipped += 1;
      return;
    }

    const marketIdRaw = market.id;
    const marketId =
      typeof marketIdRaw === "number"
        ? marketIdRaw
        : typeof marketIdRaw === "string"
          ? stableIdFromString(marketIdRaw)
          : stableIdFromString(slug);

    const yesTokenId = `polymarket-${marketId}-yes`;
    const noTokenId = `polymarket-${marketId}-no`;
    const timestamp = Date.now();

    bundle.markets.push({
      marketId,
      marketTitle: title,
      yesTokenId,
      noTokenId,
      volume24h: stringifyVolume(market.volume24hr || market.volume24h || market.volume),
      statusEnum: "ACTIVE",
      platform: "polymarket",
      platformMarketId: slug,
      marketUrl: `https://polymarket.com/event/${slug}`,
    });

    bundle.pricesByToken[yesTokenId] = {
      tokenId: yesTokenId,
      price: prices.yesPrice.toString(),
      timestamp,
    };
    bundle.pricesByToken[noTokenId] = {
      tokenId: noTokenId,
      price: prices.noPrice.toString(),
      timestamp,
    };

    bundle.stats.parsed += 1;
  });

  return bundle;
}

export async function fetchPredictFunBundle(
  limit: number
): Promise<ExternalMarketBundle> {
  const apiKey = process.env.PREDICTFUN_API_KEY;
  const url = new URL(`${PREDICTFUN_BASE_URL}/markets`);
  url.searchParams.set("limit", String(limit));

  const data = await fetchJson(url.toString(), apiKey);
  const marketsData: MarketShape[] = Array.isArray(data)
    ? data
    : data.markets || data.data || [];

  const bundle: ExternalMarketBundle = {
    markets: [],
    pricesByToken: {},
    stats: { platform: "predictfun", fetched: marketsData.length, parsed: 0, skipped: 0 },
  };

  marketsData.forEach((market) => {
    const title = resolveMarketTitle(market);
    if (!title) {
      bundle.stats.skipped += 1;
      return;
    }

    const prices =
      market.yesPrice !== undefined && market.noPrice !== undefined
        ? {
            yesPrice: parseNumber(market.yesPrice),
            noPrice: parseNumber(market.noPrice),
          }
        : resolveOutcomePrices(market);

    if (prices?.yesPrice === null || prices?.noPrice === null || prices?.yesPrice === undefined || prices?.noPrice === undefined) {
      bundle.stats.skipped += 1;
      return;
    }

    const slug = market.slug || (market.id ? String(market.id) : title.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    const marketIdRaw = market.id;
    const marketId =
      typeof marketIdRaw === "number"
        ? marketIdRaw
        : typeof marketIdRaw === "string"
          ? stableIdFromString(marketIdRaw)
          : stableIdFromString(slug);

    const yesTokenId = `predictfun-${marketId}-yes`;
    const noTokenId = `predictfun-${marketId}-no`;
    const timestamp = Date.now();

    bundle.markets.push({
      marketId,
      marketTitle: title,
      yesTokenId,
      noTokenId,
      volume24h: stringifyVolume(market.volume24hr || market.volume24h || market.volume),
      statusEnum: "ACTIVE",
      platform: "predictfun",
      platformMarketId: slug,
      marketUrl: `https://predict.fun/market/${slug}`,
    });

    bundle.pricesByToken[yesTokenId] = {
      tokenId: yesTokenId,
      price: prices.yesPrice.toString(),
      timestamp,
    };
    bundle.pricesByToken[noTokenId] = {
      tokenId: noTokenId,
      price: prices.noPrice.toString(),
      timestamp,
    };

    bundle.stats.parsed += 1;
  });

  return bundle;
}

export async function fetchExternalBundles(limit: number) {
  const bundles: ExternalMarketBundle[] = [];

  try {
    bundles.push(await fetchPolymarketBundle(limit));
  } catch (error) {
    console.warn("[AGGREGATE] Failed to fetch Polymarket markets:", error);
  }

  try {
    bundles.push(await fetchPredictFunBundle(limit));
  } catch (error) {
    console.warn("[AGGREGATE] Failed to fetch Predict.fun markets:", error);
  }

  return bundles;
}
