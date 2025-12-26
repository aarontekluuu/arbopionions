const PLATFORMS = [
  {
    name: "Opinion.trade",
    description: "Prediction market platform with real-time pricing",
    status: "LIVE",
    textClass: "text-terminal-accent",
    badgeClass: "bg-terminal-accent/20 text-terminal-accent",
    borderClass: "border-terminal-accent/50",
    dotClass: "text-terminal-accent",
    features: ["Real-time prices", "Edge detection", "Auto-refresh"],
  },
  {
    name: "Polymarket",
    description: "Decentralized prediction market on Polygon",
    status: "LIVE",
    textClass: "text-terminal-purple",
    badgeClass: "bg-terminal-purple/20 text-terminal-purple",
    borderClass: "border-terminal-border",
    dotClass: "text-terminal-purple",
    features: ["High liquidity", "Crypto settlement", "Wide market selection"],
  },
  {
    name: "Predict.fun",
    description: "Social prediction markets with fast settlement",
    status: "LIVE",
    textClass: "text-terminal-magenta",
    badgeClass: "bg-terminal-magenta/20 text-terminal-magenta",
    borderClass: "border-terminal-border",
    dotClass: "text-terminal-magenta",
    features: ["Creator markets", "Fast resolution", "Social discovery"],
  },
  {
    name: "Kalshi",
    description: "CFTC-regulated US prediction market",
    status: "WIP",
    textClass: "text-terminal-cyan",
    badgeClass: "bg-terminal-cyan/20 text-terminal-cyan",
    borderClass: "border-terminal-border",
    dotClass: "text-terminal-cyan",
    features: ["USD settlement", "Regulated", "Event contracts"],
  },
];

export default function ArbitragePage() {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-terminal-text flex items-center gap-2">
          <span className="text-terminal-cyan">&gt;</span>
          CROSS-PLATFORM ARBITRAGE
          <span className="cursor-blink" />
        </h1>
        <p className="text-sm text-terminal-dim mt-1">
          Detect and execute arbitrage opportunities across Opinion.trade, Polymarket, Predict.fun, and Kalshi
        </p>
      </div>

      {/* Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {PLATFORMS.map((platform) => (
          <div
            key={platform.name}
            className={`bg-terminal-surface border rounded-lg overflow-hidden ${
              platform.status === "LIVE"
                ? platform.borderClass
                : "border-terminal-border"
            }`}
          >
            <div className="p-6 border-b border-terminal-border">
              <div className="flex items-center justify-between mb-2">
                <h3 className={`text-lg font-semibold ${platform.textClass}`}>{platform.name}</h3>
                <span
                  className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                    platform.status === "LIVE"
                      ? "bg-terminal-accent/20 text-terminal-accent"
                      : platform.badgeClass
                  }`}
                >
                  {platform.status}
                </span>
              </div>
              <p className="text-sm text-terminal-dim">{platform.description}</p>
            </div>
            <div className="p-6">
              <div className="text-[10px] text-terminal-dim tracking-wider uppercase mb-3">
                Features
              </div>
              <ul className="space-y-2">
                {platform.features.map((feature, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-sm text-terminal-text"
                  >
                    <span className={platform.dotClass}>→</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Arbitrage Module Info */}
      <div className="bg-terminal-surface border border-terminal-border rounded-lg p-8">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-terminal-cyan/10 border border-terminal-cyan/30 flex items-center justify-center mb-6">
            <svg
              className="w-8 h-8 text-terminal-cyan"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </div>

          <h2 className="text-lg font-medium text-terminal-text mb-2">
            CROSS-PLATFORM ARBITRAGE
          </h2>
          <p className="text-sm text-terminal-dim max-w-lg mb-6">
            Detect price discrepancies between Opinion.trade, Polymarket, Predict.fun, and Kalshi for the same
            events. Execute complementary trades to lock in risk-free profits.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <div className="px-4 py-2 bg-terminal-bg border border-terminal-border rounded text-xs text-terminal-dim">
              <span className="text-terminal-accent">●</span> Opinion.trade prices
            </div>
            <div className="px-4 py-2 bg-terminal-bg border border-terminal-border rounded text-xs text-terminal-dim">
              <span className="text-terminal-purple">●</span> Polymarket prices
            </div>
            <div className="px-4 py-2 bg-terminal-bg border border-terminal-border rounded text-xs text-terminal-dim">
              <span className="text-terminal-magenta">●</span> Predict.fun prices
            </div>
            <div className="px-4 py-2 bg-terminal-bg border border-terminal-border rounded text-xs text-terminal-dim">
              <span className="text-terminal-cyan">●</span> Kalshi prices (WIP)
            </div>
          </div>

          {/* How it works */}
          <div className="w-full max-w-2xl bg-terminal-bg border border-terminal-border rounded-lg p-6 text-left">
            <h3 className="text-sm font-medium text-terminal-text mb-4 flex items-center gap-2">
              <span className="text-terminal-accent">&gt;</span>
              HOW IT WORKS
            </h3>
            <div className="space-y-3 text-xs text-terminal-dim">
              <div className="flex gap-3">
                <span className="text-terminal-accent font-mono">01</span>
                <span>
                  Scan matching markets across Opinion.trade, Polymarket, Predict.fun, and Kalshi in real-time
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-terminal-accent font-mono">02</span>
                <span>
                  Identify when YES on Platform A + NO on Platform B {"<"} $1.00
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-terminal-accent font-mono">03</span>
                <span>
                  Calculate potential profit after fees and slippage
                </span>
              </div>
              <div className="flex gap-3">
                <span className="text-terminal-accent font-mono">04</span>
                <span>
                  Execute simultaneous trades to lock in arbitrage
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 px-4 py-2 bg-terminal-warn/10 border border-terminal-warn/30 rounded text-xs text-terminal-warn">
            STATUS: KALSHI INTEGRATION WIP (API KEY REQUIRED)
          </div>
        </div>
      </div>
    </div>
  );
}
