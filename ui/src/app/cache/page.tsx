"use client";

import { CacheStatsOverview } from "@/components/cache/CacheStatsOverview";
import { CacheConfigPanel } from "@/components/cache/CacheConfigPanel";
import { CacheClearPanel } from "@/components/cache/CacheClearPanel";
import { BarChart3, Settings, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CachePage() {
    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Cache Management</h1>
                <p className="text-muted-foreground">
                    Monitor cache performance, configure caching rules, and manage cache entries
                </p>
            </div>

            {/* Content */}
            <Tabs defaultValue="stats" className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-2xl">
                    <TabsTrigger value="stats" className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Statistics
                    </TabsTrigger>
                    <TabsTrigger value="config" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Configuration
                    </TabsTrigger>
                    <TabsTrigger value="clear" className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4" />
                        Clear Cache
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="stats" className="mt-6">
                    <CacheStatsOverview />
                </TabsContent>

                <TabsContent value="config" className="mt-6">
                    <CacheConfigPanel />
                </TabsContent>

                <TabsContent value="clear" className="mt-6">
                    <CacheClearPanel />
                </TabsContent>
            </Tabs>
        </div>
    );
}
