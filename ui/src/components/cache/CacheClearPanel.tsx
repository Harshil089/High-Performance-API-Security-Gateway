"use client";

import { useState } from "react";
import { useClearCache } from "@/lib/hooks/useCache";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, Search, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

export function CacheClearPanel() {
    const clearMutation = useClearCache();
    const [pattern, setPattern] = useState("");
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [feedback, setFeedback] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    const showFeedback = (type: "success" | "error", message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    const handleClearAll = () => {
        clearMutation.mutate(undefined, {
            onSuccess: () => {
                showFeedback("success", "All cache entries have been cleared successfully.");
                setConfirmOpen(false);
            },
            onError: (err) => {
                showFeedback("error", `Failed to clear cache: ${err.message}`);
                setConfirmOpen(false);
            },
        });
    };

    const handleClearPattern = () => {
        const trimmed = pattern.trim();
        if (!trimmed) return;

        clearMutation.mutate(trimmed, {
            onSuccess: () => {
                showFeedback("success", `Cache entries matching "${trimmed}" have been cleared.`);
                setPattern("");
            },
            onError: (err) => {
                showFeedback("error", `Failed to clear cache: ${err.message}`);
            },
        });
    };

    return (
        <div className="space-y-6">
            {/* Feedback Banner */}
            {feedback && (
                <div
                    className={`flex items-center gap-2 p-3 rounded-lg border ${feedback.type === "success"
                            ? "border-green-500/50 bg-green-500/10 text-green-700"
                            : "border-destructive/50 bg-destructive/10 text-destructive"
                        }`}
                >
                    {feedback.type === "success" ? (
                        <CheckCircle className="h-4 w-4 shrink-0" />
                    ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                    )}
                    <span className="text-sm">{feedback.message}</span>
                </div>
            )}

            {/* Clear All */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Trash2 className="h-4 w-4 text-destructive" />
                        Clear All Cache
                    </CardTitle>
                    <CardDescription>
                        Remove all cached responses from the gateway. This action cannot be undone.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                        <DialogTrigger asChild>
                            <Button variant="destructive" disabled={clearMutation.isPending}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Clear Entire Cache
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-destructive" />
                                    Confirm Cache Clear
                                </DialogTitle>
                                <DialogDescription>
                                    This will remove <strong>all cached responses</strong> from the gateway.
                                    All subsequent requests will be forwarded to backend services until new
                                    cache entries are built up. This may temporarily increase backend load.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={handleClearAll}
                                    disabled={clearMutation.isPending}
                                >
                                    {clearMutation.isPending ? "Clearing..." : "Yes, Clear All"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardContent>
            </Card>

            {/* Clear by Pattern */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        Clear by Pattern
                    </CardTitle>
                    <CardDescription>
                        Remove cache entries matching a specific pattern using Redis glob-style syntax.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Pattern</Label>
                        <div className="flex gap-2">
                            <Input
                                placeholder="e.g. cache:GET:/api/users/*"
                                value={pattern}
                                onChange={(e) => setPattern(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleClearPattern()}
                                className="font-mono text-sm"
                            />
                            <Button
                                onClick={handleClearPattern}
                                disabled={!pattern.trim() || clearMutation.isPending}
                            >
                                {clearMutation.isPending ? "Clearing..." : "Clear Pattern"}
                            </Button>
                        </div>
                    </div>

                    {/* Pattern Examples */}
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                        <p className="text-sm font-medium">Pattern Examples</p>
                        <div className="grid gap-1.5 text-xs">
                            <div className="flex items-start gap-2">
                                <code className="bg-muted px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
                                    cache:GET:/api/users/*
                                </code>
                                <span className="text-muted-foreground">
                                    Clear all cached GET requests under /api/users/
                                </span>
                            </div>
                            <div className="flex items-start gap-2">
                                <code className="bg-muted px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
                                    cache:*:/api/products/*
                                </code>
                                <span className="text-muted-foreground">
                                    Clear all methods for /api/products/ routes
                                </span>
                            </div>
                            <div className="flex items-start gap-2">
                                <code className="bg-muted px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
                                    cache:GET:*
                                </code>
                                <span className="text-muted-foreground">
                                    Clear all cached GET requests
                                </span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
