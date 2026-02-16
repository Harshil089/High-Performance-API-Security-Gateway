"use client";

import { useState, useMemo } from "react";
import { useRequestLogs, EndpointMetric } from "@/lib/hooks/useRequestLogs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import {
    ArrowUpDown,
    Search,
    RefreshCw,
    ArrowUp,
    ArrowDown,
} from "lucide-react";

type SortField = "endpoint" | "total_requests" | "status_2xx" | "status_4xx" | "status_5xx" | "error_rate";
type SortDir = "asc" | "desc";

function ErrorBadge({ rate }: { rate: number }) {
    if (rate >= 50)
        return <Badge variant="destructive" className="text-[10px] md:text-xs">{rate.toFixed(1)}%</Badge>;
    if (rate >= 10)
        return (
            <Badge className="bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30 border-yellow-500/30 text-[10px] md:text-xs">
                {rate.toFixed(1)}%
            </Badge>
        );
    return (
        <Badge className="bg-green-500/20 text-green-700 hover:bg-green-500/30 border-green-500/30 text-[10px] md:text-xs">
            {rate.toFixed(1)}%
        </Badge>
    );
}

export function RequestLogsViewer() {
    const { data, isLoading, error, refetch } = useRequestLogs();
    const [search, setSearch] = useState("");
    const [sortField, setSortField] = useState<SortField>("total_requests");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const isMobile = useIsMobile();

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            setSortDir("desc");
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field)
            return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
        return sortDir === "asc" ? (
            <ArrowUp className="h-3 w-3" />
        ) : (
            <ArrowDown className="h-3 w-3" />
        );
    };

    const sorted = useMemo(() => {
        if (!data?.endpoints) return [];
        let filtered = data.endpoints;
        if (search.trim()) {
            const q = search.toLowerCase();
            filtered = filtered.filter((e) => e.endpoint.toLowerCase().includes(q));
        }
        return [...filtered].sort((a, b) => {
            const av = a[sortField];
            const bv = b[sortField];
            if (typeof av === "string" && typeof bv === "string")
                return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
            return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
        });
    }, [data, search, sortField, sortDir]);

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="h-10 rounded-md bg-card animate-pulse max-w-sm" />
                <div className="h-80 rounded-lg border bg-card animate-pulse" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 border border-destructive rounded-lg bg-destructive/10">
                <p className="text-sm text-destructive">
                    Failed to load request logs: {error.message}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    Make sure the gateway is running and the /metrics endpoint is accessible.
                </p>
            </div>
        );
    }

    const th =
        "text-left text-xs font-medium text-muted-foreground px-4 py-3 cursor-pointer select-none hover:text-foreground active:text-foreground transition-colors";

    return (
        <div className="space-y-3 md:space-y-4">
            <div className="flex items-center gap-2 md:gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Filter endpoints..."
                        className="pl-9 min-h-[44px]"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => refetch()}
                    className="p-2.5 rounded-md hover:bg-muted active:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Refresh"
                >
                    <RefreshCw className="h-4 w-4" />
                </button>
            </div>

            {data?.timestamp && (
                <span className="text-[10px] md:text-xs text-muted-foreground">
                    Updated: {new Date(data.timestamp).toLocaleTimeString()}
                </span>
            )}

            <Card>
                <CardHeader className="pb-2 md:pb-3 p-3 md:p-6">
                    <CardTitle className="text-sm md:text-base">Endpoint Request Log</CardTitle>
                    <CardDescription className="text-xs">
                        {sorted.length} endpoint{sorted.length !== 1 ? "s" : ""}
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {sorted.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            {search ? "No endpoints match your filter." : "No request data available yet."}
                        </div>
                    ) : isMobile ? (
                        // Mobile: compact card list
                        <div className="divide-y">
                            {sorted.map((ep) => (
                                <div key={ep.endpoint} className="p-3 active:bg-muted/30">
                                    <code className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded break-all">
                                        {ep.endpoint}
                                    </code>
                                    <div className="flex items-center gap-3 mt-2 text-xs">
                                        <span className="font-medium">{formatNumber(ep.total_requests)} req</span>
                                        <span className="text-green-600">{formatNumber(ep.status_2xx)}</span>
                                        <span className="text-yellow-600">{formatNumber(ep.status_4xx)}</span>
                                        <span className="text-red-600">{formatNumber(ep.status_5xx)}</span>
                                        <ErrorBadge rate={ep.error_rate} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        // Desktop: full table
                        <div className="overflow-x-auto touch-scroll">
                            <table className="w-full text-sm">
                                <thead className="border-b">
                                    <tr>
                                        <th className={th} onClick={() => toggleSort("endpoint")}>
                                            <div className="flex items-center gap-1">
                                                Endpoint <SortIcon field="endpoint" />
                                            </div>
                                        </th>
                                        <th className={th} onClick={() => toggleSort("total_requests")}>
                                            <div className="flex items-center gap-1">
                                                Total <SortIcon field="total_requests" />
                                            </div>
                                        </th>
                                        <th className={th} onClick={() => toggleSort("status_2xx")}>
                                            <div className="flex items-center gap-1">
                                                2xx <SortIcon field="status_2xx" />
                                            </div>
                                        </th>
                                        <th className={th} onClick={() => toggleSort("status_4xx")}>
                                            <div className="flex items-center gap-1">
                                                4xx <SortIcon field="status_4xx" />
                                            </div>
                                        </th>
                                        <th className={th} onClick={() => toggleSort("status_5xx")}>
                                            <div className="flex items-center gap-1">
                                                5xx <SortIcon field="status_5xx" />
                                            </div>
                                        </th>
                                        <th className={th} onClick={() => toggleSort("error_rate")}>
                                            <div className="flex items-center gap-1">
                                                Error Rate <SortIcon field="error_rate" />
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map((ep) => (
                                        <tr
                                            key={ep.endpoint}
                                            className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                                        >
                                            <td className="px-4 py-3">
                                                <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                                                    {ep.endpoint}
                                                </code>
                                            </td>
                                            <td className="px-4 py-3 font-medium">{formatNumber(ep.total_requests)}</td>
                                            <td className="px-4 py-3 text-green-600">{formatNumber(ep.status_2xx)}</td>
                                            <td className="px-4 py-3 text-yellow-600">{formatNumber(ep.status_4xx)}</td>
                                            <td className="px-4 py-3 text-red-600">{formatNumber(ep.status_5xx)}</td>
                                            <td className="px-4 py-3">
                                                <ErrorBadge rate={ep.error_rate} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
