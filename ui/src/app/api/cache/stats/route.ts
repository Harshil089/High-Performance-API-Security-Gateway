import { NextResponse } from "next/server";

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:8080";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

export async function GET() {
  try {
    if (!ADMIN_TOKEN) {
      return NextResponse.json(
        { error: "Admin token not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(`${GATEWAY_URL}/admin/cache/stats`, {
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Gateway error: ${error}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to fetch cache stats:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch cache stats" },
      { status: 500 }
    );
  }
}
