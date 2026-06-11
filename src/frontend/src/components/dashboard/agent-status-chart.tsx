"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown } from "lucide-react";

interface AgentStatusChartProps {
  agents: Array<{
    name?: string;
    status: string;
    trades: number;
    chain: string;
  }>;
  loading?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  active: "#10b981",
  paused: "#f59e0b",
  inactive: "#6b7280",
};

export function AgentStatusChart({ agents, loading }: AgentStatusChartProps) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card">
        <div className="p-4 pb-2">
          <div className="text-sm font-medium">Agent Status</div>
        </div>
        <div className="p-4 pt-2">
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!agents || agents.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <div className="p-4 pb-2">
          <div className="text-sm font-medium">Agent Status</div>
        </div>
        <div className="p-4 pt-2 h-48 flex items-center justify-center text-sm text-muted-foreground">
          No agents yet
        </div>
      </div>
    );
  }

  const counts = { active: 0, paused: 0, inactive: 0 };
  agents.forEach((a) => {
    if (a.status === "active") counts.active++;
    else if (a.status === "paused") counts.paused++;
    else counts.inactive++;
  });

  const data = [
    { name: "Active", value: counts.active, color: STATUS_COLORS.active },
    { name: "Paused", value: counts.paused, color: STATUS_COLORS.paused },
    { name: "Inactive", value: counts.inactive, color: STATUS_COLORS.inactive },
  ];

  const totalTrades = agents.reduce((sum, a) => sum + (a.trades || 0), 0);

  return (
    <div className="rounded-xl border bg-card">
      <div className="p-4 pb-2">
        <div className="text-sm font-medium">Agent Status</div>
      </div>
      <div className="p-4 pt-2">
        <ResponsiveContainer width="100%" height={140}>
          <BarChart
            data={data}
            margin={{ top: 5, right: 5, bottom: 0, left: -20 }}
          >
            <XAxis
              dataKey="name"
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
              formatter={(value) => [`${value} agents`, "Count"]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground">Total Trades</span>
          <span className="text-sm font-semibold">
            {totalTrades.toLocaleString()}
          </span>
        </div>
        {agents.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full mt-3 flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            {expanded ? "Hide details" : "Show per-agent breakdown"}
          </button>
        )}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border space-y-1.5 max-h-32 overflow-y-auto">
            {agents.map((a, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor:
                        STATUS_COLORS[a.status] || STATUS_COLORS.inactive,
                    }}
                  />
                  <span className="truncate">{a.name || `Agent ${i + 1}`}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 text-muted-foreground">
                  <span>{a.chain}</span>
                  <span className="font-mono">{a.trades}t</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
