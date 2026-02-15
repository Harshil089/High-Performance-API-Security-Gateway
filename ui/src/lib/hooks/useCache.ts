import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { CacheStats, CacheConfig } from "@/types/gateway";

interface CacheConfigResponse {
  cache: CacheConfig;
}

export function useCacheStats() {
  return useQuery({
    queryKey: ["cache", "stats"],
    queryFn: () => apiClient.get<CacheStats>("/api/cache/stats"),
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}

export function useCacheConfig() {
  return useQuery({
    queryKey: ["cache", "config"],
    queryFn: () => apiClient.get<CacheConfigResponse>("/api/cache/config"),
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

export function useUpdateCacheConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Partial<CacheConfig>) =>
      apiClient.post("/api/cache/config", { cache: updates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cache"] });
      queryClient.invalidateQueries({ queryKey: ["config"] });
    },
  });
}

export function useClearCache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pattern?: string) =>
      apiClient.post("/api/cache/clear", pattern ? { pattern } : {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cache"] });
    },
  });
}
