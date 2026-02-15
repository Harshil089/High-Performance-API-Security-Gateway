"use client";

import { RequestLogsViewer } from "@/components/logs/RequestLogsViewer";

export default function LogsPage() {
    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Request Logs</h1>
                <p className="text-muted-foreground">
                    Per-endpoint request traffic, status code distribution, and error rates
                </p>
            </div>

            <RequestLogsViewer />
        </div>
    );
}
