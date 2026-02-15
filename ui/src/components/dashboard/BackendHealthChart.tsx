"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackendHealth } from "@/types/gateway";

interface BackendHealthChartProps {
  backends: BackendHealth[];
}

export function BackendHealthChart({ backends }: BackendHealthChartProps) {
  const data = backends.map((backend) => ({
    name: backend.url.replace(/^https?:\/\//, "").substring(0, 30),
    errors: backend.errorCount,
    status: backend.healthy ? "healthy" : "unhealthy",
  }));

  const healthyCount = backends.filter((b) => b.healthy).length;
  const totalCount = backends.length;

  if (backends.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Backend Health</CardTitle>
          <CardDescription>Backend service error monitoring</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No backends configured
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backend Health</CardTitle>
        <CardDescription>
          Service status: {healthyCount}/{totalCount} healthy
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              label={{ value: "Error Count", angle: -90, position: "insideLeft" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
              formatter={(value) => [`${value} errors`, "Error Count"]}
            />
            <Legend />
            <Bar dataKey="errors" name="Error Count" radius={[4, 4, 0, 0]}>
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
