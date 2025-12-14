import type { Market, TokenPrice, MarketEdge } from "./types";

/**
 * Opinion.trade base URL for market deep links
 */
const OPINION_BASE_URL = "https://opinion.trade/market";

/**
 * Safely parse a string to a number, returning 0 for invalid values
 */
function safeParseFloat(value: string | undefined | null): number {
  if (value === undefined || value === null || value === "") {
    return 0;
  }
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Build Opinion.trade market URL from marketId
 */
function buildMarketUrl(marketId: number): string {
  return `${OPINION_BASE_URL}/${marketId}`;
}

/**
 * Compute edges for a list of markets given their token prices.
 *
 * Edge calculation:
 * - sum = yesPrice + noPrice
 * - edge = max(0, 1 - sum)
 *
 * In an efficient market, sum should equal 1 (100%).
 * When sum < 1, there's a theoretical arbitrage opportunity.
 *
 * Results are sorted by volume24h descending (highest volume first).
 *
 * @param markets - Array of market data
 * @param pricesByToken - Map of tokenId to price data
 * @returns Array of computed market edges, sorted by volume desc
 */
export function computeEdges(
  markets: Market[],
  pricesByToken: Record<string, TokenPrice>
): MarketEdge[] {
  const now = Date.now();

  const edges: MarketEdge[] = markets
    .filter((market) => {
      // Filter out markets without valid price data
      const yesPrice = pricesByToken[market.yesTokenId];
      const noPrice = pricesByToken[market.noTokenId];
      return yesPrice !== undefined && noPrice !== undefined;
    })
    .map((market) => {
      const yesTokenPrice = pricesByToken[market.yesTokenId];
      const noTokenPrice = pricesByToken[market.noTokenId];

      const yesPrice = safeParseFloat(yesTokenPrice.price);
      const noPrice = safeParseFloat(noTokenPrice.price);
      const volume24h = safeParseFloat(market.volume24h);

      const sum = yesPrice + noPrice;
      const edge = Math.max(0, 1 - sum);

      // Use the most recent timestamp from the two prices
      const updatedAt = Math.max(
        yesTokenPrice.timestamp || now,
        noTokenPrice.timestamp || now
      );

      return {
        marketId: market.marketId,
        marketTitle: market.marketTitle,
        marketUrl: buildMarketUrl(market.marketId),
        volume24h,
        yes: {
          tokenId: market.yesTokenId,
          price: yesPrice,
        },
        no: {
          tokenId: market.noTokenId,
          price: noPrice,
        },
        sum: parseFloat(sum.toFixed(6)),
        edge: parseFloat(edge.toFixed(6)),
        updatedAt,
      };
    });

  // Sort by volume24h descending (highest volume first)
  return edges.sort((a, b) => b.volume24h - a.volume24h);
}
