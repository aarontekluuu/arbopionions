// Re-export types from lib for frontend use
export type {
  Market,
  TokenPrice,
  TokenPriceInfo,
  MarketEdge,
  EdgesResponse,
  ApiError,
  OrderbookLevel,
  TokenOrderbook,
  OrderbookResponse,
  SortOption,
  PlatformSource,
  PlatformSourceStatus,
  MarketPriceSnapshot,
  MarketsResponse,
} from "@/lib/types";

// Frontend-specific types
export interface FilterState {
  limit: 20 | 40 | 60 | 100;
  minEdge: number;
  autoRefresh: boolean;
}
