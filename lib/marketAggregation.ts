import { getOpinionMarketUrl } from "@/lib/links";
import { fetchMarkets, fetchTokenPrices } from "@/lib/opinionClient";
import type {
  MarketGroup,
  MarketQuote,
  MarketsResponse,
  PlatformId,
  PlatformSourceStatus,
} from "@/lib/types";

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "to",
  "and",
  "or",
  "of",
  "in",
  "on",
  "for",
  "with",
  "by",
  "is",
  "be",
  "will",
  "does",
  "did",
  "are",
  "at",
  "from",
  "this",
  "that",
  "as",
]);

const MONTHS = new Set([
  "jan",
  "january",
  "feb",
  "february",
  "mar",
  "march",
  "apr",
  "april",
  "may",
  "jun",
  "june",
  "jul",
  "july",
  "aug",
  "august",
  "sep",
  "sept",
  "september",
  "oct",
  "october",
  "nov",
  "november",
  "dec",
  "december",
]);

const TAG_KEYWORDS: Array<{ tag: string; keywords: string[] }> = [
  { tag: "elections", keywords: ["election", "president", "senate", "house", "primary", "vote", "ballot"] },
  { tag: "politics", keywords: ["biden", "trump", "congress", "government", "whitehouse", "parliament"] },
  { tag: "crypto", keywords: ["crypto", "bitcoin", "btc", "eth", "ethereum", "sol", "solana", "token"] },
  { tag: "macro", keywords: ["fed", "rates", "inflation", "cpi", "gdp", "jobs", "unemployment"] },
  { tag: "ai", keywords: ["ai", "openai", "chatgpt", "llm", "anthropic", "model"] },
  { tag: "sports", keywords: ["nfl", "nba", "mlb", "nhl", "soccer", "football", "worldcup"] },
  { tag: "weather", keywords: ["hurricane", "storm", "weather", "snow", "rain"] },
  { tag: "legal", keywords: ["trial", "court", "lawsuit", "judge", "verdict"] },
  { tag: "space", keywords: ["spacex", "nasa", "rocket", "launch", "space"] },
];

const DEFAULT_MOCK_QUOTES: MarketQuote[] = [
  {
    platform: "polymarket",
    title: "Will BTC be above $80k by Dec 2024?",
    price: 0.42,
    url: "https://polymarket.com",
    sourceId: "poly-001",
  },
  {
    platform: "kalshi",
    title: "Will BTC be above $80k by Dec 2024?",
    price: 0.39,
    url: "https://kalshi.com",
    sourceId: "kalshi-001",
  },
  {
    platform: "opinion",
    title: "Will BTC be above $80k by Dec 2024?",
    price: 0.44,
    url: "https://opinion.trade",
    sourceId: "opinion-001",
  },
  {
    platform: "predictfun",
    title: "Will BTC be above $80k by Dec 2024?",
    price: 0.41,
    url: "https://predict.fun",
    sourceId: "predict-001",
  },
  {
    platform: "polymarket",
    title: "Will the Fed cut rates by Sep 2024?",
    price: 0.55,
    url: "https://polymarket.com",
    sourceId: "poly-002",
  },
  {
    platform: "kalshi",
    title: "Will the Fed cut rates by Sep 2024?",
    price: 0.51,
    url: "https://kalshi.com",
    sourceId: "kalshi-002",
  },
  {
    platform: "predictfun",
    title: "Will the Fed cut rates by Sep 2024?",
    price: 0.57,
    url: "https://predict.fun",
    sourceId: "predict-002",
  },
  {
    platform: "opinion",
    title: "Will the Fed cut rates by Sep 2024?",
    price: 0.53,
    url: "https://opinion.trade",
    sourceId: "opinion-002",
  },
  {
    platform: "opinion",
    title: "Will Trump win the 2024 election?",
    price: 0.47,
    url: "https://opinion.trade",
    sourceId: "opinion-003",
  },
  {
    platform: "polymarket",
    title: "Will Trump win the 2024 election?",
    price: 0.49,
    url: "https://polymarket.com",
    sourceId: "poly-003",
  },
  {
    platform: "kalshi",
    title: "Will Trump win the 2024 election?",
    price: 0.45,
    url: "https://kalshi.com",
    sourceId: "kalshi-003",
  },
  {
    platform: "predictfun",
    title: "Will Trump win the 2024 election?",
    price: 0.46,
    url: "https://predict.fun",
    sourceId: "predict-003",
  },
];

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function extractTokens(title: string): string[] {
  return normalizeTitle(title)
    .split(" ")
    .filter((token) => token.length > 1);
}

