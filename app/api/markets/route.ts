import { NextRequest, NextResponse } from "next/server";
import type {
  MarketsResponse,
  MarketPriceSnapshot,
  PlatformSource,
  PlatformSourceState,
} from "@/lib/types";
import { apiRateLimiter, getClientIdentifier } from "@/lib/rateLimit";
import { getCorsHeaders, sanitizeError, addSecurityHeaders } from "@/lib/security";
import { validateLimitParam } from "@/lib/validation";
import { platformFetchers } from "@/lib/marketSources";
import { buildClusters } from "@/lib/marketClustering";

export const runtime = "nodejs";
export const preferredRegion = "gru1";

const DEFAULT_LIMIT = 50;
const MIN_LIMIT = 5;
const MAX_LIMIT = 200;
const CACHE_TTL_MS = 5_000;
const MAX_STALE_AGE_MS = 60_000;

interface CacheEntry {
  data: MarketsResponse;
  expiresAt: number;
}

let cache: CacheEntry | null = null;
let inflightPromise: Promise<MarketsResponse> | null = null;
const platformInflight = new Map<PlatformSource, Promise<MarketPriceSnapshot[]>>();
const platformCache = new Map<PlatformSource, { data: MarketPriceSnapshot[]; expiresAt: number }>();

const PLATFORM_TTLS: Record<PlatformSource, number> = {
  opinion: 10_000,
  polymarket: 20_000,
  kalshi: 30_000,
  predictfun: 30_000,
  limitless: 30_000,
};

function parseLimit(searchParams: URLSearchParams): number {
  const limitParam = searchParams.get("limit");

  if (limitParam === null) {
    return DEFAULT_LIMIT;
  }

  if (!validateLimitParam(limitParam)) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(limitParam, 10);

  if (Number.isNaN(parsed)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, parsed));
}

function isCacheValid(): boolean {
  return cache !== null && Date.now() < cache.expiresAt;
}

function isStaleCacheValid(): boolean {
  if (!cache) {
    return false;
  }

  const age = Date.now() - cache.expiresAt;
  return age < MAX_STALE_AGE_MS;
}

async function fetchMarkets(limit: number): Promise<MarketsResponse> {
  const platforms = Object.keys(platformFetchers) as PlatformSource[];

  const sources = platforms.reduce<Record<PlatformSource, PlatformSourceState>>(
    (acc, platform) => {
      acc[platform] = { status: "error" };
      return acc;
    },
    {} as Record<PlatformSource, PlatformSourceState>
  );

  const list: MarketPriceSnapshot[] = [];

  const results = await Promise.all(
    platforms.map(async (platform) => {
      const ttl = PLATFORM_TTLS[platform] ?? 15_000;
      const cached = platformCache.get(platform);
      if (cached && Date.now() < cached.expiresAt) {
        return { platform, status: "live", data: cached.data };
      }

      if (platformInflight.has(platform)) {
        try {
          const data = await platformInflight.get(platform)!;
          return { platform, status: "live", data };
        } catch (error) {
          return { platform, status: "error", error: sanitizeError(error), data: [] };
        }
      }

      const inflight = platformFetchers[platform](limit);
      platformInflight.set(platform, inflight);

      try {
        const data = await inflight;
        platformCache.set(platform, { data, expiresAt: Date.now() + ttl });
        return { platform, status: "live", data };
      } catch (error) {
        const fallback = platformCache.get(platform);
        if (fallback) {
          return { platform, status: "error", error: sanitizeError(error), data: fallback.data };
        }
        return { platform, status: "error", error: sanitizeError(error), data: [] };
      } finally {
        platformInflight.delete(platform);
      }
    })
  );

  results.forEach((result) => {
    if (result.status === "live") {
      sources[result.platform] = { status: "live" };
      list.push(...result.data);
      return;
    }

    sources[result.platform] = {
      status: "error",
      error: result.error,
    };
  });

  const { clusters, themes } = buildClusters(list);

  const response: MarketsResponse = {
    updatedAt: Date.now(),
    stale: false,
    list,
    clusters,
    themes,
    sources,
  };

  if (list.length === 0) {
    response.error = "No market data returned from sources";
  }

  return response;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

export async function GET(request: NextRequest) {
  const identifier = getClientIdentifier(request);

  if (!apiRateLimiter.isAllowed(identifier)) {
    const response = NextResponse.json(
      {
        error: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
      },
      { status: 429, headers: getCorsHeaders() }
    );

    return addSecurityHeaders(response);
  }

  const limit = parseLimit(request.nextUrl.searchParams);

  if (isCacheValid()) {
    const response = NextResponse.json(cache?.data ?? null, {
      headers: {
        ...getCorsHeaders(),
        "X-Cache": "HIT",
      },
    });

    return addSecurityHeaders(response);
  }

  try {
    if (!inflightPromise) {
      inflightPromise = fetchMarkets(limit).finally(() => {
        inflightPromise = null;
      });
    }

    const data = await inflightPromise;
    cache = {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    const response = NextResponse.json(data, {
      headers: {
        ...getCorsHeaders(),
        "X-Cache": "MISS",
      },
    });

    return addSecurityHeaders(response);
  } catch (error) {
    if (isStaleCacheValid() && cache) {
      const fallback: MarketsResponse = {
        ...cache.data,
        stale: true,
        error: sanitizeError(error),
      };

      const response = NextResponse.json(fallback, {
        headers: {
          ...getCorsHeaders(),
          "X-Cache": "STALE",
        },
      });

      return addSecurityHeaders(response);
    }

    const response = NextResponse.json(
      {
        error: "MARKETS_FETCH_FAILED",
        message: sanitizeError(error),
      },
      { status: 500, headers: getCorsHeaders() }
    );

    return addSecurityHeaders(response);
  }
}



