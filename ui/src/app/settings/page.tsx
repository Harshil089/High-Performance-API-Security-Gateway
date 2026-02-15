"use client";

import { ConfigEditor } from "@/components/settings/ConfigEditor";

export default function SettingsPage() {
    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">
                    View and edit the full gateway configuration as JSON
                </p>
            </div>

            <ConfigEditor />
        </div>
    );
}
