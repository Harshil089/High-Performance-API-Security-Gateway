"use client";

import { useState, useEffect } from "react";
import { useConfig } from "@/lib/hooks/useConfig";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, RotateCcw, AlertCircle, CheckCircle, XCircle, Lock, Unlock } from "lucide-react";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
    ssr: false,
    loading: () => (
        <div className="h-[400px] md:h-[600px] rounded-lg border bg-card animate-pulse flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading editor...</p>
        </div>
    ),
});

export function ConfigEditor() {
    const { config, isLoading, error: fetchError, updateConfig, isUpdating } = useConfig();
    const isMobile = useIsMobile();

    const [editorValue, setEditorValue] = useState("");
    const [serverValue, setServerValue] = useState("");
    const [hasChanges, setHasChanges] = useState(false);
    const [jsonError, setJsonError] = useState<string | null>(null);
    const [readOnly, setReadOnly] = useState(false);
    const [feedback, setFeedback] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    useEffect(() => {
        if (config) {
            const formatted = JSON.stringify(config, null, 2);
            setServerValue(formatted);
            if (!hasChanges) {
                setEditorValue(formatted);
            }
        }
    }, [config, hasChanges]);

    const handleEditorChange = (value: string | undefined) => {
        const v = value ?? "";
        setEditorValue(v);
        setHasChanges(v !== serverValue);

        try {
            JSON.parse(v);
            setJsonError(null);
        } catch (e: any) {
            setJsonError(e.message);
        }
    };

    const showFeedback = (type: "success" | "error", message: string) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback(null), 4000);
    };

    const handleSave = () => {
        if (jsonError) return;

        try {
            const parsed = JSON.parse(editorValue);
            updateConfig(parsed, {
                onSuccess: () => {
                    setHasChanges(false);
                    setServerValue(editorValue);
                    showFeedback("success", "Configuration saved successfully.");
                },
                onError: (err: Error) => {
                    showFeedback("error", `Failed to save: ${err.message}`);
                },
            });
        } catch {
            showFeedback("error", "Invalid JSON — cannot save.");
        }
    };

    const handleReset = () => {
        setEditorValue(serverValue);
        setHasChanges(false);
        setJsonError(null);
    };

    if (isLoading) {
        return (
            <div className="h-[400px] md:h-[600px] rounded-lg border bg-card animate-pulse" />
        );
    }

    if (fetchError) {
        return (
            <div className="p-4 border border-destructive rounded-lg bg-destructive/10">
                <p className="text-sm text-destructive">
                    Failed to load configuration: {fetchError.message}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3 md:space-y-4">
            {/* Feedback */}
            {feedback && (
                <div
                    className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${feedback.type === "success"
                        ? "border-green-500/50 bg-green-500/10 text-green-700"
                        : "border-destructive/50 bg-destructive/10 text-destructive"
                        }`}
                >
                    {feedback.type === "success" ? (
                        <CheckCircle className="h-4 w-4 shrink-0" />
                    ) : (
                        <XCircle className="h-4 w-4 shrink-0" />
                    )}
                    <span className="text-xs md:text-sm">{feedback.message}</span>
                </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReadOnly(!readOnly)}
                    >
                        {readOnly ? (
                            <>
                                <Lock className="h-3.5 w-3.5 md:mr-1" />
                                <span className="hidden md:inline">Read Only</span>
                            </>
                        ) : (
                            <>
                                <Unlock className="h-3.5 w-3.5 md:mr-1" />
                                <span className="hidden md:inline">Editing</span>
                            </>
                        )}
                    </Button>
                    {jsonError && (
                        <Badge variant="destructive" className="text-[10px] md:text-xs">
                            JSON Error
                        </Badge>
                    )}
                    {hasChanges && !jsonError && (
                        <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30 text-[10px] md:text-xs">
                            Unsaved
                        </Badge>
                    )}
                </div>
                <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasChanges}>
                        <RotateCcw className="h-3.5 w-3.5 md:mr-1" />
                        <span className="hidden md:inline">Reset</span>
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={!hasChanges || !!jsonError || isUpdating || readOnly}
                    >
                        <Save className="h-3.5 w-3.5 md:mr-1" />
                        <span className="hidden md:inline">{isUpdating ? "Saving..." : "Save"}</span>
                        <span className="md:hidden">{isUpdating ? "..." : "Save"}</span>
                    </Button>
                </div>
            </div>

            {/* JSON Error Detail */}
            {jsonError && (
                <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/50 bg-destructive/10">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-destructive">Invalid JSON</p>
                        <p className="text-xs text-destructive/80 mt-0.5 font-mono break-all">{jsonError}</p>
                    </div>
                </div>
            )}

            {/* Editor */}
            <Card className="overflow-hidden">
                <CardContent className="p-0">
                    {isMobile ? (
                        <textarea
                            className="w-full h-[400px] p-3 font-mono text-xs bg-zinc-900 text-zinc-100 resize-none focus:outline-none touch-scroll"
                            value={editorValue}
                            onChange={(e) => handleEditorChange(e.target.value)}
                            readOnly={readOnly}
                            spellCheck={false}
                            autoCapitalize="off"
                            autoCorrect="off"
                        />
                    ) : (
                        <MonacoEditor
                            height="600px"
                            language="json"
                            theme="vs-dark"
                            value={editorValue}
                            onChange={handleEditorChange}
                            options={{
                                readOnly,
                                minimap: { enabled: false },
                                fontSize: 13,
                                lineNumbers: "on",
                                scrollBeyondLastLine: false,
                                wordWrap: "on",
                                formatOnPaste: true,
                                automaticLayout: true,
                                tabSize: 2,
                                padding: { top: 16 },
                            }}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
