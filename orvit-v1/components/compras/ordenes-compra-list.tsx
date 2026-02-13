'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
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
import {
  ShoppingCart,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  FileEdit,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  RefreshCw,
  MoreHorizontal,
  LayoutGrid,
  LayoutList,
  Send,
  FileText,
  Ban,
  Building2,
  PackageCheck,
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
import { OrdenCompraFormModal } from '@/components/compras/orden-compra-form-modal';
import { OrdenCompraDetailModal } from '@/components/compras/orden-compra-detail-modal';
import { CompletarOCModal } from '@/components/compras/completar-oc-modal';
import { CargarRemitoDesdeOCModal } from '@/components/compras/cargar-remito-desde-oc-modal';
import { DatePicker } from '@/components/ui/date-picker';
import { useViewMode } from '@/contexts/ViewModeContext';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface OrdenCompraItem {
  id: number;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  subtotal: number;
  supplierItem?: {
    id: number;
    nombre: string;
  };
}

interface OrdenCompra {
  id: number;
  numero: string;
  proveedor: {
    id: number;
    name: string;
    cuit?: string;
  };
  fechaEmision: string;
  fechaEntregaEsperada: string | null;
  estado: string;
  moneda: string;
  subtotal: number;
  impuestos: number;
  total: number;
  esEmergencia: boolean;
  docType?: 'T1' | 'T2';  // ViewMode - T1=documentado, T2=PPT
  items?: OrdenCompraItem[];  // Preview de items (primeros 3)
  _count: {
    items: number;
    goodsReceipts: number;
  };
  createdByUser?: {
    id: number;
    name: string;
  };
}

interface KPIs {
  borradores: number;
  pendientesAprobacion: number;
  enCurso: number;
  completadas: number;
  atrasadas: number;
}

type EstadoOC =
  | 'BORRADOR'
  | 'PENDIENTE_APROBACION'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'ENVIADA_PROVEEDOR'
  | 'CONFIRMADA'
  | 'PARCIALMENTE_RECIBIDA'
  | 'COMPLETADA'
  | 'CANCELADA';

const ESTADOS_CONFIG: Record<EstadoOC, { label: string; color: string; icon: React.ElementType }> = {
  BORRADOR: { label: 'Borrador', color: 'bg-gray-100 text-gray-700 border-gray-200', icon: FileEdit },
  PENDIENTE_APROBACION: { label: 'Pend. Aprob.', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
  APROBADA: { label: 'Aprobada', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle2 },
  RECHAZADA: { label: 'Rechazada', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  ENVIADA_PROVEEDOR: { label: 'Enviada', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: ShoppingCart },
  CONFIRMADA: { label: 'Confirmada', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  PARCIALMENTE_RECIBIDA: { label: 'Parcial', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Clock },
  COMPLETADA: { label: 'Completada', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  CANCELADA: { label: 'Cancelada', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: XCircle },
};

interface OrdenesCompraListProps {
  proveedorId?: number;
  limit?: number;
  showKPIs?: boolean;
  title?: string;
}

export function OrdenesCompraList({
  proveedorId,
  limit = 20,
  showKPIs = true,
  title = 'Órdenes de Compra',
}: OrdenesCompraListProps) {
  // ViewMode - esperar a que cargue la config para evitar race condition
  const { mode, isLoading: viewModeLoading } = useViewMode();

  // Estado de datos
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs>({
    borradores: 0,
    pendientesAprobacion: 0,
    enCurso: 0,
    completadas: 0,
    atrasadas: 0,
  });

  // Estado de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [soloEmergencias, setSoloEmergencias] = useState(false);
  const [soloAtrasadas, setSoloAtrasadas] = useState(false);

  // Estado de paginación
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Estado de modales
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingOrdenId, setEditingOrdenId] = useState<number | undefined>(undefined);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOrdenId, setSelectedOrdenId] = useState<number | null>(null);

  // Estado de eliminación
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ordenToDelete, setOrdenToDelete] = useState<OrdenCompra | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // View mode (table/cards)
  const [viewModeList, setViewModeList] = useState<'table' | 'cards'>('table');

  // Cancel modal state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [ordenToCancel, setOrdenToCancel] = useState<OrdenCompra | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [canceling, setCanceling] = useState(false);

  // Completar OC modal state
  const [completarModalOpen, setCompletarModalOpen] = useState(false);
  const [ordenToCompletar, setOrdenToCompletar] = useState<OrdenCompra | null>(null);

  // Cargar Remito modal state
  const [cargarRemitoModalOpen, setCargarRemitoModalOpen] = useState(false);
  const [ordenParaRemito, setOrdenParaRemito] = useState<OrdenCompra | null>(null);

  useEffect(() => {
    // No cargar hasta que ViewMode termine de cargar para evitar race condition
    if (viewModeLoading) {
      console.log('[OrdenesCompraList] ⏳ Esperando ViewMode...');
      return;
    }
    loadOrdenes();
  }, [page, statusFilter, searchTerm, proveedorId, fechaDesde, fechaHasta, soloEmergencias, mode, viewModeLoading]);

  useEffect(() => {
    // No cargar KPIs hasta que ViewMode termine de cargar
    if (viewModeLoading) return;
    if (showKPIs) {
      loadKPIs();
    }
  }, [proveedorId, showKPIs, mode, viewModeLoading]);

  const loadOrdenes = async () => {
    console.log('[OrdenesCompraList] 🔄 Cargando órdenes, ViewMode:', mode);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (proveedorId) params.append('proveedorId', proveedorId.toString());
      if (statusFilter !== 'all') params.append('estado', statusFilter);
      if (searchTerm) params.append('search', searchTerm);
      if (fechaDesde) params.append('fechaDesde', fechaDesde);
      if (fechaHasta) params.append('fechaHasta', fechaHasta);
      if (soloEmergencias) params.append('esEmergencia', 'true');

      console.log('[OrdenesCompraList] 📡 Fetching:', `/api/compras/ordenes-compra?${params}`);
      const response = await fetch(`/api/compras/ordenes-compra?${params}`);
      if (response.ok) {
        const data = await response.json();
        console.log('[OrdenesCompraList] ✅ Órdenes cargadas:', data.pagination?.total, 'total');
        setOrdenes(data.data || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        console.error('[OrdenesCompraList] ❌ Error response:', response.status);
      }
    } catch (error) {
      console.error('[OrdenesCompraList] ❌ Error loading ordenes:', error);
      toast.error('Error al cargar las órdenes');
    } finally {
      setLoading(false);
    }
  };

  const loadKPIs = async () => {
    try {
      const provParam = proveedorId ? `&proveedorId=${proveedorId}` : '';

      const [borradoresRes, pendientesRes, enCursoRes, completadasRes] = await Promise.all([
        fetch(`/api/compras/ordenes-compra?estado=BORRADOR&limit=1${provParam}`),
        fetch(`/api/compras/ordenes-compra?estado=PENDIENTE_APROBACION&limit=1${provParam}`),
        fetch(`/api/compras/ordenes-compra?estado=CONFIRMADA&limit=1${provParam}`),
        fetch(`/api/compras/ordenes-compra?estado=COMPLETADA&limit=1${provParam}`),
      ]);

      const [borradores, pendientes, enCurso, completadas] = await Promise.all([
        borradoresRes.json(),
        pendientesRes.json(),
        enCursoRes.json(),
        completadasRes.json(),
      ]);

      // Contar atrasadas con query dedicada (en vez de cargar todos los registros)
      let atrasadas = 0;
      const atrasadasRes = await fetch(`/api/compras/ordenes-compra?countAtrasadas=true${provParam}`);
      if (atrasadasRes.ok) {
        const atrasadasData = await atrasadasRes.json();
        atrasadas = atrasadasData.atrasadas || 0;
      }

      setKpis({
        borradores: borradores.pagination?.total || 0,
        pendientesAprobacion: pendientes.pagination?.total || 0,
        enCurso: enCurso.pagination?.total || 0,
        completadas: completadas.pagination?.total || 0,
        atrasadas,
      });
    } catch (error) {
      console.error('Error loading KPIs:', error);
    }
  };

  const handleDelete = async () => {
    if (!ordenToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/compras/ordenes-compra/${ordenToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success(`Orden ${ordenToDelete.numero} eliminada`);
        loadOrdenes();
        loadKPIs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al eliminar la orden');
      }
    } catch (error) {
      console.error('Error deleting orden:', error);
      toast.error('Error al eliminar la orden');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setOrdenToDelete(null);
    }
  };

  const handleCancelOC = async () => {
    if (!ordenToCancel || !cancelMotivo.trim()) {
      toast.error('Debe ingresar un motivo de cancelación');
      return;
    }

    setCanceling(true);
    try {
      const response = await fetch(`/api/compras/ordenes-compra/${ordenToCancel.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: cancelMotivo }),
      });

      if (response.ok) {
        toast.success(`Orden ${ordenToCancel.numero} cancelada`);
        loadOrdenes();
        loadKPIs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al cancelar la orden');
      }
    } catch (error) {
      console.error('Error canceling orden:', error);
      toast.error('Error al cancelar la orden');
    } finally {
      setCanceling(false);
      setCancelDialogOpen(false);
      setOrdenToCancel(null);
      setCancelMotivo('');
    }
  };

  const openCancelDialog = (orden: OrdenCompra) => {
    setOrdenToCancel(orden);
    setCancelMotivo('');
    setCancelDialogOpen(true);
  };

  const openCompletarModal = (orden: OrdenCompra) => {
    setOrdenToCompletar(orden);
    setCompletarModalOpen(true);
  };

  const openDetailModal = (ordenId: number) => {
    setSelectedOrdenId(ordenId);
    setIsDetailModalOpen(true);
  };

  const openEditModal = (ordenId: number) => {
    setEditingOrdenId(ordenId);
    setIsFormModalOpen(true);
  };

  const openNewModal = () => {
    setEditingOrdenId(undefined);
    setIsFormModalOpen(true);
  };

  const openDeleteDialog = (orden: OrdenCompra) => {
    setOrdenToDelete(orden);
    setDeleteDialogOpen(true);
  };

  const formatCurrency = (amount: number, currency: string = 'ARS') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getDiasAtraso = (fechaEntrega: string | null, estado: string): number | null => {
    if (!fechaEntrega) return null;
    if (['COMPLETADA', 'CANCELADA'].includes(estado.toUpperCase())) return null;
    const dias = differenceInDays(new Date(), new Date(fechaEntrega));
    return dias > 0 ? dias : null;
  };

  const getEstadoBadge = (estado: string) => {
    const config = ESTADOS_CONFIG[estado as EstadoOC] || ESTADOS_CONFIG.BORRADOR;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} border text-[10px] px-1.5 py-0.5 font-medium`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const canEdit = (estado: string) => {
    const normalizado = (estado || '').toUpperCase().trim();
    return ['BORRADOR', 'RECHAZADA'].includes(normalizado);
  };
  const canDelete = (estado: string) => {
    const normalizado = (estado || '').toUpperCase().trim();
    return ['BORRADOR'].includes(normalizado);
  };
  const canCancel = (estado: string) => {
    const normalizado = (estado || '').toUpperCase().trim();
    return !['COMPLETADA', 'CANCELADA'].includes(normalizado);
  };
  const canCompletar = (estado: string) => {
    const normalizado = (estado || '').toUpperCase().trim();
    return ['APROBADA', 'ENVIADA_PROVEEDOR', 'CONFIRMADA', 'PARCIALMENTE_RECIBIDA'].includes(normalizado);
  };
  const canEnviarProveedor = (estado: string) => {
    const normalizado = (estado || '').toUpperCase().trim();
    return ['APROBADA'].includes(normalizado);
  };

  const canCargarRemito = (orden: OrdenCompra) => {
    const normalizado = (orden.estado || '').toUpperCase().trim();
    // Se puede cargar remito cuando la OC está en estos estados
    const estadoPermitido = ['APROBADA', 'ENVIADA_PROVEEDOR', 'CONFIRMADA', 'PARCIALMENTE_RECIBIDA'].includes(normalizado);
    // NO permitir si ya tiene un remito cargado (evitar duplicados)
    const sinRemitos = (orden._count?.goodsReceipts || 0) === 0;
    return estadoPermitido && sinRemitos;
  };

  const tieneRemitos = (orden: OrdenCompra) => {
    return (orden._count?.goodsReceipts || 0) > 0;
  };

  const openCargarRemitoModal = (orden: OrdenCompra) => {
    setOrdenParaRemito(orden);
    setCargarRemitoModalOpen(true);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setFechaDesde('');
    setFechaHasta('');
    setSoloEmergencias(false);
    setSoloAtrasadas(false);
    setPage(1);
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || fechaDesde || fechaHasta || soloEmergencias || soloAtrasadas;

  // Bulk selection functions
  const toggleSelectAll = () => {
    if (selectedIds.size === ordenesFiltradas.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(ordenesFiltradas.map(o => o.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const deletableIds = ordenesFiltradas
      .filter(o => selectedIds.has(o.id) && canDelete(o.estado))
      .map(o => o.id);

    if (deletableIds.length === 0) {
      toast.error('Solo se pueden eliminar órdenes en estado Borrador');
      return;
    }

    if (deletableIds.length !== selectedIds.size) {
      const nonDeletable = selectedIds.size - deletableIds.length;
      if (!confirm(`${nonDeletable} orden(es) no están en estado Borrador y no se eliminarán. ¿Desea continuar con las ${deletableIds.length} restantes?`)) {
        return;
      }
    } else {
      if (!confirm(`¿Está seguro de eliminar ${deletableIds.length} orden(es)?`)) {
        return;
      }
    }

    setIsBulkDeleting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const id of deletableIds) {
      try {
        const response = await fetch(`/api/compras/ordenes-compra/${id}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      }
    }

    setIsBulkDeleting(false);
    setSelectedIds(new Set());

    if (successCount > 0) {
      toast.success(`${successCount} orden(es) eliminada(s)`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} orden(es) no se pudieron eliminar`);
    }
    loadOrdenes();
    loadKPIs();
  };

  // Clear selection when data changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, statusFilter, searchTerm, fechaDesde, fechaHasta, soloEmergencias, soloAtrasadas]);

  // Filtrar órdenes atrasadas en cliente si está activo
  const ordenesFiltradas = useMemo(() => {
    if (!soloAtrasadas) return ordenes;
    const today = new Date();
    return ordenes.filter(o => {
      if (!o.fechaEntregaEsperada) return false;
      if (['COMPLETADA', 'CANCELADA'].includes(o.estado.toUpperCase())) return false;
      return new Date(o.fechaEntregaEsperada) < today;
    });
  }, [ordenes, soloAtrasadas]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{title}</h2>
          <span className="text-xs text-muted-foreground">
            {total} orden(es)
          </span>
        </div>
        <Button size="sm" onClick={openNewModal}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Orden
        </Button>
      </div>

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
            className={`cursor-pointer transition-all ${statusFilter === 'PENDIENTE_APROBACION' ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
            onClick={() => setStatusFilter(statusFilter === 'PENDIENTE_APROBACION' ? 'all' : 'PENDIENTE_APROBACION')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-yellow-100">
                  <Clock className="w-3.5 h-3.5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.pendientesAprobacion}</p>
                  <p className="text-[10px] text-muted-foreground">Pend. Aprob.</p>
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
                <div className="p-1.5 rounded-md bg-green-100">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.enCurso}</p>
                  <p className="text-[10px] text-muted-foreground">Confirmadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${statusFilter === 'COMPLETADA' ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
            onClick={() => setStatusFilter(statusFilter === 'COMPLETADA' ? 'all' : 'COMPLETADA')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-100">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.completadas}</p>
                  <p className="text-[10px] text-muted-foreground">Completadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${soloAtrasadas ? 'ring-2 ring-red-500' : 'hover:shadow-md'}`}
            onClick={() => setSoloAtrasadas(!soloAtrasadas)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-red-100">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-red-600">{kpis.atrasadas}</p>
                  <p className="text-[10px] text-muted-foreground">Atrasadas</p>
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
            placeholder="Buscar número..."
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

        <div className="flex items-center gap-2">
          <DatePicker
            value={fechaDesde}
            onChange={(date) => { setFechaDesde(date); setPage(1); }}
            className="h-8 text-xs w-[130px]"
            placeholder="Desde"
            clearable
          />
          <span className="text-xs text-muted-foreground">-</span>
          <DatePicker
            value={fechaHasta}
            onChange={(date) => { setFechaHasta(date); setPage(1); }}
            className="h-8 text-xs w-[130px]"
            placeholder="Hasta"
            clearable
          />
        </div>

        <Button
          variant={soloEmergencias ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs"
          onClick={() => { setSoloEmergencias(!soloEmergencias); setPage(1); }}
        >
          <AlertTriangle className="w-3 h-3 mr-1" />
          Emergencias
        </Button>

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

        {/* View Toggle */}
        <div className="flex items-center border rounded-md">
          <Button
            variant={viewModeList === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 px-2 rounded-r-none"
            onClick={() => setViewModeList('table')}
          >
            <LayoutList className="w-4 h-4" />
          </Button>
          <Button
            variant={viewModeList === 'cards' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 px-2 rounded-l-none"
            onClick={() => setViewModeList('cards')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {selectedIds.size} seleccionado(s)
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Deseleccionar
            </Button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="h-7 text-xs"
            onClick={handleBulkDelete}
            disabled={isBulkDeleting}
          >
            {isBulkDeleting ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5 mr-1" />
            )}
            Eliminar seleccionados
          </Button>
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : ordenesFiltradas.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingCart className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No se encontraron órdenes de compra</p>
          {hasActiveFilters && (
            <Button variant="link" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>
      ) : viewModeList === 'cards' ? (
        <>
          {/* Card View */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ordenesFiltradas.map((orden) => {
              const diasAtraso = getDiasAtraso(orden.fechaEntregaEsperada, orden.estado);
              return (
                <Card
                  key={orden.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    selectedIds.has(orden.id) && "ring-2 ring-primary"
                  )}
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedIds.has(orden.id)}
                          onCheckedChange={() => toggleSelect(orden.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div onClick={() => openDetailModal(orden.id)}>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm">{orden.numero}</span>
                            {orden.docType === 'T2' && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-purple-50 text-purple-700 border-purple-200">
                                PPT
                              </Badge>
                            )}
                            {tieneRemitos(orden) && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-green-50 text-green-700 border-green-200">
                                <PackageCheck className="w-2.5 h-2.5 mr-0.5" />
                                R
                              </Badge>
                            )}
                            {orden.esEmergencia && (
                              <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(orden.fechaEmision), 'dd/MM/yyyy', { locale: es })}
                          </p>
                        </div>
                      </div>
                      {getEstadoBadge(orden.estado)}
                    </div>

                    {/* Proveedor */}
                    {!proveedorId && (
                      <div className="flex items-center gap-2 text-sm" onClick={() => openDetailModal(orden.id)}>
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span className="truncate">{orden.proveedor?.name || '-'}</span>
                      </div>
                    )}

                    {/* Total */}
                    <div className="flex items-center justify-between" onClick={() => openDetailModal(orden.id)}>
                      <span className="text-xs text-muted-foreground">{orden._count?.items || 0} items</span>
                      <span className="font-semibold">{formatCurrency(orden.total, orden.moneda)}</span>
                    </div>

                    {/* Fecha Entrega */}
                    {orden.fechaEntregaEsperada && (
                      <div className="flex items-center gap-2 text-xs" onClick={() => openDetailModal(orden.id)}>
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className={diasAtraso ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                          Entrega: {format(new Date(orden.fechaEntregaEsperada), 'dd/MM/yy', { locale: es })}
                        </span>
                        {diasAtraso && (
                          <Badge variant="destructive" className="text-[9px] px-1 py-0">
                            -{diasAtraso}d
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs flex-1"
                        onClick={(e) => { e.stopPropagation(); openDetailModal(orden.id); }}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Ver
                      </Button>
                      {canCompletar(orden.estado) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs flex-1"
                          onClick={(e) => { e.stopPropagation(); openCompletarModal(orden); }}
                        >
                          <FileText className="w-3.5 h-3.5 mr-1" />
                          Factura
                        </Button>
                      )}
                      {canEnviarProveedor(orden.estado) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs flex-1"
                          onClick={(e) => { e.stopPropagation(); openDetailModal(orden.id); }}
                        >
                          <Send className="w-3.5 h-3.5 mr-1" />
                          Enviar
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          {canCargarRemito(orden) && (
                            <DropdownMenuItem onClick={() => openCargarRemitoModal(orden)}>
                              <PackageCheck className="w-3.5 h-3.5 mr-2" />
                              Cargar Remito
                            </DropdownMenuItem>
                          )}
                          {tieneRemitos(orden) && (
                            <DropdownMenuItem
                              className="text-green-600"
                              onClick={() => openDetailModal(orden.id)}
                            >
                              <PackageCheck className="w-3.5 h-3.5 mr-2" />
                              Ver Remito ({orden._count?.goodsReceipts})
                            </DropdownMenuItem>
                          )}
                          {canEdit(orden.estado) && (
                            <DropdownMenuItem onClick={() => openEditModal(orden.id)}>
                              <Edit className="w-3.5 h-3.5 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          {canCancel(orden.estado) && (
                            <DropdownMenuItem
                              className="text-orange-600 focus:text-orange-600"
                              onClick={() => openCancelDialog(orden)}
                            >
                              <Ban className="w-3.5 h-3.5 mr-2" />
                              Cancelar OC
                            </DropdownMenuItem>
                          )}
                          {canDelete(orden.estado) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => openDeleteDialog(orden)}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* Table View */}
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={ordenesFiltradas.length > 0 && selectedIds.size === ordenesFiltradas.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Seleccionar todos"
                    />
                  </TableHead>
                  <TableHead className="text-xs font-medium w-[120px]">N° OC</TableHead>
                  {!proveedorId && <TableHead className="text-xs font-medium">Proveedor</TableHead>}
                  <TableHead className="text-xs font-medium w-[90px]">Emisión</TableHead>
                  <TableHead className="text-xs font-medium w-[90px]">Entrega</TableHead>
                  <TableHead className="text-xs font-medium w-[100px]">Estado</TableHead>
                  <TableHead className="text-xs font-medium">Items</TableHead>
                  <TableHead className="text-xs font-medium w-[110px] text-right">Total</TableHead>
                  <TableHead className="text-xs font-medium text-right w-[90px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordenesFiltradas.map((orden) => {
                  const diasAtraso = getDiasAtraso(orden.fechaEntregaEsperada, orden.estado);
                  return (
                    <TableRow
                      key={orden.id}
                      className={cn(
                        "hover:bg-muted/30 cursor-pointer",
                        selectedIds.has(orden.id) && "bg-primary/5"
                      )}
                      onClick={() => openDetailModal(orden.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(orden.id)}
                          onCheckedChange={() => toggleSelect(orden.id)}
                          aria-label={`Seleccionar ${orden.numero}`}
                        />
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{orden.numero}</span>
                          {orden.docType === 'T2' && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-purple-50 text-purple-700 border-purple-200">
                              PPT
                            </Badge>
                          )}
                          {tieneRemitos(orden) && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-green-50 text-green-700 border-green-200">
                              <PackageCheck className="w-2.5 h-2.5 mr-0.5" />
                              R
                            </Badge>
                          )}
                          {orden.esEmergencia && (
                            <AlertTriangle className="w-3 h-3 text-orange-500" />
                          )}
                        </div>
                      </TableCell>
                      {!proveedorId && (
                        <TableCell className="text-xs">{orden.proveedor?.name || '-'}</TableCell>
                      )}
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(orden.fechaEmision), 'dd/MM/yy', { locale: es })}
                      </TableCell>
                      <TableCell className="text-xs">
                        {orden.fechaEntregaEsperada ? (
                          <div className="flex items-center gap-1">
                            <span className={diasAtraso ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                              {format(new Date(orden.fechaEntregaEsperada), 'dd/MM/yy', { locale: es })}
                            </span>
                            {diasAtraso && (
                              <Badge variant="destructive" className="text-[9px] px-1 py-0">
                                -{diasAtraso}d
                              </Badge>
                            )}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {getEstadoBadge(orden.estado)}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-0.5">
                          {orden.items && orden.items.length > 0 ? (
                            <>
                              {orden.items.slice(0, 2).map((item, idx) => (
                                <span key={idx} className="text-muted-foreground truncate max-w-[200px]" title={item.descripcion || item.supplierItem?.nombre}>
                                  {item.descripcion || item.supplierItem?.nombre}
                                </span>
                              ))}
                              {(orden._count?.items || 0) > 2 && (
                                <span className="text-muted-foreground/70 text-[10px]">
                                  +{(orden._count?.items || 0) - 2} más
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">{orden._count?.items || 0} item(s)</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-right">
                        {formatCurrency(orden.total, orden.moneda)}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => openDetailModal(orden.id)}>
                              <Eye className="w-3.5 h-3.5 mr-2" />
                              Ver detalle
                            </DropdownMenuItem>
                            {canCargarRemito(orden) && (
                              <DropdownMenuItem onClick={() => openCargarRemitoModal(orden)}>
                                <PackageCheck className="w-3.5 h-3.5 mr-2" />
                                Cargar Remito
                              </DropdownMenuItem>
                            )}
                            {canCompletar(orden.estado) && (
                              <DropdownMenuItem onClick={() => openCompletarModal(orden)}>
                                <FileText className="w-3.5 h-3.5 mr-2" />
                                Cargar Factura
                              </DropdownMenuItem>
                            )}
                            {canEdit(orden.estado) && (
                              <DropdownMenuItem onClick={() => openEditModal(orden.id)}>
                                <Edit className="w-3.5 h-3.5 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {canCancel(orden.estado) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-orange-600 focus:text-orange-600"
                                  onClick={() => openCancelDialog(orden)}
                                >
                                  <Ban className="w-3.5 h-3.5 mr-2" />
                                  Cancelar OC
                                </DropdownMenuItem>
                              </>
                            )}
                            {canDelete(orden.estado) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => openDeleteDialog(orden)}
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-2" />
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
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} de {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-8"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-8"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modales */}
      <OrdenCompraFormModal
        open={isFormModalOpen}
        onOpenChange={(open) => {
          setIsFormModalOpen(open);
          if (!open) setEditingOrdenId(undefined);
        }}
        editingOrdenId={editingOrdenId}
        defaultProveedorId={proveedorId}
        onSuccess={() => {
          loadOrdenes();
          loadKPIs();
          setIsFormModalOpen(false);
        }}
      />

      <OrdenCompraDetailModal
        open={isDetailModalOpen}
        onOpenChange={(open) => {
          setIsDetailModalOpen(open);
          if (!open) setSelectedOrdenId(null);
        }}
        ordenId={selectedOrdenId}
        onEdit={(ordenId) => {
          setIsDetailModalOpen(false);
          openEditModal(ordenId);
        }}
        onRefresh={() => { loadOrdenes(); loadKPIs(); }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar orden de compra?</AlertDialogTitle>
            <AlertDialogDescription>
              Está a punto de eliminar la orden <strong>{ordenToDelete?.numero}</strong>.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel OC Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-orange-500" />
              ¿Cancelar orden de compra?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Está a punto de cancelar la orden <strong>{ordenToCancel?.numero}</strong>.
                  {ordenToCancel?.proveedor?.name && (
                    <span> del proveedor <strong>{ordenToCancel.proveedor.name}</strong></span>
                  )}.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="cancelMotivo">Motivo de cancelación *</Label>
                  <Textarea
                    id="cancelMotivo"
                    value={cancelMotivo}
                    onChange={(e) => setCancelMotivo(e.target.value)}
                    placeholder="Ingrese el motivo de la cancelación..."
                    className="min-h-[80px]"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={canceling}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOC}
              disabled={canceling || !cancelMotivo.trim()}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {canceling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cancelar OC
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Completar OC Modal */}
      {ordenToCompletar && (
        <CompletarOCModal
          open={completarModalOpen}
          onClose={() => {
            setCompletarModalOpen(false);
            setOrdenToCompletar(null);
          }}
          ordenId={ordenToCompletar.id}
          ordenNumero={ordenToCompletar.numero}
          proveedorId={ordenToCompletar.proveedor.id}
          proveedorNombre={ordenToCompletar.proveedor.name}
          total={ordenToCompletar.total}
          moneda={ordenToCompletar.moneda}
          onSuccess={() => {
            loadOrdenes();
            loadKPIs();
            setCompletarModalOpen(false);
            setOrdenToCompletar(null);
          }}
        />
      )}

      {/* Cargar Remito desde OC Modal */}
      {ordenParaRemito && (
        <CargarRemitoDesdeOCModal
          open={cargarRemitoModalOpen}
          onOpenChange={(open) => {
            setCargarRemitoModalOpen(open);
            if (!open) setOrdenParaRemito(null);
          }}
          ordenCompra={{
            id: ordenParaRemito.id,
            numero: ordenParaRemito.numero,
            proveedorId: ordenParaRemito.proveedor.id,
            proveedor: ordenParaRemito.proveedor,
            items: (ordenParaRemito.items || []).map(item => ({
              id: item.id,
              descripcion: item.descripcion,
              cantidad: item.cantidad,
              unidad: item.unidad,
              precioUnitario: item.precioUnitario,
              supplierItemId: item.supplierItem?.id,
              supplierItem: item.supplierItem,
            })),
            docType: ordenParaRemito.docType,
          }}
          onSuccess={() => {
            loadOrdenes();
            loadKPIs();
            setCargarRemitoModalOpen(false);
            setOrdenParaRemito(null);
          }}
        />
      )}
    </div>
  );
}

export default OrdenesCompraList;
