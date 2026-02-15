"use client";

import { useState, useEffect, useCallback } from "react";
import { useCacheConfig, useUpdateCacheConfig } from "@/lib/hooks/useCache";
import { CacheConfig } from "@/types/gateway";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, RotateCcw, Plus, X, AlertCircle } from "lucide-react";
import { formatBytes } from "@/lib/utils";

const HTTP_METHODS = ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"];
const COMMON_STATUS_CODES = [200, 301, 302, 304];

function formatDuration(seconds: number): string {
    if (seconds >= 86400) return `${(seconds / 86400).toFixed(1)} days`;
    if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)} hours`;
    if (seconds >= 60) return `${(seconds / 60).toFixed(0)} minutes`;
    return `${seconds} seconds`;
}

export function CacheConfigPanel() {
    const { data, isLoading: isFetching, error: fetchError } = useCacheConfig();
    const updateMutation = useUpdateCacheConfig();

    const [formData, setFormData] = useState<Partial<CacheConfig>>({
        enabled: false,
        backend: "redis",
        default_ttl: 300,
        max_entry_size: 1048576,
        cacheable_methods: ["GET"],
        cacheable_status_codes: [200],
        exclude_paths: [],
        cache_control_respect: true,
    });
    const [hasChanges, setHasChanges] = useState(false);
    const [newStatusCode, setNewStatusCode] = useState("");
    const [newExcludePath, setNewExcludePath] = useState("");

    // Sync form data from server
    useEffect(() => {
        if (data?.cache) {
            setFormData({
                enabled: data.cache.enabled ?? false,
                backend: data.cache.backend ?? "redis",
                default_ttl: data.cache.default_ttl ?? 300,
                max_entry_size: data.cache.max_entry_size ?? 1048576,
                cacheable_methods: data.cache.cacheable_methods ?? ["GET"],
                cacheable_status_codes: data.cache.cacheable_status_codes ?? [200],
                exclude_paths: data.cache.exclude_paths ?? [],
                cache_control_respect: data.cache.cache_control_respect ?? true,
            });
            setHasChanges(false);
        }
    }, [data]);

    const updateField = useCallback(<K extends keyof CacheConfig>(key: K, value: CacheConfig[K]) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    }, []);

    const toggleMethod = useCallback((method: string) => {
        const current = formData.cacheable_methods || [];
        const updated = current.includes(method)
            ? current.filter((m) => m !== method)
            : [...current, method];
        updateField("cacheable_methods", updated);
    }, [formData.cacheable_methods, updateField]);

    const addStatusCode = useCallback(() => {
        const code = parseInt(newStatusCode.trim());
        if (isNaN(code) || code < 100 || code > 599) return;
        const current = formData.cacheable_status_codes || [];
        if (current.includes(code)) return;
        updateField("cacheable_status_codes", [...current, code].sort());
        setNewStatusCode("");
    }, [newStatusCode, formData.cacheable_status_codes, updateField]);

    const removeStatusCode = useCallback((code: number) => {
        const current = formData.cacheable_status_codes || [];
        updateField("cacheable_status_codes", current.filter((c) => c !== code));
    }, [formData.cacheable_status_codes, updateField]);

    const addExcludePath = useCallback(() => {
        const path = newExcludePath.trim();
        if (!path) return;
        const current = formData.exclude_paths || [];
        if (current.includes(path)) return;
        updateField("exclude_paths", [...current, path]);
        setNewExcludePath("");
    }, [newExcludePath, formData.exclude_paths, updateField]);

    const removeExcludePath = useCallback((path: string) => {
        const current = formData.exclude_paths || [];
        updateField("exclude_paths", current.filter((p) => p !== path));
    }, [formData.exclude_paths, updateField]);

    const handleSave = () => {
        updateMutation.mutate(formData as CacheConfig, {
            onSuccess: () => setHasChanges(false),
        });
    };

    const handleReset = () => {
        if (data?.cache) {
            setFormData({ ...data.cache });
            setHasChanges(false);
        }
    };

    if (isFetching) {
        return (
            <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-24 rounded-lg border bg-card animate-pulse" />
                ))}
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="p-4 border border-destructive rounded-lg bg-destructive/10">
                <p className="text-sm text-destructive">
                    Failed to load cache configuration: {fetchError.message}
                </p>
            </div>
        );
    }

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

            {/* General Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">General Settings</CardTitle>
                    <CardDescription>Enable or disable caching and choose the backend</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Enable Toggle */}
                    <div className="flex items-center justify-between">
                        <div>
                            <Label className="text-sm font-medium">Cache Enabled</Label>
                            <p className="text-xs text-muted-foreground">Turn caching on or off globally</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={formData.enabled}
                            onClick={() => updateField("enabled", !formData.enabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${formData.enabled ? "bg-primary" : "bg-muted"
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.enabled ? "translate-x-6" : "translate-x-1"
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Backend */}
                    <div className="space-y-2">
                        <Label>Cache Backend</Label>
                        <div className="flex gap-2">
                            {(["redis", "memory"] as const).map((backend) => (
                                <Button
                                    key={backend}
                                    variant={formData.backend === backend ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => updateField("backend", backend)}
                                >
                                    {backend === "redis" ? "Redis" : "In-Memory"}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Cache-Control Respect */}
                    <div className="flex items-center justify-between">
                        <div>
                            <Label className="text-sm font-medium">Respect Cache-Control Headers</Label>
                            <p className="text-xs text-muted-foreground">
                                Honor Cache-Control headers from backend responses
                            </p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={formData.cache_control_respect}
                            onClick={() => updateField("cache_control_respect", !formData.cache_control_respect)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${formData.cache_control_respect ? "bg-primary" : "bg-muted"
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formData.cache_control_respect ? "translate-x-6" : "translate-x-1"
                                    }`}
                            />
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* TTL & Size */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">TTL & Size Limits</CardTitle>
                    <CardDescription>Configure default expiry and maximum cache entry size</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Default TTL (seconds)</Label>
                            <Input
                                type="number"
                                min={1}
                                value={formData.default_ttl || 300}
                                onChange={(e) => updateField("default_ttl", parseInt(e.target.value) || 300)}
                            />
                            <p className="text-xs text-muted-foreground">
                                ≈ {formatDuration(formData.default_ttl || 300)}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Max Entry Size (bytes)</Label>
                            <Input
                                type="number"
                                min={1024}
                                value={formData.max_entry_size || 1048576}
                                onChange={(e) => updateField("max_entry_size", parseInt(e.target.value) || 1048576)}
                            />
                            <p className="text-xs text-muted-foreground">
                                ≈ {formatBytes(formData.max_entry_size || 1048576)}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Cacheable Methods */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Cacheable HTTP Methods</CardTitle>
                    <CardDescription>Select which HTTP methods should have their responses cached</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {HTTP_METHODS.map((method) => {
                            const isSelected = formData.cacheable_methods?.includes(method);
                            return (
                                <Button
                                    key={method}
                                    variant={isSelected ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => toggleMethod(method)}
                                    className="min-w-[70px]"
                                >
                                    {method}
                                </Button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Cacheable Status Codes */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Cacheable Status Codes</CardTitle>
                    <CardDescription>HTTP response codes that are eligible for caching</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {(formData.cacheable_status_codes || []).map((code) => (
                            <Badge key={code} variant="secondary" className="gap-1 pl-2.5">
                                {code}
                                <button
                                    onClick={() => removeStatusCode(code)}
                                    className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <Input
                            type="number"
                            placeholder="e.g. 200"
                            value={newStatusCode}
                            onChange={(e) => setNewStatusCode(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addStatusCode()}
                            className="max-w-[120px]"
                        />
                        <Button variant="outline" size="sm" onClick={addStatusCode}>
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add
                        </Button>
                        {/* Quick-add common codes */}
                        <div className="flex gap-1 ml-2">
                            {COMMON_STATUS_CODES.filter(
                                (c) => !(formData.cacheable_status_codes || []).includes(c)
                            ).map((code) => (
                                <Button
                                    key={code}
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-8 px-2"
                                    onClick={() => {
                                        const current = formData.cacheable_status_codes || [];
                                        updateField("cacheable_status_codes", [...current, code].sort());
                                    }}
                                >
                                    +{code}
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Exclude Paths */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Exclude Paths</CardTitle>
                    <CardDescription>Path patterns that should never be cached</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {(formData.exclude_paths || []).length > 0 ? (
                        <div className="space-y-2">
                            {(formData.exclude_paths || []).map((path) => (
                                <div
                                    key={path}
                                    className="flex items-center justify-between p-2.5 rounded-md border bg-muted/30"
                                >
                                    <code className="text-sm font-mono">{path}</code>
                                    <button
                                        onClick={() => removeExcludePath(path)}
                                        className="text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No excluded paths configured.</p>
                    )}
                    <div className="flex gap-2">
                        <Input
                            placeholder="e.g. /api/auth/*"
                            value={newExcludePath}
                            onChange={(e) => setNewExcludePath(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addExcludePath()}
                        />
                        <Button variant="outline" size="sm" onClick={addExcludePath}>
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
