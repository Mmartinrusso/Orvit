// Serie temporal mensual
export interface TimePoint {
  month: string; // '2025-08'
  value: number;
  prev?: number;
  yoy?: number;
  movingAvg3?: number;
  delta?: number;
  deltaPct?: number;
}

// Resumen rango
export interface RangeSummary {
  start: string;
  end: string;
  initial: number;
  final: number;
  delta: number;
  deltaPct: number;
  volatility: number;
  cagr?: number;
}

// Top movers
export interface Mover {
  name: string;
  delta: number;
  deltaPct: number;
  contributionPct: number;
  type: 'producto' | 'cliente' | 'proveedor' | 'categoria';
}

// Categoría
export interface CategoryCard {
  name: string;
  total: number;
  avg: number;
  change: number;
  changePct: number;
  performance: 'positivo' | 'negativo' | 'neutral';
  sharePct: number;
  shareDeltaPct: number;
  spark: TimePoint[];
}

// Movimiento (tabla)
export interface Movement {
  id: string;
  date: string;
  entity: string;
  category: string;
  product?: string;
  qty?: number;
  price?: number;
  total: number;
  source: 'factura' | 'lista' | 'manual';
}

// KPI Card data
export interface KpiData {
  title: string;
  total: number;
  avg: number;
  delta: number;
  deltaPct: number;
  momPct?: number;
  yoyPct?: number;
  spark: TimePoint[];
  trend: 'up' | 'down' | 'stable';
}

// Insight data
export interface Insight {
  type: 'positive' | 'negative' | 'warning';
  title: string;
  description: string;
  actions: {
    label: string;
    onClick: () => void;
  }[];
}

// Chart data
export interface ChartData {
  month: string;
  monthFormatted: string;
  ventas: number;
  costos: number;
  sueldos: number;
  produccion: number;
  insumos: number;
  delta?: number;
  deltaPct?: number;
  yoyPct?: number;
  movingAvg3?: number;
}

// Waterfall data
export interface WaterfallData {
  category: string;
  value: number;
  delta: number;
  deltaPct: number;
  color: string;
}
