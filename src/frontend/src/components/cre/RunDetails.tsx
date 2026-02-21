import React, { useEffect, useMemo, useState } from "react";
import { css } from "@emotion/react";
import { Link, useParams } from "react-router-dom";
import { creApi, CreRun } from "../../services/creApi";
import { designTokens } from "../../styles/designTokens";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

const containerStyles = css`
  width: 100%;
  padding: ${designTokens.spacing[6]};
  display: grid;
  gap: ${designTokens.spacing[6]};
`;

const headerStyles = css`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${designTokens.spacing[4]};
  flex-wrap: wrap;
`;

const mono = css`
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: ${designTokens.typography.fontSize.sm};
`;

function pretty(obj: unknown) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function formatFeedValue(value: string, decimals?: number) {
  if (decimals === undefined || decimals === null) return value;
  const neg = value.startsWith("-");
  const v = neg ? value.slice(1) : value;
  const padded = v.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const frac = padded.slice(-decimals).replace(/0+$/, "");
  const out = frac ? `${whole}.${frac}` : whole;
  return neg ? `-${out}` : out;
}

export default function RunDetails() {
  const { runId } = useParams();
  const [run, setRun] = useState<CreRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const load = async () => {
    if (!runId) return;
    setIsLoading(true);
    setError(null);
    const res = await creApi.getRun(runId);
    if (!res.success) {
      setError(res.error || "Failed to load run");
      setIsLoading(false);
      return;
    }
    const payload = (res.data as any) || {};
    setRun(payload.run || null);
    setIsLoading(false);
  };

  useEffect(() => {
    load();
  }, [runId]);

  const statusBadge = useMemo(() => {
    if (!run) return null;
    return run.ok ? (
      <Badge variant="success">OK</Badge>
    ) : (
      <Badge variant="danger">FAIL</Badge>
    );
  }, [run]);

  return (
    <div css={containerStyles}>
      <div css={headerStyles}>
        <div>
          <h1
            css={css`
              margin: 0;
              font-size: ${designTokens.typography.fontSize["3xl"]};
            `}
          >
            Run Details
          </h1>
          <div css={css`margin-top:${designTokens.spacing[2]}; display:flex; gap:${designTokens.spacing[2]}; align-items:center; flex-wrap:wrap;`}>
            {statusBadge}
            <span css={mono}>{runId}</span>
          </div>
          <div css={css`margin-top:${designTokens.spacing[2]};`}>
            <Link to="/runs">← Back to Run Ledger</Link>
          </div>
        </div>

        <div css={css`display:flex; gap:${designTokens.spacing[2]}; flex-wrap:wrap;`}>
          <Button onClick={() => load()} variant="secondary">
            Refresh
          </Button>
          <Button
            onClick={() => copyToClipboard(window.location.href)}
            variant="secondary"
          >
            Copy link
          </Button>
          {run && (
            <Button
              onClick={() => copyToClipboard(pretty(run))}
              variant="secondary"
            >
              Copy JSON
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>{error}</CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <CardContent>Loading…</CardContent>
        </Card>
      ) : !run ? (
        <Card>
          <CardContent>Run not found.</CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div css={css`display:grid; gap:${designTokens.spacing[3]};`}>
                {run.steps.map((s, idx) => (
                  <div
                    key={`${s.name}-${idx}`}
                    css={css`
                      padding: ${designTokens.spacing[3]};
                      border: 1px solid ${designTokens.colors.neutral[200]};
                      border-radius: ${designTokens.borderRadius.lg};
                      display: grid;
                      gap: ${designTokens.spacing[1]};
                    `}
                  >
                    <div css={css`display:flex; gap:${designTokens.spacing[2]}; align-items:center; flex-wrap:wrap;`}>
                      <Badge variant={s.ok ? "success" : "danger"}>
                        {s.kind}
                      </Badge>
                      <strong>{s.name}</strong>
                    </div>
                    {s.summary && <div>{s.summary}</div>}
                    <div css={mono}>
                      {s.startedAt}
                      {s.finishedAt ? ` → ${s.finishedAt}` : ""}
                    </div>
                    {s.details && (
                      <pre
                        css={css`
                          ${mono};
                          background: ${designTokens.colors.neutral[50]};
                          padding: ${designTokens.spacing[3]};
                          border-radius: ${designTokens.borderRadius.md};
                          overflow: auto;
                          max-height: 240px;
                        `}
                      >
                        {pretty(s.details)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Artifacts</CardTitle>
            </CardHeader>
            <CardContent>
              <div css={css`display:grid; gap:${designTokens.spacing[3]};`}>
                {run.artifacts.map((a) => (
                  <details
                    key={a.id}
                    css={css`
                      border: 1px solid ${designTokens.colors.neutral[200]};
                      border-radius: ${designTokens.borderRadius.lg};
                      padding: ${designTokens.spacing[3]};
                    `}
                  >
                    <summary
                      css={css`
                        cursor: pointer;
                        display: flex;
                        gap: ${designTokens.spacing[2]};
                        align-items: center;
                      `}
                    >
                      <Badge variant="secondary">{a.type}</Badge>
                      <span css={mono}>{a.createdAt}</span>
                    </summary>

                    {a.type === "chainlink_price_feeds" && Array.isArray(a.data) && (
                      <div
                        css={css`
                          margin-top: ${designTokens.spacing[3]};
                          overflow: auto;
                        `}
                      >
                        <table
                          css={css`
                            width: 100%;
                            border-collapse: collapse;
                            font-size: ${designTokens.typography.fontSize.sm};
                          `}
                        >
                          <thead>
                            <tr>
                              <th
                                css={css`
                                  text-align: left;
                                  padding: ${designTokens.spacing[2]};
                                  border-bottom: 1px solid ${designTokens.colors.neutral[200]};
                                `}
                              >
                                Feed
                              </th>
                              <th
                                css={css`
                                  text-align: left;
                                  padding: ${designTokens.spacing[2]};
                                  border-bottom: 1px solid ${designTokens.colors.neutral[200]};
                                `}
                              >
                                Value
                              </th>
                              <th
                                css={css`
                                  text-align: left;
                                  padding: ${designTokens.spacing[2]};
                                  border-bottom: 1px solid ${designTokens.colors.neutral[200]};
                                `}
                              >
                                Updated
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(a.data as any[]).map((f, idx) => (
                              <tr key={idx}>
                                <td
                                  css={css`
                                    padding: ${designTokens.spacing[2]};
                                    border-bottom: 1px solid ${designTokens.colors.neutral[100]};
                                  `}
                                >
                                  <div>{f.feedName}</div>
                                  <div css={mono}>{f.feedAddress}</div>
                                </td>
                                <td
                                  css={css`
                                    padding: ${designTokens.spacing[2]};
                                    border-bottom: 1px solid ${designTokens.colors.neutral[100]};
                                  `}
                                >
                                  <div css={mono}>
                                    {formatFeedValue(String(f.value), Number(f.decimals))}
                                  </div>
                                  <div css={mono}>raw: {String(f.value)}</div>
                                </td>
                                <td
                                  css={css`
                                    padding: ${designTokens.spacing[2]};
                                    border-bottom: 1px solid ${designTokens.colors.neutral[100]};
                                  `}
                                >
                                  <div css={mono}>{f.updatedAt || ""}</div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <pre
                      css={css`
                        ${mono};
                        margin-top: ${designTokens.spacing[3]};
                        background: ${designTokens.colors.neutral[50]};
                        padding: ${designTokens.spacing[3]};
                        border-radius: ${designTokens.borderRadius.md};
                        overflow: auto;
                        max-height: 420px;
                      `}
                    >
                      {pretty(a.data)}
                    </pre>
                  </details>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
