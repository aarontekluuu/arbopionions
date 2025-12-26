/**
 * URL generation utilities for external platforms
 */

import type { Platform } from "./types";

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

const KALSHI_BASE_URL = "https://kalshi.com";
const POLYMARKET_BASE_URL = "https://polymarket.com";
const PREDICTFUN_BASE_URL = "https://predict.fun";

/**
 * Platform-specific market URL generators
 */
export const platformUrls = {
  opinion: getOpinionMarketUrl,
  kalshi: (eventTicker: string) => `${KALSHI_BASE_URL}/markets/${eventTicker}`,
  polymarket: (slug: string) => `${POLYMARKET_BASE_URL}/event/${slug}`,
  predictfun: (slug: string) => `${PREDICTFUN_BASE_URL}/market/${slug}`,
};

/**
 * Platform-specific order URL generators
 */
export const platformOrderUrls = {
  opinion: getOpinionOrderUrl,
  
  // Future: Kalshi order URLs
  kalshi: (eventTicker: string, side: "yes" | "no") => 
    `${KALSHI_BASE_URL}/markets/${eventTicker}?side=${side}`,
  
  // Future: Polymarket order URLs
  polymarket: (slug: string, side: "yes" | "no") => 
    `${POLYMARKET_BASE_URL}/event/${slug}?side=${side}`,

  // Predict.fun order URLs
  predictfun: (slug: string, side: "yes" | "no") => 
    `${PREDICTFUN_BASE_URL}/market/${slug}?side=${side}`,
};

export interface PlatformMarketUrlOptions {
  marketId: number | string;
  topicId?: number | string;
  marketTitle?: string;
  platformMarketId?: string;
  marketUrl?: string;
}

export function getPlatformMarketUrl(
  platform: Platform,
  options: PlatformMarketUrlOptions
): string {
  if (options.marketUrl) {
    return options.marketUrl;
  }

  if (platform === "opinion") {
    return getOpinionMarketUrl(
      options.marketId,
      options.topicId,
      options.marketTitle
    );
  }

  if (platform === "kalshi") {
    return options.platformMarketId
      ? platformUrls.kalshi(options.platformMarketId)
      : KALSHI_BASE_URL;
  }

  if (platform === "polymarket") {
    return options.platformMarketId
      ? platformUrls.polymarket(options.platformMarketId)
      : POLYMARKET_BASE_URL;
  }

  if (platform === "predictfun") {
    return options.platformMarketId
      ? platformUrls.predictfun(options.platformMarketId)
      : PREDICTFUN_BASE_URL;
  }

  return getOpinionBaseUrl();
}

export function getPlatformOrderUrl(
  platform: Platform,
  side: "yes" | "no",
  options: PlatformMarketUrlOptions
): string {
  if (platform === "opinion") {
    return getOpinionOrderUrl(
      options.marketId,
      side,
      options.topicId,
      options.marketTitle
    );
  }

  if (options.platformMarketId) {
    return platformOrderUrls[platform](options.platformMarketId, side);
  }

  return getPlatformMarketUrl(platform, options);
}
