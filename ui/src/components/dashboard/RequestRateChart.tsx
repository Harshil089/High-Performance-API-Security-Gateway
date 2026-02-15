"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

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

export function RequestRateChart({ currentRequests, activeConnections }: RequestRateChartProps) {
  const [data, setData] = useState<DataPoint[]>([]);

  useEffect(() => {
    const now = new Date();
    const newPoint: DataPoint = {
      time: now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      requests: currentRequests,
      timestamp: now.getTime(),
    };

    setData((prevData) => {
      const updatedData = [...prevData, newPoint];
      // Keep only the last MAX_POINTS
      if (updatedData.length > MAX_POINTS) {
        return updatedData.slice(updatedData.length - MAX_POINTS);
      }
      return updatedData;
    });
  }, [currentRequests]);

  // Calculate request rate (requests per second over the time window)
  const requestRate = data.length > 1
    ? ((data[data.length - 1].requests - data[0].requests) / ((data[data.length - 1].timestamp - data[0].timestamp) / 1000)).toFixed(2)
    : "0";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request Activity</CardTitle>
        <CardDescription>
          Real-time monitoring • Rate: {requestRate} req/s • Active: {activeConnections} connections
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length < 2 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Collecting data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="time"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => formatNumber(value)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                }}
                formatter={(value) => [formatNumber(value as number), "Total Requests"]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="requests"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                name="Total Requests"
                animationDuration={500}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
