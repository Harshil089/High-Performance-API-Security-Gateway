"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

interface DataPoint {
  time: string;
  requests: number;
  timestamp: number;
}

interface RequestRateChartProps {
  currentRequests: number;
  activeConnections: number;
}

const MAX_POINTS = 20;
const MAX_POINTS_MOBILE = 10;

export function RequestRateChart({ currentRequests, activeConnections }: RequestRateChartProps) {
  const [data, setData] = useState<DataPoint[]>([]);
  const isMobile = useIsMobile();
  const maxPoints = isMobile ? MAX_POINTS_MOBILE : MAX_POINTS;

  useEffect(() => {
    const now = new Date();
    const newPoint: DataPoint = {
      time: now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      requests: currentRequests,
      timestamp: now.getTime(),
    };

    setData((prevData) => {
      const updatedData = [...prevData, newPoint];
      if (updatedData.length > maxPoints) {
        return updatedData.slice(updatedData.length - maxPoints);
      }
      return updatedData;
    });
  }, [currentRequests, maxPoints]);

  const requestRate = data.length > 1
    ? ((data[data.length - 1].requests - data[0].requests) / ((data[data.length - 1].timestamp - data[0].timestamp) / 1000)).toFixed(2)
    : "0";

  const chartHeight = isMobile ? 200 : 300;

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-base md:text-lg">Request Activity</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          {requestRate} req/s | {activeConnections} active
        </CardDescription>
      </CardHeader>
      <CardContent className="p-2 md:p-6 md:pt-0">
        {data.length < 2 ? (
          <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height: chartHeight }}>
            Collecting data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={data} margin={isMobile ? { left: -20, right: 4, top: 4, bottom: 4 } : undefined}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="time"
                stroke="hsl(var(--muted-foreground))"
                fontSize={isMobile ? 10 : 12}
                tickLine={false}
                interval={isMobile ? 2 : 0}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={isMobile ? 10 : 12}
                tickLine={false}
                tickFormatter={(value) => formatNumber(value)}
                width={isMobile ? 40 : 60}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: isMobile ? 11 : 14,
                }}
                formatter={(value) => [formatNumber(value as number), "Requests"]}
              />
              <Line
                type="monotone"
                dataKey="requests"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                name="Total Requests"
                isAnimationActive={!isMobile}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
