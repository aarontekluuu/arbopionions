# v1.0 Shipping Checklist

## v1.0 Goal: Read-Only Arbitrage Discovery
A production-ready dashboard for discovering arbitrage opportunities on Opinion.trade markets.

---

## Critical Requirements (Must Have)

### 1. ✅ API Configuration
- [x] Code prevents mock data in production
- [x] Clear error messages when API not configured
- [ ] **Set `OPINION_API_KEY` in Vercel** ⚠️ BLOCKER
- [ ] **Set `OPINION_OPENAPI_BASE_URL` in Vercel** ⚠️ BLOCKER
- [ ] Verify API returns real markets (not mock data)
- [ ] Verify `X-Data-Source` header shows "api"

**Action:** Submit API key request form to Opinion.fun team, then configure in Vercel.

### 2. ⚠️ Content Security Policy (CSP) Fixes
- [ ] Fix Google Fonts CSP violation
  - Add `https://fonts.googleapis.com` to `style-src`
  - Add `https://fonts.gstatic.com` to `font-src`
- [ ] Fix WalletConnect API CSP violation
  - Add `https://api.web3modal.org` to `connect-src`

**Current Issue:** Browser console shows CSP violations blocking fonts and WalletConnect.

**File:** `next.config.mjs`

### 3. ✅ Core Functionality
- [x] Real-time market data fetching
- [x] Edge calculation (sum, edge percentage)
- [x] Market filtering (limit, minEdge)
- [x] Sorting (volume, edge)
- [x] Auto-refresh with stale indicators
- [x] Market links to Opinion.trade
- [x] Market detail modal
- [x] Wallet connection (read-only)

### 4. ✅ Error Handling
- [x] API configuration errors show clear messages
- [x] Rate limiting implemented
- [x] Stale data fallback
- [x] Input validation
- [x] Error sanitization (no stack traces in production)

### 5. ✅ Security
- [x] Rate limiting (60 req/15s per IP)
- [x] Input validation (limit, tokenId)
- [x] CORS headers
- [x] Security headers (X-Frame-Options, CSP, etc.)
- [x] XSS protection (HTML sanitization)
- [x] API key never exposed to client

---

## Nice to Have (Can Ship Without)

### 6. Portfolio Page
- [ ] Remove mock data (show "Connect Wallet" prompt)
- [ ] Empty state when no trades
- **Note:** Real portfolio data requires smart contracts (v2.0)

### 7. Cross-Platform Arbitrage
- [ ] Kalshi integration
- [ ] Polymarket integration
- **Note:** This is v1.5+ feature

### 8. Enhanced Features
- [ ] Market search
- [ ] Historical edge tracking
- [ ] Market alerts
- **Note:** These are v1.5+ features

---

## Testing Checklist

### Functional Testing
- [ ] Markets page loads and displays real data
- [ ] Market links open correct Opinion.trade pages
- [ ] Filtering works (limit, minEdge)
- [ ] Sorting works (volume, edge)
- [ ] Auto-refresh updates data every 15s
- [ ] Stale indicator shows when API fails
- [ ] Market modal displays correct information
- [ ] Wallet connection works
- [ ] No console errors (except CSP warnings)

### API Testing
- [ ] `/api/edges` returns real market data
- [ ] `/api/edges?limit=20` works
- [ ] `/api/edges?limit=100` works
- [ ] Rate limiting works (test with rapid requests)
- [ ] Error handling works (test with invalid API key)

### Browser Testing
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari
- [ ] Mobile responsive

### Performance
- [ ] Page load < 2s
- [ ] API response < 1s
- [ ] No memory leaks
- [ ] Smooth scrolling

---

## Deployment Checklist

### Pre-Deployment
- [ ] All environment variables set in Vercel
- [ ] Build passes locally (`npm run build`)
- [ ] No TypeScript errors
- [ ] No linter errors
- [ ] CSP violations fixed

### Vercel Configuration
- [ ] `OPINION_API_KEY` set
- [ ] `OPINION_OPENAPI_BASE_URL` set
- [ ] `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` set
- [ ] Node.js version set to 18+
- [ ] Framework set to Next.js

### Post-Deployment
- [ ] Verify production URL works
- [ ] Check Vercel function logs for errors
- [ ] Verify API returns real data
- [ ] Test market links
- [ ] Test wallet connection
- [ ] Monitor error rates

---

## Known Issues (Acceptable for v1.0)

1. **CSP Violations** - Fonts and WalletConnect blocked (needs fix)
2. **Portfolio shows mock data** - Expected, will be fixed in v2.0
3. **No cross-platform arbitrage** - v1.5+ feature
4. **Debug logging in development** - Acceptable, gated by NODE_ENV

---

## Blockers Summary

### Must Fix Before Shipping:
1. ⚠️ **API Key Configuration** - Get API key from Opinion.fun and set in Vercel
2. ⚠️ **CSP Fixes** - Fix Google Fonts and WalletConnect CSP violations

### Can Ship Without (v1.5+):
- Portfolio real data
- Cross-platform arbitrage
- Advanced features

---

## v1.0 Definition of Done

✅ **Ready to ship when:**
1. API key configured and working
2. CSP violations fixed
3. All core features working
4. No critical bugs
5. Production deployment successful
6. Basic testing complete

**v1.0 is a read-only arbitrage discovery tool. Trading execution comes in v2.0+.**

