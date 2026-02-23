'use client';

import { formatNumber } from '@/lib/utils';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ListTree } from 'lucide-react';

interface CostBreakdownData {
  concepto: string;
  monto: number;
}

interface QuoteCostCompositionProps {
  items: Array<{
    cantidad: number;
    costBreakdown?: Array<{
      concepto: string;
      monto: number;
    }>;
  }>;
  moneda?: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444', '#ec4899', '#14b8a6'];

function formatCurrency(amount: number, currency: string = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function QuoteCostComposition({ items, moneda = 'ARS' }: QuoteCostCompositionProps) {
  const compositionData = useMemo(() => {
    const conceptoTotals = new Map<string, number>();

    for (const item of items) {
      if (!item.costBreakdown || item.costBreakdown.length === 0) continue;
      const cantidad = Number(item.cantidad);
      for (const cb of item.costBreakdown) {
        const key = cb.concepto;
        const current = conceptoTotals.get(key) || 0;
        conceptoTotals.set(key, current + Number(cb.monto) * cantidad);
      }
    }

    const entries = Array.from(conceptoTotals.entries())
      .map(([concepto, total]) => ({ concepto, total }))
      .sort((a, b) => b.total - a.total);

    const grandTotal = entries.reduce((sum, e) => sum + e.total, 0);

    return entries.map(entry => ({
      ...entry,
      porcentaje: grandTotal > 0 ? (entry.total / grandTotal) * 100 : 0,
    }));
  }, [items]);

  // No mostrar si no hay items con desglose
  if (compositionData.length === 0) return null;

  const grandTotal = compositionData.reduce((sum, d) => sum + d.total, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-popover border rounded-lg shadow-lg p-2.5 text-sm">
        <p className="font-medium">{data.concepto}</p>
        <p className="text-muted-foreground">
          {formatCurrency(data.total, moneda)} ({formatNumber(data.porcentaje, 1)}%)
        </p>
      </div>
    );
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ListTree className="h-4 w-4" />
          Composición de costos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6">
          <div className="flex-1 h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={compositionData}
                layout="vertical"
                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="concepto"
                  width={80}
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={16}>
                  {compositionData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="w-48 space-y-1.5">
            {compositionData.map((item, idx) => (
              <div key={item.concepto} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <span className="text-muted-foreground truncate max-w-[80px]">{item.concepto}</span>
                </div>
                <span className="font-medium tabular-nums text-xs">
                  {formatCurrency(item.total, moneda)}
                </span>
              </div>
            ))}
            <div className="pt-1 border-t">
              <div className="flex justify-between text-sm font-medium">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(grandTotal, moneda)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
