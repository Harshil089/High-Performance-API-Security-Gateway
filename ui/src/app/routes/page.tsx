"use client";

import { useState } from "react";
import { useRoutes } from "@/lib/hooks/useRoutes";
import { RouteConfig } from "@/types/gateway";
import { RouteTable } from "@/components/routes/RouteTable";
import { RouteForm } from "@/components/routes/RouteForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, AlertTriangle } from "lucide-react";

export default function RoutesPage() {
  const { routes, isLoading, addRoute, updateRoute, deleteRoute, isAdding, isUpdating, isDeleting } =
    useRoutes();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<{ index: number; route: RouteConfig } | null>(
    null
  );
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  const handleAddRoute = () => {
    setEditingRoute(null);
    setIsFormOpen(true);
  };

  const handleEditRoute = (index: number, route: RouteConfig) => {
    setEditingRoute({ index, route });
    setIsFormOpen(true);
  };

  const handleDeleteClick = (index: number) => {
    setDeletingIndex(index);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deletingIndex !== null) {
      deleteRoute(deletingIndex);
      setIsDeleteDialogOpen(false);
      setDeletingIndex(null);
    }
  };

  const handleFormSubmit = (route: RouteConfig) => {
    if (editingRoute !== null) {
      updateRoute({ index: editingRoute.index, route });
    } else {
      addRoute(route);
    }
    setIsFormOpen(false);
    setEditingRoute(null);
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
    setEditingRoute(null);
  };

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold">Routes</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Manage API routes and backends
          </p>
        </div>
        <Button onClick={handleAddRoute} className="shrink-0">
          <Plus className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Add Route</span>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Route Configuration</CardTitle>
          <CardDescription>
            {routes.length} route{routes.length !== 1 ? "s" : ""} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RouteTable
            routes={routes}
            onEdit={handleEditRoute}
            onDelete={handleDeleteClick}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Add/Edit Route Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRoute ? "Edit Route" : "Add New Route"}</DialogTitle>
            <DialogDescription>
              {editingRoute
                ? "Update the route configuration below"
                : "Configure a new route for your API gateway"}
            </DialogDescription>
          </DialogHeader>
          <RouteForm
            route={editingRoute?.route}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
            isLoading={isAdding || isUpdating}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Route
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this route? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletingIndex !== null && routes[deletingIndex] && (
            <div className="bg-muted p-4 rounded-md">
              <p className="font-mono text-sm">{routes[deletingIndex].path}</p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete Route"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
