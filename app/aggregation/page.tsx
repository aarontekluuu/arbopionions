"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MarketsResponse, MarketPriceSnapshot, PlatformSource } from "@/lib/types";
import { getPlatformInfo } from "@/lib/platforms";
import { matchMarketsAcrossPlatforms, type MarketData } from "@/lib/marketMatching";
import {
  classifyMarketTheme,
  marketThemes,
  type MarketThemeKey,
} from "@/lib/marketThemes";

async function fetchMarkets(limit: number = 50): Promise<MarketsResponse> {
  const res = await fetch(`/api/markets?limit=${limit}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Failed to fetch markets");
  }
  return res.json();
}

function formatPrice(price: number): string {
  return `${(price * 100).toFixed(2)}¢`;
}

function getPlatformBorderClass(color: string): string {
  const colorMap: Record<string, string> = {
    "terminal-blue": "border-terminal-blue/50",
    "terminal-green": "border-terminal-green/50",
    "terminal-purple": "border-terminal-purple/50",
    "terminal-orange": "border-terminal-orange/50",
    "terminal-accent": "border-terminal-accent/50",
    "terminal-warn": "border-terminal-warn/50",
    "terminal-cyan": "border-terminal-cyan/50",
  };
  return colorMap[color] || "border-terminal-border";
}

function getPlatformTextClass(color: string): string {
  const colorMap: Record<string, string> = {
    "terminal-blue": "text-terminal-blue",
    "terminal-green": "text-terminal-green",
    "terminal-purple": "text-terminal-purple",
    "terminal-orange": "text-terminal-orange",
    "terminal-accent": "text-terminal-accent",
    "terminal-warn": "text-terminal-warn",
    "terminal-cyan": "text-terminal-cyan",
  };
  return colorMap[color] || "text-terminal-text";
}

function getPlatformBgClass(color: string): string {
  const colorMap: Record<string, string> = {
    "terminal-blue": "bg-terminal-blue/20 text-terminal-blue",
    "terminal-green": "bg-terminal-green/20 text-terminal-green",
    "terminal-purple": "bg-terminal-purple/20 text-terminal-purple",
    "terminal-orange": "bg-terminal-orange/20 text-terminal-orange",
    "terminal-accent": "bg-terminal-accent/20 text-terminal-accent",
    "terminal-warn": "bg-terminal-warn/20 text-terminal-warn",
    "terminal-cyan": "bg-terminal-cyan/20 text-terminal-cyan",
  };
  return colorMap[color] || "bg-terminal-border/20 text-terminal-text";
}

function getPlatformCardBorderClass(color: string): string {
  const colorMap: Record<string, string> = {
    "terminal-blue": "border-terminal-blue/50",
    "terminal-green": "border-terminal-green/50",
    "terminal-purple": "border-terminal-purple/50",
    "terminal-orange": "border-terminal-orange/50",
    "terminal-accent": "border-terminal-accent/50",
    "terminal-warn": "border-terminal-warn/50",
    "terminal-cyan": "border-terminal-cyan/50",
  };
  return colorMap[color] || "border-terminal-border";
}

export default function AggregationPage() {
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [limit] = useState<number>(50);
  const [activeTheme, setActiveTheme] = useState<MarketThemeKey | "all">("all");

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["markets", limit],
    queryFn: () => fetchMarkets(limit),
    refetchInterval: autoRefresh ? 15000 : false, // Refresh every 15 seconds
  });

  const themeGroups = useMemo(() => {
    if (!data?.list) {
      return [];
    }

    const buckets = new Map<MarketThemeKey, MarketPriceSnapshot[]>();
    for (const theme of marketThemes) {
      buckets.set(theme.key, []);
    }

    for (const snapshot of data.list) {
      const themeKey = classifyMarketTheme(snapshot.marketTitle);
      const bucket = buckets.get(themeKey);
      if (bucket) {
        bucket.push(snapshot);
      }
    }

    return marketThemes.map((theme) => {
      const snapshots = buckets.get(theme.key) ?? [];
      const themeMarketData: MarketData[] = snapshots.map((snapshot) => ({
        platform: snapshot.platform,
        marketId: snapshot.marketId,
        marketTitle: snapshot.marketTitle,
        marketUrl: snapshot.url || "#",
        yesPrice: snapshot.price,
        noPrice: 1 - snapshot.price,
        volume24h: 0,
      }));

      const groupedMarkets =
        themeMarketData.length > 1 ? matchMarketsAcrossPlatforms(themeMarketData) : [];

      const groupedMarketIds = new Set(
        groupedMarkets.flatMap((group) => group.markets.map((m) => `${m.platform}-${m.marketId}`))
      );

      const ungroupedMarkets = snapshots.filter(
        (snapshot) => !groupedMarketIds.has(`${snapshot.platform}-${snapshot.marketId}`)
      );

      return {
        theme,
        totalMarkets: snapshots.length,
        groupedMarkets,
        ungroupedMarkets,
      };
    });
  }, [data?.list]);

  const availableThemes = useMemo(() => {
    return themeGroups.filter((group) => group.totalMarkets > 0);
  }, [themeGroups]);

  const visibleThemeGroups = useMemo(() => {
    if (activeTheme === "all") {
      return availableThemes;
    }
    return availableThemes.filter((group) => group.theme.key === activeTheme);
  }, [activeTheme, availableThemes]);

  const groupedMarketCount = useMemo(() => {
    return themeGroups.reduce((total, group) => total + group.groupedMarkets.length, 0);
  }, [themeGroups]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-terminal-text flex items-center gap-2">
              <span className="text-terminal-accent">&gt;</span>
              PM.AG MARKET AGGREGATOR
              <span className="cursor-blink" />
            </h1>
            <p className="text-sm text-terminal-dim mt-1">
              Themed prediction markets from Opinion.trade, Kalshi, Polymarket, Predict.fun, and Limitless
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 text-xs rounded border ${
                autoRefresh
                  ? "bg-terminal-accent/20 border-terminal-accent text-terminal-accent"
                  : "bg-terminal-bg border-terminal-border text-terminal-dim"
              }`}
            >
              {autoRefresh ? "Auto: ON" : "Auto: OFF"}
            </button>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="px-3 py-1.5 text-xs rounded border border-terminal-border text-terminal-text hover:border-terminal-accent disabled:opacity-50"
            >
              {isFetching ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* Theme Toggle */}
      {!isLoading && availableThemes.length > 0 && (
        <div className="mb-6 bg-terminal-surface border border-terminal-border rounded-lg px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-[10px] text-terminal-dim tracking-wider uppercase">
              Themes
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTheme("all")}
                aria-pressed={activeTheme === "all"}
                className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                  activeTheme === "all"
                    ? "bg-terminal-accent/20 border-terminal-accent text-terminal-accent"
                    : "bg-terminal-bg border-terminal-border text-terminal-dim hover:text-terminal-text"
                }`}
              >
                All Themes
              </button>
              {availableThemes.map((group) => (
                <button
                  key={group.theme.key}
                  onClick={() => setActiveTheme(group.theme.key)}
                  aria-pressed={activeTheme === group.theme.key}
                  className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                    activeTheme === group.theme.key
                      ? `${group.theme.chipClass} border-terminal-border`
                      : "bg-terminal-bg border-terminal-border text-terminal-dim hover:text-terminal-text"
                  }`}
                >
                  {group.theme.label} ({group.totalMarkets})
                </button>
              ))}
            </div>
            <div className="text-xs text-terminal-dim sm:ml-auto">
              {activeTheme === "all"
                ? "All themes"
                : availableThemes.find((group) => group.theme.key === activeTheme)?.theme.label}
            </div>
          </div>
        </div>
      )}

      {/* Platform Status */}
      {data?.sources && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(data.sources).map(([platform, state]) => {
            const info = getPlatformInfo(platform as PlatformSource);
            return (
              <div
                key={platform}
                className={`bg-terminal-surface border rounded-lg p-4 ${
                  state.status === "live"
                    ? getPlatformBorderClass(info.color)
                    : "border-terminal-border"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${getPlatformTextClass(info.color)}`}>
                    {info.displayName}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                      state.status === "live"
                        ? getPlatformBgClass(info.color)
                        : "bg-terminal-warn/20 text-terminal-warn"
                    }`}
                  >
                    {state.status === "live" ? "LIVE" : "ERROR"}
                  </span>
                </div>
                {state.error && (
                  <p className="text-xs text-terminal-dim mt-1">{state.error}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stats */}
      {data && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
            <div className="text-xs text-terminal-dim mb-1">Total Markets</div>
            <div className="text-lg font-semibold text-terminal-text">
              {data.list.length}
            </div>
          </div>
          <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
            <div className="text-xs text-terminal-dim mb-1">Matched Markets</div>
            <div className="text-lg font-semibold text-terminal-accent">
              {groupedMarketCount}
            </div>
          </div>
          <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
            <div className="text-xs text-terminal-dim mb-1">Platforms</div>
            <div className="text-lg font-semibold text-terminal-text">
              {data.sources ? Object.values(data.sources).filter((s) => s.status === "live").length : 0}
            </div>
          </div>
          <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
            <div className="text-xs text-terminal-dim mb-1">Last Updated</div>
            <div className="text-sm font-medium text-terminal-text">
              {data.updatedAt
                ? new Date(data.updatedAt).toLocaleTimeString()
                : "Never"}
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="mb-4 p-4 bg-terminal-warn/10 border border-terminal-warn/30 rounded text-sm text-terminal-warn">
          Error: {error instanceof Error ? error.message : "Failed to load markets"}
        </div>
      )}

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
              <span className="text-terminal-dim text-sm">LOADING MARKETS...</span>
            </div>
          </div>
        </div>
      )}

      {/* Themed Markets */}
      {!isLoading && visibleThemeGroups.length > 0 && (
        <div className="space-y-10">
          {visibleThemeGroups.map((group) => (
            <section
              key={group.theme.key}
              className={`bg-terminal-surface border ${group.theme.borderClass} rounded-lg p-6`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className={`text-sm font-semibold ${group.theme.accentClass}`}>
                    {group.theme.label}
                  </h2>
                  <p className="text-xs text-terminal-dim mt-1">
                    {group.theme.description}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-terminal-dim">
                  <span>Total: {group.totalMarkets}</span>
                  <span>Matched: {group.groupedMarkets.length}</span>
                </div>
              </div>

              {group.groupedMarkets.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-medium text-terminal-text mb-3 flex items-center gap-2">
                    <span className="text-terminal-accent">&gt;</span>
                    MATCHED MARKETS ({group.groupedMarkets.length})
                  </h3>
                  <div className="space-y-4">
                    {group.groupedMarkets.map((match, idx) => (
                      <div
                        key={`${group.theme.key}-${idx}`}
                        className="bg-terminal-bg border border-terminal-border rounded-lg p-5"
                      >
                        <h4 className="text-sm font-medium text-terminal-text mb-4">
                          {match.markets[0]?.marketTitle || match.normalizedTitle}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {match.markets.map((market) => {
                            const info = getPlatformInfo(market.platform);
                            return (
                              <div
                                key={`${market.platform}-${market.marketId}`}
                                className={`bg-terminal-surface border-2 rounded-lg p-4 ${getPlatformCardBorderClass(info.color)}`}
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <span className={`text-sm font-medium ${getPlatformTextClass(info.color)}`}>
                                    {info.displayName}
                                  </span>
                                  <a
                                    href={market.marketUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-terminal-dim hover:text-terminal-accent"
                                  >
                                    View →
                                  </a>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-terminal-dim">YES:</span>
                                    <span className="text-terminal-text font-mono">
                                      {formatPrice(market.yesPrice)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {group.ungroupedMarkets.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-terminal-text mb-3 flex items-center gap-2">
                    <span className="text-terminal-accent">&gt;</span>
                    OTHER MARKETS ({group.ungroupedMarkets.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {group.ungroupedMarkets.map((snapshot) => {
                      const info = getPlatformInfo(snapshot.platform);
                      return (
                        <div
                          key={`${snapshot.platform}-${snapshot.marketId}`}
                          className={`bg-terminal-bg border-2 rounded-lg p-4 ${getPlatformCardBorderClass(info.color)}/30 hover:${getPlatformCardBorderClass(info.color)} transition-colors`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className={`text-xs font-medium ${getPlatformTextClass(info.color)}`}>
                              {info.displayName}
                            </span>
                            {snapshot.url && (
                              <a
                                href={snapshot.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-terminal-dim hover:text-terminal-accent"
                              >
                                View →
                              </a>
                            )}
                          </div>
                          <h4 className="text-sm font-medium text-terminal-text mb-3 line-clamp-2">
                            {snapshot.marketTitle}
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-terminal-dim">YES:</span>
                              <span className="text-terminal-text font-mono">
                                {formatPrice(snapshot.price)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && visibleThemeGroups.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center text-terminal-dim">
            <p className="text-sm">NO MARKETS AVAILABLE</p>
            <p className="text-xs mt-2">Check platform status above</p>
          </div>
        </div>
      )}
    </div>
  );
}
