import { NextResponse } from "next/server";

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:8080";

interface EndpointMetric {
    endpoint: string;
    total_requests: number;
    status_2xx: number;
    status_4xx: number;
    status_5xx: number;
    error_rate: number;
}

function parseEndpointMetrics(metricsText: string): EndpointMetric[] {
    const endpointMap: Record<string, { total: number; s2xx: number; s4xx: number; s5xx: number }> = {};

    const lines = metricsText.split("\n");
    for (const line of lines) {
        if (line.startsWith("#") || !line.trim()) continue;

        // Match request count metrics: gateway_requests_total{method="GET",path="/api/users",status="200"} 42
        const requestMatch = line.match(
            /gateway_requests_total\{.*?path="([^"]*)".*?status="(\d+)".*?\}\s+([\d.]+)/
        );
        if (requestMatch) {
            const [, path, statusStr, countStr] = requestMatch;
            const status = parseInt(statusStr);
            const count = parseFloat(countStr);

            if (!endpointMap[path]) {
                endpointMap[path] = { total: 0, s2xx: 0, s4xx: 0, s5xx: 0 };
            }

            endpointMap[path].total += count;
            if (status >= 200 && status < 300) endpointMap[path].s2xx += count;
            else if (status >= 400 && status < 500) endpointMap[path].s4xx += count;
            else if (status >= 500) endpointMap[path].s5xx += count;
        }
    }

    return Object.entries(endpointMap)
        .map(([endpoint, stats]) => ({
            endpoint,
            total_requests: Math.round(stats.total),
            status_2xx: Math.round(stats.s2xx),
            status_4xx: Math.round(stats.s4xx),
            status_5xx: Math.round(stats.s5xx),
            error_rate: stats.total > 0 ? ((stats.s4xx + stats.s5xx) / stats.total) * 100 : 0,
        }))
        .sort((a, b) => b.total_requests - a.total_requests);
}

export async function GET() {
    try {
        const response = await fetch(`${GATEWAY_URL}/metrics`, {
            headers: { Accept: "text/plain" },
        });

        if (!response.ok) {
            const error = await response.text();
            return NextResponse.json(
                { error: `Gateway error: ${error}` },
                { status: response.status }
            );
        }

        const metricsText = await response.text();
        const endpoints = parseEndpointMetrics(metricsText);

        return NextResponse.json({ endpoints, timestamp: new Date().toISOString() });
    } catch (error: any) {
        console.error("Failed to fetch request logs:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch request logs" },
            { status: 500 }
        );
    }
}
