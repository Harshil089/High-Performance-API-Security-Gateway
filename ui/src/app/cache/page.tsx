"use client";

import { CacheStatsOverview } from "@/components/cache/CacheStatsOverview";
import { CacheConfigPanel } from "@/components/cache/CacheConfigPanel";
import { CacheClearPanel } from "@/components/cache/CacheClearPanel";
import { BarChart3, Settings, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CachePage() {
    return (
        <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
            {/* Header */}
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Cache Management</h1>
                <p className="text-sm md:text-base text-muted-foreground">
                    Monitor cache performance and manage cache entries
                </p>
            </div>

            {/* Content */}
            <Tabs defaultValue="stats" className="w-full">
                <TabsList className="grid w-full grid-cols-3 md:max-w-2xl">
                    <TabsTrigger value="stats" className="flex items-center gap-1.5 md:gap-2">
                        <BarChart3 className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Statistics</span>
                        <span className="sm:hidden">Stats</span>
                    </TabsTrigger>
                    <TabsTrigger value="config" className="flex items-center gap-1.5 md:gap-2">
                        <Settings className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Configuration</span>
                        <span className="sm:hidden">Config</span>
                    </TabsTrigger>
                    <TabsTrigger value="clear" className="flex items-center gap-1.5 md:gap-2">
                        <Trash2 className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">Clear Cache</span>
                        <span className="sm:hidden">Clear</span>
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
