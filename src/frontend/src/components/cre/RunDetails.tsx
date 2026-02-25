import { useEffect, useMemo, useState } from "react";
import { css } from "@emotion/react";
import { Link, useParams } from "react-router-dom";
import { creApi, CreRun } from "../../services/creApi";
import { designTokens } from "../../styles/design-system";
import {
  Card,
  CardContent,
  CardHeader,
  Badge,
  Button,
  LoadingSpinner,
} from "../ui";
import ForensicTimeline, {
  ForensicEvent,
  EventType,
} from "../ui/ForensicTimeline";

/**
 * RunDetails - A high-fidelity forensics view for agent executions.
 * Refactored to use the ForensicTimeline component for maximum transparency.
 *
 * CORE PRINCIPLES:
 * - ENHANCEMENT FIRST: Replaces standard lists with high-end ForensicTimeline.
 * - MODULAR: Leverages design system primitives and domain-specific UI.
 * - WOW FACTOR: Incorporates fluid reveals and cognitive path reconstruction.
 */

const containerStyles = css`
  width: 100%;
  padding: ${designTokens.spacing[8]};
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[8]};
  max-width: 1000px;
  margin: 0 auto;
`;

const headerStyles = css`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${designTokens.spacing[4]};
  flex-wrap: wrap;
`;

const mono = css`
  font-family: ${designTokens.typography.fontFamily.mono.join(", ")};
  font-size: ${designTokens.typography.fontSize.sm};
`;

const sectionTitleStyles = css`
  font-size: ${designTokens.typography.fontSize.xl};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.neutral[900]};
  margin-bottom: ${designTokens.spacing[6]};
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[2]};

  &::before {
    content: "";
    display: inline-block;
    width: 4px;
    height: 24px;
    background: ${designTokens.colors.primary[500]};
    border-radius: ${designTokens.borderRadius.full};
  }
`;

export default function RunDetails() {
  const { runId } = useParams<{ runId: string }>();
  const [run, setRun] = useState<CreRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!runId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await creApi.getRun(runId);
      if (!res.success) {
        setError(res.error || "Failed to reconstruct execution traces.");
        setIsLoading(false);
        return;
      }
      const payload = (res.data as any) || {};
      setRun(payload.run || null);
    } catch (err) {
      setError("Critical failure during trace reconstruction.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [runId]);

  const timelineEvents = useMemo<ForensicEvent[]>(() => {
    if (!run) return [];

    return run.steps.map((s, idx) => {
      let eventType: EventType = "observation";
      const kind = (s.kind || "").toLowerCase();

      if (kind.includes("thought")) eventType = "thought";
      else if (
        kind.includes("action") ||
        kind.includes("trade") ||
        kind.includes("call")
      )
        eventType = "action";
      else if (
        kind.includes("validation") ||
        kind.includes("policy") ||
        kind.includes("check")
      )
        eventType = "validation";
      else if (kind.includes("error") || !s.ok) eventType = "error";
      else if (kind.includes("block")) eventType = "block";

      return {
        id: `step-${idx}`,
        timestamp: s.startedAt ? new Date(s.startedAt).getTime() : Date.now(),
        type: eventType,
        title: s.name,
        description:
          s.summary ||
          "Agent processed this step without a descriptive summary.",
        metadata: s.details,
        status: s.ok ? "success" : "error",
      };
    });
  }, [run]);

  if (isLoading) {
    return (
      <div css={containerStyles}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "120px",
          }}
        >
          <LoadingSpinner
            size="lg"
            text="Reconstructing forensic timeline..."
          />
        </div>
      </div>
    );
  }

  return (
    <div css={containerStyles}>
      <div css={headerStyles}>
        <div>
          <h1
            css={css`
              margin: 0;
              font-size: ${designTokens.typography.fontSize["4xl"]};
              font-weight: 800;
              letter-spacing: -0.02em;
            `}
          >
            Forensic Audit
          </h1>
          <div
            css={css`
              margin-top: ${designTokens.spacing[2]};
              display: flex;
              gap: ${designTokens.spacing[3]};
              align-items: center;
            `}
          >
            <Badge variant={run?.ok ? "success" : "error"}>
              {run?.ok ? "VERIFIED" : "FAILED"}
            </Badge>
            <span
              css={mono}
              style={{ color: designTokens.colors.neutral[500] }}
            >
              ID: {runId}
            </span>
          </div>
          <div
            css={css`
              margin-top: ${designTokens.spacing[4]};
            `}
          >
            <Link
              to="/runs"
              style={{
                color: designTokens.colors.primary[600],
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "14px",
              }}
            >
              ← Return to Run Ledger
            </Link>
          </div>
        </div>

        <div style={{ display: "flex", gap: designTokens.spacing[3] }}>
          <Button onClick={() => load()} variant="outline">
            Refresh Traces
          </Button>
          <Button
            onClick={() =>
              navigator.clipboard.writeText(JSON.stringify(run, null, 2))
            }
            variant="primary"
          >
            Export Audit JSON
          </Button>
        </div>
      </div>

      {error ? (
        <Card variant="outlined">
          <CardContent style={{ textAlign: "center", padding: "60px" }}>
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🚫</div>
            <h3 style={{ marginBottom: "8px" }}>
              Forensic Reconstruction Failed
            </h3>
            <p style={{ color: designTokens.colors.neutral[500] }}>{error}</p>
          </CardContent>
        </Card>
      ) : !run ? (
        <Card variant="outlined">
          <CardContent style={{ textAlign: "center", padding: "60px" }}>
            <h3>Trace Not Found</h3>
            <p>
              The requested execution ID could not be located in the ledger.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div style={{ display: "grid", gap: designTokens.spacing[12] }}>
          <section>
            <h2 css={sectionTitleStyles}>Cognitive Path Reconstruction</h2>
            <ForensicTimeline events={timelineEvents} agentName="Agent" />
          </section>

          {run.artifacts && run.artifacts.length > 0 && (
            <section>
              <h2 css={sectionTitleStyles}>Execution Artifacts</h2>
              <div
                style={{
                  display: "grid",
                  gap: designTokens.spacing[6],
                  gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))",
                }}
              >
                {run.artifacts.map((artifact) => (
                  <Card key={artifact.id} variant="outlined">
                    <CardHeader>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            textTransform: "uppercase",
                            fontSize: "10px",
                          }}
                        >
                          <Badge variant="secondary">{artifact.type}</Badge>
                        </div>
                        <span
                          css={mono}
                          style={{ fontSize: "0.7rem", opacity: 0.5 }}
                        >
                          {artifact.createdAt}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <pre
                        css={css`
                          ${mono};
                          background: ${designTokens.colors.neutral[50]};
                          padding: ${designTokens.spacing[4]};
                          border-radius: ${designTokens.borderRadius.lg};
                          overflow: auto;
                          max-height: 400px;
                          font-size: 11px;
                          border: 1px solid ${designTokens.colors.neutral[100]};
                        `}
                      >
                        {JSON.stringify(artifact.data, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
