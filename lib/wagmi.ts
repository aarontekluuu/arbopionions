import { http, createConfig } from "wagmi";
import { bsc, polygon } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

/**
 * Supported chains for pm.ag terminal
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
              name: "pm.ag terminal",
              description: "Real-time prediction market aggregation dashboard",
              url: "https://pm.ag",
              icons: ["https://pm.ag/icon.svg"],
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
  [polygon.id]: { name: "Polygon", platform: "Polymarket", color: "terminal-accent" },
};
