import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface BankStatement {
  id: number;
  periodo: string;
  estado: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADA' | 'CON_DIFERENCIAS' | 'CERRADA';
  saldoInicial: number;
  saldoFinal: number;
  totalDebitos: number;
  totalCreditos: number;
  totalItems: number;
  itemsConciliados: number;
  itemsPendientes: number;
  itemsSuspense: number;
  bankAccount: { id: number; nombre: string; banco: string; numeroCuenta?: string; saldoContable?: number; saldoBancario?: number };
  items?: BankStatementItem[];
  _count?: { items: number };
}

export interface BankStatementItem {
  id: number;
  lineNumber: number;
  fecha: string;
  fechaValor: string | null;
  descripcion: string;
  referencia: string | null;
  debito: number;
  credito: number;
  saldo: number;
  conciliado: boolean;
  matchType: 'EXACT' | 'FUZZY' | 'REFERENCE' | 'MANUAL' | null;
  matchConfidence: number | null;
  esSuspense: boolean;
  suspenseResuelto: boolean;
  suspenseNotas: string | null;
  treasuryMovement: TreasuryMovement | null;
}

export interface TreasuryMovement {
  id: number;
  fecha: string;
  tipo: string;
  medio?: string;
  monto: number;
  descripcion: string | null;
  referenceType: string | null;
}

export interface ReconciliationSummary {
  totalItems: number;
  matched: number;
  pending: number;
  suspense: number;
  suspenseResolved: number;
  matchBreakdown: Record<string, number>;
}

export interface MatchSuggestion {
  bankMovement: {
    id: number;
    fecha: string;
    concepto: string;
    monto: number;
    tipo: string;
  };
  matches: Array<{
    paymentId: number;
    score: number;
    confidence: 'high' | 'medium' | 'low';
    payment?: {
      id: number;
      numero: string;
      fecha: string;
      monto: number;
      clientName: string;
    };
  }>;
}

interface BankAccount {
  id: number;
  nombre: string;
  banco: string;
}

// ═══════════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

async function fetchStatements(
  companyId: number,
  viewMode: string,
  filters: { bankAccountId?: string; estado?: string; limit: number; offset: number }
): Promise<{ data: BankStatement[]; pagination: { total: number; limit: number; offset: number } }> {
  const params = new URLSearchParams({
    companyId: companyId.toString(),
    viewMode,
    limit: filters.limit.toString(),
    offset: filters.offset.toString(),
  });
  if (filters.bankAccountId) params.append('bankAccountId', filters.bankAccountId);
  if (filters.estado) params.append('estado', filters.estado);

  const res = await fetch(`/api/tesoreria/conciliacion?${params}`);
  if (!res.ok) throw new Error('Error al obtener extractos');
  return res.json();
}

async function fetchStatementDetail(
  statementId: number
): Promise<{ statement: BankStatement & { items: BankStatementItem[] }; summary: ReconciliationSummary }> {
  const res = await fetch(`/api/tesoreria/conciliacion/${statementId}`);
  if (!res.ok) throw new Error('Error al obtener detalle');
  return res.json();
}

async function fetchUnmatchedMovements(
  statementId: number,
  filters?: { fechaDesde?: string; fechaHasta?: string; tipo?: string }
): Promise<TreasuryMovement[]> {
  const params = new URLSearchParams({ action: 'unmatched-movements' });
  if (filters?.fechaDesde) params.append('fechaDesde', filters.fechaDesde);
  if (filters?.fechaHasta) params.append('fechaHasta', filters.fechaHasta);
  if (filters?.tipo) params.append('tipo', filters.tipo);

  const res = await fetch(`/api/tesoreria/conciliacion/${statementId}?${params}`);
  if (!res.ok) throw new Error('Error al obtener movimientos');
  return res.json();
}

