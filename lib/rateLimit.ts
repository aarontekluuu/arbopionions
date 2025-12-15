/**
 * Simple in-memory rate limiter
 * 
 * For production, consider using Redis-based rate limiting (e.g., Upstash)
 * This implementation is suitable for MVP and single-instance deployments
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    private maxRequests: number,
    private windowMs: number,
    private cleanupIntervalMs: number = 60_000 // Clean up every minute
  ) {
    // Clean up expired entries periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);
  }

  /**
   * Check if a request should be allowed
   * @param identifier - IP address or user identifier
   * @returns true if allowed, false if rate limited
   */
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const entry = this.store.get(identifier);

    if (!entry || now >= entry.resetAt) {
      // Create new window
      this.store.set(identifier, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Get remaining requests for an identifier
   */
  getRemaining(identifier: string): number {
    const entry = this.store.get(identifier);
    if (!entry || Date.now() >= entry.resetAt) {
      return this.maxRequests;
    }
    return Math.max(0, this.maxRequests - entry.count);
  }

  /**
   * Get reset time for an identifier
   */
  getResetTime(identifier: string): number {
    const entry = this.store.get(identifier);
    if (!entry) {
      return Date.now() + this.windowMs;
    }
    return entry.resetAt;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear all entries (useful for testing)
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Rate limiter: 60 requests per 15 seconds per IP
// Increased to handle auto-refresh (polls every 15s) + user interactions
export const apiRateLimiter = new RateLimiter(60, 15_000);

import type { NextRequest } from "next/server";

/**
 * Get client identifier from request
 */
export function getClientIdentifier(request: NextRequest): string {
  // Try to get IP from various headers (Vercel, Cloudflare, etc.)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Take first IP in chain
    return forwarded.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback for serverless environments
  return "unknown";
}

