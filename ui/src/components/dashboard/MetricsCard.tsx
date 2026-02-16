"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
}

export function MetricsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
}: MetricsCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 md:pb-2 p-3 md:p-6">
        <CardTitle className="text-xs md:text-sm font-medium truncate pr-1">{title}</CardTitle>
        {Icon && <Icon className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground shrink-0" />}
      </CardHeader>
      <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
        <div className="text-lg md:text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {trend && (
          <div className="flex items-center pt-1">
            <span
              className={cn(
                "text-xs font-medium",
                trend.value > 0
                  ? "text-green-600"
                  : trend.value < 0
                  ? "text-red-600"
                  : "text-muted-foreground"
              )}
            >
              {trend.value > 0 && "+"}
              {trend.value}% {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
