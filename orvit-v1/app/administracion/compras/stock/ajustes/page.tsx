'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useViewMode } from '@/contexts/ViewModeContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Plus,
  MoreHorizontal,
  Eye,
  Check,
  Trash2,
  Package,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { AdjustmentFormModal } from '@/components/compras/stock/adjustment-form-modal';
import { AdjustmentDetailModal } from '@/components/compras/stock/adjustment-detail-modal';

interface StockAdjustment {
  id: number;
  numero: string;
  tipo: string;
  estado: string;
  motivo: string;
  cantidadPositiva?: number;
  cantidadNegativa?: number;
  valorPositivo?: number;
  valorNegativo?: number;
  createdAt: string;
  warehouse?: {
    id: number;
    codigo: string;
    nombre: string;
  };
  createdByUser?: {
    id: number;
    name: string;
  };
  _count?: {
    items: number;
  };
}

interface Warehouse {
  id: number;
  codigo: string;
  nombre: string;
}

const TIPO_LABELS: Record<string, string> = {
  INVENTARIO_FISICO: 'Inventario Físico',
  ROTURA: 'Rotura',
  VENCIMIENTO: 'Vencimiento',
  MERMA: 'Merma',
  CORRECCION: 'Corrección',
  DEVOLUCION_INTERNA: 'Devolución Interna',
};

const ESTADO_CONFIG: Record<string, { label: string; color: string }> = {
  BORRADOR: { label: 'Borrador', color: 'bg-muted text-foreground' },
  PENDIENTE_APROBACION: { label: 'Pend. Aprobación', color: 'bg-warning-muted text-warning-muted-foreground' },
  CONFIRMADO: { label: 'Confirmado', color: 'bg-success-muted text-success' },
  RECHAZADO: { label: 'Rechazado', color: 'bg-destructive/10 text-destructive' },
};

