import { NextResponse } from "next/server";
import { fetchExternalBundles } from "@/lib/externalMarkets";

export async function GET(): Promise<NextResponse> {
  try {
    const bundles = await fetchExternalBundles(20);
    return NextResponse.json({
      success: true,
      bundles: bundles.map((bundle) => ({
        stats: bundle.stats,
        sampleMarket: bundle.markets[0] || null,
      })),
      timestamp: Date.now(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: message, timestamp: Date.now() },
      { status: 500 }
    );
  }
}
