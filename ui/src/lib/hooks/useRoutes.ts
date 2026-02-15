import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RouteConfig, RoutesConfig } from "@/types/gateway";
import { apiClient } from "@/lib/api/client";

interface RoutesResponse {
  routes: RouteConfig[];
}

export function useRoutes() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["routes"],
    queryFn: async () => {
      const response = await apiClient.get<RoutesResponse>("/api/routes");
      return response.routes;
    },
    refetchInterval: 30000, // Refresh every 30s
    staleTime: 10000,
  });

  const addRouteMutation = useMutation({
    mutationFn: async (route: RouteConfig) => {
      const currentRoutes = queryClient.getQueryData<RouteConfig[]>(["routes"]) || [];
      const updatedRoutes = [...currentRoutes, route];
      return apiClient.post<RoutesResponse>("/api/routes", { routes: updatedRoutes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routes"] });
    },
  });

  const updateRouteMutation = useMutation({
    mutationFn: async ({ index, route }: { index: number; route: RouteConfig }) => {
      const currentRoutes = queryClient.getQueryData<RouteConfig[]>(["routes"]) || [];
      const updatedRoutes = [...currentRoutes];
      updatedRoutes[index] = route;
      return apiClient.post<RoutesResponse>("/api/routes", { routes: updatedRoutes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routes"] });
    },
  });

  const deleteRouteMutation = useMutation({
    mutationFn: async (index: number) => {
      const currentRoutes = queryClient.getQueryData<RouteConfig[]>(["routes"]) || [];
      const updatedRoutes = currentRoutes.filter((_, i) => i !== index);
      return apiClient.post<RoutesResponse>("/api/routes", { routes: updatedRoutes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routes"] });
    },
  });

  return {
    routes: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    addRoute: addRouteMutation.mutate,
    updateRoute: updateRouteMutation.mutate,
    deleteRoute: deleteRouteMutation.mutate,
    isAdding: addRouteMutation.isPending,
    isUpdating: updateRouteMutation.isPending,
    isDeleting: deleteRouteMutation.isPending,
  };
}
