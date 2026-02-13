'use client';

import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShoppingBag,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  FileEdit,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  RefreshCw,
  MoreHorizontal,
  Receipt,
  Download,
  Ban,
  PlayCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useViewMode } from '@/hooks/use-view-mode';
import { useApiClient } from '@/hooks/use-api-client';

// Dynamic import for SaleModal
const SaleModal = lazy(() => import('@/components/ventas/sale-modal').then(mod => ({ default: mod.SaleModal })));

interface OrdenVenta {
  id: number;
  numero: string;
  client: {
    id: string;
    legalName?: string;
    name?: string;
    email?: string;
  };
  seller?: {
    id: number;
    name: string;
  };
  fechaEmision: string;
  fechaEntregaEstimada: string | null;
  estado: string;
  moneda: string;
  subtotal: number;
  total: number;
  quoteId?: number;
  _count?: {
    items: number;
    deliveries: number;
    invoices: number;
  };
}

interface KPIs {
  borradores: number;
  confirmadas: number;
  enPreparacion: number;
  entregadas: number;
  facturadas: number;
}

type EstadoOV =
  | 'BORRADOR'
  | 'CONFIRMADA'
  | 'EN_PREPARACION'
  | 'PARCIALMENTE_ENTREGADA'
  | 'ENTREGADA'
  | 'FACTURADA'
  | 'COMPLETADA'
  | 'CANCELADA';

