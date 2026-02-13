import { useQuery } from '@tanstack/react-query';

export interface ProductAnalyticsData {
  product: {
    id: string;
    name: string;
    code: string | null;
    costPrice: number;
    salePrice: number;
    currentStock: number;
    minStock: number;
    category: {
      id: number;
      name: string;
    } | null;
  };
  period: {
    from: Date;
    to: Date;
    days: number;
  };
  salesMetrics: {
    totalQuantitySold: number;
    totalRevenue: number;
    orderCount: number;
    uniqueCustomers: number;
    averageOrderQty: number;
    lastSaleDate: Date | null;
    trend: 'up' | 'down' | 'stable';
  };
  marginMetrics: {
    realMargin: number;
    projectedMargin: number;
    difference: number;
    belowMin: boolean;
  };
  inventoryMetrics: {
    turnoverRate: number;
    daysOfStockLeft: number;
    velocity: 'ALTA' | 'MEDIA' | 'BAJA';
  };
  topClient: {
    clientId: string;
    name: string;
    quantityBought: number;
    totalAmount: number;
    orderCount: number;
  } | null;
  alerts: {
    lowStock: boolean;
    lowMargin: boolean;
    noSalesIn90Days: boolean;
    slowTurnover: boolean;
  };
  trends: {
    salesByMonth: Array<{
      month: string;
      quantity: number;
      amount: number;
    }>;
    marginHistory: Array<{
      date: string;
      margin: number;
      salePrice: number;
      cost: number;
    }>;
  };
}

export function useProductAnalytics(
  productId: string,
  options: {
    period?: string;
    includeComparison?: boolean;
    enabled?: boolean;
  } = {}
) {
  const { period = 'mes', includeComparison = false, enabled = true } = options;

  return useQuery<ProductAnalyticsData>({
    queryKey: ['product-analytics', productId, period, includeComparison],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('period', period);
      if (includeComparison) params.set('includeComparison', 'true');

      const response = await fetch(
        `/api/ventas/productos/${productId}/analytics?${params.toString()}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al obtener analytics');
      }

      return response.json();
    },
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
    retry: 1,
    enabled,
  });
}
