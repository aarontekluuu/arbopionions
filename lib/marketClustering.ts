import type { MarketPriceSnapshot, MarketCluster, ThemeClusterGroup } from "@/lib/types";
import { classifyMarketTheme, marketThemes } from "@/lib/marketThemes";
import {
  calculateMarketSimilarity,
  normalizeMarketTitle,
  type MarketData,
} from "@/lib/marketMatching";

const BASE_THRESHOLD = 0.78;

function getAdaptiveThreshold(titleA: string, titleB: string): number {
  const lengthScore = (titleA.length + titleB.length) / 2;
  if (lengthScore <= 45) {
    return 0.88;
  }
  if (lengthScore <= 80) {
    return 0.82;
  }
  if (lengthScore >= 140) {
    return 0.72;
  }
  return BASE_THRESHOLD;
}

function buildBucketKeys(title: string): string[] {
  const normalized = normalizeMarketTitle(title, true);
  const tokens = normalized.split(" ").filter(Boolean);

  if (tokens.length === 0) {
    const fallback = normalizeMarketTitle(title).slice(0, 30);
    return fallback ? [fallback] : [];
  }

  const keys = new Set<string>();
  keys.add(tokens.slice(0, 4).join("-"));
  if (tokens.length > 4) {
    keys.add(tokens.slice(-4).join("-"));
  }
  if (tokens.length > 8) {
    keys.add(tokens.slice(2, 6).join("-"));
  }

  return Array.from(keys).filter(Boolean);
}

export function buildClusters(
  snapshots: MarketPriceSnapshot[]
): { clusters: MarketCluster[]; themes: ThemeClusterGroup[] } {
  if (snapshots.length === 0) {
    return { clusters: [], themes: [] };
  }

  const clusterMarkets = snapshots.map((snapshot) => ({
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

  const marketData: MarketData[] = clusterMarkets.map((market) => ({
    platform: market.platform,
    marketId: market.marketId,
    marketTitle: market.marketTitle,
    marketUrl: market.marketUrl,
    yesPrice: market.yesPrice,
    noPrice: market.noPrice,
    volume24h: market.volume24h,
    updatedAt: market.updatedAt,
    expiresAt: market.expiresAt,
    category: market.category,
    tags: market.tags,
    description: market.description,
    metadata: {
      expiresAt: market.expiresAt,
      category: market.category,
      tags: market.tags,
    },
  }));

  const bucketMap = new Map<string, number[]>();
  marketData.forEach((market, index) => {
    const keys = buildBucketKeys(market.marketTitle);
    if (keys.length === 0) {
      return;
    }
    for (const key of keys) {
      const bucket = bucketMap.get(key);
      if (bucket) {
        bucket.push(index);
      } else {
        bucketMap.set(key, [index]);
      }
    }
  });

  const parent = Array.from({ length: marketData.length }, (_, index) => index);
  const findRoot = (index: number): number => {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  };
  const union = (a: number, b: number) => {
    const rootA = findRoot(a);
    const rootB = findRoot(b);
    if (rootA !== rootB) {
      parent[rootB] = rootA;
    }
  };

  const seenPairs = new Set<string>();
  for (const indices of bucketMap.values()) {
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const left = indices[i];
        const right = indices[j];
        if (marketData[left].platform === marketData[right].platform) {
          continue;
        }
        const pairKey = left < right ? `${left}-${right}` : `${right}-${left}`;
        if (seenPairs.has(pairKey)) {
          continue;
        }
        seenPairs.add(pairKey);
        const similarity = calculateMarketSimilarity(marketData[left], marketData[right]);
        const threshold = getAdaptiveThreshold(
          marketData[left].marketTitle,
          marketData[right].marketTitle
        );
        if (similarity >= threshold) {
          union(left, right);
        }
      }
    }
  }

  const clustersByRoot = new Map<number, typeof clusterMarkets>();
  clusterMarkets.forEach((market, index) => {
    const root = findRoot(index);
    const bucket = clustersByRoot.get(root);
    if (bucket) {
      bucket.push(market);
    } else {
      clustersByRoot.set(root, [market]);
    }
  });

  const clusters = Array.from(clustersByRoot.values()).map((markets, index) => {
    const primary = markets.reduce((best, current) =>
      current.marketTitle.length > best.marketTitle.length ? current : best
    );
    const normalizedTitle = normalizeMarketTitle(primary.marketTitle);
    const platformCount = new Set(markets.map((market) => market.platform)).size;
    const themeKey = classifyMarketTheme(primary.marketTitle, [
      primary.category,
      primary.description,
      ...(primary.tags ?? []),
    ]);

    return {
      id: `${normalizedTitle}-${primary.marketId}-${index}`,
      title: primary.marketTitle,
      normalizedTitle,
      themeKey,
      platformCount,
      markets: markets.sort((a, b) => a.platform.localeCompare(b.platform)),
    } satisfies MarketCluster;
  });

  clusters.sort((a, b) => b.platformCount - a.platformCount || b.markets.length - a.markets.length);

  const themeBuckets = new Map<string, MarketCluster[]>();
  for (const theme of marketThemes) {
    themeBuckets.set(theme.key, []);
  }
  for (const cluster of clusters) {
    const bucket = themeBuckets.get(cluster.themeKey) ?? themeBuckets.get("other");
    if (bucket) {
      bucket.push(cluster);
    }
  }

  const themes: ThemeClusterGroup[] = marketThemes.map((theme) => {
    const themeClusters = themeBuckets.get(theme.key) ?? [];
    const totalMarkets = themeClusters.reduce(
      (sum, cluster) => sum + cluster.markets.length,
      0
    );
    return {
      themeKey: theme.key,
      totalClusters: themeClusters.length,
      totalMarkets,
      clusters: themeClusters,
    };
  });

  return { clusters, themes };
}
