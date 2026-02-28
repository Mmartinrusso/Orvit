'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useViewMode } from '@/hooks/use-view-mode';
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
  Wallet,
  Plus,
  Search,
  Eye,
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
  CreditCard,
  Banknote,
  FileText,
  Download,
  Ban,
  Receipt,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { SkeletonTable } from '@/components/ui/skeleton-table';
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
import { format } from 'date-fns';
import { formatDate } from '@/lib/date-utils';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { usePermission } from '@/hooks/use-permissions';

interface Pago {
  id: number;
  numero: string;
  client: {
    id: string;
    legalName?: string;
    name?: string;
  };
  fechaPago: string;
  // Montos por método (API devuelve estos campos)
  totalPago: number;
  efectivo?: number;
  transferencia?: number;
  chequesTerceros?: number;
  tarjetaCredito?: number;
  tarjetaDebito?: number;
  // Estado y otros campos
  estado: string;
  docType?: 'T1' | 'T2';
  notas?: string;
  bancoOrigen?: string;
  numeroOperacion?: string;
  allocations?: Array<{
    invoice: { id: number; numero: string; total: number };
    montoAplicado: number;
  }>;
}

interface KPIs {
  pendientes: number;
  confirmados: number;
  rechazados: number;
  anulados: number;
  totalMes: number;
}

// Estados válidos según enum ClientPaymentStatus en Prisma
type EstadoPago =
  | 'PENDIENTE'
  | 'CONFIRMADO'
  | 'RECHAZADO'
  | 'ANULADO';

const ESTADOS_CONFIG: Record<EstadoPago, { label: string; color: string; icon: React.ElementType }> = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-info-muted text-info-muted-foreground border-info-muted', icon: Clock },
  CONFIRMADO: { label: 'Confirmado', color: 'bg-success-muted text-success border-success-muted', icon: CheckCircle2 },
  RECHAZADO: { label: 'Rechazado', color: 'bg-destructive/10 text-destructive border-destructive/30', icon: XCircle },
  ANULADO: { label: 'Anulado', color: 'bg-muted text-muted-foreground border-border', icon: XCircle },
};

const METODOS_PAGO = [
  { value: 'EFECTIVO', label: 'Efectivo', icon: Banknote },
  { value: 'TRANSFERENCIA', label: 'Transferencia', icon: DollarSign },
  { value: 'CHEQUE', label: 'Cheque', icon: FileText },
  { value: 'TARJETA', label: 'Tarjeta', icon: CreditCard },
];

interface CobranzasListProps {
  clienteId?: number;
  limit?: number;
  showKPIs?: boolean;
  title?: string;
}

