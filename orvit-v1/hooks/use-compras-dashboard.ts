import { useQuery } from '@tanstack/react-query';
import { useViewMode } from '@/contexts/ViewModeContext';

export interface DashboardBasico {
  ordenesPendientes: number;
  proveedoresActivos: number;
  stockBajo: number;
  solicitudesPendientes: number;
}

export interface DashboardAdmin {
  comprasMes: number;
  comprasMesAnterior: number;
  variacionMensual: number;
  deudaTotal: number;
  facturasVencidas: number;
  aprobacionesPendientes: number;
  comprasPorMes: Array<{ mes: string; total: number }>;
  topProveedores: Array<{ id: number; nombre: string; total: number }>;
  // Datos detallados
  ordenesPorEstado: Array<{ estado: string; cantidad: number }>;
  recepcionesMes: { cantidad: number; total: number };
  comprasPorCategoria: Array<{ categoria: string; total: number }>;
  ordenesProximasVencer: Array<{ id: number; numero: string; proveedor: string; fechaRequerida: string; diasRestantes: number }>;
  topProductos: Array<{ id: number; nombre: string; cantidad: number; total: number }>;
  flujoPagos: { proximos7: number; proximos15: number; proximos30: number };
  // Extra stats
  promedioMensual: number;
  totalAnual: number;
  devolucionesPendientes: number;
}

export interface DashboardData {
  basico: DashboardBasico;
  admin: DashboardAdmin | null;
  timestamp: string;
}

async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch(`/api/compras/dashboard?_t=${Date.now()}`);
  if (!res.ok) {
    throw new Error('Error cargando dashboard');
  }
  return res.json();
}

export function useComprasDashboard() {
  // Incluir viewMode en el queryKey para refetch automático cuando cambie el modo
  const { mode: viewMode } = useViewMode();

  return useQuery<DashboardData>({
    queryKey: ['compras', 'dashboard', viewMode],
    queryFn: fetchDashboard,
    staleTime: 60 * 1000, // 1 minuto
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000, // Refrescar cada 5 minutos
  });
}

// Hook helper para saber si es admin basado en si hay datos admin
export function useIsComprasAdmin(data: DashboardData | undefined) {
  return data?.admin !== null && data?.admin !== undefined;
}