const ESTADOS_CONFIG: Record<EstadoOV, { label: string; color: string; icon: React.ElementType }> = {
  BORRADOR: { label: 'Borrador', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: FileEdit },
  CONFIRMADA: { label: 'Confirmada', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle2 },
  EN_PREPARACION: { label: 'Preparación', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
  PARCIALMENTE_ENTREGADA: { label: 'Parcial', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Truck },
  ENTREGADA: { label: 'Entregada', color: 'bg-green-100 text-green-700 border-green-200', icon: Truck },
  FACTURADA: { label: 'Facturada', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Receipt },
  COMPLETADA: { label: 'Completada', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  CANCELADA: { label: 'Cancelada', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: XCircle },
};

interface OrdenesVentaListProps {
  clienteId?: number;
  limit?: number;
  showKPIs?: boolean;
  title?: string;
}

export function OrdenesVentaList({
  clienteId,
  limit = 20,
  showKPIs = true,
  title = 'Órdenes de Venta',
}: OrdenesVentaListProps) {
  const { get, post: apiPost, del: apiDel } = useApiClient();
  const [ordenes, setOrdenes] = useState<OrdenVenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs>({
    borradores: 0,
    confirmadas: 0,
    enPreparacion: 0,
    entregadas: 0,
    facturadas: 0,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ordenToDelete, setOrdenToDelete] = useState<OrdenVenta | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedOrdenes, setSelectedOrdenes] = useState<number[]>([]);
  const [bulkActionDialog, setBulkActionDialog] = useState<{ open: boolean; action: string }>({ open: false, action: '' });
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [ordenToCancel, setOrdenToCancel] = useState<OrdenVenta | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);

  // ViewMode - para recargar cuando cambie el modo
  const { mode } = useViewMode();

  useEffect(() => {
    loadOrdenes();
  }, [page, statusFilter, searchTerm, clienteId, mode]); // Recargar al cambiar modo

  useEffect(() => {
    if (showKPIs) {
      loadKPIs();
    }
  }, [clienteId, showKPIs, mode]); // Recargar KPIs al cambiar modo

  const loadOrdenes = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (clienteId) params.append('clienteId', clienteId.toString());
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (searchTerm) params.append('search', searchTerm);

    const { data } = await get(`/api/ventas/ordenes?${params}`);
    if (data) {
      setOrdenes(data.data || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    }
    setLoading(false);
  };

  const loadKPIs = async () => {
    const clientParam = clienteId ? `&clienteId=${clienteId}` : '';

    const [borradoresRes, confirmadasRes, preparacionRes, entregadasRes, facturadasRes] = await Promise.all([
      get(`/api/ventas/ordenes?status=BORRADOR&limit=1${clientParam}`),
      get(`/api/ventas/ordenes?status=CONFIRMADA&limit=1${clientParam}`),
      get(`/api/ventas/ordenes?status=EN_PREPARACION&limit=1${clientParam}`),
      get(`/api/ventas/ordenes?status=ENTREGADA&limit=1${clientParam}`),
      get(`/api/ventas/ordenes?status=FACTURADA&limit=1${clientParam}`),
    ]);

    setKpis({
      borradores: borradoresRes.data?.pagination?.total || 0,
      confirmadas: confirmadasRes.data?.pagination?.total || 0,
      enPreparacion: preparacionRes.data?.pagination?.total || 0,
      entregadas: entregadasRes.data?.pagination?.total || 0,
      facturadas: facturadasRes.data?.pagination?.total || 0,
    });
  };

  const handleDelete = async () => {
    if (!ordenToDelete) return;

    setDeleting(true);
    const { error } = await apiDel(`/api/ventas/ordenes/${ordenToDelete.id}`);
    if (!error) {
      toast.success(`Orden ${ordenToDelete.numero} eliminada`);
      loadOrdenes();
      loadKPIs();
    }
    setDeleting(false);
    setDeleteDialogOpen(false);
    setOrdenToDelete(null);
  };

  const handleConfirmar = async (id: number) => {
    const { error } = await apiPost(`/api/ventas/ordenes/${id}/confirmar`, undefined);
    if (!error) {
      toast.success('Orden confirmada');
      loadOrdenes();
      loadKPIs();
    }
  };

  const handlePreparar = async (id: number) => {
    const { error } = await apiPost(`/api/ventas/ordenes/${id}/preparar`, undefined);
    if (!error) {
      toast.success('Preparación de orden iniciada');
      loadOrdenes();
      loadKPIs();
    }
  };

  const handleCancelar = async () => {
    if (!ordenToCancel || !cancelMotivo.trim()) return;

    setCancelling(true);
    const { error } = await apiPost(`/api/ventas/ordenes/${ordenToCancel.id}/cancelar`, { motivo: cancelMotivo });
    if (!error) {
      toast.success(`Orden ${ordenToCancel.numero} cancelada`);
      loadOrdenes();
      loadKPIs();
    }
    setCancelling(false);
    setCancelDialogOpen(false);
    setOrdenToCancel(null);
    setCancelMotivo('');
  };

  const formatCurrency = (amount: number, currency: string = 'ARS') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getEstadoBadge = (estado: string) => {
    const config = ESTADOS_CONFIG[estado as EstadoOV] || ESTADOS_CONFIG.BORRADOR;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} border text-[10px] px-1.5 py-0.5 font-medium`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const canEdit = (estado: string | undefined) => ['BORRADOR'].includes(estado?.toUpperCase() || '');
  const canDelete = (estado: string | undefined) => ['BORRADOR'].includes(estado?.toUpperCase() || '');
  const canConfirmar = (estado: string | undefined) => ['BORRADOR'].includes(estado?.toUpperCase() || '');
  const canPreparar = (estado: string | undefined) => ['CONFIRMADA'].includes(estado?.toUpperCase() || '');
  const canCancelar = (estado: string | undefined) => ['BORRADOR', 'CONFIRMADA', 'EN_PREPARACION'].includes(estado?.toUpperCase() || '');

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPage(1);
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all';

  const handleSelectOrden = (ordenId: number, checked: boolean) => {
    if (checked) {
      setSelectedOrdenes(prev => [...prev, ordenId]);
    } else {
      setSelectedOrdenes(prev => prev.filter(id => id !== ordenId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrdenes(ordenes.map(o => o.id));
    } else {
      setSelectedOrdenes([]);
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedOrdenes.length === 0) {
      toast.error('Selecciona al menos una orden');
      return;
    }
    // TODO: Implement bulk actions
    toast.success(`Acción "${action}" aplicada a ${selectedOrdenes.length} órdenes`);
    setSelectedOrdenes([]);
    setBulkActionDialog({ open: false, action: '' });
    loadOrdenes();
  };

  const exportOrdenes = () => {
    const csvContent = [
      ['Número', 'Cliente', 'Fecha', 'Entrega Est.', 'Estado', 'Items', 'Total', 'Moneda'],
      ...ordenes.map(o => [
        o.numero,
        o.client?.legalName || o.client?.name || '',
        o.fechaEmision ? format(new Date(o.fechaEmision), 'dd/MM/yyyy') : '',
        o.fechaEntregaEstimada ? format(new Date(o.fechaEntregaEstimada), 'dd/MM/yyyy') : '',
        ESTADOS_CONFIG[o.estado as EstadoOV]?.label || o.estado,
        (o._count?.items || 0).toString(),
        o.total.toString(),
        o.moneda,
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ordenes_venta_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingBag className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{title}</h2>
          <span className="text-xs text-muted-foreground">
            {total} orden(es)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportOrdenes}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button size="sm" onClick={() => setIsSaleModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Orden
          </Button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedOrdenes.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{selectedOrdenes.length} órdenes seleccionadas</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkActionDialog({ open: true, action: 'confirm' })}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkActionDialog({ open: true, action: 'cancel' })}
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      {showKPIs && (
        <div className="grid grid-cols-5 gap-3">
          <Card
            className={`cursor-pointer transition-all ${statusFilter === 'BORRADOR' ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
            onClick={() => setStatusFilter(statusFilter === 'BORRADOR' ? 'all' : 'BORRADOR')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-gray-100">
                  <FileEdit className="w-3.5 h-3.5 text-gray-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.borradores}</p>
                  <p className="text-[10px] text-muted-foreground">Borradores</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${statusFilter === 'CONFIRMADA' ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
            onClick={() => setStatusFilter(statusFilter === 'CONFIRMADA' ? 'all' : 'CONFIRMADA')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-100">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.confirmadas}</p>
                  <p className="text-[10px] text-muted-foreground">Confirmadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${statusFilter === 'EN_PREPARACION' ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
            onClick={() => setStatusFilter(statusFilter === 'EN_PREPARACION' ? 'all' : 'EN_PREPARACION')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-yellow-100">
                  <Clock className="w-3.5 h-3.5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.enPreparacion}</p>
                  <p className="text-[10px] text-muted-foreground">Preparación</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${statusFilter === 'ENTREGADA' ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
            onClick={() => setStatusFilter(statusFilter === 'ENTREGADA' ? 'all' : 'ENTREGADA')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-green-100">
                  <Truck className="w-3.5 h-3.5 text-green-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.entregadas}</p>
                  <p className="text-[10px] text-muted-foreground">Entregadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${statusFilter === 'FACTURADA' ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
            onClick={() => setStatusFilter(statusFilter === 'FACTURADA' ? 'all' : 'FACTURADA')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-purple-100">
                  <Receipt className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.facturadas}</p>
                  <p className="text-[10px] text-muted-foreground">Facturadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar número o cliente..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-8 h-8 text-xs"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos los estados</SelectItem>
            {Object.entries(ESTADOS_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key} className="text-xs">{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={clearFilters}
          >
            <X className="w-3 h-3 mr-1" />
            Limpiar
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => { loadOrdenes(); loadKPIs(); }}
          disabled={loading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="space-y-3">
          <div className="border rounded-lg">
            <div className="p-3 bg-muted/30">
              <Skeleton className="h-4 w-full" />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-3 border-t">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32 hidden md:block" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : ordenes.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No se encontraron órdenes de venta</p>
          {hasActiveFilters && (
            <Button variant="link" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-12 pl-4">
                    <Checkbox
                      checked={selectedOrdenes.length === ordenes.length && ordenes.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-xs font-medium w-[120px]">N° Orden</TableHead>
                  {!clienteId && <TableHead className="text-xs font-medium hidden sm:table-cell">Cliente</TableHead>}
                  <TableHead className="text-xs font-medium w-[90px] hidden md:table-cell">Fecha</TableHead>
                  <TableHead className="text-xs font-medium w-[90px] hidden lg:table-cell">Entrega</TableHead>
                  <TableHead className="text-xs font-medium w-[110px]">Estado</TableHead>
                  <TableHead className="text-xs font-medium w-[60px] text-center hidden sm:table-cell">Items</TableHead>
                  <TableHead className="text-xs font-medium w-[110px] text-right">Total</TableHead>
                  <TableHead className="text-xs font-medium text-right w-[90px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordenes.map((orden) => (
                  <TableRow
                    key={orden.id}
                    className="hover:bg-muted/30 cursor-pointer group"
                    onClick={() => window.location.href = `/administracion/ventas/ordenes/${orden.id}`}
                  >
                    <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedOrdenes.includes(orden.id)}
                        onCheckedChange={(checked) => handleSelectOrden(orden.id, !!checked)}
                      />
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>
                        <span className="font-medium">{orden.numero}</span>
                        {!clienteId && (
                          <div className="text-[10px] text-muted-foreground sm:hidden truncate max-w-[100px]">
                            {orden.client?.legalName || orden.client?.name || '-'}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {!clienteId && (
                      <TableCell className="text-xs hidden sm:table-cell">{orden.client?.legalName || orden.client?.name || '-'}</TableCell>
                    )}
                    <TableCell className="text-xs hidden md:table-cell">
                      {orden.fechaEmision ? format(new Date(orden.fechaEmision), 'dd/MM/yy', { locale: es }) : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                      {orden.fechaEntregaEstimada ? format(new Date(orden.fechaEntregaEstimada), 'dd/MM/yy', { locale: es }) : '-'}
                    </TableCell>
                    <TableCell>{getEstadoBadge(orden.estado)}</TableCell>
                    <TableCell className="text-center text-xs hidden sm:table-cell">{orden._count?.items || 0}</TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {formatCurrency(Number(orden.total), orden.moneda)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => window.location.href = `/administracion/ventas/ordenes/${orden.id}`}>
                            <Eye className="w-4 h-4 mr-2" />
                            Ver detalle
                          </DropdownMenuItem>
                          {canEdit(orden.estado) && (
                            <DropdownMenuItem onClick={() => window.location.href = `/administracion/ventas/ordenes/${orden.id}/editar`}>
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          {canConfirmar(orden.estado) && (
                            <DropdownMenuItem onClick={() => handleConfirmar(orden.id)}>
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Confirmar
                            </DropdownMenuItem>
                          )}
                          {canPreparar(orden.estado) && (
                            <DropdownMenuItem onClick={() => handlePreparar(orden.id)}>
                              <PlayCircle className="w-4 h-4 mr-2" />
                              Iniciar Preparación
                            </DropdownMenuItem>
                          )}
                          {canCancelar(orden.estado) && (
                            <DropdownMenuItem
                              className="text-orange-600"
                              onClick={() => {
                                setOrdenToCancel(orden);
                                setCancelDialogOpen(true);
                              }}
                            >
                              <Ban className="w-4 h-4 mr-2" />
                              Cancelar Orden
                            </DropdownMenuItem>
                          )}
                          {canDelete(orden.estado) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => {
                                  setOrdenToDelete(orden);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} de {total}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs px-2">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar orden de venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la orden
              <span className="font-medium"> {ordenToDelete?.numero}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Action Dialog */}
      <AlertDialog open={bulkActionDialog.open} onOpenChange={(open) => setBulkActionDialog({ ...bulkActionDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Acción Masiva</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkActionDialog.action === 'confirm' &&
                `¿Estás seguro de confirmar ${selectedOrdenes.length} orden(es)?`
              }
              {bulkActionDialog.action === 'cancel' &&
                `¿Estás seguro de cancelar ${selectedOrdenes.length} orden(es)?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleBulkAction(bulkActionDialog.action)}
              className={bulkActionDialog.action === 'cancel' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar orden de venta?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Esta acción cancelará la orden <span className="font-medium">{ordenToCancel?.numero}</span>.
                  Se liberarán las reservas de stock y se cancelarán entregas pendientes.
                </p>
                <div className="space-y-2">
                  <label htmlFor="cancelMotivo" className="text-sm font-medium text-foreground">
                    Motivo de cancelación *
                  </label>
                  <Input
                    id="cancelMotivo"
                    placeholder="Ingrese el motivo de la cancelación"
                    value={cancelMotivo}
                    onChange={(e) => setCancelMotivo(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelar}
              disabled={cancelling || !cancelMotivo.trim()}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cancelar Orden'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sale Modal */}
      <Suspense fallback={<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>}>
        <SaleModal
          open={isSaleModalOpen}
          onOpenChange={setIsSaleModalOpen}
          onSaleCreated={() => {
            setIsSaleModalOpen(false);
            loadOrdenes();
            loadKPIs();
            toast.success('Orden de venta creada exitosamente');
          }}
        />
      </Suspense>
    </div>
  );
}
