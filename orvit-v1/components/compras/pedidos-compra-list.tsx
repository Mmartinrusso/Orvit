'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SkeletonTable } from '@/components/ui/skeleton-table';
import { usePedidosCompra } from '@/hooks/compras/use-pedidos-compra';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
 ClipboardList,
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
 Send,
 MoreHorizontal,
 FileText,
 RefreshCcw,
 X,
 Package,
 ShoppingCart,
 LayoutGrid,
 LayoutList,
 Calendar,
 User,
 Mic,
 ArrowUpDown,
 ArrowUp,
 ArrowDown,
 Download,
 Copy,
 Zap,
 CalendarClock,
 UserCircle,
 Filter,
 Repeat,
} from 'lucide-react';
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDate } from '@/lib/date-utils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { PedidoCompraFormModal } from './pedido-compra-form-modal';
import { PedidoCompraDetailModal } from './pedido-compra-detail-modal';
import { CrearOCModal } from './crear-oc-modal';
import { VoicePurchaseModal } from './voice-purchase-modal';
import { RecurringOrdersModal } from './recurring-orders-modal';

interface PedidoCompra {
 id: number;
 numero: string;
 titulo: string;
 descripcion?: string;
 estado: string;
 prioridad: string;
 solicitante: {
 id: number;
 name: string;
 };
 departamento?: string;
 fechaNecesidad?: string;
 fechaLimite?: string;
 presupuestoEstimado?: number;
 moneda: string;
 createdAt: string;
 items: any[];
 quotations: any[];
 purchaseOrders: any[];
 _count?: {
 quotations: number;
 };
}

interface KPIs {
 borradores: number;
 enviadas: number;
 enCotizacion: number;
 cotizadas: number;
 enAprobacion: number;
 aprobadas: number;
 enProceso: number;
 completadas: number;
 rechazadas: number;
 canceladas: number;
}

type EstadoPedido =
 | 'BORRADOR'
 | 'ENVIADA'
 | 'EN_COTIZACION'
 | 'COTIZADA'
 | 'EN_APROBACION'
 | 'APROBADA'
 | 'EN_PROCESO'
 | 'COMPLETADA'
 | 'RECHAZADA'
 | 'CANCELADA';

const ESTADOS_CONFIG: Record<EstadoPedido, { label: string; color: string; icon: React.ElementType }> = {
 BORRADOR: { label: 'Borrador', color: 'bg-muted text-foreground ', icon: FileEdit },
 ENVIADA: { label: 'Enviada', color: 'bg-info-muted text-info-muted-foreground ', icon: Send },
 EN_COTIZACION: { label: 'En Cotización', color: 'bg-warning-muted text-warning-muted-foreground ', icon: Clock },
 COTIZADA: { label: 'Cotizada', color: 'bg-accent-purple-muted text-accent-purple-muted-foreground', icon: FileText },
 EN_APROBACION: { label: 'Pend. Aprob.', color: 'bg-warning-muted text-warning-muted-foreground ', icon: AlertTriangle },
 APROBADA: { label: 'Aprobada', color: 'bg-success-muted text-success ', icon: CheckCircle2 },
 EN_PROCESO: { label: 'En Proceso', color: 'bg-accent-cyan-muted text-accent-cyan-muted-foreground', icon: Clock },
 COMPLETADA: { label: 'Completada', color: 'bg-success-muted text-success ', icon: CheckCircle2 },
 RECHAZADA: { label: 'Rechazada', color: 'bg-destructive/10 text-destructive ', icon: XCircle },
 CANCELADA: { label: 'Cancelada', color: 'bg-muted text-muted-foreground dark:text-muted-foreground', icon: XCircle },
};

const PRIORIDAD_CONFIG: Record<string, { label: string; color: string }> = {
 BAJA: { label: 'Baja', color: 'bg-muted text-foreground dark:text-muted-foreground' },
 NORMAL: { label: 'Normal', color: 'bg-info-muted text-info-muted-foreground ' },
 ALTA: { label: 'Alta', color: 'bg-warning-muted text-warning-muted-foreground ' },
 URGENTE: { label: 'Urgente', color: 'bg-destructive/10 text-destructive ' },
};

