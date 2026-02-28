'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { usePermission } from '@/hooks/use-permissions';
import { PermissionGuardRobust } from '@/hooks/use-permissions-robust';
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
import { Skeleton } from '@/components/ui/skeleton';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Calculator,
  FileText,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  RefreshCw,
  MoreHorizontal,
  ArrowRight,
  Download,
  Copy,
  BarChart3,
  CheckSquare,
  Bell,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Users,
  Filter,
  Shield,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useViewMode } from '@/hooks/use-view-mode';
import { CotizacionDetailSheet } from '@/components/ventas/cotizacion-detail-sheet';
import { CotizacionesDashboard } from '@/components/ventas/cotizaciones-dashboard';
import { CotizacionesAlertaBanner, CotizacionesAlertasPopover } from '@/components/ventas/cotizaciones-alertas';
import { QuoteEditorModal } from '@/components/ventas/quote-editor-modal';
import { cn, formatNumber } from '@/lib/utils';
import { useApiClient } from '@/hooks/use-api-client';

// Types
interface Cotizacion {
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
  fechaValidez: string | null;
  estado: string;
  moneda: string;
  subtotal: number;
  total: number;
  _count?: {
    items: number;
  };
}

interface StatsData {
  totales: {
    cantidad: number;
    montoTotal: number;
    promedioMonto: number;
  };
  porEstado: Record<string, number>;
  conversion: {
    enviadas: number;
    aceptadas: number;
    convertidas: number;
    perdidas: number;
    tasaAceptacion: number;
    tasaConversion: number;
    tasaPerdida: number;
  };
  porVencer: {
    cantidad: number;
    items: Array<{
      id: number;
      numero: string;
      cliente: string;
      diasRestantes: number;
      total: number;
    }>;
  };
}

type EstadoCotizacion =
  | 'BORRADOR'
  | 'ENVIADA'
  | 'EN_NEGOCIACION'
  | 'ACEPTADA'
  | 'CONVERTIDA'
  | 'PERDIDA'
  | 'VENCIDA';

const ESTADOS_CONFIG: Record<EstadoCotizacion, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  BORRADOR: { label: 'Borrador', color: 'text-foreground', bgColor: 'bg-muted', icon: FileText },
  ENVIADA: { label: 'Enviada', color: 'text-info-muted-foreground', bgColor: 'bg-info-muted', icon: Send },
  EN_NEGOCIACION: { label: 'Negociación', color: 'text-warning-muted-foreground', bgColor: 'bg-warning-muted', icon: Clock },
  ACEPTADA: { label: 'Aceptada', color: 'text-success', bgColor: 'bg-success-muted', icon: CheckCircle2 },
  CONVERTIDA: { label: 'Convertida', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: ArrowRight },
  PERDIDA: { label: 'Perdida', color: 'text-destructive', bgColor: 'bg-destructive/10', icon: XCircle },
  VENCIDA: { label: 'Vencida', color: 'text-warning-muted-foreground', bgColor: 'bg-warning-muted', icon: Clock },
};

