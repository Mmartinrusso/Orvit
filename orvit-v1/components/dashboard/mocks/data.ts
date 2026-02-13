import { TimePoint, CategoryCard, Mover, Movement, KpiData, ChartData, Insight } from '../types';

// Generar datos de 12 meses con tendencias realistas
const generateTimeSeries = (): TimePoint[] => {
  const months = [
    '2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06',
    '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12'
  ];
  
  const baseValues = {
    ventas: 15000000,
    costos: 8000000,
    sueldos: 3000000,
    produccion: 2000000,
    insumos: 1000000,
  };

  return months.map((month, index) => {
    // Simular crecimiento estacional y tendencias
    const seasonalFactor = 1 + 0.1 * Math.sin((index / 12) * 2 * Math.PI);
    const trendFactor = 1 + (index * 0.02); // Crecimiento del 2% mensual
    const randomFactor = 0.9 + Math.random() * 0.2; // Variación aleatoria ±10%

    const multiplier = seasonalFactor * trendFactor * randomFactor;

    return {
      month,
      value: Math.round(baseValues.ventas * multiplier),
      ventas: Math.round(baseValues.ventas * multiplier),
      costos: Math.round(baseValues.costos * multiplier * 0.95), // Costos crecen menos
      sueldos: Math.round(baseValues.sueldos * multiplier * 1.05), // Sueldos crecen más
      produccion: Math.round(baseValues.produccion * multiplier),
      insumos: Math.round(baseValues.insumos * multiplier * 0.9), // Insumos más estables
    };
  });
};

export const mockTimeSeries = generateTimeSeries();

// Procesar datos con métricas
export const processedTimeSeries = mockTimeSeries.map((point, index) => {
  const prev = index > 0 ? mockTimeSeries[index - 1].ventas : point.ventas;
  const yoy = index >= 12 ? mockTimeSeries[index - 12].ventas : undefined;
  
  const delta = point.ventas - prev;
  const deltaPct = prev > 0 ? ((point.ventas - prev) / prev) * 100 : 0;
  const yoyPct = yoy !== undefined ? ((point.ventas - yoy) / yoy) * 100 : undefined;
  
  return {
    ...point,
    prev,
    yoy,
    delta,
    deltaPct,
    yoyPct,
  };
});

// Datos de categorías
export const mockCategories: CategoryCard[] = [
  {
    name: 'Ventas',
    total: 180000000,
    avg: 15000000,
    change: 2500000,
    changePct: 1.4,
    performance: 'positivo',
    sharePct: 45.2,
    shareDeltaPct: 2.1,
    spark: processedTimeSeries.map(p => ({ month: p.month, value: p.ventas })),
  },
  {
    name: 'Costos Directos',
    total: 95000000,
    avg: 7916667,
    change: -500000,
    changePct: -0.5,
    performance: 'positivo',
    sharePct: 23.8,
    shareDeltaPct: -1.2,
    spark: processedTimeSeries.map(p => ({ month: p.month, value: p.costos })),
  },
  {
    name: 'Sueldos',
    total: 42000000,
    avg: 3500000,
    change: 800000,
    changePct: 1.9,
    performance: 'negativo',
    sharePct: 10.5,
    shareDeltaPct: 0.8,
    spark: processedTimeSeries.map(p => ({ month: p.month, value: p.sueldos })),
  },
  {
    name: 'Producción',
    total: 25000000,
    avg: 2083333,
    change: 300000,
    changePct: 1.2,
    performance: 'positivo',
    sharePct: 6.3,
    shareDeltaPct: 0.3,
    spark: processedTimeSeries.map(p => ({ month: p.month, value: p.produccion })),
  },
  {
    name: 'Insumos',
    total: 12000000,
    avg: 1000000,
    change: -200000,
    changePct: -1.6,
    performance: 'positivo',
    sharePct: 3.0,
    shareDeltaPct: -0.2,
    spark: processedTimeSeries.map(p => ({ month: p.month, value: p.insumos })),
  },
];

// Top movers
export const mockTopMovers: Mover[] = [
  {
    name: 'Bloques de Hormigón',
    delta: 1200000,
    deltaPct: 15.2,
    contributionPct: 32.1,
    type: 'producto',
  },
  {
    name: 'Constructora ABC',
    delta: 800000,
    deltaPct: 12.5,
    contributionPct: 21.4,
    type: 'cliente',
  },
  {
    name: 'Adoquines Premium',
    delta: 600000,
    deltaPct: 8.7,
    contributionPct: 16.0,
    type: 'producto',
  },
  {
    name: 'Proveedor XYZ',
    delta: -300000,
    deltaPct: -5.2,
    contributionPct: -8.0,
    type: 'proveedor',
  },
  {
    name: 'Viguetas Pretensadas',
    delta: 400000,
    deltaPct: 6.8,
    contributionPct: 10.7,
    type: 'producto',
  },
];

