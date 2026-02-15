"use client";

import { useState, useEffect, useCallback } from "react";
import { useRateLimitConfig, useUpdateRateLimitConfig } from "@/lib/hooks/useRateLimit";
import { RateLimitConfig } from "@/types/gateway";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, RotateCcw, Plus, X, AlertCircle, Globe, User, Route } from "lucide-react";

function formatWindow(seconds: number): string {
    if (seconds >= 86400) return `${(seconds / 86400).toFixed(1)} days`;
    if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)} hours`;
    if (seconds >= 60) return `${(seconds / 60).toFixed(0)} minutes`;
    return `${seconds} seconds`;
}

interface EndpointRule {
    path: string;
    requests: number;
    window: number;
}

export function RateLimitConfigPanel() {
    const { data, isLoading: isFetching, error: fetchError } = useRateLimitConfig();
    const updateMutation = useUpdateRateLimitConfig();

    const [formData, setFormData] = useState<Partial<RateLimitConfig>>({
        global: { requests: 1000, window: 60 },
        per_ip: { requests: 100, window: 60 },
        per_ip_connections: 10,
        endpoints: {},
    });
    const [hasChanges, setHasChanges] = useState(false);
    const [newEndpoint, setNewEndpoint] = useState<EndpointRule>({
        path: "",
        requests: 50,
        window: 60,
    });

    useEffect(() => {
        if (data?.rate_limits) {
            setFormData({
                global: data.rate_limits.global ?? { requests: 1000, window: 60 },
                per_ip: data.rate_limits.per_ip ?? { requests: 100, window: 60 },
                per_ip_connections: data.rate_limits.per_ip_connections ?? 10,
                endpoints: data.rate_limits.endpoints ?? {},
            });
            setHasChanges(false);
        }
    }, [data]);

    const updateGlobal = useCallback((field: "requests" | "window", value: number) => {
        setFormData((prev) => ({
            ...prev,
            global: { ...prev.global!, [field]: value },
        }));
        setHasChanges(true);
    }, []);

    const updatePerIP = useCallback((field: "requests" | "window", value: number) => {
        setFormData((prev) => ({
            ...prev,
            per_ip: { ...prev.per_ip!, [field]: value },
        }));
        setHasChanges(true);
    }, []);

    const addEndpointRule = useCallback(() => {
        const trimmed = newEndpoint.path.trim();
        if (!trimmed) return;
        setFormData((prev) => ({
            ...prev,
            endpoints: {
                ...prev.endpoints,
                [trimmed]: { requests: newEndpoint.requests, window: newEndpoint.window },
            },
        }));
        setNewEndpoint({ path: "", requests: 50, window: 60 });
        setHasChanges(true);
    }, [newEndpoint]);

    const removeEndpointRule = useCallback((path: string) => {
        setFormData((prev) => {
            const { [path]: _, ...rest } = prev.endpoints || {};
            return { ...prev, endpoints: rest };
        });
        setHasChanges(true);
    }, []);

    const handleSave = () => {
        updateMutation.mutate(formData as RateLimitConfig, {
            onSuccess: () => setHasChanges(false),
        });
    };

    const handleReset = () => {
        if (data?.rate_limits) {
            setFormData({ ...data.rate_limits });
            setHasChanges(false);
        }
    };

    if (isFetching) {
        return (
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-32 rounded-lg border bg-card animate-pulse" />
                ))}
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="p-4 border border-destructive rounded-lg bg-destructive/10">
                <p className="text-sm text-destructive">
                    Failed to load rate limit configuration: {fetchError.message}
                </p>
            </div>
        );
    }

    const endpointEntries = Object.entries(formData.endpoints || {});

    return (
        <div className="space-y-6">
            {/* Save Bar */}
            {hasChanges && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10">
                    <div className="flex items-center gap-2 text-sm">
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                        <span>You have unsaved changes</span>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleReset}>
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Reset
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                            <Save className="h-3.5 w-3.5 mr-1" />
                            {updateMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </div>
            )}

            {/* Global Rate Limit */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        Global Rate Limit
                    </CardTitle>
                    <CardDescription>Maximum requests across all clients combined</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Requests</Label>
                            <Input
                                type="number"
                                min={1}
                                value={formData.global?.requests ?? 1000}
                                onChange={(e) => updateGlobal("requests", parseInt(e.target.value) || 1000)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Window (seconds)</Label>
                            <Input
                                type="number"
                                min={1}
                                value={formData.global?.window ?? 60}
                                onChange={(e) => updateGlobal("window", parseInt(e.target.value) || 60)}
                            />
                            <p className="text-xs text-muted-foreground">
                                ≈ {formatWindow(formData.global?.window ?? 60)}
                            </p>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                        {formData.global?.requests ?? 1000} requests per {formatWindow(formData.global?.window ?? 60)}
                    </p>
                </CardContent>
            </Card>

            {/* Per-IP Rate Limit */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Per-IP Rate Limit
                    </CardTitle>
                    <CardDescription>Maximum requests per individual client IP</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Requests</Label>
                            <Input
                                type="number"
                                min={1}
                                value={formData.per_ip?.requests ?? 100}
                                onChange={(e) => updatePerIP("requests", parseInt(e.target.value) || 100)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Window (seconds)</Label>
                            <Input
                                type="number"
                                min={1}
                                value={formData.per_ip?.window ?? 60}
                                onChange={(e) => updatePerIP("window", parseInt(e.target.value) || 60)}
                            />
                            <p className="text-xs text-muted-foreground">
                                ≈ {formatWindow(formData.per_ip?.window ?? 60)}
                            </p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Max Concurrent Connections Per IP</Label>
                        <Input
                            type="number"
                            min={1}
                            max={1000}
                            value={formData.per_ip_connections ?? 10}
                            onChange={(e) => {
                                setFormData((prev) => ({
                                    ...prev,
                                    per_ip_connections: parseInt(e.target.value) || 10,
                                }));
                                setHasChanges(true);
                            }}
                            className="max-w-[200px]"
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {formData.per_ip?.requests ?? 100} requests per {formatWindow(formData.per_ip?.window ?? 60)}, max {formData.per_ip_connections ?? 10} connections
                    </p>
                </CardContent>
            </Card>

            {/* Endpoint-Specific Rules */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Route className="h-4 w-4" />
                        Endpoint-Specific Rules
                    </CardTitle>
                    <CardDescription>Override rate limits for specific API endpoints</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {endpointEntries.length > 0 ? (
                        <div className="space-y-2">
                            {endpointEntries.map(([path, rule]) => (
                                <div
                                    key={path}
                                    className="flex items-center justify-between p-3 rounded-md border bg-muted/30"
                                >
                                    <div className="flex items-center gap-3">
                                        <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{path}</code>
                                        <Badge variant="secondary">
                                            {rule.requests} req / {formatWindow(rule.window)}
                                        </Badge>
                                    </div>
                                    <button
                                        onClick={() => removeEndpointRule(path)}
                                        className="text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No endpoint-specific rules. Global and per-IP limits apply to all endpoints.
                        </p>
                    )}

                    {/* Add Endpoint Rule */}
                    <div className="border-t pt-4 space-y-3">
                        <p className="text-sm font-medium">Add Endpoint Rule</p>
                        <div className="grid gap-3 md:grid-cols-4">
                            <div className="md:col-span-2 space-y-1">
                                <Label className="text-xs">Endpoint Path</Label>
                                <Input
                                    placeholder="e.g. /api/auth/login"
                                    value={newEndpoint.path}
                                    onChange={(e) => setNewEndpoint((p) => ({ ...p, path: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Requests</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={newEndpoint.requests}
                                    onChange={(e) =>
                                        setNewEndpoint((p) => ({ ...p, requests: parseInt(e.target.value) || 50 }))
                                    }
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Window (s)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        min={1}
                                        value={newEndpoint.window}
                                        onChange={(e) =>
                                            setNewEndpoint((p) => ({ ...p, window: parseInt(e.target.value) || 60 }))
                                        }
                                    />
                                    <Button onClick={addEndpointRule} disabled={!newEndpoint.path.trim()}>
                                        <Plus className="h-3.5 w-3.5 mr-1" />
                                        Add
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
