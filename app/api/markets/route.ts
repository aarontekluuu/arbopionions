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

export const runtime = "nodejs";
export const preferredRegion = "gru1";

const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 5;
const MAX_LIMIT = 50;
const CACHE_TTL_MS = 15_000;
const MAX_STALE_AGE_MS = 60_000;

interface CacheEntry {
  data: MarketsResponse;
  expiresAt: number;
}

let cache: CacheEntry | null = null;
let inflightPromise: Promise<MarketsResponse> | null = null;

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

  const results = await Promise.allSettled(
    platforms.map(async (platform) => {
      const data = await platformFetchers[platform](limit);
      return { platform, data };
    })
  );

  const sources = platforms.reduce<Record<PlatformSource, PlatformSourceState>>(
    (acc, platform) => {
      acc[platform] = { status: "error" };
      return acc;
    },
    {} as Record<PlatformSource, PlatformSourceState>
  );

  const list: MarketPriceSnapshot[] = [];

  results.forEach((result, index) => {
    const platform = platforms[index];

    if (result.status === "fulfilled") {
      sources[platform] = { status: "live" };
      list.push(...result.value.data);
      return;
    }

    sources[platform] = {
      status: "error",
      error: sanitizeError(result.reason),
    };
  });

  const response: MarketsResponse = {
    updatedAt: Date.now(),
    stale: false,
    list,
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
