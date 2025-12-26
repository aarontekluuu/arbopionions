"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function WelcomePage() {
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    // Check if user has visited before
    const hasVisited = localStorage.getItem("pm-aggregator-visited");
    if (!hasVisited) {
      setShowWelcome(true);
    }
  }, []);

  const handleGetStarted = () => {
    localStorage.setItem("pm-aggregator-visited", "true");
    window.location.href = "/arbitrage";
  };

  if (!showWelcome) {
    // Redirect to markets if already visited
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-terminal-bg">
      <div className="max-w-3xl w-full">
        {/* Terminal Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded bg-terminal-accent/20 border border-terminal-accent/50 flex items-center justify-center">
              <span className="text-terminal-accent font-bold text-xl">⚡</span>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-terminal-text">pm.aggregator</h1>
              <p className="text-sm text-terminal-dim tracking-widest">TERMINAL</p>
            </div>
          </div>
          <div className="text-terminal-accent text-sm font-mono">
            <span className="animate-pulse">&gt;</span> INITIALIZING SYSTEM...
          </div>
        </div>

        {/* Welcome Card */}
        <div className="bg-terminal-surface border border-terminal-border rounded-lg p-8 md:p-12">
          <div className="space-y-6">
            {/* Welcome Message */}
            <div>
              <h2 className="text-xl font-semibold text-terminal-text mb-2 flex items-center gap-2">
                <span className="text-terminal-accent">&gt;</span>
                WELCOME TO PM.AGGREGATOR TERMINAL
                <span className="cursor-blink" />
              </h2>
              <p className="text-sm text-terminal-dim leading-relaxed">
                Cross-platform prediction market aggregator. Compare prices across Opinion.trade,
                Kalshi, Polymarket, and Predict.fun.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-terminal-border">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-terminal-accent">●</span>
                  <span className="text-sm font-medium text-terminal-text">Live Markets</span>
                </div>
                <p className="text-xs text-terminal-dim">
                  Cross-platform price aggregation
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-terminal-accent">●</span>
                  <span className="text-sm font-medium text-terminal-text">Edge Detection</span>
                </div>
                <p className="text-xs text-terminal-dim">
                  Identify similar markets by keyword
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-terminal-accent">●</span>
                  <span className="text-sm font-medium text-terminal-text">Multi-Chain</span>
                </div>
                <p className="text-xs text-terminal-dim">
                  Multi-platform comparisons in one view
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-terminal-bg border border-terminal-border rounded-lg p-4 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-terminal-accent">4</div>
                <div className="text-[10px] text-terminal-dim uppercase tracking-wider">Platforms</div>
              </div>
              <div>
                <div className="text-lg font-bold text-terminal-accent">20s</div>
                <div className="text-[10px] text-terminal-dim uppercase tracking-wider">Refresh</div>
              </div>
              <div>
                <div className="text-lg font-bold text-terminal-accent">100%</div>
                <div className="text-[10px] text-terminal-dim uppercase tracking-wider">Focus</div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                onClick={handleGetStarted}
                className="flex-1 px-6 py-4 bg-terminal-accent text-terminal-bg font-medium rounded-lg hover:bg-terminal-accent/90 transition-colors flex items-center justify-center gap-2"
              >
                <span>OPEN AGGREGATOR</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
              <Link
                href="/arb"
                className="flex-1 px-6 py-4 bg-terminal-border text-terminal-text font-medium rounded-lg hover:bg-terminal-muted transition-colors flex items-center justify-center gap-2"
              >
                <span>OPEN ARB</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </Link>
            </div>

            {/* Footer Note */}
            <div className="pt-4 border-t border-terminal-border text-center">
              <p className="text-[10px] text-terminal-dim">
                v0.1.0 • Read-only markets • Trading coming soon
              </p>
            </div>
          </div>
        </div>

        {/* Skip Link */}
        <div className="mt-6 text-center">
          <button
            onClick={handleGetStarted}
            className="text-xs text-terminal-dim hover:text-terminal-text transition-colors"
          >
            Skip welcome screen
          </button>
        </div>
      </div>
    </div>
  );
}

