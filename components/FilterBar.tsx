"use client";

import type { FilterState } from "@/types";

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onRefresh: () => void;
  lastUpdated: string | null;
  isRefetching: boolean;
}

export function FilterBar({
  filters,
  onFiltersChange,
  onRefresh,
  lastUpdated,
  isRefetching,
}: FilterBarProps) {
  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4 mb-6">
      <div className="flex flex-wrap items-center gap-4">
        {/* Limit Selector */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-terminal-dim tracking-wider uppercase">
            Limit
          </label>
          <div className="flex rounded overflow-hidden border border-terminal-border">
            {[20, 40, 60, 100].map((val) => (
              <button
                key={val}
                onClick={() =>
                  onFiltersChange({ ...filters, limit: val as 20 | 40 | 60 | 100 })
                }
                className={`
                  px-3 py-1.5 text-xs font-medium transition-colors
                  ${
                    filters.limit === val
                      ? "bg-terminal-accent text-terminal-bg"
                      : "bg-terminal-bg text-terminal-dim hover:text-terminal-text hover:bg-terminal-border"
                  }
                `}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        {/* Min Edge Selector */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-terminal-dim tracking-wider uppercase">
            Min Edge
          </label>
          <select
            value={filters.minEdge}
            onChange={(e) =>
              onFiltersChange({ ...filters, minEdge: Number(e.target.value) })
            }
            className="bg-terminal-bg border border-terminal-border rounded px-3 py-1.5 text-xs text-terminal-text focus:outline-none focus:border-terminal-accent cursor-pointer"
          >
            {[0, 0.5, 1, 2, 3, 4, 5].map((val) => (
              <option key={val} value={val}>
                {val}%
              </option>
            ))}
          </select>
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-6 w-px bg-terminal-border" />

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefetching}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-medium
            transition-all
            ${
              isRefetching
                ? "border-terminal-accent/50 text-terminal-accent bg-terminal-accent/10 cursor-wait"
                : "border-terminal-border text-terminal-dim hover:text-terminal-text hover:border-terminal-muted hover:bg-terminal-border"
            }
          `}
        >
          <svg
            className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {isRefetching ? "REFRESHING..." : "REFRESH"}
        </button>

        {/* Auto-refresh Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              onFiltersChange({ ...filters, autoRefresh: !filters.autoRefresh })
            }
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all
              ${
                filters.autoRefresh
                  ? "bg-terminal-accent/20 text-terminal-accent border border-terminal-accent/30"
                  : "bg-terminal-bg text-terminal-dim border border-terminal-border hover:text-terminal-text"
              }
            `}
          >
            <span
              className={`w-2 h-2 rounded-full ${filters.autoRefresh ? "bg-terminal-accent animate-pulse" : "bg-terminal-muted"}`}
            />
            AUTO-REFRESH {filters.autoRefresh ? "ON" : "OFF"}
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Last Updated */}
        {lastUpdated && (
          <div className="text-[10px] text-terminal-dim flex items-center gap-2">
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>LAST UPDATE: {formatTimestamp(lastUpdated)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

