import { useState, useMemo } from "react";
import styled from "@emotion/styled";
import { keyframes, css } from "@emotion/react";
import { designTokens } from "../../styles/design-system";
import { useIntentStore } from "../../stores/intentStore";

/**
 * EcosystemVisualizer - A high-end spatial representation of the agentic ecosystem.
 * Utilizes SVG and CSS animations to deliver the "wow factor" and marketing intrigue.
 *
 * CORE PRINCIPLES:
 * - WOW FACTOR: Ambient glows, floating nodes, and interactive pulses.
 * - MODULAR: Self-contained visualization layer.
 * - ENHANCEMENT FIRST: Provides a next-gen HUD for the platform state.
 */

interface Node {
  id: string;
  x: number;
  y: number;
  type: "agent" | "policy" | "system";
  label: string;
  status: "active" | "warning" | "idle";
  pulse?: boolean;
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

const Container = styled.div`
  position: relative;
  width: 100%;
  height: 500px;
  background: radial-gradient(circle at center, #0f172a 0%, #020617 100%);
  border-radius: ${designTokens.borderRadius["2xl"]};
  overflow: hidden;
  border: 1px solid ${designTokens.colors.neutral[800]};
  cursor: crosshair;
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

export const EcosystemVisualizer: React.FC = () => {
  const { setIsOpen, submitIntent, setQuery } = useIntentStore();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [nodes] = useState<Node[]>([
    {
      id: "1",
      x: 50,
      y: 50,
      type: "system",
      label: "Kernel",
      status: "active",
    },
    {
      id: "2",
      x: 30,
      y: 30,
      type: "agent",
      label: "Alpha Arbitrage",
      status: "active",
      pulse: true,
    },
    {
      id: "3",
      x: 70,
      y: 40,
      type: "agent",
      label: "Risk Monitor",
      status: "warning",
    },
    {
      id: "4",
      x: 40,
      y: 70,
      type: "policy",
      label: "Standard Guardrails",
      status: "active",
    },
    {
      id: "5",
      x: 65,
      y: 75,
      type: "agent",
      label: "Yield Optimizer",
      status: "idle",
    },
  ]);

  const handleNodeClick = (node: Node) => {
    setSelectedNode(node.id);
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
        return designTokens.colors.primary[500];
      case "warning":
        return designTokens.colors.semantic.warning;
      case "idle":
        return designTokens.colors.neutral[500];
      default:
        return designTokens.colors.primary[500];
    }
  };

  return (
    <Container>
      <HUDOverlay>
        Cognitive Network // Live Visualization // Node Density: High
      </HUDOverlay>

      <SvgCanvas viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="nodeGradient">
            <stop offset="0%" stopColor="white" stopOpacity="0.8" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
          </radialGradient>
        </defs>

        {/* Dynamic Connections */}
        {nodes.map(
          (node, i) =>
            i > 0 && (
              <ConnectionLine
                key={`line-${i}`}
                x1={nodes[0].x}
                y1={nodes[0].y}
                x2={node.x}
                y2={node.y}
              />
            ),
        )}

        {nodes.map((node, i) => {
          const color = getNodeColor(node.status);
          const isSelected = selectedNode === node.id;

          return (
            <NodeGroup
              key={node.id}
              onClick={() => handleNodeClick(node)}
              style={{
                animationDelay: `${i * 0.5}s`,
                filter: isSelected
                  ? `drop-shadow(0 0 12px ${color})`
                  : undefined,
              }}
              active={isSelected}
            >
              {node.pulse && (
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
                fontSize="2"
                fontWeight="bold"
                style={{
                  pointerEvents: "none",
                  opacity: isSelected ? 1 : 0.7,
                  textShadow: isSelected ? "0 0 5px rgba(0,0,0,0.5)" : "none",
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
    </Container>
  );
};

export default EcosystemVisualizer;
