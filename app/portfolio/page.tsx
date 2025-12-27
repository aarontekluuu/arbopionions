"use client";

import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { ConnectWallet } from "@/components/ConnectWallet";

async function fetchUserTrades(userAddress: string) {
  const res = await fetch(`/api/portfolio?userAddress=${userAddress}`);
  if (!res.ok) {
    throw new Error("Failed to fetch portfolio");
  }
  return res.json();
}

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["portfolio", address],
    queryFn: () => (address ? fetchUserTrades(address) : null),
    enabled: !!address && isConnected,
  });

  if (!isConnected || !address) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-terminal-text flex items-center gap-2">
            <span className="text-terminal-accent">&gt;</span>
            PORTFOLIO
          </h1>
          <p className="text-sm text-terminal-dim mt-1">
            View your trading history and portfolio value
          </p>
        </div>

        <div className="bg-terminal-surface border border-terminal-border rounded-lg p-12 text-center">
          <div className="text-terminal-dim mb-6">
            <svg
              className="w-16 h-16 mx-auto mb-4 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <div className="text-lg font-medium text-terminal-text mb-2">
              Connect Your Wallet
            </div>
            <div className="text-sm text-terminal-dim max-w-md mx-auto">
              Connect your wallet to view your trading history, portfolio value, and performance metrics.
            </div>
          </div>
          <div className="flex justify-center">
            <ConnectWallet />
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <svg className="w-8 h-8 animate-spin text-terminal-accent" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-terminal-danger/10 border border-terminal-danger/30 rounded-lg p-6 text-center">
          <div className="text-terminal-danger font-medium mb-2">ERROR LOADING PORTFOLIO</div>
          <div className="text-sm text-terminal-dim">
            {error instanceof Error ? error.message : "Failed to load portfolio data"}
          </div>
        </div>
      </div>
    );
  }

  const trades = data?.trades || [];
  const portfolioValue = data?.portfolioValue || "0";
  const totalFees = data?.totalFees || "0";
  const totalTrades = data?.totalTrades || 0;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-terminal-text flex items-center gap-2">
          <span className="text-terminal-accent">&gt;</span>
          PORTFOLIO
        </h1>
        <p className="text-sm text-terminal-dim mt-1">
          Your trading history and portfolio performance
        </p>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
          <div className="text-[10px] text-terminal-dim tracking-wider uppercase mb-2">
            Portfolio Value
          </div>
          <div className="text-2xl font-bold text-terminal-text">
            ${(parseFloat(portfolioValue) / 1e18).toFixed(2)}
          </div>
        </div>
        <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
          <div className="text-[10px] text-terminal-dim tracking-wider uppercase mb-2">
            Total Trades
          </div>
          <div className="text-2xl font-bold text-terminal-text">{totalTrades}</div>
        </div>
        <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
          <div className="text-[10px] text-terminal-dim tracking-wider uppercase mb-2">
            Total Fees Paid
          </div>
          <div className="text-2xl font-bold text-terminal-text">
            ${(parseFloat(totalFees) / 1e18).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Trade History */}
      <div className="bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-terminal-border">
          <h2 className="text-sm font-medium text-terminal-text flex items-center gap-2">
            <span className="text-terminal-accent">&gt;</span>
            TRADE HISTORY
          </h2>
        </div>

        {trades.length === 0 ? (
          <div className="p-12 text-center text-terminal-dim">
            <div className="mb-2">No trades yet</div>
            <div className="text-xs">
              Start trading to see your history here. Trades will appear once smart contracts are deployed and active.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-terminal-bg border-b border-terminal-border">
                <tr>
                  <th className="px-4 py-3 text-left text-terminal-dim font-medium">Market</th>
                  <th className="px-4 py-3 text-left text-terminal-dim font-medium">Side</th>
                  <th className="px-4 py-3 text-right text-terminal-dim font-medium">Amount</th>
                  <th className="px-4 py-3 text-right text-terminal-dim font-medium">Fee</th>
                  <th className="px-4 py-3 text-left text-terminal-dim font-medium">Date</th>
                  <th className="px-4 py-3 text-left text-terminal-dim font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade: any) => (
                  <tr key={trade.id} className="border-b border-terminal-border hover:bg-terminal-bg/50">
                    <td className="px-4 py-3 text-terminal-text">
                      <div className="max-w-xs truncate">{trade.marketTitle || `Market #${trade.marketId}`}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded ${
                          trade.side === "yes"
                            ? "bg-terminal-accent/20 text-terminal-accent"
                            : "bg-terminal-danger/20 text-terminal-danger"
                        }`}
                      >
                        {trade.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-terminal-text font-mono">
                      ${(parseFloat(trade.amount) / 1e18).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-terminal-dim font-mono">
                      ${(parseFloat(trade.fee) / 1e18).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-terminal-dim">
                      {new Date(trade.timestamp).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded bg-terminal-accent/20 text-terminal-accent text-[10px]">
                        EXECUTED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-6 text-center text-xs text-terminal-dim">
        <div className="mb-2">
          Portfolio data is synced from on-chain smart contracts.
        </div>
        <div>
          Note: Smart contracts are not yet deployed. This page will show real data once v2 is live.
        </div>
      </div>
    </div>
  );
}
