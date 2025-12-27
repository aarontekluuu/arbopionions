# pm.ag terminal

A real-time prediction market aggregation dashboard built with Next.js, TypeScript, and Tailwind CSS. Powered by the Opinion OpenAPI and public market sources.

## Features

- **Live Markets**: Real-time prediction market data across supported platforms
- **Market Matching**: Grouped views of similar markets across platforms
- **Wallet Connect**: Multi-chain wallet support (BNB Chain + Polygon)
- **Auto-refresh**: Configurable polling (15s default) with stale data indicators
- **Source Health**: Platform status cards with live/error reporting
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

## Smart Contract Development (v2)

### Prerequisites

- Node.js 18+
- Hardhat installed (`npm install --save-dev hardhat`)
- BSC Testnet BNB for gas (get from [faucet](https://testnet.bnbchain.org/faucet-smart))

### Environment Variables for Contracts

Add to `.env.local`:

```bash
# BSC Testnet
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
PRIVATE_KEY=0x... # Your deployer private key (NEVER commit this!)

# Optional: Fee configuration
FEE_WALLET_ADDRESS=0x... # Address to receive fees (defaults to deployer)
FEE_BASIS_POINTS=50 # Fee percentage in basis points (50 = 0.5%)

# Optional: BSCScan API key for contract verification
BSCSCAN_API_KEY=...
```

### Compile Contracts

```bash
npx hardhat compile
```

### Run Tests

```bash
npx hardhat test
```

### Deploy to BSC Testnet

```bash
npx hardhat run scripts/deploy.ts --network bscTestnet
```

After deployment, the script will output contract addresses. Add these to your `.env.local`:

```bash
MOCK_OPINION_EXCHANGE_ADDRESS=0x...
TRADE_ROUTER_ADDRESS=0x...
FEE_TRACKER_ADDRESS=0x...
```

Deployment info is also saved to `deployments/bscTestnet.json`.

### Contract Architecture

- **MockOpinionExchange**: Mock contract for testing (replaced with real Opinion contract in production)
- **TradeRouter**: Main contract that routes trades and collects fees
- **FeeTracker**: Tracks fees per user and total fees collected

### Testing Locally

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/TradeRouter.test.ts

# Run with gas reporting
REPORT_GAS=true npx hardhat test
```

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
| `/` | Aggregated markets dashboard with live prices |
| `/aggregation` | Themed market aggregation view |
| `/welcome` | Welcome screen (shown on first visit) |
| `/portfolio` | Portfolio tracking (mock data) |
| `/api/markets` | API endpoint for aggregated market data |
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
│   │   ├── markets/route.ts    # Aggregated market API
│   │   └── orderbook/route.ts  # Orderbook API
│   ├── aggregation/page.tsx    # Themed aggregation
│   ├── portfolio/page.tsx      # Portfolio tracking
│   ├── welcome/page.tsx        # Welcome screen
│   ├── context.tsx             # App-wide state
│   ├── page.tsx                # Markets dashboard
│   ├── layout.tsx              # Root layout
│   └── globals.css             # Global styles
├── components/
│   ├── NavBar.tsx              # Top navigation
│   ├── ConnectWallet.tsx       # Wallet connection (wagmi)
│   └── StatusIndicator.tsx     # Live/Paused status
├── lib/
│   ├── wagmi.ts                # Wagmi configuration
│   ├── opinionClient.ts        # Server-side Opinion API client
│   ├── links.ts                # URL generation utilities
│   ├── marketSources.ts        # Cross-platform market fetchers
│   ├── marketMatching.ts       # Title normalization + grouping
│   └── types.ts                # TypeScript types
├── providers/
│   └── WagmiProvider.tsx       # Wagmi + React Query provider
└── types/
    └── index.ts                # Frontend type exports
```

## API Reference

### GET /api/markets

Returns aggregated market data from configured sources.

**Query Parameters:**
- `limit` (number): Number of markets to return (default: 20, min: 5, max: 50)

**Response:**
```json
{
  "updatedAt": 1705320000000,
  "stale": false,
  "list": [
    {
      "platform": "opinion",
      "marketId": "123",
      "marketTitle": "Will Bitcoin exceed $100K by end of 2025?",
      "price": 0.45,
      "updatedAt": 1705320000000,
      "url": "https://app.opinion.trade/detail?topicId=123&type=multi"
    }
  ],
  "sources": {
    "opinion": { "status": "live" },
    "kalshi": { "status": "error", "error": "..." },
    "polymarket": { "status": "live" },
    "predictfun": { "status": "live" },
    "limitless": { "status": "live" }
  }
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

- **Server-side only**: Market source calls happen server-side; API keys never exposed to client
- **Caching**: 15-second TTL cache with request coalescing to reduce API load
- **Rate limiting**: Per-client in-memory limiter on API routes
- **Graceful degradation**: Returns stale cached data if sources fail
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
