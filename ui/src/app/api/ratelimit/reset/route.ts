import { NextResponse } from "next/server";

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:8080";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

export async function POST(req: Request) {
  try {
    if (!ADMIN_TOKEN) {
      return NextResponse.json(
        { error: "Admin token not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();

    if (!body.key) {
      return NextResponse.json(
        { error: "Missing required field: key" },
        { status: 400 }
      );
    }

    const response = await fetch(`${GATEWAY_URL}/admin/ratelimit/reset`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
    console.error("Failed to reset rate limit:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reset rate limit" },
      { status: 500 }
    );
  }
}
