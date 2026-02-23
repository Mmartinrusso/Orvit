'use client';

import { formatNumber } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  MoreVertical,
  Download,
  FileText,
  PlayCircle,
  Ban,
  AlertTriangle,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  Edit,
  Save,
  FileSpreadsheet,
  Settings,
} from 'lucide-react';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useAuth } from '@/contexts/AuthContext';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

type LoadOrderStatus = 'PENDIENTE' | 'CARGANDO' | 'CARGADA' | 'DESPACHADA' | 'CANCELADA';

interface LoadOrderItem {
  id: number;
  secuencia: number;
  productId: number;
  cantidad: number;
  cantidadCargada: number | null;
  pesoUnitario: number | null;
  volumenUnitario: number | null;
  posicion: string | null;
  motivoDiferencia: string | null;
  product: {
    id: number;
    name: string;
    codigo: string;
  };
  saleItem: {
    id: number;
    cantidad: number;
  } | null;
}

interface LoadOrder {
  id: number;
  numero: string;
  fecha: string | null;
  estado: LoadOrderStatus;
  vehiculo: string | null;
  vehiculoPatente: string | null;
  chofer: string | null;
  choferDNI: string | null;
  transportista: string | null;
  pesoTotal: number | null;
  volumenTotal: number | null;
  confirmadoAt: string | null;
  observaciones: string | null;
  sale: {
    id: number;
    numero: string;
    client: {
      id: number;
      name: string | null;
      legalName: string | null;
    };
  };
  delivery: {
    id: number;
    numero: string;
    estado: string;
  } | null;
  _count: {
    items: number;
  };
}

const STATUS_CONFIG: Record<
  LoadOrderStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-muted text-foreground', icon: Clock },
  CARGANDO: { label: 'En Carga', color: 'bg-warning-muted text-warning-muted-foreground', icon: Package },
  CARGADA: { label: 'Cargada', color: 'bg-info-muted text-info-muted-foreground', icon: CheckCircle2 },
  DESPACHADA: { label: 'Despachada', color: 'bg-success-muted text-success', icon: Truck },
  CANCELADA: { label: 'Cancelada', color: 'bg-destructive/10 text-destructive', icon: XCircle },
};

