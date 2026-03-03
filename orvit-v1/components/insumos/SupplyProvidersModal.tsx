'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';
import { useCompany } from '@/contexts/CompanyContext';
import {
  Package,
  TrendingUp,
  TrendingDown,
  Minus,
  ShoppingCart,
  Building2,
  BarChart3,
  Calendar,
} from 'lucide-react';

interface UltimaCompra {
  id: number;
  precio: number;
  fecha: string;
  comprobante: string | null;
}

interface Proveedor {
  supplierItemId: number;
  supplierId: number;
  supplierName: string;
  codigoProveedor: string | null;
  unidad: string;
  precioActual: number | null;
  stock: number;
  ultimaActualizacion: string | null;
  ultimasCompras: UltimaCompra[];
}

interface MesHistorial {
  mes: string;
  precio: number;
  notes: string | null;
}

interface SupplyDetail {
  supply: { id: number; name: string; unitMeasure: string };
  proveedores: Proveedor[];
  precioPromedioPonderado: number | null;
  precioPromedioNotes: string | null;
  historialMensual: MesHistorial[];
}

interface Props {
  supplyId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatMes(isoDate: string) {
  const d = new Date(isoDate);
  return d.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
}

function formatFecha(isoDate: string) {
  const d = new Date(isoDate);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function PriceTrend({ current, prev }: { current: number; prev: number }) {
  if (!prev || prev === 0) return null;
  const pct = ((current - prev) / prev) * 100;
  if (Math.abs(pct) < 0.1) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  if (pct > 0)
    return (
      <span className="flex items-center gap-0.5 text-destructive text-xs font-medium">
        <TrendingUp className="h-3.5 w-3.5" />
        +{pct.toFixed(1)}%
      </span>
    );
  return (
    <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
      <TrendingDown className="h-3.5 w-3.5" />
      {pct.toFixed(1)}%
    </span>
  );
}

export function SupplyProvidersModal({ supplyId, open, onOpenChange }: Props) {
  const { currentCompany } = useCompany();
  const [data, setData] = useState<SupplyDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !supplyId || !currentCompany?.id) return;
    setLoading(true);
    setData(null);
    fetch(`/api/insumos/insumos/${supplyId}/proveedores?companyId=${currentCompany.id}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, supplyId, currentCompany?.id]);

  const totalStock = data?.proveedores.reduce((s, p) => s + (p.stock || 0), 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {loading ? 'Cargando...' : (data?.supply.name ?? 'Insumo')}
            {data && (
              <Badge variant="outline" className="text-xs font-normal ml-1">
                {data.supply.unitMeasure}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="py-10 text-center text-sm text-muted-foreground animate-pulse">
            Cargando proveedores...
          </div>
        )}

        {!loading && data && (
          <div className="space-y-5 pb-2">
            {/* Precio promedio ponderado del mes */}
            <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Precio promedio ponderado — mes actual
                </p>
                {data.precioPromedioNotes && (
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    {data.precioPromedioNotes}
                  </p>
                )}
              </div>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {data.precioPromedioPonderado != null
                  ? formatCurrency(data.precioPromedioPonderado)
                  : <span className="text-muted-foreground text-base font-normal">Sin datos</span>}
              </p>
            </div>

            {/* Stock total */}
            {totalStock > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShoppingCart className="h-4 w-4" />
                Stock total: <span className="font-semibold text-foreground">{totalStock.toLocaleString('es-AR')} {data.supply.unitMeasure}</span>
              </div>
            )}

            <Separator />

            {/* Proveedores */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Proveedores ({data.proveedores.length})
              </p>

              {data.proveedores.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay proveedores configurados para este insumo.
                </p>
              )}

              {data.proveedores.map((prov) => {
                const compras = prov.ultimasCompras;
                const precioUltimo = compras[0]?.precio ?? prov.precioActual;
                const precioAnterior = compras[1]?.precio ?? null;

                return (
                  <div key={prov.supplierItemId} className="rounded-lg border p-3.5 space-y-3">
                    {/* Header proveedor */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{prov.supplierName}</p>
                        {prov.codigoProveedor && (
                          <p className="text-xs text-muted-foreground font-mono">
                            Cód: {prov.codigoProveedor}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold tabular-nums">
                          {precioUltimo != null
                            ? formatCurrency(precioUltimo)
                            : <span className="text-muted-foreground text-sm">—</span>}
                        </p>
                        {precioUltimo != null && precioAnterior != null && (
                          <PriceTrend current={precioUltimo} prev={precioAnterior} />
                        )}
                      </div>
                    </div>

                    {/* Stock + última compra */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {prov.stock > 0 ? (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <ShoppingCart className="h-3 w-3" />
                          Stock: {prov.stock.toLocaleString('es-AR')} {prov.unidad}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">Sin stock</span>
                      )}
                      {compras[0]?.fecha && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Última compra: {formatFecha(compras[0].fecha)}
                        </span>
                      )}
                    </div>

                    {/* Historial de últimas compras */}
                    {compras.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground/70 uppercase tracking-wide">
                          Últimas compras
                        </p>
                        <div className="divide-y divide-border/50">
                          {compras.map((c) => (
                            <div key={c.id} className="flex items-center justify-between py-1.5 text-xs">
                              <span className="text-muted-foreground">
                                {formatFecha(c.fecha)}
                                {c.comprobante && (
                                  <span className="ml-1.5 font-mono text-muted-foreground/60">{c.comprobante}</span>
                                )}
                              </span>
                              <span className="font-medium tabular-nums">{formatCurrency(c.precio)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Historial mensual de precio promedio */}
            {data.historialMensual.length > 1 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Precio promedio — últimos meses
                  </p>
                  <div className="divide-y divide-border/50">
                    {data.historialMensual.map((m, i) => (
                      <div key={i} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-muted-foreground capitalize">{formatMes(m.mes)}</span>
                        <div className="flex items-center gap-3">
                          {i < data.historialMensual.length - 1 && (
                            <PriceTrend
                              current={m.precio}
                              prev={data.historialMensual[i + 1].precio}
                            />
                          )}
                          <span className="font-semibold tabular-nums">{formatCurrency(m.precio)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
