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
          accent: "#22c55e",
          warn: "#eab308",
          danger: "#ef4444",
          cyan: "#06b6d4",
          purple: "#a855f7",
          magenta: "#ec4899",
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
