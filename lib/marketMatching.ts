/**
 * Market matching system for cross-platform aggregation
 *
 * Matches equivalent markets across different prediction market platforms
 * using fuzzy string matching, normalization, and similarity scoring.
 */

import type { Platform } from "./types";
import type { MarketMatch } from "./types";

// --- Types ---

export interface MarketData {
  platform: Platform;
  marketId: string | number;
  marketTitle: string;
  marketUrl: string;
  yesPrice: number;
  noPrice: number;
  volume24h?: number;
  metadata?: Record<string, any>; // Platform-specific data
}

// --- Configuration ---

const MIN_SIMILARITY_THRESHOLD = 0.7; // Minimum similarity score to consider a match
const TITLE_NORMALIZATION_REGEX = /[^\w\s]/g; // Remove special characters
const COMMON_WORDS = new Set([
  "will", "the", "be", "to", "of", "and", "a", "in", "is", "it", "you", "that",
  "he", "was", "for", "on", "are", "as", "with", "his", "they", "i", "at",
  "have", "this", "from", "or", "one", "had", "by", "word", "but", "not",
  "what", "all", "were", "we", "when", "your", "can", "said", "there", "each",
  "which", "she", "do", "how", "their", "if", "up", "out", "many", "then",
  "them", "these", "so", "some", "her", "would", "make", "like", "into", "him",
  "has", "two", "more", "very", "after", "words", "long", "than", "first",
  "been", "call", "who", "oil", "sit", "now", "find", "down", "day", "did",
  "get", "come", "made", "may", "part"
]);

// --- Helper Functions ---

/**
 * Normalize market title for comparison
 * - Convert to lowercase
 * - Remove special characters
 * - Remove extra whitespace
 * - Remove common words (optional)
 */
