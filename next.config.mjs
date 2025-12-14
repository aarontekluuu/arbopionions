/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use empty turbopack config to enable webpack mode
  turbopack: {},
  webpack: (config, { isServer }) => {
    // Fix for WalletConnect and related packages
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        encoding: false,
      };
    }
    
    return config;
  },
};

export default nextConfig;
