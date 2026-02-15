import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export interface EndpointMetric {
    endpoint: string;
    total_requests: number;
    status_2xx: number;
    status_4xx: number;
    status_5xx: number;
    error_rate: number;
}

interface RequestLogsResponse {
    endpoints: EndpointMetric[];
    timestamp: string;
}

export function useRequestLogs(refreshInterval = 5000) {
    return useQuery({
        queryKey: ["request-logs"],
        queryFn: () => apiClient.get<RequestLogsResponse>("/api/logs"),
        refetchInterval: refreshInterval,
        staleTime: 2000,
    });
}
