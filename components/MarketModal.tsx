"use client";

import { useEffect, useState, useCallback } from "react";
import type { MarketEdge, TokenOrderbook } from "@/lib/types";
import { getMarketPlatform, getPlatformInfo } from "@/lib/platforms";
import { getOpinionSearchUrl } from "@/lib/links";

interface MarketModalProps {
  market: MarketEdge | null;
  isStale: boolean;
  onClose: () => void;
}

interface OrderbookData {
  yes: TokenOrderbook | null;
  no: TokenOrderbook | null;
  loading: boolean;
  error: string | null;
}

export function MarketModal({ market, isStale, onClose }: MarketModalProps) {
  const [orderbook, setOrderbook] = useState<OrderbookData>({
    yes: null,
    no: null,
    loading: false,
    error: null,
  });
  const [copied, setCopied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Fetch orderbook data when modal opens
  useEffect(() => {
    if (!market) return;

    const fetchOrderbook = async () => {
      setOrderbook({ yes: null, no: null, loading: true, error: null });

      try {
        const [yesRes, noRes] = await Promise.all([
          fetch(`/api/orderbook?tokenId=${market.yes.tokenId}`),
          fetch(`/api/orderbook?tokenId=${market.no.tokenId}`),
        ]);

        if (!yesRes.ok || !noRes.ok) {
          throw new Error("Failed to fetch orderbook");
        }

        const yesData = await yesRes.json();
        const noData = await noRes.json();

        setOrderbook({
          yes: yesData.orderbook,
          no: noData.orderbook,
          loading: false,
          error: null,
        });
      } catch {
        setOrderbook({
          yes: null,
          no: null,
          loading: false,
          error: "Unable to load orderbook",
        });
      }
    };

    fetchOrderbook();
  }, [market]);

  // Reset copied state when modal opens
  useEffect(() => {
    setCopied(false);
  }, [market]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  // Copy market ID to clipboard
  const handleCopyMarketId = async () => {
    if (!market) return;
    try {
      await navigator.clipboard.writeText(String(market.marketId));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = String(market.marketId);
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!market) return null;

  const formatPrice = (price: number) => `${(price * 100).toFixed(1)}¢`;
  const formatDollars = (amount: number) => {
    if (amount >= 1000) return `$${(amount / 1000).toFixed(2)}K`;
    return `$${amount.toFixed(2)}`;
  };
  const formatVolume = (vol: number) => {
    if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(2)}M`;
    if (vol >= 1_000) return `$${(vol / 1_000).toFixed(2)}K`;
    return `$${vol.toFixed(2)}`;
  };
  const formatEdge = (edge: number) => `${(edge * 100).toFixed(2)}%`;
  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const hasEdge = market.edge > 0;
  
  // Calculate profit for $1,000 deployment
  // Profit = deployment * (1 - sum) / sum when sum < 1
  // If sum >= 1, no arbitrage profit
  const deploymentAmount = 1000;
  const profitPerDeployment = market.sum < 1 
    ? deploymentAmount * (1 - market.sum) / market.sum 
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-terminal-surface border border-terminal-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-terminal-surface border-b border-terminal-border p-4 flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <button
                onClick={handleCopyMarketId}
                className="text-[10px] px-1.5 py-0.5 rounded bg-terminal-border text-terminal-dim hover:bg-terminal-muted hover:text-terminal-text transition-colors flex items-center gap-1"
                title="Click to copy Market ID"
              >
                #{market.marketId}
                {copied ? (
                  <svg className="w-3 h-3 text-terminal-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
              {isStale && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-terminal-warn/20 text-terminal-warn">
                  STALE
                </span>
              )}
              {hasEdge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-terminal-accent/20 text-terminal-accent font-medium">
                  +{formatEdge(market.edge)} EDGE
                </span>
              )}
            </div>
            <h2 className="text-lg font-medium text-terminal-text leading-snug">
              {market.marketTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-terminal-dim hover:text-terminal-text hover:bg-terminal-border rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Price Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-terminal-bg border border-terminal-border rounded-lg p-4 text-center">
              <div className="text-[10px] text-terminal-dim tracking-wider mb-2">YES PRICE</div>
              <div className="text-3xl font-bold text-terminal-accent">{formatPrice(market.yes.price)}</div>
              <div className="text-[10px] text-terminal-dim mt-1 truncate">{market.yes.tokenId}</div>
            </div>
            <div className="bg-terminal-bg border border-terminal-border rounded-lg p-4 text-center">
              <div className="text-[10px] text-terminal-dim tracking-wider mb-2">NO PRICE</div>
              <div className="text-3xl font-bold text-terminal-danger">{formatPrice(market.no.price)}</div>
              <div className="text-[10px] text-terminal-dim mt-1 truncate">{market.no.tokenId}</div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-terminal-bg border border-terminal-border rounded p-3 text-center">
              <div className="text-[10px] text-terminal-dim tracking-wider mb-1">VOLUME 24H</div>
              <div className="text-sm font-semibold text-terminal-text">{formatVolume(market.volume24h)}</div>
            </div>
            <div className="bg-terminal-bg border border-terminal-border rounded p-3 text-center">
              <div className="text-[10px] text-terminal-dim tracking-wider mb-1">SUM</div>
              <div className={`text-sm font-semibold ${market.sum < 1 ? "text-terminal-accent" : market.sum > 1 ? "text-terminal-danger" : "text-terminal-text"}`}>
                {formatPrice(market.sum)}
              </div>
            </div>
            <div className="bg-terminal-bg border border-terminal-border rounded p-3 text-center">
              <div className="text-[10px] text-terminal-dim tracking-wider mb-1">EDGE</div>
              <div className={`text-sm font-semibold ${hasEdge ? "text-terminal-accent" : "text-terminal-dim"}`}>
                {formatEdge(market.edge)}
              </div>
            </div>
            <div className="bg-terminal-bg border border-terminal-border rounded p-3 text-center">
              <div className="text-[10px] text-terminal-dim tracking-wider mb-1">UPDATED</div>
              <div className="text-[10px] font-medium text-terminal-text">{formatTime(market.updatedAt)}</div>
            </div>
          </div>

          {/* Profit Calculator */}
          {hasEdge && (
            <div className="bg-terminal-accent/10 border border-terminal-accent/30 rounded-lg p-4">
              <div className="text-center">
                <div className="text-[10px] text-terminal-accent tracking-wider mb-2">
                  IF YOU DEPLOY ${deploymentAmount.toLocaleString()} AT CURRENT PRICES
                </div>
                <div className="text-3xl font-bold text-terminal-accent mb-1">
                  ~{formatDollars(profitPerDeployment)} profit
                </div>
                <div className="text-[10px] text-terminal-dim">
                  Pre-fees, assumes full fill at shown prices
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-terminal-accent/20 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[9px] text-terminal-dim">YES COST</div>
                  <div className="text-xs text-terminal-text">
                    {formatDollars(deploymentAmount * market.yes.price / market.sum)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-terminal-dim">NO COST</div>
                  <div className="text-xs text-terminal-text">
                    {formatDollars(deploymentAmount * market.no.price / market.sum)}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-terminal-dim">PAYOUT</div>
                  <div className="text-xs text-terminal-accent">
                    {formatDollars(deploymentAmount / market.sum)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Orderbook Preview */}
          <div className="bg-terminal-bg border border-terminal-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-terminal-border">
              <h3 className="text-sm font-medium text-terminal-text flex items-center gap-2">
                <span className="text-terminal-accent">&gt;</span>
                ORDERBOOK PREVIEW
              </h3>
            </div>
            <div className="p-4">
              {orderbook.loading ? (
                <div className="flex items-center justify-center py-6 text-terminal-dim text-sm">
                  <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading orderbook...
                </div>
              ) : orderbook.error ? (
                <div className="text-center py-6 text-terminal-dim text-sm">{orderbook.error}</div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {/* YES Orderbook */}
                  <div>
                    <div className="text-[10px] text-terminal-dim tracking-wider mb-2">YES TOKEN</div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-terminal-dim">Best Bid:</span>
                        <span className="text-terminal-accent font-mono">
                          {orderbook.yes?.bestBid ? `${formatPrice(orderbook.yes.bestBid.price)} (${orderbook.yes.bestBid.size})` : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-terminal-dim">Best Ask:</span>
                        <span className="text-terminal-danger font-mono">
                          {orderbook.yes?.bestAsk ? `${formatPrice(orderbook.yes.bestAsk.price)} (${orderbook.yes.bestAsk.size})` : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-terminal-border pt-2">
                        <span className="text-terminal-dim">Spread:</span>
                        <span className="text-terminal-text font-mono">
                          {orderbook.yes?.spread ? formatPrice(orderbook.yes.spread) : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* NO Orderbook */}
                  <div>
                    <div className="text-[10px] text-terminal-dim tracking-wider mb-2">NO TOKEN</div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-terminal-dim">Best Bid:</span>
                        <span className="text-terminal-accent font-mono">
                          {orderbook.no?.bestBid ? `${formatPrice(orderbook.no.bestBid.price)} (${orderbook.no.bestBid.size})` : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-terminal-dim">Best Ask:</span>
                        <span className="text-terminal-danger font-mono">
                          {orderbook.no?.bestAsk ? `${formatPrice(orderbook.no.bestAsk.price)} (${orderbook.no.bestAsk.size})` : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-terminal-border pt-2">
                        <span className="text-terminal-dim">Spread:</span>
                        <span className="text-terminal-text font-mono">
                          {orderbook.no?.spread ? formatPrice(orderbook.no.spread) : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Place Order Section */}
          <div className="bg-terminal-bg border border-terminal-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-terminal-border">
              <h3 className="text-sm font-medium text-terminal-text flex items-center gap-2">
                <span className="text-terminal-accent">&gt;</span>
                PLACE ORDER
              </h3>
            </div>
            <div className="p-4 space-y-3">
              <a
                href={market.marketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-4 bg-terminal-warn/10 border border-terminal-warn/30 text-terminal-warn font-medium rounded-lg hover:bg-terminal-warn/20 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-terminal-accent" />
                <span className="w-2 h-2 rounded-full bg-terminal-danger" />
                <span>PLACE YES AND NO ORDER</span>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
              <p className="text-[10px] text-terminal-dim text-center">
                Opens {getPlatformInfo(getMarketPlatform(market)).displayName} in new tab. Complete order on platform.
              </p>
            </div>
          </div>

          {/* Open on Opinion.trade Button */}
          <div className="space-y-2">
            <a
              href={market.marketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-4 bg-terminal-accent text-terminal-bg font-medium rounded-lg hover:bg-terminal-accent/90 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              VIEW ON OPINION.TRADE
            </a>
            {/* Fallback search link if direct link doesn't work */}
            <a
              href={getOpinionSearchUrl(market.marketTitle)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2 text-xs text-terminal-dim hover:text-terminal-text transition-colors underline"
            >
              Can't find market? Search for "{market.marketTitle.substring(0, 40)}..."
            </a>
            <p className="text-[10px] text-terminal-dim text-center">
              Market ID: #{market.marketId}
              {market.topicId && ` • Topic ID: ${market.topicId}`}
              {!market.topicId && " • (No topicId - using marketId)"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
