/** @jsxImportSource @emotion/react */
import React, { useState } from 'react';
import { css } from '@emotion/react';
import { ShieldCheck, PlayCircle, ChevronDown, ChevronUp, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { designTokens } from '../../styles/design-system';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import PageWrapper from '../layout/PageWrapper';

interface GovernanceResult {
  allowed: boolean;
  policyId: string;
  reason: string;
  confidence?: number;
  auditId?: string;
  evaluatedBy?: string;
}

const EXAMPLE_ACTIONS = [
  {
    label: 'Transfer funds',
    value: JSON.stringify({ type: 'transfer', amount: 500, asset: 'USDC', destination: '0xabc...' }, null, 2),
  },
  {
    label: 'Execute trade',
    value: JSON.stringify({ type: 'trade', action: 'buy', asset: 'ETH', amount: 1.5, price: 3200 }, null, 2),
  },
  {
    label: 'Access patient record',
    value: JSON.stringify({ type: 'data_access', resource: 'patient_record', resourceId: 'pt-001', purpose: 'treatment' }, null, 2),
  },
  {
    label: 'Deploy contract',
    value: JSON.stringify({ type: 'contract_deploy', contract: 'SpendVault', network: 'mainnet' }, null, 2),
  },
];

const EXAMPLE_FHIR = JSON.stringify({
  resourceType: 'Patient',
  id: 'pt-001',
  meta: { profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'] },
  name: [{ use: 'official', family: 'Smith', given: ['Jane'] }],
  birthDate: '1985-04-12',
}, null, 2);

export default function GovernancePlayground() {
  const [agentId, setAgentId] = useState('agent-demo-001');
  const [policyId, setPolicyId] = useState('');
  const [actionJson, setActionJson] = useState(EXAMPLE_ACTIONS[0].value);
  const [actionError, setActionError] = useState('');
  const [showFhir, setShowFhir] = useState(false);
  const [fhirJson, setFhirJson] = useState('');
  const [fhirError, setFhirError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GovernanceResult | null>(null);
  const [apiError, setApiError] = useState('');

  const validateJson = (value: string, setter: (e: string) => void): boolean => {
    if (!value.trim()) { setter(''); return true; }
    try { JSON.parse(value); setter(''); return true; }
    catch { setter('Invalid JSON'); return false; }
  };

  const handleEvaluate = async () => {
    const actionOk = validateJson(actionJson, setActionError);
    const fhirOk = !showFhir || validateJson(fhirJson, setFhirError);
    if (!actionOk || !fhirOk) return;

    setLoading(true);
    setResult(null);
    setApiError('');

    try {
      const body: Record<string, unknown> = {
        agentId: agentId.trim() || 'agent-demo-001',
        action: JSON.parse(actionJson),
      };
      if (policyId.trim()) body.policyId = policyId.trim();
      if (showFhir && fhirJson.trim()) body.fhirContext = JSON.parse(fhirJson);

      const res = await fetch('/api/mcp/governance-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const fieldStyles = css`
    display: flex;
    flex-direction: column;
    gap: ${designTokens.spacing[2]};
    label {
      font-size: ${designTokens.typography.fontSize.sm};
      font-weight: ${designTokens.typography.fontWeight.medium};
      color: ${designTokens.colors.neutral[700]};
    }
    input, textarea, select {
      padding: ${designTokens.spacing[3]};
      border: 1px solid ${designTokens.colors.neutral[300]};
      border-radius: ${designTokens.borderRadius.md};
      font-size: ${designTokens.typography.fontSize.sm};
      font-family: inherit;
      background: ${designTokens.colors.neutral[50]};
      color: ${designTokens.colors.neutral[900]};
      transition: border-color 0.15s;
      &:focus { outline: none; border-color: ${designTokens.colors.primary[500]}; background: white; }
    }
    textarea { resize: vertical; font-family: 'Menlo', 'Monaco', monospace; font-size: 0.8rem; }
  `;

  const errorTextStyles = css`
    font-size: ${designTokens.typography.fontSize.xs};
    color: ${designTokens.colors.error[600]};
  `;

  const resultCardStyles = (allowed: boolean) => css`
    border: 2px solid ${allowed ? designTokens.colors.success[400] : designTokens.colors.error[400]};
    border-radius: ${designTokens.borderRadius.xl};
    padding: ${designTokens.spacing[6]};
    background: ${allowed ? designTokens.colors.success[50] : designTokens.colors.error[50]};
  `;

  const fhirToggleStyles = css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[2]};
    cursor: pointer;
    font-size: ${designTokens.typography.fontSize.sm};
    font-weight: ${designTokens.typography.fontWeight.medium};
    color: ${designTokens.colors.primary[600]};
    background: none;
    border: none;
    padding: 0;
    &:hover { color: ${designTokens.colors.primary[800]}; }
  `;

  return (
    <PageWrapper
      title="Governance Playground"
      subtitle="Evaluate any agent action against your policies live — with optional FHIR/SHARP clinical context."
    >
      <div css={css`display: grid; grid-template-columns: 1fr 1fr; gap: ${designTokens.spacing[6]}; @media (max-width: 768px) { grid-template-columns: 1fr; }`}>

        {/* Input Panel */}
        <Card>
          <CardHeader>
            <CardTitle>
              <ShieldCheck size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
              Action to Evaluate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div css={css`display: flex; flex-direction: column; gap: ${designTokens.spacing[5]};`}>

              {/* Quick-fill examples */}
              <div css={fieldStyles}>
                <label>Quick-fill example</label>
                <select onChange={(e) => { if (e.target.value) setActionJson(e.target.value); }}>
                  {EXAMPLE_ACTIONS.map((ex) => (
                    <option key={ex.label} value={ex.value}>{ex.label}</option>
                  ))}
                </select>
              </div>

              <div css={fieldStyles}>
                <label>Agent ID</label>
                <input
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="agent-demo-001"
                />
              </div>

              <div css={fieldStyles}>
                <label>Policy ID <span css={css`color: ${designTokens.colors.neutral[400]};`}>(optional — uses default if blank)</span></label>
                <input
                  value={policyId}
                  onChange={(e) => setPolicyId(e.target.value)}
                  placeholder="policy-spend-001"
                />
              </div>

              <div css={fieldStyles}>
                <label>Agent Action (JSON)</label>
                <textarea
                  rows={8}
                  value={actionJson}
                  onChange={(e) => { setActionJson(e.target.value); validateJson(e.target.value, setActionError); }}
                />
                {actionError && <span css={errorTextStyles}>{actionError}</span>}
              </div>

              {/* FHIR context toggle */}
              <div>
                <button css={fhirToggleStyles} onClick={() => setShowFhir((v) => !v)}>
                  {showFhir ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {showFhir ? 'Hide' : 'Add'} FHIR / SHARP clinical context
                </button>

                {showFhir && (
                  <div css={css`margin-top: ${designTokens.spacing[3]}; display: flex; flex-direction: column; gap: ${designTokens.spacing[2]};`}>
                    <div css={css`display: flex; justify-content: flex-end;`}>
                      <button
                        css={css`font-size: 0.75rem; color: ${designTokens.colors.primary[500]}; background: none; border: none; cursor: pointer;`}
                        onClick={() => setFhirJson(EXAMPLE_FHIR)}
                      >
                        Load example Patient resource
                      </button>
                    </div>
                    <textarea
                      css={css`padding: ${designTokens.spacing[3]}; border: 1px solid ${designTokens.colors.neutral[300]}; border-radius: ${designTokens.borderRadius.md}; font-family: 'Menlo', 'Monaco', monospace; font-size: 0.8rem; resize: vertical; background: ${designTokens.colors.neutral[50]}; &:focus { outline: none; border-color: ${designTokens.colors.primary[500]}; }`}
                      rows={8}
                      placeholder="Paste a FHIR R4 resource (Patient, Encounter, Observation…)"
                      value={fhirJson}
                      onChange={(e) => { setFhirJson(e.target.value); validateJson(e.target.value, setFhirError); }}
                    />
                    {fhirError && <span css={errorTextStyles}>{fhirError}</span>}
                  </div>
                )}
              </div>

              <Button
                onClick={handleEvaluate}
                disabled={loading || !!actionError || !!fhirError}
                style={{ width: '100%' }}
              >
                {loading
                  ? <><Loader2 size={16} style={{ marginRight: 8, animation: 'spin 1s linear infinite' }} />Evaluating…</>
                  : <><PlayCircle size={16} style={{ marginRight: 8 }} />Evaluate</>
                }
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Result Panel */}
        <div css={css`display: flex; flex-direction: column; gap: ${designTokens.spacing[4]};`}>
          {!result && !apiError && !loading && (
            <Card>
              <CardContent>
                <div css={css`text-align: center; padding: ${designTokens.spacing[12]}; color: ${designTokens.colors.neutral[400]};`}>
                  <ShieldCheck size={48} css={css`margin: 0 auto ${designTokens.spacing[4]};`} />
                  <p css={css`font-size: ${designTokens.typography.fontSize.sm};`}>
                    Fill in an action and click <strong>Evaluate</strong> to see the policy decision, Together AI reasoning, and audit trail entry — all in one place.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {loading && (
            <Card>
              <CardContent>
                <div css={css`text-align: center; padding: ${designTokens.spacing[12]}; color: ${designTokens.colors.neutral[500]};`}>
                  <Loader2 size={32} css={css`margin: 0 auto ${designTokens.spacing[4]}; animation: spin 1s linear infinite;`} />
                  <p css={css`font-size: ${designTokens.typography.fontSize.sm};`}>Evaluating via Together AI…</p>
                </div>
              </CardContent>
            </Card>
          )}

          {apiError && (
            <Card>
              <CardContent>
                <div css={css`display: flex; align-items: flex-start; gap: ${designTokens.spacing[3]}; color: ${designTokens.colors.error[700]};`}>
                  <XCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p css={css`font-weight: ${designTokens.typography.fontWeight.semibold}; margin-bottom: ${designTokens.spacing[1]};`}>Evaluation failed</p>
                    <p css={css`font-size: ${designTokens.typography.fontSize.sm};`}>{apiError}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {result && (
            <div css={resultCardStyles(result.allowed)}>
              <div css={css`display: flex; align-items: center; gap: ${designTokens.spacing[3]}; margin-bottom: ${designTokens.spacing[5]};`}>
                {result.allowed
                  ? <CheckCircle2 size={28} color={designTokens.colors.success[600]} />
                  : <XCircle size={28} color={designTokens.colors.error[600]} />
                }
                <div>
                  <p css={css`font-size: ${designTokens.typography.fontSize.xl}; font-weight: ${designTokens.typography.fontWeight.bold}; color: ${result.allowed ? designTokens.colors.success[700] : designTokens.colors.error[700]};`}>
                    {result.allowed ? 'Action Allowed' : 'Action Denied'}
                  </p>
                  {result.evaluatedBy && (
                    <p css={css`font-size: ${designTokens.typography.fontSize.xs}; color: ${designTokens.colors.neutral[500]};`}>
                      Evaluated by {result.evaluatedBy}
                    </p>
                  )}
                </div>
              </div>

              <div css={css`display: flex; flex-direction: column; gap: ${designTokens.spacing[3]};`}>
                <div>
                  <p css={css`font-size: ${designTokens.typography.fontSize.xs}; font-weight: ${designTokens.typography.fontWeight.semibold}; color: ${designTokens.colors.neutral[500]}; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: ${designTokens.spacing[1]};`}>Policy</p>
                  <Badge variant="secondary">{result.policyId}</Badge>
                </div>

                <div>
                  <p css={css`font-size: ${designTokens.typography.fontSize.xs}; font-weight: ${designTokens.typography.fontWeight.semibold}; color: ${designTokens.colors.neutral[500]}; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: ${designTokens.spacing[1]};`}>Reasoning</p>
                  <p css={css`font-size: ${designTokens.typography.fontSize.sm}; color: ${designTokens.colors.neutral[800]}; line-height: 1.6;`}>{result.reason}</p>
                </div>

                {result.confidence !== undefined && (
                  <div>
                    <p css={css`font-size: ${designTokens.typography.fontSize.xs}; font-weight: ${designTokens.typography.fontWeight.semibold}; color: ${designTokens.colors.neutral[500]}; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: ${designTokens.spacing[1]};`}>Confidence</p>
                    <div css={css`display: flex; align-items: center; gap: ${designTokens.spacing[3]};`}>
                      <div css={css`flex: 1; height: 6px; background: ${designTokens.colors.neutral[200]}; border-radius: 9999px; overflow: hidden;`}>
                        <div css={css`height: 100%; width: ${Math.round(result.confidence * 100)}%; background: ${result.allowed ? designTokens.colors.success[500] : designTokens.colors.error[500]}; border-radius: 9999px;`} />
                      </div>
                      <span css={css`font-size: ${designTokens.typography.fontSize.sm}; font-weight: ${designTokens.typography.fontWeight.medium};`}>{Math.round(result.confidence * 100)}%</span>
                    </div>
                  </div>
                )}

                {result.auditId && (
                  <div>
                    <p css={css`font-size: ${designTokens.typography.fontSize.xs}; font-weight: ${designTokens.typography.fontWeight.semibold}; color: ${designTokens.colors.neutral[500]}; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: ${designTokens.spacing[1]};`}>Audit Trail</p>
                    <code css={css`font-size: 0.75rem; background: white; padding: 4px 8px; border-radius: 4px; color: ${designTokens.colors.neutral[700]};`}>{result.auditId}</code>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* How it works */}
          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: '0.9rem' }}>How it works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol css={css`list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: ${designTokens.spacing[3]};`}>
                {[
                  { n: '1', text: 'Your action JSON is sent to the MCP governance endpoint' },
                  { n: '2', text: 'Together AI (Llama-3.3-70B) evaluates it against your policy' },
                  { n: '3', text: 'FHIR/SHARP context enriches the evaluation for healthcare agents' },
                  { n: '4', text: 'The decision + reasoning is recorded in the immutable audit trail' },
                ].map((item) => (
                  <li key={item.n} css={css`display: flex; gap: ${designTokens.spacing[3]}; align-items: flex-start;`}>
                    <span css={css`width: 22px; height: 22px; border-radius: 9999px; background: ${designTokens.colors.primary[100]}; color: ${designTokens.colors.primary[700]}; font-size: 0.75rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;`}>{item.n}</span>
                    <span css={css`font-size: ${designTokens.typography.fontSize.sm}; color: ${designTokens.colors.neutral[600]};`}>{item.text}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}
