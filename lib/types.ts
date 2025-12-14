/**
 * Core types for the Opinion Arb Terminal
 */

/** Raw market data from Opinion API */
export interface Market {
  marketId: number;
  marketTitle: string;
  yesTokenId: string;
  noTokenId: string;
  volume24h: string;
  statusEnum: string;
}

/** Token price snapshot */
export interface TokenPrice {
  tokenId: string;
  price: string;
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
