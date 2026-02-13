import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ========================================
// TYPES
// ========================================

export type Period = 'mes' | 'trimestre' | 'semestre' | 'año';
export type RiskLevel = 'ALTO' | 'MEDIO' | 'BAJO' | 'NINGUNO';
export type Segment = 'A' | 'B' | 'C';

export interface ClientAnalytics {
  client: {
    id: string;
    legalName: string;
    name: string | null;
    email: string;
    creditLimit: number | null;
    currentBalance: number;
    isBlocked: boolean;
  };
  period: {
    from: Date;
    to: Date;
    days: number;
  };
  salesMetrics: {
    totalRevenue: number;
    invoiceCount: number;
    orderCount: number;
    averageTicket: number;
    trend: 'up' | 'down' | 'stable';
    growthRate: number;
  };
  paymentMetrics: {
    dso: number;
    punctualityRate: number;
    totalPaid: number;
    pendingAmount: number;
    overdueAmount: number;
  };
  creditMetrics: {
    utilizationRate: number;
    availableCredit: number;
    nearLimit: boolean;
    exceeded: boolean;
  };
  topProducts: Array<{
    productId: string;
    productName: string;
    productCode: string;
    quantityBought: number;
    totalAmount: number;
    orderCount: number;
  }>;
  trends: {
    salesByMonth: Array<{ month: string; amount: number; invoiceCount: number }>;
    balanceHistory: Array<{ date: string; balance: number }>;
  };
  alerts: {
    nearCreditLimit: boolean;
    exceededCreditLimit: boolean;
    hasOverdueInvoices: boolean;
    slowPayer: boolean;
    noRecentActivity: boolean;
  };
  score: number;
}

export interface ClientScore {
  clientId: string;
  score: number;
  category: 'EXCELENTE' | 'BUENO' | 'REGULAR' | 'RIESGO';
  breakdown: {
    punctuality: number;
    volume: number;
    seniority: number;
    consistency: number;
    profitability: number;
  };
  badges: string[];
}