export function CobranzasList({
  clienteId,
  limit = 20,
  showKPIs = true,
  title = 'Cobranzas',
}: CobranzasListProps) {
  // ViewMode para auto-reload al cambiar modo
  const { mode } = useViewMode();

  // Permission checks
  const { hasPermission: canApplyPayment } = usePermission('ventas.pagos.apply');

  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs>({
    pendientes: 0,
    confirmados: 0,
    rechazados: 0,
    anulados: 0,
    totalMes: 0,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [metodoFilter, setMetodoFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedPagos, setSelectedPagos] = useState<number[]>([]);
  const [bulkActionDialog, setBulkActionDialog] = useState<{ open: boolean; action: string }>({ open: false, action: '' });
  const [anularDialog, setAnularDialog] = useState<{ open: boolean; pagoId: number | null; pagoNumero: string; motivo: string }>({ open: false, pagoId: null, pagoNumero: '', motivo: '' });

  // Recargar datos al cambiar ViewMode
  useEffect(() => {
    loadPagos();
  }, [page, statusFilter, metodoFilter, searchTerm, clienteId, mode]);

  useEffect(() => {
    if (showKPIs) {
      loadKPIs();
    }
  }, [clienteId, showKPIs, mode]);

  const loadPagos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (clienteId) params.append('clienteId', clienteId.toString());
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (metodoFilter !== 'all') params.append('metodoPago', metodoFilter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/ventas/pagos?${params}`);
      if (response.ok) {
        const data = await response.json();
        setPagos(data.data || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error loading pagos:', error);
      toast.error('Error al cargar los pagos');
    } finally {
      setLoading(false);
    }
  };

  const loadKPIs = async () => {
    try {
      const clientParam = clienteId ? `&clienteId=${clienteId}` : '';

      // Estados válidos: PENDIENTE, CONFIRMADO, RECHAZADO, ANULADO
      const [pendientesRes, confirmadosRes, rechazadosRes, anuladosRes] = await Promise.all([
        fetch(`/api/ventas/pagos?estado=PENDIENTE&limit=1${clientParam}`),
        fetch(`/api/ventas/pagos?estado=CONFIRMADO&limit=1${clientParam}`),
        fetch(`/api/ventas/pagos?estado=RECHAZADO&limit=1${clientParam}`),
        fetch(`/api/ventas/pagos?estado=ANULADO&limit=1${clientParam}`),
      ]);

      const [pendientes, confirmados, rechazados, anulados] = await Promise.all([
        pendientesRes.json(),
        confirmadosRes.json(),
        rechazadosRes.json(),
        anuladosRes.json(),
      ]);

      // Calcular total del mes (solo confirmados, no anulados/rechazados)
      let totalMes = 0;
      const mesActual = new Date();
      const primerDiaMes = new Date(mesActual.getFullYear(), mesActual.getMonth(), 1).toISOString();
      const allPagosRes = await fetch(`/api/ventas/pagos?fechaDesde=${primerDiaMes}&limit=500${clientParam}`);
      if (allPagosRes.ok) {
        const allData = await allPagosRes.json();
        (allData.data || []).forEach((p: Pago) => {
          if (p.estado === 'CONFIRMADO') {
            totalMes += Number(p.totalPago || 0);
          }
        });
      }

      setKpis({
        pendientes: pendientes.pagination?.total || 0,
        confirmados: confirmados.pagination?.total || 0,
        rechazados: rechazados.pagination?.total || 0,
        anulados: anulados.pagination?.total || 0,
        totalMes,
      });
    } catch (error) {
      console.error('Error loading KPIs:', error);
    }
  };

  const handleAnular = async () => {
    if (!anularDialog.pagoId || !anularDialog.motivo.trim()) {
      toast.error('Debe ingresar un motivo de anulación');
      return;
    }

    try {
      const response = await fetch(`/api/ventas/pagos/${anularDialog.pagoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'anular', motivo: anularDialog.motivo }),
      });
      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || 'Pago anulado exitosamente (Tesorería revertida)');
        loadPagos();
        loadKPIs();
        setAnularDialog({ open: false, pagoId: null, pagoNumero: '', motivo: '' });
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al anular');
      }
    } catch (error) {
      toast.error('Error al anular el pago');
    }
  };

  const handleSelectPago = (pagoId: number, checked: boolean) => {
    if (checked) {
      setSelectedPagos(prev => [...prev, pagoId]);
    } else {
      setSelectedPagos(prev => prev.filter(id => id !== pagoId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPagos(pagos.map(p => p.id));
    } else {
      setSelectedPagos([]);
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedPagos.length === 0) {
      toast.error('Selecciona al menos un pago');
      return;
    }
    // TODO: Implement bulk actions
    toast.success(`Acción "${action}" aplicada a ${selectedPagos.length} pagos`);
    setSelectedPagos([]);
    setBulkActionDialog({ open: false, action: '' });
    loadPagos();
  };

  const exportPagos = () => {
    const csvContent = [
      ['Número', 'Cliente', 'Fecha', 'Método', 'Estado', 'Monto', 'Referencia'],
      ...pagos.map(p => {
        const metodoPago = p.efectivo && p.efectivo > 0 ? 'Efectivo'
          : p.transferencia && p.transferencia > 0 ? 'Transferencia'
          : p.chequesTerceros && p.chequesTerceros > 0 ? 'Cheque'
          : (p.tarjetaCredito && p.tarjetaCredito > 0) || (p.tarjetaDebito && p.tarjetaDebito > 0) ? 'Tarjeta'
          : 'Otro';
        return [
          p.numero,
          p.client?.legalName || p.client?.name || '',
          p.fechaPago ? formatDate(p.fechaPago) : '',
          metodoPago,
          ESTADOS_CONFIG[p.estado as EstadoPago]?.label || p.estado,
          p.totalPago.toString(),
          p.numeroOperacion || '',
        ];
      })
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cobranzas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const formatCurrency = (amount: number, currency: string = 'ARS') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getEstadoBadge = (estado: string) => {
    const config = ESTADOS_CONFIG[estado as EstadoPago] || ESTADOS_CONFIG.PENDIENTE;
    const Icon = config.icon;
    return (
      <Badge className={cn(config.color, 'border text-xs px-1.5 py-0.5 font-medium')}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getMetodoBadge = (metodo: string) => {
    const config = METODOS_PAGO.find(m => m.value === metodo);
    const Icon = config?.icon || DollarSign;
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="w-3 h-3" />
        <span>{config?.label || metodo}</span>
      </div>
    );
  };

  const canAnular = (estado: string | undefined) =>
    ['PENDIENTE', 'CONFIRMADO'].includes(estado?.toUpperCase() || '');

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setMetodoFilter('all');
    setPage(1);
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || metodoFilter !== 'all';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{title}</h2>
          <span className="text-xs text-muted-foreground">
            {total} pago(s)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportPagos}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          {canApplyPayment && (
            <Button size="sm" onClick={() => window.location.href = '/administracion/ventas/cobranzas/registrar'}>
              <Plus className="w-4 h-4 mr-2" />
              Registrar Pago
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedPagos.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{selectedPagos.length} pagos seleccionados</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkActionDialog({ open: true, action: 'anular' })}
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
        <div className="grid grid-cols-5 gap-3">
          <Card
            className={cn('cursor-pointer transition-all', statusFilter === 'PENDIENTE' ? 'ring-2 ring-primary' : 'hover:shadow-md')}
            onClick={() => setStatusFilter(statusFilter === 'PENDIENTE' ? 'all' : 'PENDIENTE')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-info-muted">
                  <Clock className="w-3.5 h-3.5 text-info-muted-foreground" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.pendientes}</p>
                  <p className="text-xs text-muted-foreground">Pendientes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn('cursor-pointer transition-all', statusFilter === 'CONFIRMADO' ? 'ring-2 ring-primary' : 'hover:shadow-md')}
            onClick={() => setStatusFilter(statusFilter === 'CONFIRMADO' ? 'all' : 'CONFIRMADO')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-success-muted">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.confirmados}</p>
                  <p className="text-xs text-muted-foreground">Confirmados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn('cursor-pointer transition-all', statusFilter === 'RECHAZADO' ? 'ring-2 ring-primary' : 'hover:shadow-md')}
            onClick={() => setStatusFilter(statusFilter === 'RECHAZADO' ? 'all' : 'RECHAZADO')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-destructive/10">
                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.rechazados}</p>
                  <p className="text-xs text-muted-foreground">Rechazados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn('cursor-pointer transition-all', statusFilter === 'ANULADO' ? 'ring-2 ring-primary' : 'hover:shadow-md')}
            onClick={() => setStatusFilter(statusFilter === 'ANULADO' ? 'all' : 'ANULADO')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-muted">
                  <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.anulados}</p>
                  <p className="text-xs text-muted-foreground">Anulados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-success-muted">
                  <DollarSign className="w-3.5 h-3.5 text-success" />
                </div>
                <div>
                  <p className="text-lg font-bold text-success">{formatCurrency(kpis.totalMes)}</p>
                  <p className="text-xs text-muted-foreground">Total Mes</p>
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
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos los estados</SelectItem>
            {Object.entries(ESTADOS_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key} className="text-xs">{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={metodoFilter} onValueChange={(v) => { setMetodoFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Método" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos</SelectItem>
            {METODOS_PAGO.map((metodo) => (
              <SelectItem key={metodo.value} value={metodo.value} className="text-xs">{metodo.label}</SelectItem>
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
          onClick={() => { loadPagos(); loadKPIs(); }}
          disabled={loading}
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Tabla */}
      {loading ? (
        <SkeletonTable rows={5} cols={10} />
      ) : pagos.length === 0 ? (
        <div className="text-center py-12">
          <Receipt className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">No hay cobranzas</p>
          <p className="text-xs text-muted-foreground mt-1">Registra un pago para comenzar a gestionar las cobranzas</p>
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
                  <TableHead className="w-12 pl-4">
                    <Checkbox
                      checked={selectedPagos.length === pagos.length && pagos.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-xs font-medium w-[100px]">N° Pago</TableHead>
                  {!clienteId && <TableHead className="text-xs font-medium hidden sm:table-cell">Cliente</TableHead>}
                  <TableHead className="text-xs font-medium w-[90px] hidden md:table-cell">Fecha</TableHead>
                  <TableHead className="text-xs font-medium w-[100px] hidden lg:table-cell">Método</TableHead>
                  <TableHead className="text-xs font-medium w-[100px]">Estado</TableHead>
                  <TableHead className="text-xs font-medium w-[100px] text-right">Monto</TableHead>
                  <TableHead className="text-xs font-medium w-[100px] text-right hidden sm:table-cell">Aplicado</TableHead>
                  <TableHead className="text-xs font-medium hidden lg:table-cell">Referencia</TableHead>
                  <TableHead className="text-xs font-medium text-right w-[80px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagos.map((pago) => {
                  // Calcular monto aplicado desde allocations
                  const montoAplicado = pago.allocations?.reduce((sum, a) => sum + Number(a.montoAplicado || 0), 0) || 0;
                  // Determinar método de pago principal
                  const metodoPago = pago.efectivo && pago.efectivo > 0 ? 'EFECTIVO'
                    : pago.transferencia && pago.transferencia > 0 ? 'TRANSFERENCIA'
                    : pago.chequesTerceros && pago.chequesTerceros > 0 ? 'CHEQUE'
                    : (pago.tarjetaCredito && pago.tarjetaCredito > 0) || (pago.tarjetaDebito && pago.tarjetaDebito > 0) ? 'TARJETA'
                    : 'EFECTIVO';

                  return (
                    <TableRow
                      key={pago.id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => window.location.href = `/administracion/ventas/cobranzas/${pago.id}`}
                    >
                      <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedPagos.includes(pago.id)}
                          onCheckedChange={(checked) => handleSelectPago(pago.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>
                          <span className="font-medium">{pago.numero}</span>
                          {pago.docType === 'T2' && (
                            <Badge variant="outline" className="ml-2 text-[9px] px-1 bg-warning-muted text-warning-muted-foreground border-warning-muted">
                              NV
                            </Badge>
                          )}
                          {/* Mobile-only: show client below number */}
                          {!clienteId && (
                            <div className="text-xs text-muted-foreground sm:hidden truncate max-w-[100px]">
                              {pago.client?.legalName || pago.client?.name || '-'}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      {!clienteId && (
                        <TableCell className="text-xs hidden sm:table-cell">{pago.client?.legalName || pago.client?.name || '-'}</TableCell>
                      )}
                      <TableCell className="text-xs hidden md:table-cell">
                        {pago.fechaPago ? format(new Date(pago.fechaPago), 'dd/MM/yy', { locale: es }) : '-'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{getMetodoBadge(metodoPago)}</TableCell>
                      <TableCell>{getEstadoBadge(pago.estado)}</TableCell>
                      <TableCell className="text-right text-xs font-medium">
                        {formatCurrency(Number(pago.totalPago))}
                      </TableCell>
                      <TableCell className="text-right text-xs hidden sm:table-cell">
                        <span className={montoAplicado < Number(pago.totalPago) ? 'text-warning-muted-foreground' : 'text-success'}>
                          {formatCurrency(montoAplicado)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[120px] hidden lg:table-cell">
                        {pago.numeroOperacion || '-'}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => window.location.href = `/administracion/ventas/cobranzas/${pago.id}`}>
                              <Eye className="w-4 h-4 mr-2" />
                              Ver detalle
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.location.href = `/administracion/ventas/cobranzas/${pago.id}/recibo`}>
                              <FileText className="w-4 h-4 mr-2" />
                              Ver recibo
                            </DropdownMenuItem>
                            {canAnular(pago.estado) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setAnularDialog({ open: true, pagoId: pago.id, pagoNumero: pago.numero, motivo: '' })}
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

      {/* Anular Dialog */}
      <AlertDialog open={anularDialog.open} onOpenChange={(open) => setAnularDialog({ ...anularDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Anulación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de anular el pago <span className="font-medium">{anularDialog.pagoNumero}</span>? Esta acción reversará los montos aplicados a las facturas y los movimientos de tesorería.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="motivoAnular">Motivo de Anulación *</Label>
            <Textarea
              id="motivoAnular"
              value={anularDialog.motivo}
              onChange={(e) => setAnularDialog({ ...anularDialog, motivo: e.target.value })}
              placeholder="Ingrese el motivo de la anulación..."
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAnularDialog({ open: false, pagoId: null, pagoNumero: '', motivo: '' })}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAnular}
              className="bg-destructive hover:bg-destructive/90"
              disabled={!anularDialog.motivo.trim()}
            >
              Anular
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
              {bulkActionDialog.action === 'anular' && `¿Estás seguro de anular ${selectedPagos.length} pago(s)? Esta acción reversará los montos aplicados a las facturas.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleBulkAction(bulkActionDialog.action)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
