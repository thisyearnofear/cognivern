"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown } from "lucide-react";

export type DecisionFilter = "approved" | "denied" | "held" | null;

interface DecisionChartProps {
  logs: Array<{
    decision?: string;
    outcome?: string;
    complianceStatus?: string;
  }>;
  loading?: boolean;
  activeFilter?: DecisionFilter;
  onFilterChange?: (filter: DecisionFilter) => void;
}

const COLORS = {
  approved: "#10b981", // emerald-500
  denied: "#ef4444", // red-500
  held: "#f59e0b", // amber-500
};

export function DecisionChart({
  logs,
  loading,
  activeFilter,
  onFilterChange,
}: DecisionChartProps) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Decision Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  const counts = { approved: 0, denied: 0, held: 0 };
  logs.forEach((l) => {
    const status = l.outcome ?? l.complianceStatus ?? l.decision ?? "";
    if (
      status === "approved" ||
      status === "allowed" ||
      status === "compliant"
    ) {
      counts.approved++;
    } else if (status === "denied" || status === "non-compliant") {
      counts.denied++;
    } else {
      counts.held++;
    }
  });

  const total = counts.approved + counts.denied + counts.held;

  const data = [
    { name: "Approved", value: counts.approved, color: COLORS.approved },
    { name: "Denied", value: counts.denied, color: COLORS.denied },
    { name: "Held", value: counts.held, color: COLORS.held },
  ].filter((d) => d.value > 0);

  if (total === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Decision Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="h-48 flex items-center justify-center text-sm text-muted-foreground">
          No decisions yet
        </CardContent>
      </Card>
    );
  }

  const activeIndex = activeFilter
    ? data.findIndex((d) => d.name.toLowerCase() === activeFilter)
    : -1;

  function handlePieClick(_: unknown, index: number) {
    if (!onFilterChange) return;
    const clickedName = data[index]?.name.toLowerCase() as DecisionFilter;
    onFilterChange(activeFilter === clickedName ? null : clickedName);
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">
          Decision Breakdown
        </CardTitle>
        {activeFilter && (
          <button
            type="button"
            onClick={() => onFilterChange?.(null)}
            className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear filter
          </button>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={4}
              dataKey="value"
              stroke="none"
              onClick={handlePieClick}
              className="cursor-pointer"
              animationDuration={500}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  opacity={activeFilter && activeIndex !== index ? 0.3 : 1}
                  strokeWidth={activeIndex === index ? 2 : 0}
                  stroke={activeIndex === index ? entry.color : "none"}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [
                `${value} (${Math.round(((value as number) / total) * 100)}%)`,
                name,
              ]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--card))",
                fontSize: "12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 mt-2">
          {data.map((d) => {
            const filterKey = d.name.toLowerCase() as DecisionFilter;
            const isActive = activeFilter === filterKey;
            return (
              <button
                key={d.name}
                type="button"
                onClick={() => onFilterChange?.(isActive ? null : filterKey)}
                className={`flex items-center gap-1.5 transition-opacity ${
                  activeFilter && !isActive ? "opacity-40" : "opacity-100"
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: d.color }}
                />
                <span className="text-xs text-muted-foreground">
                  {d.name} {Math.round((d.value / total) * 100)}%
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-3 flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown
            className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
          {expanded ? "Hide counts" : "Show counts"}
        </button>
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border space-y-1.5">
            {data.map((d) => (
              <div
                key={d.name}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                  <span>{d.name}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-mono">{d.value}</span>
                  <span>{Math.round((d.value / total) * 100)}%</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border font-medium">
              <span>Total</span>
              <span className="font-mono">{total}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
