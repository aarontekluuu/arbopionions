export type MarketThemeKey =
  | "trump"
  | "politics"
  | "crypto"
  | "macro"
  | "tech"
  | "sports"
  | "entertainment"
  | "climate"
  | "health"
  | "other";

export interface MarketTheme {
  key: MarketThemeKey;
  label: string;
  description: string;
  accentClass: string;
  borderClass: string;
  chipClass: string;
  keywords: string[];
}

export const marketThemes: MarketTheme[] = [
  {
    key: "trump",
    label: "Trump",
    description: "Markets tied to Donald Trump, his campaign, or outcomes.",
    accentClass: "text-terminal-warn",
    borderClass: "border-terminal-warn/40",
    chipClass: "bg-terminal-warn/15 text-terminal-warn",
    keywords: ["trump", "donald", "maga"],
  },
  {
    key: "politics",
    label: "Politics",
    description: "Elections, policy, and government outcomes.",
    accentClass: "text-terminal-accent",
    borderClass: "border-terminal-accent/40",
    chipClass: "bg-terminal-accent/15 text-terminal-accent",
    keywords: [
      "election",
      "president",
      "whitehouse",
      "white house",
      "congress",
      "senate",
      "house",
      "biden",
      "democrat",
      "republican",
      "gop",
      "campaign",
      "governor",
      "primary",
    ],
  },
  {
    key: "crypto",
    label: "Crypto",
    description: "Tokens, blockchains, and digital asset markets.",
    accentClass: "text-terminal-cyan",
    borderClass: "border-terminal-cyan/40",
    chipClass: "bg-terminal-cyan/15 text-terminal-cyan",
    keywords: [
      "bitcoin",
      "btc",
      "ethereum",
      "eth",
      "solana",
      "doge",
      "crypto",
      "token",
      "defi",
      "stablecoin",
    ],
  },
  {
    key: "macro",
    label: "Macro",
    description: "Rates, inflation, growth, and the economy.",
    accentClass: "text-terminal-warn",
    borderClass: "border-terminal-warn/30",
    chipClass: "bg-terminal-warn/10 text-terminal-warn",
    keywords: [
      "fed",
      "rate",
      "inflation",
      "cpi",
      "gdp",
      "recession",
      "jobs",
      "unemployment",
      "economy",
    ],
  },
  {
    key: "tech",
    label: "Tech & AI",
    description: "AI, software, and major tech companies.",
    accentClass: "text-terminal-accent",
    borderClass: "border-terminal-accent/40",
    chipClass: "bg-terminal-accent/15 text-terminal-accent",
    keywords: [
      "ai",
      "openai",
      "chatgpt",
      "nvidia",
      "apple",
      "tesla",
      "microsoft",
      "google",
      "meta",
      "amazon",
      "chip",
    ],
  },
  {
    key: "sports",
    label: "Sports",
    description: "Leagues, championships, and major sporting events.",
    accentClass: "text-terminal-cyan",
    borderClass: "border-terminal-cyan/30",
    chipClass: "bg-terminal-cyan/10 text-terminal-cyan",
    keywords: [
      "nfl",
      "nba",
      "mlb",
      "nhl",
      "soccer",
      "football",
      "fifa",
      "uefa",
      "world cup",
      "super bowl",
      "olympic",
      "championship",
    ],
  },
  {
    key: "entertainment",
    label: "Entertainment",
    description: "Movies, music, and culture outcomes.",
    accentClass: "text-terminal-accent",
    borderClass: "border-terminal-accent/30",
    chipClass: "bg-terminal-accent/10 text-terminal-accent",
    keywords: [
      "oscar",
      "grammy",
      "emmy",
      "movie",
      "film",
      "music",
      "album",
      "tour",
      "box office",
    ],
  },
  {
    key: "climate",
    label: "Climate",
    description: "Weather, climate, and environmental markets.",
    accentClass: "text-terminal-cyan",
    borderClass: "border-terminal-cyan/30",
    chipClass: "bg-terminal-cyan/10 text-terminal-cyan",
    keywords: [
      "hurricane",
      "climate",
      "weather",
      "temperature",
      "rain",
      "snow",
      "el nino",
      "la nina",
    ],
  },
  {
    key: "health",
    label: "Health",
    description: "Public health, medicine, and biotech outcomes.",
    accentClass: "text-terminal-warn",
    borderClass: "border-terminal-warn/30",
    chipClass: "bg-terminal-warn/10 text-terminal-warn",
    keywords: ["covid", "flu", "vaccine", "health", "disease", "cancer"],
  },
  {
    key: "other",
    label: "Other",
    description: "Everything else across markets.",
    accentClass: "text-terminal-text",
    borderClass: "border-terminal-border",
    chipClass: "bg-terminal-border/40 text-terminal-text",
    keywords: [],
  },
];

function tokenizeTitle(title: string): string[] {
  return title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function matchesKeyword(title: string, tokens: Set<string>, keyword: string): boolean {
  const normalized = keyword.toLowerCase();
  if (normalized.includes(" ")) {
    return title.includes(normalized);
  }
  return tokens.has(normalized);
}

export function classifyMarketTheme(title: string): MarketThemeKey {
  const normalizedTitle = title.toLowerCase();
  const tokens = new Set(tokenizeTitle(title));

  for (const theme of marketThemes) {
    if (theme.key === "other") {
      continue;
    }
    if (theme.keywords.some((keyword) => matchesKeyword(normalizedTitle, tokens, keyword))) {
      return theme.key;
    }
  }

  return "other";
}
