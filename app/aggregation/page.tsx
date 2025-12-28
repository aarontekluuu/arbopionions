"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MarketsResponse, MarketMatch, PlatformSource } from "@/lib/types";
import { getPlatformInfo } from "@/lib/platforms";
import {
  normalizeMarketTitle,
} from "@/lib/marketMatching";
import {
  marketThemes,
} from "@/lib/marketThemes";

const DEFAULT_LIMIT = 200;

async function fetchMarkets(limit: number = DEFAULT_LIMIT): Promise<MarketsResponse> {
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

type SearchableMarket = {
  marketTitle: string;
  category?: string;
  tags?: string[];
  description?: string;
  url?: string;
};

function tokenizeSearchTerm(term: string): string[] {
  return normalizeMarketTitle(term, true)
    .split(" ")
    .filter((token) => token.length >= 2);
}

function tokenizeMarketText(text: string): string[] {
  return normalizeMarketTitle(text)
    .split(" ")
    .filter(Boolean);
}

function buildSearchableText(market: SearchableMarket): string {
  const parts = [
    market.marketTitle,
    market.category,
    market.description,
    ...(market.tags ?? []),
    market.url,
  ].filter(Boolean);
  return parts.join(" ");
}

function matchesSearch(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) {
    return false;
  }
  const words = tokenizeMarketText(text);
  const wordSet = new Set(words);
  return tokens.every((token) => {
    if (token.length <= 2) {
      return wordSet.has(token);
    }
    return words.some((word) => word.startsWith(token));
  });
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = timestamp - Date.now();
  const absMs = Math.abs(diffMs);
  const minutes = Math.round(absMs / 60000);

  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return diffMs >= 0 ? `in ${minutes}m` : `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return diffMs >= 0 ? `in ${hours}h` : `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return diffMs >= 0 ? `in ${days}d` : `${days}d ago`;
}

function formatMarketLink(url?: string): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return url;
  }
}

type MarketRowProps = {
  market: MarketMatch["markets"][number];
};

