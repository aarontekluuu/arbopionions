/**
 * Wallet injection fix
 * Prevents "Cannot redefine property: ethereum" errors
 * when multiple wallet providers try to inject window.ethereum
 */

if (typeof window !== "undefined") {
  // Store original ethereum if it exists
  const originalEthereum = (window as any).ethereum;

  // Prevent redefinition errors by making property configurable
  if (originalEthereum) {
    try {
      Object.defineProperty(window, "ethereum", {
        value: originalEthereum,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch (e) {
      // Ignore errors - some wallets may have already set it as non-configurable
      console.warn("[Wallet Fix] Could not reconfigure ethereum property:", e);
    }
  }
}

