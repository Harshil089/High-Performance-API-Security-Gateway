"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface StatusCodeChartProps {
  statusCodes: {
    "2xx": number;
    "4xx": number;
    "5xx": number;
  };
}

const COLORS = {
  "2xx": "#10b981", // green
  "4xx": "#f59e0b", // amber
  "5xx": "#ef4444", // red
};

export function StatusCodeChart({ statusCodes }: StatusCodeChartProps) {
  const data = [
    { name: "2xx Success", value: statusCodes["2xx"], fill: COLORS["2xx"] },
    { name: "4xx Client Error", value: statusCodes["4xx"], fill: COLORS["4xx"] },
    { name: "5xx Server Error", value: statusCodes["5xx"], fill: COLORS["5xx"] },
  ].filter((item) => item.value > 0);

  const total = statusCodes["2xx"] + statusCodes["4xx"] + statusCodes["5xx"];

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status Code Distribution</CardTitle>
          <CardDescription>HTTP response status breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Code Distribution</CardTitle>
        <CardDescription>
          HTTP response status breakdown ({total.toLocaleString()} total)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(1)}%)`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [(value as number).toLocaleString(), "Requests"]}
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
