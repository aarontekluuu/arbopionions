const MAX_ENTRIES = 200;
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

type LinkPreview = {
  title?: string;
  image?: string;
  siteName?: string;
  url: string;
};

const cache = new Map<string, { data: LinkPreview; expiresAt: number }>();

function setCache(url: string, data: LinkPreview) {
  if (cache.size >= MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) {
      cache.delete(firstKey);
    }
  }
  cache.set(url, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function getCache(url: string) {
  const entry = cache.get(url);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(url);
    return null;
  }
  return entry.data;
}

function isPrivateHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost")) return true;
  if (lower === "127.0.0.1" || lower === "::1") return true;
  if (/^10\./.test(lower)) return true;
  if (/^192\.168\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)) return true;
  return false;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getMetaContent(html: string, attr: "property" | "name", key: string): string | undefined {
  const escaped = escapeRegex(key);
  const primary = new RegExp(
    `<meta[^>]+${attr}=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const secondary = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*${attr}=["']${escaped}["'][^>]*>`,
    "i"
  );
  const match = html.match(primary) ?? html.match(secondary);
  return match?.[1];
}

function getTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim();
}

function resolveUrl(raw: string | undefined, base: URL): string | undefined {
  if (!raw) return undefined;
  try {
    return new URL(raw, base).toString();
  } catch {
    return undefined;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");

  if (!target) {
    return Response.json({ error: "Missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return Response.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return Response.json({ error: "Unsupported protocol" }, { status: 400 });
  }

  if (parsed.username || parsed.password || isPrivateHostname(parsed.hostname)) {
    return Response.json({ error: "Blocked url" }, { status: 400 });
  }

  const cached = getCache(parsed.toString());
  if (cached) {
    return Response.json(cached);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "arbopinion-link-preview/1.0",
      },
    });

    if (!res.ok) {
      return Response.json({ error: "Failed to fetch url" }, { status: 502 });
    }

    const html = (await res.text()).slice(0, 1_000_000);
    const ogTitle = getMetaContent(html, "property", "og:title");
    const twitterTitle = getMetaContent(html, "name", "twitter:title");
    const ogImage = getMetaContent(html, "property", "og:image");
    const twitterImage = getMetaContent(html, "name", "twitter:image");
    const siteName = getMetaContent(html, "property", "og:site_name");
    const ogUrl = getMetaContent(html, "property", "og:url");

    const data: LinkPreview = {
      title: ogTitle || twitterTitle || getTitle(html),
      image: resolveUrl(ogImage || twitterImage, parsed),
      siteName: siteName || parsed.hostname,
      url: resolveUrl(ogUrl, parsed) || parsed.toString(),
    };

    setCache(parsed.toString(), data);

    return Response.json(data);
  } catch (error) {
    return Response.json({ error: "Preview fetch failed" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