export default function LoadOrdersPage() {
  const showConfirm = useConfirm();
  const router = useRouter();
  const { mode: viewMode } = useViewMode();
  const { user } = useAuth();

  // State
  const [loadOrders, setLoadOrders] = useState<LoadOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pendientes: 0, enCarga: 0, cargadas: 0, despachadas: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // Sorting
  const [sortBy, setSortBy] = useState<'numero' | 'fecha' | 'estado'>('numero');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Modals
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<LoadOrder | null>(null);
  const [confirmItems, setConfirmItems] = useState<LoadOrderItem[]>([]);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Detail modal
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<LoadOrder | null>(null);
  const [detailItems, setDetailItems] = useState<LoadOrderItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<LoadOrder | null>(null);

  // Bulk actions
  const [bulkActionOpen, setBulkActionOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'start' | 'cancel' | 'export'>('start');

  // Edit modal
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<LoadOrder | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    vehiculo: '',
    vehiculoPatente: '',
    chofer: '',
    choferDNI: '',
    transportista: '',
    observaciones: '',
  });

  // Additional filters
  const [clienteFilter, setClienteFilter] = useState<string>('');
  const [transportistaFilter, setTransportistaFilter] = useState<string>('');
  const [choferFilter, setChoferFilter] = useState<string>('');

  // Filter options (loaded from API)
  const [clientesOptions, setClientesOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [transportistasOptions, setTransportistasOptions] = useState<string[]>([]);
  const [choferesOptions, setChoferesOptions] = useState<Array<{ name: string; dni: string | null }>>([]);

  // Refresh loading
  const [refreshing, setRefreshing] = useState(false);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    numero: true,
    pedido: true,
    cliente: true,
    fecha: true,
    transporte: true,
    pesoVol: true,
    items: true,
    estado: true,
  });

  // Fetch load orders
  const fetchLoadOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        viewMode: viewMode || 'S',
        limit: pageSize.toString(),
        offset: ((currentPage - 1) * pageSize).toString(),
        ...(search && { search }),
        ...(estadoFilter && { estado: estadoFilter }),
        ...(fechaDesde && { fechaDesde }),
        ...(fechaHasta && { fechaHasta }),
        ...(clienteFilter && { clienteId: clienteFilter }),
        ...(transportistaFilter && { transportista: transportistaFilter }),
        ...(choferFilter && { chofer: choferFilter }),
      });

      const response = await fetch(`/api/ventas/ordenes-carga?${params}`);
      if (!response.ok) throw new Error('Error al cargar ordenes');

      const { data, pagination } = await response.json();

      // Sort client-side (could be moved to backend)
      const sorted = [...data].sort((a, b) => {
        if (sortBy === 'numero') {
          return sortOrder === 'asc'
            ? a.numero.localeCompare(b.numero)
            : b.numero.localeCompare(a.numero);
        }
        if (sortBy === 'fecha') {
          const dateA = a.fecha ? new Date(a.fecha).getTime() : 0;
          const dateB = b.fecha ? new Date(b.fecha).getTime() : 0;
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        }
        if (sortBy === 'estado') {
          return sortOrder === 'asc'
            ? a.estado.localeCompare(b.estado)
            : b.estado.localeCompare(a.estado);
        }
        return 0;
      });

      setLoadOrders(sorted);
      setTotalCount(pagination.total);

      // Calculate stats
      const pendientes = data.filter((o: LoadOrder) => o.estado === 'PENDIENTE').length;
      const enCarga = data.filter((o: LoadOrder) => o.estado === 'CARGANDO').length;
      const cargadas = data.filter((o: LoadOrder) => o.estado === 'CARGADA').length;
      const despachadas = data.filter((o: LoadOrder) => o.estado === 'DESPACHADA').length;

      setStats({ pendientes, enCarga, cargadas, despachadas });
    } catch (error) {
      console.error('Error fetching load orders:', error);
      toast.error('Error al cargar las órdenes de carga');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoadOrders();
  }, [viewMode, currentPage, pageSize, search, estadoFilter, fechaDesde, fechaHasta, sortBy, sortOrder, clienteFilter, transportistaFilter, choferFilter]);

  // Load filter options on mount
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        // Load clients
        const clientesRes = await fetch(`/api/ventas/ordenes-carga/filtros?tipo=clientes&viewMode=${viewMode}`);
        if (clientesRes.ok) {
          const clientes = await clientesRes.json();
          setClientesOptions(clientes);
        }

        // Load transportistas
        const transportistasRes = await fetch(`/api/ventas/ordenes-carga/filtros?tipo=transportistas&viewMode=${viewMode}`);
        if (transportistasRes.ok) {
          const transportistas = await transportistasRes.json();
          setTransportistasOptions(transportistas);
        }

        // Load choferes
        const choferesRes = await fetch(`/api/ventas/ordenes-carga/filtros?tipo=choferes&viewMode=${viewMode}`);
        if (choferesRes.ok) {
          const choferes = await choferesRes.json();
          setChoferesOptions(choferes);
        }
      } catch (error) {
        console.error('Error loading filter options:', error);
      }
    };

    loadFilterOptions();
  }, [viewMode]);

  // Handle confirm load - fetch items
  const handleOpenConfirm = async (order: LoadOrder) => {
    setSelectedOrder(order);
    setConfirmDialogOpen(true);
    setItemsLoading(true);

    try {
      const response = await fetch(`/api/ventas/ordenes-carga/${order.id}?viewMode=${viewMode}`);
      if (!response.ok) throw new Error('Error al cargar items');

      const data = await response.json();
      setConfirmItems(data.items || []);
    } catch (error) {
      console.error('Error loading items:', error);
      toast.error('Error al cargar los items');
    } finally {
      setItemsLoading(false);
    }
  };

  // Handle confirm submission
  const handleConfirmLoad = async () => {
    if (!selectedOrder) return;

    // Validate all items have cantidadCargada
    const hasInvalidItems = confirmItems.some(
      (item) => item.cantidadCargada === null || item.cantidadCargada < 0
    );

    if (hasInvalidItems) {
      toast.error('Todas las cantidades cargadas deben ser válidas');
      return;
    }

    // Check for differences and require motivo
    const hasDifferences = confirmItems.some(
      (item) => item.cantidadCargada !== item.cantidad
    );

    if (hasDifferences) {
      const allHaveMotivo = confirmItems
        .filter((item) => item.cantidadCargada !== item.cantidad)
        .every((item) => item.motivoDiferencia && item.motivoDiferencia.trim() !== '');

      if (!allHaveMotivo) {
        toast.error('Debe especificar el motivo para las diferencias en cantidades');
        return;
      }
    }

    // Check total weight/volume warnings
    const totalPeso = confirmItems.reduce(
      (sum, item) => sum + ((item.pesoUnitario || 0) * (item.cantidadCargada || 0)),
      0
    );
    const totalVolumen = confirmItems.reduce(
      (sum, item) => sum + ((item.volumenUnitario || 0) * (item.cantidadCargada || 0)),
      0
    );

    if (totalPeso > 30000) {
      const ok = await showConfirm({
        title: 'Advertencia de peso',
        description: `El peso total (${totalPeso.toFixed(0)} kg) excede el límite recomendado de 30,000 kg. ¿Desea continuar de todos modos?`,
        confirmText: 'Confirmar',
        variant: 'default',
      });
      if (!ok) return;
    }

    if (totalVolumen > 90) {
      const ok = await showConfirm({
        title: 'Advertencia de volumen',
        description: `El volumen total (${totalVolumen.toFixed(2)} m³) excede el límite recomendado de 90 m³. ¿Desea continuar de todos modos?`,
        confirmText: 'Confirmar',
        variant: 'default',
      });
      if (!ok) return;
    }

    setConfirmLoading(true);

    try {
      const response = await fetch(`/api/ventas/ordenes-carga/${selectedOrder.id}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: confirmItems.map((item) => ({
            id: item.id,
            cantidadCargada: item.cantidadCargada,
            motivoDiferencia: item.motivoDiferencia || null,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al confirmar carga');
      }

      toast.success('Carga confirmada correctamente');
      setConfirmDialogOpen(false);
      setSelectedOrder(null);
      setConfirmItems([]);
      fetchLoadOrders();
    } catch (error: any) {
      console.error('Error confirming load:', error);
      toast.error(error.message || 'Error al confirmar la carga');
    } finally {
      setConfirmLoading(false);
    }
  };

  // Handle view detail
  const handleViewDetail = async (order: LoadOrder) => {
    setDetailOrder(order);
    setDetailDialogOpen(true);
    setDetailLoading(true);

    try {
      const response = await fetch(`/api/ventas/ordenes-carga/${order.id}?viewMode=${viewMode}`);
      if (!response.ok) throw new Error('Error al cargar detalle');

      const data = await response.json();
      setDetailItems(data.items || []);
    } catch (error) {
      console.error('Error loading detail:', error);
      toast.error('Error al cargar el detalle');
    } finally {
      setDetailLoading(false);
    }
  };

  // Navigate to detail page
  const handleNavigateToDetail = (orderId: number) => {
    router.push(`/administracion/ventas/ordenes-carga/${orderId}`);
  };

  // Handle start loading
  const handleStartLoading = async (orderId: number) => {
    try {
      const response = await fetch(`/api/ventas/ordenes-carga/${orderId}/iniciar-carga`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al iniciar carga');
      }

      toast.success('Carga iniciada correctamente');
      fetchLoadOrders();
    } catch (error: any) {
      console.error('Error starting load:', error);
      toast.error(error.message || 'Error al iniciar la carga');
    }
  };

  // Handle dispatch
  const handleDispatch = async (orderId: number) => {
    try {
      const response = await fetch(`/api/ventas/ordenes-carga/${orderId}/despachar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al despachar');
      }

      toast.success('Orden despachada correctamente');
      fetchLoadOrders();
    } catch (error: any) {
      console.error('Error dispatching:', error);
      toast.error(error.message || 'Error al despachar');
    }
  };

  // Handle cancel
  const handleOpenCancel = (order: LoadOrder) => {
    setOrderToCancel(order);
    setCancelReason('');
    setCancelDialogOpen(true);
  };

  const handleCancelOrder = async () => {
    if (!orderToCancel) return;

    if (!cancelReason || cancelReason.trim() === '') {
      toast.error('Debe especificar un motivo de cancelación');
      return;
    }

    setCancelLoading(true);

    try {
      const response = await fetch(`/api/ventas/ordenes-carga/${orderToCancel.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: cancelReason }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al cancelar');
      }

      toast.success('Orden cancelada correctamente');
      setCancelDialogOpen(false);
      setOrderToCancel(null);
      setCancelReason('');
      fetchLoadOrders();
    } catch (error: any) {
      console.error('Error canceling:', error);
      toast.error(error.message || 'Error al cancelar la orden');
    } finally {
      setCancelLoading(false);
    }
  };

  // Handle PDF download
  const handleDownloadPDF = async (orderId: number, numero: string) => {
    try {
      const response = await fetch(`/api/ventas/ordenes-carga/${orderId}/pdf?viewMode=${viewMode}`);
      if (!response.ok) throw new Error('Error al generar PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OC-${numero}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('PDF descargado correctamente');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Error al descargar el PDF');
    }
  };

  // Bulk actions
  const handleBulkAction = async () => {
    if (selectedIds.length === 0) {
      toast.error('Debe seleccionar al menos una orden');
      return;
    }

    try {
      let accion = '';
      let payload: any = { loadOrderIds: selectedIds };

      if (bulkAction === 'start') {
        accion = 'bulk_start_loading';
      } else if (bulkAction === 'cancel') {
        const motivo = window.prompt('Ingrese el motivo de cancelación:');
        if (!motivo) return;
        accion = 'bulk_cancel';
        payload.motivo = motivo;
      } else if (bulkAction === 'export') {
        accion = 'bulk_export';
      }

      const response = await fetch('/api/ventas/ordenes-carga/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, ...payload }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error en operación masiva');
      }

      if (bulkAction === 'export') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ordenes-carga-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Exportación completada');
      } else {
        const result = await response.json();
        toast.success(result.message);
        setSelectedIds([]);
        fetchLoadOrders();
      }

      setBulkActionOpen(false);
    } catch (error: any) {
      console.error('Error in bulk action:', error);
      toast.error(error.message || 'Error en operación masiva');
    }
  };

  // Pagination helpers
  const totalPages = Math.ceil(totalCount / pageSize);
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const handleToggleSelectAll = () => {
    if (selectedIds.length === loadOrders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(loadOrders.map((o) => o.id));
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const clearFilters = () => {
    setSearch('');
    setEstadoFilter('');
    setFechaDesde('');
    setFechaHasta('');
    setClienteFilter('');
    setTransportistaFilter('');
    setChoferFilter('');
    setCurrentPage(1);
  };

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLoadOrders();
    setRefreshing(false);
    toast.success('Datos actualizados');
  };

  // Handle edit modal open
  const handleOpenEdit = (order: LoadOrder) => {
    setOrderToEdit(order);
    setEditForm({
      vehiculo: order.vehiculo || '',
      vehiculoPatente: order.vehiculoPatente || '',
      chofer: order.chofer || '',
      choferDNI: order.choferDNI || '',
      transportista: order.transportista || '',
      observaciones: order.observaciones || '',
    });
    setEditDialogOpen(true);
  };

  // Handle edit save
  const handleEditSave = async () => {
    if (!orderToEdit) return;

    setEditLoading(true);

    try {
      const response = await fetch(`/api/ventas/ordenes-carga/${orderToEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar');
      }

      toast.success('Orden actualizada correctamente');
      setEditDialogOpen(false);
      setOrderToEdit(null);
      fetchLoadOrders();
    } catch (error: any) {
      console.error('Error updating order:', error);
      toast.error(error.message || 'Error al actualizar la orden');
    } finally {
      setEditLoading(false);
    }
  };

  // Handle general export
  const handleGeneralExport = async () => {
    try {
      const params = new URLSearchParams({
        viewMode: viewMode || 'S',
        ...(search && { search }),
        ...(estadoFilter && { estado: estadoFilter }),
        ...(fechaDesde && { fechaDesde }),
        ...(fechaHasta && { fechaHasta }),
        ...(clienteFilter && { clienteId: clienteFilter }),
        ...(transportistaFilter && { transportista: transportistaFilter }),
        ...(choferFilter && { chofer: choferFilter }),
      });

      const response = await fetch(`/api/ventas/ordenes-carga/export?${params}`);
      if (!response.ok) throw new Error('Error al exportar');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ordenes-carga-completo-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Exportación completada');
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Error al exportar');
    }
  };

  return (
    <PermissionGuard permission="ventas.ordenes.view">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Órdenes de Carga</h1>
            <p className="text-muted-foreground">Gestión de órdenes de carga y despacho</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            <Button variant="outline" onClick={handleGeneralExport}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Exportar Todo
            </Button>
            <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
            {selectedIds.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="default">
                    Acciones ({selectedIds.length})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onClick={() => {
                      setBulkAction('start');
                      setBulkActionOpen(true);
                    }}
                  >
                    <PlayCircle className="w-4 h-4 mr-2" />
                    Iniciar carga
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setBulkAction('cancel');
                      setBulkActionOpen(true);
                    }}
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Cancelar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setBulkAction('export');
                      handleBulkAction();
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar seleccionados
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setEstadoFilter('PENDIENTE')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendientes}</div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setEstadoFilter('CARGANDO')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">En Carga</CardTitle>
              <Package className="h-4 w-4 text-warning-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enCarga}</div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setEstadoFilter('CARGADA')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Cargadas</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-info-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.cargadas}</div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setEstadoFilter('DESPACHADA')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Despachadas</CardTitle>
              <Truck className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.despachadas}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Filtros</CardTitle>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-2" />
                  Limpiar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label>Buscar</Label>
                  <Input
                    placeholder="Número, pedido, cliente, chofer..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>

                <div>
                  <Label>Estado</Label>
                  <Select
                    value={estadoFilter}
                    onValueChange={(value) => {
                      setEstadoFilter(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                      <SelectItem value="CARGANDO">En Carga</SelectItem>
                      <SelectItem value="CARGADA">Cargada</SelectItem>
                      <SelectItem value="DESPACHADA">Despachada</SelectItem>
                      <SelectItem value="CANCELADA">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Fecha Desde</Label>
                  <Input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => {
                      setFechaDesde(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>

                <div>
                  <Label>Fecha Hasta</Label>
                  <Input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => {
                      setFechaHasta(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Cliente</Label>
                  <Select
                    value={clienteFilter}
                    onValueChange={(value) => {
                      setClienteFilter(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los clientes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      {clientesOptions.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id.toString()}>
                          {cliente.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Transportista</Label>
                  <Select
                    value={transportistaFilter}
                    onValueChange={(value) => {
                      setTransportistaFilter(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los transportistas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      {transportistasOptions.map((trans) => (
                        <SelectItem key={trans} value={trans}>
                          {trans}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Chofer</Label>
                  <Select
                    value={choferFilter}
                    onValueChange={(value) => {
                      setChoferFilter(value);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los choferes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      {choferesOptions.map((chofer) => (
                        <SelectItem key={chofer.name} value={chofer.name}>
                          {chofer.name} {chofer.dni && `(DNI: ${chofer.dni})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : loadOrders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No se encontraron órdenes de carga</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedIds.length === loadOrders.length}
                          onCheckedChange={handleToggleSelectAll}
                        />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => {
                          setSortBy('numero');
                          setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                        }}
                      >
                        Número {sortBy === 'numero' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => {
                          setSortBy('fecha');
                          setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                        }}
                      >
                        Fecha {sortBy === 'fecha' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead>Transporte</TableHead>
                      <TableHead className="text-right">Peso/Vol</TableHead>
                      <TableHead className="text-center">Items</TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => {
                          setSortBy('estado');
                          setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                        }}
                      >
                        Estado {sortBy === 'estado' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadOrders.map((order) => {
                      const StatusIcon = STATUS_CONFIG[order.estado].icon;
                      return (
                        <TableRow
                          key={order.id}
                          className="cursor-pointer hover:bg-muted"
                          onClick={(e) => {
                            // Don't navigate if clicking checkbox or action button
                            if (
                              (e.target as HTMLElement).closest('button') ||
                              (e.target as HTMLElement).closest('[role="checkbox"]')
                            ) {
                              return;
                            }
                            handleNavigateToDetail(order.id);
                          }}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.includes(order.id)}
                              onCheckedChange={() => handleToggleSelect(order.id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{order.numero}</TableCell>
                          <TableCell>{order.sale.numero}</TableCell>
                          <TableCell>
                            {order.sale.client.legalName || order.sale.client.name}
                          </TableCell>
                          <TableCell>
                            {order.fecha
                              ? format(new Date(order.fecha), 'dd/MM/yyyy', { locale: es })
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {order.vehiculo && (
                                <div className="font-medium">{order.vehiculo}</div>
                              )}
                              {order.chofer && (
                                <div className="text-muted-foreground">{order.chofer}</div>
                              )}
                              {!order.vehiculo && !order.chofer && '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="text-sm">
                              {order.pesoTotal && (
                                <div>{formatNumber(order.pesoTotal, 0)} kg</div>
                              )}
                              {order.volumenTotal && (
                                <div className="text-muted-foreground">{formatNumber(order.volumenTotal, 2)} m³</div>
                              )}
                              {!order.pesoTotal && !order.volumenTotal && '-'}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{order._count.items}</TableCell>
                          <TableCell>
                            <Badge className={STATUS_CONFIG[order.estado].color}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {STATUS_CONFIG[order.estado].label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleNavigateToDetail(order.id)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Ver detalle
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleViewDetail(order)}>
                                  <FileText className="w-4 h-4 mr-2" />
                                  Vista rápida
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadPDF(order.id, order.numero)}>
                                  <Download className="w-4 h-4 mr-2" />
                                  Descargar PDF
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {order.estado === 'PENDIENTE' && (
                                  <DropdownMenuItem onClick={() => handleOpenEdit(order)}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Editar orden
                                  </DropdownMenuItem>
                                )}
                                {order.estado === 'PENDIENTE' && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleStartLoading(order.id)}>
                                      <PlayCircle className="w-4 h-4 mr-2" />
                                      Iniciar carga
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenConfirm(order)}>
                                      <CheckCircle2 className="w-4 h-4 mr-2" />
                                      Confirmar carga
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {order.estado === 'CARGANDO' && (
                                  <DropdownMenuItem onClick={() => handleOpenConfirm(order)}>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Confirmar carga
                                  </DropdownMenuItem>
                                )}
                                {order.estado === 'CARGADA' && (
                                  <DropdownMenuItem onClick={() => handleDispatch(order.id)}>
                                    <Truck className="w-4 h-4 mr-2" />
                                    Despachar
                                  </DropdownMenuItem>
                                )}
                                {['PENDIENTE', 'CARGANDO'].includes(order.estado) && !order.confirmadoAt && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleOpenCancel(order)}
                                      className="text-destructive"
                                    >
                                      <Ban className="w-4 h-4 mr-2" />
                                      Cancelar orden
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

                {/* Pagination */}
                <div className="flex items-center justify-between px-2 py-4 border-t">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      Mostrando {((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, totalCount)} de {totalCount}
                    </span>
                    <Select
                      value={pageSize.toString()}
                      onValueChange={(value) => {
                        setPageSize(parseInt(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={!canGoPrevious}
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => prev - 1)}
                      disabled={!canGoPrevious}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => prev + 1)}
                      disabled={!canGoNext}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={!canGoNext}
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Confirm Load Dialog - Enhanced */}
        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Confirmar Carga - {selectedOrder?.numero}</DialogTitle>
              <DialogDescription>
                Ingrese las cantidades reales cargadas. Esta acción decrementará el stock y no se puede deshacer.
              </DialogDescription>
            </DialogHeader>

            {/* Warning Box */}
            <div className="bg-warning-muted border border-warning-muted rounded-lg p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-warning-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="text-sm text-warning-muted-foreground">
                <p className="font-semibold mb-1">⚠️ ATENCIÓN: Esta acción es irreversible</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Se decrementará el stock de los productos</li>
                  <li>Se habilitará la generación de remito y factura</li>
                  <li>Se afectará la cuenta corriente del cliente</li>
                  <li>Las cantidades diferentes requieren justificación</li>
                </ul>
              </div>
            </div>

            {itemsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {confirmItems.map((item) => {
                  const isDifferent = item.cantidadCargada !== item.cantidad;
                  const totalPeso = (item.pesoUnitario || 0) * (item.cantidadCargada || 0);
                  const totalVolumen = (item.volumenUnitario || 0) * (item.cantidadCargada || 0);

                  return (
                    <div
                      key={item.id}
                      className={`border rounded-lg p-4 ${
                        isDifferent ? 'bg-warning-muted border-warning-muted' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">{item.product.name}</p>
                          <p className="text-sm text-muted-foreground">Código: {item.product.codigo}</p>
                          <p className="text-sm text-muted-foreground">
                            Cant. Pedido: {item.cantidad} | Stock disponible: {item.saleItem?.cantidad || 0}
                          </p>
                        </div>
                        {isDifferent && (
                          <Badge variant="outline" className="bg-warning-muted text-warning-muted-foreground">
                            Diferencia
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label>Cantidad Cargada *</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.cantidadCargada || ''}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              setConfirmItems((prev) =>
                                prev.map((i) =>
                                  i.id === item.id ? { ...i, cantidadCargada: value } : i
                                )
                              );
                            }}
                            className={isDifferent ? 'border-warning-muted' : ''}
                          />
                          {totalPeso > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Peso: {formatNumber(totalPeso, 2)} kg
                            </p>
                          )}
                          {totalVolumen > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Volumen: {formatNumber(totalVolumen, 3)} m³
                            </p>
                          )}
                        </div>

                        {isDifferent && (
                          <div className="md:col-span-2">
                            <Label>Motivo de la Diferencia *</Label>
                            <Textarea
                              placeholder="Explique por qué la cantidad cargada difiere de la pedida..."
                              value={item.motivoDiferencia || ''}
                              onChange={(e) => {
                                setConfirmItems((prev) =>
                                  prev.map((i) =>
                                    i.id === item.id
                                      ? { ...i, motivoDiferencia: e.target.value }
                                      : i
                                  )
                                );
                              }}
                              rows={2}
                              className="border-warning-muted"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Totals Summary */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">Resumen Total</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Items</p>
                      <p className="text-lg font-semibold">{confirmItems.length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Peso Total</p>
                      <p className="text-lg font-semibold">
                        {formatNumber(confirmItems
                          .reduce(
                            (sum, item) =>
                              sum + (item.pesoUnitario || 0) * (item.cantidadCargada || 0),
                            0
                          ))}{' '}
                        kg
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Volumen Total</p>
                      <p className="text-lg font-semibold">
                        {formatNumber(confirmItems
                          .reduce(
                            (sum, item) =>
                              sum + (item.volumenUnitario || 0) * (item.cantidadCargada || 0),
                            0
                          ), 2)}{' '}
                        m³
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirmDialogOpen(false)}
                disabled={confirmLoading}
              >
                Cancelar
              </Button>
              <Button onClick={handleConfirmLoad} disabled={confirmLoading || itemsLoading}>
                {confirmLoading ? 'Confirmando...' : 'Confirmar Carga'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog - Quick View */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalle de Orden - {detailOrder?.numero}</DialogTitle>
              <DialogDescription>
                Vista rápida de la orden de carga
              </DialogDescription>
            </DialogHeader>

            {detailLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : detailOrder ? (
              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <Badge className={STATUS_CONFIG[detailOrder.estado].color}>
                    {STATUS_CONFIG[detailOrder.estado].label}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadPDF(detailOrder.id, detailOrder.numero)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Descargar PDF
                  </Button>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Pedido</Label>
                    <p className="font-medium">{detailOrder.sale.numero}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Cliente</Label>
                    <p className="font-medium">
                      {detailOrder.sale.client.legalName || detailOrder.sale.client.name}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Fecha</Label>
                    <p className="font-medium">
                      {detailOrder.fecha
                        ? format(new Date(detailOrder.fecha), 'dd/MM/yyyy', { locale: es })
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Vehículo</Label>
                    <p className="font-medium">{detailOrder.vehiculo || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Chofer</Label>
                    <p className="font-medium">{detailOrder.chofer || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Transportista</Label>
                    <p className="font-medium">{detailOrder.transportista || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Peso Total</Label>
                    <p className="font-medium">
                      {detailOrder.pesoTotal ? `${formatNumber(detailOrder.pesoTotal, 0)} kg` : '-'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Volumen Total</Label>
                    <p className="font-medium">
                      {detailOrder.volumenTotal ? `${formatNumber(detailOrder.volumenTotal, 2)} m³` : '-'}
                    </p>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <Label className="text-muted-foreground mb-2 block">Items ({detailItems.length})</Label>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          {detailOrder.confirmadoAt && (
                            <TableHead className="text-right">Cargada</TableHead>
                          )}
                          <TableHead className="text-right">Posición</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.product.name}</p>
                                <p className="text-xs text-muted-foreground">{item.product.codigo}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{item.cantidad}</TableCell>
                            {detailOrder.confirmadoAt && (
                              <TableCell className="text-right">
                                <span
                                  className={
                                    item.cantidadCargada !== item.cantidad
                                      ? 'font-semibold text-warning-muted-foreground'
                                      : ''
                                  }
                                >
                                  {item.cantidadCargada || 0}
                                </span>
                              </TableCell>
                            )}
                            <TableCell className="text-right">
                              {item.posicion || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Observations */}
                {detailOrder.observaciones && (
                  <div>
                    <Label className="text-muted-foreground">Observaciones</Label>
                    <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg">
                      {detailOrder.observaciones}
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDetailDialogOpen(false)}
              >
                Cerrar
              </Button>
              {detailOrder && (
                <Button onClick={() => handleNavigateToDetail(detailOrder.id)}>
                  Ver Detalle Completo
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Dialog */}
        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar Orden de Carga</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Está seguro de que desea cancelar la orden {orderToCancel?.numero}? Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label>Motivo de Cancelación *</Label>
              <Textarea
                placeholder="Ingrese el motivo de la cancelación..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="mt-2"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelLoading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleCancelOrder();
                }}
                disabled={cancelLoading || !cancelReason.trim()}
                className="bg-destructive hover:bg-destructive"
              >
                {cancelLoading ? 'Cancelando...' : 'Confirmar Cancelación'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Action Confirmation */}
        <AlertDialog open={bulkActionOpen} onOpenChange={setBulkActionOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {bulkAction === 'start' && 'Iniciar carga masiva'}
                {bulkAction === 'cancel' && 'Cancelar órdenes masivamente'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {bulkAction === 'start' &&
                  `Se iniciarán ${selectedIds.length} órdenes de carga. ¿Desea continuar?`}
                {bulkAction === 'cancel' &&
                  `Se cancelarán ${selectedIds.length} órdenes de carga. ¿Desea continuar?`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkAction}>
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Orden de Carga - {orderToEdit?.numero}</DialogTitle>
              <DialogDescription>
                Actualice la información de transporte y observaciones
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Vehículo</Label>
                  <Input
                    placeholder="Ej: Camión Ford F-150"
                    value={editForm.vehiculo}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, vehiculo: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label>Patente</Label>
                  <Input
                    placeholder="Ej: ABC 123"
                    value={editForm.vehiculoPatente}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, vehiculoPatente: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Chofer</Label>
                  <Input
                    placeholder="Nombre del chofer"
                    value={editForm.chofer}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, chofer: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label>DNI Chofer</Label>
                  <Input
                    placeholder="Ej: 12345678"
                    value={editForm.choferDNI}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, choferDNI: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div>
                <Label>Transportista</Label>
                <Input
                  placeholder="Empresa de transporte"
                  value={editForm.transportista}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, transportista: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label>Observaciones</Label>
                <Textarea
                  placeholder="Notas adicionales sobre la orden..."
                  value={editForm.observaciones}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, observaciones: e.target.value }))
                  }
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={editLoading}
              >
                Cancelar
              </Button>
              <Button onClick={handleEditSave} disabled={editLoading}>
                <Save className="w-4 h-4 mr-2" />
                {editLoading ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}
