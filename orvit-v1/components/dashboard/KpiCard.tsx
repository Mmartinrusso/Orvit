'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  DollarSign,
  Target,
  Award,
  ShoppingCart,
  Users,
  Clock
} from 'lucide-react';
import { KpiData } from './types';
import { formatCurrency, formatPercentage, getTrendColor, getTrendBgColor } from './utils/metrics';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

interface KpiCardProps {
  data: KpiData;
  compact?: boolean;
}

const iconMap = {
  'Ingresos Totales': DollarSign,
  'Costos Totales': TrendingDown,
  'Margen Bruto': Target,
  'Margen Neto': Award,
  'Ticket Promedio': ShoppingCart,
  '# Pedidos': Users,
  'DSO': Clock,
  'DPO': Clock,
  'DIO': Clock,
  'CCC': Clock,
};

export function KpiCard({ data, compact = false }: KpiCardProps) {
  const Icon = iconMap[data.title as keyof typeof iconMap] || TrendingUp;
  
  const getTrendIcon = () => {
    if (data.trend === 'up') return <TrendingUp className="h-4 w-4" />;
    if (data.trend === 'down') return <TrendingDown className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  const getTrendColorClass = () => {
    if (data.trend === 'up') return 'text-green-500';
    if (data.trend === 'down') return 'text-red-500';
    return 'text-gray-500';
  };

  const getTrendBgClass = () => {
    if (data.trend === 'up') return 'bg-green-500/10';
    if (data.trend === 'down') return 'bg-red-500/10';
    return 'bg-gray-500/10';
  };

  const sparklineData = data.spark.map(point => ({
    month: point.month,
    value: point.value,
  }));

  return (
    <Card className={`relative overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 ${
      compact ? 'p-3' : 'p-4'
    }`}>
      {/* Fondo con gradiente sutil */}
      <div className={`absolute inset-0 ${getTrendBgClass()} opacity-5`}></div>
      
      <CardContent className={`relative ${compact ? 'p-0' : 'p-0'}`}>
        <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-3'}`}>
          <div className={`flex items-center gap-2 ${compact ? 'gap-1' : 'gap-2'}`}>
            <div className={`p-2 rounded-xl ${getTrendBgClass()} ${compact ? 'p-1' : 'p-2'}`}>
              <Icon className={`${getTrendColorClass()} ${compact ? 'h-4 w-4' : 'h-5 w-5'}`} />
            </div>
            <h3 className={`font-semibold text-gray-900 ${compact ? 'text-sm' : 'text-base'}`}>
              {data.title}
            </h3>
          </div>
          
          <div className="flex items-center gap-1">
            {data.momPct !== undefined && (
              <Badge 
                variant="secondary" 
                className={`text-xs ${compact ? 'px-1 py-0' : 'px-2 py-1'} bg-blue-50 text-blue-700 border-blue-200`}
              >
                MoM {formatPercentage(data.momPct, 1)}
              </Badge>
            )}
            {data.yoyPct !== undefined && (
              <Badge 
                variant="secondary" 
                className={`text-xs ${compact ? 'px-1 py-0' : 'px-2 py-1'} bg-green-50 text-green-700 border-green-200`}
              >
                YoY {formatPercentage(data.yoyPct, 1)}
              </Badge>
            )}
          </div>
        </div>

        {/* Valor principal */}
        <div className={`${compact ? 'mb-2' : 'mb-3'}`}>
          <p className={`font-bold text-gray-900 ${compact ? 'text-xl' : 'text-2xl'}`}>
            {formatCurrency(data.total)}
          </p>
          <p className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>
            Promedio: {formatCurrency(data.avg)}
          </p>
        </div>

        {/* Cambio del período */}
        <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-3'}`}>
          <div className="flex items-center gap-2">
            {getTrendIcon()}
            <span className={`text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>
              {data.delta >= 0 ? '+' : ''}{formatCurrency(data.delta)}
            </span>
            <span className={`${getTrendColor(data.deltaPct)} ${compact ? 'text-xs' : 'text-sm'}`}>
              {formatPercentage(data.deltaPct, 1)}
            </span>
          </div>
        </div>

        {/* Sparkline */}
        <div className={`${compact ? 'h-8' : 'h-12'} w-full`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparklineData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={data.trend === 'up' ? '#10B981' : data.trend === 'down' ? '#EF4444' : '#6B7280'}
                strokeWidth={compact ? 1.5 : 2}
                dot={false}
                activeDot={{
                  r: compact ? 2 : 3,
                  fill: data.trend === 'up' ? '#10B981' : data.trend === 'down' ? '#EF4444' : '#6B7280',
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white border border-gray-300 rounded-lg p-2 text-xs text-gray-900 shadow-lg">
                        <p>Valor: {formatCurrency(data.value)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Indicador de tendencia */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${getTrendBgClass().replace('/10', '')}`}></div>
            <span className={`text-xs text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>
              {data.trend === 'up' ? 'Crecimiento' : data.trend === 'down' ? 'Descenso' : 'Estable'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
