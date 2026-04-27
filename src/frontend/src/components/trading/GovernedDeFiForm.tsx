import React, { useState } from 'react';
import { css } from '@emotion/react';
import { designTokens } from '../../styles/design-system';
import { Card, CardHeader, CardTitle, CardContent, Button, LoadingSpinner } from '../ui';
import { getFormInputStyles } from '../../styles/design-system';
import { Shield, ArrowRightLeft, Lock, Zap, Info } from 'lucide-react';

interface GovernedDeFiFormProps {
  agentId: string;
  policyId: string;
}

export const GovernedDeFiForm: React.FC<GovernedDeFiFormProps> = ({ agentId, policyId }) => {
  const [amount, setAmount] = useState('100');
  const [target, setTarget] = useState('0x6EDCE65403992e310A62460808c4b910D972f10f'); // Mock X Layer Router
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; txHash?: string; error?: string } | null>(null);

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExecuting(true);
    setResult(null);

    try {
      // Simulate calling the backend executeDeFiAction
      const response = await fetch('/api/spend/defi-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          policyId,
          amount,
          target,
          data: '0x12345678' // Mock calldata for a swap
        })
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ success: false, error: 'Failed to communicate with backend' });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div css={css`display: flex; align-items: center; gap: 0.5rem;`}>
          <Shield color={designTokens.colors.primary[500]} size={20} />
          <CardTitle>Governed DeFi Execution</CardTitle>
        </div>
        <p css={css`font-size: 0.875rem; color: ${designTokens.colors.neutral[500]};`}>
          Execute DeFi actions on X Layer gated by Fhenix Confidential Policies.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleExecute} css={css`display: flex; flex-direction: column; gap: 1.5rem;`}>
          <div>
            <label css={labelStyle}>Execution Target (X Layer Router)</label>
            <input
              css={getFormInputStyles()}
              value={target}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTarget(e.target.value)}
              placeholder="0x..."
            />
          </div>

          <div>
            <label css={labelStyle}>Amount (USDT)</label>
            <div css={css`display: flex; align-items: center; gap: 0.5rem;`}>
              <input
                css={getFormInputStyles()}
                type="number"
                value={amount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
              />
              <span css={css`font-weight: 600; color: ${designTokens.colors.neutral[600]};`}>USDT</span>
            </div>
          </div>

          <div css={infoBoxStyle}>
            <Lock size={14} />
            <span>
              Your budget is verified on Fhenix using FHE before the Vault executes this call on X Layer.
            </span>
          </div>

          <Button type="submit" disabled={isExecuting} css={css`gap: 0.5rem;`}>
            {isExecuting ? <LoadingSpinner size="sm" /> : <Zap size={16} />}
            Request Governed Execution
          </Button>

          {result && (
            <div css={resultStyle(result.success)}>
              {result.success ? (
                <>
                  <p><strong>Success!</strong> Decision dispatched via Hyperlane.</p>
                  <p css={css`font-size: 0.75rem; word-break: break-all;`}>TX: {result.txHash}</p>
                </>
              ) : (
                <p><strong>Error:</strong> {result.error}</p>
              )}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

const labelStyle = css`
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: ${designTokens.colors.neutral[500]};
  text-transform: uppercase;
  margin-bottom: 0.5rem;
`;

const infoBoxStyle = css`
  padding: 0.75rem;
  background: ${designTokens.colors.primary[50]};
  border-radius: ${designTokens.borderRadius.md};
  color: ${designTokens.colors.primary[700]};
  font-size: 0.8125rem;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  border: 1px solid ${designTokens.colors.primary[100]};
`;

const resultStyle = (success: boolean) => css`
  padding: 1rem;
  border-radius: ${designTokens.borderRadius.md};
  background: ${success ? designTokens.colors.semantic.success[50] : designTokens.colors.semantic.error[50]};
  color: ${success ? designTokens.colors.semantic.success[700] : designTokens.colors.semantic.error[700]};
  font-size: 0.875rem;
  border: 1px solid ${success ? designTokens.colors.semantic.success[200] : designTokens.colors.semantic.error[200]};
`;
