/**
 * Security utilities: CORS, error handling, etc.
 */

import type { NextResponse } from "next/server";

/**
 * Get CORS headers
 */
export function getCorsHeaders(): Record<string, string> {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://pm.ag";
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400", // 24 hours
  };
}

/**
 * Sanitize error message for production
 * Never expose stack traces or internal details
 */
export function sanitizeError(error: unknown): string {
  if (process.env.NODE_ENV === "production") {
    return "An error occurred. Please try again later.";
  }

  // In development, show more details
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

/**
 * Add security headers to response
 */
export function addSecurityHeaders<T>(response: NextResponse<T>): NextResponse<T> {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  };

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
}
