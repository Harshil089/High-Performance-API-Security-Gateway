"use client";

import { useState, useEffect } from "react";
import { RouteConfig } from "@/types/gateway";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus } from "lucide-react";

interface RouteFormProps {
  route?: RouteConfig;
  onSubmit: (route: RouteConfig) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function RouteForm({ route, onSubmit, onCancel, isLoading }: RouteFormProps) {
  const [formData, setFormData] = useState<RouteConfig>({
    path: "",
    timeout: 3000,
    require_auth: false,
    ...route,
  });

  const [backends, setBackends] = useState<string[]>(
    route?.backends || (route?.backend ? [route.backend] : [""])
  );

  const [backendMode, setBackendMode] = useState<"single" | "multiple" | "handler">(
    route?.handler ? "handler" : route?.backends ? "multiple" : "single"
  );

  useEffect(() => {
    if (route) {
      setFormData({ ...route });
      if (route.handler) {
        setBackendMode("handler");
      } else if (route.backends) {
        setBackendMode("multiple");
        setBackends(route.backends);
      } else if (route.backend) {
        setBackendMode("single");
        setBackends([route.backend]);
      }
    }
  }, [route]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const routeData: RouteConfig = {
      ...formData,
      path: formData.path.trim(),
    };

    // Clean up based on backend mode
    if (backendMode === "handler") {
      delete routeData.backend;
      delete routeData.backends;
      delete routeData.load_balancing;
    } else if (backendMode === "multiple") {
      const validBackends = backends.filter((b) => b.trim() !== "");
      if (validBackends.length > 0) {
        routeData.backends = validBackends;
        delete routeData.backend;
        delete routeData.handler;
      }
    } else {
      const validBackend = backends[0]?.trim();
      if (validBackend) {
        routeData.backend = validBackend;
        delete routeData.backends;
        delete routeData.handler;
        delete routeData.load_balancing;
      }
    }

    // Clean up optional fields
    if (!routeData.rewrite) delete routeData.rewrite;
    if (!routeData.strip_prefix) delete routeData.strip_prefix;

    onSubmit(routeData);
  };

  const addBackend = () => {
    setBackends([...backends, ""]);
  };

  const removeBackend = (index: number) => {
    setBackends(backends.filter((_, i) => i !== index));
  };

  const updateBackend = (index: number, value: string) => {
    const newBackends = [...backends];
    newBackends[index] = value;
    setBackends(newBackends);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="path">Path *</Label>
        <Input
          id="path"
          placeholder="/api/users/*"
          value={formData.path}
          onChange={(e) => setFormData({ ...formData, path: e.target.value })}
          required
        />
        <p className="text-xs text-muted-foreground">
          Use * for wildcard matching (e.g., /api/users/*)
        </p>
      </div>

      <div className="space-y-2">
        <Label>Backend Type *</Label>
        <Select
          value={backendMode}
          onValueChange={(value: "single" | "multiple" | "handler") => {
            setBackendMode(value);
            if (value === "handler") {
              setFormData({ ...formData, handler: "health_check" });
            } else {
              const newData = { ...formData };
              delete newData.handler;
              setFormData(newData);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">Single Backend</SelectItem>
            <SelectItem value="multiple">Multiple Backends (Load Balanced)</SelectItem>
            <SelectItem value="handler">Handler Function</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {backendMode === "handler" ? (
        <div className="space-y-2">
          <Label htmlFor="handler">Handler Function *</Label>
          <Select
            value={formData.handler || "health_check"}
            onValueChange={(value) => setFormData({ ...formData, handler: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="health_check">Health Check</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Backend URL(s) *</Label>
              {backendMode === "multiple" && (
                <Button type="button" variant="outline" size="sm" onClick={addBackend}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Backend
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {backends.map((backend, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="http://localhost:3001"
                    value={backend}
                    onChange={(e) => updateBackend(index, e.target.value)}
                    required={backendMode === "single" || backends.length === 1}
                  />
                  {backendMode === "multiple" && backends.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeBackend(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {backendMode === "multiple" && (
            <div className="space-y-2">
              <Label htmlFor="load_balancing">Load Balancing Strategy</Label>
              <Select
                value={formData.load_balancing || "round_robin"}
                onValueChange={(value: "round_robin" | "least_connections" | "random") =>
                  setFormData({ ...formData, load_balancing: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                  <SelectItem value="least_connections">Least Connections</SelectItem>
                  <SelectItem value="random">Random</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="timeout">Timeout (ms) *</Label>
          <Input
            id="timeout"
            type="number"
            min="100"
            max="60000"
            value={formData.timeout}
            onChange={(e) =>
              setFormData({ ...formData, timeout: parseInt(e.target.value) || 3000 })
            }
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="require_auth">Require Authentication</Label>
          <Select
            value={formData.require_auth ? "true" : "false"}
            onValueChange={(value) =>
              setFormData({ ...formData, require_auth: value === "true" })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rewrite">Rewrite Path (optional)</Label>
        <Input
          id="rewrite"
          placeholder="/*"
          value={formData.rewrite || ""}
          onChange={(e) => setFormData({ ...formData, rewrite: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Rewrite the request path before forwarding
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="strip_prefix">Strip Prefix (optional)</Label>
        <Input
          id="strip_prefix"
          placeholder="/api"
          value={formData.strip_prefix || ""}
          onChange={(e) => setFormData({ ...formData, strip_prefix: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Remove this prefix from the path before forwarding
        </p>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : route ? "Update Route" : "Add Route"}
        </Button>
      </div>
    </form>
  );
}
