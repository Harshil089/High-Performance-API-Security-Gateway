"use client";

import { RateLimitConfigPanel } from "@/components/ratelimit/RateLimitConfigPanel";
import { RateLimitResetPanel } from "@/components/ratelimit/RateLimitResetPanel";
import { Settings, RotateCcw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function RateLimitPage() {
    return (
        <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
            {/* Header */}
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Rate Limiting</h1>
                <p className="text-sm md:text-base text-muted-foreground">
                    Configure request rate limits and manage clients
                </p>
            </div>

            {/* Content */}
            <Tabs defaultValue="config" className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:max-w-md">
                    <TabsTrigger value="config" className="flex items-center gap-1.5 md:gap-2">
                        <Settings className="h-4 w-4 shrink-0" />
                        Config
                    </TabsTrigger>
                    <TabsTrigger value="reset" className="flex items-center gap-1.5 md:gap-2">
                        <RotateCcw className="h-4 w-4 shrink-0" />
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
