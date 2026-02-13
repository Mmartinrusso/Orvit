'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';

interface OrdenDetailTotalesProps {
  orden: any;
}

export function OrdenDetailTotales({ orden }: OrdenDetailTotalesProps) {
  const formatMoney = (amount: number | string) => {
    return `${orden.moneda} ${Number(amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };

  const subtotalSinDescuento = Number(orden.subtotal) + Number(orden.descuentoMonto || 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Resumen Financiero
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Subtotal */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal (sin descuento)</span>
            <span className="font-mono">{formatMoney(subtotalSinDescuento)}</span>
          </div>

          {/* Descuento Global */}
          {Number(orden.descuentoGlobal || 0) > 0 && (
            <div className="flex justify-between text-sm text-amber-600">
              <span>Descuento Global ({orden.descuentoGlobal}%)</span>
              <span className="font-mono">- {formatMoney(orden.descuentoMonto || 0)}</span>
            </div>
          )}

          {/* Subtotal con descuento */}
          <div className="flex justify-between font-semibold text-sm pt-2 border-t">
            <span>Subtotal</span>
            <span className="font-mono">{formatMoney(orden.subtotal)}</span>
          </div>

          {/* IVA */}
          {Number(orden.impuestos || 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">IVA ({orden.tasaIva}%)</span>
              <span className="font-mono">{formatMoney(orden.impuestos)}</span>
            </div>
          )}

          {/* Total */}
          <div className="flex justify-between text-lg font-bold pt-3 border-t-2">
            <span>TOTAL</span>
            <span className="font-mono text-2xl">{formatMoney(orden.total)}</span>
          </div>

          {/* Comisión (si existe) */}
          {Number(orden.comisionMonto || 0) > 0 && (
            <div className="mt-4 pt-4 border-t space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">Comisión del Vendedor</p>
              <div className="flex justify-between text-sm">
                <span>Porcentaje</span>
                <span className="font-semibold">{orden.comisionPorcentaje}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Monto</span>
                <span className="font-mono font-semibold">{formatMoney(orden.comisionMonto)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Estado</span>
                <span className={`font-semibold ${orden.comisionPagada ? 'text-green-600' : 'text-amber-600'}`}>
                  {orden.comisionPagada ? '✓ Pagada' : 'Pendiente'}
                </span>
              </div>
            </div>
          )}

          {/* Rentabilidad (solo si tiene permisos) */}
          {orden.margenPorcentaje !== undefined && (
            <div className="mt-4 pt-4 border-t space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">Análisis de Rentabilidad</p>
              <div className="flex justify-between text-sm">
                <span>Costo Total</span>
                <span className="font-mono">{formatMoney(orden.costoTotal || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Margen Bruto</span>
                <span className="font-mono font-semibold text-green-600">
                  {formatMoney(orden.margenBruto || 0)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Margen %</span>
                <span className={`font-bold ${Number(orden.margenPorcentaje) < 15 ? 'text-red-600' : 'text-green-600'}`}>
                  {Number(orden.margenPorcentaje).toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
