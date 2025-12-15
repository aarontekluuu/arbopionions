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
  // Security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), camera=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // 'unsafe-eval' needed for WalletConnect
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Allow Google Fonts stylesheet
              "img-src 'self' data: https:",
              "font-src 'self' data: https://fonts.gstatic.com", // Allow Google Fonts
              "connect-src 'self' https://*.walletconnect.com https://*.walletconnect.org https://api.web3modal.org wss://*.walletconnect.com wss://*.walletconnect.org https://*.vercel.app https://proxy.opinion.trade", // Allow WalletConnect API
              "frame-src 'self' https://*.walletconnect.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
