/**
 * Wallet injection fix
 * Prevents "Cannot redefine property: ethereum" errors
 * when multiple wallet providers try to inject window.ethereum
 */

if (typeof window !== "undefined") {
  // Store original ethereum if it exists
  const originalEthereum = (window as any).ethereum;

  // Prevent redefinition errors by making property configurable
  // This must run before any wallet extensions try to inject
  if (originalEthereum) {
    try {
      // Try to delete and redefine if possible
      const descriptor = Object.getOwnPropertyDescriptor(window, "ethereum");
      if (descriptor && !descriptor.configurable) {
        // If not configurable, we can't change it - just use what's there
        // Exit early by not executing the rest of the code
      } else {
        // Delete existing property if configurable
        if (descriptor?.configurable) {
          delete (window as any).ethereum;
        }
        
        // Redefine as configurable
        Object.defineProperty(window, "ethereum", {
          value: originalEthereum,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
    } catch (e) {
      // Silently ignore errors - some wallets may have already set it as non-configurable
      // This is expected behavior when multiple wallets are installed
    }
  } else {
    // If ethereum doesn't exist yet, define it as configurable so wallets can inject
    try {
      Object.defineProperty(window, "ethereum", {
        value: undefined,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch (e) {
      // Ignore - property may have been set by another script
    }
  }
}


