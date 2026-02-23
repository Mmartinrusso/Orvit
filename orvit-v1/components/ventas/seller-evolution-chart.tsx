'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface EvolucionMensual {
  mes: string;
  mesLabel: string;
  ventas: number;
  comisiones: number;
}

interface SellerEvolutionChartProps {
  data: EvolucionMensual[];
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;

  return (
    <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-1">{d.mesLabel}</p>
      <p className="text-blue-600">Ventas: {formatCurrency(d.ventas)}</p>
      <p className="text-success-muted-foreground">Comisiones: {formatCurrency(d.comisiones)}</p>
    </div>
  );
}

export function SellerEvolutionChart({ data }: SellerEvolutionChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Evolución Mensual
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorComisiones" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="mesLabel" tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="#9ca3af"
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="ventas"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#colorVentas)"
              name="Ventas"
            />
            <Area
              type="monotone"
              dataKey="comisiones"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#colorComisiones)"
              name="Comisiones"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
