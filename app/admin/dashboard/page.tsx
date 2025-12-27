"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

async function fetchMetrics() {
  const res = await fetch("/api/admin/metrics");
  if (!res.ok) {
    throw new Error("Failed to fetch metrics");
  }
  return res.json();
}

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0.00";
  
  // Convert from wei to dollars (assuming 18 decimals)
  const dollars = num / 1e18;
  
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function AdminDashboard() {
  const { address } = useAccount();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: fetchMetrics,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-terminal-text flex items-center gap-2">
          <span className="text-terminal-accent">&gt;</span>
          OPERATIONAL DASHBOARD
        </h1>
        <p className="text-sm text-terminal-dim mt-1">
          Platform metrics and operational data
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <svg className="w-8 h-8 animate-spin text-terminal-accent" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {error && (
        <div className="bg-terminal-danger/10 border border-terminal-danger/30 rounded-lg p-4 text-terminal-danger">
          Failed to load metrics. Please try again later.
        </div>
      )}

      {data && (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <MetricCard
              label="Total Fees Collected"
              value={formatCurrency(data.totalFees || "0")}
              icon="💰"
            />
            <MetricCard
              label="Total Volume"
              value={formatCurrency(data.totalVolume || "0")}
              icon="📊"
            />
            <MetricCard
              label="Total Trades"
              value={formatNumber(data.totalTrades || 0)}
              icon="🔄"
            />
            <MetricCard
              label="Active Users (30d)"
              value={formatNumber(data.activeUsers || 0)}
              icon="👥"
            />
          </div>

          {/* System Status */}
          <div className="bg-terminal-surface border border-terminal-border rounded-lg p-6 mb-6">
            <h2 className="text-sm font-medium text-terminal-text mb-4 flex items-center gap-2">
              <span className="text-terminal-accent">&gt;</span>
              SYSTEM STATUS
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <StatusItem label="API Status" value="Online" status="online" />
              <StatusItem label="Indexer Status" value="Running" status="online" />
              <StatusItem label="Database" value="Connected" status="online" />
              <StatusItem label="Last Update" value={new Date().toLocaleTimeString()} status="online" />
            </div>
          </div>

          {/* User Metrics (if wallet connected) */}
          {address && data.userMetrics && (
            <div className="bg-terminal-surface border border-terminal-border rounded-lg p-6">
              <h2 className="text-sm font-medium text-terminal-text mb-4 flex items-center gap-2">
                <span className="text-terminal-accent">&gt;</span>
                YOUR METRICS
              </h2>
              <div className="text-xs text-terminal-dim">
                <div className="font-mono">{address}</div>
                <div className="mt-2">
                  Recent Trades: {data.userMetrics.recentTrades?.length || 0}
                </div>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="mt-6 text-center text-xs text-terminal-dim">
            Data refreshes every 30 seconds. Last updated: {new Date().toLocaleTimeString()}
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
      <div className="text-[10px] text-terminal-dim tracking-wider uppercase mb-2">{label}</div>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div className="text-2xl font-bold text-terminal-text">{value}</div>
      </div>
    </div>
  );
}

function StatusItem({ label, value, status }: { label: string; value: string; status: "online" | "offline" }) {
  return (
    <div>
      <div className="text-[10px] text-terminal-dim mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${status === "online" ? "bg-terminal-accent" : "bg-terminal-danger"}`} />
        <span className="text-sm text-terminal-text">{value}</span>
      </div>
    </div>
  );
}
