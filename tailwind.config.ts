import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: "#0a0a0a",
          surface: "#121212",
          border: "#1e1e1e",
          muted: "#404040",
          text: "#e4e4e7",
          dim: "#71717a",
          accent: "#d4a574",
          warn: "#eab308",
          danger: "#ef4444",
          cyan: "#06b6d4",
          purple: "#a855f7",
          green: "#22c55e",
          blue: "#3b82f6",
          orange: "#f97316",
          beige: "#d4a574",
        },
      },
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "SF Mono",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
