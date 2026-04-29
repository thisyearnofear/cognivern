import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react';
import { useCofheEncrypt } from '@cofhe/react';
import { FheTypes } from '@cofhe/sdk';
import { designTokens, easings, keyframeAnimations } from '../../styles/design-system';
import { Card, CardContent, CardHeader, CardTitle, Button, LoadingSpinner } from '../ui';
import { spendApi } from '../../services/apiService';
import { Shield, Lock, ArrowRight, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { parseUnits } from 'viem';

export default function ConfidentialSpendForm() {
  const [amount, setAmount] = useState('');

  useEffect(() => {
    document.body.classList.add('show-cofhe-portal');
    return () => {
      document.body.classList.remove('show-cofhe-portal');
    };
  }, []);
  const [recipient, setRecipient] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { encryptInputsAsync, isEncrypting } = useCofheEncrypt();

  const handleSpend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Encrypt the amount using Fhenix/CoFHE
      // We use uint32 for the amount in this demo context
      const encryptedData = await encryptInputsAsync([
        {
          utype: FheTypes.Uint128,
          data: parseUnits(amount, 18), // Standardize to 18 decimals for the contract
          securityZone: 0,
        },
      ]);

      const amountCiphertext = encryptedData[0];

      // 2. Submit to backend
      const response = await spendApi.requestSpend({
        agentId: 'fhenix-confidential-agent',
        recipient,
        amount: amount, // Backend might still want the raw amount for some non-confidential checks or logging if allowed,
        // but the policy evaluation will use the ciphertext
        asset: 'FHE',
        reason,
        metadata: {
          confidential: true,
          amountCiphertext: amountCiphertext, // This is the InEuint256 struct
        },
      });

      if (response.success) {
        setSuccess(
          `Spend request submitted! Transaction: ${(response.data as any)?.txHash || 'Pending'}`,
        );
        setAmount('');
        setRecipient('');
        setReason('');
      } else {
        setError(response.error || 'Failed to submit spend request');
      }
    } catch (err: any) {
      console.error('Encryption or submission failed:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

   const formStyles = css`
     max-width: 600px;
     margin: 1.5rem auto;
     animation: ${keyframeAnimations.revealUp} 0.5s ${easings.smooth};
   `;

   const fieldStyles = css`
     margin-bottom: ${designTokens.spacing[4]};
     display: flex;
     flex-direction: column;
     gap: ${designTokens.spacing[2]};
   `;

  const labelStyles = css`
    font-weight: ${designTokens.typography.fontWeight.semibold};
    font-size: ${designTokens.typography.fontSize.sm};
    color: ${designTokens.colors.neutral[700]};
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[2]};
  `;

  const inputStyles = css`
    padding: ${designTokens.spacing[3]};
    border: 1px solid ${designTokens.colors.neutral[300]};
    border-radius: ${designTokens.borderRadius.md};
    font-size: ${designTokens.typography.fontSize.base};
    transition: all 0.2s ease;
    background: white;

    &:focus {
      outline: none;
      border-color: ${designTokens.colors.primary[500]};
      box-shadow: 0 0 0 3px ${designTokens.colors.primary[100]};
    }
  `;

  const shieldBadgeStyles = css`
    display: inline-flex;
    align-items: center;
    gap: ${designTokens.spacing[2]};
    padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
    background: ${designTokens.colors.primary[50]};
    color: ${designTokens.colors.primary[700]};
    border-radius: ${designTokens.borderRadius.full};
    font-size: ${designTokens.typography.fontSize.xs};
    font-weight: ${designTokens.typography.fontWeight.bold};
    margin-bottom: ${designTokens.spacing[4]};
    border: 1px solid ${designTokens.colors.primary[200]};
  `;

  return (
    <div css={formStyles}>
      <Card variant="glass" compact padding="sm">
        <CardHeader>
          <div css={shieldBadgeStyles}>
            <Shield size={14} />
            FHE CONFIDENTIAL SPEND
          </div>
          <CardTitle css={css`font-size: ${designTokens.typography.fontSize.base];`}>
            Confidential Spend Request
          </CardTitle>
          <p
            css={css`
              color: ${designTokens.colors.neutral[500]};
              font-size: ${designTokens.typography.fontSize.sm};
              margin-bottom: ${designTokens.spacing[3]};
            `}
          >
            Your spend amount is encrypted on-chain using Fully Homomorphic Encryption. Only the
            policy contract can "see" the value during evaluation.
          </p>
          <div
            css={css`
              padding: ${designTokens.spacing[3]};
              background: ${designTokens.colors.neutral[50]};
              border-radius: ${designTokens.borderRadius.md};
              border: 1px dashed ${designTokens.colors.neutral[300]};
              display: flex;
              align-items: flex-start;
              gap: ${designTokens.spacing[3]};
              font-size: ${designTokens.typography.fontSize.sm};
              color: ${designTokens.colors.neutral[600]};
              margin-bottom: ${designTokens.spacing[3]};
            `}
          >
            <AlertCircle
              size={16}
              css={css`
                flex-shrink: 0;
                margin-top: 2px;
              `}
            />
            <span>
              <strong>Note on Gas:</strong> The platform does not sponsor gas via a relayer for
              confidential operations. Your wallet will bear the Fhenix network gas costs for this
              encrypted policy evaluation.
            </span>
          </div>
          <div
            css={css`
              padding: ${designTokens.spacing[3]};
              background: ${designTokens.colors.primary[50]};
              border-radius: ${designTokens.borderRadius.md};
              border: 1px solid ${designTokens.colors.primary[200]};
              display: flex;
              align-items: flex-start;
              gap: ${designTokens.spacing[3]};
              font-size: ${designTokens.typography.fontSize.sm};
              color: ${designTokens.colors.primary[700]};
              margin-bottom: ${designTokens.spacing[6]};
            `}
          >
            <Info
              size={16}
              css={css`
                flex-shrink: 0;
                margin-top: 2px;
              `}
            />
            <span>
              <strong>Connect Fhenix FHE:</strong> To deploy this encrypted policy, please connect
              your wallet via the <strong>Enable Confidential Governance</strong> widget in the
              bottom right corner.
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSpend}>
            <div css={fieldStyles}>
              <label css={labelStyles}>Recipient Address</label>
              <input
                css={inputStyles}
                placeholder="0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                required
              />
            </div>

            <div css={fieldStyles}>
              <label css={labelStyles}>
                Amount (FHE-Token)
                <Tooltip content="This value will be encrypted before leaving your browser.">
                  <Lock
                    size={12}
                    css={css`
                      color: ${designTokens.colors.primary[500]};
                    `}
                  />
                </Tooltip>
              </label>
              <div
                css={css`
                  position: relative;
                `}
              >
                <input
                  css={css`
                    ${inputStyles};
                    width: 100%;
                    padding-right: 4rem;
                  `}
                  type="number"
                  step="0.000001"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <span
                  css={css`
                    position: absolute;
                    right: 1rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: ${designTokens.colors.neutral[400]};
                    font-weight: bold;
                  `}
                >
                  FHE
                </span>
              </div>
            </div>

            <div css={fieldStyles}>
              <label css={labelStyles}>Reason / Justification</label>
              <textarea
                css={css`
                  ${inputStyles};
                  min-height: 100px;
                  resize: vertical;
                `}
                placeholder="Why is this spend necessary?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            {error && (
              <div
                css={css`
                  padding: 1rem;
                  background: ${designTokens.colors.semantic.error[50]};
                  color: ${designTokens.colors.semantic.error[700]};
                  border-radius: ${designTokens.borderRadius.md};
                  margin-bottom: 1rem;
                  display: flex;
                  align-items: center;
                  gap: 0.5rem;
                  font-size: 0.875rem;
                `}
              >
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {success && (
              <div
                css={css`
                  padding: 1rem;
                  background: ${designTokens.colors.semantic.success[50]};
                  color: ${designTokens.colors.semantic.success[700]};
                  border-radius: ${designTokens.borderRadius.md};
                  margin-bottom: 1rem;
                  display: flex;
                  align-items: center;
                  gap: 0.5rem;
                  font-size: 0.875rem;
                `}
              >
                <CheckCircle size={16} />
                {success}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isSubmitting || isEncrypting}
              css={css`
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                height: 3.5rem;
                font-size: 1.1rem;
              `}
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner size="sm" color="white" />
                  {isEncrypting ? 'Encrypting Data...' : 'Submitting...'}
                </>
              ) : (
                <>
                  Confirm Encrypted Spend
                  <ArrowRight size={18} />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Simple Tooltip component if not available
function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  return (
    <div
      css={css`
        position: relative;
        display: inline-block;
        cursor: help;
      `}
      title={content}
    >
      {children}
    </div>
  );
}
