'use client';

import { useState, useCallback } from 'react';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface QuickCreditStatus {
  hasCredit: boolean;
  isBlocked: boolean;
  hasOverdue: boolean;
  utilizationPercent: number;
  statusColor: 'green' | 'yellow' | 'red';
  statusLabel: string;
}

export interface CreditValidationResult {
  canProceed: boolean;
  requiresOverride: boolean;
  warnings: string[];
  errors: string[];
  creditStatus: {
    limit: number;
    usedFromLedger: number;
    cachedDebt: number;
    available: number;
    utilizationPercent: number;
    needsReconciliation: boolean;
    differenceAmount: number;
  };
  overdueStatus: {
    hasOverdue: boolean;
    overdueAmount: number;
    oldestOverdueDays: number;
    overdueInvoices: Array<{
      id: number;
      numero: string;
      amount: number;
      daysOverdue: number;
      fechaVencimiento: string;
      saldoPendiente: number;
    }>;
    aging: Array<{
      label: string;
      amount: number;
      count: number;
    }>;
  };
  checkStatus: {
    totalInCartera: number;
    cantidadCheques: number;
    excedeLimite: boolean;
    limiteCheques: number | null;
    proximoVencimiento: string | null;
    chequesPorVencer30Dias: number;
  };
  blockStatus: {
    isBlocked: boolean;
    blockedReason: string | null;
    blockedAt: string | null;
    tipoBloqueo: string | null;
  };
  clientInfo: {
    id: string;
    name: string;
    cuit: string | null;
    paymentTerms: number;
  };
}

interface UseCreditValidationReturn {
  isValidating: boolean;
  validationResult: CreditValidationResult | null;
  quickStatus: QuickCreditStatus | null;
  validateCredit: (clientId: string, orderAmount?: number) => Promise<CreditValidationResult | null>;
  getQuickStatus: (clientId: string) => Promise<QuickCreditStatus | null>;
  clearValidation: () => void;
}

export function useCreditValidation(): UseCreditValidationReturn {
  const { mode: viewMode } = useViewMode();
  const { user } = useAuth();
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<CreditValidationResult | null>(null);
  const [quickStatus, setQuickStatus] = useState<QuickCreditStatus | null>(null);

  const validateCredit = useCallback(
    async (clientId: string, orderAmount: number = 0): Promise<CreditValidationResult | null> => {
      if (!clientId) {
        toast.error('Cliente no especificado');
        return null;
      }

      setIsValidating(true);
      try {
        const params = new URLSearchParams({
          viewMode,
          orderAmount: orderAmount.toString(),
        });

        const response = await fetch(`/api/ventas/clientes/${clientId}/credito?${params}`);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Error al validar credito');
        }

        const result = await response.json();
        setValidationResult(result);
        return result;
      } catch (error: any) {
        toast.error(error.message || 'Error al validar credito');
        return null;
      } finally {
        setIsValidating(false);
      }
    },
    [viewMode]
  );

  const getQuickStatus = useCallback(
    async (clientId: string): Promise<QuickCreditStatus | null> => {
      if (!clientId) {
        return null;
      }

      try {
        const params = new URLSearchParams({
          viewMode,
          quick: 'true',
        });

        const response = await fetch(`/api/ventas/clientes/${clientId}/credito?${params}`);

        if (!response.ok) {
          return null;
        }

        const result = await response.json();
        setQuickStatus(result);
        return result;
      } catch (error) {
        console.error('Error getting quick credit status:', error);
        return null;
      }
    },
    [viewMode]
  );

  const clearValidation = useCallback(() => {
    setValidationResult(null);
    setQuickStatus(null);
  }, []);

  return {
    isValidating,
    validationResult,
    quickStatus,
    validateCredit,
    getQuickStatus,
    clearValidation,
  };
}

/**
 * Hook for batch credit status (multiple clients)
 */
export function useBatchCreditStatus() {
  const { mode: viewMode } = useViewMode();
  const [statusMap, setStatusMap] = useState<Map<string, QuickCreditStatus>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const fetchBatchStatus = useCallback(
    async (clientIds: string[]): Promise<Map<string, QuickCreditStatus>> => {
      if (!clientIds.length) {
        return new Map();
      }

      setIsLoading(true);
      try {
        // Fetch status for each client in parallel (max 10 concurrent)
        const batchSize = 10;
        const results = new Map<string, QuickCreditStatus>();

        for (let i = 0; i < clientIds.length; i += batchSize) {
          const batch = clientIds.slice(i, i + batchSize);
          const promises = batch.map(async (clientId) => {
            try {
              const params = new URLSearchParams({
                viewMode,
                quick: 'true',
              });
              const response = await fetch(`/api/ventas/clientes/${clientId}/credito?${params}`);
              if (response.ok) {
                const status = await response.json();
                return { clientId, status };
              }
              return null;
            } catch {
              return null;
            }
          });

          const batchResults = await Promise.all(promises);
          batchResults.forEach((result) => {
            if (result) {
              results.set(result.clientId, result.status);
            }
          });
        }

        setStatusMap(results);
        return results;
      } finally {
        setIsLoading(false);
      }
    },
    [viewMode]
  );

  const getStatus = useCallback(
    (clientId: string): QuickCreditStatus | undefined => {
      return statusMap.get(clientId);
    },
    [statusMap]
  );

  return {
    isLoading,
    statusMap,
    fetchBatchStatus,
    getStatus,
  };
}
