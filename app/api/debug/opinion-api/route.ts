import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, addSecurityHeaders } from "@/lib/security";

/**
 * Test endpoint to directly call Opinion API and see raw response
 * GET /api/debug/opinion-api?limit=20
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.OPINION_API_KEY;
    const baseUrl = process.env.OPINION_OPENAPI_BASE_URL;

    if (!apiKey || !baseUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "API not configured",
          config: {
            hasApiKey: !!apiKey,
            hasBaseUrl: !!baseUrl,
          },
        },
        { status: 500 }
      );
    }

    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const url = new URL(`${baseUrl}/market`);
    url.searchParams.set("status", "activated");
    url.searchParams.set("sortBy", "5");
    url.searchParams.set("limit", String(limit));

    console.log(`[DEBUG] Calling Opinion API: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        apikey: apiKey,
        Accept: "application/json",
      },
    });

    const status = response.status;
    const statusText = response.statusText;
    const responseText = await response.text();

    let parsedData: any = null;
    try {
      parsedData = JSON.parse(responseText);
    } catch (e) {
      // Not JSON
    }

    return NextResponse.json(
      {
        success: true,
        request: {
          url: url.toString(),
          method: "GET",
          headers: {
            apikey: apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : "missing",
            Accept: "application/json",
          },
        },
        response: {
          status,
          statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          body: {
            raw: responseText.substring(0, 2000), // First 2000 chars
            parsed: parsedData,
            isJson: !!parsedData,
            dataLength: parsedData?.data?.length || 0,
          },
        },
        timestamp: Date.now(),
      },
      { headers: getCorsHeaders() }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

