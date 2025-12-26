import type { MarketEdge, Platform } from "./types";

/**
 * Platform metadata
 */
export interface PlatformInfo {
  name: string;
  displayName: string;
  url: string;
  chainId: number;
  color: string;
  status: "LIVE" | "WIP";
  orderEnabled: boolean;
}

/**
 * Platform metadata map
 */
export const platformInfo: Record<Platform, PlatformInfo> = {
  opinion: {
    name: "opinion",
    displayName: "Opinion.trade",
    url: "https://app.opinion.trade",
    chainId: 56, // BNB Chain
    color: "terminal-warn",
    status: "LIVE",
    orderEnabled: true,
  },
  kalshi: {
    name: "kalshi",
    displayName: "Kalshi",
    url: "https://kalshi.com",
    chainId: 1, // Ethereum (for now, may change)
    color: "terminal-cyan",
    status: "WIP",
    orderEnabled: false,
  },
  polymarket: {
    name: "polymarket",
    displayName: "Polymarket",
    url: "https://polymarket.com",
    chainId: 137, // Polygon
    color: "terminal-purple",
    status: "LIVE",
    orderEnabled: true,
  },
  predictfun: {
    name: "predictfun",
    displayName: "Predict.fun",
    url: "https://predict.fun",
    chainId: 1,
    color: "terminal-magenta",
    status: "LIVE",
    orderEnabled: true,
  },
};

/**
 * Get platform for a market
 */
export function getMarketPlatform(market: MarketEdge): Platform {
  if (market.platform) {
    return market.platform;
  }

  if (market.marketUrl) {
    const url = market.marketUrl.toLowerCase();
    if (url.includes("polymarket.com")) return "polymarket";
    if (url.includes("kalshi.com")) return "kalshi";
    if (url.includes("predict.fun")) return "predictfun";
    if (url.includes("opinion.trade")) return "opinion";
  }

  return "opinion";
}

/**
 * Get platform info
 */
export function getPlatformInfo(platform: Platform): PlatformInfo {
  return platformInfo[platform];
}

export function normalizePlatform(input?: string | null): Platform | undefined {
  if (!input) return undefined;
  const normalized = input.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["opinion", "opiniontrade", "opinionarb"].includes(normalized)) {
    return "opinion";
  }
  if (["kalshi"].includes(normalized)) {
    return "kalshi";
  }
  if (["polymarket", "poly"].includes(normalized)) {
    return "polymarket";
  }
  if (["predictfun", "predict", "predictfunapp"].includes(normalized)) {
    return "predictfun";
  }
  return undefined;
}

export const platformTextClasses: Record<Platform, string> = {
  opinion: "text-terminal-warn",
  kalshi: "text-terminal-cyan",
  polymarket: "text-terminal-purple",
  predictfun: "text-terminal-magenta",
};

export const platformBadgeClasses: Record<Platform, string> = {
  opinion: "bg-terminal-warn/20 text-terminal-warn",
  kalshi: "bg-terminal-cyan/20 text-terminal-cyan",
  polymarket: "bg-terminal-purple/20 text-terminal-purple",
  predictfun: "bg-terminal-magenta/20 text-terminal-magenta",
};
