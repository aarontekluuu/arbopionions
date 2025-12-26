"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectWallet } from "./ConnectWallet";

const navItems = [
  { href: "/", label: "MARKET AGGREGATE", shortcut: "A" },
  { href: "/arbitrage", label: "CROSS-PLATFORM ARB", shortcut: "X" },
  { href: "/portfolio", label: "PORTFOLIO", shortcut: "P" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-terminal-border bg-terminal-surface/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded bg-terminal-accent/20 border border-terminal-accent/50 flex items-center justify-center group-hover:bg-terminal-accent/30 transition-colors">
              <span className="text-terminal-accent font-bold text-sm">⚡</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-semibold tracking-wider text-terminal-text">
                pm.ag
              </h1>
              <p className="text-[10px] text-terminal-dim tracking-widest">
                TERMINAL
              </p>
            </div>
          </Link>

          {/* Navigation Pills */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    relative px-3 py-2 text-[11px] font-medium tracking-wider transition-all
                    ${
                      isActive
                        ? "text-terminal-bg bg-terminal-accent"
                        : "text-terminal-dim hover:text-terminal-text hover:bg-terminal-border"
                    }
                    rounded
                  `}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`
                      hidden md:inline text-[9px] px-1 py-0.5 rounded
                      ${
                        isActive
                          ? "bg-terminal-bg/20 text-terminal-bg"
                          : "bg-terminal-muted/30 text-terminal-dim"
                      }
                    `}
                    >
                      {item.shortcut}
                    </span>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Connect Wallet */}
          <ConnectWallet />
        </div>
      </div>
    </header>
  );
}
