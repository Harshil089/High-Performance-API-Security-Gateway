import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { CacheStats } from "@/types/gateway";

export function useCacheStats() {
  return useQuery({
    queryKey: ["cache", "stats"],
    queryFn: () => apiClient.get<CacheStats>("/api/cache/stats"),
    refetchInterval: 10000, // Refresh every 10 seconds
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
