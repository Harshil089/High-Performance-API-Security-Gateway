import { NextRequest, NextResponse } from "next/server";

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

        const response = await fetch(`${GATEWAY_URL}/admin/config`, {
            headers: {
                Authorization: `Bearer ${ADMIN_TOKEN}`,
                "Content-Type": "application/json",
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
        return NextResponse.json({ cache: data.config?.cache || {} });
    } catch (error: any) {
        console.error("Failed to fetch cache config:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch cache config" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        if (!ADMIN_TOKEN) {
            return NextResponse.json(
                { error: "Admin token not configured" },
                { status: 500 }
            );
        }

        const body = await req.json();

        // Fetch current full config first
        const currentResponse = await fetch(`${GATEWAY_URL}/admin/config`, {
            headers: {
                Authorization: `Bearer ${ADMIN_TOKEN}`,
                "Content-Type": "application/json",
            },
        });

        if (!currentResponse.ok) {
            throw new Error(`Failed to fetch current config: ${currentResponse.status}`);
        }

        const currentData = await currentResponse.json();

        // Merge cache updates with existing config
        const updatedConfig = {
            ...currentData.config,
            cache: {
                ...currentData.config?.cache,
                ...body.cache,
            },
        };

        const response = await fetch(`${GATEWAY_URL}/admin/config`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${ADMIN_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ config: updatedConfig }),
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
        console.error("Failed to update cache config:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update cache config" },
            { status: 500 }
        );
    }
}
