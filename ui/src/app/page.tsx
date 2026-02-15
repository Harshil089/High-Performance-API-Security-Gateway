"use client";

import { MetricsOverview } from "@/components/dashboard/MetricsOverview";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Shield, Database, Settings } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor your API Gateway performance and health
        </p>
      </div>

      {/* Metrics Overview */}
      <MetricsOverview />

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <QuickActionCard
          title="Routes"
          description="Manage API routes and backends"
          icon={Activity}
          href="/routes"
        />
        <QuickActionCard
          title="Security"
          description="Configure authentication and security"
          icon={Shield}
          href="/security"
        />
        <QuickActionCard
          title="Cache"
          description="Monitor and manage cache"
          icon={Database}
          href="/cache"
        />
        <QuickActionCard
          title="Settings"
          description="Gateway configuration"
          icon={Settings}
          href="/settings"
        />
      </div>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
          <CardDescription>
            Gateway status and configuration details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Gateway URL
              </div>
              <div className="text-sm">
                {process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8080"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Admin UI Version
              </div>
              <div className="text-sm">1.0.0</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Environment
              </div>
              <div className="text-sm">
                {process.env.NODE_ENV || "development"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Auto-refresh Interval
              </div>
              <div className="text-sm">
                {(parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL || "5000") / 1000).toFixed(0)}s
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

function QuickActionCard({ title, description, icon: Icon, href }: QuickActionCardProps) {
  return (
    <Link href={href}>
      <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <CardDescription className="text-xs">{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
