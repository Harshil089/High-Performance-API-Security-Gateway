import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { calculateMetricsSummary } from "@/lib/prometheus";
import { MetricsSummary } from "@/types/gateway";
import { useIsMobile } from "./useIsMobile";

export function useMetrics(refreshInterval?: number) {
  const isMobile = useIsMobile();
  const interval = refreshInterval ?? (isMobile ? 10000 : 5000);

  const query = useQuery({
    queryKey: ["metrics"],
    queryFn: async () => {
      const metricsText = await apiClient.get<string>("/api/metrics");
      return calculateMetricsSummary(metricsText);
    },
    refetchInterval: interval,
    staleTime: 2000,
  });

  return {
    metrics: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useRawMetrics(refreshInterval?: number) {
  const isMobile = useIsMobile();
  const interval = refreshInterval ?? (isMobile ? 10000 : 5000);

  return useQuery({
    queryKey: ["raw-metrics"],
    queryFn: () => apiClient.get<string>("/api/metrics"),
    refetchInterval: interval,
    staleTime: 2000,
  });
}
