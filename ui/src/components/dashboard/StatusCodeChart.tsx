"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

interface StatusCodeChartProps {
  statusCodes: {
    "2xx": number;
    "4xx": number;
    "5xx": number;
  };
}

const COLORS = {
  "2xx": "#10b981",
  "4xx": "#f59e0b",
  "5xx": "#ef4444",
};

export function StatusCodeChart({ statusCodes }: StatusCodeChartProps) {
  const isMobile = useIsMobile();
  const data = [
    { name: "2xx Success", value: statusCodes["2xx"], fill: COLORS["2xx"] },
    { name: "4xx Client Error", value: statusCodes["4xx"], fill: COLORS["4xx"] },
    { name: "5xx Server Error", value: statusCodes["5xx"], fill: COLORS["5xx"] },
  ].filter((item) => item.value > 0);

  const total = statusCodes["2xx"] + statusCodes["4xx"] + statusCodes["5xx"];
  const chartHeight = isMobile ? 220 : 300;

  if (total === 0) {
    return (
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg">Status Codes</CardTitle>
          <CardDescription className="text-xs md:text-sm">HTTP response status breakdown</CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
          <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height: chartHeight }}>
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-base md:text-lg">Status Codes</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          {total.toLocaleString()} total responses
        </CardDescription>
      </CardHeader>
      <CardContent className="p-2 md:p-6 md:pt-0">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={isMobile
                ? ({ percent }) => `${((percent || 0) * 100).toFixed(0)}%`
                : ({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(1)}%)`
              }
              outerRadius={isMobile ? 60 : 80}
              fill="#8884d8"
              dataKey="value"
              isAnimationActive={!isMobile}
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
                fontSize: isMobile ? 11 : 14,
              }}
            />
            <Legend wrapperStyle={{ fontSize: isMobile ? 11 : 14 }} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
