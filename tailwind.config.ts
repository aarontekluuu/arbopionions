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
          surface: "#f5f1e8",
          border: "#e1d9c8",
          muted: "#cfc7b8",
          text: "#1a1a1a",
          dim: "#6b665c",
          primary: "#2d5016",
          accent: "#6b46c1",
          warn: "#f4d35e",
          danger: "#ef4444",
          cyan: "#2d5016",
          purple: "#6b46c1",
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
