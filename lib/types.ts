/**
 * Core types for the opinion.arb terminal
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
export type Platform = "opinion" | "kalshi" | "polymarket";

export type PlatformId = "opinion" | "kalshi" | "polymarket" | "predictfun";

export interface MarketQuote {
  platform: PlatformId;
  title: string;
  price: number | null;
  url?: string;
  sourceId?: string;
}

export interface MarketGroup {
  groupId: string;
  title: string;
  tags: string[];
  platforms: PlatformId[];
  prices: Array<{
    platform: PlatformId;
    price: number | null;
    url?: string;
    sourceId?: string;
  }>;
}

export interface PlatformSourceStatus {
  platform: PlatformId;
  status: "live" | "mock" | "error";
  message?: string;
}

export interface MarketsResponse {
  updatedAt: number;
  stale: boolean;
  groups: MarketGroup[];
  sources: PlatformSourceStatus[];
  error?: string;
}

/** Order placement data */
export interface OrderPlacement {
  marketId: number;
  platform: Platform;
  side: "yes" | "no";
  url: string;
}
