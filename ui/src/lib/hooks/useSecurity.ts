import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { JWTConfig, SecurityConfig } from "@/types/gateway";

interface SecurityConfigResponse {
  config: {
    jwt: JWTConfig;
    security: SecurityConfig;
  };
}

interface UpdateSecurityRequest {
  jwt?: Partial<JWTConfig>;
  security?: Partial<SecurityConfig>;
}

export function useSecurity() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["security"],
    queryFn: async () => {
      const response = await apiClient.get<SecurityConfigResponse>("/api/security");
      return response.config;
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: UpdateSecurityRequest) => {
      return apiClient.post<SecurityConfigResponse>("/api/security", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security"] });
      queryClient.invalidateQueries({ queryKey: ["config"] });
    },
  });

  return {
    jwtConfig: query.data?.jwt,
    securityConfig: query.data?.security,
    isLoading: query.isLoading,
    error: query.error,
    updateSecurity: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