export function normalizeMarketTitle(title: string, removeCommonWords: boolean = false): string {
  let normalized = title
    .toLowerCase()
    .replace(TITLE_NORMALIZATION_REGEX, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (removeCommonWords) {
    const words = normalized.split(" ");
    normalized = words
      .filter(word => !COMMON_WORDS.has(word) && word.length > 2)
      .join(" ");
  }

  return normalized;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity score between two strings (0-1)
 * Uses Levenshtein distance normalized by max length
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeMarketTitle(str1);
  const normalized2 = normalizeMarketTitle(str2);

  if (normalized1 === normalized2) {
    return 1.0;
  }

  const maxLen = Math.max(normalized1.length, normalized2.length);
  if (maxLen === 0) {
    return 0;
  }

  const distance = levenshteinDistance(normalized1, normalized2);
  return 1 - distance / maxLen;
}

/**
 * Extract keywords from market title
 */
export function extractKeywords(title: string): string[] {
  const normalized = normalizeMarketTitle(title, true);
  const words = normalized.split(" ").filter(word => word.length > 2);
  
  // Remove duplicates and sort
  return [...new Set(words)].sort();
}

/**
 * Check if two market titles refer to the same event
 * Uses multiple heuristics:
 * - Exact match (after normalization)
 * - High similarity score
 * - Keyword overlap
 */
export function calculateMarketSimilarity(
  market1: MarketData,
  market2: MarketData
): number {
  const title1 = market1.marketTitle;
  const title2 = market2.marketTitle;

  // Normalize titles
  const norm1 = normalizeMarketTitle(title1);
  const norm2 = normalizeMarketTitle(title2);

  // Exact match after normalization
  if (norm1 === norm2) {
    return 1.0;
  }

  // Calculate string similarity
  const stringSimilarity = calculateStringSimilarity(title1, title2);

  // Calculate keyword overlap
  const keywords1 = new Set(extractKeywords(title1));
  const keywords2 = new Set(extractKeywords(title2));
  
  const intersection = new Set([...keywords1].filter(k => keywords2.has(k)));
  const union = new Set([...keywords1, ...keywords2]);
  
  const keywordOverlap = union.size > 0 ? intersection.size / union.size : 0;

  // Weighted combination: 70% string similarity, 30% keyword overlap
  const combinedSimilarity = stringSimilarity * 0.7 + keywordOverlap * 0.3;

  return combinedSimilarity;
}

/**
 * Match markets across platforms
 * 
 * Groups markets that likely refer to the same event across different platforms.
 * Returns matches with similarity scores above the threshold.
 * 
 * @param markets - Array of markets from different platforms
 * @param minSimilarity - Minimum similarity threshold (default: MIN_SIMILARITY_THRESHOLD)
 * @returns Array of MarketMatch objects
 */
export function matchMarketsAcrossPlatforms(
  markets: MarketData[],
  minSimilarity: number = MIN_SIMILARITY_THRESHOLD
): MarketMatch[] {
  const matches: MarketMatch[] = [];
  const processed = new Set<string>();

  // Group markets by platform
  const marketsByPlatform = new Map<Platform, MarketData[]>();
  for (const market of markets) {
    if (!marketsByPlatform.has(market.platform)) {
      marketsByPlatform.set(market.platform, []);
    }
    marketsByPlatform.get(market.platform)!.push(market);
  }

  // Compare markets across different platforms
  const platforms = Array.from(marketsByPlatform.keys());

  for (let i = 0; i < platforms.length; i++) {
    for (let j = i + 1; j < platforms.length; j++) {
      const platform1 = platforms[i];
      const platform2 = platforms[j];
      const markets1 = marketsByPlatform.get(platform1)!;
      const markets2 = marketsByPlatform.get(platform2)!;

      // Compare each market from platform1 with each market from platform2
      for (const market1 of markets1) {
        for (const market2 of markets2) {
          const key1 = `${market1.platform}-${market1.marketId}`;
          const key2 = `${market2.platform}-${market2.marketId}`;
          const matchKey = [key1, key2].sort().join("|");

          // Skip if already processed
          if (processed.has(matchKey)) {
            continue;
          }

          const similarity = calculateMarketSimilarity(market1, market2);

          if (similarity >= minSimilarity) {
            processed.add(matchKey);

            // Normalize title for the match
            const normalizedTitle = normalizeMarketTitle(market1.marketTitle);

            matches.push({
              markets: [
                {
                  platform: market1.platform,
                  marketId: market1.marketId,
                  marketTitle: market1.marketTitle,
                  marketUrl: market1.marketUrl,
                  yesPrice: market1.yesPrice,
                  noPrice: market1.noPrice,
                  volume24h: market1.volume24h,
                },
                {
                  platform: market2.platform,
                  marketId: market2.marketId,
                  marketTitle: market2.marketTitle,
                  marketUrl: market2.marketUrl,
                  yesPrice: market2.yesPrice,
                  noPrice: market2.noPrice,
                  volume24h: market2.volume24h,
                },
              ],
              similarity,
              normalizedTitle,
            });
          }
        }
      }
    }
  }

  // Sort by similarity (highest first)
  matches.sort((a, b) => b.similarity - a.similarity);

  return matches;
}

/**
 * Find best match for a market across other platforms
 */
export function findBestMatch(
  targetMarket: MarketData,
  candidateMarkets: MarketData[]
): MarketMatch | null {
  let bestMatch: MarketMatch | null = null;
  let bestSimilarity = 0;

  for (const candidate of candidateMarkets) {
    // Skip same platform
    if (candidate.platform === targetMarket.platform) {
      continue;
    }

    const similarity = calculateMarketSimilarity(targetMarket, candidate);

    if (similarity > bestSimilarity && similarity >= MIN_SIMILARITY_THRESHOLD) {
      bestSimilarity = similarity;
      const normalizedTitle = normalizeMarketTitle(targetMarket.marketTitle);

      bestMatch = {
        markets: [
          {
            platform: targetMarket.platform,
            marketId: targetMarket.marketId,
            marketTitle: targetMarket.marketTitle,
            marketUrl: targetMarket.marketUrl,
            yesPrice: targetMarket.yesPrice,
            noPrice: targetMarket.noPrice,
            volume24h: targetMarket.volume24h,
          },
          {
            platform: candidate.platform,
            marketId: candidate.marketId,
            marketTitle: candidate.marketTitle,
            marketUrl: candidate.marketUrl,
            yesPrice: candidate.yesPrice,
            noPrice: candidate.noPrice,
            volume24h: candidate.volume24h,
          },
        ],
        similarity,
        normalizedTitle,
      };
    }
  }

  return bestMatch;
}







