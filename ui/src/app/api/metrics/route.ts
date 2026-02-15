import { NextResponse } from "next/server";

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:8080";

export async function GET() {
  try {
    // Metrics endpoint is public (no admin token needed)
    const response = await fetch(`${GATEWAY_URL}/metrics`, {
      headers: {
        Accept: "text/plain",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Gateway error: ${error}` },
        { status: response.status }
      );
    }

    const metricsText = await response.text();
    return new NextResponse(metricsText, {
      headers: {
        "Content-Type": "text/plain",
      },
    });
  } catch (error: any) {
    console.error("Failed to fetch metrics:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
