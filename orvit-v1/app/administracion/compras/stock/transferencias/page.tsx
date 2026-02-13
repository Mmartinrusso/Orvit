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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  ArrowRight,
  Plus,
  MoreHorizontal,
  Eye,
  Send,
  PackageCheck,
  Trash2,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Truck,
  CheckCircle,
  Clock,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { TransferFormModal } from '@/components/compras/stock/transfer-form-modal';

interface StockTransfer {
  id: number;
  numero: string;
  estado: string;
  motivo?: string;
  fechaEnvio?: string;
  fechaRecepcion?: string;
  createdAt: string;
  warehouseOrigen?: {
    id: number;
    codigo: string;
    nombre: string;
  };
  warehouseDestino?: {
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

const ESTADO_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  BORRADOR: { label: 'Borrador', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: Clock },
  SOLICITADO: { label: 'Solicitado', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', icon: Clock },
  EN_TRANSITO: { label: 'En Tránsito', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300', icon: Truck },
  COMPLETADO: { label: 'Completado', color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300', icon: CheckCircle },
  RECIBIDO_PARCIAL: { label: 'Parcial', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300', icon: PackageCheck },
  CANCELADO: { label: 'Cancelado', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300', icon: Clock },
};

export default function TransferenciasPage() {
  const { mode } = useViewMode();
  const prevModeRef = useRef(mode);

  const [transferencias, setTransferencias] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filtros
  const [estado, setEstado] = useState<string>('');
  const [warehouseOrigenId, setWarehouseOrigenId] = useState<string>('');
  const [warehouseDestinoId, setWarehouseDestinoId] = useState<string>('');

  // Datos auxiliares
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // Modals y acciones
  const [showFormModal, setShowFormModal] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [receivingId, setReceivingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // KPIs
  const [kpis, setKpis] = useState({
    total: 0,
    borradores: 0,
    enTransito: 0,
    completados: 0,
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

  // Cargar transferencias
  const loadTransferencias = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (estado) params.set('estado', estado);
      if (warehouseOrigenId) params.set('warehouseOrigenId', warehouseOrigenId);
      if (warehouseDestinoId) params.set('warehouseDestinoId', warehouseDestinoId);

      const res = await fetch(`/api/compras/stock/transferencias?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar transferencias');

      const data = await res.json();
      setTransferencias(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);

      // Calcular KPIs simples
      const allTransfers = data.data || [];
      setKpis({
        total: data.pagination?.total || allTransfers.length,
        borradores: allTransfers.filter((t: StockTransfer) => t.estado === 'BORRADOR').length,
        enTransito: allTransfers.filter((t: StockTransfer) => t.estado === 'EN_TRANSITO').length,
        completados: allTransfers.filter((t: StockTransfer) => t.estado === 'COMPLETADO').length,
      });
    } catch (error) {
      console.error('Error loading transferencias:', error);
      toast.error('Error al cargar las transferencias');
    } finally {
      setLoading(false);
    }
  }, [page, estado, warehouseOrigenId, warehouseDestinoId, mode]);

  // Auto-refresh when ViewMode changes
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      prevModeRef.current = mode;
      setPage(1); // Reset to page 1 when mode changes
    }
  }, [mode]);

  useEffect(() => {
    loadTransferencias();
  }, [loadTransferencias]);

  // Enviar transferencia
  const handleSend = async () => {
    if (!sendingId) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/compras/stock/transferencias/${sendingId}/enviar`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al enviar');
      }

      toast.success('Transferencia enviada. Stock en tránsito.');
      loadTransferencias();
    } catch (error) {
      console.error('Error sending:', error);
      toast.error(error instanceof Error ? error.message : 'Error al enviar');
    } finally {
      setActionLoading(false);
      setSendingId(null);
    }
  };

  // Recibir transferencia
  const handleReceive = async () => {
    if (!receivingId) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/compras/stock/transferencias/${receivingId}/recibir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Recibir todo
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al recibir');
      }

      toast.success('Transferencia recibida correctamente');
      loadTransferencias();
    } catch (error) {
      console.error('Error receiving:', error);
      toast.error(error instanceof Error ? error.message : 'Error al recibir');
    } finally {
      setActionLoading(false);
      setReceivingId(null);
    }
  };

  // Eliminar transferencia
  const handleDelete = async () => {
    if (!deletingId) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/compras/stock/transferencias/${deletingId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al eliminar');
      }

      toast.success('Transferencia eliminada');
      loadTransferencias();
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
            <h1 className="text-2xl md:text-3xl font-bold">Transferencias</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona movimientos entre depósitos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadTransferencias}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button onClick={() => setShowFormModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Transferencia
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
                <p className="text-2xl font-bold text-gray-600">{kpis.borradores}</p>
              </div>
              <Clock className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En Tránsito</p>
                <p className="text-2xl font-bold text-yellow-600">{kpis.enTransito}</p>
              </div>
              <Truck className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completados</p>
                <p className="text-2xl font-bold text-green-600">{kpis.completados}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Label>Origen</Label>
              <Select value={warehouseOrigenId || 'all'} onValueChange={(v) => { setWarehouseOrigenId(v === 'all' ? '' : v); setPage(1); }}>
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
              <Label>Destino</Label>
              <Select value={warehouseDestinoId || 'all'} onValueChange={(v) => { setWarehouseDestinoId(v === 'all' ? '' : v); setPage(1); }}>
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
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            Transferencias
            <Badge variant="secondary">{total}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : transferencias.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay transferencias registradas</p>
              <Button variant="outline" className="mt-4" onClick={() => setShowFormModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primera transferencia
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Ruta</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transferencias.map((transfer) => {
                      const estadoConfig = ESTADO_CONFIG[transfer.estado] || ESTADO_CONFIG.BORRADOR;
                      const Icon = estadoConfig.icon;

                      return (
                        <TableRow key={transfer.id}>
                          <TableCell className="font-medium">{transfer.numero}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{transfer.warehouseOrigen?.codigo}</Badge>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              <Badge variant="outline">{transfer.warehouseDestino?.codigo}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>{transfer._count?.items || 0}</TableCell>
                          <TableCell>
                            <Badge className={estadoConfig.color}>
                              <Icon className="h-3 w-3 mr-1" />
                              {estadoConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {new Date(transfer.createdAt).toLocaleDateString('es-AR')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(transfer.createdAt), { addSuffix: true, locale: es })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {transfer.createdByUser?.name || '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/administracion/compras/stock/transferencias/${transfer.id}`}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Ver Detalle
                                  </Link>
                                </DropdownMenuItem>
                                {transfer.estado === 'BORRADOR' && (
                                  <>
                                    <DropdownMenuItem onClick={() => setSendingId(transfer.id)}>
                                      <Send className="h-4 w-4 mr-2" />
                                      Enviar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => setDeletingId(transfer.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {transfer.estado === 'EN_TRANSITO' && (
                                  <DropdownMenuItem onClick={() => setReceivingId(transfer.id)}>
                                    <PackageCheck className="h-4 w-4 mr-2" />
                                    Recibir
                                  </DropdownMenuItem>
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
      <TransferFormModal
        open={showFormModal}
        onOpenChange={setShowFormModal}
        onSaved={loadTransferencias}
      />

      {/* Dialog de enviar */}
      <AlertDialog open={!!sendingId} onOpenChange={() => setSendingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar Transferencia</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de enviar esta transferencia? El stock se moverá al estado &quot;En Tránsito&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de recibir */}
      <AlertDialog open={!!receivingId} onOpenChange={() => setReceivingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recibir Transferencia</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de confirmar la recepción? El stock se moverá al depósito destino.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReceive} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Recepción
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de eliminación */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Transferencia</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de eliminar esta transferencia? Esta acción no se puede deshacer.
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
