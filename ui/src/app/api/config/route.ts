import { NextResponse } from "next/server";

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:8080";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.warn("⚠️  ADMIN_TOKEN not configured - admin API will not work");
}

export async function GET() {
  try {
    if (!ADMIN_TOKEN) {
      return NextResponse.json(
        { error: "Admin token not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(`${GATEWAY_URL}/admin/config`, {
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
    console.error("Failed to fetch gateway config:", error);
    return NextResponse.json(
      { error: error.message || "Failed to connect to gateway" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    if (!ADMIN_TOKEN) {
      return NextResponse.json(
        { error: "Admin token not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();

    const response = await fetch(`${GATEWAY_URL}/admin/config`, {
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
    console.error("Failed to update gateway config:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update gateway config" },
      { status: 500 }
    );
  }
}
