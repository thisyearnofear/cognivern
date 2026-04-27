import React, { useState } from 'react';
import { css } from '@emotion/react';
import { useCofheContext } from '@cofhe/react';
import { designTokens, easings } from '../../styles/design-system';
import { Card, CardContent, CardHeader, CardTitle, Button, LoadingSpinner } from '../ui';
import { Shield, Unlock, Eye, Key, AlertCircle } from 'lucide-react';

interface ConfidentialAuditViewerProps {
  encryptedAmount: any; // InEuint256 struct or similar
  decisionId: string;
}

export default function ConfidentialAuditViewer({
  encryptedAmount,
  decisionId,
}: ConfidentialAuditViewerProps) {
  const [decryptedValue, setDecryptedValue] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { client } = useCofheContext();

  const handleDecrypt = async () => {
    setIsDecrypting(true);
    setError(null);

    try {
      // 1. In a real scenario, we'd fetch a permit from the backend or generate one
      // For the demo, we assume the user's wallet is the auditor

      // Request a permit for the ConfidentialSpendPolicy contract
      const contractAddress = '0x8245D803a6C0f11186714E78125868B4f92B8b69'; // From our implementation

      const permit = await client.getPermit(contractAddress);

      // 2. Call backend to get the unsealed value using the permit
      // Note: In Fhenix, unsealing usually happens via a view call with a permit
      // or the backend can facilitate this if it has the auditor's authorization.

      // For this demo, we'll simulate the backend calling the contract's unseal method
      const response = await fetch(`/api/fhenix/decrypt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permit,
          encryptedValue: encryptedAmount,
          contractAddress,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setDecryptedValue(result.data.value);
      } else {
        setError(result.error || 'Decryption failed');
      }
    } catch (err: any) {
      console.error('Decryption error:', err);
      setError(err.message || 'Failed to decrypt. Ensure your wallet has auditor permissions.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const viewerStyles = css`
    padding: ${designTokens.spacing[4]};
    background: ${designTokens.colors.neutral[50]};
    border-radius: ${designTokens.borderRadius.lg};
    border: 1px dashed ${designTokens.colors.neutral[300]};
    margin-top: ${designTokens.spacing[4]};
  `;

  return (
    <div css={viewerStyles}>
      <div
        css={css`
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        `}
      >
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: ${designTokens.colors.neutral[600]};
            font-size: 0.875rem;
          `}
        >
          <Shield size={16} />
          <span>Confidential Data (Decision: {decisionId.slice(0, 8)}...)</span>
        </div>
        {!decryptedValue && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleDecrypt}
            disabled={isDecrypting}
            css={css`
              gap: 0.5rem;
            `}
          >
            {isDecrypting ? <LoadingSpinner size="xs" /> : <Unlock size={14} />}
            Decrypt with Auditor Permit
          </Button>
        )}
      </div>

      <div
        css={css`
          background: white;
          padding: 1.5rem;
          border-radius: ${designTokens.borderRadius.md};
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          min-height: 100px;
          justify-content: center;
        `}
      >
        {decryptedValue ? (
          <div
            css={css`
              animation: ${keyframeAnimations.reveal} 0.5s ease;
              text-align: center;
            `}
          >
            <div
              css={css`
                font-size: 0.75rem;
                color: ${designTokens.colors.neutral[400]};
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-bottom: 0.25rem;
              `}
            >
              Decrypted Amount
            </div>
            <div
              css={css`
                font-size: 2rem;
                font-weight: bold;
                color: ${designTokens.colors.primary[600]};
              `}
            >
              {decryptedValue}{' '}
              <span
                css={css`
                  font-size: 1rem;
                  color: ${designTokens.colors.neutral[400]};
                `}
              >
                FHE
              </span>
            </div>
            <div
              css={css`
                margin-top: 1rem;
                font-size: 0.75rem;
                color: ${designTokens.colors.semantic.success[600]};
                display: flex;
                align-items: center;
                gap: 0.25rem;
                justify-content: center;
              `}
            >
              <Eye size={12} />
              Verified via FHE Unseal
            </div>
          </div>
        ) : (
          <>
            <div
              css={css`
                color: ${designTokens.colors.neutral[400]};
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0.5rem;
              `}
            >
              <Key
                size={32}
                css={css`
                  opacity: 0.5;
                `}
              />
              <p>
                {isDecrypting
                  ? 'Requesting permit and unsealing...'
                  : 'Value is encrypted and hidden from public view.'}
              </p>
            </div>
            {error && (
              <div
                css={css`
                  color: ${designTokens.colors.semantic.error[600]};
                  font-size: 0.875rem;
                  display: flex;
                  align-items: center;
                  gap: 0.25rem;
                `}
              >
                <AlertCircle size={14} />
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
