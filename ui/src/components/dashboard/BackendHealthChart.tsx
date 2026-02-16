"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackendHealth } from "@/types/gateway";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

interface BackendHealthChartProps {
  backends: BackendHealth[];
}

export function BackendHealthChart({ backends }: BackendHealthChartProps) {
  const isMobile = useIsMobile();

  const data = backends.map((backend) => ({
    name: backend.url.replace(/^https?:\/\//, "").substring(0, isMobile ? 15 : 30),
    errors: backend.errorCount,
    status: backend.healthy ? "healthy" : "unhealthy",
  }));

  const healthyCount = backends.filter((b) => b.healthy).length;
  const totalCount = backends.length;
  const chartHeight = isMobile ? 220 : 300;

  if (backends.length === 0) {
    return (
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg">Backend Health</CardTitle>
          <CardDescription className="text-xs md:text-sm">Backend service error monitoring</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
          <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height: chartHeight }}>
            No backends configured
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-base md:text-lg">Backend Health</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          {healthyCount}/{totalCount} healthy
        </CardDescription>
      </CardHeader>
      <CardContent className="p-2 md:p-6 md:pt-0">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={data} margin={isMobile ? { left: -20, right: 4, bottom: 40 } : undefined}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              fontSize={isMobile ? 9 : 12}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              height={isMobile ? 60 : 80}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={isMobile ? 10 : 12}
              tickLine={false}
              width={isMobile ? 30 : 60}
              label={isMobile ? undefined : { value: "Error Count", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: isMobile ? 11 : 14,
              }}
              formatter={(value) => [`${value} errors`, "Error Count"]}
            />
            <Bar dataKey="errors" name="Error Count" radius={[4, 4, 0, 0]} isAnimationActive={!isMobile}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.status === "healthy" ? "#10b981" : "#ef4444"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
