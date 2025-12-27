import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, addSecurityHeaders } from "@/lib/security";

/**
 * Test endpoint to directly call Opinion Price API and see raw response
 * GET /api/debug/price-api?tokenId=91263182015381827009811905354009393225622653324877176380977546025702641459008
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
    const tokenId = searchParams.get("tokenId") || "91263182015381827009811905354009393225622653324877176380977546025702641459008";

    const url = new URL(`${baseUrl}/token/latest-price`);
    url.searchParams.set("token_id", tokenId);

    console.log(`[DEBUG] Calling Opinion Price API: ${url.toString()}`);

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
          tokenId,
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
            hasData: !!parsedData?.data,
            hasResult: !!parsedData?.result,
            errno: parsedData?.errno,
            errmsg: parsedData?.errmsg,
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








