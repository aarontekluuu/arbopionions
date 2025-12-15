# Security Audit: opinion.arb terminal

**Date:** 2025-01-XX  
**Version:** v2  
**Status:** Pre-production (read-only markets)

---

## Executive Summary

This audit identifies security edge cases and potential vulnerabilities in the opinion.arb terminal codebase. The application is currently read-only (no order execution), but several security improvements should be implemented before adding trading functionality.

**Risk Level Summary:**
- 🔴 **Critical:** 2 issues
- 🟡 **High:** 5 issues  
- 🟢 **Medium:** 8 issues
- ⚪ **Low/Info:** 4 issues

---

## Critical Issues

### 1. 🔴 No Rate Limiting on API Routes

**Location:** `/app/api/edges/route.ts`, `/app/api/orderbook/route.ts`

**Issue:** API routes have no per-IP or per-user rate limiting. An attacker could:
- Exhaust server resources with rapid requests
- Bypass cache by spamming requests
- Cause DoS by overwhelming the Opinion API

**Impact:** 
- Server resource exhaustion
- Opinion API rate limit exhaustion
- Potential service disruption

**Recommendation:**
```typescript
// Add rate limiting middleware
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, "15s"), // 20 requests per 15s
});

export async function GET(request: NextRequest) {
  const ip = request.ip ?? "127.0.0.1";
  const { success } = await ratelimit.limit(ip);
  
  if (!success) {
    return NextResponse.json(
      { error: "RATE_LIMIT_EXCEEDED", message: "Too many requests" },
      { status: 429 }
    );
  }
  // ... rest of handler
}
```

**Priority:** Implement before production launch

---

### 2. 🔴 Input Validation: tokenId Not Sanitized

**Location:** `/app/api/orderbook/route.ts:54`

**Issue:** `tokenId` parameter is used directly without validation or sanitization. Could be exploited for:
- Path traversal (if used in file operations)
- Injection attacks (if passed to external APIs)
- Resource exhaustion (extremely long strings)

**Current Code:**
```typescript
const tokenId = searchParams.get("tokenId");
if (!tokenId) {
  return NextResponse.json({ error: "MISSING_PARAM" }, { status: 400 });
}
// tokenId used directly without validation
```

**Impact:**
- Potential injection if tokenId passed to external systems
- Resource exhaustion with malicious input
- Unexpected behavior with special characters

**Recommendation:**
```typescript
function validateTokenId(tokenId: string): boolean {
  // Token IDs should be alphanumeric with hyphens/underscores
  // Max length to prevent resource exhaustion
  return /^[a-zA-Z0-9_-]{1,100}$/.test(tokenId);
}

const tokenId = searchParams.get("tokenId");
if (!tokenId || !validateTokenId(tokenId)) {
  return NextResponse.json(
    { error: "INVALID_PARAM", message: "Invalid tokenId format" },
    { status: 400 }
  );
}
```

**Priority:** Fix immediately

---

## High Priority Issues

### 3. 🟡 No CORS Configuration

**Location:** All API routes

**Issue:** No explicit CORS headers. Next.js defaults may allow cross-origin requests from any origin.

**Impact:**
- CSRF attacks
- Unauthorized data access from malicious sites
- Potential data exfiltration

**Recommendation:**
```typescript
// Add to API routes or middleware
const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "https://arb-opionions.vercel.app",
  "Access-Control-Allow-Methods": "GET",
  "Access-Control-Allow-Headers": "Content-Type",
};

return NextResponse.json(data, { headers: corsHeaders });
```

**Priority:** Implement before production

---

### 4. 🟡 Cache Poisoning Risk

**Location:** `/app/api/edges/route.ts:20`

**Issue:** In-memory cache is shared across all users. Malicious user could:
- Pollute cache with crafted requests
- Cause all users to receive stale/incorrect data
- No cache invalidation on errors

**Current Implementation:**
```typescript
let cache: CacheEntry | null = null; // Shared global state
```

**Impact:**
- All users affected by cache poisoning
- No isolation between requests
- Stale data served indefinitely

**Recommendation:**
- Add cache key based on request parameters
- Implement cache versioning
- Add cache invalidation on errors
- Consider Redis for production (with proper isolation)

**Priority:** Fix before high traffic

---

### 5. 🟡 Error Messages May Leak Information

**Location:** Multiple API routes

**Issue:** Error messages and stack traces could leak:
- Internal API structure
- Server configuration
- Database/API details

**Example:**
```typescript
console.error("[/api/edges] Error fetching data:", errorMessage);
// Could log full error stack in production
```

**Impact:**
- Information disclosure
- Attack surface enumeration
- Potential for targeted attacks

