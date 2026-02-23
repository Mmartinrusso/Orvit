'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { SkeletonTable } from '@/components/ui/skeleton-table';
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
import {
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
  Calculator,
  Download,
  Copy,
  BarChart3,
  CheckSquare,
  FileX,
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
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CotizacionDetailSheet } from './cotizacion-detail-sheet';
import { CotizacionesDashboard } from './cotizaciones-dashboard';
import { CotizacionesAlertaBanner } from './cotizaciones-alertas';

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

interface KPIs {
  borradores: number;
  enviadas: number;
  aceptadas: number;
  perdidas: number;
  vencidas: number;
}

type EstadoCotizacion =
  | 'BORRADOR'
  | 'ENVIADA'
  | 'EN_NEGOCIACION'
  | 'ACEPTADA'
  | 'CONVERTIDA'
  | 'PERDIDA'
  | 'VENCIDA';

const ESTADOS_CONFIG: Record<EstadoCotizacion, { label: string; color: string; icon: React.ElementType }> = {
  BORRADOR: { label: 'Borrador', color: 'bg-muted text-foreground border-border', icon: FileText },
  ENVIADA: { label: 'Enviada', color: 'bg-info-muted text-info-muted-foreground border-info-muted', icon: Send },
  EN_NEGOCIACION: { label: 'Negociación', color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted', icon: Clock },
  ACEPTADA: { label: 'Aceptada', color: 'bg-success-muted text-success border-success-muted', icon: CheckCircle2 },
  CONVERTIDA: { label: 'Convertida', color: 'bg-primary/10 text-primary border-primary/30', icon: ArrowRight },
  PERDIDA: { label: 'Perdida', color: 'bg-destructive/10 text-destructive border-destructive/30', icon: XCircle },
  VENCIDA: { label: 'Vencida', color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted', icon: Clock },
};

interface CotizacionesListProps {
  clienteId?: number;
  limit?: number;
  showKPIs?: boolean;
  title?: string;
}

export function CotizacionesList({
  clienteId,
  limit = 20,
  showKPIs = true,
  title = 'Cotizaciones',
}: CotizacionesListProps) {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs>({
    borradores: 0,
    enviadas: 0,
    aceptadas: 0,
    perdidas: 0,
    vencidas: 0,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cotizacionToDelete, setCotizacionToDelete] = useState<Cotizacion | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Conversion dialog state
  const [convertirDialogOpen, setConvertirDialogOpen] = useState(false);
  const [cotizacionToConvert, setCotizacionToConvert] = useState<Cotizacion | null>(null);
  const [converting, setConverting] = useState(false);

  // Detail sheet state
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState('lista');

  // ViewMode for T2 option visibility
  const { mode } = useViewMode();
  const isExtendedMode = mode === 'E';

  useEffect(() => {
    loadCotizaciones();
  }, [page, statusFilter, searchTerm, clienteId]);

  useEffect(() => {
    if (showKPIs) {
      loadKPIs();
    }
  }, [clienteId, showKPIs]);

  const loadCotizaciones = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (clienteId) params.append('clienteId', clienteId.toString());
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/ventas/cotizaciones?${params}`);
      if (response.ok) {
        const data = await response.json();
        setCotizaciones(data.data || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error loading cotizaciones:', error);
      toast.error('Error al cargar las cotizaciones');
    } finally {
      setLoading(false);
    }
  };

  const loadKPIs = async () => {
    try {
      const clientParam = clienteId ? `&clienteId=${clienteId}` : '';

      const [borradoresRes, enviadasRes, aceptadasRes, perdidasRes] = await Promise.all([
        fetch(`/api/ventas/cotizaciones?status=BORRADOR&limit=1${clientParam}`),
        fetch(`/api/ventas/cotizaciones?status=ENVIADA&limit=1${clientParam}`),
        fetch(`/api/ventas/cotizaciones?status=ACEPTADA&limit=1${clientParam}`),
        fetch(`/api/ventas/cotizaciones?status=PERDIDA&limit=1${clientParam}`),
      ]);

      const [borradores, enviadas, aceptadas, perdidas] = await Promise.all([
        borradoresRes.json(),
        enviadasRes.json(),
        aceptadasRes.json(),
        perdidasRes.json(),
      ]);

      // Calcular vencidas
      let vencidas = 0;
      const allCotRes = await fetch(`/api/ventas/cotizaciones?limit=500${clientParam}`);
      if (allCotRes.ok) {
        const allData = await allCotRes.json();
        const today = new Date();
        vencidas = (allData.data || []).filter((c: Cotizacion) => {
          if (!c.fechaValidez) return false;
          if (['ACEPTADA', 'CONVERTIDA', 'PERDIDA', 'VENCIDA'].includes(c.estado?.toUpperCase() || '')) return false;
          return new Date(c.fechaValidez) < today;
        }).length;
      }

      setKpis({
        borradores: borradores.pagination?.total || 0,
        enviadas: enviadas.pagination?.total || 0,
        aceptadas: aceptadas.pagination?.total || 0,
        perdidas: perdidas.pagination?.total || 0,
        vencidas,
      });
    } catch (error) {
      console.error('Error loading KPIs:', error);
    }
  };

  const handleDelete = async () => {
    if (!cotizacionToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/ventas/cotizaciones/${cotizacionToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success(`Cotización ${cotizacionToDelete.numero} eliminada`);
        loadCotizaciones();
        loadKPIs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al eliminar la cotización');
      }
    } catch (error) {
      console.error('Error deleting cotización:', error);
      toast.error('Error al eliminar la cotización');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setCotizacionToDelete(null);
    }
  };

  const handleEnviar = async (id: number) => {
    try {
      const response = await fetch(`/api/ventas/cotizaciones/${id}/enviar`, {
        method: 'POST',
      });
      if (response.ok) {
        toast.success('Cotización enviada al cliente');
        loadCotizaciones();
        loadKPIs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al enviar');
      }
    } catch (error) {
      toast.error('Error al enviar la cotización');
    }
  };

  // Open conversion dialog
  const handleConvertir = (cot: Cotizacion) => {
    setCotizacionToConvert(cot);
    setConvertirDialogOpen(true);
  };

  // Perform the actual conversion with selected docType
  const doConvertir = async (docType: 'T1' | 'T2') => {
    if (!cotizacionToConvert) return;

    setConverting(true);
    try {
      const response = await fetch(`/api/ventas/cotizaciones/${cotizacionToConvert.id}/convertir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType }),
      });
      if (response.ok) {
        toast.success('Cotización convertida a orden de venta');
        loadCotizaciones();
        loadKPIs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al convertir');
      }
    } catch (error) {
      toast.error('Error al convertir la cotización');
    } finally {
      setConverting(false);
      setConvertirDialogOpen(false);
      setCotizacionToConvert(null);
    }
  };

  // Export to Excel
  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('estado', statusFilter);
      if (clienteId) params.append('clienteId', clienteId.toString());

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

  // Duplicate quotation
  const handleDuplicar = async (cot: Cotizacion) => {
    try {
      const response = await fetch(`/api/ventas/cotizaciones/${cot.id}/duplicar`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(`Cotización duplicada: ${data.cotizacion.numero}`);
        loadCotizaciones();
        loadKPIs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al duplicar');
      }
    } catch (error) {
      toast.error('Error al duplicar la cotización');
    }
  };

  // Bulk selection handlers
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

  // Bulk actions
  const handleBulkAction = async (accion: 'enviar' | 'eliminar') => {
    if (selectedIds.size === 0) return;

    setBulkLoading(true);
    try {
      const response = await fetch('/api/ventas/cotizaciones/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion,
          ids: Array.from(selectedIds),
        }),
      });

      const result = await response.json();

      if (result.ok) {
        toast.success(`${result.exitosos} cotización(es) procesadas`);
        if (result.fallidos > 0) {
          toast.warning(`${result.fallidos} no se pudieron procesar`);
        }
        setSelectedIds(new Set());
        loadCotizaciones();
        loadKPIs();
      } else {
        toast.error(result.error || 'Error en acción en lote');
      }
    } catch (error) {
      toast.error('Error al procesar acción en lote');
    } finally {
      setBulkLoading(false);
    }
  };

  // Open detail sheet
  const handleViewDetail = (cot: Cotizacion) => {
    setSelectedQuoteId(cot.id);
    setDetailSheetOpen(true);
  };

  const formatCurrency = (amount: number, currency: string = 'ARS') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getDiasVencimiento = (fechaValidez: string | null): number | null => {
    if (!fechaValidez) return null;
    const dias = differenceInDays(new Date(fechaValidez), new Date());
    return dias;
  };

  const getEstadoBadge = (estado: string | undefined) => {
    const config = ESTADOS_CONFIG[(estado || 'BORRADOR') as EstadoCotizacion] || ESTADOS_CONFIG.BORRADOR;
    const Icon = config.icon;
    return (
      <Badge className={cn(config.color, 'border text-xs px-1.5 py-0.5 font-medium')}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const canEdit = (estado: string | undefined) => ['BORRADOR'].includes(estado?.toUpperCase() || '');
  const canDelete = (estado: string | undefined) => ['BORRADOR'].includes(estado?.toUpperCase() || '');
  const canEnviar = (estado: string | undefined) => ['BORRADOR'].includes(estado?.toUpperCase() || '');
  const canConvertir = (estado: string | undefined) => ['ACEPTADA', 'ENVIADA'].includes(estado?.toUpperCase() || '');

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPage(1);
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all';

  const isAllSelected = cotizaciones.length > 0 && selectedIds.size === cotizaciones.length;
  const isSomeSelected = selectedIds.size > 0;

  return (
    <div className="space-y-4">
      {/* Alert Banner */}
      <CotizacionesAlertaBanner />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calculator className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{title}</h2>
          <span className="text-xs text-muted-foreground">
            {total} cotización(es)
          </span>
        </div>
        <div className="flex items-center gap-2">
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
          <Button size="sm" onClick={() => window.location.href = '/administracion/ventas/cotizaciones/nueva'}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Cotización
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="lista" className="text-xs">
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Lista
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="text-xs">
            <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
            Dashboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <CotizacionesDashboard />
        </TabsContent>

        <TabsContent value="lista" className="mt-0 space-y-4">

      {/* KPIs */}
      {showKPIs && (
        <div className="grid grid-cols-5 gap-3">
          <Card
            className={cn('cursor-pointer transition-all', statusFilter === 'BORRADOR' ? 'ring-2 ring-primary' : 'hover:shadow-md')}
            onClick={() => setStatusFilter(statusFilter === 'BORRADOR' ? 'all' : 'BORRADOR')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-muted">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.borradores}</p>
                  <p className="text-xs text-muted-foreground">Borradores</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn('cursor-pointer transition-all', statusFilter === 'ENVIADA' ? 'ring-2 ring-primary' : 'hover:shadow-md')}
            onClick={() => setStatusFilter(statusFilter === 'ENVIADA' ? 'all' : 'ENVIADA')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-info-muted">
                  <Send className="w-3.5 h-3.5 text-info-muted-foreground" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.enviadas}</p>
                  <p className="text-xs text-muted-foreground">Enviadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn('cursor-pointer transition-all', statusFilter === 'ACEPTADA' ? 'ring-2 ring-primary' : 'hover:shadow-md')}
            onClick={() => setStatusFilter(statusFilter === 'ACEPTADA' ? 'all' : 'ACEPTADA')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-success-muted">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.aceptadas}</p>
                  <p className="text-xs text-muted-foreground">Aceptadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn('cursor-pointer transition-all', statusFilter === 'PERDIDA' ? 'ring-2 ring-primary' : 'hover:shadow-md')}
            onClick={() => setStatusFilter(statusFilter === 'PERDIDA' ? 'all' : 'PERDIDA')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-destructive/10">
                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.perdidas}</p>
                  <p className="text-xs text-muted-foreground">Perdidas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn('cursor-pointer transition-all', statusFilter === 'VENCIDA' ? 'ring-2 ring-primary' : 'hover:shadow-md')}
            onClick={() => setStatusFilter(statusFilter === 'VENCIDA' ? 'all' : 'VENCIDA')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-warning-muted">
                  <Clock className="w-3.5 h-3.5 text-warning-muted-foreground" />
                </div>
                <div>
                  <p className="text-xl font-bold text-warning-muted-foreground">{kpis.vencidas}</p>
                  <p className="text-xs text-muted-foreground">Vencidas</p>
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
          onClick={() => { loadCotizaciones(); loadKPIs(); }}
          disabled={loading}
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Bulk Actions Bar */}
      {isSomeSelected && (
        <div className="flex items-center gap-3 p-2 bg-muted rounded-lg">
          <CheckSquare className="w-4 h-4 text-muted-foreground" />
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkAction('eliminar')}
            disabled={bulkLoading}
            className="text-destructive hover:text-destructive/80"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Eliminar
          </Button>
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
        <SkeletonTable rows={5} cols={9} />
      ) : cotizaciones.length === 0 ? (
        <div className="text-center py-12">
          <FileX className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">No hay cotizaciones</p>
          <p className="text-xs text-muted-foreground mt-1">Crea una nueva cotización para enviar a tus clientes</p>
          {hasActiveFilters && (
            <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
              Limpiar filtros
            </Button>
          )}
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
                  <TableHead className="text-xs font-medium w-[120px]">N° Cotización</TableHead>
                  {!clienteId && <TableHead className="text-xs font-medium">Cliente</TableHead>}
                  <TableHead className="text-xs font-medium w-[90px]">Fecha</TableHead>
                  <TableHead className="text-xs font-medium w-[90px]">Validez</TableHead>
                  <TableHead className="text-xs font-medium w-[110px]">Estado</TableHead>
                  <TableHead className="text-xs font-medium w-[60px] text-center">Items</TableHead>
                  <TableHead className="text-xs font-medium w-[110px] text-right">Total</TableHead>
                  <TableHead className="text-xs font-medium text-right w-[90px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cotizaciones.map((cot) => {
                  const diasVenc = getDiasVencimiento(cot.fechaValidez);
                  const vencida = diasVenc !== null && diasVenc < 0 && !['ACEPTADA', 'CONVERTIDA', 'PERDIDA', 'VENCIDA'].includes(cot.estado || '');
                  const isSelected = selectedIds.has(cot.id);
                  return (
                    <TableRow
                      key={cot.id}
                      className={cn('hover:bg-muted/30 cursor-pointer', isSelected && 'bg-muted/50')}
                      onClick={() => handleViewDetail(cot)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectOne(cot.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-medium">{cot.numero}</span>
                      </TableCell>
                      {!clienteId && (
                        <TableCell className="text-xs">{cot.client?.legalName || cot.client?.name || '-'}</TableCell>
                      )}
                      <TableCell className="text-xs">
                        {cot.fechaEmision ? format(new Date(cot.fechaEmision), 'dd/MM/yy', { locale: es }) : '-'}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className={vencida ? 'text-destructive font-medium' : ''}>
                          {cot.fechaValidez ? format(new Date(cot.fechaValidez), 'dd/MM/yy', { locale: es }) : '-'}
                          {vencida && <span className="ml-1 text-xs">({Math.abs(diasVenc!)}d)</span>}
                        </div>
                      </TableCell>
                      <TableCell>{getEstadoBadge(cot.estado)}</TableCell>
                      <TableCell className="text-center text-xs">{cot._count?.items || 0}</TableCell>
                      <TableCell className="text-right text-xs font-medium">
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
                            <DropdownMenuItem onClick={() => handleDuplicar(cot)}>
                              <Copy className="w-4 h-4 mr-2" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {canEdit(cot.estado) && (
                              <DropdownMenuItem onClick={() => window.location.href = `/administracion/ventas/cotizaciones/${cot.id}/editar`}>
                                <Edit className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {canEnviar(cot.estado) && (
                              <DropdownMenuItem onClick={() => handleEnviar(cot.id)}>
                                <Send className="w-4 h-4 mr-2" />
                                Enviar al cliente
                              </DropdownMenuItem>
                            )}
                            {canConvertir(cot.estado) && (
                              <DropdownMenuItem onClick={() => handleConvertir(cot)}>
                                <ArrowRight className="w-4 h-4 mr-2" />
                                Convertir a OV
                              </DropdownMenuItem>
                            )}
                            {canDelete(cot.estado) && (
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
      </Tabs>

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
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conversion Dialog - T2 only visible in Extended ViewMode */}
      <AlertDialog open={convertirDialogOpen} onOpenChange={setConvertirDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convertir a Orden de Venta</AlertDialogTitle>
            <AlertDialogDescription>
              Convertir cotización <span className="font-medium">{cotizacionToConvert?.numero}</span> a orden de venta.
              Seleccione el tipo de documento:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button
              variant="outline"
              className="h-auto py-3 justify-start"
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
                className="h-auto py-3 justify-start border-dashed"
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
            loadKPIs();
          }}
        />
      )}
    </div>
  );
}