function MarketRow({ market }: MarketRowProps) {
  const info = getPlatformInfo(market.platform as PlatformSource);
  const hasPreviewLink = Boolean(market.marketUrl) && market.marketUrl !== "#";
  const linkLabel = formatMarketLink(market.marketUrl || undefined);
  const Tag = hasPreviewLink ? "a" : "div";
  const tagProps = hasPreviewLink
    ? {
        href: market.marketUrl,
        target: "_blank",
        rel: "noopener noreferrer",
      }
    : {};

  return (
    <Tag
      key={`${market.platform}-${market.marketId}`}
      {...tagProps}
      className="group relative flex flex-wrap items-center justify-between gap-3 rounded-lg border border-terminal-border bg-terminal-surface px-4 py-3 transition hover:border-terminal-accent"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getPlatformChipClass(
              info.color
            )}`}
          >
            {info.displayName}
          </span>
          <span className="text-xs text-terminal-dim">{market.marketTitle}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-terminal-dim">
          {market.category && (
            <span className="rounded-full border border-terminal-border/60 px-2 py-0.5 uppercase tracking-wide">
              {market.category}
            </span>
          )}
          {market.tags?.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-terminal-border/60 px-2 py-0.5 uppercase tracking-wide"
            >
              {tag}
            </span>
          ))}
          {market.expiresAt && (
            <span>{market.expiresAt > Date.now() ? "Ends" : "Ended"} {formatRelativeTime(market.expiresAt)}</span>
          )}
          {market.updatedAt && <span>Updated {formatRelativeTime(market.updatedAt)}</span>}
          {linkLabel ? (
            <span className="max-w-[220px] truncate" title={market.marketUrl}>
              Link {linkLabel}
            </span>
          ) : (
            <span>Link unavailable</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs">
        <span className="text-terminal-dim">YES</span>
        <span className="font-mono text-terminal-text">{formatPrice(market.yesPrice)}</span>
        <span className="text-terminal-dim">NO</span>
        <span className="font-mono text-terminal-text">{formatPrice(market.noPrice)}</span>
        {hasPreviewLink && <span className="text-terminal-dim">Open →</span>}
      </div>
    </Tag>
  );
}

function getPlatformChipClass(color: string): string {
  const colorMap: Record<string, string> = {
    "terminal-blue": "bg-terminal-blue/15 text-terminal-blue border-terminal-blue/30",
    "terminal-green": "bg-terminal-green/15 text-terminal-green border-terminal-green/30",
    "terminal-purple": "bg-terminal-purple/15 text-terminal-purple border-terminal-purple/30",
    "terminal-orange": "bg-terminal-orange/15 text-terminal-orange border-terminal-orange/30",
    "terminal-accent": "bg-terminal-accent/15 text-terminal-accent border-terminal-accent/30",
    "terminal-warn": "bg-terminal-warn/15 text-terminal-warn border-terminal-warn/30",
    "terminal-cyan": "bg-terminal-cyan/15 text-terminal-cyan border-terminal-cyan/30",
  };
  return colorMap[color] || "bg-terminal-border/30 text-terminal-text border-terminal-border";
}

export default function AggregationPage() {
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [limit] = useState<number>(DEFAULT_LIMIT);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [openClusters, setOpenClusters] = useState<Set<string>>(new Set());

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
    refetchInterval: autoRefresh ? 15000 : false,
  });

  const themeGroups = useMemo(() => {
    const apiThemes = data?.themes ?? [];
    if (apiThemes.length === 0) {
      return [] as {
        theme: typeof marketThemes[number];
        totalClusters: number;
        totalMarkets: number;
        clusters: (typeof apiThemes)[number]["clusters"];
      }[];
    }

    return apiThemes.map((group) => {
      const theme =
        marketThemes.find((item) => item.key === group.themeKey) ??
        marketThemes[marketThemes.length - 1];

      return {
        theme,
        totalClusters: group.totalClusters,
        totalMarkets: group.totalMarkets,
        clusters: group.clusters,
      };
    });
  }, [data?.themes]);

  const availableThemes = useMemo(() => {
    return themeGroups.filter((group) => group.totalClusters > 0);
  }, [themeGroups]);

  useEffect(() => {
    if (themeGroups.length === 0) {
      return;
    }
    const allClusters = themeGroups.flatMap((group) => group.clusters);
    if (allClusters.length === 0) {
      return;
    }
    setOpenClusters((prev) => {
      if (prev.size > 0) {
        return prev;
      }
      return new Set(allClusters.map((cluster) => cluster.id));
    });
  }, [themeGroups]);

  const searchTokens = useMemo(() => tokenizeSearchTerm(searchTerm), [searchTerm]);
  const isSearching = searchTokens.length > 0;

  const allClusterMarkets = useMemo(() => {
    if (themeGroups.length === 0) {
      return [] as MarketMatch["markets"][number][];
    }
    return themeGroups.flatMap((group) => group.clusters).flatMap((cluster) => cluster.markets);
  }, [themeGroups]);

  const searchMatches = useMemo(() => {
    if (!isSearching) {
      return [];
    }
    return allClusterMarkets.filter((market) =>
      matchesSearch(
        buildSearchableText({
          marketTitle: market.marketTitle,
          category: market.category,
          tags: market.tags,
          description: market.description,
          url: market.marketUrl,
        }),
        searchTokens
      )
    );
  }, [allClusterMarkets, isSearching, searchTokens]);

  const searchResultsByPlatform = useMemo(() => {
    if (!isSearching) {
      return [];
    }
    const grouped = new Map<PlatformSource, typeof searchMatches>();
    for (const market of searchMatches) {
      if (!grouped.has(market.platform)) {
        grouped.set(market.platform, []);
      }
      grouped.get(market.platform)!.push(market);
    }
    return Array.from(grouped.entries())
      .map(([platform, markets]) => ({ platform, markets }))
      .sort((a, b) => b.markets.length - a.markets.length);
  }, [isSearching, searchMatches]);

  const filteredThemeGroups = useMemo(() => {
    if (!isSearching) {
      return availableThemes;
    }
    const matchesTerm = (value: string) => matchesSearch(value, searchTokens);
    return availableThemes
      .map((group) => {
        const themeText = `${group.theme.label} ${group.theme.description ?? ""}`;
        const themeMatches = matchesTerm(themeText);
        const matchingClusters = themeMatches
          ? group.clusters
          : group.clusters
              .map((cluster) => {
                const matchingMarkets = cluster.markets.filter((market) =>
                  matchesSearch(
                    buildSearchableText({
                      marketTitle: market.marketTitle,
                      category: market.category,
                      tags: market.tags,
                      description: market.description,
                      url: market.marketUrl,
                    }),
                    searchTokens
                  )
                );
                if (matchingMarkets.length === 0) {
                  return null;
                }
                return {
                  ...cluster,
                  markets: matchingMarkets,
                };
              })
              .filter((cluster): cluster is (typeof group.clusters)[number] => Boolean(cluster));
        if (matchingClusters.length === 0) {
          return null;
        }
        const totalMarkets = matchingClusters.reduce(
          (sum, cluster) => sum + cluster.markets.length,
          0
        );
        return {
          ...group,
          clusters: matchingClusters,
          totalClusters: matchingClusters.length,
          totalMarkets,
        };
      })
      .filter((group): group is typeof availableThemes[number] => Boolean(group));
  }, [availableThemes, isSearching, searchTokens]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-terminal-border bg-terminal-surface px-6 py-8 sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(200,162,110,0.32),_transparent_60%)]" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-terminal-dim">Market aggregator</p>
              <h1 className="mt-3 text-3xl font-semibold text-terminal-text sm:text-4xl">
                Prediction Market Aggregator.
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-terminal-dim">
                Browse and find price discrepancies on Polymarket, Kalshi, Predict.Fun, and Opinion.Trade.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  autoRefresh
                    ? "bg-terminal-accent/20 border-terminal-accent text-terminal-accent"
                    : "bg-terminal-bg border-terminal-border text-terminal-dim"
                }`}
              >
                {autoRefresh ? "Auto refresh: ON" : "Auto refresh: OFF"}
              </button>
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="px-3 py-1.5 text-xs rounded-full border border-terminal-border text-terminal-text hover:border-terminal-accent disabled:opacity-50"
              >
                {isFetching ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm">
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search markets across all platforms..."
                className="w-full rounded-full border border-terminal-border bg-terminal-bg px-4 py-2 text-sm text-terminal-text placeholder:text-terminal-dim focus:border-terminal-accent focus:outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-terminal-dim hover:text-terminal-text"
                >
                  Clear
                </button>
              )}
            </div>
            {isSearching && (
              <span className="text-xs text-terminal-dim">
                Searching all themes for “{searchTerm.trim()}”
              </span>
            )}
          </div>
        </div>
      </div>

      {isError && (
        <div className="mb-4 p-4 bg-terminal-warn/10 border border-terminal-warn/30 rounded text-sm text-terminal-warn">
          Error: {error instanceof Error ? error.message : "Failed to load markets"}
        </div>
      )}

      {isLoading && (
        <div className="space-y-6 py-8">
          <div className="rounded-2xl border border-terminal-border bg-terminal-surface px-6 py-5 sm:px-8">
            <div className="h-3 w-32 animate-pulse rounded-full bg-terminal-border/60" />
            <div className="mt-2 h-2 w-56 animate-pulse rounded-full bg-terminal-border/40" />
          </div>
          {[0, 1, 2].map((groupIndex) => (
            <section
              key={`skeleton-group-${groupIndex}`}
              className="space-y-3 rounded-2xl border border-terminal-border bg-terminal-surface px-6 py-5 sm:px-8"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="h-3 w-28 animate-pulse rounded-full bg-terminal-border/60" />
                  <div className="mt-2 h-2 w-48 animate-pulse rounded-full bg-terminal-border/40" />
                </div>
                <div className="h-2 w-24 animate-pulse rounded-full bg-terminal-border/40" />
              </div>
              {[0, 1, 2].map((cardIndex) => (
                <div
                  key={`skeleton-card-${groupIndex}-${cardIndex}`}
                  className="rounded-xl border border-terminal-border/60 bg-terminal-bg/40 px-4 py-4"
                >
                  <div className="h-3 w-64 animate-pulse rounded-full bg-terminal-border/60" />
                  <div className="mt-2 h-2 w-40 animate-pulse rounded-full bg-terminal-border/40" />
                  <div className="mt-4 grid gap-2">
                    <div className="h-2 w-full animate-pulse rounded-full bg-terminal-border/30" />
                    <div className="h-2 w-5/6 animate-pulse rounded-full bg-terminal-border/30" />
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {isSearching && !isLoading && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-terminal-border bg-terminal-surface px-6 py-6 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-terminal-text">Search results</h2>
                <p className="mt-1 text-xs text-terminal-dim">
                  {searchMatches.length} markets found across {searchResultsByPlatform.length} platforms
                </p>
              </div>
              <div className="text-xs text-terminal-dim">
                Keyword: “{searchTerm.trim()}”
              </div>
            </div>
          </div>

          {searchResultsByPlatform.map((group) => {
            const info = getPlatformInfo(group.platform);
            return (
              <section
                key={group.platform}
                className="rounded-2xl border border-terminal-border bg-terminal-surface px-6 py-6 sm:px-8"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${getPlatformChipClass(
                        info.color
                      )}`}
                    >
                      {info.displayName}
                    </span>
                    <span className="text-xs text-terminal-dim">{group.markets.length} markets</span>
                  </div>
                </div>
                <div className="mt-4 grid gap-4">
                  {group.markets.map((snapshot) => (
                    <MarketRow
                      key={`${snapshot.platform}-${snapshot.marketId}`}
                      market={{
                        platform: snapshot.platform,
                        marketId: snapshot.marketId,
                        marketTitle: snapshot.marketTitle,
                        marketUrl: snapshot.marketUrl || "",
                        yesPrice: snapshot.yesPrice,
                        noPrice: snapshot.noPrice,
                        volume24h: 0,
                        updatedAt: snapshot.updatedAt,
                        expiresAt: snapshot.expiresAt,
                        category: snapshot.category,
                        tags: snapshot.tags,
                        description: snapshot.description,
                      }}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {!isSearching && !isLoading && filteredThemeGroups.length > 0 && (
        <div className="divide-y divide-terminal-border/60">
          {filteredThemeGroups.map((group) => (
            <section
              key={group.theme.key}
              className="px-1 py-6 sm:px-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className={group.theme.accentClass}>{group.theme.label}</span>
                  <p className="mt-1 text-xs font-normal text-terminal-dim">
                    {group.theme.description}
                  </p>
                </div>
                <span className="text-xs font-normal text-terminal-dim">
                  {group.totalClusters} clusters • {group.totalMarkets} markets
                </span>
              </div>
              <div className="mt-5 grid gap-3">
                {group.clusters.map((cluster) => {
                  const isOpen = openClusters.has(cluster.id);
                  return (
                    <div
                      key={cluster.id}
                      className="rounded-2xl border border-terminal-border bg-terminal-surface px-5 py-4"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setOpenClusters((prev) => {
                            const next = new Set(prev);
                            if (next.has(cluster.id)) {
                              next.delete(cluster.id);
                            } else {
                              next.add(cluster.id);
                            }
                            return next;
                          });
                        }}
                        aria-expanded={isOpen}
                        className="flex w-full items-start justify-between gap-3 text-left"
                      >
                        <div>
                          <p className="text-sm font-semibold text-terminal-text">
                            {cluster.title}
                          </p>
                          <p className="mt-1 text-xs text-terminal-dim">
                            {cluster.platformCount} platforms • {cluster.markets.length} markets
                          </p>
                        </div>
                        <span className="text-xs text-terminal-dim">
                          {isOpen ? "Hide" : "Show"}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="mt-4 grid gap-3">
                          {cluster.markets.map((market) => (
                            <MarketRow
                              key={`${market.platform}-${market.marketId}`}
                              market={market}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {!isLoading && !isError && !isSearching && filteredThemeGroups.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center text-terminal-dim">
            <p className="text-sm">NO MARKETS AVAILABLE</p>
            <p className="text-xs mt-2">Try increasing the fetch limit or refresh the feed</p>
          </div>
        </div>
      )}

      {!isLoading && !isError && isSearching && searchMatches.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center text-terminal-dim">
            <p className="text-sm">NO MARKETS FOUND</p>
            <p className="text-xs mt-2">Try another keyword</p>
          </div>
        </div>
      )}
    </div>
  );
}
