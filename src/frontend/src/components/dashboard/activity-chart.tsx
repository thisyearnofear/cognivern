"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import { Skeleton } from "@/components/ui/skeleton";

type TimeRange = "7d" | "14d" | "30d";

const RANGE_DAYS: Record<TimeRange, number> = { "7d": 7, "14d": 14, "30d": 30 };

interface ActivityChartProps {
  logs: Array<{
    timestamp: string;
    decision?: string;
    outcome?: string;
    complianceStatus?: string;
  }>;
  loading?: boolean;
}

export function ActivityChart({ logs, loading }: ActivityChartProps) {
  const [range, setRange] = useState<TimeRange>("14d");

  const data = useMemo(() => {
    if (!logs || logs.length === 0) return [];

    // Use most recent log as reference point (avoids impure Date.now() in render)
    const latest = Math.max(
      ...logs.map((l) => new Date(l.timestamp).getTime()),
    );
    const cutoff = latest - RANGE_DAYS[range] * 86_400_000;

    const grouped = new Map<
      string,
      { date: string; total: number; approved: number; denied: number }
    >();

    logs
      .filter((l) => new Date(l.timestamp).getTime() >= cutoff)
      .forEach((l) => {
        const date = new Date(l.timestamp).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        const status = l.outcome ?? l.complianceStatus ?? l.decision ?? "";
        const existing = grouped.get(date) || {
          date,
          total: 0,
          approved: 0,
          denied: 0,
        };
        existing.total++;
        if (
          status === "approved" ||
          status === "allowed" ||
          status === "compliant"
        ) {
          existing.approved++;
        } else if (status === "denied" || status === "non-compliant") {
          existing.denied++;
        }
        grouped.set(date, existing);
      });

    return Array.from(grouped.values());
  }, [logs, range]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card">
        <div className="p-4 pb-2">
          <div className="text-sm font-medium">Activity Volume</div>
        </div>
        <div className="p-4 pt-2">
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <div className="p-4 pb-2">
          <div className="text-sm font-medium">Activity Volume</div>
        </div>
        <div className="p-4 pt-2 h-48 flex items-center justify-center text-sm text-muted-foreground">
          No activity yet
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card h-full min-h-[280px] flex flex-col">
      <div className="p-4 pb-2 flex-row items-center justify-between space-y-0 flex">
        <div className="text-sm font-medium">Activity Volume</div>
        <div className="flex gap-1">
          {(["7d", "14d", "30d"] as TimeRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-2 py-0.5 text-[11px] rounded-md transition-colors ${
                range === r
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 pt-2 flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart
            data={data}
            margin={{ top: 5, right: 5, bottom: 0, left: -15 }}
          >
            <defs>
              <linearGradient id="approvedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="deniedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                fontSize: "12px",
              }}
            />
            <Area
              type="monotone"
              dataKey="approved"
              stackId="1"
              stroke="#10b981"
              strokeWidth={1.5}
              fill="url(#approvedGrad)"
              animationDuration={600}
            />
            <Area
              type="monotone"
              dataKey="denied"
              stackId="1"
              stroke="#ef4444"
              strokeWidth={1.5}
              fill="url(#deniedGrad)"
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-muted-foreground">Approved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-xs text-muted-foreground">Denied</span>
          </div>
        </div>
      </div>
    </div>
  );
}
