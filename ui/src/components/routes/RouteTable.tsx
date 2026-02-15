"use client";

import { useState } from "react";
import { RouteConfig } from "@/types/gateway";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Shield, ShieldOff } from "lucide-react";

interface RouteTableProps {
  routes: RouteConfig[];
  onEdit: (index: number, route: RouteConfig) => void;
  onDelete: (index: number) => void;
  isLoading?: boolean;
}

export function RouteTable({ routes, onEdit, onDelete, isLoading }: RouteTableProps) {
  const [sortBy, setSortBy] = useState<keyof RouteConfig | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (key: keyof RouteConfig) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortOrder("asc");
    }
  };

  const sortedRoutes = [...routes].sort((a, b) => {
    if (!sortBy) return 0;

    const aVal = a[sortBy];
    const bVal = b[sortBy];

    if (aVal === undefined || bVal === undefined) return 0;

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortOrder === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    }

    if (typeof aVal === "boolean" && typeof bVal === "boolean") {
      return sortOrder === "asc"
        ? (aVal ? 1 : 0) - (bVal ? 1 : 0)
        : (bVal ? 1 : 0) - (aVal ? 1 : 0);
    }

    return 0;
  });

  const getBackendDisplay = (route: RouteConfig) => {
    if (route.handler) {
      return <Badge variant="secondary">{route.handler}</Badge>;
    }
    if (route.backend) {
      return <span className="text-sm">{route.backend}</span>;
    }
    if (route.backends && route.backends.length > 0) {
      return (
        <div className="flex flex-col gap-1">
          {route.backends.map((backend, idx) => (
            <span key={idx} className="text-sm">
              {backend}
            </span>
          ))}
          {route.load_balancing && (
            <Badge variant="outline" className="w-fit">
              {route.load_balancing}
            </Badge>
          )}
        </div>
      );
    }
    return <span className="text-muted-foreground">None</span>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading routes...</div>
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-muted-foreground">No routes configured</p>
          <p className="text-sm text-muted-foreground mt-2">
            Add a route to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort("path")}
            >
              Path {sortBy === "path" && (sortOrder === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead>Backend(s)</TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort("timeout")}
            >
              Timeout {sortBy === "timeout" && (sortOrder === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort("require_auth")}
            >
              Auth {sortBy === "require_auth" && (sortOrder === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead>Options</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRoutes.map((route, index) => (
            <TableRow key={index}>
              <TableCell className="font-mono font-medium">{route.path}</TableCell>
              <TableCell>{getBackendDisplay(route)}</TableCell>
              <TableCell>{route.timeout}ms</TableCell>
              <TableCell>
                {route.require_auth ? (
                  <Badge variant="success" className="flex items-center gap-1 w-fit">
                    <Shield className="h-3 w-3" />
                    Required
                  </Badge>
                ) : (
                  <Badge variant="outline" className="flex items-center gap-1 w-fit">
                    <ShieldOff className="h-3 w-3" />
                    None
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {route.rewrite && (
                    <Badge variant="outline" className="w-fit text-xs">
                      Rewrite: {route.rewrite}
                    </Badge>
                  )}
                  {route.strip_prefix && (
                    <Badge variant="outline" className="w-fit text-xs">
                      Strip: {route.strip_prefix}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(index, route)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
