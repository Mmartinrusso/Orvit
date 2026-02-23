'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { formatDate } from '@/lib/date-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useViewMode } from '@/contexts/ViewModeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRightLeft,
  FileText,
  Calendar,
  Package,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Filter,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

interface StockMovement {
  id: number;
  tipo: string;
  cantidad: number;
  cantidadAnterior: number;
  cantidadPosterior: number;
  costoUnitario?: number;
  motivo?: string;
  notas?: string;
  sourceNumber?: string;
  createdAt: string;
  // Campos de trazabilidad del movimiento (guardan el valor al momento del movimiento)
  descripcionItem?: string | null;
  codigoProveedor?: string | null;
  codigoPropio?: string | null;
  supplierItem?: {
    id: number;
    nombre: string;
    unidad: string;
    codigoProveedor?: string;
    supplier?: { id: number; name: string };
  };
  warehouse?: {
    id: number;
    codigo: string;
    nombre: string;
  };
  goodsReceipt?: { id: number; numero: string };
  purchaseReturn?: { id: number; numero: string };
  transfer?: { id: number; numero: string };
  adjustment?: { id: number; numero: string };
  createdByUser?: { id: number; name: string };
}

interface Warehouse {
  id: number;
  codigo: string;
  nombre: string;
}

interface SupplierItem {
  id: number;
  nombre: string;
  codigoProveedor?: string;
}

const TIPO_MOVIMIENTO_CONFIG: Record<string, { label: string; color: string; icon: any; signo: string }> = {
  ENTRADA_RECEPCION: { label: 'Recepción', color: 'bg-success-muted text-success', icon: ArrowDownCircle, signo: '+' },
  SALIDA_DEVOLUCION: { label: 'Devolución', color: 'bg-destructive/10 text-destructive', icon: ArrowUpCircle, signo: '-' },
  TRANSFERENCIA_ENTRADA: { label: 'Transfer IN', color: 'bg-info-muted text-info-muted-foreground', icon: ArrowRightLeft, signo: '+' },
  TRANSFERENCIA_SALIDA: { label: 'Transfer OUT', color: 'bg-accent-cyan-muted text-accent-cyan-muted-foreground', icon: ArrowRightLeft, signo: '-' },
  AJUSTE_POSITIVO: { label: 'Ajuste +', color: 'bg-success-muted text-success', icon: ArrowDownCircle, signo: '+' },
  AJUSTE_NEGATIVO: { label: 'Ajuste -', color: 'bg-destructive/10 text-destructive', icon: ArrowUpCircle, signo: '-' },
  CONSUMO_PRODUCCION: { label: 'Consumo', color: 'bg-warning-muted text-warning-muted-foreground', icon: Package, signo: '-' },
  RESERVA: { label: 'Reservado', color: 'bg-accent-purple-muted text-accent-purple-muted-foreground', icon: Package, signo: '-' },
  LIBERACION_RESERVA: { label: 'Liberado', color: 'bg-accent-purple-muted text-accent-purple-muted-foreground', icon: Package, signo: '+' },
};

