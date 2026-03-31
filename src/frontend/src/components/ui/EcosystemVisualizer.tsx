/** @jsxImportSource @emotion/react */
import { useState, useMemo } from "react";
import styled from "@emotion/styled";
import { keyframes, css } from "@emotion/react";
import { LayoutGrid, Network } from "lucide-react";
import { designTokens } from "../../styles/design-system";
import { useIntentStore } from "../../stores/intentStore";
import { useBreakpoint } from "../../hooks/useMediaQuery";
import { DataTable, Column } from "./DataTable";
import { Badge } from "./Badge";

/**
 * EcosystemVisualizer - A high-end spatial representation of the agentic ecosystem.
 * Utilizes SVG and CSS animations to deliver the "wow factor" and marketing intrigue.
 *
 * CORE PRINCIPLES:
 * - WOW FACTOR: Ambient glows, floating nodes, and interactive pulses.
 * - MODULAR: Self-contained visualization layer.
 * - ENHANCEMENT FIRST: Provides a next-gen HUD for the platform state.
 */

export interface Node {
  id: string;
  x: number;
  y: number;
  type: "agent" | "policy" | "system";
  label: string;
  status: "active" | "warning" | "idle" | string;
  pulse?: boolean;
}

interface EcosystemVisualizerProps {
  nodes?: Node[];
  loading?: boolean;
  onNodeClick?: (node: Node) => void;
  title?: string;
}

const pulseGlow = keyframes`
  0% { transform: scale(1); opacity: 0.2; }
  50% { transform: scale(1.5); opacity: 0.4; }
  100% { transform: scale(1); opacity: 0.2; }
`;

const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
`;

const Container = styled.div<{ isListMode?: boolean }>`
  position: relative;
  width: 100%;
  height: ${({ isListMode }) => (isListMode ? "auto" : "500px")};
  background: ${({ isListMode }) =>
    isListMode
      ? designTokens.colors.neutral[900]
      : "radial-gradient(circle at center, #0f172a 0%, #020617 100%)"};
  border-radius: ${designTokens.borderRadius["2xl"]};
  overflow: hidden;
  border: 1px solid ${designTokens.colors.neutral[800]};
  cursor: ${({ isListMode }) => (isListMode ? "default" : "crosshair")};
  transition: all 0.3s ease;
`;

const ViewToggle = styled.button<{ active: boolean }>`
  background: ${({ active }) =>
    active ? designTokens.colors.primary[500] : "transparent"};
  border: 1px solid
    ${({ active }) =>
      active ? designTokens.colors.primary[500] : designTokens.colors.neutral[700]};
  color: ${({ active }) =>
    active ? designTokens.colors.neutral[0] : designTokens.colors.neutral[400]};
  padding: 6px;
  border-radius: ${designTokens.borderRadius.md};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 10;
  pointer-events: auto;

  &:hover {
    border-color: ${designTokens.colors.primary[400]};
    color: ${designTokens.colors.primary[400]};
  }
`;

const Controls = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  gap: 8px;
  z-index: 10;
`;

const SvgCanvas = styled.svg`
  width: 100%;
  height: 100%;
`;

const NodeGroup = styled.g<{ active?: boolean }>`
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: ${float} 6s ease-in-out infinite;

  &:hover {
    filter: brightness(1.3) drop-shadow(0 0 8px rgba(14, 165, 233, 0.5));
  }
`;

const GlowCircle = styled.circle<{ color: string }>`
  fill: ${({ color }) => color};
  filter: blur(8px);
  animation: ${pulseGlow} 3s ease-in-out infinite;
`;

const ConnectionLine = styled.line`
  stroke: ${designTokens.colors.primary[500]};
  stroke-width: 1;
  stroke-opacity: 0.15;
  stroke-dasharray: 4 4;
  animation: lineDash 20s linear infinite;

  @keyframes lineDash {
    to {
      stroke-dashoffset: -100;
    }
  }
`;

const HUDOverlay = styled.div`
  position: absolute;
  top: 20px;
  left: 20px;
  pointer-events: none;
  font-family: ${designTokens.typography.fontFamily.mono.join(", ")};
  color: ${designTokens.colors.primary[400]};
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  text-shadow: 0 0 10px rgba(14, 165, 233, 0.5);
`;

