'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipProps } from 'recharts';
import { Card } from '@/components/ui/card';

interface ProductSalesChartProps {
  data: Array<{
    month: string;
    quantity: number;
    amount: number;
  }>;
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <Card className="p-3 shadow-lg border">
      <p className="text-xs font-medium text-muted-foreground mb-1">{data.month}</p>
      <p className="text-sm font-semibold">
        ${Number(data.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
      </p>
      <p className="text-xs text-muted-foreground">
        {Number(data.quantity).toLocaleString('es-AR', { maximumFractionDigits: 2 })} unidades
      </p>
    </Card>
  );
}

export function ProductSalesChart({ data }: ProductSalesChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
        Sin datos de ventas para mostrar
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
        <defs>
          <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11 }}
          stroke="#9ca3af"
        />
        <YAxis
          tick={{ fontSize: 11 }}
          stroke="#9ca3af"
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#colorAmount)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
