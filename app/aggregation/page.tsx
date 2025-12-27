"use client";

import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MarketsResponse, MarketMatch, PlatformSource } from "@/lib/types";
import { getPlatformInfo } from "@/lib/platforms";
import { matchMarketsAcrossPlatforms, type MarketData } from "@/lib/marketMatching";
import {
  classifyMarketTheme,
  marketThemes,
  type MarketThemeKey,
} from "@/lib/marketThemes";

const DEFAULT_LIMIT = 200;
const MIN_SIMILARITY = 0.78;
const MAX_GROUPS_PER_THEME = 6;
const MAX_FEATURED_THEMES = 3;

type EventGroup = {
  key: string;
  displayTitle: string;
  markets: MarketMatch["markets"];
  maxSimilarity: number;
};

type LinkPreview = {
  title?: string;
  image?: string;
  siteName?: string;
  url: string;
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
  const [isOpen, setIsOpen] = useState(false);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const requestedRef = useRef(false);

  const handleOpen = () => {
    if (!hasPreviewLink) return;
    setIsOpen(true);
    if (requestedRef.current) return;
    requestedRef.current = true;
    setStatus("loading");
    fetch(`/api/link-preview?url=${encodeURIComponent(market.marketUrl)}`)
      .then((res) => {
        if (!res.ok) throw new Error("preview failed");
        return res.json();
      })
      .then((data: LinkPreview) => {
        setPreview(data);
        setStatus("loaded");
      })
      .catch(() => {
        setStatus("error");
      });
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const showPreview = isOpen && hasPreviewLink;

  return (
    <Tag
      key={`${market.platform}-${market.marketId}`}
      {...tagProps}
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
      onFocus={handleOpen}
      onBlur={handleClose}
      className="group relative flex flex-wrap items-center justify-between gap-3 rounded-lg border border-terminal-border bg-terminal-surface px-4 py-3 transition hover:border-terminal-accent"
    >
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
      <div className="flex items-center gap-4 text-xs">
        <span className="text-terminal-dim">YES</span>
        <span className="font-mono text-terminal-text">{formatPrice(market.yesPrice)}</span>
        <span className="text-terminal-dim">NO</span>
        <span className="font-mono text-terminal-text">{formatPrice(market.noPrice)}</span>
        {hasPreviewLink && (
          <span className="text-terminal-dim group-hover:text-terminal-accent">Preview →</span>
        )}
      </div>
      {showPreview && (
        <div className="pointer-events-none mt-3 w-full max-w-sm rounded-xl border border-terminal-border bg-terminal-bg/95 p-3 text-xs text-terminal-dim shadow-lg backdrop-blur md:absolute md:right-4 md:top-1/2 md:mt-0 md:w-64 md:-translate-y-1/2">
          {status === "loading" && <p className="text-terminal-dim">Loading preview…</p>}
          {status === "error" && <p className="text-terminal-dim">Preview unavailable</p>}
          {status !== "loading" && status !== "error" && preview && (
            <div className="space-y-2">
              {preview.image && (
                <img
                  src={preview.image}
                  alt={preview.title || "Link preview"}
                  className="h-28 w-full rounded-md object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              )}
              <div>
                {preview.title && <p className="font-semibold text-terminal-text">{preview.title}</p>}
                <p className="mt-1 text-[10px] uppercase tracking-wide text-terminal-dim">
                  {preview.siteName || "Preview"}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
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
  const [activeTheme, setActiveTheme] = useState<MarketThemeKey | "featured">("featured");
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
        marketUrl: snapshot.url || "",
        yesPrice: snapshot.price,
        noPrice: 1 - snapshot.price,
        volume24h: 0,
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
    return themeGroups.filter((group) => group.eventGroups.length > 0);
  }, [themeGroups]);

  const featuredThemes = useMemo(() => {
    return [...availableThemes]
      .sort((a, b) => b.eventGroups.length - a.eventGroups.length)
      .slice(0, MAX_FEATURED_THEMES);
  }, [availableThemes]);

  const visibleThemeGroups = useMemo(() => {
    if (activeTheme === "featured") {
      return featuredThemes;
    }
    return availableThemes.filter((group) => group.theme.key === activeTheme);
  }, [activeTheme, availableThemes, featuredThemes]);

  const normalizedSearch = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);
  const isSearching = normalizedSearch.length > 0;

  const filteredThemeGroups = useMemo(() => {
    if (!isSearching) {
      return visibleThemeGroups;
    }
    const matchesTerm = (value: string) => value.toLowerCase().includes(normalizedSearch);
    return availableThemes
      .map((group) => {
        const matchingEventGroups = group.eventGroups.filter((eventGroup) => {
          if (matchesTerm(eventGroup.displayTitle)) {
            return true;
          }
          return eventGroup.markets.some((market) => matchesTerm(market.marketTitle));
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
  }, [availableThemes, isSearching, normalizedSearch, visibleThemeGroups]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-terminal-border bg-terminal-surface px-6 py-8 sm:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(200,162,110,0.15),_transparent_55%)]" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-terminal-dim">Market aggregator</p>
              <h1 className="mt-3 text-3xl font-semibold text-terminal-text sm:text-4xl">
                Cross-platform event clusters, trimmed for focus.
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-terminal-dim">
                Browse the strongest multi-venue matches by theme. Each cluster shows only the market name, venue, and
                YES/NO prices so you can spot pricing gaps without the noise.
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
          <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-terminal-dim">
            <span>Similarity ≥ {formatSimilarity(MIN_SIMILARITY)}</span>
            <span>Max {MAX_GROUPS_PER_THEME} events per theme</span>
            <span>
              Last updated: {data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : "--"}
            </span>
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

      {!isLoading && availableThemes.length > 0 && !isSearching && (
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-terminal-dim">Themes</span>
          <button
            onClick={() => setActiveTheme("featured")}
            aria-pressed={activeTheme === "featured"}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              activeTheme === "featured"
                ? "bg-terminal-accent/20 border-terminal-accent text-terminal-accent"
                : "bg-terminal-bg border-terminal-border text-terminal-dim hover:text-terminal-text"
            }`}
          >
            Featured
          </button>
          {availableThemes.map((group) => (
            <button
              key={group.theme.key}
              onClick={() => setActiveTheme(group.theme.key)}
              aria-pressed={activeTheme === group.theme.key}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                activeTheme === group.theme.key
                  ? `${group.theme.chipClass} border-terminal-border`
                  : "bg-terminal-bg border-terminal-border text-terminal-dim hover:text-terminal-text"
              }`}
            >
              {group.theme.label}
            </button>
          ))}
        </div>
      )}

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

      {!isLoading && filteredThemeGroups.length > 0 && (
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

      {!isLoading && !isError && filteredThemeGroups.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center text-terminal-dim">
            <p className="text-sm">NO CLUSTERS FOUND</p>
            <p className="text-xs mt-2">
              {isSearching ? "Try another keyword" : "Try another theme or relax the similarity filter"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
