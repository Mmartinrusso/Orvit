'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building2,
  Package,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Search,
  ArrowUpDown,
  ChevronRight,
  DollarSign,
  Calendar,
  FileText
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
export interface ProveedorListItem {
  id: number;
  nombre: string;
  cuit?: string;
  totalCompras: number;
  cantidadFacturas: number;
  deudaPendiente: number;
  ultimaCompra?: string;
  variacionMensual?: number;
}

export interface ItemListItem {
  descripcion: string;
  codigo?: string;
  totalComprado: number;
  cantidadTotal: number;
  precioPromedio: number;
  variacionPrecio?: number;
  cantidadProveedores: number;
  ultimaCompra?: string;
}

type SortField = 'nombre' | 'totalCompras' | 'deudaPendiente' | 'ultimaCompra' | 'descripcion' | 'totalComprado' | 'precioPromedio';
type SortDirection = 'asc' | 'desc';

interface DashboardFullViewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'proveedores' | 'items';
}

export function DashboardFullViewSheet({
  open,
  onOpenChange,
  type
}: DashboardFullViewSheetProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [proveedores, setProveedores] = useState<ProveedorListItem[]>([]);
  const [items, setItems] = useState<ItemListItem[]>([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>(type === 'proveedores' ? 'totalCompras' : 'totalComprado');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        if (type === 'proveedores') {
          const res = await fetch('/api/compras/dashboard/proveedores-list');
          if (!res.ok) throw new Error('Error al cargar datos');
          const data = await res.json();
          setProveedores(data.proveedores || []);
        } else {
          const res = await fetch('/api/compras/dashboard/items-list');
          if (!res.ok) throw new Error('Error al cargar datos');
          const data = await res.json();
          setItems(data.items || []);
        }
      } catch (e) {
        setError('No se pudieron cargar los datos');
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [open, type]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filter and sort proveedores
  const filteredProveedores = proveedores
    .filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const field = sortField as keyof ProveedorListItem;
      const aVal = a[field];
      const bVal = b[field];
      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });

  // Filter and sort items
  const filteredItems = items
    .filter(i => i.descripcion.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const field = sortField as keyof ItemListItem;
      const aVal = a[field];
      const bVal = b[field];
      if (aVal === undefined) return 1;
      if (bVal === undefined) return -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={cn(
          "h-3 w-3",
          sortField === field ? "text-foreground" : "text-muted-foreground"
        )} />
      </div>
    </TableHead>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-4xl p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-xl">
            {type === 'proveedores' ? (
              <>
                <Building2 className="h-5 w-5" />
                Todos los Proveedores
              </>
            ) : (
              <>
                <Package className="h-5 w-5" />
                Todos los Items
              </>
            )}
          </SheetTitle>
          <SheetDescription>
            {type === 'proveedores'
              ? `${filteredProveedores.length} proveedores con compras en los ultimos 6 meses`
              : `${filteredItems.length} items comprados en los ultimos 6 meses`}
          </SheetDescription>
        </SheetHeader>

        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={type === 'proveedores' ? 'Buscar proveedor...' : 'Buscar item...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 text-center text-muted-foreground">
              {error}
            </div>
          ) : type === 'proveedores' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader field="nombre">Proveedor</SortHeader>
                  <SortHeader field="totalCompras">Total Compras</SortHeader>
                  <SortHeader field="deudaPendiente">Deuda</SortHeader>
                  <TableHead className="text-center">Facturas</TableHead>
                  <SortHeader field="ultimaCompra">Ultima</SortHeader>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProveedores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No se encontraron proveedores
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProveedores.map((prov) => (
                    <TableRow
                      key={prov.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        onOpenChange(false);
                        router.push(`/administracion/compras/proveedores/${prov.id}`);
                      }}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{prov.nombre}</div>
                          {prov.cuit && (
                            <div className="text-xs text-muted-foreground">{prov.cuit}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCompact(prov.totalCompras)}</span>
                          {prov.variacionMensual !== undefined && prov.variacionMensual !== 0 && (
                            <span className={cn(
                              "flex items-center gap-0.5 text-xs",
                              prov.variacionMensual > 0 ? "text-red-500" : "text-green-500"
                            )}>
                              {prov.variacionMensual > 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {Math.abs(prov.variacionMensual)}%
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={prov.deudaPendiente > 0 ? "destructive" : "secondary"}>
                          {formatCompact(prov.deudaPendiente)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{prov.cantidadFacturas}</Badge>
                      </TableCell>
                      <TableCell>
                        {prov.ultimaCompra
                          ? new Date(prov.ultimaCompra).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader field="descripcion">Item</SortHeader>
                  <SortHeader field="totalComprado">Total</SortHeader>
                  <SortHeader field="precioPromedio">Precio Prom.</SortHeader>
                  <TableHead className="text-center">Proveedores</TableHead>
                  <TableHead className="text-center">Cantidad</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No se encontraron items
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item, idx) => (
                    <TableRow
                      key={idx}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        onOpenChange(false);
                        router.push(`/administracion/compras/stock?search=${encodeURIComponent(item.descripcion)}`);
                      }}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium truncate max-w-[250px]">{item.descripcion}</div>
                          {item.codigo && (
                            <div className="text-xs text-muted-foreground font-mono">{item.codigo}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{formatCompact(item.totalComprado)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{formatCurrency(item.precioPromedio)}</span>
                          {item.variacionPrecio !== undefined && item.variacionPrecio !== 0 && (
                            <span className={cn(
                              "flex items-center gap-0.5 text-xs",
                              item.variacionPrecio > 0 ? "text-red-500" : "text-green-500"
                            )}>
                              {item.variacionPrecio > 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {Math.abs(item.variacionPrecio).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{item.cantidadProveedores}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-muted-foreground">{item.cantidadTotal.toFixed(0)} uds</span>
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {/* Summary footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
          <div className="flex items-center justify-between text-sm">
            {type === 'proveedores' ? (
              <>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">Total compras:</span>
                  <span className="font-semibold">
                    {formatCurrency(filteredProveedores.reduce((sum, p) => sum + p.totalCompras, 0))}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">Deuda total:</span>
                  <span className="font-semibold text-destructive">
                    {formatCurrency(filteredProveedores.reduce((sum, p) => sum + p.deudaPendiente, 0))}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">Total comprado:</span>
                  <span className="font-semibold">
                    {formatCurrency(filteredItems.reduce((sum, i) => sum + i.totalComprado, 0))}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">{filteredItems.length} items</span>
                </div>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default DashboardFullViewSheet;