export default function CotizacionesPage() {
  const router = useRouter();
  const { get, post: apiPost, del: apiDel } = useApiClient();

  // Permisos
  const { hasPermission: canCreate } = usePermission('ventas.cotizaciones.create');
  const { hasPermission: canEdit } = usePermission('ventas.cotizaciones.edit');
  const { hasPermission: canDelete } = usePermission('ventas.cotizaciones.delete');
  const { hasPermission: canExport } = usePermission('ventas.cotizaciones.export');
  const { hasPermission: canConvert } = usePermission('ventas.cotizaciones.convert');
  const { hasPermission: canDuplicate } = usePermission('ventas.cotizaciones.duplicate');
  const { hasPermission: canVersion } = usePermission('ventas.cotizaciones.version');
  const { hasPermission: canViewStats } = usePermission('ventas.cotizaciones.stats');
  const { hasPermission: canViewMargins } = usePermission('ventas.margins.view');

  // State
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cotizacionToDelete, setCotizacionToDelete] = useState<Cotizacion | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [convertirDialogOpen, setConvertirDialogOpen] = useState(false);
  const [cotizacionToConvert, setCotizacionToConvert] = useState<Cotizacion | null>(null);
  const [converting, setConverting] = useState(false);

  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [activeTab, setActiveTab] = useState('cotizaciones');

  // Modal para crear/editar cotización
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<any>(null);

  const { mode } = useViewMode();
  const isExtendedMode = mode === 'E';

  // Load data
  useEffect(() => {
    loadCotizaciones();
  }, [page, statusFilter, searchTerm]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadCotizaciones = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (searchTerm) params.append('search', searchTerm);

    const { data } = await get(`/api/ventas/cotizaciones?${params}`);
    if (data) {
      setCotizaciones(data.data || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    }
    setLoading(false);
  };

  const loadStats = async () => {
    setStatsLoading(true);
    const { data } = await get('/api/ventas/cotizaciones/stats?periodo=30d');
    if (data) setStats(data);
    setStatsLoading(false);
  };

  // Handlers
  const handleDelete = async () => {
    if (!cotizacionToDelete) return;

    setDeleting(true);
    const { error } = await apiDel(`/api/ventas/cotizaciones/${cotizacionToDelete.id}`);
    if (!error) {
      toast.success(`Cotización ${cotizacionToDelete.numero} eliminada`);
      loadCotizaciones();
      loadStats();
    }
    setDeleting(false);
    setDeleteDialogOpen(false);
    setCotizacionToDelete(null);
  };

  const handleEnviar = async (id: number) => {
    const { error } = await apiPost(`/api/ventas/cotizaciones/${id}/enviar`, undefined);
    if (!error) {
      toast.success('Cotización enviada al cliente');
      loadCotizaciones();
      loadStats();
    }
  };

  const handleConvertir = (cot: Cotizacion) => {
    setCotizacionToConvert(cot);
    setConvertirDialogOpen(true);
  };

  const doConvertir = async (docType: 'T1' | 'T2') => {
    if (!cotizacionToConvert) return;

    setConverting(true);
    const { error } = await apiPost(`/api/ventas/cotizaciones/${cotizacionToConvert.id}/convertir`, { docType });
    if (!error) {
      toast.success('Cotización convertida en Venta exitosamente');
      loadCotizaciones();
      loadStats();
    }
    setConverting(false);
    setConvertirDialogOpen(false);
    setCotizacionToConvert(null);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('estado', statusFilter);

      // Export uses blob response, use fetch directly with apiRequest for error handling
      const response = await fetch(`/api/ventas/cotizaciones/export?${params}`);
      if (!response.ok) throw new Error('Error al exportar');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cotizaciones-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Archivo exportado correctamente');
    } catch (error) {
      toast.error('Error al exportar cotizaciones');
    } finally {
      setExporting(false);
    }
  };

  const handleDuplicar = async (cot: Cotizacion) => {
    const { data, error } = await apiPost(`/api/ventas/cotizaciones/${cot.id}/duplicar`, undefined);
    if (!error && data) {
      toast.success(`Cotización duplicada: ${data.cotizacion.numero}`);
      loadCotizaciones();
      loadStats();
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = cotizaciones.map(c => c.id);
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkAction = async (accion: 'enviar' | 'eliminar') => {
    if (selectedIds.size === 0) return;

    setBulkLoading(true);
    const { data: result, error } = await apiPost('/api/ventas/cotizaciones/bulk', {
      accion,
      ids: Array.from(selectedIds),
    });

    if (!error && result) {
      if (result.ok) {
        toast.success(`${result.exitosos} cotización(es) procesadas`);
        if (result.fallidos > 0) {
          toast.warning(`${result.fallidos} no se pudieron procesar`);
        }
        setSelectedIds(new Set());
        loadCotizaciones();
        loadStats();
      } else {
        toast.error(result.error || 'Error en acción en lote');
      }
    }
    setBulkLoading(false);
  };

  const handleViewDetail = (cot: Cotizacion) => {
    setSelectedQuoteId(cot.id);
    setDetailSheetOpen(true);
  };

  // Helpers
  const formatCurrency = (amount: number, currency: string = 'ARS') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getDiasVencimiento = (fechaValidez: string | null): number | null => {
    if (!fechaValidez) return null;
    return differenceInDays(new Date(fechaValidez), new Date());
  };

  const getEstadoBadge = (estado: string | undefined) => {
    const config = ESTADOS_CONFIG[(estado || 'BORRADOR') as EstadoCotizacion] || ESTADOS_CONFIG.BORRADOR;
    const Icon = config.icon;
    return (
      <Badge className={cn(config.bgColor, config.color, 'border-0 text-xs px-1.5 py-0.5 font-medium')}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const canEditCot = (estado: string | undefined) => canEdit && ['BORRADOR'].includes(estado?.toUpperCase() || '');
  const canDeleteCot = (estado: string | undefined) => canDelete && ['BORRADOR'].includes(estado?.toUpperCase() || '');
  const canEnviarCot = (estado: string | undefined) => ['BORRADOR'].includes(estado?.toUpperCase() || '');
  const canConvertirCot = (estado: string | undefined) => canConvert && ['ACEPTADA', 'ENVIADA'].includes(estado?.toUpperCase() || '');

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPage(1);
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all';
  const isAllSelected = cotizaciones.length > 0 && selectedIds.size === cotizaciones.length;
  const isSomeSelected = selectedIds.size > 0;

  // Calculate KPIs from stats
  const kpis = useMemo(() => {
    if (!stats) return null;
    return {
      total: stats.totales.cantidad.valor,
      montoTotal: stats.totales.montoTotal.valor,
      tasaAceptacion: stats.conversion.tasaAceptacion.valor,
      porVencer: stats.porVencer.cantidad,
      porEstado: stats.porEstado,
    };
  }, [stats]);

  return (
    <PermissionGuardRobust
      permission={[
        'ventas.cotizaciones.view',
        'VIEW_QUOTES',
        'ventas.ingresar',
        'admin.permissions',
        'ingresar_administracion'
      ]}
      mode="any"
      loading={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Verificando permisos...</p>
          </div>
        </div>
      }
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Calculator className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Acceso Restringido</h2>
            <p className="text-sm text-muted-foreground">No tienes permisos para ver cotizaciones.</p>
            <p className="text-xs text-muted-foreground mt-2">Intenta cerrar sesión y volver a ingresar.</p>
          </div>
        </div>
      }
    >
      <TooltipProvider>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calculator className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">Gestión de Cotizaciones</h1>
                  <p className="text-sm text-muted-foreground">
                    Administra cotizaciones, conversiones y seguimiento de ventas
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CotizacionesAlertasPopover />
                {canExport && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={exporting}
                  >
                    {exporting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Exportar
                  </Button>
                )}
                {canCreate && (
                  <Button size="sm" onClick={() => {
                    setEditingQuote(null);
                    setQuoteModalOpen(true);
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Cotización
                  </Button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="w-full max-w-md justify-start overflow-x-auto">
                <TabsTrigger value="cotizaciones" className="text-xs">
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  Cotizaciones
                </TabsTrigger>
                <TabsTrigger value="dashboard" className="text-xs" disabled={!canViewStats}>
                  <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="alertas" className="text-xs">
                  <Bell className="w-3.5 h-3.5 mr-1.5" />
                  Alertas
                  {stats?.porVencer?.cantidad ? (
                    <Badge variant="destructive" className="ml-1.5 h-5 px-1 text-xs">
                      {stats.porVencer.cantidad}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              </TabsList>

              {/* Tab: Cotizaciones */}
              <TabsContent value="cotizaciones" className="mt-4 space-y-4">
                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Cotizaciones */}
                  <Card className="hover:shadow-md transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="text-2xl font-bold">{statsLoading ? '-' : kpis?.total || 0}</p>
                          <p className="text-xs text-muted-foreground">Total cotizaciones</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Últimos 30 días</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all duration-300"
                            style={{ width: '100%' }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Monto Total */}
                  <Card className="hover:shadow-md transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-success-muted">
                          <DollarSign className="w-4 h-4 text-success" />
                        </div>
                        <div className="flex-1">
                          <p className="text-2xl font-bold">
                            {statsLoading ? '-' : formatCurrency(kpis?.montoTotal || 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">Monto total</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">En cotizaciones activas</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="bg-success h-1.5 rounded-full transition-all duration-300"
                            style={{ width: '75%' }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tasa de Aceptación */}
                  <Card className="hover:shadow-md transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-info-muted">
                          <TrendingUp className="w-4 h-4 text-info-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="text-2xl font-bold">
                            {statsLoading ? '-' : `${formatNumber(Number(kpis?.tasaAceptacion || 0), 1)}%`}
                          </p>
                          <p className="text-xs text-muted-foreground">Tasa aceptación</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Aceptadas / Enviadas</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="bg-info h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(Number(kpis?.tasaAceptacion || 0), 100)}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Por Vencer */}
                  <Card
                    className={cn(
                      'hover:shadow-md transition-all cursor-pointer',
                      (kpis?.porVencer || 0) > 0 && 'border-warning-muted bg-warning-muted/50'
                    )}
                    onClick={() => setActiveTab('alertas')}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={cn('p-2 rounded-lg', (kpis?.porVencer || 0) > 0 ? 'bg-warning-muted' : 'bg-muted')}>
                          <AlertTriangle className={cn('w-4 h-4', (kpis?.porVencer || 0) > 0 ? 'text-warning-muted-foreground' : 'text-muted-foreground')} />
                        </div>
                        <div className="flex-1">
                          <p className={cn('text-2xl font-bold', (kpis?.porVencer || 0) > 0 && 'text-warning-muted-foreground')}>
                            {statsLoading ? '-' : kpis?.porVencer || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">Por vencer (7 días)</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Requieren atención</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div
                            className="bg-warning h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min((kpis?.porVencer || 0) * 10, 100)}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Filtros de estados rápidos */}
                <div className="flex flex-wrap gap-2">
                  {Object.entries(ESTADOS_CONFIG).map(([key, config]) => {
                    const count = kpis?.porEstado?.[key] || 0;
                    const isActive = statusFilter === key;
                    return (
                      <Button
                        key={key}
                        variant={isActive ? 'default' : 'outline'}
                        size="sm"
                        className={cn(
                          'h-7 text-xs gap-1.5',
                          !isActive && config.bgColor,
                          !isActive && config.color,
                          !isActive && 'hover:opacity-80'
                        )}
                        onClick={() => setStatusFilter(isActive ? 'all' : key)}
                      >
                        <config.icon className="w-3 h-3" />
                        {config.label}
                        <Badge
                          variant={isActive ? 'secondary' : 'outline'}
                          className="h-4 px-1 text-xs ml-1"
                        >
                          {count}
                        </Badge>
                      </Button>
                    );
                  })}
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={clearFilters}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Limpiar
                    </Button>
                  )}
                </div>

                {/* Filtros */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por número, cliente..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setPage(1);
                      }}
                      className="pl-8 h-8 text-xs"
                    />
                  </div>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => { loadCotizaciones(); loadStats(); }}
                        disabled={loading}
                      >
                        <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Actualizar</TooltipContent>
                  </Tooltip>

                  <div className="flex-1" />

                  <span className="text-xs text-muted-foreground">
                    {total} cotización(es)
                  </span>
                </div>

                {/* Bulk Actions Bar */}
                {isSomeSelected && (
                  <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <CheckSquare className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{selectedIds.size} seleccionada(s)</span>
                    <div className="flex-1" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkAction('enviar')}
                      disabled={bulkLoading}
                    >
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Enviar
                    </Button>
                    {canDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkAction('eliminar')}
                        disabled={bulkLoading}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Eliminar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}

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
                            <Skeleton className="h-4 w-32 hidden sm:block" />
                            <Skeleton className="h-4 w-20 hidden md:block" />
                            <Skeleton className="h-4 w-16 hidden lg:block" />
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-16 ml-auto" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : cotizaciones.length === 0 ? (
                  <div className="text-center py-12 bg-muted/30 rounded-lg">
                    <Calculator className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium">No se encontraron cotizaciones</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {hasActiveFilters ? 'Intenta cambiar los filtros' : 'Crea tu primera cotización'}
                    </p>
                    {hasActiveFilters ? (
                      <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                        Limpiar filtros
                      </Button>
                    ) : canCreate ? (
                      <Button size="sm" className="mt-4" onClick={() => {
                        setEditingQuote(null);
                        setQuoteModalOpen(true);
                      }}>
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Cotización
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="w-[40px]">
                              <Checkbox
                                checked={isAllSelected}
                                onCheckedChange={handleSelectAll}
                              />
                            </TableHead>
                            <TableHead className="text-xs font-medium w-[130px]">N° Cotización</TableHead>
                            <TableHead className="text-xs font-medium">Cliente</TableHead>
                            <TableHead className="text-xs font-medium w-[100px] hidden lg:table-cell">Vendedor</TableHead>
                            <TableHead className="text-xs font-medium w-[90px] hidden md:table-cell">Fecha</TableHead>
                            <TableHead className="text-xs font-medium w-[90px] hidden sm:table-cell">Validez</TableHead>
                            <TableHead className="text-xs font-medium w-[110px]">Estado</TableHead>
                            <TableHead className="text-xs font-medium w-[60px] text-center hidden lg:table-cell">Items</TableHead>
                            <TableHead className="text-xs font-medium w-[120px] text-right hidden sm:table-cell">Total</TableHead>
                            <TableHead className="text-xs font-medium text-right w-[80px]">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cotizaciones.map((cot) => {
                            const diasVenc = getDiasVencimiento(cot.fechaValidez);
                            const vencida = diasVenc !== null && diasVenc < 0 && !['ACEPTADA', 'CONVERTIDA', 'PERDIDA', 'VENCIDA'].includes(cot.estado || '');
                            const porVencer = diasVenc !== null && diasVenc >= 0 && diasVenc <= 3;
                            const isSelected = selectedIds.has(cot.id);
                            return (
                              <TableRow
                                key={cot.id}
                                className={cn(
                                  'hover:bg-muted/30 cursor-pointer transition-colors',
                                  isSelected && 'bg-primary/5',
                                  vencida && 'bg-destructive/10/50',
                                  porVencer && !vencida && 'bg-warning-muted/50'
                                )}
                                onClick={() => handleViewDetail(cot)}
                              >
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) => handleSelectOne(cot.id, checked as boolean)}
                                  />
                                </TableCell>
                                <TableCell className="text-xs">
                                  <span className="font-medium font-mono">{cot.numero}</span>
                                </TableCell>
                                <TableCell className="text-xs">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                                      <span className="text-xs font-medium text-primary">
                                        {(cot.client?.legalName || cot.client?.name || 'C')[0].toUpperCase()}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="truncate max-w-[180px] block">
                                        {cot.client?.legalName || cot.client?.name || '-'}
                                      </span>
                                      {/* Mobile-only: show total below client name */}
                                      <span className="text-xs text-muted-foreground sm:hidden">
                                        {formatCurrency(Number(cot.total), cot.moneda)}
                                      </span>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                                  {cot.seller?.name || '-'}
                                </TableCell>
                                <TableCell className="text-xs hidden md:table-cell">
                                  {cot.fechaEmision ? format(new Date(cot.fechaEmision), 'dd/MM/yy', { locale: es }) : '-'}
                                </TableCell>
                                <TableCell className="text-xs hidden sm:table-cell">
                                  <div className={cn(
                                    vencida && 'text-destructive font-medium',
                                    porVencer && !vencida && 'text-warning-muted-foreground font-medium'
                                  )}>
                                    {cot.fechaValidez ? format(new Date(cot.fechaValidez), 'dd/MM/yy', { locale: es }) : '-'}
                                    {(vencida || porVencer) && diasVenc !== null && (
                                      <span className="ml-1 text-xs">
                                        ({diasVenc < 0 ? `${Math.abs(diasVenc)}d atrás` : `${diasVenc}d`})
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>{getEstadoBadge(cot.estado)}</TableCell>
                                <TableCell className="text-center text-xs hidden lg:table-cell">{cot._count?.items || 0}</TableCell>
                                <TableCell className="text-right text-xs font-medium hidden sm:table-cell">
                                  {formatCurrency(Number(cot.total), cot.moneda)}
                                </TableCell>
                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                        <MoreHorizontal className="w-4 h-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleViewDetail(cot)}>
                                        <Eye className="w-4 h-4 mr-2" />
                                        Ver detalle
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => window.open(`/api/ventas/cotizaciones/${cot.id}/pdf`, '_blank')}>
                                        <FileText className="w-4 h-4 mr-2" />
                                        Ver PDF
                                      </DropdownMenuItem>
                                      {canDuplicate && (
                                        <DropdownMenuItem onClick={() => handleDuplicar(cot)}>
                                          <Copy className="w-4 h-4 mr-2" />
                                          Duplicar
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuSeparator />
                                      {canEditCot(cot.estado) && (
                                        <DropdownMenuItem onClick={() => {
                                          setSelectedQuoteId(cot.id);
                                          setDetailSheetOpen(true);
                                        }}>
                                          <Edit className="w-4 h-4 mr-2" />
                                          Editar
                                        </DropdownMenuItem>
                                      )}
                                      {canEnviarCot(cot.estado) && (
                                        <DropdownMenuItem onClick={() => handleEnviar(cot.id)}>
                                          <Send className="w-4 h-4 mr-2" />
                                          Enviar al cliente
                                        </DropdownMenuItem>
                                      )}
                                      {canConvertirCot(cot.estado) && (
                                        <DropdownMenuItem onClick={() => handleConvertir(cot)}>
                                          <ArrowRight className="w-4 h-4 mr-2" />
                                          Convertir en Venta
                                        </DropdownMenuItem>
                                      )}
                                      {canDeleteCot(cot.estado) && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            className="text-destructive"
                                            onClick={() => {
                                              setCotizacionToDelete(cot);
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
              </TabsContent>

              {/* Tab: Dashboard */}
              <TabsContent value="dashboard" className="mt-4">
                <CotizacionesDashboard />
              </TabsContent>

              {/* Tab: Alertas */}
              <TabsContent value="alertas" className="mt-4 space-y-4">
                <CotizacionesAlertaBanner />

                {/* Cotizaciones por vencer */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-4 h-4 text-warning-muted-foreground" />
                      <h3 className="font-medium">Cotizaciones por vencer (próximos 7 días)</h3>
                      <Badge variant="outline" className="ml-auto">
                        {stats?.porVencer?.cantidad || 0} cotizaciones
                      </Badge>
                    </div>

                    {statsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : stats?.porVencer?.items?.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success" />
                        <p className="text-sm">No hay cotizaciones por vencer</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {stats?.porVencer?.items?.map((item) => (
                          <div
                            key={item.id}
                            className={cn(
                              'flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors',
                              item.diasRestantes <= 1 && 'border-destructive/30 bg-destructive/10/50',
                              item.diasRestantes > 1 && item.diasRestantes <= 3 && 'border-warning-muted bg-warning-muted/50'
                            )}
                            onClick={() => {
                              setSelectedQuoteId(item.id);
                              setDetailSheetOpen(true);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'p-2 rounded-lg',
                                item.diasRestantes <= 1 ? 'bg-destructive/10' : 'bg-warning-muted'
                              )}>
                                <Clock className={cn(
                                  'w-4 h-4',
                                  item.diasRestantes <= 1 ? 'text-destructive' : 'text-warning-muted-foreground'
                                )} />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{item.numero}</p>
                                <p className="text-xs text-muted-foreground">{item.cliente}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">{formatCurrency(item.total)}</p>
                              <Badge
                                variant={item.diasRestantes <= 1 ? 'destructive' : 'outline'}
                                className="text-xs"
                              >
                                {item.diasRestantes === 0 ? 'Vence hoy' :
                                  item.diasRestantes === 1 ? 'Vence mañana' :
                                    `${item.diasRestantes} días`}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Delete Dialog */}
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar cotización?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Se eliminará permanentemente la cotización
                  <span className="font-medium"> {cotizacionToDelete?.numero}</span>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-destructive hover:bg-destructive"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Eliminar'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Conversion Dialog */}
          <AlertDialog open={convertirDialogOpen} onOpenChange={setConvertirDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Convertir en Venta</AlertDialogTitle>
                <AlertDialogDescription>
                  Convertir cotización <span className="font-medium">{cotizacionToConvert?.numero}</span> en venta.
                  Seleccione el tipo de documento:
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-col gap-3 py-4">
                <Button
                  variant="outline"
                  className="h-auto py-3 justify-start hover:bg-muted/50"
                  onClick={() => doConvertir('T1')}
                  disabled={converting}
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Factura A/B/C</span>
                    <span className="text-xs text-muted-foreground">Documento fiscal formal</span>
                  </div>
                </Button>
                {isExtendedMode && (
                  <Button
                    variant="outline"
                    className="h-auto py-3 justify-start border-dashed hover:bg-muted/50"
                    onClick={() => doConvertir('T2')}
                    disabled={converting}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Sin factura</span>
                      <span className="text-xs text-muted-foreground">Documento no fiscal</span>
                    </div>
                  </Button>
                )}
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={converting}>Cancelar</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Detail Sheet */}
          {selectedQuoteId && (
            <CotizacionDetailSheet
              quoteId={selectedQuoteId}
              open={detailSheetOpen}
              onClose={() => {
                setDetailSheetOpen(false);
                setSelectedQuoteId(null);
              }}
              onUpdate={() => {
                loadCotizaciones();
                loadStats();
              }}
            />
          )}

          {/* Modal para crear cotización */}
          <QuoteEditorModal
            open={quoteModalOpen}
            onOpenChange={setQuoteModalOpen}
            onQuoteCreated={() => {
              setQuoteModalOpen(false);
              loadCotizaciones();
              loadStats();
              toast.success('Cotización creada exitosamente');
            }}
          />
        </div>
      </TooltipProvider>
    </PermissionGuardRobust>
  );
}
