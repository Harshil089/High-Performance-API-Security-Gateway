import { NextRequest, NextResponse } from "next/server";

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:8080";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

export async function GET() {
  try {
    const response = await fetch(`${GATEWAY_URL}/admin/config`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Gateway responded with status: ${response.status}`);
    }

    const data = await response.json();

    // Extract security-related config
    const securityConfig = {
      jwt: data.config?.jwt || {},
      security: data.config?.security || {},
    };

    return NextResponse.json({ config: securityConfig });
  } catch (error) {
    console.error("Failed to fetch security config:", error);
    return NextResponse.json(
      { error: "Failed to fetch security configuration" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Fetch current full config first
    const currentResponse = await fetch(`${GATEWAY_URL}/admin/config`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!currentResponse.ok) {
      throw new Error(`Failed to fetch current config: ${currentResponse.status}`);
    }

    const currentData = await currentResponse.json();

    // Merge security updates with existing config
    const updatedConfig = {
      ...currentData.config,
      jwt: body.jwt || currentData.config.jwt,
      security: body.security || currentData.config.security,
    };

    // Update config
    const response = await fetch(`${GATEWAY_URL}/admin/config`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ config: updatedConfig }),
    });

    if (!response.ok) {
      throw new Error(`Gateway responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to update security config:", error);
    return NextResponse.json(
      { error: "Failed to update security configuration" },
      { status: 500 }
    );
  }
}
