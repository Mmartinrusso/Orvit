'use client';

import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { useDashboardStore } from './useDashboardStore';
import { ChartData } from './types';
import { formatCurrency, formatPercentage, formatMonth } from './utils/metrics';

interface MainChartProps {
  data: ChartData[];
  comparisonMode: string;
  chartType: string;
}

const categoryColors = {
  ventas: '#10B981',
  costos: '#EF4444',
  sueldos: '#F59E0B',
  produccion: '#3B82F6',
  insumos: '#8B5CF6',
};

export function MainChart({ data, comparisonMode, chartType }: MainChartProps) {
  const { filters } = useDashboardStore();

  // Custom tooltip para mostrar información detallada
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
      
      return (
        <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-lg min-w-[300px]">
          <p className="font-semibold text-gray-900 mb-3 text-center text-lg">
            {formatMonth(label)}
          </p>
          
          <div className="mb-4 p-3 bg-gray-50 text-gray-900 rounded-lg text-center">
            <p className="text-sm font-medium">Total del Mes</p>
            <p className="text-xl font-bold">{formatCurrency(total)}</p>
          </div>
          
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              Desglose por Categoría
            </p>
            {payload.map((entry: any, index: number) => {
              const percentage = ((entry.value / total) * 100).toFixed(1);
              return (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: entry.color }}
                    ></div>
                    <span className="text-sm font-medium text-gray-900">
                      {entry.dataKey}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">
                      {formatCurrency(entry.value)}
                    </p>
                    <p className="text-xs text-gray-600">
                      {percentage}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  // Renderizar según el modo de comparación
  const renderChart = () => {
    const baseChart = (() => {
      switch (comparisonMode) {
        case '2months':
          return render2MonthsChart();
        case 'range-vs-range':
          return renderRangeVsRangeChart();
        case 'multi-mes':
          return renderMultiMonthChart();
        case 'yoy':
          return renderYoYChart();
        case 'index100':
          return renderIndex100Chart();
        default:
          return renderMultiMonthChart();
      }
    })();

    // Aplicar el tipo de gráfico seleccionado
    return applyChartType(baseChart);
  };

  const applyChartType = (baseChart: JSX.Element) => {
    // Por ahora, el tipo de gráfico se maneja en cada función individual
    // En el futuro se puede implementar una transformación más sofisticada
    return baseChart;
  };

  // 2 Meses: Slopegraph + barras apiladas
  const render2MonthsChart = () => {
    if (data.length < 2) return <div>Se necesitan al menos 2 meses de datos</div>;
    
    const lastTwoMonths = data.slice(-2);
    
    return (
      <div className="space-y-6">
        {/* Slopegraph */}
        <div className="h-64">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Comparación por Categoría</h4>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lastTwoMonths}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis 
                dataKey="monthFormatted" 
                stroke="#6B7280"
                fontSize={12}
              />
              <YAxis 
                stroke="#6B7280"
                fontSize={12}
                tickFormatter={(value) => formatCurrency(value)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="ventas" 
                stroke={categoryColors.ventas} 
                strokeWidth={3}
                dot={{ r: 6 }}
              />
              <Line 
                type="monotone" 
                dataKey="costos" 
                stroke={categoryColors.costos} 
                strokeWidth={3}
                dot={{ r: 6 }}
              />
              <Line 
                type="monotone" 
                dataKey="sueldos" 
                stroke={categoryColors.sueldos} 
                strokeWidth={3}
                dot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Barras apiladas del total */}
        <div className="h-64">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Total por Mes</h4>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={lastTwoMonths}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="monthFormatted" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="ventas" stackId="total" fill={categoryColors.ventas} />
              <Bar dataKey="costos" stackId="total" fill={categoryColors.costos} />
              <Bar dataKey="sueldos" stackId="total" fill={categoryColors.sueldos} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Rango vs Rango: Barras side-by-side + Waterfall
  const renderRangeVsRangeChart = () => {
    // Simular datos de dos rangos
    const rangeA = data.slice(0, Math.ceil(data.length / 2));
    const rangeB = data.slice(Math.ceil(data.length / 2));
    
    const rangeAData = {
      name: 'Rango A',
      ventas: rangeA.reduce((sum, d) => sum + d.ventas, 0),
      costos: rangeA.reduce((sum, d) => sum + d.costos, 0),
      sueldos: rangeA.reduce((sum, d) => sum + d.sueldos, 0),
    };
    
    const rangeBData = {
      name: 'Rango B',
      ventas: rangeB.reduce((sum, d) => sum + d.ventas, 0),
      costos: rangeB.reduce((sum, d) => sum + d.costos, 0),
      sueldos: rangeB.reduce((sum, d) => sum + d.sueldos, 0),
    };

    return (
      <div className="space-y-6">
        {/* Barras side-by-side */}
        <div className="h-64">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Comparación de Rangos</h4>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[rangeAData, rangeBData]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="ventas" fill={categoryColors.ventas} />
              <Bar dataKey="costos" fill={categoryColors.costos} />
              <Bar dataKey="sueldos" fill={categoryColors.sueldos} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Waterfall de variación */}
        <div className="h-64">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Waterfall de Variación</h4>
          <div className="space-y-2">
            {Object.entries(rangeAData).map(([key, value], index) => {
              if (key === 'name') return null;
              const rangeBValue = rangeBData[key as keyof typeof rangeBData] as number;
              const delta = rangeBValue - value;
              const deltaPct = value > 0 ? (delta / value) * 100 : 0;
              
              return (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-900 capitalize">{key}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">{formatCurrency(value)}</span>
                    <span className="text-sm text-gray-600">→</span>
                    <span className="text-sm text-gray-900">{formatCurrency(rangeBValue)}</span>
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${
                        delta >= 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                      }`}
                    >
                      {delta >= 0 ? '+' : ''}{formatCurrency(delta)} ({formatPercentage(deltaPct)})
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Multi-mes: Barras con chips Δ y %Δ + línea de media móvil
  const renderMultiMonthChart = () => {
    return (
      <div className="space-y-6">
        {/* Gráfico principal */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis 
                dataKey="monthFormatted" 
                stroke="#6B7280"
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="#6B7280"
                fontSize={12}
                tickFormatter={(value) => formatCurrency(value)}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Barras */}
              <Bar dataKey="ventas" fill={categoryColors.ventas} />
              <Bar dataKey="costos" fill={categoryColors.costos} />
              <Bar dataKey="sueldos" fill={categoryColors.sueldos} />
              
              {/* Línea de media móvil */}
              <Line 
                type="monotone" 
                dataKey="movingAvg3" 
                stroke="#F59E0B" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Chips de variación por mes */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {data.map((point, index) => (
            <div key={point.month} className="text-center">
              <div className="text-xs text-gray-600 mb-1">{point.monthFormatted}</div>
              {point.delta !== undefined && point.deltaPct !== undefined && (
                <Badge 
                  variant="secondary" 
                  className={`text-xs ${
                    point.deltaPct >= 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {point.delta >= 0 ? '+' : ''}{formatCurrency(point.delta)}
                  <br />
                  {formatPercentage(point.deltaPct)}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // YoY: Barras del mes actual vs mismo mes hace 12m
  const renderYoYChart = () => {
    if (data.length < 12) return <div>Se necesitan al menos 12 meses de datos para YoY</div>;
    
    const currentMonth = data[data.length - 1];
    const sameMonthLastYear = data[data.length - 13];
    
    const yoyData = [
      {
        name: 'Hace 12 meses',
        ventas: sameMonthLastYear.ventas,
        costos: sameMonthLastYear.costos,
        sueldos: sameMonthLastYear.sueldos,
      },
      {
        name: 'Mes actual',
        ventas: currentMonth.ventas,
        costos: currentMonth.costos,
        sueldos: currentMonth.sueldos,
      }
    ];

    return (
      <div className="space-y-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yoyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="ventas" fill={categoryColors.ventas} />
              <Bar dataKey="costos" fill={categoryColors.costos} />
              <Bar dataKey="sueldos" fill={categoryColors.sueldos} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Métricas YoY */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['ventas', 'costos', 'sueldos'].map((category) => {
            const current = currentMonth[category as keyof ChartData] as number;
            const previous = sameMonthLastYear[category as keyof ChartData] as number;
            const delta = current - previous;
            const deltaPct = previous > 0 ? (delta / previous) * 100 : 0;
            
            return (
              <div key={category} className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2 capitalize">{category}</h4>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {formatCurrency(current)}
                </div>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${
                      deltaPct >= 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
                  </Badge>
                  <span className={`text-sm ${
                    deltaPct >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatPercentage(deltaPct)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Índice 100: Línea indexada con base en mes seleccionado
  const renderIndex100Chart = () => {
    const baseMonth = data[0]; // Usar el primer mes como base
    
    const indexedData = data.map(point => ({
      ...point,
      ventasIndex: (point.ventas / baseMonth.ventas) * 100,
      costosIndex: (point.costos / baseMonth.costos) * 100,
      sueldosIndex: (point.sueldos / baseMonth.sueldos) * 100,
    }));

    return (
      <div className="space-y-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={indexedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis 
                dataKey="monthFormatted" 
                stroke="#6B7280"
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="#6B7280"
                fontSize={12}
                tickFormatter={(value) => `${value.toFixed(0)}`}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white border border-gray-300 rounded-lg p-3 shadow-lg">
                        <p className="font-semibold text-gray-900 mb-2">{formatMonth(label)}</p>
                        {payload.map((entry: any, index: number) => (
                          <div key={index} className="flex items-center justify-between">
                            <span className="text-sm text-gray-900">{entry.dataKey}</span>
                            <span className="text-sm font-bold text-gray-900">
                              {entry.value.toFixed(1)} (base 100)
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={100} stroke="#6B7280" strokeDasharray="2 2" />
              <Line 
                type="monotone" 
                dataKey="ventasIndex" 
                stroke={categoryColors.ventas} 
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="costosIndex" 
                stroke={categoryColors.costos} 
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="sueldosIndex" 
                stroke={categoryColors.sueldos} 
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Información del índice */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Información del Índice</h4>
          <p className="text-xs text-gray-600">
            Base 100 = {formatMonth(baseMonth.month)}. Valores superiores a 100 indican crecimiento, 
            valores inferiores a 100 indican decrecimiento.
          </p>
        </div>
      </div>
    );
  };

  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center bg-gray-50 rounded-xl">
        <div className="text-center">
          <p className="text-gray-600">No hay datos disponibles</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {renderChart()}
    </div>
  );
}
