'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface QuoteTotalsProps {
  totals: {
    subtotal: number;
    tax: number;
    totalDiscount: number;
    total: number;
  };
}

export function QuoteTotals({ totals }: QuoteTotalsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Totales</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{formatCurrency(totals.subtotal)}</span>
          </div>
          
          {totals.totalDiscount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Descuento:</span>
              <span>-{formatCurrency(totals.totalDiscount)}</span>
            </div>
          )}
          
          {totals.tax > 0 && (
            <div className="flex justify-between">
              <span>IVA (21%):</span>
              <span>{formatCurrency(totals.tax)}</span>
            </div>
          )}
          
          {totals.tax === 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Incluye 10.5% no discriminado</span>
              <span>✓</span>
            </div>
          )}
          
          <Separator />
          
          <div className="flex justify-between text-lg font-semibold">
            <span>Total:</span>
            <span>{formatCurrency(totals.total)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 