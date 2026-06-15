"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

interface ApprovalSparklineProps {
  logs: Array<{
    timestamp: string;
    decision?: string;
    outcome?: string;
    complianceStatus?: string;
  }>;
}

export function ApprovalSparkline({ logs }: ApprovalSparklineProps) {
  if (!logs || logs.length < 2) return null;

  // Sort by timestamp and calculate rolling approval rate
  const sorted = [...logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const data = sorted.map((l, i) => {
    const slice = sorted.slice(0, i + 1);
    const approved = slice.filter(
      (s) =>
        s.outcome === "allowed" ||
        s.complianceStatus === "compliant" ||
        s.decision === "approved",
    ).length;
    return {
      index: i,
      rate: Math.round((approved / slice.length) * 100),
    };
  });

  return (
    <div className="h-8 w-24">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart
          data={data}
          margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
        >
          <Line
            type="monotone"
            dataKey="rate"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
