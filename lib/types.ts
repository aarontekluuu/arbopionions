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
  platform?: Platform;
  platformMarketId?: string; // Slug/event ticker for platform-specific URLs
  marketUrl?: string; // Optional direct URL from upstream
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

/** Computed market edge data */
export interface MarketEdge {
  marketId: number;
  topicId?: number; // Use for Opinion.trade URL generation
  marketTitle: string;
  marketUrl: string;
  volume24h: number;
  yes: TokenPriceInfo;
  no: TokenPriceInfo;
  sum: number;
  edge: number;
  updatedAt: number;
  platform?: Platform;
  platformMarketId?: string;
}

/** API response structure */
export interface EdgesResponse {
  updatedAt: number;
  stale: boolean;
  list: MarketEdge[];
  error?: string;
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

/** Sort options for markets */
export type SortOption = "volume" | "edge";

/** Platform types */
export type Platform = "opinion" | "kalshi" | "polymarket" | "predictfun";

/** Order placement data */
export interface OrderPlacement {
  marketId: number;
  platform: Platform;
  side: "yes" | "no";
  url: string;
}