**Recommendation:**
```typescript
// In production, sanitize error messages
const sanitizeError = (error: unknown): string => {
  if (process.env.NODE_ENV === "production") {
    return "An error occurred. Please try again later.";
  }
  return error instanceof Error ? error.message : "Unknown error";
};
```

**Priority:** Fix before production

---

### 6. 🟡 XSS Risk: Market Titles Not Sanitized

**Location:** `/components/MarketModal.tsx`, `/components/MarketCard.tsx`

**Issue:** Market titles from API are rendered directly without sanitization. If API is compromised or returns malicious data:
```tsx
<h2>{market.marketTitle}</h2> // Could contain <script> tags
```

**Impact:**
- Cross-site scripting attacks
- Session hijacking
- Data exfiltration

**Recommendation:**
```typescript
import DOMPurify from "isomorphic-dompurify";

// Sanitize before rendering
const safeTitle = DOMPurify.sanitize(market.marketTitle);
```

**Priority:** Fix before production (especially if API is untrusted)

---

### 7. 🟡 No Request Size Limits

**Location:** All API routes

**Issue:** No limits on:
- Query parameter sizes
- Request body sizes (if POST added later)
- Response sizes

**Impact:**
- Memory exhaustion
- DoS via large requests
- Resource exhaustion

**Recommendation:**
- Add Next.js body size limits in config
- Validate parameter lengths
- Limit response sizes

**Priority:** Implement before production

---

## Medium Priority Issues

### 8. 🟢 Environment Variable Validation

**Location:** `lib/opinionClient.ts:81-94`

**Issue:** Environment variables are checked for existence but not validated for format/security.

**Recommendation:**
```typescript
function validateApiKey(key: string): boolean {
  // Validate format (e.g., alphanumeric, specific length)
  return /^[a-zA-Z0-9]{32,128}$/.test(key);
}

function validateBaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}
```

**Priority:** Medium

---

### 9. 🟢 Debug Logging in Production Code

**Location:** `/app/api/edges/route.ts:75-83`

**Issue:** Debug logging is gated by `NODE_ENV` but could accidentally expose sensitive data.

**Current:**
```typescript
if (process.env.NODE_ENV === "development" && opinionMarkets.length > 0) {
  console.log("[DEBUG] Sample Opinion API market response:", {
    // Could log sensitive fields
  });
}
```

**Recommendation:**
- Use structured logging library
- Never log API keys or tokens
- Use log levels (debug/info/warn/error)
- Consider removing debug logs entirely

**Priority:** Medium

---

### 10. 🟢 No Request Timeout on API Routes

**Location:** All API routes

**Issue:** While `opinionClient` has timeout, API routes themselves have no timeout. Long-running requests could:
- Hold server resources
- Cause connection pool exhaustion
- Lead to DoS

**Recommendation:**
```typescript
// Add timeout middleware or use Next.js timeout
export const maxDuration = 10; // 10 seconds max
```

**Priority:** Medium

---

### 11. 🟢 URL Generation: Potential Open Redirect

**Location:** `lib/links.ts`, `components/MarketModal.tsx`

**Issue:** URLs are generated from user-controlled data (marketId, topicId). If not validated, could be used for open redirect attacks.

**Recommendation:**
```typescript
function validateMarketId(id: number | string): boolean {
  const num = typeof id === "string" ? parseInt(id, 10) : id;
  return Number.isFinite(num) && num > 0 && num < Number.MAX_SAFE_INTEGER;
}
```

**Priority:** Medium (low risk currently since URLs are external)

---

### 12. 🟢 No CSRF Protection

**Location:** All API routes

**Issue:** No CSRF tokens or SameSite cookie protection. If POST/PUT endpoints are added, vulnerable to CSRF.

**Current Status:** Only GET endpoints exist (lower risk)

**Recommendation:**
- Add CSRF tokens when implementing POST/PUT
- Use SameSite cookies
- Implement origin validation

**Priority:** Medium (critical when adding order execution)

---

### 13. 🟢 Concurrency Limiter: No Per-User Limits

**Location:** `lib/opinionClient.ts:48-77`

**Issue:** Concurrency limiter is global, not per-user. Single user could exhaust all slots.

**Current:**
```typescript
const limiter = new ConcurrencyLimiter(MAX_CONCURRENT); // Global
```

**Recommendation:**
- Add per-IP or per-user concurrency limits
- Use distributed rate limiting (Redis) for production

**Priority:** Medium

---

### 14. 🟢 Cache: No TTL on Stale Data

**Location:** `/app/api/edges/route.ts:246-252`

**Issue:** Stale cache data is served indefinitely. No maximum age for stale data.

**Recommendation:**
```typescript
const MAX_STALE_AGE_MS = 60_000; // 1 minute max stale

if (cache && Date.now() - cache.expiresAt < MAX_STALE_AGE_MS) {
  // Serve stale data
} else {
  // Clear stale cache, return error
}
```

