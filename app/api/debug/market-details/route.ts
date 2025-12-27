import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, addSecurityHeaders } from "@/lib/security";
import { fetchMarketDetails } from "@/lib/opinionClient";

/**
 * Test endpoint to check market details endpoint and see if it returns topicId
 * GET /api/debug/market-details?marketId=1463
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const marketId = parseInt(searchParams.get("marketId") || "1463", 10);

    console.log(`[DEBUG] Fetching market details for marketId: ${marketId}`);

    const details = await fetchMarketDetails(marketId);

    if (!details) {
      return NextResponse.json(
        {
          success: false,
          error: "Market details not found",
          marketId,
        },
        { status: 404, headers: getCorsHeaders() }
      );
    }

    // Extract all possible topicId fields
    const topicIdFields = {
      topic_id: (details as any).topic_id,
      topicId: (details as any).topicId,
      topic_id_number: (details as any).topic_id_number,
      topicIdNumber: (details as any).topicIdNumber,
      topic_id_string: (details as any).topic_id_string,
      topicIdString: (details as any).topicIdString,
      topic: (details as any).topic,
      questionId: details.questionId,
      marketId: details.marketId,
    };

    return NextResponse.json(
      {
        success: true,
        marketId,
        details: {
          marketId: details.marketId,
          marketTitle: details.marketTitle,
          allKeys: Object.keys(details),
          topicIdFields,
          fullResponse: details,
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








