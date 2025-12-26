import type { Metadata } from "next";
import "./globals.css";
import "./wallet-fix";
import { WagmiProvider } from "@/providers/WagmiProvider";
import { AppProvider } from "./context";
import { NavBar } from "@/components/NavBar";
import { StatusIndicator } from "@/components/StatusIndicator";

export const metadata: Metadata = {
  title: "pm.aggregator terminal",
  description: "Cross-platform prediction market aggregator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-terminal-bg text-terminal-text font-mono antialiased">
        <WagmiProvider>
          <AppProvider>
            <div className="flex flex-col min-h-screen">
              <NavBar />
              <main className="flex-1 p-4 md:p-6">{children}</main>
              <footer className="border-t border-terminal-border px-4 py-3 text-xs text-terminal-dim">
                <div className="flex items-center justify-between max-w-7xl mx-auto">
                  <span>pm.aggregator terminal v0.1.0</span>
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-terminal-accent animate-pulse" />
                    SYSTEM ONLINE
                  </span>
                </div>
              </footer>
            </div>
            <StatusIndicator />
          </AppProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
