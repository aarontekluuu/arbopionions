"use client";

import { useState, useRef, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { bsc, polygon } from "wagmi/chains";
import { chainMeta } from "@/lib/wagmi";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const SUPPORTED_CHAINS = [
  { id: bsc.id, name: "BNB Chain", platform: "Opinion.trade", color: "terminal-warn" },
  { id: polygon.id, name: "Polygon", platform: "Polymarket", color: "terminal-accent" },
];

export function ConnectWallet() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleConnect = (connectorId: string) => {
    const connector = connectors.find((c) => c.id === connectorId || c.name.toLowerCase().includes(connectorId.toLowerCase()));
    if (connector) {
      connect({ connector });
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setIsOpen(false);
  };

  const handleSwitchChain = (chainId: number) => {
    switchChain({ chainId });
  };

  const currentChainMeta = chain ? chainMeta[chain.id] : null;

  // Get available connectors
  const injectedConnector = connectors.find((c) => c.id === "injected");
  const walletConnectConnector = connectors.find((c) => c.id === "walletConnect");

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium
          border transition-all
          ${
            isConnected
              ? "border-terminal-accent/50 bg-terminal-accent/10 text-terminal-accent hover:bg-terminal-accent/20"
              : "border-terminal-border bg-terminal-surface text-terminal-dim hover:text-terminal-text hover:border-terminal-muted"
          }
        `}
      >
        {isConnected && address ? (
          <>
            <span className={`w-2 h-2 rounded-full ${currentChainMeta ? `bg-${currentChainMeta.color}` : "bg-terminal-accent"}`} />
            <span className="font-mono">{truncateAddress(address)}</span>
            {currentChainMeta && (
              <span className="hidden sm:inline text-[10px] text-terminal-dim">
                ({currentChainMeta.name})
              </span>
            )}
          </>
        ) : (
          <>
            <svg
              className="w-3.5 h-3.5"
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
            <span className="hidden sm:inline">CONNECT</span>
          </>
        )}
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-terminal-surface border border-terminal-border rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-terminal-border bg-terminal-bg/50">
            <div className="text-xs font-medium text-terminal-text mb-1">
              MULTICHAIN WALLET
            </div>
            <div className="text-[10px] text-terminal-dim">
              BNB Chain + Polygon supported
            </div>
          </div>

          {!isConnected ? (
            <>
              {/* Connect Options */}
              <div className="p-3 space-y-2">
                {injectedConnector && (
                  <button
                    onClick={() => handleConnect("injected")}
                    disabled={isPending}
                    className="w-full px-4 py-3 text-left text-xs bg-terminal-bg border border-terminal-border rounded-lg hover:border-terminal-accent/50 hover:bg-terminal-accent/5 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-terminal-border flex items-center justify-center">
                        <svg className="w-4 h-4 text-terminal-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-terminal-text font-medium">Browser Wallet</div>
                        <div className="text-[10px] text-terminal-dim">MetaMask, Coinbase, etc.</div>
                      </div>
                    </div>
                  </button>
                )}

                {walletConnectConnector && (
                  <button
                    onClick={() => handleConnect("walletConnect")}
                    disabled={isPending}
                    className="w-full px-4 py-3 text-left text-xs bg-terminal-bg border border-terminal-border rounded-lg hover:border-terminal-accent/50 hover:bg-terminal-accent/5 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#3B99FC]/20 flex items-center justify-center">
                        <svg className="w-5 h-5 text-[#3B99FC]" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6.09 9.27c3.26-3.2 8.56-3.2 11.82 0l.39.38a.4.4 0 010 .58l-1.34 1.31a.21.21 0 01-.3 0l-.54-.53a5.94 5.94 0 00-8.24 0l-.58.57a.21.21 0 01-.3 0L5.66 10.3a.4.4 0 010-.58l.43-.45zm14.6 2.72l1.2 1.17a.4.4 0 010 .58l-5.38 5.27a.42.42 0 01-.59 0l-3.82-3.74a.1.1 0 00-.15 0l-3.82 3.74a.42.42 0 01-.59 0L2.16 13.74a.4.4 0 010-.58l1.2-1.17a.42.42 0 01.59 0l3.82 3.74a.1.1 0 00.15 0l3.82-3.74a.42.42 0 01.59 0l3.82 3.74a.1.1 0 00.15 0l3.82-3.74a.42.42 0 01.59 0z"/>
                        </svg>
                      </div>
                      <div>
                        <div className="text-terminal-text font-medium">WalletConnect</div>
                        <div className="text-[10px] text-terminal-dim">Mobile & desktop wallets</div>
                      </div>
                    </div>
                  </button>
                )}

                {isPending && (
                  <div className="flex items-center justify-center py-2 text-xs text-terminal-dim">
                    <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Connecting...
                  </div>
                )}
              </div>

              {/* Supported Chains Info */}
              <div className="px-4 py-3 border-t border-terminal-border bg-terminal-bg/30">
                <div className="text-[10px] text-terminal-dim tracking-wider uppercase mb-2">
                  SUPPORTED CHAINS
                </div>
                <div className="space-y-1.5">
                  {SUPPORTED_CHAINS.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full bg-${c.color}`} />
                        <span className="text-terminal-text">{c.name}</span>
                      </div>
                      <span className="text-terminal-dim">{c.platform}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Connected State */}
              <div className="px-4 py-3 border-b border-terminal-border">
                <div className="text-[10px] text-terminal-dim mb-1">CONNECTED</div>
                <div className="text-sm text-terminal-text font-mono">
                  {address ? truncateAddress(address) : ""}
                </div>
                {chain && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className={`w-2 h-2 rounded-full bg-${currentChainMeta?.color || "terminal-accent"}`} />
                    <span className="text-xs text-terminal-text">{chain.name}</span>
                  </div>
                )}
              </div>

              {/* Switch Chain */}
              <div className="px-4 py-3 border-b border-terminal-border">
                <div className="text-[10px] text-terminal-dim tracking-wider uppercase mb-2">
                  SWITCH CHAIN
                </div>
                <div className="flex gap-2">
                  {SUPPORTED_CHAINS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleSwitchChain(c.id)}
                      className={`flex-1 px-3 py-2 rounded text-[11px] font-medium transition-colors ${
                        chain?.id === c.id
                          ? `bg-${c.color}/20 text-${c.color} border border-${c.color}/30`
                          : "bg-terminal-bg border border-terminal-border text-terminal-dim hover:text-terminal-text hover:border-terminal-muted"
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Disconnect */}
              <button
                onClick={handleDisconnect}
                className="w-full px-4 py-3 text-left text-xs text-terminal-danger hover:bg-terminal-danger/10 transition-colors flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Disconnect
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
