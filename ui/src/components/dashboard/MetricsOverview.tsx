"use client";

import { useMetrics } from "@/lib/hooks/useMetrics";
import { MetricsCard } from "./MetricsCard";
import {
  Activity,
  TrendingUp,
  Users,
  Shield,
  Database,
} from "lucide-react";
import { formatNumber, formatPercentage } from "@/lib/utils";

export function MetricsOverview() {
  const { metrics, isLoading, error } = useMetrics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-24 md:h-32 rounded-lg border bg-card animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-destructive rounded-lg bg-destructive/10">
        <p className="text-sm text-destructive">
          Failed to load metrics: {error.message}
        </p>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const totalStatusCodes =
    metrics.statusCodes["2xx"] +
    metrics.statusCodes["4xx"] +
    metrics.statusCodes["5xx"];

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricsCard
        title="Total Requests"
        value={formatNumber(metrics.totalRequests)}
        subtitle="All time"
        icon={Activity}
      />

      <MetricsCard
        title="Active Connections"
        value={metrics.activeConnections}
        subtitle="Currently connected"
        icon={Users}
      />

      <MetricsCard
        title="Auth Success Rate"
        value={`${metrics.authSuccessRate.toFixed(1)}%`}
        subtitle="Authentication success"
        icon={Shield}
      />

      <MetricsCard
        title="Cache Hit Rate"
        value={`${metrics.cacheHitRate.toFixed(1)}%`}
        subtitle="Cache efficiency"
        icon={Database}
      />

      <MetricsCard
        title="Success Rate (2xx)"
        value={formatPercentage(
          metrics.statusCodes["2xx"],
          totalStatusCodes
        )}
        subtitle={`${formatNumber(metrics.statusCodes["2xx"])} successful`}
        icon={TrendingUp}
        className="md:col-span-1"
      />

      <MetricsCard
        title="Client Errors (4xx)"
        value={formatPercentage(
          metrics.statusCodes["4xx"],
          totalStatusCodes
        )}
        subtitle={`${formatNumber(metrics.statusCodes["4xx"])} errors`}
        className="md:col-span-1"
      />

      <MetricsCard
        title="Server Errors (5xx)"
        value={formatPercentage(
          metrics.statusCodes["5xx"],
          totalStatusCodes
        )}
        subtitle={`${formatNumber(metrics.statusCodes["5xx"])} errors`}
        className="md:col-span-1"
      />

      <MetricsCard
        title="Healthy Backends"
        value={`${metrics.backends.filter((b) => b.healthy).length}/${
          metrics.backends.length
        }`}
        subtitle="Backend services"
        className="md:col-span-1"
      />
    </div>
  );
}
