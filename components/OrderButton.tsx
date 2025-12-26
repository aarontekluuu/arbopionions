"use client";

import { getPlatformOrderUrl } from "@/lib/links";
import { getMarketPlatform, getPlatformInfo } from "@/lib/platforms";
import type { MarketEdge } from "@/lib/types";

interface OrderButtonProps {
  market: MarketEdge;
  side: "yes" | "no";
  disabled?: boolean;
  className?: string;
}

export function OrderButton({
  market,
  side,
  disabled = false,
  className = "",
}: OrderButtonProps) {
  const platform = getMarketPlatform(market);
  const platformInfo = getPlatformInfo(platform);
  const isDisabled = disabled || !platformInfo.orderEnabled;

  const handleClick = () => {
    if (isDisabled) return;

    const url = getPlatformOrderUrl(platform, side, {
      marketId: market.marketId,
      topicId: market.topicId,
      marketTitle: market.marketTitle,
      platformMarketId: market.platformMarketId,
      marketUrl: market.marketUrl,
    });

    window.open(url, "_blank", "noopener,noreferrer");
  };

  const sideLabel = side.toUpperCase();
  const sideDotColor = side === "yes" ? "bg-terminal-accent" : "bg-terminal-danger";

  // Platform-specific styling
  const getPlatformStyles = () => {
    if (isDisabled) {
      return "bg-terminal-border text-terminal-dim cursor-not-allowed border border-terminal-border";
    }

    switch (platform) {
      case "opinion":
        return "bg-terminal-warn/10 border border-terminal-warn/30 text-terminal-warn hover:bg-terminal-warn/20";
      case "kalshi":
        return "bg-terminal-cyan/10 border border-terminal-cyan/30 text-terminal-cyan hover:bg-terminal-cyan/20";
      case "polymarket":
        return "bg-terminal-purple/10 border border-terminal-purple/30 text-terminal-purple hover:bg-terminal-purple/20";
      case "predictfun":
        return "bg-terminal-magenta/10 border border-terminal-magenta/30 text-terminal-magenta hover:bg-terminal-magenta/20";
      default:
        return "bg-terminal-border text-terminal-text hover:bg-terminal-muted border border-terminal-border";
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        flex items-center justify-center gap-2 px-4 py-3 rounded-lg
        font-medium text-sm transition-all
        ${getPlatformStyles()}
        ${className}
      `}
    >
      <span className={`w-2 h-2 rounded-full ${sideDotColor}`} />
      <span>Place {sideLabel} Order</span>
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
    </button>
  );
}
