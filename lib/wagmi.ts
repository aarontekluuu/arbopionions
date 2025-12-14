import { http, createConfig } from "wagmi";
import { bsc, polygon } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

/**
 * Supported chains for Opinion Arb Terminal
 * - BNB Chain (BSC): Opinion.trade
 * - Polygon: Polymarket
 */
export const supportedChains = [bsc, polygon] as const;

/**
 * Get WalletConnect project ID from environment
 */
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

/**
 * Wagmi configuration
 */
export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [
    injected(),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            metadata: {
              name: "Opinion Arb Terminal",
              description: "Real-time prediction market arbitrage dashboard",
              url: "https://arb-opionions.vercel.app",
              icons: ["https://arb-opionions.vercel.app/icon.svg"],
            },
          }),
        ]
      : []),
  ],
  transports: {
    [bsc.id]: http(),
    [polygon.id]: http(),
  },
});

/**
 * Chain metadata for UI display
 */
export const chainMeta: Record<number, { name: string; platform: string; color: string }> = {
  [bsc.id]: { name: "BNB Chain", platform: "Opinion.trade", color: "terminal-warn" },
  [polygon.id]: { name: "Polygon", platform: "Polymarket", color: "terminal-purple" },
};

