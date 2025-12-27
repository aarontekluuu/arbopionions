# API Setup Guide

This guide explains how to set up API credentials for each prediction market platform to enable cross-platform aggregation.

## Required: Opinion.trade API

**Status:** Required for basic functionality

1. Visit [Opinion.trade](https://app.opinion.trade) and create an account
2. Navigate to API settings to generate an API key
3. Copy your API key and base URL
4. Add to `.env.local`:
   ```bash
   OPINION_API_KEY=your_api_key_here
   OPINION_OPENAPI_BASE_URL=https://api.opinion.trade/openapi
   ```

## Optional: Kalshi (DFlow Backend)

**Status:** Optional - uses public DFlow API (no API key required)

**Note:** The UI is branded as "Kalshi" but uses the DFlow prediction markets API backend.

1. No API key required - uses public DFlow API endpoint
2. DFlow API Base URL: `https://prediction-markets-api.dflow.net/api/v1/`
3. The implementation automatically uses the DFlow API
4. No environment variables needed for Kalshi/DFlow integration

**DFlow API Endpoints:**
- `/markets` - List all markets
- `/market/{market_id}` - Get specific market details

**Documentation:** [DFlow Prediction Markets API](https://pond.dflow.net/concepts/prediction/prediction-markets)

## Optional: Polymarket CLOB API

**Status:** Optional - enables Polymarket integration via CLOB API

1. Visit [Polymarket API Documentation](https://docs.polymarket.com)
2. Apply for API access through their developer portal (if required)
3. Complete integration testing as required
4. Obtain API key (may be optional for public endpoints)
5. Add to `.env.local`:
   ```bash
   POLYMARKET_API_KEY=your_api_key_here  # Optional, may not be required
   POLYMARKET_API_BASE_URL=https://clob.polymarket.com
   ```

**Note:** The implementation uses Polymarket's CLOB (Central Limit Order Book) API. Some endpoints may work without authentication, but authenticated endpoints may provide better rate limits and access.

## Optional: Predict.fun API

**Status:** Optional - enables Predict.fun integration

1. API Key: `810cb3b42bb5499a6695ee348afd8a8dcfee` (provided)
2. Base URL: `https://api.predict.fun/`
3. Add to `.env.local`:
   ```bash
   PREDICTFUN_API_KEY=810cb3b42bb5499a6695ee348afd8a8dcfee
   PREDICTFUN_API_BASE_URL=https://api.predict.fun
   ```

**Note:** The API key is included in the codebase as a fallback, but it's recommended to set it as an environment variable for security.

## Environment Variable Validation

The application will validate API configuration on startup:

- **Opinion.trade:** Required - application will fail if not configured
- **Other platforms:** Optional - application will continue but those platforms won't be available for aggregation

## Testing API Configuration

1. Start the development server: `npm run dev`
2. Check the console logs for API connection status
3. Visit `/aggregation` page to see which platforms are available
4. Platform cards will show "SETUP NEEDED" if API credentials are missing

## Troubleshooting

### Opinion.trade API Issues

- **Geo-blocking:** The API may be blocked in certain regions. Consider using a proxy or different hosting region (currently configured for São Paulo, Brazil)
- **Rate limiting:** The client includes automatic retry logic with exponential backoff
- **Authentication:** Ensure your API key is correct and hasn't expired

### Kalshi/DFlow API Issues

- **DFlow API:** Uses public DFlow prediction markets API - no authentication required
- **Rate Limiting:** DFlow API may have rate limits - monitor usage if needed
- **API Changes:** If DFlow API structure changes, update `lib/marketSources.ts` `fetchKalshiPrices()` function

### Polymarket API Issues

- **GraphQL Errors:** Check the subgraph endpoint is accessible
- **CLOB API:** Verify the base URL is correct for the CLOB API

### Predict.fun API Issues

- **API Key:** Ensure the API key `810cb3b42bb5499a6695ee348afd8a8dcfee` is set in environment variables
- **Base URL:** Verify the base URL is `https://api.predict.fun/`
- **Rate Limiting:** Monitor API usage for rate limits

## Security Notes

- Never commit `.env.local` to version control
- Use environment variables in production (Vercel, etc.)
- Rotate API keys regularly
- Use read-only API keys when possible
- Monitor API usage for unexpected activity

## Next Steps

Once API credentials are configured:

1. Test each platform individually
2. Verify market data is being fetched correctly
3. Check that prices are being retrieved
4. Test market matching across platforms
5. Verify market matching across platforms

## Vercel Deployment

### Setting Environment Variables in Vercel

1. **Navigate to Vercel Dashboard:**
   - Go to [vercel.com](https://vercel.com) and select your project
   - Click on **Settings** → **Environment Variables**

2. **Add Required Environment Variables:**

   **Required:**
   ```bash
   OPINION_API_KEY=your_opinion_api_key
   OPINION_OPENAPI_BASE_URL=https://api.opinion.trade/openapi
   ```

   **Optional (for full platform support):**
   ```bash
   # Predict.fun
   PREDICTFUN_API_KEY=810cb3b42bb5499a6695ee348afd8a8dcfee
   PREDICTFUN_API_BASE_URL=https://api.predict.fun

   # Polymarket (API key may be optional)
   POLYMARKET_API_KEY=your_polymarket_api_key  # Optional
   POLYMARKET_API_BASE_URL=https://clob.polymarket.com

   # Kalshi/DFlow - No API key needed (uses public DFlow API)
   # No environment variables required
   ```

3. **Environment Selection:**
   - Select which environments each variable applies to:
     - **Production** - Live site
     - **Preview** - Preview deployments
     - **Development** - Local development (if using Vercel CLI)

4. **Redeploy:**
   - After adding environment variables, redeploy your application
   - Changes take effect on the next deployment

### Verifying Platform Status

After deployment:

1. Visit your Vercel site
2. Navigate to `/aggregation` page
3. Check the platform status indicators:
   - **LIVE** (green) - Platform is working
   - **ERROR** (yellow/red) - Platform has issues
4. Review browser console for any API errors
5. Check Vercel function logs for server-side errors

### Platform-Specific Notes for Vercel

- **Opinion.trade:** Required - site will not function without this
- **Predict.fun:** Uses provided API key - should work immediately
- **Polymarket:** CLOB API may work without key, but key recommended for better access
- **Kalshi/DFlow:** Public API - no configuration needed, should work automatically

### Troubleshooting Vercel Deployment

- **Environment Variables Not Working:**
  - Ensure variables are set for the correct environment (Production/Preview)
  - Redeploy after adding variables
  - Check variable names match exactly (case-sensitive)

- **Platform Status Shows ERROR:**
  - Check Vercel function logs for API errors
  - Verify API keys are correct
  - Check if API endpoints are accessible from Vercel's servers

- **Build Failures:**
  - Ensure all required environment variables are set
  - Check build logs for TypeScript errors
  - Verify Node.js version compatibility

For more information, see the main [README.md](./README.md).