function isLikelyYear(token: string): boolean {
  const year = Number(token);
  return Number.isInteger(year) && year >= 2020 && year <= 2035;
}

function deriveTags(title: string): string[] {
  const tokens = extractTokens(title);
  const tags = new Set<string>();

  for (const { tag, keywords } of TAG_KEYWORDS) {
    if (keywords.some((keyword) => tokens.includes(keyword))) {
      tags.add(tag);
    }
  }

  for (const token of tokens) {
    if (MONTHS.has(token) || isLikelyYear(token)) {
      tags.add("expiry");
    }
  }

  return Array.from(tags).sort();
}

function buildGroupKey(title: string): string {
  const tokens = extractTokens(title).filter(
    (token) => !STOPWORDS.has(token) && !MONTHS.has(token) && !isLikelyYear(token)
  );
  return tokens.slice(0, 8).join("-");
}

function buildGroupTitle(title: string): string {
  return title.trim();
}

function groupQuotes(quotes: MarketQuote[]): MarketGroup[] {
  const groups = new Map<string, MarketGroup>();

  for (const quote of quotes) {
    const groupKey = buildGroupKey(quote.title);
    const tags = deriveTags(quote.title);
    const existing = groups.get(groupKey);

    if (existing) {
      existing.prices.push({
        platform: quote.platform,
        price: quote.price,
        url: quote.url,
        sourceId: quote.sourceId,
      });
      existing.platforms = Array.from(new Set([...existing.platforms, quote.platform])).sort();
      existing.tags = Array.from(new Set([...existing.tags, ...tags])).sort();
      continue;
    }

    groups.set(groupKey, {
      groupId: groupKey,
      title: buildGroupTitle(quote.title),
      tags,
      platforms: [quote.platform],
      prices: [
        {
          platform: quote.platform,
          price: quote.price,
          url: quote.url,
          sourceId: quote.sourceId,
        },
      ],
    });
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    prices: group.prices.sort((a, b) => a.platform.localeCompare(b.platform)),
  }));
}

async function fetchOpinionQuotes(limit: number): Promise<MarketQuote[]> {
  try {
    const markets = await fetchMarkets(limit);
    if (!markets.length) {
      return [];
    }

    const tokenIds = markets.map((market) => market.yesTokenId).filter(Boolean);
    const priceMap = await fetchTokenPrices(tokenIds);

    return markets.map((market) => {
      const priceInfo = priceMap[market.yesTokenId];
      const price = priceInfo ? Number(priceInfo.price) : null;
      return {
        platform: "opinion",
        title: market.marketTitle || `Opinion Market ${market.marketId}`,
        price: Number.isFinite(price) ? price : null,
        url: getOpinionMarketUrl(market.marketId, market.topicId, market.marketTitle),
        sourceId: String(market.marketId),
      };
    });
  } catch (error) {
    console.warn("[MARKETS] Opinion fetch failed:", error instanceof Error ? error.message : error);
    return [];
  }
}

function getMockQuotes(platforms: PlatformId[]): MarketQuote[] {
  return DEFAULT_MOCK_QUOTES.filter((quote) => platforms.includes(quote.platform));
}

export async function buildMarketsResponse(limit: number): Promise<MarketsResponse> {
  const sources: PlatformSourceStatus[] = [];
  const platformIds: PlatformId[] = ["opinion", "kalshi", "polymarket", "predictfun"];

  const [opinionQuotes] = await Promise.all([fetchOpinionQuotes(limit)]);

  let quotes: MarketQuote[] = [...opinionQuotes];

  if (opinionQuotes.length > 0) {
    sources.push({ platform: "opinion", status: "live" });
  } else {
    sources.push({ platform: "opinion", status: "mock", message: "Using mock prices (missing API keys or empty data)." });
  }

  for (const platform of platformIds) {
    if (platform !== "opinion") {
      sources.push({ platform, status: "mock", message: "Mock data until API client is wired." });
    }
  }

  if (quotes.length === 0) {
    quotes = getMockQuotes(platformIds);
  } else {
    quotes = [...quotes, ...getMockQuotes(platformIds.filter((platform) => platform !== "opinion"))];
  }

  const groups = groupQuotes(quotes).sort((a, b) => a.title.localeCompare(b.title));

  return {
    updatedAt: Date.now(),
    stale: sources.some((source) => source.status !== "live"),
    groups,
    sources,
  };
}