export function PedidosCompraList() {
 const { hasPermission } = useAuth();
 const confirm = useConfirm();
 const [searchTerm, setSearchTerm] = useState('');
 const [statusFilter, setStatusFilter] = useState<string>('all');
 const [prioridadFilter, setPrioridadFilter] = useState<string>('all');
 const [quickFilter, setQuickFilter] = useState<string>('');
 const [sortBy, setSortBy] = useState<string>('createdAt');
 const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
 const [page, setPage] = useState(1);

 // ─── TanStack Query hook ────────────────────────────────
 const {
 pedidos, total, totalPages, kpis, isLoading: loading, isFetching: refreshing, invalidate: invalidatePedidos,
 } = usePedidosCompra({ page, statusFilter, prioridadFilter, searchTerm, quickFilter, sortBy, sortOrder });

 const [isFormModalOpen, setIsFormModalOpen] = useState(false);
 const [editingPedidoId, setEditingPedidoId] = useState<number | undefined>(undefined);
 const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
 const [selectedPedidoId, setSelectedPedidoId] = useState<number | null>(null);

 // View mode
 const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

 // Bulk selection state
 const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
 const [isDeleting, setIsDeleting] = useState(false);

 const handleRefresh = () => invalidatePedidos();

 const handleEnviar = async (pedido: PedidoCompra) => {
 try {
 const response = await fetch(`/api/compras/pedidos/${pedido.id}/enviar`, {
 method: 'POST'
 });
 if (response.ok) {
 toast.success('Pedido enviado para cotización');
 invalidatePedidos();
 } else {
 const data = await response.json();
 toast.error(data.error || 'Error al enviar el pedido');
 }
 } catch (error) {
 toast.error('Error al enviar el pedido');
 }
 };

 const handleDelete = async (pedido: PedidoCompra) => {
 const ok = await confirm({
 title: 'Eliminar pedido',
 description: '¿Está seguro de eliminar este pedido?',
 confirmText: 'Eliminar',
 variant: 'destructive',
 });
 if (!ok) return;

 try {
 const response = await fetch(`/api/compras/pedidos/${pedido.id}`, {
 method: 'DELETE'
 });
 if (response.ok) {
 toast.success('Pedido eliminado');
 invalidatePedidos();
 } else {
 const data = await response.json();
 toast.error(data.error || 'Error al eliminar el pedido');
 }
 } catch (error) {
 toast.error('Error al eliminar el pedido');
 }
 };

 // Bulk selection functions
 const toggleSelectAll = () => {
 if (selectedIds.size === pedidos.length) {
 setSelectedIds(new Set());
 } else {
 setSelectedIds(new Set(pedidos.map(p => p.id)));
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

 const deletableIds = pedidos
 .filter(p => selectedIds.has(p.id) && p.estado === 'BORRADOR')
 .map(p => p.id);

 if (deletableIds.length === 0) {
 toast.error('Solo se pueden eliminar pedidos en estado Borrador');
 return;
 }

 if (deletableIds.length !== selectedIds.size) {
 const nonDeletable = selectedIds.size - deletableIds.length;
 const ok = await confirm({
 title: 'Eliminar pedidos',
 description: `${nonDeletable} pedido(s) no están en estado Borrador y no se eliminarán. ¿Desea continuar con los ${deletableIds.length} restantes?`,
 confirmText: 'Eliminar',
 variant: 'destructive',
 });
 if (!ok) return;
 } else {
 const ok = await confirm({
 title: 'Eliminar pedidos',
 description: `¿Está seguro de eliminar ${deletableIds.length} pedido(s)?`,
 confirmText: 'Eliminar',
 variant: 'destructive',
 });
 if (!ok) return;
 }

 setIsDeleting(true);
 let successCount = 0;
 let errorCount = 0;

 for (const id of deletableIds) {
 try {
 const response = await fetch(`/api/compras/pedidos/${id}`, {
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

 setIsDeleting(false);
 setSelectedIds(new Set());

 if (successCount > 0) {
 toast.success(`${successCount} pedido(s) eliminado(s)`);
 }
 if (errorCount > 0) {
 toast.error(`${errorCount} pedido(s) no se pudieron eliminar`);
 }
 invalidatePedidos();
 };

 const handleViewDetail = (pedidoId: number) => {
 setSelectedPedidoId(pedidoId);
 setIsDetailModalOpen(true);
 };

 const handleEdit = (pedidoId: number) => {
 setEditingPedidoId(pedidoId);
 setIsFormModalOpen(true);
 };

 const handleCreate = () => {
 setEditingPedidoId(undefined);
 setIsFormModalOpen(true);
 };

 // Modal Crear OC
 const [crearOCModalOpen, setCrearOCModalOpen] = useState(false);
 const [crearOCPedidoId, setCrearOCPedidoId] = useState<number | null>(null);

 // Modal Voice Purchase
 const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

 // Modal Recurring Orders
 const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);

 const handleCrearOC = (pedido: PedidoCompra) => {
 // Verificar que hay cotización seleccionada
 const cotizacionSeleccionada = pedido.quotations?.find(q => q.esSeleccionada);
 if (!cotizacionSeleccionada) {
 toast.error('No hay cotización seleccionada para este pedido');
 return;
 }
 // Abrir modal de crear OC
 setCrearOCPedidoId(pedido.id);
 setCrearOCModalOpen(true);
 };

 // Export to CSV
 const handleExportCSV = () => {
 if (pedidos.length === 0) {
 toast.error('No hay pedidos para exportar');
 return;
 }

 const headers = ['Número', 'Título', 'Estado', 'Prioridad', 'Solicitante', 'Fecha Creación', 'Fecha Necesidad', 'Items'];
 const rows = pedidos.map(p => [
 p.numero,
 p.titulo,
 ESTADOS_CONFIG[p.estado as EstadoPedido]?.label || p.estado,
 PRIORIDAD_CONFIG[p.prioridad]?.label || p.prioridad,
 p.solicitante?.name || '',
 formatDate(p.createdAt),
 p.fechaNecesidad ? formatDate(p.fechaNecesidad) : '',
 p.items?.length || 0
 ]);

 const csvContent = [
 headers.join(','),
 ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
 ].join('\n');

 const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
 const link = document.createElement('a');
 link.href = URL.createObjectURL(blob);
 link.download = `pedidos_compra_${format(new Date(), 'yyyy-MM-dd')}.csv`;
 link.click();
 toast.success('Archivo CSV descargado');
 };

 // Duplicate order
 const handleDuplicate = async (pedido: PedidoCompra) => {
 try {
 toast.loading('Duplicando pedido...', { id: 'duplicate' });
 const response = await fetch(`/api/compras/pedidos/${pedido.id}/duplicate`, {
 method: 'POST'
 });
 if (response.ok) {
 const newPedido = await response.json();
 toast.success(`Pedido duplicado: ${newPedido.numero}`, { id: 'duplicate' });
 invalidatePedidos();
 } else {
 const data = await response.json();
 toast.error(data.error || 'Error al duplicar', { id: 'duplicate' });
 }
 } catch {
 toast.error('Error al duplicar el pedido', { id: 'duplicate' });
 }
 };

 const renderEstadoBadge = (estado: string) => {
 const config = ESTADOS_CONFIG[estado as EstadoPedido] || ESTADOS_CONFIG.BORRADOR;
 const Icon = config.icon;
 return (
 <Badge className={cn(config.color, 'gap-1')}>
 <Icon className="h-3 w-3" />
 {config.label}
 </Badge>
 );
 };

 const renderPrioridadBadge = (prioridad: string) => {
 const config = PRIORIDAD_CONFIG[prioridad] || PRIORIDAD_CONFIG.NORMAL;
 return <Badge className={config.color}>{config.label}</Badge>;
 };

 const totalActivos = kpis.borradores + kpis.enviadas + kpis.enCotizacion + kpis.cotizadas + kpis.enAprobacion + kpis.aprobadas + kpis.enProceso;

 return (
 <div className="w-full p-0">
 {/* Header */}
 <div className="px-4 md:px-6 pt-4 pb-3 border-b border-border">
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
 <div>
 <h1 className="text-xl font-semibold text-foreground">Pedidos de Compra</h1>
 <p className="text-sm text-muted-foreground mt-1">
 Gestiona solicitudes de compra y cotizaciones
 </p>
 </div>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={handleRefresh}
 disabled={refreshing}
 className={cn(
 "inline-flex items-center border border-border rounded-md p-0.5 bg-muted/40 h-7",
 "px-2 text-xs font-normal gap-1.5",
 "hover:bg-muted disabled:opacity-50",
 refreshing && "bg-background shadow-sm"
 )}
 >
 <RefreshCcw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
 Actualizar
 </button>
 <Button
 size="sm"
 variant="outline"
 className="h-7 text-xs"
 onClick={handleExportCSV}
 >
 <Download className="h-3.5 w-3.5 mr-1" />
 Exportar
 </Button>
 <Button
 size="sm"
 variant="outline"
 className="h-7 text-xs"
 onClick={() => setIsRecurringModalOpen(true)}
 >
 <Repeat className="h-3.5 w-3.5 mr-1" />
 Recurrentes
 </Button>
 {hasPermission('compras.pedidos.create') && (
 <Button
 size="sm"
 variant="outline"
 className="h-7 text-xs"
 onClick={() => setIsVoiceModalOpen(true)}
 >
 <Mic className="h-3.5 w-3.5 mr-1" />
 Crear con Voz
 </Button>
 )}
 {hasPermission('compras.pedidos.create') && (
 <Button size="sm" className="h-7 text-xs" onClick={handleCreate}>
 <Plus className="h-3.5 w-3.5 mr-1" />
 Nuevo Pedido
 </Button>
 )}
 </div>
 </div>
 </div>

 {/* KPIs */}
 <div className="px-4 md:px-6 pt-4">
 <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
 <Card
 className="cursor-pointer hover:shadow-md transition-shadow"
 onClick={() => setStatusFilter('BORRADOR')}
 >
 <CardContent className="p-4">
 <div className="flex items-start justify-between">
 <div>
 <p className="text-xs font-medium text-muted-foreground">Borradores</p>
 <p className="text-2xl font-bold mt-1">{kpis.borradores}</p>
 </div>
 <div className="p-2 rounded-lg bg-muted">
 <FileEdit className="h-4 w-4 text-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card
 className="cursor-pointer hover:shadow-md transition-shadow"
 onClick={() => setStatusFilter('EN_COTIZACION')}
 >
 <CardContent className="p-4">
 <div className="flex items-start justify-between">
 <div>
 <p className="text-xs font-medium text-muted-foreground">En Cotización</p>
 <p className="text-2xl font-bold mt-1 text-warning-muted-foreground">{kpis.enCotizacion + kpis.cotizadas}</p>
 </div>
 <div className="p-2 rounded-lg bg-warning-muted ">
 <Clock className="h-4 w-4 text-warning-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card
 className="cursor-pointer hover:shadow-md transition-shadow"
 onClick={() => setStatusFilter('EN_APROBACION')}
 >
 <CardContent className="p-4">
 <div className="flex items-start justify-between">
 <div>
 <p className="text-xs font-medium text-muted-foreground">Pend. Aprobación</p>
 <p className="text-2xl font-bold mt-1 text-warning-muted-foreground">{kpis.enAprobacion}</p>
 </div>
 <div className="p-2 rounded-lg bg-warning-muted ">
 <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card
 className="cursor-pointer hover:shadow-md transition-shadow"
 onClick={() => setStatusFilter('EN_PROCESO')}
 >
 <CardContent className="p-4">
 <div className="flex items-start justify-between">
 <div>
 <p className="text-xs font-medium text-muted-foreground">En Proceso</p>
 <p className="text-2xl font-bold mt-1 text-accent-cyan-muted-foreground">{kpis.enProceso}</p>
 </div>
 <div className="p-2 rounded-lg bg-accent-cyan-muted">
 <ShoppingCart className="h-4 w-4 text-accent-cyan-muted-foreground" />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card
 className="cursor-pointer hover:shadow-md transition-shadow bg-primary/5"
 onClick={() => setStatusFilter('COMPLETADA')}
 >
 <CardContent className="p-4">
 <div className="flex items-start justify-between">
 <div>
 <p className="text-xs font-medium text-muted-foreground">Completadas</p>
 <p className="text-2xl font-bold mt-1 text-primary">{kpis.completadas}</p>
 </div>
 <div className="p-2 rounded-lg bg-primary/10">
 <CheckCircle2 className="h-4 w-4 text-primary" />
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Quick Filters */}
 <div className="flex items-center gap-2 mt-4 flex-wrap">
 <span className="text-xs text-muted-foreground mr-1">
 <Filter className="h-3 w-3 inline mr-1" />
 Filtros rápidos:
 </span>
 <button
 onClick={() => setQuickFilter(quickFilter === 'misPedidos' ? '' : 'misPedidos')}
 className={cn(
 "px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5",
 quickFilter === 'misPedidos'
 ? "bg-primary text-primary-foreground"
 : "bg-muted hover:bg-muted/80 text-muted-foreground"
 )}
 >
 <UserCircle className="h-3 w-3" />
 Mis pedidos
 </button>
 <button
 onClick={() => setQuickFilter(quickFilter === 'pendientesAccion' ? '' : 'pendientesAccion')}
 className={cn(
 "px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5",
 quickFilter === 'pendientesAccion'
 ? "bg-primary text-primary-foreground"
 : "bg-muted hover:bg-muted/80 text-muted-foreground"
 )}
 >
 <Clock className="h-3 w-3" />
 Pendientes
 </button>
 <button
 onClick={() => setQuickFilter(quickFilter === 'venceEstaSemana' ? '' : 'venceEstaSemana')}
 className={cn(
 "px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5",
 quickFilter === 'venceEstaSemana'
 ? "bg-warning-muted0 text-white"
 : "bg-muted hover:bg-muted/80 text-muted-foreground"
 )}
 >
 <CalendarClock className="h-3 w-3" />
 Vence esta semana
 </button>
 <button
 onClick={() => setQuickFilter(quickFilter === 'urgentes' ? '' : 'urgentes')}
 className={cn(
 "px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5",
 quickFilter === 'urgentes'
 ? "bg-destructive/100 text-white"
 : "bg-muted hover:bg-muted/80 text-muted-foreground"
 )}
 >
 <Zap className="h-3 w-3" />
 Urgentes
 </button>
 {quickFilter && (
 <button
 onClick={() => setQuickFilter('')}
 className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
 >
 <X className="h-3 w-3" />
 </button>
 )}
 </div>
 </div>

 {/* Filtros y Tabla */}
 <div className="px-4 md:px-6 pt-4 pb-6">
 <Card>
 <CardHeader className="pb-3">
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
 <div>
 <CardTitle className="text-sm font-medium">Listado de Pedidos</CardTitle>
 <CardDescription className="text-xs">
 {total} pedidos encontrados {quickFilter && `(filtro: ${quickFilter === 'misPedidos' ? 'Mis pedidos' : quickFilter === 'pendientesAccion' ? 'Pendientes' : quickFilter === 'venceEstaSemana' ? 'Vence esta semana' : 'Urgentes'})`}
 </CardDescription>
 </div>
 <div className="flex items-center border rounded-md p-0.5 bg-muted/40">
 <button
 onClick={() => setViewMode('table')}
 className={cn(
 "p-1.5 rounded transition-colors",
 viewMode === 'table' ? "bg-background shadow-sm" : "hover:bg-muted"
 )}
 title="Vista tabla"
 >
 <LayoutList className="h-4 w-4" />
 </button>
 <button
 onClick={() => setViewMode('card')}
 className={cn(
 "p-1.5 rounded transition-colors",
 viewMode === 'card' ? "bg-background shadow-sm" : "hover:bg-muted"
 )}
 title="Vista tarjetas"
 >
 <LayoutGrid className="h-4 w-4" />
 </button>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 {/* Filtros */}
 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50 mb-4">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Buscar por número o título..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-9 h-9 bg-background"
 />
 {searchTerm && (
 <button
 onClick={() => setSearchTerm('')}
 className="absolute right-3 top-1/2 -translate-y-1/2"
 >
 <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
 </button>
 )}
 </div>
 <Select value={statusFilter} onValueChange={setStatusFilter}>
 <SelectTrigger className="w-full sm:w-[180px] h-9 bg-background">
 <SelectValue placeholder="Estado" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todos los estados</SelectItem>
 {Object.entries(ESTADOS_CONFIG).map(([key, config]) => (
 <SelectItem key={key} value={key}>{config.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <Select value={prioridadFilter} onValueChange={setPrioridadFilter}>
 <SelectTrigger className="w-full sm:w-[150px] h-9 bg-background">
 <SelectValue placeholder="Prioridad" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todas</SelectItem>
 {Object.entries(PRIORIDAD_CONFIG).map(([key, config]) => (
 <SelectItem key={key} value={key}>{config.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>

 {/* Ordenar */}
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="outline" size="sm" className="h-9 gap-1.5 bg-background">
 <ArrowUpDown className="h-3.5 w-3.5" />
 <span className="hidden sm:inline">Ordenar</span>
 {sortOrder === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem onClick={() => { setSortBy('createdAt'); setSortOrder('desc'); }}>
 Más recientes {sortBy === 'createdAt' && sortOrder === 'desc' && '✓'}
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => { setSortBy('createdAt'); setSortOrder('asc'); }}>
 Más antiguos {sortBy === 'createdAt' && sortOrder === 'asc' && '✓'}
 </DropdownMenuItem>
 <DropdownMenuSeparator />
 <DropdownMenuItem onClick={() => { setSortBy('prioridad'); setSortOrder('desc'); }}>
 Mayor prioridad {sortBy === 'prioridad' && sortOrder === 'desc' && '✓'}
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => { setSortBy('prioridad'); setSortOrder('asc'); }}>
 Menor prioridad {sortBy === 'prioridad' && sortOrder === 'asc' && '✓'}
 </DropdownMenuItem>
 <DropdownMenuSeparator />
 <DropdownMenuItem onClick={() => { setSortBy('numero'); setSortOrder('desc'); }}>
 Número (desc) {sortBy === 'numero' && sortOrder === 'desc' && '✓'}
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => { setSortBy('numero'); setSortOrder('asc'); }}>
 Número (asc) {sortBy === 'numero' && sortOrder === 'asc' && '✓'}
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>

 {/* Bulk Actions Bar */}
 {selectedIds.size > 0 && (
 <div className="flex items-center justify-between p-3 mb-4 bg-primary/10 rounded-lg border border-primary/20">
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
 {hasPermission('compras.pedidos.delete') && (
 <Button
 variant="destructive"
 size="sm"
 className="h-7 text-xs"
 onClick={handleBulkDelete}
 disabled={isDeleting}
 >
 {isDeleting ? (
 <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
 ) : (
 <Trash2 className="h-3.5 w-3.5 mr-1" />
 )}
 Eliminar seleccionados
 </Button>
 )}
 </div>
 )}

 {/* Vista Tabla */}
 {viewMode === 'table' && (
 loading ? (
 <SkeletonTable rows={5} cols={9} />
 ) : pedidos.length === 0 ? (
 <div className="text-center py-12">
 <ClipboardList className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
 <p className="text-sm font-medium">No hay pedidos de compra</p>
 <p className="text-xs text-muted-foreground mt-1">Crea un nuevo pedido para iniciar el proceso de compra</p>
 </div>
 ) : (
 <div className="rounded-lg border overflow-x-auto">
 <Table>
 <TableHeader>
 <TableRow className="bg-muted/30">
 <TableHead className="w-[40px]">
 <Checkbox
 checked={pedidos.length > 0 && selectedIds.size === pedidos.length}
 onCheckedChange={toggleSelectAll}
 aria-label="Seleccionar todos"
 />
 </TableHead>
 <TableHead className="text-xs">Número</TableHead>
 <TableHead className="text-xs">Título</TableHead>
 <TableHead className="text-xs">Solicitante</TableHead>
 <TableHead className="text-xs">Estado</TableHead>
 <TableHead className="text-xs">Prioridad</TableHead>
 <TableHead className="text-xs">Cotizaciones</TableHead>
 <TableHead className="text-xs">Fecha</TableHead>
 <TableHead className="text-xs text-right">Acciones</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {pedidos.map((pedido) => {
 const canEdit = !['COMPLETADA', 'RECHAZADA', 'CANCELADA'].includes(pedido.estado) && hasPermission('compras.pedidos.edit');
 const canDelete = pedido.estado === 'BORRADOR' && hasPermission('compras.pedidos.delete');
 const canSend = pedido.estado === 'BORRADOR' && hasPermission('compras.pedidos.enviar');

 return (
 <TableRow
 key={pedido.id}
 className={cn(
 "cursor-pointer hover:bg-muted/30",
 selectedIds.has(pedido.id) && "bg-primary/5"
 )}
 onClick={() => handleViewDetail(pedido.id)}
 >
 <TableCell onClick={(e) => e.stopPropagation()}>
 <Checkbox
 checked={selectedIds.has(pedido.id)}
 onCheckedChange={() => toggleSelect(pedido.id)}
 aria-label={`Seleccionar ${pedido.numero}`}
 />
 </TableCell>
 <TableCell className="font-mono font-medium text-sm">{pedido.numero}</TableCell>
 <TableCell className="text-sm">
 <div className="max-w-[200px] truncate" title={pedido.titulo}>
 {pedido.titulo}
 </div>
 </TableCell>
 <TableCell className="text-sm">{pedido.solicitante?.name || '-'}</TableCell>
 <TableCell>{renderEstadoBadge(pedido.estado)}</TableCell>
 <TableCell>{renderPrioridadBadge(pedido.prioridad)}</TableCell>
 <TableCell>
 <div className="flex items-center gap-1 text-sm">
 <FileText className="h-4 w-4 text-muted-foreground" />
 {pedido._count?.quotations || pedido.quotations?.length || 0}
 </div>
 </TableCell>
 <TableCell className="text-sm">
 {format(new Date(pedido.createdAt), 'dd/MM/yy', { locale: es })}
 </TableCell>
 <TableCell className="text-right">
 <div className="flex items-center justify-end gap-1">
 {pedido.estado === 'APROBADA' && hasPermission('compras.cotizaciones.convertir_oc') && (
 <Button
 variant="outline"
 size="sm"
 className="h-7 text-xs px-2"
 onClick={(e) => { e.stopPropagation(); handleCrearOC(pedido); }}
 >
 <FileText className="h-3.5 w-3.5 mr-1" />
 Crear OC
 </Button>
 )}
 <DropdownMenu>
 <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
 <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
 <MoreHorizontal className="h-4 w-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewDetail(pedido.id); }}>
 <Eye className="h-4 w-4 mr-2" />
 Ver Detalle
 </DropdownMenuItem>
 {hasPermission('compras.pedidos.create') && (
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(pedido); }}>
 <Copy className="h-4 w-4 mr-2" />
 Duplicar
 </DropdownMenuItem>
 )}
 {canEdit && (
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(pedido.id); }}>
 <Edit className="h-4 w-4 mr-2" />
 Editar
 </DropdownMenuItem>
 )}
 {canSend && (
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEnviar(pedido); }}>
 <Send className="h-4 w-4 mr-2" />
 Enviar
 </DropdownMenuItem>
 )}
 {canDelete && (
 <>
 <DropdownMenuSeparator />
 <DropdownMenuItem
 onClick={(e) => { e.stopPropagation(); handleDelete(pedido); }}
 className="text-destructive"
 >
 <Trash2 className="h-4 w-4 mr-2" />
 Eliminar
 </DropdownMenuItem>
 </>
 )}
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 </TableCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 </div>
 )
 )}

 {/* Vista Cards */}
 {viewMode === 'card' && (
 <div>
 {loading ? (
 <SkeletonTable rows={5} cols={4} />
 ) : pedidos.length === 0 ? (
 <div className="text-center py-12">
 <ClipboardList className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
 <p className="text-sm font-medium">No hay pedidos de compra</p>
 <p className="text-xs text-muted-foreground mt-1">Crea un nuevo pedido para iniciar el proceso de compra</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
 {pedidos.map((pedido) => {
 const canEdit = !['COMPLETADA', 'RECHAZADA', 'CANCELADA'].includes(pedido.estado) && hasPermission('compras.pedidos.edit');
 const canDelete = pedido.estado === 'BORRADOR' && hasPermission('compras.pedidos.delete');
 const canSend = pedido.estado === 'BORRADOR' && hasPermission('compras.pedidos.enviar');
 const quotationsCount = pedido._count?.quotations || pedido.quotations?.length || 0;

 return (
 <Card
 key={pedido.id}
 className={cn(
 "cursor-pointer hover:shadow-md transition-all",
 selectedIds.has(pedido.id) && "ring-2 ring-primary"
 )}
 >
 <CardContent className="p-4">
 {/* Header */}
 <div className="flex items-start justify-between gap-2 mb-3">
 <div className="flex items-center gap-2 min-w-0 flex-1">
 <Checkbox
 checked={selectedIds.has(pedido.id)}
 onCheckedChange={() => toggleSelect(pedido.id)}
 onClick={(e) => e.stopPropagation()}
 />
 <div className="min-w-0 flex-1" onClick={() => handleViewDetail(pedido.id)}>
 <p className="font-mono font-medium text-sm">{pedido.numero}</p>
 <p className="text-sm truncate mt-0.5" title={pedido.titulo}>
 {pedido.titulo}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-1 shrink-0">
 {pedido.estado === 'APROBADA' && hasPermission('compras.cotizaciones.convertir_oc') && (
 <Button
 variant="outline"
 size="sm"
 className="h-7 text-xs px-2"
 onClick={(e) => { e.stopPropagation(); handleCrearOC(pedido); }}
 >
 <FileText className="h-3.5 w-3.5 mr-1" />
 OC
 </Button>
 )}
 <DropdownMenu>
 <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
 <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
 <MoreHorizontal className="h-4 w-4" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end">
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewDetail(pedido.id); }}>
 <Eye className="h-4 w-4 mr-2" />
 Ver Detalle
 </DropdownMenuItem>
 {hasPermission('compras.pedidos.create') && (
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(pedido); }}>
 <Copy className="h-4 w-4 mr-2" />
 Duplicar
 </DropdownMenuItem>
 )}
 {canEdit && (
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(pedido.id); }}>
 <Edit className="h-4 w-4 mr-2" />
 Editar
 </DropdownMenuItem>
 )}
 {canSend && (
 <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEnviar(pedido); }}>
 <Send className="h-4 w-4 mr-2" />
 Enviar
 </DropdownMenuItem>
 )}
 {canDelete && (
 <>
 <DropdownMenuSeparator />
 <DropdownMenuItem
 onClick={(e) => { e.stopPropagation(); handleDelete(pedido); }}
 className="text-destructive"
 >
 <Trash2 className="h-4 w-4 mr-2" />
 Eliminar
 </DropdownMenuItem>
 </>
 )}
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 </div>

 {/* Badges */}
 <div className="flex flex-wrap gap-1.5 mb-3" onClick={() => handleViewDetail(pedido.id)}>
 {renderEstadoBadge(pedido.estado)}
 {renderPrioridadBadge(pedido.prioridad)}
 </div>

 {/* Info */}
 <div className="space-y-1.5 text-xs text-muted-foreground" onClick={() => handleViewDetail(pedido.id)}>
 <div className="flex items-center gap-1.5">
 <User className="h-3.5 w-3.5" />
 <span className="truncate">{pedido.solicitante?.name || '-'}</span>
 </div>
 <div className="flex items-center gap-1.5">
 <Calendar className="h-3.5 w-3.5" />
 <span>{format(new Date(pedido.createdAt), 'dd/MM/yy', { locale: es })}</span>
 </div>
 <div className="flex items-center gap-1.5">
 <FileText className="h-3.5 w-3.5" />
 <span>{quotationsCount} cotización{quotationsCount !== 1 ? 'es' : ''}</span>
 </div>
 </div>
 </CardContent>
 </Card>
 );
 })}
 </div>
 )}
 </div>
 )}

 {/* Paginación */}
 {totalPages > 1 && (
 <div className="flex items-center justify-between mt-4">
 <p className="text-xs text-muted-foreground">
 Mostrando {pedidos.length} de {total} pedidos
 </p>
 <div className="flex gap-2">
 <Button
 variant="outline"
 size="sm"
 className="h-7"
 onClick={() => setPage(Math.max(1, page - 1))}
 disabled={page === 1}
 >
 <ChevronLeft className="h-4 w-4" />
 </Button>
 <span className="px-3 py-1 text-xs">
 {page} / {totalPages}
 </span>
 <Button
 variant="outline"
 size="sm"
 className="h-7"
 onClick={() => setPage(Math.min(totalPages, page + 1))}
 disabled={page === totalPages}
 >
 <ChevronRight className="h-4 w-4" />
 </Button>
 </div>
 </div>
 )}

 {pedidos.length > 0 && totalPages <= 1 && (
 <p className="text-xs text-muted-foreground mt-3">
 Mostrando {pedidos.length} de {total} pedidos
 </p>
 )}
 </CardContent>
 </Card>
 </div>

 {/* Modales */}
 <PedidoCompraFormModal
 open={isFormModalOpen}
 onClose={() => { setIsFormModalOpen(false); setEditingPedidoId(undefined); }}
 pedidoId={editingPedidoId}
 onSuccess={() => invalidatePedidos()}
 />

 {selectedPedidoId && (
 <PedidoCompraDetailModal
 open={isDetailModalOpen}
 onClose={() => { setIsDetailModalOpen(false); setSelectedPedidoId(null); }}
 pedidoId={selectedPedidoId}
 onUpdate={() => invalidatePedidos()}
 />
 )}

 {/* Modal Crear OC */}
 {crearOCPedidoId && (
 <CrearOCModal
 open={crearOCModalOpen}
 onClose={() => { setCrearOCModalOpen(false); setCrearOCPedidoId(null); }}
 pedidoId={crearOCPedidoId}
 onSuccess={() => invalidatePedidos()}
 />
 )}

 {/* Modal Voice Purchase */}
 <VoicePurchaseModal
 open={isVoiceModalOpen}
 onClose={() => setIsVoiceModalOpen(false)}
 onSuccess={() => invalidatePedidos()}
 />

 {/* Modal Recurring Orders */}
 <RecurringOrdersModal
 open={isRecurringModalOpen}
 onClose={() => setIsRecurringModalOpen(false)}
 onSuccess={() => invalidatePedidos()}
 />
 </div>
 );
}
