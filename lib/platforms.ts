import type { Platform } from "./types";

/**
 * Platform metadata
 */
export interface PlatformInfo {
  name: string;
  displayName: string;
  url: string;
  chainId: number;
  color: string;
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
    color: "terminal-orange",
  },
  kalshi: {
    name: "kalshi",
    displayName: "Kalshi", // Branded as Kalshi, but uses DFlow backend
    url: "https://kalshi.com",
    chainId: 1, // Ethereum (for now, may change)
    color: "terminal-green",
  },
  polymarket: {
    name: "polymarket",
    displayName: "Polymarket",
    url: "https://polymarket.com",
    chainId: 137, // Polygon
    color: "terminal-blue",
  },
  predictfun: {
    name: "predictfun",
    displayName: "Predict.fun",
    url: "https://predict.fun",
    chainId: 1, // Ethereum (to be confirmed)
    color: "terminal-purple",
  },
  limitless: {
    name: "limitless",
    displayName: "Limitless",
    url: "https://limitless.exchange",
    chainId: 8453, // Base (market contracts), to be confirmed
    color: "terminal-cyan",
  },
};

/**
 * Get platform info
 */
export function getPlatformInfo(platform: Platform): PlatformInfo {
  return platformInfo[platform];
}
