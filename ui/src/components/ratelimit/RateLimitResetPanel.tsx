"use client";

import { useState } from "react";
import { useResetRateLimit } from "@/lib/hooks/useRateLimit";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RotateCcw, CheckCircle, XCircle } from "lucide-react";

export function RateLimitResetPanel() {
    const resetMutation = useResetRateLimit();
    const [ipKey, setIpKey] = useState("");
    const [feedback, setFeedback] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    const showFeedback = (type: "success" | "error", message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    const handleReset = () => {
        const trimmed = ipKey.trim();
        if (!trimmed) return;

        resetMutation.mutate(trimmed, {
            onSuccess: () => {
                showFeedback("success", `Rate limit for "${trimmed}" has been reset.`);
                setIpKey("");
            },
            onError: (err) => {
                showFeedback("error", `Failed to reset: ${err.message}`);
            },
        });
    };

    return (
        <div className="space-y-6">
            {/* Feedback */}
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

            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <RotateCcw className="h-4 w-4" />
                        Reset Rate Limit
                    </CardTitle>
                    <CardDescription>
                        Reset the rate limit counter for a specific client IP address. This restores their full request allowance immediately.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Client IP Address</Label>
                        <div className="flex gap-2">
                            <Input
                                placeholder="e.g. 192.168.1.100"
                                value={ipKey}
                                onChange={(e) => setIpKey(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleReset()}
                                className="max-w-md"
                            />
                            <Button
                                onClick={handleReset}
                                disabled={!ipKey.trim() || resetMutation.isPending}
                            >
                                {resetMutation.isPending ? "Resetting..." : "Reset"}
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                        <p className="text-sm font-medium">When to use this</p>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                            <li>A legitimate client got rate-limited during testing</li>
                            <li>After fixing a client bug that caused excessive requests</li>
                            <li>VIP client needs immediate access restoration</li>
                            <li>During incident response to unblock critical services</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
