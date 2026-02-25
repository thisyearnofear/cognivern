import React, { useState } from "react";
import styled from "@emotion/styled";
import { keyframes, css } from "@emotion/react";
import { designTokens } from "../../styles/design-system";
import { Badge } from "./Badge";
import { GenerativeReveal } from "./GenerativeReveal";

/**
 * ForensicTimeline - A high-fidelity transparency component.
 * Visualizes the cognitive steps, decisions, and actions of an agent.
 * Designed for forensic auditability and the "wow factor" in explainable AI.
 *
 * CORE PRINCIPLES:
 * - MODULAR: Independent timeline blocks.
 * - PERFORMANT: Lean SVG/CSS animations.
 * - WOW FACTOR: Ambient glows and fluid reveal of "thought paths".
 */

export type EventType =
  | "observation"
  | "thought"
  | "action"
  | "validation"
  | "error"
  | "block";

export interface ForensicEvent {
  id: string;
  timestamp: number;
  type: EventType;
  title: string;
  description: string;
  metadata?: Record<string, any>;
  status?: "success" | "warning" | "error";
}

interface ForensicTimelineProps {
  events: ForensicEvent[];
  agentName?: string;
  isLoading?: boolean;
}

const slideIn = keyframes`
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: translateX(0); }
`;

const pulseGlow = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(14, 165, 233, 0); }
  100% { box-shadow: 0 0 0 0 rgba(14, 165, 233, 0); }
`;

const TimelineContainer = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
  padding: ${designTokens.spacing[4]} 0;
  width: 100%;

  &::before {
    content: "";
    position: absolute;
    left: 24px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: linear-gradient(
      to bottom,
      ${designTokens.colors.neutral[100]} 0%,
      ${designTokens.colors.neutral[200]} 20%,
      ${designTokens.colors.neutral[200]} 80%,
      ${designTokens.colors.neutral[100]} 100%
    );
  }
`;

const ItemWrapper = styled.div<{ delay: number }>`
  display: flex;
  gap: ${designTokens.spacing[6]};
  margin-bottom: ${designTokens.spacing[8]};
  animation: ${slideIn} 0.5s ease-out forwards;
  animation-delay: ${({ delay }) => delay}ms;
  opacity: 0;
  position: relative;
`;

const Node = styled.div<{ type: EventType; status?: string }>`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: ${designTokens.colors.neutral[0]};
  border: 2px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  flex-shrink: 0;
  transition: all 0.3s ease;
  font-size: 1.25rem;

  ${({ type }) => {
    switch (type) {
      case "thought":
        return css`
          border-color: ${designTokens.colors.primary[400]};
          color: ${designTokens.colors.primary[600]};
          background: ${designTokens.colors.primary[50]};
        `;
      case "action":
        return css`
          border-color: ${designTokens.colors.semantic.success};
          color: ${designTokens.colors.semantic.success};
          animation: ${pulseGlow} 2s infinite;
        `;
      case "block":
      case "error":
        return css`
          border-color: ${designTokens.colors.semantic.error};
          color: ${designTokens.colors.semantic.error};
          background: ${designTokens.colors.semantic.errorBg};
        `;
      case "validation":
        return css`
          border-color: ${designTokens.colors.primary[500]};
          color: ${designTokens.colors.primary[700]};
        `;
      default:
        return css`
          border-color: ${designTokens.colors.neutral[300]};
          color: ${designTokens.colors.neutral[500]};
        `;
    }
  }}
`;

const ContentWrapper = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-top: ${designTokens.spacing[2]};
`;

const TimeStamp = styled.span`
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[400]};
  font-family: ${designTokens.typography.fontFamily.mono.join(", ")};
  margin-bottom: ${designTokens.spacing[1]};
`;

const EventTitle = styled.h4`
  font-size: ${designTokens.typography.fontSize.base};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.neutral[900]};
  margin: 0;
`;

const EventDescription = styled.p`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[600]};
  margin: ${designTokens.spacing[1]} 0 ${designTokens.spacing[3]};
  line-height: 1.5;
`;

const MetadataCard = styled.div`
  background: ${designTokens.colors.neutral[50]};
  border-radius: ${designTokens.borderRadius.md};
  padding: ${designTokens.spacing[3]};
  border: 1px solid ${designTokens.colors.neutral[100]};
  font-family: ${designTokens.typography.fontFamily.mono.join(", ")};
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[700]};
  overflow: auto;
  max-height: 200px;
`;

const getIcon = (type: EventType) => {
  switch (type) {
    case "thought":
      return "🧠";
    case "action":
      return "⚡";
    case "observation":
      return "👁️";
    case "validation":
      return "🛡️";
    case "block":
      return "🚫";
    case "error":
      return "⚠️";
    default:
      return "•";
  }
};

export const ForensicTimeline: React.FC<ForensicTimelineProps> = ({
  events,
  isLoading = false,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <TimelineContainer>
        {[1, 2, 3].map((i) => (
          <ItemWrapper key={i} delay={i * 100}>
            <Node type="observation" style={{ opacity: 0.5 }} />
            <ContentWrapper>
              <div
                style={{
                  height: "12px",
                  width: "100px",
                  background: "#f1f5f9",
                  marginBottom: "8px",
                }}
              />
              <div
                style={{
                  height: "20px",
                  width: "200px",
                  background: "#f1f5f9",
                }}
              />
            </ContentWrapper>
          </ItemWrapper>
        ))}
      </TimelineContainer>
    );
  }

  return (
    <GenerativeReveal duration={800}>
      <TimelineContainer>
        {events.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
              color: designTokens.colors.neutral[400],
            }}
          >
            No forensic traces found for this execution.
          </div>
        ) : (
          events.map((event, index) => (
            <ItemWrapper key={event.id} delay={index * 100}>
              <Node type={event.type} status={event.status}>
                {getIcon(event.type)}
              </Node>
              <ContentWrapper>
                <TimeStamp>
                  {new Date(event.timestamp).toLocaleTimeString()}
                </TimeStamp>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <EventTitle>{event.title}</EventTitle>
                  <div style={{ fontSize: "10px", textTransform: "uppercase" }}>
                    <Badge
                      variant={
                        event.type === "action"
                          ? "success"
                          : event.type === "block" || event.type === "error"
                            ? "error"
                            : "secondary"
                      }
                      size="sm"
                    >
                      {event.type}
                    </Badge>
                  </div>
                </div>
                <EventDescription>{event.description}</EventDescription>

                {event.metadata && (
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === event.id ? null : event.id)
                    }
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: "11px",
                      color: designTokens.colors.primary[600],
                      cursor: "pointer",
                      textAlign: "left",
                      padding: 0,
                      fontWeight: "bold",
                    }}
                  >
                    {expandedId === event.id
                      ? "Collapse Details ↑"
                      : "Inspect Raw Traces ↓"}
                  </button>
                )}

                {expandedId === event.id && event.metadata && (
                  <div style={{ marginTop: "12px" }}>
                    <GenerativeReveal duration={400}>
                      <MetadataCard>
                        <pre style={{ margin: 0 }}>
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      </MetadataCard>
                    </GenerativeReveal>
                  </div>
                )}
              </ContentWrapper>
            </ItemWrapper>
          ))
        )}
      </TimelineContainer>
    </GenerativeReveal>
  );
};

export default ForensicTimeline;
