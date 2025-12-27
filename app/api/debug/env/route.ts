import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, addSecurityHeaders } from "@/lib/security";

/**
 * GET /api/debug/env
 * 
 * Debug endpoint to check environment variable configuration.
 * Only shows whether variables are set, not their values (for security).
 * 
 * This endpoint should be removed or protected in production.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Only allow in development or with a secret key
  const debugKey = request.nextUrl.searchParams.get("key");
  const isDevelopment = process.env.NODE_ENV === "development";
  
  // In production, require a debug key
  if (!isDevelopment && debugKey !== process.env.DEBUG_SECRET_KEY) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: getCorsHeaders() }
    );
  }

  const envInfo = {
    environment: {
      NODE_ENV: process.env.NODE_ENV || "not set",
      VERCEL_ENV: process.env.VERCEL_ENV || "not set",
      VERCEL: process.env.VERCEL || "not set",
    },
    opinionApi: {
      OPINION_API_KEY: {
        set: !!process.env.OPINION_API_KEY,
        length: process.env.OPINION_API_KEY?.length || 0,
        preview: process.env.OPINION_API_KEY 
          ? `${process.env.OPINION_API_KEY.substring(0, 4)}...${process.env.OPINION_API_KEY.substring(process.env.OPINION_API_KEY.length - 4)}`
          : "not set",
      },
      OPINION_OPENAPI_BASE_URL: {
        set: !!process.env.OPINION_OPENAPI_BASE_URL,
        length: process.env.OPINION_OPENAPI_BASE_URL?.length || 0,
        value: process.env.OPINION_OPENAPI_BASE_URL || "not set",
      },
    },
    configured: !!(
      process.env.OPINION_API_KEY && process.env.OPINION_OPENAPI_BASE_URL
    ),
  };

  const response = NextResponse.json(envInfo, {
    headers: getCorsHeaders(),
  });
  
  return addSecurityHeaders(response);
}