export default function KardexPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mode } = useViewMode();
  const prevModeRef = useRef(mode);

  const [movimientos, setMovimientos] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filtros
  const [supplierItemId, setSupplierItemId] = useState<string>(searchParams.get('item') || '');
  const [warehouseId, setWarehouseId] = useState<string>(searchParams.get('warehouse') || '');
  const [tipo, setTipo] = useState<string>(searchParams.get('tipo') || '');
  const [fechaDesde, setFechaDesde] = useState<string>(searchParams.get('desde') || '');
  const [fechaHasta, setFechaHasta] = useState<string>(searchParams.get('hasta') || '');

  // Datos para filtros
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [items, setItems] = useState<SupplierItem[]>([]);
  const [searchItem, setSearchItem] = useState('');

  // Cargar warehouses
  useEffect(() => {
    async function loadWarehouses() {
      try {
        const res = await fetch('/api/compras/depositos');
        if (res.ok) {
          const data = await res.json();
          setWarehouses(data.data || data || []);
        }
      } catch (error) {
        console.error('Error loading warehouses:', error);
      }
    }
    loadWarehouses();
  }, []);

  // Buscar items
  const searchItems = useCallback(async (search: string) => {
    if (search.length < 2) {
      setItems([]);
      return;
    }
    try {
      const res = await fetch(`/api/compras/supplier-items?search=${encodeURIComponent(search)}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.data || data || []);
      }
    } catch (error) {
      console.error('Error searching items:', error);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchItems(searchItem);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchItem, searchItems]);

  // Cargar movimientos
  const loadMovimientos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '30');
      if (supplierItemId) params.set('supplierItemId', supplierItemId);
      if (warehouseId) params.set('warehouseId', warehouseId);
      if (tipo) params.set('tipo', tipo);
      if (fechaDesde) params.set('fechaDesde', fechaDesde);
      if (fechaHasta) params.set('fechaHasta', fechaHasta);

      const res = await fetch(`/api/compras/stock/movimientos?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar movimientos');

      const data = await res.json();
      setMovimientos(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (error) {
      console.error('Error loading movimientos:', error);
      toast.error('Error al cargar los movimientos');
    } finally {
      setLoading(false);
    }
  }, [page, supplierItemId, warehouseId, tipo, fechaDesde, fechaHasta, mode]);

  // Auto-refresh when ViewMode changes
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      prevModeRef.current = mode;
      setPage(1); // Reset to page 1 when mode changes
    }
  }, [mode]);

  useEffect(() => {
    loadMovimientos();
  }, [loadMovimientos]);

  const clearFilters = () => {
    setSupplierItemId('');
    setWarehouseId('');
    setTipo('');
    setFechaDesde('');
    setFechaHasta('');
    setSearchItem('');
    setPage(1);
  };

  const hasFilters = supplierItemId || warehouseId || tipo || fechaDesde || fechaHasta;

  const getDocumentoOrigen = (mov: StockMovement) => {
    if (mov.sourceNumber) return mov.sourceNumber;
    if (mov.goodsReceipt) return mov.goodsReceipt.numero;
    if (mov.purchaseReturn) return mov.purchaseReturn.numero;
    if (mov.transfer) return mov.transfer.numero;
    if (mov.adjustment) return mov.adjustment.numero;
    return '-';
  };

  const getDocumentoLink = (mov: StockMovement) => {
    if (mov.goodsReceipt) return `/administracion/compras/recepciones/${mov.goodsReceipt.id}`;
    if (mov.transfer) return `/administracion/compras/stock/transferencias/${mov.transfer.id}`;
    if (mov.adjustment) return `/administracion/compras/stock/ajustes/${mov.adjustment.id}`;
    return null;
  };

  return (
    <div className="w-full p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/administracion/compras/stock">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Kardex</h1>
            <p className="text-sm text-muted-foreground">
              Historial de movimientos de stock
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadMovimientos}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros</span>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Buscar Item */}
            <div className="space-y-2">
              <Label>Item</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar item..."
                  value={searchItem}
                  onChange={(e) => setSearchItem(e.target.value)}
                  className="pl-10"
                />
              </div>
              {items.length > 0 && searchItem && (
                <div className="absolute z-10 mt-1 w-full max-w-sm bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      className="w-full px-3 py-2 text-left hover:bg-accent text-sm"
                      onClick={() => {
                        setSupplierItemId(String(item.id));
                        setSearchItem(item.nombre);
                        setItems([]);
                        setPage(1);
                      }}
                    >
                      <div className="font-medium">{item.nombre}</div>
                      {item.codigoProveedor && (
                        <div className="text-xs text-muted-foreground">{item.codigoProveedor}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Depósito */}
            <div className="space-y-2">
              <Label>Depósito</Label>
              <Select value={warehouseId || 'all'} onValueChange={(v) => { setWarehouseId(v === 'all' ? '' : v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={String(wh.id)}>
                      {wh.codigo} - {wh.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo || 'all'} onValueChange={(v) => { setTipo(v === 'all' ? '' : v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(TIPO_MOVIMIENTO_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fecha Desde */}
            <div className="space-y-2">
              <Label>Desde</Label>
              <DatePicker
                value={fechaDesde}
                onChange={(date) => { setFechaDesde(date); setPage(1); }}
                placeholder="Seleccionar fecha"
              />
            </div>

            {/* Fecha Hasta */}
            <div className="space-y-2">
              <Label>Hasta</Label>
              <DatePicker
                value={fechaHasta}
                onChange={(date) => { setFechaHasta(date); setPage(1); }}
                placeholder="Seleccionar fecha"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Movimientos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Movimientos
              <Badge variant="secondary">{total}</Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : movimientos.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {hasFilters ? 'No se encontraron movimientos con los filtros aplicados' : 'No hay movimientos registrados'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Depósito</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Usuario</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimientos.map((mov) => {
                      const config = TIPO_MOVIMIENTO_CONFIG[mov.tipo] || {
                        label: mov.tipo,
                        color: 'bg-muted text-foreground',
                        icon: Package,
                        signo: ''
                      };
                      const Icon = config.icon;
                      const docLink = getDocumentoLink(mov);

                      return (
                        <TableRow key={mov.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="text-sm">
                                  {formatDate(mov.createdAt)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(mov.createdAt), { addSuffix: true, locale: es })}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={config.color}>
                              <Icon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              {/* Usar descripcionItem del movimiento si existe, sino supplierItem.nombre */}
                              <div className="font-medium">
                                {mov.descripcionItem || mov.supplierItem?.nombre || '-'}
                              </div>
                              {/* Mostrar código: primero el del movimiento, sino el del supplierItem */}
                              {(mov.codigoProveedor || mov.supplierItem?.codigoProveedor) && (
                                <div className="text-xs text-muted-foreground">
                                  {mov.codigoProveedor || mov.supplierItem?.codigoProveedor}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{mov.warehouse?.codigo || '-'}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={config.signo === '+' ? 'text-success font-medium' : 'text-destructive font-medium'}>
                              {config.signo}{Number(mov.cantidad).toLocaleString('es-AR')}
                            </span>
                            <div className="text-xs text-muted-foreground">
                              {mov.supplierItem?.unidad || 'UN'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1 text-sm">
                              <span className="text-muted-foreground">
                                {Number(mov.cantidadAnterior).toLocaleString('es-AR')}
                              </span>
                              <span className="text-muted-foreground">→</span>
                              <span className="font-medium">
                                {Number(mov.cantidadPosterior).toLocaleString('es-AR')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {docLink ? (
                              <Link
                                href={docLink}
                                className="text-sm text-primary hover:underline"
                              >
                                {getDocumentoOrigen(mov)}
                              </Link>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {getDocumentoOrigen(mov)}
                              </span>
                            )}
                            {mov.motivo && (
                              <div className="text-xs text-muted-foreground truncate max-w-[150px]" title={mov.motivo}>
                                {mov.motivo}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {mov.createdByUser?.name || '-'}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Página {page} de {totalPages} ({total} movimientos)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
