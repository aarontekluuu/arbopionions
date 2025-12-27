# Aggregator UI: Two Upgrade Paths

## Path A: Layout + Info Density (No New Data)

### Goals
- Reduce visual clumping between event group cards.
- Surface more context per market without new API fields.
- Improve scanability and spacing.

### Approach
1. **Rework event group card layout**
   - Convert card body to a two-row structure:
     - Row 1: event title + confidence + venue count + a small meta cluster.
     - Row 2: a horizontal strip of market “chips” for quick glance + a fuller list below.
2. **Add lightweight metadata (existing data only)**
   - Show platform icon/color + price spread (YES vs NO) + last update (from `updatedAt` if available per snapshot; if not, show page updated time).
3. **Reduce perceived clumping**
   - Increase inter-card spacing.
   - Add subtle separators or alternating backgrounds within event group.
4. **Interaction polish**
   - Expand-on-hover for market rows or collapse to top N with “Show more” per group.

### Files to touch
- `app/aggregation/page.tsx`
- (Optional) shared UI components if extracted.

### Risks
- Limited by existing data; no true link previews.

### Acceptance
- Event group cards feel more breathable.
- More information visible without new API calls.

---

## Path B: Link Preview Cards (OpenGraph/Twitter)

### Goals
- Show preview image + title + site name for each market link, similar to X.
- Keep performance acceptable with caching.

### Approach
1. **Add a preview fetcher endpoint**
   - New route: `app/api/link-preview/route.ts` (or `pages/api` depending on project conventions).
   - Accept a URL, fetch HTML, parse OpenGraph/Twitter meta tags.
   - Return `{ title, image, siteName, url }`.
2. **Caching strategy**
   - In-memory LRU (simple) or persistent cache in `cache/`.
   - TTL (e.g., 6–12 hours).
3. **UI integration**
   - Each market row requests preview data lazily (on hover or when expanded).
   - Render a compact preview card (image + title + site).
4. **Performance + safety**
   - Limit concurrent fetches.
   - Validate URLs to avoid SSRF.
   - Add fallback UI when preview missing.

### Files to touch
- `app/aggregation/page.tsx`
- `app/api/link-preview/route.ts`
- (Optional) shared `lib/linkPreview.ts`

### Risks
- Network access required; could be rate-limited.
- Some sites block scraping or omit OG metadata.

### Acceptance
- Market entries show a visual preview image when available.
- Reasonable latency with caching.
