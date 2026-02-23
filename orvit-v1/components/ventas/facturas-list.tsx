'use client';

import { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
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
  Receipt,
  Plus,
  Search,
  Eye,
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
  DollarSign,
  FileText,
  Download,
  Ban,
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
import { cn } from '@/lib/utils';

interface Factura {
  id: number;
  numero: string;
  tipo: string;
  client: {
    id: number;
    legalName: string;
    cuit?: string;
  };
  fecha: string;
  fechaVencimiento: string | null;
  status: string;
  moneda: string;
  subtotal: number;
  total: number;
  saldoPendiente: number;
  saleId?: number;
}

interface KPIs {
  borradores: number;
  emitidas: number;
  parciales: number;
  cobradas: number;
  vencidas: number;
  totalPendiente: number;
}

type EstadoFactura =
  | 'BORRADOR'
  | 'EMITIDA'
  | 'PARCIALMENTE_COBRADA'
  | 'COBRADA'
  | 'VENCIDA'
  | 'ANULADA';

const ESTADOS_CONFIG: Record<EstadoFactura, { label: string; color: string; icon: React.ElementType }> = {
  BORRADOR: { label: 'Borrador', color: 'bg-muted text-foreground border-border', icon: FileEdit },
  EMITIDA: { label: 'Emitida', color: 'bg-info-muted text-info-muted-foreground border-info-muted', icon: FileText },
  PARCIALMENTE_COBRADA: { label: 'Parcial', color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted', icon: Clock },
  COBRADA: { label: 'Cobrada', color: 'bg-success-muted text-success border-success-muted', icon: CheckCircle2 },
  VENCIDA: { label: 'Vencida', color: 'bg-destructive/10 text-destructive border-destructive/30', icon: AlertTriangle },
  ANULADA: { label: 'Anulada', color: 'bg-muted text-muted-foreground border-border', icon: XCircle },
};

const TIPOS_FACTURA = ['A', 'B', 'C', 'M'];

interface FacturasListProps {
  clienteId?: number;
  limit?: number;
  showKPIs?: boolean;
  title?: string;
}

export function FacturasList({
  clienteId,
  limit = 20,
  showKPIs = true,
  title = 'Facturas',
}: FacturasListProps) {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs>({
    borradores: 0,
    emitidas: 0,
    parciales: 0,
    cobradas: 0,
    vencidas: 0,
    totalPendiente: 0,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedFacturas, setSelectedFacturas] = useState<number[]>([]);
  const [bulkActionDialog, setBulkActionDialog] = useState<{ open: boolean; action: string }>({ open: false, action: '' });

  useEffect(() => {
    loadFacturas();
  }, [page, statusFilter, tipoFilter, searchTerm, clienteId]);

  useEffect(() => {
    if (showKPIs) {
      loadKPIs();
    }
  }, [clienteId, showKPIs]);

  const loadFacturas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (clienteId) params.append('clienteId', clienteId.toString());
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (tipoFilter !== 'all') params.append('tipo', tipoFilter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/ventas/facturas?${params}`);
      if (response.ok) {
        const data = await response.json();
        setFacturas(data.data || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error loading facturas:', error);
      toast.error('Error al cargar las facturas');
    } finally {
      setLoading(false);
    }
  };

  const loadKPIs = async () => {
    try {
      const clientParam = clienteId ? `&clienteId=${clienteId}` : '';

      const [borradoresRes, emitidasRes, parcialesRes, cobradasRes] = await Promise.all([
        fetch(`/api/ventas/facturas?status=BORRADOR&limit=1${clientParam}`),
        fetch(`/api/ventas/facturas?status=EMITIDA&limit=1${clientParam}`),
        fetch(`/api/ventas/facturas?status=PARCIALMENTE_COBRADA&limit=1${clientParam}`),
        fetch(`/api/ventas/facturas?status=COBRADA&limit=1${clientParam}`),
      ]);

      const [borradores, emitidas, parciales, cobradas] = await Promise.all([
        borradoresRes.json(),
        emitidasRes.json(),
        parcialesRes.json(),
        cobradasRes.json(),
      ]);

      // Calcular vencidas y total pendiente
      let vencidas = 0;
      let totalPendiente = 0;
      const allFacturasRes = await fetch(`/api/ventas/facturas?limit=500${clientParam}`);
      if (allFacturasRes.ok) {
        const allData = await allFacturasRes.json();
        const today = new Date();
        (allData.data || []).forEach((f: Factura) => {
          if (['EMITIDA', 'PARCIALMENTE_COBRADA'].includes(f.status)) {
            totalPendiente += Number(f.saldoPendiente || 0);
            if (f.fechaVencimiento && new Date(f.fechaVencimiento) < today) {
              vencidas++;
            }
          }
        });
      }

      setKpis({
        borradores: borradores.pagination?.total || 0,
        emitidas: emitidas.pagination?.total || 0,
        parciales: parciales.pagination?.total || 0,
        cobradas: cobradas.pagination?.total || 0,
        vencidas,
        totalPendiente,
      });
    } catch (error) {
      console.error('Error loading KPIs:', error);
    }
  };

  const handleEmitir = async (id: number) => {
    try {
      const response = await fetch(`/api/ventas/facturas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'emitir' }),
      });
      if (response.ok) {
        toast.success('Factura emitida correctamente');
        loadFacturas();
        loadKPIs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al emitir');
      }
    } catch (error) {
      toast.error('Error al emitir la factura');
    }
  };

  const handleAnular = async (id: number) => {
    const motivo = window.prompt('Ingrese el motivo de anulación:');
    if (!motivo || motivo.trim() === '') {
      toast.error('Debe especificar un motivo para anular la factura');
      return;
    }

    try {
      const response = await fetch(`/api/ventas/facturas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'anular', motivo }),
      });
      if (response.ok) {
        toast.success('Factura anulada correctamente');
        loadFacturas();
        loadKPIs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al anular');
      }
    } catch (error) {
      toast.error('Error al anular la factura');
    }
  };

  const formatCurrency = (amount: number, currency: string = 'ARS') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getDiasVencimiento = (fechaVencimiento: string | null, status: string): number | null => {
    if (!fechaVencimiento) return null;
    if (['COBRADA', 'ANULADA'].includes(status)) return null;
    const dias = differenceInDays(new Date(fechaVencimiento), new Date());
    return dias;
  };

  const getEstadoBadge = (estado: string) => {
    const config = ESTADOS_CONFIG[estado as EstadoFactura] || ESTADOS_CONFIG.BORRADOR;
    const Icon = config.icon;
    return (
      <Badge className={cn(config.color, "border text-xs px-1.5 py-0.5 font-medium")}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getTipoBadge = (tipo: string) => {
    const colors: Record<string, string> = {
      'A': 'bg-info-muted text-info-muted-foreground border-info-muted',
      'B': 'bg-success-muted text-success border-success-muted',
      'C': 'bg-purple-50 text-purple-700 border-purple-200',
      'M': 'bg-warning-muted text-warning-muted-foreground border-warning-muted',
    };
    return (
      <Badge className={cn(colors[tipo] || "bg-muted text-foreground", "border text-xs px-1.5 py-0.5 font-medium")}>
        {tipo}
      </Badge>
    );
  };

  const canEmitir = (estado: string) => estado === 'BORRADOR';
  const canAnular = (estado: string) => ['EMITIDA', 'PARCIALMENTE_COBRADA'].includes(estado);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTipoFilter('all');
    setPage(1);
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || tipoFilter !== 'all';

  const handleSelectFactura = (facturaId: number, checked: boolean) => {
    if (checked) {
      setSelectedFacturas(prev => [...prev, facturaId]);
    } else {
      setSelectedFacturas(prev => prev.filter(id => id !== facturaId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFacturas(facturas.map(f => f.id));
    } else {
      setSelectedFacturas([]);
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedFacturas.length === 0) {
      toast.error('Selecciona al menos una factura');
      return;
    }

    try {
      let accion = '';
      let motivo = '';

      if (action === 'emit') {
        accion = 'bulk_emitir';
      } else if (action === 'void') {
        accion = 'bulk_anular';
        motivo = window.prompt('Ingrese el motivo de anulación para todas las facturas seleccionadas:') || '';

        if (!motivo || motivo.trim() === '') {
          toast.error('Debe especificar un motivo para anular las facturas');
          return;
        }
      } else {
        toast.error('Acción no válida');
        return;
      }

      const response = await fetch('/api/ventas/facturas/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion,
          invoiceIds: selectedFacturas,
          motivo,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error en operación masiva');
      }

      const result = await response.json();

      if (result.results && result.results.failed.length > 0) {
        toast.warning(`${result.message}. ${result.results.failed.length} fallaron.`);
      } else {
        toast.success(result.message);
      }

      setSelectedFacturas([]);
      setBulkActionDialog({ open: false, action: '' });
      loadFacturas();
    } catch (error) {
      console.error('Error in bulk action:', error);
      toast.error(error instanceof Error ? error.message : 'Error al realizar operación masiva');
    }
  };

  const exportFacturas = async () => {
    try {
      toast.info('Generando exportación...');

      // Call bulk export endpoint with current filters
      const response = await fetch('/api/ventas/facturas/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'bulk_export',
          estado: statusFilter !== 'all' ? statusFilter : undefined,
          clienteId: clienteId ? clienteId.toString() : undefined,
          search: searchTerm || undefined,
          tipoFactura: tipoFilter !== 'all' ? tipoFilter : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al exportar facturas');
      }

      // Download the CSV file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `facturas-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Facturas exportadas correctamente');
    } catch (error) {
      console.error('Error exporting invoices:', error);
      toast.error('Error al exportar facturas');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{title}</h2>
          <span className="text-xs text-muted-foreground">
            {total} factura(s)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportFacturas}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button size="sm" onClick={() => window.location.href = '/administracion/ventas/facturas/nueva'}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Factura
          </Button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedFacturas.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{selectedFacturas.length} facturas seleccionadas</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkActionDialog({ open: true, action: 'emit' })}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Emitir
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkActionDialog({ open: true, action: 'void' })}
                >
                  <Ban className="h-4 w-4 mr-2" />
                  Anular
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      {showKPIs && (
        <div className="grid grid-cols-6 gap-3">
          <Card
            className={cn("cursor-pointer transition-all", statusFilter === 'BORRADOR' ? "ring-2 ring-primary" : "hover:shadow-md")}
            onClick={() => setStatusFilter(statusFilter === 'BORRADOR' ? 'all' : 'BORRADOR')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-muted">
                  <FileEdit className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.borradores}</p>
                  <p className="text-xs text-muted-foreground">Borradores</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn("cursor-pointer transition-all", statusFilter === 'EMITIDA' ? "ring-2 ring-primary" : "hover:shadow-md")}
            onClick={() => setStatusFilter(statusFilter === 'EMITIDA' ? 'all' : 'EMITIDA')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-info-muted">
                  <FileText className="w-3.5 h-3.5 text-info-muted-foreground" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.emitidas}</p>
                  <p className="text-xs text-muted-foreground">Emitidas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn("cursor-pointer transition-all", statusFilter === 'PARCIALMENTE_COBRADA' ? "ring-2 ring-primary" : "hover:shadow-md")}
            onClick={() => setStatusFilter(statusFilter === 'PARCIALMENTE_COBRADA' ? 'all' : 'PARCIALMENTE_COBRADA')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-warning-muted">
                  <Clock className="w-3.5 h-3.5 text-warning-muted-foreground" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.parciales}</p>
                  <p className="text-xs text-muted-foreground">Parciales</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn("cursor-pointer transition-all", statusFilter === 'COBRADA' ? "ring-2 ring-primary" : "hover:shadow-md")}
            onClick={() => setStatusFilter(statusFilter === 'COBRADA' ? 'all' : 'COBRADA')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-success-muted">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.cobradas}</p>
                  <p className="text-xs text-muted-foreground">Cobradas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn("cursor-pointer transition-all", statusFilter === 'VENCIDA' ? "ring-2 ring-red-500" : "hover:shadow-md")}
            onClick={() => setStatusFilter(statusFilter === 'VENCIDA' ? 'all' : 'VENCIDA')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-destructive/10">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                </div>
                <div>
                  <p className="text-xl font-bold text-destructive">{kpis.vencidas}</p>
                  <p className="text-xs text-muted-foreground">Vencidas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-purple-100">
                  <DollarSign className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{formatCurrency(kpis.totalPendiente)}</p>
                  <p className="text-xs text-muted-foreground">Pendiente</p>
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

        <Select value={tipoFilter} onValueChange={(v) => { setTipoFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[100px] h-8 text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos</SelectItem>
            {TIPOS_FACTURA.map((tipo) => (
              <SelectItem key={tipo} value={tipo} className="text-xs">Factura {tipo}</SelectItem>
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
          onClick={() => { loadFacturas(); loadKPIs(); }}
          disabled={loading}
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
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
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32 hidden md:block" />
                  <Skeleton className="h-4 w-16 hidden sm:block" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : facturas.length === 0 ? (
        <div className="text-center py-12">
          <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No se encontraron facturas</p>
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
                      checked={selectedFacturas.length === facturas.length && facturas.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-xs font-medium w-[50px]">Tipo</TableHead>
                  <TableHead className="text-xs font-medium w-[120px]">Número</TableHead>
                  {!clienteId && <TableHead className="text-xs font-medium hidden sm:table-cell">Cliente</TableHead>}
                  <TableHead className="text-xs font-medium w-[90px] hidden md:table-cell">Fecha</TableHead>
                  <TableHead className="text-xs font-medium w-[90px] hidden lg:table-cell">Vencimiento</TableHead>
                  <TableHead className="text-xs font-medium w-[100px]">Estado</TableHead>
                  <TableHead className="text-xs font-medium w-[100px] text-right">Total</TableHead>
                  <TableHead className="text-xs font-medium w-[100px] text-right hidden sm:table-cell">Saldo</TableHead>
                  <TableHead className="text-xs font-medium text-right w-[80px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facturas.map((factura) => {
                  const diasVenc = getDiasVencimiento(factura.fechaVencimiento, factura.status);
                  const vencida = diasVenc !== null && diasVenc < 0;
                  return (
                    <TableRow
                      key={factura.id}
                      className="hover:bg-muted/30 cursor-pointer group"
                      onClick={() => window.location.href = `/administracion/ventas/facturas/${factura.id}`}
                    >
                      <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedFacturas.includes(factura.id)}
                          onCheckedChange={(checked) => handleSelectFactura(factura.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell>{getTipoBadge(factura.tipo)}</TableCell>
                      <TableCell className="text-xs">
                        <div>
                          <span className="font-medium">{factura.numero}</span>
                          {!clienteId && (
                            <div className="text-xs text-muted-foreground sm:hidden truncate max-w-[80px]">
                              {factura.client?.legalName || '-'}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      {!clienteId && (
                        <TableCell className="text-xs hidden sm:table-cell">{factura.client?.legalName || '-'}</TableCell>
                      )}
                      <TableCell className="text-xs hidden md:table-cell">
                        {factura.fecha ? format(new Date(factura.fecha), 'dd/MM/yy', { locale: es }) : '-'}
                      </TableCell>
                      <TableCell className="text-xs hidden lg:table-cell">
                        <div className={vencida ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                          {factura.fechaVencimiento ? format(new Date(factura.fechaVencimiento), 'dd/MM/yy', { locale: es }) : '-'}
                          {vencida && <span className="ml-1 text-xs">({Math.abs(diasVenc!)}d)</span>}
                        </div>
                      </TableCell>
                      <TableCell>{getEstadoBadge(factura.status)}</TableCell>
                      <TableCell className="text-right text-xs font-medium">
                        {formatCurrency(Number(factura.total), factura.moneda)}
                      </TableCell>
                      <TableCell className="text-right text-xs hidden sm:table-cell">
                        <span className={Number(factura.saldoPendiente) > 0 ? 'text-warning-muted-foreground font-medium' : 'text-success'}>
                          {formatCurrency(Number(factura.saldoPendiente), factura.moneda)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => window.location.href = `/administracion/ventas/facturas/${factura.id}`}>
                              <Eye className="w-4 h-4 mr-2" />
                              Ver detalle
                            </DropdownMenuItem>
                            {canEmitir(factura.status) && (
                              <DropdownMenuItem onClick={() => handleEmitir(factura.id)}>
                                <FileText className="w-4 h-4 mr-2" />
                                Emitir
                              </DropdownMenuItem>
                            )}
                            {Number(factura.saldoPendiente) > 0 && factura.status !== 'BORRADOR' && (
                              <DropdownMenuItem onClick={() => window.location.href = `/administracion/ventas/cobranzas?facturaId=${factura.id}`}>
                                <DollarSign className="w-4 h-4 mr-2" />
                                Registrar cobro
                              </DropdownMenuItem>
                            )}
                            {canAnular(factura.status) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleAnular(factura.id)}
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Anular
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

      {/* Bulk Action Dialog */}
      <AlertDialog open={bulkActionDialog.open} onOpenChange={(open) => setBulkActionDialog({ ...bulkActionDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Acción Masiva</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkActionDialog.action === 'emit' && `¿Estás seguro de emitir ${selectedFacturas.length} factura(s)?`}
              {bulkActionDialog.action === 'void' && `¿Estás seguro de anular ${selectedFacturas.length} factura(s)? Esta acción no se puede deshacer.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleBulkAction(bulkActionDialog.action)}
              className={bulkActionDialog.action === 'void' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