**Priority:** Medium

---

### 15. 🟢 No Input Length Validation on limit Parameter

**Location:** `/app/api/edges/route.ts:25-40`

**Issue:** While `limit` is clamped, extremely large values could cause issues before clamping.

**Recommendation:**
```typescript
function parseLimit(searchParams: URLSearchParams): number {
  const limitParam = searchParams.get("limit");
  
  // Validate length first
  if (limitParam && limitParam.length > 10) {
    return DEFAULT_LIMIT; // Reject suspiciously long input
  }
  
  // ... rest of parsing
}
```

**Priority:** Low-Medium

---

## Low Priority / Informational

### 16. ⚪ WalletConnect Project ID: Public Exposure

**Location:** `lib/wagmi.ts:15`

**Issue:** `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is exposed to client (by design). This is expected behavior for WalletConnect.

**Status:** ✅ Acceptable - WalletConnect requires public project ID

**Priority:** Info only

---

### 17. ⚪ No API Key Rotation Mechanism

**Location:** `lib/opinionClient.ts`

**Issue:** No mechanism for rotating API keys without downtime.

**Recommendation:**
- Support multiple API keys with fallback
- Environment variable hot-reload (Vercel supports this)

**Priority:** Low

---

### 18. ⚪ No Monitoring/Alerting

**Location:** Entire application

**Issue:** No error tracking, monitoring, or alerting for security events.

**Recommendation:**
- Add Sentry or similar for error tracking
- Monitor for:
  - Rate limit violations
  - Unusual request patterns
  - API failures
  - Cache poisoning attempts

**Priority:** Low (but recommended for production)

---

### 19. ⚪ No Security Headers

**Location:** `next.config.mjs`, `app/layout.tsx`

**Issue:** Missing security headers:
- `Content-Security-Policy`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`

**Recommendation:**
```typescript
// next.config.mjs
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; ...",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  // ... more headers
];

module.exports = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
```

**Priority:** Low-Medium

---

## Future Considerations (v5/v6: Order Execution)

### 20. 🔴 Transaction Security (Future)

**When implementing order execution:**

- **Transaction Validation:**
  - Verify transaction signatures server-side
  - Validate order amounts (min/max limits)
  - Check slippage tolerance
  - Validate market state before execution

- **Order Limits:**
  - Per-user daily limits
  - Per-order size limits
  - Rate limits on order placement

- **Nonce Management:**
  - Prevent replay attacks
  - Handle concurrent transactions
  - Validate nonce sequence

- **Slippage Protection:**
  - Maximum slippage tolerance
  - Price impact checks
  - Reject orders with excessive slippage

**Priority:** Critical when adding trading

---

### 21. 🟡 Fee Calculation Security (Future)

**When implementing fees:**

- **Fee Validation:**
  - Server-side fee calculation (never trust client)
  - Validate fee amounts match expected rates
  - Prevent fee manipulation

- **Fee Collection:**
  - Secure fee wallet
  - Multi-sig for large amounts
  - Fee accounting/auditing

**Priority:** High when adding fees

---

### 22. 🟡 Order Type Validation (Future)

**When implementing market/limit/TWAP orders:**

- **Order Type Validation:**
  - Validate order parameters match type
  - Enforce limits per order type
  - Validate TWAP parameters (duration, intervals)

- **Price Validation:**
  - Limit orders: validate price is reasonable
  - Market orders: validate execution price
  - TWAP: validate price range

**Priority:** High when adding order types

---

## Recommendations Summary

### Immediate Actions (Before Production)

1. ✅ Add rate limiting to all API routes
2. ✅ Validate and sanitize all user inputs (tokenId, limit, etc.)
3. ✅ Add CORS configuration
4. ✅ Sanitize market titles before rendering
5. ✅ Add security headers
6. ✅ Implement proper error handling (no stack traces in production)

### Short Term (Within 1-2 Weeks)

7. Fix cache poisoning (add request-based cache keys)
8. Add request size limits
9. Implement per-user rate limiting
10. Add monitoring/alerting

### Before Adding Trading (v5/v6)

11. Implement transaction validation
12. Add order limits and validation
13. Implement fee calculation security
14. Add CSRF protection
15. Implement nonce management

---

## Testing Recommendations

### Security Testing Checklist

- [ ] Rate limiting works correctly
- [ ] Input validation rejects malicious inputs
- [ ] XSS payloads are sanitized
- [ ] CORS headers are correct
- [ ] Error messages don't leak information
- [ ] Cache poisoning attempts fail
- [ ] Large requests are rejected
- [ ] API keys never appear in logs/client

### Penetration Testing

Consider professional pen testing before:
- Production launch
- Adding order execution
- Handling real funds

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
- [Vercel Security](https://vercel.com/docs/security)

---

**Next Review:** Before v5 (order execution implementation)

