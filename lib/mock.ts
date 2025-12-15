import type { Market, TokenPrice } from "./types";

/**
 * Simple seeded pseudo-random number generator (Mulberry32)
 * Produces deterministic values for stable UI across refreshes
 */
function createSeededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Static seed for deterministic mock data */
const MOCK_SEED = 42;

/** Sample market titles for mock data */
const MARKET_TITLES = [
  "Will Bitcoin exceed $100K by end of 2025?",
  "US Federal Reserve rate cut in Q1 2025?",
  "SpaceX Starship successful orbital flight by March 2025?",
  "Apple announces AR glasses at WWDC 2025?",
  "Ukraine-Russia ceasefire agreement by mid-2025?",
  "ChatGPT-5 release before July 2025?",
  "Tesla Cybertruck reaches 100K deliveries by Q2?",
  "Meta stock above $600 by year end?",
  "Next pandemic declared by WHO in 2025?",
  "US unemployment rate exceeds 5% in 2025?",
  "Google loses antitrust case appeal?",
  "iPhone 17 features satellite messaging?",
  "NVIDIA stock split in 2025?",
  "Amazon Prime price increase in 2025?",
  "OpenAI IPO announcement by December?",
  "Will there be a major bank failure in 2025?",
  "Microsoft acquires gaming company in 2025?",
  "China Taiwan military escalation in 2025?",
  "Major earthquake (7.0+) hits California in 2025?",
  "New COVID variant declared VOC in 2025?",
  "Trump administration policy reversal on EV subsidies?",
  "Netflix subscriber growth exceeds 15M in Q1?",
  "SpaceX valued above $300B by year end?",
  "Major AI safety incident in 2025?",
  "US debt ceiling crisis in 2025?",
  "Ethereum flips Bitcoin market cap in 2025?",
  "New iPhone SE release in 2025?",
  "Commercial fusion power demonstration in 2025?",
  "Major social media platform shutdown in 2025?",
  "US-China trade deal signed in 2025?",
  "Record high S&P 500 in Q1 2025?",
  "Twitter/X reaches profitability in 2025?",
  "Major autonomous vehicle accident causes regulation?",
  "New streaming service launches from major studio?",
  "Will AI-generated content be regulated in EU?",
  "Major tech company layoffs exceed 50K in 2025?",
  "New Supreme Court justice appointment in 2025?",
  "Global temperature record broken in 2025?",
  "Major cryptocurrency exchange collapse in 2025?",
  "US housing market crash (>20% decline) in 2025?",
];

/**
 * Generate mock markets with deterministic values
 *
 * @param limit - Maximum number of markets to return (1-100)
 * @returns Array of mock Market objects
 */
export function getMockMarkets(limit: number): Market[] {
  const clampedLimit = Math.max(1, Math.min(100, limit));
  const random = createSeededRandom(MOCK_SEED);

  const markets: Market[] = [];

  for (let i = 0; i < Math.min(clampedLimit, MARKET_TITLES.length); i++) {
    // Generate deterministic volume (10K - 500K range)
    const volumeBase = random() * 490000 + 10000;
    
    // For mock data, use marketId as topicId (in real API, these may differ)
    // This allows us to test URL generation
    const marketId = 1000 + i;
    const topicId = 73 + i; // Use different IDs to test topicId vs marketId

    markets.push({
      marketId,
      topicId, // Include topicId in mock data for testing
      marketTitle: MARKET_TITLES[i],
      yesTokenId: `token-${marketId}-yes`,
      noTokenId: `token-${marketId}-no`,
      volume24h: volumeBase.toFixed(2),
      statusEnum: "ACTIVE",
    });
  }

  return markets;
}

/**
 * Generate mock token prices for given token IDs
 *
 * Uses seeded random to produce stable prices:
 * - YES tokens: 0.10 - 0.90 range
 * - NO tokens: complementary price with some variance to create edges
 *
 * @param tokenIds - Array of token IDs to generate prices for
 * @returns Record mapping tokenId to TokenPrice
 */
export function getMockLatestPrices(
  tokenIds: string[]
): Record<string, TokenPrice> {
  const random = createSeededRandom(MOCK_SEED + 100);
  const now = Date.now();
  const prices: Record<string, TokenPrice> = {};

  // Group tokens by market (pairs of yes/no)
  const marketTokens = new Map<string, { yes?: string; no?: string }>();

  for (const tokenId of tokenIds) {
    const match = tokenId.match(/^token-(\d+)-(yes|no)$/);
    if (match) {
      const marketId = match[1];
      const type = match[2] as "yes" | "no";
      const existing = marketTokens.get(marketId) || {};
      existing[type] = tokenId;
      marketTokens.set(marketId, existing);
    }
  }

  // Generate prices for each market pair
  for (const [, tokens] of marketTokens) {
    // Generate base YES price (0.15 - 0.85 range)
    const yesPrice = random() * 0.7 + 0.15;

    // Generate NO price that creates varying edge scenarios:
    // - Most markets: sum near 1.0 (no edge)
    // - Some markets: sum < 1.0 (positive edge for arb)
    // - Few markets: sum slightly > 1.0 (overpriced)
    const edgeFactor = random();
    let noPrice: number;

    if (edgeFactor < 0.3) {
      // 30% of markets have positive edge (sum < 1)
      const edgeAmount = random() * 0.08 + 0.02; // 2-10% edge
      noPrice = 1 - yesPrice - edgeAmount;
    } else if (edgeFactor < 0.7) {
      // 40% of markets are efficient (sum ≈ 1)
      const noise = (random() - 0.5) * 0.02; // ±1% noise
      noPrice = 1 - yesPrice + noise;
    } else {
      // 30% of markets are overpriced (sum > 1)
      const overprice = random() * 0.05 + 0.01; // 1-6% overpriced
      noPrice = 1 - yesPrice + overprice;
    }

    // Clamp NO price to valid range
    noPrice = Math.max(0.05, Math.min(0.95, noPrice));

    // Slight time variance for realism
    const timeOffset = Math.floor(random() * 5000);

    if (tokens.yes) {
      prices[tokens.yes] = {
        tokenId: tokens.yes,
        price: yesPrice.toFixed(4),
        timestamp: now - timeOffset,
      };
    }

    if (tokens.no) {
      prices[tokens.no] = {
        tokenId: tokens.no,
        price: noPrice.toFixed(4),
        timestamp: now - timeOffset + Math.floor(random() * 1000),
      };
    }
  }

  return prices;
}
