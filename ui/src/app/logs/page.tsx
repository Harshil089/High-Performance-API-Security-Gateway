"use client";

import { RequestLogsViewer } from "@/components/logs/RequestLogsViewer";

export default function LogsPage() {
    return (
        <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Request Logs</h1>
                <p className="text-sm md:text-base text-muted-foreground">
                    Per-endpoint traffic, status codes, and error rates
                </p>
            </div>

            <RequestLogsViewer />
        </div>
    );
}
