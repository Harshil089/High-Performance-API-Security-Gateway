"use client";

import { useCacheStats } from "@/lib/hooks/useCache";
import { MetricsCard } from "@/components/dashboard/MetricsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Database,
    CheckCircle,
    XCircle,
    TrendingUp,
    HardDrive,
    Trash2,
} from "lucide-react";
import { formatBytes, formatNumber } from "@/lib/utils";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend,
} from "recharts";

const CHART_COLORS = {
    hits: "#22c55e",
    misses: "#ef4444",
};

export function CacheStatsOverview() {
    const { data: stats, isLoading, error } = useCacheStats();

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(6)].map((_, i) => (
                        <div
                            key={i}
                            className="h-32 rounded-lg border bg-card animate-pulse"
                        />
                    ))}
                </div>
                <div className="h-72 rounded-lg border bg-card animate-pulse" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 border border-destructive rounded-lg bg-destructive/10">
                <p className="text-sm text-destructive">
                    Failed to load cache stats: {error.message}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    Make sure the gateway is running and the admin API is accessible.
                </p>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                    No cache statistics available. Cache may not be enabled.
                </p>
            </div>
        );
    }

    const pieData = [
        { name: "Hits", value: stats.hit_count || 0 },
        { name: "Misses", value: stats.miss_count || 0 },
    ];

    const hasPieData = pieData.some((d) => d.value > 0);

    return (
        <div className="space-y-6">
            {/* Metrics Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <MetricsCard
                    title="Total Entries"
                    value={formatNumber(stats.total_entries || 0)}
                    subtitle="Cached responses"
                    icon={Database}
                />
                <MetricsCard
                    title="Cache Hits"
                    value={formatNumber(stats.hit_count || 0)}
                    subtitle="Served from cache"
                    icon={CheckCircle}
                />
                <MetricsCard
                    title="Cache Misses"
                    value={formatNumber(stats.miss_count || 0)}
                    subtitle="Forwarded to backend"
                    icon={XCircle}
                />
                <MetricsCard
                    title="Hit Rate"
                    value={`${(stats.hit_rate || 0).toFixed(1)}%`}
                    subtitle="Cache efficiency"
                    icon={TrendingUp}
                />
                <MetricsCard
                    title="Memory Usage"
                    value={formatBytes(stats.memory_usage || 0)}
                    subtitle="Cache storage"
                    icon={HardDrive}
                />
                <MetricsCard
                    title="Evictions"
                    value={formatNumber(stats.eviction_count || 0)}
                    subtitle="Entries evicted"
                    icon={Trash2}
                />
            </div>

            {/* Hit/Miss Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Cache Hit vs Miss Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                    {hasPieData ? (
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={4}
                                        dataKey="value"
                                        animationBegin={0}
                                        animationDuration={800}
                                    >
                                        <Cell fill={CHART_COLORS.hits} />
                                        <Cell fill={CHART_COLORS.misses} />
                                    </Pie>
                                    <Tooltip
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        formatter={((value: any, name: any) => [
                                            formatNumber(Number(value) || 0),
                                            String(name),
                                        ]) as any}
                                        contentStyle={{
                                            backgroundColor: "hsl(var(--card))",
                                            borderColor: "hsl(var(--border))",
                                            borderRadius: "0.375rem",
                                        }}
                                    />
                                    <Legend
                                        verticalAlign="bottom"
                                        formatter={(value: string) => (
                                            <span className="text-sm text-foreground">{value}</span>
                                        )}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-72 flex items-center justify-center">
                            <p className="text-sm text-muted-foreground">
                                No cache activity yet. The chart will appear once requests are cached.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