// KPIs principales
export const mockKpis: KpiData[] = [
  {
    title: 'Ingresos Totales',
    total: 180000000,
    avg: 15000000,
    delta: 2500000,
    deltaPct: 1.4,
    momPct: 2.1,
    yoyPct: 18.5,
    spark: processedTimeSeries.map(p => ({ month: p.month, value: p.ventas })),
    trend: 'up',
  },
  {
    title: 'Costos Totales',
    total: 95000000,
    avg: 7916667,
    delta: -500000,
    deltaPct: -0.5,
    momPct: -1.2,
    yoyPct: 8.3,
    spark: processedTimeSeries.map(p => ({ month: p.month, value: p.costos })),
    trend: 'down',
  },
  {
    title: 'Margen Bruto',
    total: 85000000,
    avg: 7083333,
    delta: 3000000,
    deltaPct: 3.7,
    momPct: 4.2,
    yoyPct: 25.8,
    spark: processedTimeSeries.map(p => ({ month: p.month, value: p.ventas - p.costos })),
    trend: 'up',
  },
  {
    title: 'Margen Neto',
    total: 40000000,
    avg: 3333333,
    delta: 1500000,
    deltaPct: 3.9,
    momPct: 2.8,
    yoyPct: 22.1,
    spark: processedTimeSeries.map(p => ({ 
      month: p.month, 
      value: p.ventas - p.costos - p.sueldos - p.produccion - p.insumos 
    })),
    trend: 'up',
  },
  {
    title: 'Ticket Promedio',
    total: 125000,
    avg: 125000,
    delta: 5000,
    deltaPct: 4.2,
    momPct: 1.8,
    yoyPct: 12.3,
    spark: processedTimeSeries.map(p => ({ month: p.month, value: 125000 + Math.random() * 10000 })),
    trend: 'up',
  },
  {
    title: '# Pedidos',
    total: 1440,
    avg: 120,
    delta: 45,
    deltaPct: 3.2,
    momPct: 2.5,
    yoyPct: 15.7,
    spark: processedTimeSeries.map(p => ({ month: p.month, value: 120 + Math.random() * 20 })),
    trend: 'up',
  },
];

// Datos de gráfico
export const mockChartData: ChartData[] = processedTimeSeries.map((point, index) => ({
  month: point.month,
  monthFormatted: new Date(point.month + '-01').toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
  ventas: point.ventas,
  costos: point.costos,
  sueldos: point.sueldos,
  produccion: point.produccion,
  insumos: point.insumos,
  delta: point.delta,
  deltaPct: point.deltaPct,
  yoyPct: point.yoyPct,
  movingAvg3: index >= 2 ? 
    (point.ventas + processedTimeSeries[index - 1].ventas + processedTimeSeries[index - 2].ventas) / 3 : 
    undefined,
}));

// Movimientos de ejemplo
export const mockMovements: Movement[] = [
  {
    id: '1',
    date: '2024-12-15',
    entity: 'Constructora ABC',
    category: 'Ventas',
    product: 'Bloques de Hormigón',
    qty: 1000,
    price: 1200,
    total: 1200000,
    source: 'factura',
  },
  {
    id: '2',
    date: '2024-12-14',
    entity: 'Proveedor XYZ',
    category: 'Costos',
    product: 'Cemento',
    qty: 50,
    price: 8000,
    total: 400000,
    source: 'factura',
  },
  {
    id: '3',
    date: '2024-12-13',
    entity: 'Empleado Juan',
    category: 'Sueldos',
    total: 150000,
    source: 'manual',
  },
];

// Insights automáticos
export const mockInsights: Insight[] = [
  {
    type: 'positive',
    title: 'Crecimiento Sostenido',
    description: '↑ $2.5M vs mes anterior por Ventas Bloques (+$1.2M, +15%) y Ventas Adoquines (+$0.6M, +9%); cae Costos Indirectos (-$0.3M, -5%). Top cliente: Constructora ABC (+$0.8M).',
    actions: [
      { label: 'Crear tarea', onClick: () => console.log('Crear tarea') },
      { label: 'Ver facturas', onClick: () => console.log('Ver facturas') },
    ],
  },
  {
    type: 'warning',
    title: 'Atención: DSO en Aumento',
    description: 'DSO aumentó 7 días en el último mes. Revisar cobranzas pendientes de clientes principales.',
    actions: [
      { label: 'Revisar cobranzas', onClick: () => console.log('Revisar cobranzas') },
    ],
  },
];
