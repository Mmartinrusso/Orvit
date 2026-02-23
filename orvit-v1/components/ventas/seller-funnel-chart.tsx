'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChartIcon } from 'lucide-react';

interface SellerFunnelChartProps {
  estadoDistribucion: Record<string, number>;
}

const ESTADO_COLORS: Record<string, string> = {
  BORRADOR: '#9ca3af',
  ENVIADA: '#3b82f6',
  ACEPTADA: '#10b981',
  RECHAZADA: '#ef4444',
  VENCIDA: '#f59e0b',
  CONVERTIDA: '#8b5cf6',
  ANULADA: '#6b7280',
};

const ESTADO_LABELS: Record<string, string> = {
  BORRADOR: 'Borrador',
  ENVIADA: 'Enviada',
  ACEPTADA: 'Aceptada',
  RECHAZADA: 'Rechazada',
  VENCIDA: 'Vencida',
  CONVERTIDA: 'Convertida',
  ANULADA: 'Anulada',
};

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border rounded-lg shadow-lg p-2.5 text-sm">
      <p className="font-medium">{d.label}</p>
      <p className="text-muted-foreground">{d.value} cotizaciones</p>
    </div>
  );
}

export function SellerFunnelChart({ estadoDistribucion }: SellerFunnelChartProps) {
  const data = Object.entries(estadoDistribucion)
    .filter(([, count]) => count > 0)
    .map(([estado, count]) => ({
      name: estado,
      label: ESTADO_LABELS[estado] || estado,
      value: count,
      color: ESTADO_COLORS[estado] || '#6b7280',
    }))
    .sort((a, b) => b.value - a.value);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <PieChartIcon className="h-4 w-4" />
          Estado de Cotizaciones
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-1.5">
            {data.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-muted-foreground">{item.label}</span>
                </div>
                <span className="font-medium tabular-nums">
                  {item.value}{' '}
                  <span className="text-muted-foreground text-xs">
                    ({total > 0 ? formatNumber((item.value / total) * 100) : 0}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
