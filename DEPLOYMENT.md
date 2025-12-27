# Deployment Instructions

## Vercel Environment Variables

To deploy this application to Vercel, you need to set the following environment variables in your Vercel project settings:

### Required Environment Variables

1. **OPINION_API_KEY**
   - Value: `evrAQJBVkmc4r1A1o0nxtihakX2Epnxz`
   - Description: Your Opinion API key for accessing the Opinion OpenAPI
   - Scope: Production, Preview, Development

2. **OPINION_OPENAPI_BASE_URL**
   - Value: `https://proxy.opinion.trade:8443/openapi`
   - Description: Base URL for the Opinion OpenAPI
   - Scope: Production, Preview, Development

3. **NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID**
   - Value: (Get from https://cloud.walletconnect.com)
   - Description: WalletConnect Cloud project ID for wallet connections
   - Scope: Production, Preview, Development

### Optional Environment Variables (for contract deployment)

4. **FEE_WALLET_ADDRESS**
   - Value: `0x6facaf8776eac4ca7a3e1213e4fe66238da9bc4b`
   - Description: EOA address to receive fees from contract deployments
   - Scope: Production, Preview, Development (if deploying contracts)

5. **BSC_TESTNET_RPC_URL**
   - Value: `https://data-seed-prebsc-1-s1.binance.org:8545`
   - Description: BSC Testnet RPC URL for contract deployment
   - Scope: Development (local only, do not commit)

6. **PRIVATE_KEY**
   - Value: (Your deployer private key)
   - Description: Private key for contract deployment
   - Scope: Development (local only, NEVER commit or set in Vercel)

7. **FEE_BASIS_POINTS**
   - Value: `50` (default, represents 0.5%)
   - Description: Fee percentage in basis points
   - Scope: Development (local only)

8. **BSCSCAN_API_KEY**
   - Value: (Your BSCScan API key)
   - Description: API key for contract verification on BSCScan
   - Scope: Development (local only)

## How to Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - Click **Add New**
   - Enter the variable name
   - Enter the value
   - Select the environments (Production, Preview, Development)
   - Click **Save**
4. Redeploy your application for changes to take effect

## Local Development Setup

1. Create a `.env.local` file in the project root:

```bash
# Opinion API Configuration
OPINION_API_KEY=evrAQJBVkmc4r1A1o0nxtihakX2Epnxz
OPINION_OPENAPI_BASE_URL=https://proxy.opinion.trade:8443/openapi

# WalletConnect Configuration
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# Fee Wallet Address (EOA)
FEE_WALLET_ADDRESS=0x6facaf8776eac4ca7a3e1213e4fe66238da9bc4b
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

## Verification

After deployment, verify that:

1. The API is working by checking `/api/markets` endpoint
2. The response header `X-Cache` shows `HIT`, `MISS`, or `STALE`
3. Real market data is displayed on the dashboard
4. No errors appear in Vercel function logs

## Security Notes

- **Never commit** `.env.local` or `.env` files to git
- **Never set** `PRIVATE_KEY` in Vercel environment variables
- API keys are server-side only and never exposed to the client
- The `OPINION_API_KEY` is used only in server-side API routes











