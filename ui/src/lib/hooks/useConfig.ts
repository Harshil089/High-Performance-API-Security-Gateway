import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { GatewayConfig } from "@/types/gateway";

interface ConfigResponse {
  config: GatewayConfig;
  timestamp: number;
}

export function useConfig() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["config"],
    queryFn: () => apiClient.get<ConfigResponse>("/api/config"),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  const updateMutation = useMutation({
    mutationFn: (config: GatewayConfig) =>
      apiClient.post<ConfigResponse>("/api/config", config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
    },
  });

  return {
    config: query.data?.config,
    timestamp: query.data?.timestamp,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateConfig: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,
  };
}
