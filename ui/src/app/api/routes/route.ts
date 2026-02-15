import { NextRequest, NextResponse } from "next/server";

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:8080";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// GET /api/routes - Fetch all routes
export async function GET() {
  if (!ADMIN_TOKEN) {
    return NextResponse.json(
      { error: "Admin token not configured" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`${GATEWAY_URL}/admin/routes`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Gateway responded with status ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch routes:", error);
    return NextResponse.json(
      { error: "Failed to fetch routes from gateway" },
      { status: 500 }
    );
  }
}

// POST /api/routes - Update routes configuration
export async function POST(req: NextRequest) {
  if (!ADMIN_TOKEN) {
    return NextResponse.json(
      { error: "Admin token not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();

    const response = await fetch(`${GATEWAY_URL}/admin/routes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Gateway responded with status ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to update routes:", error);
    return NextResponse.json(
      { error: "Failed to update routes configuration" },
      { status: 500 }
    );
  }
}