async function fetchSuggestions(
  accountId?: number,
  limit?: number
): Promise<{ suggestions: MatchSuggestion[]; stats: any }> {
  const params = new URLSearchParams();
  if (accountId) params.append('accountId', accountId.toString());
  if (limit) params.append('limit', limit.toString());

  const res = await fetch(`/api/tesoreria/conciliacion/sugerencias?${params}`);
  if (!res.ok) throw new Error('Error al obtener sugerencias');
  return res.json();
}

async function fetchBancos(): Promise<{ data: BankAccount[] }> {
  const res = await fetch('/api/tesoreria/bancos');
  if (!res.ok) throw new Error('Error al obtener bancos');
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════

export function useBankReconciliation(companyId: number, viewMode: string) {
  const queryClient = useQueryClient();

  // Estados
  const [selectedStatementId, setSelectedStatementId] = useState<number | null>(null);
  const [selectedBankItems, setSelectedBankItems] = useState<number[]>([]);
  const [selectedSystemMovements, setSelectedSystemMovements] = useState<number[]>([]);
  const [filters, setFilters] = useState({
    bankAccountId: '',
    estado: '',
    limit: 50,
    offset: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');

  // ─── Queries ───────────────────────────────────────────────────

  const statementsQuery = useQuery({
    queryKey: ['tesoreria', 'conciliacion', companyId, viewMode, filters],
    queryFn: () => fetchStatements(companyId, viewMode, filters),
    enabled: !!companyId,
  });

  const detailQuery = useQuery({
    queryKey: ['tesoreria', 'conciliacion', 'detail', selectedStatementId],
    queryFn: () => fetchStatementDetail(selectedStatementId!),
    enabled: !!selectedStatementId && !!companyId,
  });

  const unmatchedQuery = useQuery({
    queryKey: ['tesoreria', 'conciliacion', 'unmatched', selectedStatementId],
    queryFn: () => fetchUnmatchedMovements(selectedStatementId!),
    enabled: !!selectedStatementId && !!companyId,
  });

  const suggestionsQuery = useQuery({
    queryKey: ['tesoreria', 'conciliacion', 'sugerencias', detailQuery.data?.statement?.bankAccount?.id],
    queryFn: () => fetchSuggestions(detailQuery.data?.statement?.bankAccount?.id),
    enabled: !!detailQuery.data?.statement?.bankAccount?.id,
  });

  const bancosQuery = useQuery({
    queryKey: ['tesoreria', 'bancos'],
    queryFn: fetchBancos,
  });

  // ─── Mutations ─────────────────────────────────────────────────

  const importMutation = useMutation({
    mutationFn: async (data: {
      bankAccountId: number;
      periodo: string;
      items: any[];
      saldoInicial: number;
      saldoFinal?: number;
      docType: 'T1' | 'T2';
    }) => {
      const res = await fetch('/api/tesoreria/conciliacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al importar extracto');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria', 'conciliacion'] });
      toast.success('Extracto importado exitosamente');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const autoMatchMutation = useMutation({
    mutationFn: async (statementId: number) => {
      const res = await fetch(`/api/tesoreria/conciliacion/${statementId}/auto-match`, {
        method: 'POST',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error en auto-match');
      }
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria', 'conciliacion'] });
      toast.success(`Auto-match: ${result.matched} coincidencias encontradas`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const manualMatchMutation = useMutation({
    mutationFn: async ({
      statementId,
      itemId,
      movementId,
    }: {
      statementId: number;
      itemId: number;
      movementId: number;
    }) => {
      const res = await fetch(`/api/tesoreria/conciliacion/${statementId}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'match', itemId, movementId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al conciliar');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria', 'conciliacion'] });
      setSelectedBankItems([]);
      setSelectedSystemMovements([]);
      toast.success('Movimiento conciliado manualmente');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const unmatchMutation = useMutation({
    mutationFn: async ({
      statementId,
      itemId,
    }: {
      statementId: number;
      itemId: number;
    }) => {
      const res = await fetch(`/api/tesoreria/conciliacion/${statementId}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unmatch', itemId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al deshacer conciliación');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria', 'conciliacion'] });
      toast.success('Conciliación deshecha');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const cierreMutation = useMutation({
    mutationFn: async (data: {
      statementId: number;
      justificacionDiferencias?: Array<{ monto: number; concepto: string; justificacion: string }>;
      notasCierre?: string;
      forzarCierre?: boolean;
      generarAjuste?: boolean;
      saldoBancarioReal?: number;
    }) => {
      const res = await fetch('/api/tesoreria/conciliacion/cierre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al cerrar conciliación');
      }
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tesoreria', 'conciliacion'] });
      toast.success(result.message);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ─── Selection Handlers ────────────────────────────────────────

  const toggleBankItemSelection = useCallback((itemId: number) => {
    setSelectedBankItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  }, []);

  const toggleSystemMovementSelection = useCallback((movementId: number) => {
    setSelectedSystemMovements((prev) =>
      prev.includes(movementId) ? prev.filter((id) => id !== movementId) : [...prev, movementId]
    );
  }, []);

  const clearSelections = useCallback(() => {
    setSelectedBankItems([]);
    setSelectedSystemMovements([]);
  }, []);

  // ─── Match Handler ─────────────────────────────────────────────

  const handleManualMatch = useCallback(() => {
    if (selectedBankItems.length !== 1 || selectedSystemMovements.length !== 1) {
      toast.error('Seleccione exactamente un item bancario y un movimiento del sistema');
      return;
    }
    if (!selectedStatementId) return;

    manualMatchMutation.mutate({
      statementId: selectedStatementId,
      itemId: selectedBankItems[0],
      movementId: selectedSystemMovements[0],
    });
  }, [selectedBankItems, selectedSystemMovements, selectedStatementId, manualMatchMutation]);

  // ─── Filtered Items ────────────────────────────────────────────

  const filteredBankItems = useMemo(() => {
    const items = detailQuery.data?.statement?.items || [];
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(
      (item) =>
        item.descripcion.toLowerCase().includes(term) ||
        item.referencia?.toLowerCase().includes(term) ||
        item.fecha.includes(term)
    );
  }, [detailQuery.data?.statement?.items, searchTerm]);

  const filteredUnmatched = useMemo(() => {
    const movements = unmatchedQuery.data || [];
    if (!searchTerm) return movements;
    const term = searchTerm.toLowerCase();
    return movements.filter(
      (m) =>
        m.descripcion?.toLowerCase().includes(term) ||
        m.referenceType?.toLowerCase().includes(term) ||
        m.fecha.includes(term)
    );
  }, [unmatchedQuery.data, searchTerm]);

  // ─── Stats ─────────────────────────────────────────────────────

  const statements = statementsQuery.data?.data || [];
  const bancos = bancosQuery.data?.data || [];
  const detail = detailQuery.data?.statement;
  const summary = detailQuery.data?.summary;
  const suggestions = suggestionsQuery.data?.suggestions || [];

  return {
    // Datos
    statements,
    bancos,
    detail,
    summary,
    suggestions,
    filteredBankItems,
    filteredUnmatched,
    pagination: statementsQuery.data?.pagination,

    // Estados
    selectedStatementId,
    selectedBankItems,
    selectedSystemMovements,
    filters,
    searchTerm,

    // Loading
    isLoading: statementsQuery.isLoading,
    isLoadingDetail: detailQuery.isLoading,
    isLoadingUnmatched: unmatchedQuery.isLoading,
    isLoadingSuggestions: suggestionsQuery.isLoading,
    isFetching: statementsQuery.isFetching,
    error: statementsQuery.error,

    // Mutations
    importMutation,
    autoMatchMutation,
    manualMatchMutation,
    unmatchMutation,
    cierreMutation,

    // Setters
    setSelectedStatementId,
    setFilters,
    setSearchTerm,

    // Selection
    toggleBankItemSelection,
    toggleSystemMovementSelection,
    clearSelections,
    handleManualMatch,

    // Refetch
    refetch: () => {
      statementsQuery.refetch();
      if (selectedStatementId) {
        detailQuery.refetch();
        unmatchedQuery.refetch();
      }
    },
  };
}
