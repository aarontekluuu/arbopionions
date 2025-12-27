/**
 * URL generation utilities for external platforms
 */

/**
 * Opinion.trade base URL
 */
const OPINION_BASE_URL = "https://app.opinion.trade";

/**
 * Validate that topicId is a valid positive integer
 */
function isValidTopicId(topicId: number | string | undefined | null): boolean {
  if (topicId === undefined || topicId === null) {
    return false;
  }
  
  const num = typeof topicId === 'string' ? Number(topicId) : topicId;
  
  // Must be a finite number, positive integer
  if (!Number.isFinite(num) || num <= 0 || !Number.isInteger(num)) {
    return false;
  }
  
  return true;
}

/**
 * Generate Opinion.trade market URL from topicId
 * 
 * NOTE: The Opinion API doesn't return topicId in market responses.
 * Based on testing, marketId appears to equal topicId for many markets.
 * We'll use marketId as topicId when topicId is not available from API.
 * 
 * @param marketId - Market ID from API (used as topicId fallback)
 * @param topicId - Topic ID from API (if available, takes precedence)
 * @param marketTitle - Market title (used for search fallback only if marketId is invalid)
 * @returns Opinion.trade URL
 */
export function getOpinionMarketUrl(
  marketId: number | string,
  topicId?: number | string,
  marketTitle?: string
): string {
  // Validate topicId before using it
  // Only use topicId if it's a valid positive integer
  if (isValidTopicId(topicId)) {
    const validatedTopicId = typeof topicId === 'string' ? Number(topicId) : topicId;
    const url = `${OPINION_BASE_URL}/detail?topicId=${validatedTopicId}`;
    
    // Log in development if we're using topicId (server-side only)
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === "development") {
      console.log(`[DEBUG] URL Generation - Using topicId from API:`, {
        marketId,
        topicId: validatedTopicId,
        marketTitle: marketTitle?.substring(0, 50),
        generatedUrl: url,
      });
    }
    
    return url;
  }
  
  // Fallback: Use marketId as topicId (based on testing, they appear to match)
  // This ensures we generate proper URLs matching Opinion.trade's structure
  if (isValidTopicId(marketId)) {
    const validatedMarketId = typeof marketId === 'string' ? Number(marketId) : marketId;
    const url = `${OPINION_BASE_URL}/detail?topicId=${validatedMarketId}`;
    
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === "development") {
      console.log(`[DEBUG] URL Generation - Using marketId as topicId:`, {
        marketId: validatedMarketId,
        topicId: topicId || "none",
        marketTitle: marketTitle?.substring(0, 50),
        generatedUrl: url,
        reason: "topicId not available from API, using marketId",
      });
    }
    
    return url;
  }
  
  // Last resort: use search URL if marketId is invalid
  if (marketTitle) {
    const searchUrl = getOpinionSearchUrl(marketTitle);
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === "development") {
      console.warn(`[DEBUG] URL Generation - Using search fallback:`, {
        marketId,
        topicId: topicId || "none",
        marketTitle: marketTitle.substring(0, 50),
        generatedUrl: searchUrl,
        reason: "Neither topicId nor marketId is valid",
      });
    }
    return searchUrl;
  }
  
  // Last resort: return base URL
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === "development") {
    console.warn(`[WARN] URL Generation - No valid topicId, marketId, or marketTitle for market ${marketId}, returning base URL`);
  }
  return OPINION_BASE_URL;
}

/**
 * Generate Opinion.trade order placement URL
 * 
 * Redirects to market detail page. User can place order on platform.
 */
export function getOpinionOrderUrl(
  marketId: number | string,
  side: "yes" | "no",
  topicId?: number | string,
  marketTitle?: string
): string {
  // Start with market detail URL
  return getOpinionMarketUrl(marketId, topicId, marketTitle);
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

  // Limitless uses slug-based URLs
  limitless: (slug: string) => `https://limitless.exchange/markets/${slug}`,
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

  // Future: Limitless order URLs
  limitless: (slug: string, side: "yes" | "no") =>
    `https://limitless.exchange/markets/${slug}?side=${side}`,
};
