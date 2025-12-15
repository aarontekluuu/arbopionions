"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAppState } from "./context";
import { MarketCard } from "@/components/MarketCard";
import { MarketModal } from "@/components/MarketModal";
import { FilterBar } from "@/components/FilterBar";
import type { FilterState, EdgesResponse, MarketEdge, SortOption } from "@/types";

async function fetchEdges(limit: number): Promise<EdgesResponse> {
  const res = await fetch(`/api/edges?limit=${limit}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Failed to fetch edges");
  }
  return res.json();
}

export default function MarketsPage() {
  const router = useRouter();
  const { autoRefresh, setAutoRefresh } = useAppState();

  // Check if first visit and redirect to welcome
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasVisited = localStorage.getItem("opinion-arb-visited");
      if (!hasVisited) {
        router.push("/welcome");
      }
    }
  }, [router]);

  const [filters, setFilters] = useState<FilterState>({
    limit: 20,
    minEdge: 0,
    autoRefresh: true,
  });

  const [sortBy, setSortBy] = useState<SortOption>("volume");
  const [selectedMarket, setSelectedMarket] = useState<MarketEdge | null>(null);

  // Sync local filter state with global context
  useEffect(() => {
    setFilters((prev) => ({ ...prev, autoRefresh }));
  }, [autoRefresh]);

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    if (newFilters.autoRefresh !== autoRefresh) {
      setAutoRefresh(newFilters.autoRefresh);
    }
  };

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["edges", filters.limit],
    queryFn: () => fetchEdges(filters.limit),
    refetchInterval: autoRefresh ? 15000 : false,
  });

  // Filter and sort markets
  const filteredMarkets: MarketEdge[] = useMemo(() => {
    // Safely handle null/undefined data
    if (!data || !data.list || !Array.isArray(data.list)) {
      return [];
    }

    const minEdgeDecimal = filters.minEdge / 100;
    const filtered = data.list.filter((m) => m && m.edge >= minEdgeDecimal);

    // Sort based on selected option
    if (sortBy === "edge") {
      return [...filtered].sort((a, b) => b.edge - a.edge);
    }
    // Default: volume desc (already sorted by API)
    return filtered;
  }, [data?.list, filters.minEdge, sortBy]);

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toISOString()
    : null;

  const isStale = data?.stale ?? false;

  const handleMarketClick = (market: MarketEdge) => {
    setSelectedMarket(market);
  };

  const handleCloseModal = () => {
    setSelectedMarket(null);
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-terminal-text flex items-center gap-2">
          <span className="text-terminal-accent">&gt;</span>
          OPINION.TRADE ARBITRAGE
          <span className="cursor-blink" />
        </h1>
        <p className="text-sm text-terminal-dim mt-1">
          Real-time prediction market opportunities ranked by {sortBy === "volume" ? "volume" : "edge"}
        </p>
      </div>

      {/* Stale Data Warning */}
      {isStale && (
        <div className="mb-4 px-4 py-3 bg-terminal-warn/10 border border-terminal-warn/30 rounded-lg flex items-center gap-3">
          <svg
            className="w-5 h-5 text-terminal-warn flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <span className="text-sm text-terminal-warn font-medium">
              STALE DATA
            </span>
            <span className="text-sm text-terminal-dim ml-2">
              {data?.error || "Showing cached data due to API issues"}
            </span>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onRefresh={() => refetch()}
        lastUpdated={lastUpdated}
        isRefetching={isFetching}
      />

      {/* Sort Toggle */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] text-terminal-dim tracking-wider uppercase">SORT BY</span>
        <div className="flex rounded overflow-hidden border border-terminal-border">
          <button
            onClick={() => setSortBy("volume")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              sortBy === "volume"
                ? "bg-terminal-accent text-terminal-bg"
                : "bg-terminal-bg text-terminal-dim hover:text-terminal-text hover:bg-terminal-border"
            }`}
          >
            VOLUME
          </button>
          <button
            onClick={() => setSortBy("edge")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              sortBy === "edge"
                ? "bg-terminal-accent text-terminal-bg"
                : "bg-terminal-bg text-terminal-dim hover:text-terminal-text hover:bg-terminal-border"
            }`}
          >
            EDGE
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-flex items-center gap-3 px-6 py-4 bg-terminal-surface border border-terminal-border rounded-lg">
              <svg
                className="w-5 h-5 text-terminal-accent animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-terminal-dim text-sm">
                LOADING MARKETS...
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {isError && !data && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-flex flex-col items-center gap-3 px-6 py-4 bg-terminal-surface border border-terminal-danger/30 rounded-lg">
              <span className="text-terminal-danger text-sm">
                ERROR: {(error as Error).message}
              </span>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 text-xs bg-terminal-danger/20 text-terminal-danger rounded hover:bg-terminal-danger/30 transition-colors"
              >
                RETRY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Markets Grid */}
      {!isLoading && (data || !isError) && (
        <>
          {/* Stats Bar */}
          <div className="flex items-center gap-4 mb-4 text-xs text-terminal-dim">
            <span>
              SHOWING{" "}
              <span className="text-terminal-text font-medium">
                {filteredMarkets.length}
              </span>{" "}
              MARKETS
            </span>
            {filters.minEdge > 0 && (
              <span className="text-terminal-warn">
                FILTERED BY {filters.minEdge}%+ EDGE
              </span>
            )}
            {filteredMarkets && filteredMarkets.length > 0 && filteredMarkets.filter((m) => m && m.edge > 0).length > 0 && (
              <span className="text-terminal-accent">
                {filteredMarkets.filter((m) => m && m.edge > 0).length} WITH EDGE
              </span>
            )}
            {isStale && (
              <span className="text-terminal-warn flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-terminal-warn" />
                CACHED
              </span>
            )}
          </div>

          {/* Grid */}
          {filteredMarkets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredMarkets.map((market) => (
                <MarketCard
                  key={market.marketId}
                  market={market}
                  isStale={isStale}
                  onClick={handleMarketClick}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-20">
              <div className="text-center text-terminal-dim">
                <p className="text-sm">NO MARKETS MATCH YOUR FILTERS</p>
                <button
                  onClick={() => handleFiltersChange({ ...filters, minEdge: 0 })}
                  className="mt-3 px-4 py-2 text-xs bg-terminal-border text-terminal-text rounded hover:bg-terminal-muted transition-colors"
                >
                  RESET FILTERS
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Market Detail Modal */}
      <MarketModal
        market={selectedMarket}
        isStale={isStale}
        onClose={handleCloseModal}
      />
    </div>
  );
}
