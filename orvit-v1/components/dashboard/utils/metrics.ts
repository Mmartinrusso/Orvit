import { TimePoint, RangeSummary } from '../types';

// MoM % = (M[t] - M[t-1]) / M[t-1]
export const calculateMoM = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

// YoY % = (M[t] - M[t-12]) / M[t-12]
export const calculateYoY = (current: number, previousYear: number): number => {
  if (previousYear === 0) return 0;
  return ((current - previousYear) / previousYear) * 100;
};

// Media móvil 3m = promedio centrado de los últimos 3 valores
export const calculateMovingAverage = (data: number[], index: number, window: number = 3): number => {
  const start = Math.max(0, index - Math.floor(window / 2));
  const end = Math.min(data.length, start + window);
  const slice = data.slice(start, end);
  return slice.reduce((sum, val) => sum + val, 0) / slice.length;
};

// Índice 100 = M[t] / M[base] * 100
export const calculateIndex100 = (current: number, base: number): number => {
  if (base === 0) return 100;
  return (current / base) * 100;
};

// Contribución al cambio = Δ categoría / Δ total
export const calculateContribution = (categoryDelta: number, totalDelta: number): number => {
  if (totalDelta === 0) return 0;
  return (categoryDelta / totalDelta) * 100;
};

// Volatilidad = desvío estándar de M[t] en el rango
export const calculateVolatility = (values: number[]): number => {
  if (values.length < 2) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
};

// CAGR (si ≥12m) = (final / initial)^(12/n) - 1
export const calculateCAGR = (initial: number, final: number, months: number): number => {
  if (initial === 0 || months < 12) return 0;
  return Math.pow(final / initial, 12 / months) - 1;
};

// CCC = DIO + DSO - DPO
export const calculateCCC = (dio: number, dso: number, dpo: number): number => {
  return dio + dso - dpo;
};

// Procesar datos temporales con métricas
export const processTimeSeries = (data: TimePoint[]): TimePoint[] => {
  return data.map((point, index) => {
    const prev = index > 0 ? data[index - 1].value : point.value;
    const yoy = index >= 12 ? data[index - 12].value : undefined;
    
    const delta = point.value - prev;
    const deltaPct = calculateMoM(point.value, prev);
    const yoyPct = yoy !== undefined ? calculateYoY(point.value, yoy) : undefined;
    
    const values = data.slice(0, index + 1).map(d => d.value);
    const movingAvg3 = calculateMovingAverage(values, index);
    
    return {
      ...point,
      prev,
      yoy,
      delta,
      deltaPct,
      yoyPct,
      movingAvg3,
    };
  });
};

// Calcular resumen de rango
export const calculateRangeSummary = (data: TimePoint[]): RangeSummary => {
  if (data.length === 0) {
    return {
      start: '',
      end: '',
      initial: 0,
      final: 0,
      delta: 0,
      deltaPct: 0,
      volatility: 0,
    };
  }

  const initial = data[0].value;
  const final = data[data.length - 1].value;
  const delta = final - initial;
  const deltaPct = calculateMoM(final, initial);
  const volatility = calculateVolatility(data.map(d => d.value));
  const cagr = data.length >= 12 ? calculateCAGR(initial, final, data.length) : undefined;

  return {
    start: data[0].month,
    end: data[data.length - 1].month,
    initial,
    final,
    delta,
    deltaPct,
    volatility,
    cagr,
  };
};

// Formatear moneda
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Formatear moneda con decimales
export const formatCurrencyWithDecimals = (amount: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
};

// Formatear número con locale argentino (punto para miles, coma para decimales)
export const formatNumber = (num: number, decimals: number = 0): string => {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

// Formatear porcentaje
export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
};

// Formatear mes
export const formatMonth = (month: string): string => {
  if (!month) return '';
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1);
  return date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
};

// Obtener color según tendencia
export const getTrendColor = (value: number): string => {
  if (value > 5) return 'text-green-500';
  if (value > 0) return 'text-yellow-500';
  if (value > -5) return 'text-orange-500';
  return 'text-red-500';
};

// Obtener color de fondo según tendencia
export const getTrendBgColor = (value: number): string => {
  if (value > 5) return 'bg-green-500';
  if (value > 0) return 'bg-yellow-500';
  if (value > -5) return 'bg-orange-500';
  return 'bg-red-500';
};
