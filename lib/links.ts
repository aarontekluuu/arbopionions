/**
 * URL generation utilities for external platforms
 */

/**
 * Opinion.trade base URL
 */
const OPINION_BASE_URL = "https://app.opinion.trade";

/**
 * Generate Opinion.trade market URL from marketId or topicId
 * 
 * Tries multiple URL formats in order of preference:
 * 1. /detail?topicId={topicId}&type=multi (preferred)
 * 2. /detail?marketId={marketId}&type=multi (fallback)
 * 3. /market/{marketId} (alternative format)
 * 
 * Prefers topicId if available, falls back to marketId
 */
export function getOpinionMarketUrl(
  marketId: number | string,
  topicId?: number | string
): string {
  // Use topicId if provided, otherwise use marketId
  const id = topicId !== undefined ? topicId : marketId;
  
  // Try the preferred format first (topicId with type=multi)
  if (topicId !== undefined) {
    return `${OPINION_BASE_URL}/detail?topicId=${topicId}&type=multi`;
  }
  
  // Fallback: try marketId with type=multi
  return `${OPINION_BASE_URL}/detail?marketId=${marketId}&type=multi`;
}

/**
 * Generate Opinion.trade order placement URL
 * 
 * Redirects to market detail page. User can place order on platform.
 */
export function getOpinionOrderUrl(
  marketId: number | string,
  side: "yes" | "no",
  topicId?: number | string
): string {
  // Start with market detail URL
  return getOpinionMarketUrl(marketId, topicId);
}

/**
 * Get the Opinion.trade base URL (for fallback navigation)
 */
export function getOpinionBaseUrl(): string {
  return OPINION_BASE_URL;
}

/**
 * Generate a search URL on Opinion.trade (fallback if direct link fails)
 */
export function getOpinionSearchUrl(query: string): string {
  return `${OPINION_BASE_URL}/markets?search=${encodeURIComponent(query)}`;
}

/**
 * Platform-specific market URL generators
 */
export const platformUrls = {
  opinion: getOpinionMarketUrl,
  
  // Kalshi uses event tickers
  kalshi: (eventTicker: string) => `https://kalshi.com/markets/${eventTicker}`,
  
  // Polymarket uses slug-based URLs
  polymarket: (slug: string) => `https://polymarket.com/event/${slug}`,
};

/**
 * Platform-specific order URL generators
 */
export const platformOrderUrls = {
  opinion: getOpinionOrderUrl,
  
  // Future: Kalshi order URLs
  kalshi: (eventTicker: string, side: "yes" | "no") => 
    `https://kalshi.com/markets/${eventTicker}?side=${side}`,
  
  // Future: Polymarket order URLs
  polymarket: (slug: string, side: "yes" | "no") => 
    `https://polymarket.com/event/${slug}?side=${side}`,
};
