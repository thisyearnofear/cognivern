/** @jsxImportSource @emotion/react */
import { useState } from 'react';
import { css, keyframes } from '@emotion/react';
import { Shield, Zap, Lock, FileCheck, ArrowRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { designTokens } from '../../styles/design-system';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { fetchVaultBalance } from '../../services/mantleApi';

type FlowStep = 'idle' | 'requesting' | 'evaluating' | 'relaying' | 'executing' | 'auditing' | 'complete' | 'denied';

interface SpendRequest {
  agentName: string;
  amount: number;
  purpose: string;
  dailyLimit: number;
  spentToday: number;
}

const SCENARIOS: SpendRequest[] = [
  { agentName: 'YieldHunter-01', amount: 200, purpose: 'Stake MNT in liquidity pool', dailyLimit: 500, spentToday: 100 },
  { agentName: 'YieldHunter-01', amount: 400, purpose: 'Swap MNT → USDT for arbitrage', dailyLimit: 500, spentToday: 300 },
  { agentName: 'Rebalancer-03', amount: 50, purpose: 'Gas top-up for position management', dailyLimit: 1000, spentToday: 0 },
];

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

export function SpendFlowDemo() {
  const [step, setStep] = useState<FlowStep>('idle');
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [vaultBalance, setVaultBalance] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'approve' | 'deny' | null>(null);

  const scenario = SCENARIOS[scenarioIdx];
  const wouldExceed = scenario.spentToday + scenario.amount > scenario.dailyLimit;

  async function runFlow() {
    setOutcome(null);
    setStep('requesting');
    await delay(1200);

    setStep('evaluating');
    await delay(2000);

    if (wouldExceed) {
      setOutcome('deny');
      setStep('denied');
      return;
    }

    setOutcome('approve');
    setStep('relaying');
    await delay(1500);

    setStep('executing');
    await delay(1200);
    const bal = await fetchVaultBalance();
    setVaultBalance(bal);

    setStep('auditing');
    await delay(1000);

    setStep('complete');
  }

  function reset() {
    setStep('idle');
    setOutcome(null);
  }

  function nextScenario() {
    setScenarioIdx((i) => (i + 1) % SCENARIOS.length);
    reset();
  }

  const steps: { key: FlowStep; label: string; chain: string; icon: React.ReactNode }[] = [
    { key: 'requesting', label: 'Agent requests spend', chain: 'Backend', icon: <Zap size={16} /> },
    { key: 'evaluating', label: 'Policy evaluated (FHE)', chain: 'Fhenix', icon: <Lock size={16} /> },
    { key: 'relaying', label: 'Decision relayed', chain: 'Hyperlane', icon: <ArrowRight size={16} /> },
    { key: 'executing', label: 'Vault executes', chain: 'Mantle', icon: <Zap size={16} /> },
    { key: 'auditing', label: 'Audit recorded', chain: 'Filecoin', icon: <FileCheck size={16} /> },
  ];

  const isActive = (s: FlowStep) => {
    const order: FlowStep[] = ['requesting', 'evaluating', 'relaying', 'executing', 'auditing', 'complete'];
    return order.indexOf(step) >= order.indexOf(s);
  };

  const containerStyles = css`
    padding: ${designTokens.spacing[5]};
    max-width: 720px;
    margin: 0 auto;
  `;

  const scenarioCardStyles = css`
    background: var(--surface-bg-alt, ${designTokens.colors.neutral[50]});
    border-radius: ${designTokens.borderRadius.md};
    padding: ${designTokens.spacing[4]};
    margin-bottom: ${designTokens.spacing[4]};
    border-left: 3px solid ${designTokens.colors.primary[500]};
  `;

  const stepRowStyles = (active: boolean, isCurrent: boolean) => css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[3]};
    padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
    border-radius: ${designTokens.borderRadius.md};
    background: ${active ? `var(--surface-bg-alt, ${designTokens.colors.neutral[50]})` : 'transparent'};
    opacity: ${active ? 1 : 0.4};
    transition: all 0.3s ease;
    ${isCurrent ? `animation: ${pulse} 1.5s infinite;` : ''}
  `;

  const stepIconStyles = (active: boolean) => css`
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${active ? designTokens.colors.primary[100] : designTokens.colors.neutral[100]};
    color: ${active ? designTokens.colors.primary[600] : designTokens.colors.neutral[400]};
    flex-shrink: 0;
  `;

  const resultStyles = css`
    animation: ${slideIn} 0.3s ease;
    padding: ${designTokens.spacing[4]};
    border-radius: ${designTokens.borderRadius.md};
    margin-top: ${designTokens.spacing[4]};
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[3]};
  `;

  return (
    <div css={containerStyles}>
      <div css={css`display: flex; align-items: center; justify-content: space-between; margin-bottom: ${designTokens.spacing[4]};`}>
        <div css={css`display: flex; align-items: center; gap: ${designTokens.spacing[2]};`}>
          <Shield size={20} color={designTokens.colors.primary[600]} />
          <h2 css={css`font-size: ${designTokens.typography.fontSize.lg}; font-weight: ${designTokens.typography.fontWeight.semibold}; color: var(--text-primary, ${designTokens.colors.text.primary}); margin: 0;`}>
            Live Spend Flow
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={nextScenario}>
          Next scenario
        </Button>
      </div>

      <div css={scenarioCardStyles}>
        <div css={css`display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: ${designTokens.spacing[2]};`}>
          <div>
            <div css={css`font-weight: ${designTokens.typography.fontWeight.semibold}; color: var(--text-primary, ${designTokens.colors.text.primary}); margin-bottom: ${designTokens.spacing[1]};`}>
              {scenario.agentName}
            </div>
            <div css={css`font-size: ${designTokens.typography.fontSize.sm}; color: var(--text-secondary, ${designTokens.colors.text.secondary});`}>
              {scenario.purpose}
            </div>
          </div>
          <div css={css`text-align: right;`}>
            <div css={css`font-size: ${designTokens.typography.fontSize.lg}; font-weight: ${designTokens.typography.fontWeight.bold}; color: var(--text-primary, ${designTokens.colors.text.primary});`}>
              {scenario.amount} MNT
            </div>
            <div css={css`font-size: ${designTokens.typography.fontSize.xs}; color: var(--text-secondary, ${designTokens.colors.text.secondary});`}>
              {scenario.spentToday}/{scenario.dailyLimit} spent today
            </div>
          </div>
        </div>
        {wouldExceed && (
          <Badge variant="danger" size="sm" css={css`margin-top: ${designTokens.spacing[2]};`}>
            Would exceed daily limit
          </Badge>
        )}
      </div>

      <div css={css`display: flex; flex-direction: column; gap: ${designTokens.spacing[1]}; margin-bottom: ${designTokens.spacing[4]};`}>
        {steps.map((s) => (
          <div key={s.key} css={stepRowStyles(isActive(s.key), step === s.key)}>
            <div css={stepIconStyles(isActive(s.key))}>
              {step === s.key ? <Loader2 size={16} css={css`animation: spin 1s linear infinite; @keyframes spin { to { transform: rotate(360deg); } }`} /> : s.icon}
            </div>
            <div css={css`flex: 1;`}>
              <div css={css`font-size: ${designTokens.typography.fontSize.sm}; font-weight: ${designTokens.typography.fontWeight.medium}; color: var(--text-primary, ${designTokens.colors.text.primary});`}>
                {s.label}
              </div>
            </div>
            <Badge variant="secondary" size="sm">{s.chain}</Badge>
          </div>
        ))}
      </div>

      {step === 'complete' && (
        <div css={css`${resultStyles}; background: ${designTokens.colors.semantic.success[50]}; border: 1px solid ${designTokens.colors.semantic.success[200]};`}>
          <CheckCircle2 size={20} color={designTokens.colors.semantic.success[600]} />
          <div>
            <div css={css`font-weight: ${designTokens.typography.fontWeight.semibold}; color: ${designTokens.colors.semantic.success[800]};`}>
              Approved & Executed
            </div>
            <div css={css`font-size: ${designTokens.typography.fontSize.xs}; color: ${designTokens.colors.semantic.success[600]};`}>
              {scenario.amount} MNT spent • Vault balance: {vaultBalance} MNT • Audit trail on Filecoin
            </div>
          </div>
        </div>
      )}

      {step === 'denied' && (
        <div css={css`${resultStyles}; background: ${designTokens.colors.semantic.error[50]}; border: 1px solid ${designTokens.colors.semantic.error[200]};`}>
          <XCircle size={20} color={designTokens.colors.semantic.error[600]} />
          <div>
            <div css={css`font-weight: ${designTokens.typography.fontWeight.semibold}; color: ${designTokens.colors.semantic.error[800]};`}>
              Denied by Policy
            </div>
            <div css={css`font-size: ${designTokens.typography.fontSize.xs}; color: ${designTokens.colors.semantic.error[600]};`}>
              {scenario.amount} MNT would exceed daily limit ({scenario.spentToday + scenario.amount}/{scenario.dailyLimit}) • Agent cannot see the limit (encrypted via FHE)
            </div>
          </div>
        </div>
      )}

      <div css={css`display: flex; gap: ${designTokens.spacing[3]}; margin-top: ${designTokens.spacing[4]};`}>
        {step === 'idle' ? (
          <Button variant="primary" onClick={runFlow}>
            Run spend evaluation
          </Button>
        ) : step === 'complete' || step === 'denied' ? (
          <>
            <Button variant="secondary" onClick={reset}>
              Reset
            </Button>
            <Button variant="ghost" onClick={nextScenario}>
              Try another
            </Button>
          </>
        ) : (
          <Button variant="secondary" disabled>
            <Loader2 size={16} css={css`animation: spin 1s linear infinite; @keyframes spin { to { transform: rotate(360deg); } }`} /> Processing...
          </Button>
        )}
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
