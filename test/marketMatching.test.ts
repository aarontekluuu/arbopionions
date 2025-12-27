import { describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";
import {
  calculateMarketSimilarity,
  matchMarketsAcrossPlatforms,
  normalizeMarketTitle,
} from "../lib/marketMatching";
import type { MarketData } from "../lib/marketMatching";

const makeMarket = (
  platform: MarketData["platform"],
  marketId: string,
  title: string,
  yesPrice = 0.5
): MarketData => ({
  platform,
  marketId,
  marketTitle: title,
  marketUrl: `https://example.com/${platform}/${marketId}`,
  yesPrice,
  noPrice: 1 - yesPrice,
});

describe("market matching", () => {
  it("normalizes titles consistently", () => {
    expect(normalizeMarketTitle("Will BTC hit $100K?  ")).toBe("will btc hit 100k");
  });

  it("scores highly similar markets", () => {
    const marketA = makeMarket("opinion", "1", "Will BTC hit $100K by 2025?");
    const marketB = makeMarket("polymarket", "2", "Will Bitcoin hit 100k in 2025?");
    expect(calculateMarketSimilarity(marketA, marketB)).toBeGreaterThan(0.7);
  });

  it("matches markets across platforms above the similarity threshold", () => {
    const markets: MarketData[] = [
      makeMarket("opinion", "1", "Will BTC hit $100K by 2025?", 0.52),
      makeMarket("polymarket", "2", "Will Bitcoin hit 100k in 2025?", 0.54),
      makeMarket("kalshi", "3", "Will the US raise rates this quarter?", 0.4),
    ];

    const matches = matchMarketsAcrossPlatforms(markets, 0.7);
    expect(matches.length).toBe(1);
    expect(matches[0].markets.length).toBe(2);
  });

  it("processes a moderate market set quickly", () => {
    const platforms: MarketData["platform"][] = [
      "opinion",
      "polymarket",
      "kalshi",
      "predictfun",
      "limitless",
    ];
    const markets: MarketData[] = [];

    for (let i = 0; i < 200; i += 1) {
      const platform = platforms[i % platforms.length];
      markets.push(
        makeMarket(
          platform,
          `${i}`,
          `Will event ${Math.floor(i / 5)} happen in 2025?`,
          0.4 + (i % 10) * 0.01
        )
      );
    }

    const start = performance.now();
    matchMarketsAcrossPlatforms(markets, 0.7);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(500);
  });
});
