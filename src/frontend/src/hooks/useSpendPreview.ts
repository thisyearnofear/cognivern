import { useState } from 'react';
import { apiService } from '../../services/apiService';
import { ContractAuditResult } from '../components/trading/ContractAuditBadge';

export interface SpendPreviewResult {
  intentId: string;
  status: 'approved' | 'denied' | 'held';
  policyId?: string;
  reason?: string;
  simulation: {
    wouldExecute: boolean;
    gasEstimate?: string;
    warnings: string[];
  };
  contractAudit?: ContractAuditResult;
}

interface UseSpendPreviewReturn {
  preview: SpendPreviewResult | null;
  loading: boolean;
  error: string | null;
  requestPreview: (data: {
    agentId: string;
    recipient: string;
    amount: string;
    asset: string;
    reason: string;
    metadata?: Record<string, any>;
  }) => Promise<SpendPreviewResult | null>;
  clearPreview: () => void;
}

export function useSpendPreview(): UseSpendPreviewReturn {
  const [preview, setPreview] = useState<SpendPreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPreview = async (data: {
    agentId: string;
    recipient: string;
    amount: string;
    asset: string;
    reason: string;
    metadata?: Record<string, any>;
  }): Promise<SpendPreviewResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.previewSpend(data);

      if (response.success) {
        const result = response.data as SpendPreviewResult;
        setPreview(result);
        return result;
      } else {
        const errorMsg = response.error || 'Preview failed';
        setError(errorMsg);
        return null;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const clearPreview = () => {
    setPreview(null);
    setError(null);
  };

  return {
    preview,
    loading,
    error,
    requestPreview,
    clearPreview,
  };
}

export default useSpendPreview;
