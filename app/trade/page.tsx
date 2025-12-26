"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { OrderForm } from "@/components/OrderForm";
import type { MarketEdge, EdgesResponse } from "@/lib/types";

async function fetchMarket(marketId: number): Promise<MarketEdge | null> {
  const res = await fetch(`/api/edges?limit=200`);
  if (!res.ok) return null;
  const data: EdgesResponse = await res.json();
  return data.list.find((m) => m.marketId === marketId) || null;
}

function TradePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isConnected } = useAccount();
  const marketIdParam = searchParams.get("marketId");
  const marketId = marketIdParam ? parseInt(marketIdParam, 10) : null;

  const { data: market, isLoading } = useQuery({
    queryKey: ["market", marketId],
    queryFn: () => (marketId ? fetchMarket(marketId) : null),
    enabled: !!marketId,
  });

  if (!marketId) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-terminal-danger/10 border border-terminal-danger/30 rounded-lg p-6 text-center">
          <div className="text-terminal-danger font-medium mb-2">NO MARKET SELECTED</div>
          <div className="text-sm text-terminal-dim mb-4">
            Please select a market from the markets page to place an order.
          </div>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-terminal-accent text-terminal-bg rounded-lg hover:bg-terminal-accent/90"
          >
            GO TO MARKETS
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <svg className="w-8 h-8 animate-spin text-terminal-accent" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-terminal-danger/10 border border-terminal-danger/30 rounded-lg p-6 text-center">
          <div className="text-terminal-danger font-medium mb-2">MARKET NOT FOUND</div>
          <div className="text-sm text-terminal-dim mb-4">
            Market ID {marketId} could not be found.
          </div>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-terminal-accent text-terminal-bg rounded-lg hover:bg-terminal-accent/90"
          >
            GO TO MARKETS
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-xs text-terminal-dim hover:text-terminal-text mb-4 flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          BACK
        </button>
        <h1 className="text-xl font-semibold text-terminal-text flex items-center gap-2">
          <span className="text-terminal-accent">&gt;</span>
          PLACE ORDER
        </h1>
        <p className="text-sm text-terminal-dim mt-1">
          Execute a trade on Opinion.trade through pm.ag
        </p>
      </div>

      {/* Order Form */}
      <div className="bg-terminal-surface border border-terminal-border rounded-lg p-6">
        <OrderForm
          market={market}
          onOrderPlaced={() => {
            // Could redirect to portfolio or show success
            router.push("/portfolio");
          }}
        />
      </div>

      {/* Info Section */}
      {!isConnected && (
        <div className="mt-4 bg-terminal-warn/10 border border-terminal-warn/30 rounded-lg p-4 text-xs text-terminal-warn">
          <div className="font-medium mb-1">WALLET NOT CONNECTED</div>
          <div>Please connect your wallet to place orders. We support BNB Chain for Opinion.trade trades.</div>
        </div>
      )}
    </div>
  );
}

export default function TradePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto p-6">
          <div className="flex items-center justify-center py-12">
            <svg className="w-8 h-8 animate-spin text-terminal-accent" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        </div>
      }
    >
      <TradePageContent />
    </Suspense>
  );
}