export default function AjustesPage() {
  const { mode } = useViewMode();
  const prevModeRef = useRef(mode);

  const [ajustes, setAjustes] = useState<StockAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filtros
  const [tipo, setTipo] = useState<string>('');
  const [estado, setEstado] = useState<string>('');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');

  // Datos auxiliares
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedAjusteId, setSelectedAjusteId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // KPIs
  const [kpis, setKpis] = useState({
    total: 0,
    borradores: 0,
    pendientes: 0,
    confirmados: 0,
  });

  // Cargar warehouses
  useEffect(() => {
    async function loadWarehouses() {
      try {
        const res = await fetch('/api/compras/depositos');
        if (res.ok) {
          const data = await res.json();
          setWarehouses((data.data || data).filter((w: any) => !w.isTransit));
        }
      } catch (error) {
        console.error('Error loading warehouses:', error);
      }
    }
    loadWarehouses();
  }, []);

  // Cargar ajustes
  const loadAjustes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (tipo) params.set('tipo', tipo);
      if (estado) params.set('estado', estado);
      if (warehouseId) params.set('warehouseId', warehouseId);
      if (fechaDesde) params.set('fechaDesde', fechaDesde);
      if (fechaHasta) params.set('fechaHasta', fechaHasta);

      const res = await fetch(`/api/compras/stock/ajustes?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar ajustes');

      const data = await res.json();
      setAjustes(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);

      // Calcular KPIs simples
      const allAjustes = data.data || [];
      setKpis({
        total: data.pagination?.total || allAjustes.length,
        borradores: allAjustes.filter((a: StockAdjustment) => a.estado === 'BORRADOR').length,
        pendientes: allAjustes.filter((a: StockAdjustment) => a.estado === 'PENDIENTE_APROBACION').length,
        confirmados: allAjustes.filter((a: StockAdjustment) => a.estado === 'CONFIRMADO').length,
      });
    } catch (error) {
      console.error('Error loading ajustes:', error);
      toast.error('Error al cargar los ajustes');
    } finally {
      setLoading(false);
    }
  }, [page, tipo, estado, warehouseId, fechaDesde, fechaHasta, mode]);

  // Auto-refresh when ViewMode changes
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      prevModeRef.current = mode;
      setPage(1); // Reset to page 1 when mode changes
    }
  }, [mode]);

  useEffect(() => {
    loadAjustes();
  }, [loadAjustes]);

  // Confirmar ajuste
  const handleConfirm = async () => {
    if (!confirmingId) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/compras/stock/ajustes/${confirmingId}/confirmar`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al confirmar');
      }

      toast.success('Ajuste confirmado y stock actualizado');
      loadAjustes();
    } catch (error) {
      console.error('Error confirming:', error);
      toast.error(error instanceof Error ? error.message : 'Error al confirmar');
    } finally {
      setActionLoading(false);
      setConfirmingId(null);
    }
  };

  // Eliminar ajuste
  const handleDelete = async () => {
    if (!deletingId) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/compras/stock/ajustes/${deletingId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al eliminar');
      }

      toast.success('Ajuste eliminado');
      loadAjustes();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error(error instanceof Error ? error.message : 'Error al eliminar');
    } finally {
      setActionLoading(false);
      setDeletingId(null);
    }
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
            <h1 className="text-2xl md:text-3xl font-bold">Ajustes de Inventario</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona ajustes por conteo, rotura, vencimiento y otros
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadAjustes}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button onClick={() => setShowFormModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Ajuste
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{kpis.total}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Borradores</p>
                <p className="text-2xl font-bold text-muted-foreground">{kpis.borradores}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pend. Aprobación</p>
                <p className="text-2xl font-bold text-warning-muted-foreground">{kpis.pendientes}</p>
              </div>
              <Clock className="h-8 w-8 text-warning-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Confirmados</p>
                <p className="text-2xl font-bold text-success">{kpis.confirmados}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo || 'all'} onValueChange={(v) => { setTipo(v === 'all' ? '' : v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(TIPO_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={estado || 'all'} onValueChange={(v) => { setEstado(v === 'all' ? '' : v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(ESTADO_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                      {wh.codigo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Desde</Label>
              <DatePicker
                value={fechaDesde}
                onChange={(date) => { setFechaDesde(date); setPage(1); }}
                placeholder="Seleccionar fecha"
              />
            </div>

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

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            Ajustes
            <Badge variant="secondary">{total}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : ajustes.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay ajustes registrados</p>
              <Button variant="outline" className="mt-4" onClick={() => setShowFormModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primer ajuste
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Depósito</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Diferencia</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ajustes.map((ajuste) => {
                      const estadoConfig = ESTADO_CONFIG[ajuste.estado] || ESTADO_CONFIG.BORRADOR;

                      return (
                        <TableRow
                          key={ajuste.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedAjusteId(ajuste.id)}
                        >
                          <TableCell className="font-medium">{ajuste.numero}</TableCell>
                          <TableCell>{TIPO_LABELS[ajuste.tipo] || ajuste.tipo}</TableCell>
                          <TableCell>{ajuste.warehouse?.codigo || '-'}</TableCell>
                          <TableCell>{ajuste._count?.items || 0}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              {(ajuste.cantidadPositiva || 0) > 0 && (
                                <span className="text-success text-sm flex items-center gap-1">
                                  <TrendingUp className="h-3 w-3" />
                                  +{Number(ajuste.cantidadPositiva).toLocaleString('es-AR')}
                                </span>
                              )}
                              {(ajuste.cantidadNegativa || 0) > 0 && (
                                <span className="text-destructive text-sm flex items-center gap-1">
                                  <TrendingDown className="h-3 w-3" />
                                  -{Number(ajuste.cantidadNegativa).toLocaleString('es-AR')}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={estadoConfig.color}>{estadoConfig.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {new Date(ajuste.createdAt).toLocaleDateString('es-AR')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(ajuste.createdAt), { addSuffix: true, locale: es })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {ajuste.createdByUser?.name || '-'}
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setSelectedAjusteId(ajuste.id)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver Detalle
                                </DropdownMenuItem>
                                {ajuste.estado === 'BORRADOR' && (
                                  <>
                                    <DropdownMenuItem onClick={() => setConfirmingId(ajuste.id)}>
                                      <Check className="h-4 w-4 mr-2" />
                                      Confirmar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => setDeletingId(ajuste.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
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
                    Página {page} de {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
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

      {/* Modal de formulario */}
      <AdjustmentFormModal
        open={showFormModal}
        onOpenChange={setShowFormModal}
        onSaved={loadAjustes}
      />

      {/* Modal de detalle */}
      <AdjustmentDetailModal
        open={!!selectedAjusteId}
        onOpenChange={(open) => !open && setSelectedAjusteId(null)}
        adjustmentId={selectedAjusteId}
        onUpdated={loadAjustes}
      />

      {/* Dialog de confirmación */}
      <AlertDialog open={!!confirmingId} onOpenChange={() => setConfirmingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Ajuste</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de confirmar este ajuste? Esta acción actualizará el stock
              y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de eliminación */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Ajuste</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de eliminar este ajuste? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
