/** @jsxImportSource @emotion/react */
import React, { useState } from 'react';
import { css } from '@emotion/react';
import { Search, Shield, Loader2, AlertCircle } from 'lucide-react';
import { designTokens } from '../../styles/design-system';
import { ContractAuditBadge, ContractAuditResult } from '../trading/ContractAuditBadge';
import apiService from '../../services/apiService';

interface ContractScannerProps {
  compact?: boolean;
  onScanComplete?: (result: ContractAuditResult) => void;
}

export const ContractScanner: React.FC<ContractScannerProps> = ({
  compact = false,
  onScanComplete,
}) => {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContractAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(address);

  const handleScan = async () => {
    if (!isValidAddress) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiService.scanContract(address);
      if (response.success) {
        const auditResult = response.data as ContractAuditResult;
        setResult(auditResult);
        onScanComplete?.(auditResult);
      } else {
        setError(response.error || 'Scan failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValidAddress && !loading) {
      handleScan();
    }
  };

  if (compact) {
    return (
      <div
        css={css`
          display: flex;
          flex-direction: column;
          gap: ${designTokens.spacing[3]};
        `}
      >
        <div
          css={css`
            display: flex;
            gap: ${designTokens.spacing[2]};
          `}
        >
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="0x... paste contract address"
            css={css`
              flex: 1;
              padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
              border: 2px solid ${designTokens.colors.neutral[200]};
              border-radius: ${designTokens.borderRadius.lg};
              font-family: monospace;
              font-size: ${designTokens.typography.fontSize.sm};
              transition: border-color ${designTokens.animation.duration.fast};

              &:focus {
                outline: none;
                border-color: ${designTokens.colors.primary[500]};
              }

              &::placeholder {
                color: ${designTokens.colors.neutral[400]};
              }
            `}
          />
          <button
            onClick={handleScan}
            disabled={!isValidAddress || loading}
            css={css`
              display: flex;
              align-items: center;
              gap: ${designTokens.spacing[2]};
              padding: ${designTokens.spacing[2]} ${designTokens.spacing[4]};
              background: ${isValidAddress
                ? designTokens.colors.primary[500]
                : designTokens.colors.neutral[300]};
              color: white;
              border: none;
              border-radius: ${designTokens.borderRadius.lg};
              font-weight: ${designTokens.typography.fontWeight.medium};
              cursor: ${isValidAddress ? 'pointer' : 'not-allowed'};
              transition: all ${designTokens.animation.duration.fast};

              &:hover:not(:disabled) {
                background: ${designTokens.colors.primary[600]};
              }
            `}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Scan
          </button>
        </div>

        {error && (
          <div
            css={css`
              display: flex;
              align-items: center;
              gap: ${designTokens.spacing[2]};
              padding: ${designTokens.spacing[3]};
              background: ${designTokens.colors.semantic.error[50]};
              border-radius: ${designTokens.borderRadius.md};
              color: ${designTokens.colors.semantic.error[700]};
              font-size: ${designTokens.typography.fontSize.sm};
            `}
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {result && <ContractAuditBadge audit={result} compact />}
      </div>
    );
  }

  return (
    <div
      css={css`
        background: white;
        border-radius: ${designTokens.borderRadius.xl};
        box-shadow: ${designTokens.shadows.lg};
        padding: ${designTokens.spacing[6]};
        max-width: 600px;
        width: 100%;
      `}
    >
      {/* Header */}
      <div
        css={css`
          display: flex;
          align-items: center;
          gap: ${designTokens.spacing[3]};
          margin-bottom: ${designTokens.spacing[4]};
        `}
      >
        <div
          css={css`
            width: 48px;
            height: 48px;
            border-radius: ${designTokens.borderRadius.lg};
            background: linear-gradient(
              135deg,
              ${designTokens.colors.primary[500]},
              ${designTokens.colors.primary[600]}
            );
            display: flex;
            align-items: center;
            justify-content: center;
          `}
        >
          <Shield size={24} color="white" />
        </div>
        <div>
          <h3
            css={css`
              font-size: ${designTokens.typography.fontSize.lg};
              font-weight: ${designTokens.typography.fontWeight.bold};
              color: ${designTokens.colors.neutral[900]};
              margin: 0;
            `}
          >
            Contract Scanner
          </h3>
          <p
            css={css`
              font-size: ${designTokens.typography.fontSize.sm};
              color: ${designTokens.colors.neutral[500]};
              margin: 0;
            `}
          >
            Powered by ChainGPT AI • No wallet required
          </p>
        </div>
      </div>

      {/* Input */}
      <div
        css={css`
          display: flex;
          gap: ${designTokens.spacing[3]};
          margin-bottom: ${designTokens.spacing[4]};
        `}
      >
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste any contract address (0x...)"
          css={css`
            flex: 1;
            padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
            border: 2px solid ${designTokens.colors.neutral[200]};
            border-radius: ${designTokens.borderRadius.lg};
            font-family: monospace;
            font-size: ${designTokens.typography.fontSize.base};
            transition: border-color ${designTokens.animation.duration.fast};

            &:focus {
              outline: none;
              border-color: ${designTokens.colors.primary[500]};
            }

            &::placeholder {
              color: ${designTokens.colors.neutral[400]};
            }
          `}
        />
        <button
          onClick={handleScan}
          disabled={!isValidAddress || loading}
          css={css`
            display: flex;
            align-items: center;
            gap: ${designTokens.spacing[2]};
            padding: ${designTokens.spacing[3]} ${designTokens.spacing[6]};
            background: ${isValidAddress
              ? `linear-gradient(135deg, ${designTokens.colors.primary[500]}, ${designTokens.colors.primary[600]})`
              : designTokens.colors.neutral[300]};
            color: white;
            border: none;
            border-radius: ${designTokens.borderRadius.lg};
            font-weight: ${designTokens.typography.fontWeight.semibold};
            font-size: ${designTokens.typography.fontSize.base};
            cursor: ${isValidAddress ? 'pointer' : 'not-allowed'};
            transition: all ${designTokens.animation.duration.fast};
            box-shadow: ${isValidAddress ? designTokens.shadows.md : 'none'};

            &:hover:not(:disabled) {
              transform: translateY(-1px);
              box-shadow: ${designTokens.shadows.lg};
            }
          `}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Search size={18} />
              Scan Contract
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: ${designTokens.spacing[2]};
            padding: ${designTokens.spacing[4]};
            background: ${designTokens.colors.semantic.error[50]};
            border: 1px solid ${designTokens.colors.semantic.error[200]};
            border-radius: ${designTokens.borderRadius.lg};
            margin-bottom: ${designTokens.spacing[4]};
            color: ${designTokens.colors.semantic.error[700]};
          `}
        >
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          css={css`
            animation: fadeIn 0.3s ease-out;

            @keyframes fadeIn {
              from {
                opacity: 0;
                transform: translateY(10px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}
        >
          <ContractAuditBadge audit={result} />
        </div>
      )}

      {/* Example addresses */}
      {!result && !loading && (
        <div
          css={css`
            margin-top: ${designTokens.spacing[4]};
            padding-top: ${designTokens.spacing[4]};
            border-top: 1px solid ${designTokens.colors.neutral[100]};
          `}
        >
          <p
            css={css`
              font-size: ${designTokens.typography.fontSize.xs};
              color: ${designTokens.colors.neutral[500]};
              margin: 0 0 ${designTokens.spacing[2]};
            `}
          >
            Try these contracts:
          </p>
          <div
            css={css`
              display: flex;
              flex-wrap: wrap;
              gap: ${designTokens.spacing[2]};
            `}
          >
            {[
              { name: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
              { name: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
              { name: 'Uniswap V3', address: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45' },
            ].map((contract) => (
              <button
                key={contract.name}
                onClick={() => setAddress(contract.address)}
                css={css`
                  padding: ${designTokens.spacing[1]} ${designTokens.spacing[3]};
                  background: ${designTokens.colors.neutral[50]};
                  border: 1px solid ${designTokens.colors.neutral[200]};
                  border-radius: ${designTokens.borderRadius.full};
                  font-size: ${designTokens.typography.fontSize.xs};
                  color: ${designTokens.colors.neutral[700]};
                  cursor: pointer;
                  transition: all ${designTokens.animation.duration.fast};

                  &:hover {
                    background: ${designTokens.colors.primary[50]};
                    border-color: ${designTokens.colors.primary[300]};
                  }
                `}
              >
                {contract.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractScanner;
