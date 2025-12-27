/**
 * Core types for the pm.ag terminal
 */

/** Raw market data from Opinion API */
export interface Market {
  marketId: number;
  topicId?: number; // Use for Opinion.trade URL generation if available
  marketTitle: string;
  yesTokenId: string;
  noTokenId: string;
  volume24h: string; // String for safe parsing of large numbers
  statusEnum: string;
}

/** Token price snapshot */
export interface TokenPrice {
  tokenId: string;
  price: string; // String for precision preservation
  timestamp: number;
}

/** Token price with parsed numeric value */
export interface TokenPriceInfo {
  tokenId: string;
  price: number;
}

/** API error response */
export interface ApiError {
  error: string;
  message: string;
}

/** Orderbook level */
export interface OrderbookLevel {
  price: number;
  size: number;
}

/** Orderbook data for a token */
export interface TokenOrderbook {
  tokenId: string;
  bestBid: OrderbookLevel | null;
  bestAsk: OrderbookLevel | null;
  spread: number | null;
  midPrice: number | null;
}

/** Orderbook API response */
export interface OrderbookResponse {
  tokenId: string;
  orderbook: TokenOrderbook;
  timestamp: number;
}

/** Platform types */
export type Platform = "opinion" | "kalshi" | "polymarket" | "predictfun" | "limitless";

/** Order placement data */
export interface OrderPlacement {
  marketId: number;
  platform: Platform;
  side: "yes" | "no";
  url: string;
}

/** Market match across platforms */
export interface MarketMatch {
  markets: {
    platform: Platform;
    marketId: string | number;
    marketTitle: string;
    marketUrl: string;
    yesPrice: number;
    noPrice: number;
    volume24h?: number;
  }[];
  similarity: number; // 0-1 confidence score
  normalizedTitle: string; // Normalized title for matching
}

/** Platform market sources */
export type PlatformSource = "opinion" | "kalshi" | "polymarket" | "predictfun" | "limitless";

/** Platform source status */
export type PlatformSourceStatus = "live" | "error";

/** Normalized market price snapshot */
export interface MarketPriceSnapshot {
  platform: PlatformSource;
  marketId: string;
  marketTitle: string;
  price: number;
  updatedAt: number;
  url?: string;
}

/** Market sources metadata */
export interface PlatformSourceState {
  status: PlatformSourceStatus;
  error?: string;
}

/** Cross-platform markets response */
export interface MarketsResponse {
  updatedAt: number;
  stale: boolean;
  list: MarketPriceSnapshot[];
  sources: Record<PlatformSource, PlatformSourceState>;
  error?: string;
}
