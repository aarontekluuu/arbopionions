"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MarketGroup, MarketsResponse, PlatformSourceStatus } from "@/types";

const PLATFORMS = ["opinion", "kalshi", "polymarket", "predictfun"] as const;
const PLATFORM_LABELS: Record<(typeof PLATFORMS)[number], string> = {
  opinion: "Opinion.trade",
  kalshi: "Kalshi",
  polymarket: "Polymarket",
  predictfun: "Predict.fun",
};

const PLATFORM_COLORS: Record<(typeof PLATFORMS)[number], string> = {
  opinion: "text-terminal-accent",
  kalshi: "text-terminal-cyan",
  polymarket: "text-terminal-purple",
  predictfun: "text-terminal-warn",
};

async function fetchMarkets(limit: number): Promise<MarketsResponse> {
  const res = await fetch(`/api/markets?limit=${limit}`);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Failed to fetch markets");
  }
  return res.json();
}

function formatPrice(price: number | null): string {
  if (price === null || !Number.isFinite(price)) {
    return "—";
  }
  return price.toFixed(2);
}

function SourceStatusBadge({ source }: { source: PlatformSourceStatus }) {
  const statusStyles =
    source.status === "live"
      ? "bg-terminal-accent/20 text-terminal-accent border-terminal-accent/40"
      : source.status === "error"
        ? "bg-terminal-warn/20 text-terminal-warn border-terminal-warn/40"
        : "bg-terminal-border/40 text-terminal-dim border-terminal-border";

  return (
    <div className={`px-3 py-1 border rounded text-xs flex items-center gap-2 ${statusStyles}`}>
      <span className="uppercase tracking-wider text-[10px]">{source.status}</span>
      <span className="font-medium">{PLATFORM_LABELS[source.platform]}</span>
      {source.message && <span className="text-[10px] text-terminal-dim">{source.message}</span>}
    </div>
  );
}

export default function ArbitragePage() {
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["aggregated-markets"],
    queryFn: () => fetchMarkets(60),
    refetchInterval: 20000,
  });

  const tags = useMemo(() => {
    if (!data?.groups) {
      return [];
    }
    const set = new Set<string>();
    data.groups.forEach((group) => group.tags.forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [data?.groups]);

  const filteredGroups = useMemo(() => {
    if (!data?.groups) {
      return [];
    }
    return data.groups.filter((group) => {
      const matchesSearch = search
        ? group.title.toLowerCase().includes(search.toLowerCase())
        : true;
      const matchesTag = selectedTag ? group.tags.includes(selectedTag) : true;
      return matchesSearch && matchesTag;
    });
  }, [data?.groups, search, selectedTag]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-terminal-text flex items-center gap-2">
          <span className="text-terminal-cyan">&gt;</span>
          AGGREGATOR
          <span className="cursor-blink" />
        </h1>
        <p className="text-sm text-terminal-dim mt-1">
          Compare YES prices across Opinion.trade, Kalshi, Polymarket, and Predict.fun.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-terminal-surface border border-terminal-border rounded px-3 py-2 flex items-center gap-2 w-full md:w-80">
              <span className="text-terminal-dim text-xs uppercase tracking-wider">Search</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="BTC, Fed, election..."
                className="bg-transparent text-sm text-terminal-text placeholder:text-terminal-dim focus:outline-none w-full"
              />
            </div>
            <button
              onClick={() => refetch()}
              className="px-3 py-2 text-xs uppercase tracking-wider border border-terminal-border rounded text-terminal-dim hover:text-terminal-text hover:border-terminal-accent"
            >
              {isFetching ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <div className="text-xs text-terminal-dim">
            {data?.updatedAt ? `Updated ${new Date(data.updatedAt).toLocaleTimeString()}` : "Waiting for data"}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className={`px-3 py-1 rounded text-xs border ${
              !selectedTag ? "border-terminal-accent text-terminal-accent" : "border-terminal-border text-terminal-dim"
            }`}
            onClick={() => setSelectedTag(null)}
          >
            All tags
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              className={`px-3 py-1 rounded text-xs border ${
                selectedTag === tag
                  ? "border-terminal-accent text-terminal-accent"
                  : "border-terminal-border text-terminal-dim"
              }`}
              onClick={() => setSelectedTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>

        {data?.sources && (
          <div className="flex flex-wrap gap-2">
            {data.sources.map((source) => (
              <SourceStatusBadge key={source.platform} source={source} />
            ))}
          </div>
        )}
      </div>

      <div className="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-terminal-border text-[10px] text-terminal-dim uppercase tracking-wider">
          <div className="col-span-6">Market</div>
          <div className="col-span-2 text-right">Spread</div>
          {PLATFORMS.map((platform) => (
            <div key={platform} className="col-span-1 text-right">
              {PLATFORM_LABELS[platform]}
            </div>
          ))}
        </div>

        {isLoading && (
          <div className="p-6 text-sm text-terminal-dim">Loading markets...</div>
        )}

        {isError && (
          <div className="p-6 text-sm text-terminal-warn">
            {error instanceof Error ? error.message : "Failed to load markets."}
          </div>
        )}

        {!isLoading && !isError && filteredGroups.length === 0 && (
          <div className="p-6 text-sm text-terminal-dim">No markets match your filters.</div>
        )}

        {filteredGroups.map((group) => {
          const priceMap = new Map(group.prices.map((price) => [price.platform, price]));
          const numericPrices = group.prices
            .map((price) => price.price)
            .filter((price): price is number => price !== null && Number.isFinite(price));
          const spread =
            numericPrices.length >= 2 ? Math.max(...numericPrices) - Math.min(...numericPrices) : null;

          return (
            <div
              key={group.groupId}
              className="grid grid-cols-12 gap-4 px-4 py-4 border-b border-terminal-border last:border-b-0"
            >
              <div className="col-span-6">
                <div className="text-sm text-terminal-text font-medium">{group.title}</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {group.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-[10px] uppercase tracking-wider border border-terminal-border text-terminal-dim rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="col-span-2 text-right text-sm text-terminal-text">
                {spread !== null ? spread.toFixed(2) : "—"}
              </div>
              {PLATFORMS.map((platform) => {
                const price = priceMap.get(platform);
                return (
                  <div key={platform} className={`col-span-1 text-right text-sm ${PLATFORM_COLORS[platform]}`}>
                    {price?.url ? (
                      <a
                        href={price.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                      >
                        {formatPrice(price.price)}
                      </a>
                    ) : (
                      formatPrice(price?.price ?? null)
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
