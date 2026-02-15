import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { RateLimitConfig } from "@/types/gateway";

interface RateLimitConfigResponse {
    rate_limits: RateLimitConfig;
}

export function useRateLimitConfig() {
    return useQuery({
        queryKey: ["ratelimit", "config"],
        queryFn: () => apiClient.get<RateLimitConfigResponse>("/api/ratelimit/config"),
        refetchInterval: 30000,
        staleTime: 10000,
    });
}

export function useUpdateRateLimitConfig() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (updates: Partial<RateLimitConfig>) =>
            apiClient.post("/api/ratelimit/config", { rate_limits: updates }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["ratelimit"] });
            queryClient.invalidateQueries({ queryKey: ["config"] });
        },
    });
}

export function useResetRateLimit() {
    return useMutation({
        mutationFn: (key: string) =>
            apiClient.post("/api/ratelimit/reset", { key }),
    });
}
