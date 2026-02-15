import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { calculateMetricsSummary } from "@/lib/prometheus";
import { MetricsSummary } from "@/types/gateway";

export function useMetrics(refreshInterval = 5000) {
  const query = useQuery({
    queryKey: ["metrics"],
    queryFn: async () => {
      const metricsText = await apiClient.get<string>("/api/metrics");
      return calculateMetricsSummary(metricsText);
    },
    refetchInterval: refreshInterval,
    staleTime: 1000, // Metrics are time-sensitive
  });

  return {
    metrics: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useRawMetrics(refreshInterval = 5000) {
  return useQuery({
    queryKey: ["raw-metrics"],
    queryFn: () => apiClient.get<string>("/api/metrics"),
    refetchInterval: refreshInterval,
    staleTime: 1000,
  });
}
