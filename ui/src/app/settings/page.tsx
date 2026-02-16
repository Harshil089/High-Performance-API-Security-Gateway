"use client";

import { ConfigEditor } from "@/components/settings/ConfigEditor";

export default function SettingsPage() {
    return (
        <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-sm md:text-base text-muted-foreground">
                    View and edit gateway configuration as JSON
                </p>
            </div>

            <ConfigEditor />
        </div>
    );
}
