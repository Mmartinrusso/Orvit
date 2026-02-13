'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, TooltipProps } from 'recharts';
import { Card } from '@/components/ui/card';

interface ProductMarginChartProps {
  data: Array<{
    date: string;
    margin: number;
    salePrice: number;
    cost: number;
  }>;
  marginMin?: number | null;
  marginMax?: number;
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <Card className="p-3 shadow-lg border">
      <p className="text-xs font-medium text-muted-foreground mb-1">{data.date}</p>
      <p className="text-sm font-semibold text-green-600">{Number(data.margin).toFixed(1)}%</p>
      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
        <p>Precio: ${Number(data.salePrice).toLocaleString('es-AR')}</p>
        <p>Costo: ${Number(data.cost).toLocaleString('es-AR')}</p>
      </div>
    </Card>
  );
}

export function ProductMarginChart({ data, marginMin, marginMax = 100 }: ProductMarginChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
        Sin datos de margen para mostrar
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          stroke="#9ca3af"
        />
        <YAxis
          tick={{ fontSize: 11 }}
          stroke="#9ca3af"
          domain={[0, 'auto']}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip content={<CustomTooltip />} />

        {/* Reference Lines */}
        {marginMin !== null && marginMin !== undefined && (
          <ReferenceLine
            y={marginMin}
            stroke="#ef4444"
            strokeDasharray="3 3"
            label={{
              value: `Mín: ${marginMin}%`,
              position: 'left',
              fontSize: 10,
              fill: '#ef4444',
            }}
          />
        )}

        <Line
          type="monotone"
          dataKey="margin"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ fill: '#10b981', r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
