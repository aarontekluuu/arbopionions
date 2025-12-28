"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MarketsResponse, MarketMatch, PlatformSource } from "@/lib/types";
import { getPlatformInfo } from "@/lib/platforms";
import {
  matchMarketsAcrossPlatforms,
  normalizeMarketTitle,
  type MarketData,
} from "@/lib/marketMatching";
import {
  classifyMarketTheme,
  marketThemes,
  type MarketThemeKey,
} from "@/lib/marketThemes";

const DEFAULT_LIMIT = 200;
const MIN_SIMILARITY = 0.78;
const MAX_GROUPS_PER_THEME = 6;

type EventGroup = {
  key: string;
  displayTitle: string;
  markets: MarketMatch["markets"];
  maxSimilarity: number;
};

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

function formatSimilarity(similarity: number): string {
  return `${Math.round(similarity * 100)}%`; // Editorial-friendly confidence hint.
}

type SearchableMarket = {
  marketTitle: string;
  category?: string;
  tags?: string[];
  description?: string;
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

type MarketRowProps = {
  market: MarketMatch["markets"][number];
};

function MarketRow({ market }: MarketRowProps) {
  const info = getPlatformInfo(market.platform as PlatformSource);
  const hasPreviewLink = Boolean(market.marketUrl) && market.marketUrl !== "#";
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

function groupMatchesIntoEvents(matches: MarketMatch[]): EventGroup[] {
  const grouped = new Map<string, EventGroup>();

  for (const match of matches) {
    const key = match.normalizedTitle || match.markets[0]?.marketTitle || "unknown";
    const displayTitle = match.markets[0]?.marketTitle || match.normalizedTitle || "Unknown event";
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        key,
        displayTitle,
        markets: [],
        maxSimilarity: match.similarity,
      });
    }

    const group = grouped.get(key)!;
    group.maxSimilarity = Math.max(group.maxSimilarity, match.similarity);

    for (const market of match.markets) {
      const dedupeKey = `${market.platform}-${market.marketId}`;
      const alreadyAdded = group.markets.some(
        (existingMarket) => `${existingMarket.platform}-${existingMarket.marketId}` === dedupeKey
      );
      if (!alreadyAdded) {
        group.markets.push(market);
      }
    }
  }

  return Array.from(grouped.values())
    .filter((group) => group.markets.length >= 2)
    .sort((a, b) => {
      if (b.markets.length !== a.markets.length) {
        return b.markets.length - a.markets.length;
      }
      return b.maxSimilarity - a.maxSimilarity;
    });
}

export default function AggregationPage() {
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [limit] = useState<number>(DEFAULT_LIMIT);
  const [searchTerm, setSearchTerm] = useState<string>("");

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
    if (!data?.list) {
      return [] as {
        theme: typeof marketThemes[number];
        totalMarkets: number;
        eventGroups: EventGroup[];
        visibleEventGroups: EventGroup[];
      }[];
    }

    const buckets = new Map<MarketThemeKey, typeof data.list>();
    for (const theme of marketThemes) {
      buckets.set(theme.key, []);
    }

    for (const snapshot of data.list) {
      const themeKey = classifyMarketTheme(snapshot.marketTitle, [
        snapshot.category,
        snapshot.description,
        ...(snapshot.tags ?? []),
      ]);
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
        marketUrl: snapshot.url || "",
        yesPrice: snapshot.price,
        noPrice: 1 - snapshot.price,
        volume24h: 0,
        updatedAt: snapshot.updatedAt,
        expiresAt: snapshot.expiresAt,
        category: snapshot.category,
        tags: snapshot.tags,
        description: snapshot.description,
      }));

      const rawMatches =
        themeMarketData.length > 1
          ? matchMarketsAcrossPlatforms(themeMarketData, MIN_SIMILARITY)
          : [];

      const eventGroups = groupMatchesIntoEvents(rawMatches);
      const visibleEventGroups = eventGroups.slice(0, MAX_GROUPS_PER_THEME);

      return {
        theme,
        totalMarkets: snapshots.length,
        eventGroups,
        visibleEventGroups,
      };
    });
  }, [data?.list]);

  const availableThemes = useMemo(() => {
    return themeGroups;
  }, [themeGroups]);

  const searchTokens = useMemo(() => tokenizeSearchTerm(searchTerm), [searchTerm]);
  const isSearching = searchTokens.length > 0;

  const searchMatches = useMemo(() => {
    if (!isSearching || !data?.list) {
      return [];
    }
    return data.list.filter((snapshot) =>
      matchesSearch(buildSearchableText(snapshot), searchTokens)
    );
  }, [data?.list, isSearching, searchTokens]);

  const searchResultsByPlatform = useMemo(() => {
    if (!isSearching) {
      return [];
    }
    const grouped = new Map<PlatformSource, typeof searchMatches>();
    for (const snapshot of searchMatches) {
      if (!grouped.has(snapshot.platform)) {
        grouped.set(snapshot.platform, []);
      }
      grouped.get(snapshot.platform)!.push(snapshot);
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
        const matchingEventGroups = group.eventGroups.filter((eventGroup) => {
          if (matchesTerm(eventGroup.displayTitle)) {
            return true;
          }
          return eventGroup.markets.some((market) =>
            matchesSearch(buildSearchableText(market), searchTokens)
          );
        });
        if (matchingEventGroups.length === 0) {
          return null;
        }
        return {
          ...group,
          eventGroups: matchingEventGroups,
          visibleEventGroups: matchingEventGroups,
        };
      })
      .filter((group): group is typeof availableThemes[number] => Boolean(group));
  }, [availableThemes, isSearching, searchTokens]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-terminal-border bg-terminal-surface px-6 py-8 sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(200,162,110,0.15),_transparent_55%)]" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-terminal-dim">Market aggregator</p>
              <h1 className="mt-3 text-3xl font-semibold text-terminal-text sm:text-4xl">
                Aggregating Prices across Prediction Markets.
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-terminal-dim">
                Browse and find price discrepancies on Polymarket, Kalshi, Predict.Fun, and Opinion.Trade. Each cluster
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
              <span className="text-terminal-dim text-sm">CURATING MARKETS...</span>
            </div>
          </div>
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
                        marketUrl: snapshot.url || "",
                        yesPrice: snapshot.price,
                        noPrice: 1 - snapshot.price,
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
        <div className="space-y-10">
          {filteredThemeGroups.map((group) => (
            <section
              key={group.theme.key}
              className={`rounded-2xl border ${group.theme.borderClass} bg-terminal-surface px-6 py-6 sm:px-8`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className={`text-sm font-semibold ${group.theme.accentClass}`}>
                    {group.theme.label}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-terminal-dim">
                    {group.theme.description}
                  </p>
                </div>
                <div className="text-xs text-terminal-dim">
                  {isSearching
                    ? `${group.visibleEventGroups.length} clusters matched`
                    : `Showing ${group.visibleEventGroups.length} of ${group.eventGroups.length} event clusters`}
                </div>
              </div>

              <div className="mt-6 grid gap-6">
                {group.visibleEventGroups.map((eventGroup) => (
                  <div
                    key={eventGroup.key}
                    className="rounded-xl border border-terminal-border bg-terminal-bg/50 p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-terminal-text">
                          {eventGroup.displayTitle}
                        </h3>
                        <p className="mt-1 text-xs text-terminal-dim">
                          Match confidence {formatSimilarity(eventGroup.maxSimilarity)} · {eventGroup.markets.length} venues
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4">
                      {eventGroup.markets.map((market) => (
                        <MarketRow key={`${market.platform}-${market.marketId}`} market={market} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
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
