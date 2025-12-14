# Opinion Arb Terminal

A real-time prediction market arbitrage dashboard built with Next.js, TypeScript, and Tailwind CSS. Powered by the Opinion OpenAPI.

## Features

- **Live Markets**: Real-time prediction market data from Opinion API
- **Edge Detection**: Visual highlighting of arbitrage opportunities (sum < 1)
- **Wallet Connect**: Multi-chain wallet support (BNB Chain + Polygon)
- **Auto-refresh**: Configurable polling (15s default) with stale data indicators
- **Filter Controls**: Limit results, filter by minimum edge percentage
- **Terminal UI**: Dark theme with monospace fonts and terminal aesthetics

## Prerequisites

- Node.js 18+
- npm or yarn
- Opinion API key (contact the Opinion team)
- WalletConnect Project ID (from [WalletConnect Cloud](https://cloud.walletconnect.com))

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPINION_API_KEY` | Yes | Your Opinion API key |
| `OPINION_OPENAPI_BASE_URL` | Yes | `https://proxy.opinion.trade:8443/openapi` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Yes | WalletConnect Cloud project ID |

## Local Development

1. Copy the example environment file:

```bash
cp .env.example .env.local
```

2. Add your credentials to `.env.local`:
   - Opinion API key
   - WalletConnect Project ID (get one at https://cloud.walletconnect.com)

3. Install dependencies and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Deploy to Vercel

### Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Manual Deployment

1. Push your code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository
3. Add environment variables in **Project Settings → Environment Variables**:
   - `OPINION_API_KEY` — Your Opinion API key
   - `OPINION_OPENAPI_BASE_URL` — `https://proxy.opinion.trade:8443/openapi`
   - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — Your WalletConnect project ID
4. Click **Deploy**

### Expected Routes

| Route | Description |
|-------|-------------|
| `/` | Markets dashboard with live prices |
| `/arbitrage` | Cross-platform arbitrage (Kalshi + Polymarket) |
| `/portfolio` | Portfolio tracking (mock data) |
| `/api/edges` | API endpoint for market edge data |
| `/api/orderbook` | API endpoint for orderbook data |

## Wallet Support

The terminal supports multi-chain wallet connections:

| Chain | Platform | Status |
|-------|----------|--------|
| BNB Chain (BSC) | Opinion.trade | ✅ Live |
| Polygon | Polymarket | ✅ Live |

Supported wallets:
- Browser wallets (MetaMask, Coinbase Wallet, etc.)
- WalletConnect (mobile & desktop wallets)

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── edges/route.ts      # Market edges API
│   │   └── orderbook/route.ts  # Orderbook API
│   ├── arbitrage/page.tsx      # Cross-platform arbitrage
│   ├── portfolio/page.tsx      # Portfolio tracking
│   ├── context.tsx             # App-wide state
│   ├── page.tsx                # Markets dashboard
│   ├── layout.tsx              # Root layout
│   └── globals.css             # Global styles
├── components/
│   ├── NavBar.tsx              # Top navigation
│   ├── MarketCard.tsx          # Market card component
│   ├── MarketModal.tsx         # Market detail modal
│   ├── FilterBar.tsx           # Filter controls
│   ├── ConnectWallet.tsx       # Wallet connection (wagmi)
│   └── StatusIndicator.tsx     # Live/Paused status
├── lib/
│   ├── wagmi.ts                # Wagmi configuration
│   ├── opinionClient.ts        # Server-side Opinion API client
│   ├── links.ts                # URL generation utilities
│   ├── edge.ts                 # Edge computation logic
│   ├── mock.ts                 # Mock data for development
│   └── types.ts                # TypeScript types
├── providers/
│   └── WagmiProvider.tsx       # Wagmi + React Query provider
└── types/
    └── index.ts                # Frontend type exports
```

## API Reference

### GET /api/edges

Returns market data with edge calculations.

**Query Parameters:**
- `limit` (number): Number of markets to return (default: 20, min: 5, max: 40)

**Response:**
```json
{
  "updatedAt": 1705320000000,
  "stale": false,
  "list": [
    {
      "marketId": 123,
      "marketTitle": "Will Bitcoin exceed $100K by end of 2025?",
      "marketUrl": "https://opinion.trade/markets/123",
      "volume24h": 125000,
      "yes": { "tokenId": "token-yes", "price": 0.45 },
      "no": { "tokenId": "token-no", "price": 0.48 },
      "sum": 0.93,
      "edge": 0.07,
      "updatedAt": 1705320000000
    }
  ]
}
```

### GET /api/orderbook

Returns orderbook data for a token.

**Query Parameters:**
- `tokenId` (string): Token ID to fetch orderbook for

**Response:**
```json
{
  "tokenId": "token-123-yes",
  "orderbook": {
    "bestBid": { "price": 0.44, "size": 500 },
    "bestAsk": { "price": 0.46, "size": 350 },
    "spread": 0.02,
    "midPrice": 0.45
  },
  "timestamp": 1705320000000
}
```

## Architecture

- **Server-side only**: Opinion API calls happen server-side; API key never exposed to client
- **Caching**: 10-second TTL cache with request coalescing to reduce API load
- **Rate limiting**: Built-in concurrency limiter (max 10 inflight) + retry with backoff
- **Graceful degradation**: Returns stale cached data if Opinion API fails
- **Multi-chain wallet**: wagmi v2 with WalletConnect + injected connectors

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Wallet**: wagmi v2 + viem
- **Data Fetching**: TanStack React Query
- **Deployment**: Vercel

## License

MIT
