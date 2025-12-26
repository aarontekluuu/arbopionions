import type { Market, TokenPrice, MarketEdge } from "./types";
import { getPlatformMarketUrl } from "./links";

/**
 * Safely parse a string to a number, returning 0 for invalid values
 * Handles various formats: "0.45", "45%", "45", etc.
 * Assumes prices should be in 0-1 range (decimal format)
 */
function safeParseFloat(value: string | undefined | null): number {
  if (value === undefined || value === null || value === "") {
    return 0;
  }
  
  // Remove any whitespace
  const trimmed = String(value).trim();
  
  // Handle percentage format (e.g., "45%" -> 0.45)
  if (trimmed.endsWith("%")) {
    const num = parseFloat(trimmed.slice(0, -1));
    if (Number.isFinite(num)) {
      return num / 100; // Convert percentage to decimal
    }
  }
  
  // Parse as decimal
  const parsed = parseFloat(trimmed);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  
  // If value is > 1, assume it's a percentage and convert
  // (e.g., 45 -> 0.45, but 0.45 stays 0.45)
  if (parsed > 1 && parsed <= 100) {
    return parsed / 100;
  }
  
  return parsed;
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
 * NOTE: The Opinion API returns limit order prices (with 'side' field),
 * not market prices. For accurate edge calculation, we ideally need
 * both bid and ask prices to calculate mid prices. The current implementation
 * uses the single price returned by the API as an approximation.
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
  const isDevelopment = process.env.NODE_ENV === "development";

  // Log sample price format for debugging
  if (isDevelopment && Object.keys(pricesByToken).length > 0) {
    const sampleTokenId = Object.keys(pricesByToken)[0];
    const samplePrice = pricesByToken[sampleTokenId];
    console.log("[DEBUG] Sample price format:", {
      tokenId: sampleTokenId,
      rawPrice: samplePrice.price,
      priceType: typeof samplePrice.price,
      parsedPrice: safeParseFloat(samplePrice.price),
    });
  }

  const edges: MarketEdge[] = markets
    .filter((market) => {
      // Filter out markets without valid price data
      const yesPrice = pricesByToken[market.yesTokenId];
      const noPrice = pricesByToken[market.noTokenId];
      return yesPrice !== undefined && noPrice !== undefined;
    })
    .map((market, index) => {
      const yesTokenPrice = pricesByToken[market.yesTokenId];
      const noTokenPrice = pricesByToken[market.noTokenId];

      const yesPrice = safeParseFloat(yesTokenPrice.price);
      const noPrice = safeParseFloat(noTokenPrice.price);
      const volume24h = safeParseFloat(market.volume24h);

      const sum = yesPrice + noPrice;
      const edge = Math.max(0, 1 - sum);

      // Validate price ranges and log warnings
      if (isDevelopment && index < 3) {
        console.log(`[DEBUG] Market ${index + 1} price validation:`, {
          marketId: market.marketId,
          title: market.marketTitle.substring(0, 50),
          yesPriceRaw: yesTokenPrice.price,
          yesPriceParsed: yesPrice,
          noPriceRaw: noTokenPrice.price,
          noPriceParsed: noPrice,
          sum,
          edge,
          sumWarning: sum > 1.5 ? "SUM_TOO_HIGH" : sum < 0.5 ? "SUM_TOO_LOW" : sum > 1.1 ? "SUM_SLIGHTLY_HIGH" : "OK",
        });
      }

      // Warn if sum is suspiciously high or low
      if (isDevelopment) {
        if (sum > 1.5) {
          console.warn(`[WARN] Market ${market.marketId} has suspiciously high sum: ${sum} (yes: ${yesPrice}, no: ${noPrice})`);
        } else if (sum < 0.5) {
          console.warn(`[WARN] Market ${market.marketId} has suspiciously low sum: ${sum} (yes: ${yesPrice}, no: ${noPrice})`);
        }
      }

      // Use the most recent timestamp from the two prices
      const updatedAt = Math.max(
        yesTokenPrice.timestamp || now,
        noTokenPrice.timestamp || now
      );

      const platform = market.platform ?? "opinion";
      const marketUrl = getPlatformMarketUrl(platform, {
        marketId: market.marketId,
        topicId: market.topicId,
        marketTitle: market.marketTitle,
        platformMarketId: market.platformMarketId,
        marketUrl: market.marketUrl,
      });
      
      // Log URL generation for first 10 markets (critical for debugging)
      if (index < 10) {
        console.log(`[URL] Market ${index + 1}:`, {
          marketId: market.marketId,
          topicId: market.topicId,
          title: market.marketTitle.substring(0, 60),
          generatedUrl: marketUrl,
          hasTopicId: !!market.topicId,
          urlType: market.topicId ? 'topicId' : 'search',
        });
      }

      return {
        marketId: market.marketId,
        topicId: market.topicId, // Preserve topicId for URL generation
        marketTitle: market.marketTitle,
        marketUrl,
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
        platform,
        platformMarketId: market.platformMarketId,
      };
    });

  // Log summary statistics
  if (edges.length > 0) {
    const sums = edges.map(e => e.sum);
    const avgSum = sums.reduce((a, b) => a + b, 0) / sums.length;
    const minSum = Math.min(...sums);
    const maxSum = Math.max(...sums);
    const edgesWithArbitrage = edges.filter(e => e.edge > 0).length;
    const marketsWithTopicId = edges.filter(e => e.topicId !== undefined).length;
    const marketsWithTopicIdUrl = edges.filter(e => e.marketUrl.includes('topicId=')).length;
    
    console.log("[EDGE SUMMARY]:", {
      totalMarkets: edges.length,
      marketsWithEdge: edgesWithArbitrage,
      marketsWithTopicId,
      marketsWithTopicIdUrl,
      urlSuccessRate: `${((marketsWithTopicIdUrl / edges.length) * 100).toFixed(1)}%`,
      avgSum: avgSum.toFixed(4),
      minSum: minSum.toFixed(4),
      maxSum: maxSum.toFixed(4),
      avgEdge: (edges.reduce((a, b) => a + b.edge, 0) / edges.length).toFixed(4),
    });
  }

  // Sort by volume24h descending (highest volume first)
  return edges.sort((a, b) => b.volume24h - a.volume24h);
}
