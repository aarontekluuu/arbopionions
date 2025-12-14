"use client";

import { type ReactNode } from "react";
import { WagmiProvider as WagmiProviderBase } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";

// Create a client for React Query (required by wagmi v2)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
      refetchOnWindowFocus: false,
    },
  },
});

interface WagmiProviderProps {
  children: ReactNode;
}

export function WagmiProvider({ children }: WagmiProviderProps) {
  return (
    <WagmiProviderBase config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProviderBase>
  );
}

