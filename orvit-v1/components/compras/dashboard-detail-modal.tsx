'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Building2,
  Package,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  FileText,
  DollarSign,
  Calendar,
  ShoppingCart,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============ UTILS ============
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(value);
}

function formatCompact(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${Math.round(value / 1000)}K`;
  return formatCurrency(value);
}

// ============ TYPES ============
export interface ProveedorDetail {
  id: number;
  nombre: string;
  cuit?: string;
  totalCompras: number;
  totalFacturas: number;
  deudaPendiente: number;
  ultimaCompra?: string;
  comprasPorMes: Array<{ mes: string; total: number }>;
  topItems: Array<{ descripcion: string; cantidad: number; total: number }>;
  facturasRecientes: Array<{ id: number; numero: string; fecha: string; total: number; estado: string }>;
}

export interface ItemDetail {
  descripcion: string;
  codigo?: string;
  totalComprado: number;
  cantidadTotal: number;
  precioPromedio: number;
  proveedores: Array<{ id: number; nombre: string; ultimoPrecio: number; cantidad: number }>;
  comprasPorMes: Array<{ mes: string; cantidad: number; total: number }>;
  ultimasCompras: Array<{ fecha: string; proveedor: string; cantidad: number; precio: number }>;
}

interface DashboardDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'proveedor' | 'item';
  // For proveedor
  proveedorId?: number;
  proveedorNombre?: string;
  // For item
  itemDescripcion?: string;
}

export function DashboardDetailModal({
  open,
  onOpenChange,
  type,
  proveedorId,
  proveedorNombre,
  itemDescripcion
}: DashboardDetailModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [proveedorData, setProveedorData] = useState<ProveedorDetail | null>(null);
  const [itemData, setItemData] = useState<ItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        if (type === 'proveedor' && proveedorId) {
          const res = await fetch(`/api/compras/dashboard/proveedor-detail?id=${proveedorId}`);
          if (!res.ok) throw new Error('Error al cargar datos');
          const data = await res.json();
          setProveedorData(data);
        } else if (type === 'item' && itemDescripcion) {
          const res = await fetch(`/api/compras/dashboard/item-detail?descripcion=${encodeURIComponent(itemDescripcion)}`);
          if (!res.ok) throw new Error('Error al cargar datos');
          const data = await res.json();
          setItemData(data);
        }
      } catch (e) {
        setError('No se pudieron cargar los detalles');
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [open, type, proveedorId, itemDescripcion]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === 'proveedor' ? (
              <>
                <Building2 className="h-5 w-5" />
                {proveedorNombre || 'Detalle de Proveedor'}
              </>
            ) : (
              <>
                <Package className="h-5 w-5" />
                {itemDescripcion?.substring(0, 50) || 'Detalle de Item'}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {type === 'proveedor'
              ? 'Resumen de compras, facturas y deuda del proveedor'
              : 'Historial de compras y proveedores del item'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          {loading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-muted-foreground">
              {error}
            </div>
          ) : type === 'proveedor' && proveedorData ? (
            <ProveedorDetailContent
              data={proveedorData}
              onNavigate={(path) => {
                onOpenChange(false);
                router.push(path);
              }}
            />
          ) : type === 'item' && itemData ? (
            <ItemDetailContent
              data={itemData}
              onNavigate={(path) => {
                onOpenChange(false);
                router.push(path);
              }}
            />
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No hay datos disponibles
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ============ PROVEEDOR DETAIL ============
function ProveedorDetailContent({
  data,
  onNavigate
}: {
  data: ProveedorDetail;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="space-y-6 py-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 rounded-lg bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1">Total Compras (6m)</div>
          <div className="text-xl font-semibold">{formatCompact(data.totalCompras)}</div>
          <div className="text-xs text-muted-foreground">{data.totalFacturas} facturas</div>
        </div>
        <div className={cn(
          "p-3 rounded-lg",
          data.deudaPendiente > 0 ? "bg-amber-500/10" : "bg-green-500/10"
        )}>
          <div className="text-xs text-muted-foreground mb-1">Deuda Pendiente</div>
          <div className="text-xl font-semibold">{formatCompact(data.deudaPendiente)}</div>
          <div className="text-xs text-muted-foreground">
            {data.deudaPendiente > 0 ? 'Por pagar' : 'Al dia'}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1">Ultima Compra</div>
          <div className="text-lg font-semibold">
            {data.ultimaCompra
              ? new Date(data.ultimaCompra).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
              : '-'}
          </div>
        </div>
      </div>

      {/* Compras por Mes */}
      {data.comprasPorMes.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Compras por Mes
            </h4>
            <div className="grid grid-cols-6 gap-2">
              {data.comprasPorMes.map((m) => (
                <div key={m.mes} className="text-center p-2 rounded bg-muted/20">
                  <div className="text-[10px] text-muted-foreground">{m.mes}</div>
                  <div className="text-sm font-medium">{formatCompact(m.total)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Top Items */}
      {data.topItems.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Items Mas Comprados
            </h4>
            <div className="space-y-2">
              {data.topItems.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm p-2 rounded bg-muted/20">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-5">{idx + 1}.</span>
                    <span className="truncate max-w-[200px]">{item.descripcion}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{item.cantidad} uds</span>
                    <span className="font-medium">{formatCompact(item.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Facturas Recientes */}
      {data.facturasRecientes.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Facturas Recientes
            </h4>
            <div className="space-y-2">
              {data.facturasRecientes.slice(0, 5).map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between text-sm p-2 rounded bg-muted/20 cursor-pointer hover:bg-muted/40"
                  onClick={() => onNavigate(`/administracion/compras/comprobantes/${f.id}`)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{f.numero}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(f.fecha).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={f.estado === 'pagada' ? 'default' : 'outline'} className="text-[10px]">
                      {f.estado}
                    </Badge>
                    <span className="font-medium">{formatCompact(f.total)}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      <Separator />
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate(`/administracion/compras/proveedores/${data.id}`)}
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1" />
          Ver Proveedor
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate(`/administracion/compras/cuentas-corrientes?proveedor=${data.id}`)}
        >
          <DollarSign className="h-3.5 w-3.5 mr-1" />
          Ver Cuenta Corriente
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate(`/administracion/compras/ordenes?proveedor=${data.id}`)}
        >
          <ShoppingCart className="h-3.5 w-3.5 mr-1" />
          Ver Ordenes
        </Button>
      </div>
    </div>
  );
}

// ============ ITEM DETAIL ============
function ItemDetailContent({
  data,
  onNavigate
}: {
  data: ItemDetail;
  onNavigate: (path: string) => void;
}) {
  const precioTrend = data.ultimasCompras.length >= 2
    ? ((data.ultimasCompras[0].precio - data.ultimasCompras[1].precio) / data.ultimasCompras[1].precio) * 100
    : 0;

  return (
    <div className="space-y-6 py-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-3 rounded-lg bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1">Total Comprado (6m)</div>
          <div className="text-xl font-semibold">{formatCompact(data.totalComprado)}</div>
          <div className="text-xs text-muted-foreground">{data.cantidadTotal.toFixed(0)} unidades</div>
        </div>
        <div className="p-3 rounded-lg bg-muted/30">
          <div className="text-xs text-muted-foreground mb-1">Precio Promedio</div>
          <div className="text-xl font-semibold">{formatCurrency(data.precioPromedio)}</div>
        </div>
        <div className={cn(
          "p-3 rounded-lg",
          precioTrend > 5 ? "bg-red-500/10" : precioTrend < -5 ? "bg-green-500/10" : "bg-muted/30"
        )}>
          <div className="text-xs text-muted-foreground mb-1">Variacion Precio</div>
          <div className="text-xl font-semibold flex items-center gap-1">
            {precioTrend > 0 ? (
              <TrendingUp className="h-4 w-4 text-red-500" />
            ) : precioTrend < 0 ? (
              <TrendingDown className="h-4 w-4 text-green-500" />
            ) : null}
            {Math.abs(precioTrend).toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground">vs compra anterior</div>
        </div>
      </div>

      {/* Proveedores */}
      {data.proveedores.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Proveedores ({data.proveedores.length})
            </h4>
            <div className="space-y-2">
              {data.proveedores.map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-sm p-2 rounded bg-muted/20 cursor-pointer hover:bg-muted/40"
                  onClick={() => onNavigate(`/administracion/compras/proveedores/${p.id}`)}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate max-w-[200px]">{p.nombre}</span>
                    {idx === 0 && (
                      <Badge variant="secondary" className="text-[10px]">Mejor precio</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{p.cantidad} uds</span>
                    <span className="font-medium">{formatCurrency(p.ultimoPrecio)}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Compras por Mes */}
      {data.comprasPorMes.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Compras por Mes
            </h4>
            <div className="grid grid-cols-6 gap-2">
              {data.comprasPorMes.map((m) => (
                <div key={m.mes} className="text-center p-2 rounded bg-muted/20">
                  <div className="text-[10px] text-muted-foreground">{m.mes}</div>
                  <div className="text-xs text-muted-foreground">{m.cantidad} uds</div>
                  <div className="text-sm font-medium">{formatCompact(m.total)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Ultimas Compras */}
      {data.ultimasCompras.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Ultimas Compras
            </h4>
            <div className="space-y-2">
              {data.ultimasCompras.slice(0, 5).map((c, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm p-2 rounded bg-muted/20">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.fecha).toLocaleDateString('es-AR')}
                    </span>
                    <span className="truncate max-w-[150px]">{c.proveedor}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{c.cantidad} uds</span>
                    <span className="font-medium">{formatCurrency(c.precio)}/ud</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DashboardDetailModal;