export const EcosystemVisualizer: React.FC<EcosystemVisualizerProps> = ({
  nodes: propNodes,
  loading,
  onNodeClick,
  title = "Cognitive Network // Live Visualization // Node Density: High"
}) => {
  const { setIsOpen, submitIntent, setQuery } = useIntentStore();
  const { isMobile } = useBreakpoint();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"spatial" | "list">(isMobile ? "list" : "spatial");

  // Deterministic layout for nodes without X/Y (DRY)
  const processedNodes = useMemo(() => {
    const rawNodes = propNodes || [
      { id: "1", x: 50, y: 50, type: "system", label: "Kernel", status: "active" },
      { id: "2", x: 30, y: 30, type: "agent", label: "Alpha Arbitrage", status: "active", pulse: true },
      { id: "3", x: 70, y: 40, type: "agent", label: "Risk Monitor", status: "warning" },
      { id: "4", x: 40, y: 70, type: "policy", label: "Standard Guardrails", status: "active" },
      { id: "5", x: 65, y: 75, type: "agent", label: "Yield Optimizer", status: "idle" },
    ];

    return rawNodes.map((node, i) => {
      if (node.x !== undefined && node.y !== undefined) return node;

      // Basic circle layout for dynamic nodes
      const angle = (i / rawNodes.length) * Math.PI * 2;
      const radius = i === 0 ? 0 : 35; // Center the first node
      return {
        ...node,
        x: 50 + radius * Math.cos(angle),
        y: 50 + radius * Math.sin(angle)
      };
    });
  }, [propNodes]);

  const handleNodeClick = (node: Node) => {
    setSelectedNode(node.id);
    if (onNodeClick) {
      onNodeClick(node);
      return;
    }

    setIsOpen(true);
    const query =
      node.type === "agent"
        ? `show traces for ${node.label}`
        : node.type === "policy"
          ? `show policy ${node.label}`
          : `show system status for ${node.label}`;

    // Update query in the input field for transparency
    setQuery(query);
    submitIntent(query);
  };

  const getNodeColor = (status: string) => {
    switch (status) {
      case "active":
      case "connected":
        return designTokens.colors.primary[500];
      case "warning":
        return designTokens.colors.semantic.warning;
      case "idle":
      case "disconnected":
        return designTokens.colors.neutral[500];
      case "error":
        return designTokens.colors.semantic.error;
      default:
        return designTokens.colors.primary[500];
    }
  };

  const listColumns: Column<Node>[] = [
    {
      key: "label",
      title: "Node Name",
      sortable: true,
      render: (val, record) => (
        <div style={{ fontWeight: "bold", color: getNodeColor(record.status) }}>
          {val}
        </div>
      ),
    },
    {
      key: "type",
      title: "Type",
      sortable: true,
      render: (val) => (
        <Badge variant="outline" style={{ textTransform: "capitalize" }}>
          {val}
        </Badge>
      ),
    },
    {
      key: "status",
      title: "Status",
      sortable: true,
      render: (val) => (
        <Badge
          variant={val === "active" ? "success" : val === "warning" ? "warning" : "default"}
        >
          {val}
        </Badge>
      ),
    },
  ];

  if (loading) {
    return (
      <Container style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <HUDOverlay>SYNCING WITH KERNEL...</HUDOverlay>
        <div style={{ color: designTokens.colors.primary[400] }}>LOADING NODES...</div>
      </Container>
    );
  }

  return (
    <Container isListMode={viewMode === "list"}>
      <HUDOverlay>
        {title}
      </HUDOverlay>

      <Controls>
        <ViewToggle
          active={viewMode === "spatial"}
          onClick={() => setViewMode("spatial")}
          title="Spatial View"
        >
          <Network size={16} />
        </ViewToggle>
        <ViewToggle
          active={viewMode === "list"}
          onClick={() => setViewMode("list")}
          title="List View"
        >
          <LayoutGrid size={16} />
        </ViewToggle>
      </Controls>

      {viewMode === "spatial" ? (
        <>
          <SvgCanvas viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
            <defs>
              <radialGradient id="nodeGradient">
                <stop offset="0%" stopColor="white" stopOpacity="0.8" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
              </radialGradient>
            </defs>

            {/* Dynamic Connections - Hub and Spoke (Consolidated Logic) */}
            {processedNodes.length > 1 && processedNodes.map(
              (node, i) =>
                i > 0 && (
                  <ConnectionLine
                    key={`line-${node.id}-${i}`}
                    x1={processedNodes[0].x}
                    y1={processedNodes[0].y}
                    x2={node.x}
                    y2={node.y}
                  />
                ),
            )}

            {processedNodes.map((node, i) => {
              const color = getNodeColor(node.status);
              const isSelected = selectedNode === node.id;

              return (
                <NodeGroup
                  key={`${node.id}-${i}`}
                  onClick={() => handleNodeClick(node)}
                  style={{
                    animationDelay: `${i * 0.3}s`,
                    filter: isSelected
                      ? `drop-shadow(0 0 12px ${color})`
                      : undefined,
                  }}
                  active={isSelected}
                >
                  {(node.pulse || node.status === "active") && (
                    <GlowCircle cx={node.x} cy={node.y} r="4" color={color} />
                  )}
                  {isSelected && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="5"
                      fill="none"
                      stroke={color}
                      strokeWidth="0.5"
                      strokeDasharray="1 1"
                    >
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from={`0 ${node.x} ${node.y}`}
                        to={`360 ${node.x} ${node.y}`}
                        dur="10s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.type === "system" ? "2.5" : "1.8"}
                    fill={color}
                    stroke="white"
                    strokeWidth="0.2"
                    strokeOpacity={isSelected ? 1 : 0.5}
                  />
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    fill="white"
                    fontSize="2.2"
                    fontWeight="bold"
                    style={{
                      pointerEvents: "none",
                      opacity: isSelected ? 1 : 0.8,
                      textShadow: isSelected ? "0 0 5px rgba(0,0,0,0.8)" : "0 0 3px rgba(0,0,0,0.5)",
                    }}
                  >
                    {node.label}
                  </text>
                </NodeGroup>
              );
            })}
          </SvgCanvas>

          {/* Decorative Scanline Effect */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03))",
              backgroundSize: "100% 4px, 3px 100%",
              pointerEvents: "none",
            }}
          />
        </>
      ) : (
        <div style={{ padding: "60px 20px 20px" }}>
          <DataTable
            data={processedNodes}
            columns={listColumns}
            onRowClick={handleNodeClick}
            searchable={processedNodes.length > 10}
            pagination={processedNodes.length > 10 ? { current: 1, pageSize: 10, total: processedNodes.length, onChange: () => {} } : undefined}
          />
        </div>
      )}
    </Container>
  );
};

export default EcosystemVisualizer;
