/**
 * Leaderboard - Displays agent performance rankings
 * Extracted from UnifiedDashboard for better modularity
 */

import { designTokens } from "../../styles/design-system";
import { DataTable, Badge, AgentCard } from "../ui";
import { Column } from "../ui/DataTable";
import { AgentSummary } from "./utils/types";
import * as styles from "./UnifiedDashboard.styles";

interface LeaderboardProps {
  agents: AgentSummary[];
}

export const Leaderboard = ({ agents }: LeaderboardProps) => {
  const columns: Column<AgentSummary>[] = [
    {
      key: "name",
      title: "Agent",
      render: (val, agent) => (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ fontWeight: 700 }}>{val}</div>
          <Badge
            variant={agent.status === "active" ? "success" : "secondary"}
            size="sm"
          >
            {agent.status}
          </Badge>
        </div>
      ),
      sortable: true,
    },
    {
      key: "type",
      title: "Type",
      render: (val) => (
        <span
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: designTokens.colors.text.secondary,
          }}
        >
          {val}
        </span>
      ),
      sortable: true,
    },
    {
      key: "winRate",
      title: "Win Rate",
      render: (val) => (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "60px",
              height: "6px",
              background: "#f0f0ed",
              borderRadius: "3px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${(val ?? 0) * 100}%`,
                background: designTokens.colors.semantic.success[500],
              }}
            />
          </div>
          <span style={{ fontWeight: 600 }}>{((val ?? 0) * 100).toFixed(1)}%</span>
        </div>
      ),
      sortable: true,
      align: "left",
    },
    {
      key: "totalReturn",
      title: "Return",
      render: (val) => (
        <span
          style={{
            fontWeight: 700,
            color:
              (val ?? 0) >= 0
                ? designTokens.colors.semantic.success[600]
                : designTokens.colors.semantic.error[600],
          }}
        >
          {(val ?? 0) >= 0 ? "+" : ""}
          {((val ?? 0) * 100).toFixed(2)}%
        </span>
      ),
      sortable: true,
      align: "right",
    },
    {
      key: "lastActive",
      title: "Last Seen",
      render: (val) => (
        <span
          style={{
            fontSize: "12px",
            color: designTokens.colors.text.secondary,
          }}
        >
          {val ? new Date(val).toLocaleTimeString() : "N/A"}
        </span>
      ),
      sortable: true,
      align: "right",
    },
  ];

  return (
    <DataTable
      data={agents}
      columns={columns}
      searchable={false}
      pagination={{
        current: 1,
        pageSize: 6,
        total: agents.length,
        onChange: () => {},
      }}
    />
  );
};

interface AgentGridProps {
  agents: AgentSummary[];
  columns: number;
}

export const AgentGrid = ({ agents, columns }: AgentGridProps) => (
  <div css={styles.agentGridStyles(columns)}>
    {agents.map((agent) => (
      <AgentCard key={agent.id} agent={agent} />
    ))}
  </div>
);

interface AgentCarouselProps {
  agents: AgentSummary[];
}

export const AgentCarousel = ({ agents }: AgentCarouselProps) => (
  <div css={styles.carouselStyles}>
    {agents.map((agent) => (
      <div key={agent.id} css={styles.carouselItemStyles}>
        <AgentCard key={agent.id} agent={agent} compact />
      </div>
    ))}
  </div>
);

export default Leaderboard;
