/** @jsxImportSource @emotion/react */
import { useState, useEffect } from 'react';
import { css } from '@emotion/react';
import { Wallet, ExternalLink, RefreshCw } from 'lucide-react';
import { designTokens } from '../../styles/design-system';
import { checkXLayerConnection } from '../../services/apiService';
import { fetchVaultBalance, checkMantleConnection, MANTLE_CONTRACT_ADDRESSES } from '../../services/mantleApi';

interface ChainBalance {
  chain: string;
  symbol: string;
  balance: string;
  connected: boolean;
  explorerUrl: string;
  address: string;
}

interface TreasuryProps {
  compact?: boolean;
}

export function Treasury({ compact }: TreasuryProps) {
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUsd, setTotalUsd] = useState<string>('—');

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchBalances() {
    setLoading(true);
    const results: ChainBalance[] = [];

    const [mantleConn, mantleBal, xlayerConn] = await Promise.all([
      checkMantleConnection(),
      fetchVaultBalance(),
      checkXLayerConnection(),
    ]);

    if (MANTLE_CONTRACT_ADDRESSES.GOVERNED_VAULT) {
      results.push({
        chain: 'Mantle',
        symbol: 'MNT',
        balance: mantleBal,
        connected: mantleConn.connected,
        explorerUrl: `https://sepolia.mantlescan.xyz/address/${MANTLE_CONTRACT_ADDRESSES.GOVERNED_VAULT}`,
        address: MANTLE_CONTRACT_ADDRESSES.GOVERNED_VAULT,
      });
    }

    results.push({
      chain: 'X Layer',
      symbol: 'OKB',
      balance: xlayerConn.connected ? '—' : '0',
      connected: xlayerConn.connected,
      explorerUrl: 'https://www.okx.com/explorer/xlayer-test/address/0x755602bBcAD94ccA126Cfc9E5Fa697432D9e2DD6',
      address: '0x755602bBcAD94ccA126Cfc9E5Fa697432D9e2DD6',
    });

    setBalances(results);
    setLoading(false);

    const mantleVal = parseFloat(mantleBal) || 0;
    if (mantleVal > 0) {
      setTotalUsd(`${mantleVal.toFixed(2)} MNT`);
    }
  }

  const containerStyles = css`
    display: flex;
    flex-direction: column;
    gap: ${designTokens.spacing[3]};
  `;

  const headerStyles = css`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `;

  const totalStyles = css`
    font-size: ${designTokens.typography.fontSize['2xl']};
    font-weight: ${designTokens.typography.fontWeight.bold};
    color: var(--text-primary, ${designTokens.colors.text.primary});
    letter-spacing: -0.025em;
  `;

  const chainRowStyles = css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${designTokens.spacing[3]};
    border-radius: ${designTokens.borderRadius.md};
    background: var(--surface-bg-alt, ${designTokens.colors.neutral[50]});
    transition: background 0.15s;

    &:hover {
      background: var(--surface-bg, ${designTokens.colors.neutral[100]});
    }
  `;

  const chainInfoStyles = css`
    display: flex;
    align-items: center;
    gap: ${designTokens.spacing[3]};
  `;

  const dotStyles = (connected: boolean) => css`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${connected ? designTokens.colors.semantic.success[500] : designTokens.colors.neutral[300]};
    flex-shrink: 0;
  `;

  const balanceStyles = css`
    font-size: ${designTokens.typography.fontSize.base};
    font-weight: ${designTokens.typography.fontWeight.semibold};
    color: var(--text-primary, ${designTokens.colors.text.primary});
    font-variant-numeric: tabular-nums;
  `;

  if (loading && balances.length === 0) {
    return (
      <div css={containerStyles}>
        <div css={css`height: 120px; background: var(--surface-bg-alt, ${designTokens.colors.neutral[50]}); border-radius: ${designTokens.borderRadius.md}; animation: pulse 2s infinite;`} />
      </div>
    );
  }

  return (
    <div css={containerStyles}>
      <div css={headerStyles}>
        <div>
          <div css={css`display: flex; align-items: center; gap: ${designTokens.spacing[2]}; margin-bottom: ${designTokens.spacing[1]};`}>
            <Wallet size={16} color={designTokens.colors.text.secondary} />
            <span css={css`font-size: ${designTokens.typography.fontSize.xs}; color: var(--text-secondary, ${designTokens.colors.text.secondary}); font-weight: ${designTokens.typography.fontWeight.medium}; text-transform: uppercase; letter-spacing: 0.05em;`}>
              Treasury
            </span>
          </div>
          <div css={totalStyles}>{totalUsd}</div>
        </div>
        <button
          onClick={fetchBalances}
          css={css`
            background: none; border: none; cursor: pointer; padding: ${designTokens.spacing[2]};
            color: var(--text-secondary, ${designTokens.colors.text.secondary});
            border-radius: ${designTokens.borderRadius.md};
            &:hover { background: var(--surface-bg-alt, ${designTokens.colors.neutral[100]}); }
          `}
          aria-label="Refresh balances"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {!compact && balances.map((b) => (
        <div key={b.chain} css={chainRowStyles}>
          <div css={chainInfoStyles}>
            <div css={dotStyles(b.connected)} />
            <div>
              <div css={css`font-size: ${designTokens.typography.fontSize.sm}; font-weight: ${designTokens.typography.fontWeight.medium}; color: var(--text-primary, ${designTokens.colors.text.primary});`}>
                {b.chain}
              </div>
              <div css={css`font-size: ${designTokens.typography.fontSize.xs}; color: var(--text-secondary, ${designTokens.colors.text.secondary}); font-family: ${designTokens.typography.fontFamily.mono};`}>
                {b.address.slice(0, 6)}...{b.address.slice(-4)}
              </div>
            </div>
          </div>
          <div css={css`display: flex; align-items: center; gap: ${designTokens.spacing[3]};`}>
            <span css={balanceStyles}>{b.balance} {b.symbol}</span>
            <a
              href={b.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              css={css`color: var(--text-secondary, ${designTokens.colors.text.secondary}); &:hover { color: ${designTokens.colors.primary[600]}; }`}
              aria-label={`View ${b.chain} on explorer`}
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