export interface ClientNote {
  id: string;
  clientId: string;
  companyId: number;
  userId: number;
  tipo: string;
  asunto: string;
  contenido: string;
  importante: boolean;
  fechaNota: string;
  recordatorio: string | null;
  completado: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

// ========================================
// ANALYTICS HOOK
// ========================================

export function useClientAnalytics(
  clientId: string,
  period: Period = 'mes',
  includeComparison = false
) {
  return useQuery({
    queryKey: ['client-analytics', clientId, period, includeComparison],
    queryFn: async () => {
      const params = new URLSearchParams({
        period,
        includeComparison: includeComparison.toString(),
      });
      const res = await fetch(`/api/ventas/clientes/${clientId}/analytics?${params}`);
      if (!res.ok) throw new Error('Failed to fetch client analytics');
      return res.json() as Promise<ClientAnalytics>;
    },
    staleTime: 60 * 1000, // 1 min
    cacheTime: 5 * 60 * 1000, // 5 min
    retry: 1,
    enabled: !!clientId,
  });
}

// ========================================
// SCORE HOOK
// ========================================

export function useClientScore(clientId: string) {
  return useQuery({
    queryKey: ['client-score', clientId],
    queryFn: async () => {
      const res = await fetch(`/api/ventas/clientes/${clientId}/score`);
      if (!res.ok) throw new Error('Failed to fetch client score');
      return res.json() as Promise<ClientScore>;
    },
    staleTime: 10 * 60 * 1000, // 10 min
    cacheTime: 30 * 60 * 1000, // 30 min
    retry: 1,
    enabled: !!clientId,
  });
}

// ========================================
// ALERTS HOOK
// ========================================

export function useClientAlerts(filters?: {
  tipo?: string;
  prioridad?: string;
  limite?: number;
}) {
  return useQuery({
    queryKey: ['client-alerts', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.tipo) params.set('tipo', filters.tipo);
      if (filters?.prioridad) params.set('prioridad', filters.prioridad);
      if (filters?.limite) params.set('limite', filters.limite.toString());

      const res = await fetch(`/api/ventas/clientes/analytics/alertas?${params}`);
      if (!res.ok) throw new Error('Failed to fetch client alerts');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min
    cacheTime: 10 * 60 * 1000, // 10 min
    retry: 1,
  });
}

// ========================================
// RANKING HOOK
// ========================================

export function useClientRanking(filters?: {
  fechaDesde?: string;
  fechaHasta?: string;
  ordenarPor?: string;
  sellerId?: number;
  limite?: number;
  segmento?: Segment;
}) {
  return useQuery({
    queryKey: ['client-ranking', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.fechaDesde) params.set('fechaDesde', filters.fechaDesde);
      if (filters?.fechaHasta) params.set('fechaHasta', filters.fechaHasta);
      if (filters?.ordenarPor) params.set('ordenarPor', filters.ordenarPor);
      if (filters?.sellerId) params.set('sellerId', filters.sellerId.toString());
      if (filters?.limite) params.set('limite', filters.limite.toString());
      if (filters?.segmento) params.set('segmento', filters.segmento);

      const res = await fetch(`/api/ventas/clientes/analytics/ranking?${params}`);
      if (!res.ok) throw new Error('Failed to fetch client ranking');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min
    cacheTime: 10 * 60 * 1000, // 10 min
    retry: 1,
  });
}

// ========================================
// AGING HOOK
// ========================================

export function useClientAging(filters?: {
  sellerId?: number;
  includeClients?: boolean;
}) {
  return useQuery({
    queryKey: ['client-aging', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.sellerId) params.set('sellerId', filters.sellerId.toString());
      if (filters?.includeClients) params.set('includeClients', 'true');

      const res = await fetch(`/api/ventas/clientes/analytics/aging?${params}`);
      if (!res.ok) throw new Error('Failed to fetch aging report');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min
    cacheTime: 10 * 60 * 1000, // 10 min
    retry: 1,
  });
}

// ========================================
// RISK HOOK
// ========================================

export function useClientRisk(filters?: {
  riskLevel?: RiskLevel;
  limite?: number;
}) {
  return useQuery({
    queryKey: ['client-risk', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.riskLevel) params.set('riskLevel', filters.riskLevel);
      if (filters?.limite) params.set('limite', filters.limite.toString());

      const res = await fetch(`/api/ventas/clientes/analytics/riesgo?${params}`);
      if (!res.ok) throw new Error('Failed to fetch risk analysis');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min
    cacheTime: 10 * 60 * 1000, // 10 min
    retry: 1,
  });
}

// ========================================
// NOTES HOOKS
// ========================================

export function useClientNotes(
  clientId: string,
  filters?: {
    tipo?: string;
    importante?: boolean;
    pendientes?: boolean;
  }
) {
  return useQuery({
    queryKey: ['client-notes', clientId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.tipo) params.set('tipo', filters.tipo);
      if (filters?.importante) params.set('importante', 'true');
      if (filters?.pendientes) params.set('pendientes', 'true');

      const res = await fetch(`/api/ventas/clientes/${clientId}/notas?${params}`);
      if (!res.ok) throw new Error('Failed to fetch client notes');
      return res.json() as Promise<ClientNote[]>;
    },
    staleTime: 2 * 60 * 1000, // 2 min
    cacheTime: 5 * 60 * 1000, // 5 min
    retry: 1,
    enabled: !!clientId,
  });
}

export function useCreateClientNote(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      tipo: string;
      asunto: string;
      contenido: string;
      importante?: boolean;
      fechaNota?: string;
      recordatorio?: string;
    }) => {
      const res = await fetch(`/api/ventas/clientes/${clientId}/notas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create note');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-notes', clientId] });
    },
  });
}

export function useUpdateClientNote(clientId: string, notaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<{
      tipo: string;
      asunto: string;
      contenido: string;
      importante: boolean;
      recordatorio: string | null;
      completado: boolean;
    }>) => {
      const res = await fetch(`/api/ventas/clientes/${clientId}/notas/${notaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update note');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-notes', clientId] });
    },
  });
}

export function useDeleteClientNote(clientId: string, notaId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ventas/clientes/${clientId}/notas/${notaId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete note');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-notes', clientId] });
    },
  });
}
