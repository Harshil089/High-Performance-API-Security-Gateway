"use client";

import { RateLimitConfigPanel } from "@/components/ratelimit/RateLimitConfigPanel";
import { RateLimitResetPanel } from "@/components/ratelimit/RateLimitResetPanel";
import { Settings, RotateCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function RateLimitPage() {
    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Rate Limiting</h1>
                <p className="text-muted-foreground">
                    Configure request rate limits and manage rate-limited clients
                </p>
            </div>

            {/* Content */}
            <Tabs defaultValue="config" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="config" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Configuration
                    </TabsTrigger>
                    <TabsTrigger value="reset" className="flex items-center gap-2">
                        <RotateCcw className="h-4 w-4" />
                        Reset
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="config" className="mt-6">
                    <RateLimitConfigPanel />
                </TabsContent>

                <TabsContent value="reset" className="mt-6">
                    <RateLimitResetPanel />
                </TabsContent>
            </Tabs>
        </div>
    );
}
