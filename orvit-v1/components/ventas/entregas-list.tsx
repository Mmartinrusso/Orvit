'use client';

import { useState, useEffect } from 'react';
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
  Truck,
  Plus,
  Search,
  Eye,
  Clock,
  CheckCircle2,
  Package,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  RefreshCw,
  MoreHorizontal,
  MapPin,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { EntregasAdvancedFilters, AdvancedFilters } from './entregas-advanced-filters';

interface Entrega {
  id: number;
  numero: string;
  sale: {
    id: number;
    numero: string;
    client: {
      id: number;
      legalName: string;
      name?: string;
    };
  };
  fecha: string;
  fechaProgramada: string | null;
  status: string;
  direccionEntrega?: string;
  _count?: {
    items: number;
  };
}

interface KPIs {
  pendientes: number;
  listas: number;
  enTransito: number;
  entregadas: number;
}

type EstadoEntrega =
  | 'PENDIENTE'
  | 'EN_PREPARACION'
  | 'LISTA_PARA_DESPACHO'
  | 'EN_TRANSITO'
  | 'RETIRADA'
  | 'ENTREGADA'
  | 'ENTREGA_FALLIDA'
  | 'CANCELADA';

const ESTADOS_CONFIG: Record<EstadoEntrega, { label: string; color: string; icon: React.ElementType }> = {
  PENDIENTE: { label: 'Pendiente', color: 'bg-muted text-foreground border-border', icon: Clock },
  EN_PREPARACION: { label: 'Preparación', color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted', icon: Package },
  LISTA_PARA_DESPACHO: { label: 'Lista', color: 'bg-info-muted text-info-muted-foreground border-info-muted', icon: CheckCircle2 },
  EN_TRANSITO: { label: 'En Tránsito', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Truck },
  RETIRADA: { label: 'Retirada', color: 'bg-cyan-100 text-cyan-700 border-cyan-200', icon: Package },
  ENTREGADA: { label: 'Entregada', color: 'bg-success-muted text-success border-success-muted', icon: CheckCircle2 },
  ENTREGA_FALLIDA: { label: 'Fallida', color: 'bg-destructive/10 text-destructive border-destructive/30', icon: X },
  CANCELADA: { label: 'Cancelada', color: 'bg-muted text-muted-foreground border-border', icon: X },
};

interface EntregasListProps {
  clienteId?: number;
  limit?: number;
  showKPIs?: boolean;
  title?: string;
}

export function EntregasList({
  clienteId,
  limit = 20,
  showKPIs = true,
  title = 'Entregas',
}: EntregasListProps) {
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs>({
    pendientes: 0,
    listas: 0,
    enTransito: 0,
    entregadas: 0,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadEntregas();
  }, [page, statusFilter, searchTerm, clienteId, advancedFilters]);

  useEffect(() => {
    if (showKPIs) {
      loadKPIs();
    }
  }, [clienteId, showKPIs]);

  const loadEntregas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (clienteId) params.append('clienteId', clienteId.toString());
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchTerm) params.append('search', searchTerm);

      // Advanced filters
      if (advancedFilters.transportista) params.append('transportista', advancedFilters.transportista);
      if (advancedFilters.conductorNombre) params.append('conductorNombre', advancedFilters.conductorNombre);
      if (advancedFilters.direccion) params.append('direccion', advancedFilters.direccion);
      if (advancedFilters.tipo) params.append('tipo', advancedFilters.tipo);
      if (advancedFilters.fechaProgramadaDesde) {
        params.append('fechaProgramadaDesde', advancedFilters.fechaProgramadaDesde.toISOString());
      }
      if (advancedFilters.fechaProgramadaHasta) {
        params.append('fechaProgramadaHasta', advancedFilters.fechaProgramadaHasta.toISOString());
      }
      if (advancedFilters.fechaEntregaDesde) {
        params.append('fechaEntregaDesde', advancedFilters.fechaEntregaDesde.toISOString());
      }
      if (advancedFilters.fechaEntregaHasta) {
        params.append('fechaEntregaHasta', advancedFilters.fechaEntregaHasta.toISOString());
      }
      if (advancedFilters.statusIn && advancedFilters.statusIn.length > 0) {
        params.append('statusIn', advancedFilters.statusIn.join(','));
      }

      const response = await fetch(`/api/ventas/entregas?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEntregas(data.data || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error loading entregas:', error);
      toast.error('Error al cargar las entregas');
    } finally {
      setLoading(false);
    }
  };

  const loadKPIs = async () => {
    try {
      const clientParam = clienteId ? `&clienteId=${clienteId}` : '';

      const [pendientesRes, listasRes, transitoRes, entregadasRes] = await Promise.all([
        fetch(`/api/ventas/entregas?status=PENDIENTE&limit=1${clientParam}`),
        fetch(`/api/ventas/entregas?status=LISTA_PARA_DESPACHO&limit=1${clientParam}`),
        fetch(`/api/ventas/entregas?status=EN_TRANSITO&limit=1${clientParam}`),
        fetch(`/api/ventas/entregas?status=ENTREGADA&limit=1${clientParam}`),
      ]);

      const [pendientes, listas, transito, entregadas] = await Promise.all([
        pendientesRes.json(),
        listasRes.json(),
        transitoRes.json(),
        entregadasRes.json(),
      ]);

      setKpis({
        pendientes: pendientes.pagination?.total || 0,
        listas: listas.pagination?.total || 0,
        enTransito: transito.pagination?.total || 0,
        entregadas: entregadas.pagination?.total || 0,
      });
    } catch (error) {
      console.error('Error loading KPIs:', error);
    }
  };

  const handlePreparar = async (id: number) => {
    try {
      const response = await fetch(`/api/ventas/entregas/${id}/preparar`, {
        method: 'POST',
      });
      if (response.ok) {
        toast.success('Preparación iniciada');
        loadEntregas();
        loadKPIs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al iniciar preparación');
      }
    } catch (error) {
      toast.error('Error al iniciar preparación');
    }
  };

  const handleDespachar = async (id: number) => {
    try {
      const response = await fetch(`/api/ventas/entregas/${id}/despachar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        toast.success('Entrega despachada');
        loadEntregas();
        loadKPIs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al despachar');
      }
    } catch (error) {
      toast.error('Error al despachar la entrega');
    }
  };

  const handleRetirar = async (id: number) => {
    try {
      const response = await fetch(`/api/ventas/entregas/${id}/retirar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        toast.success('Entrega marcada como retirada');
        loadEntregas();
        loadKPIs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al marcar como retirada');
      }
    } catch (error) {
      toast.error('Error al procesar retiro');
    }
  };

  const handleEntregar = async (id: number) => {
    try {
      const response = await fetch(`/api/ventas/entregas/${id}/entregar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        toast.success('Entrega confirmada');
        loadEntregas();
        loadKPIs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al confirmar');
      }
    } catch (error) {
      toast.error('Error al confirmar la entrega');
    }
  };

  const handleFallar = async (id: number) => {
    try {
      const response = await fetch(`/api/ventas/entregas/${id}/fallar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: 'Fallida desde listado' }),
      });
      if (response.ok) {
        toast.success('Entrega marcada como fallida');
        loadEntregas();
        loadKPIs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al marcar como fallida');
      }
    } catch (error) {
      toast.error('Error al procesar falla');
    }
  };

  const handleListar = async (id: number) => {
    try {
      const response = await fetch(`/api/ventas/entregas/${id}/listar`, {
        method: 'POST',
      });
      if (response.ok) {
        toast.success('Entrega marcada como lista');
        loadEntregas();
        loadKPIs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al marcar como lista');
      }
    } catch (error) {
      toast.error('Error al procesar acción');
    }
  };

  const handleReintentar = async (id: number) => {
    try {
      const response = await fetch(`/api/ventas/entregas/${id}/reintentar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivoReintento: 'Reintento desde listado' }),
      });
      if (response.ok) {
        toast.success('Entrega reprogramada para reintento');
        loadEntregas();
        loadKPIs();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al reintentar');
      }
    } catch (error) {
      toast.error('Error al reintentar la entrega');
    }
  };

  const getEstadoBadge = (estado: string) => {
    const config = ESTADOS_CONFIG[estado as EstadoEntrega] || ESTADOS_CONFIG.PENDIENTE;
    const Icon = config.icon;
    return (
      <Badge className={cn(config.color, 'border text-[10px] px-1.5 py-0.5 font-medium')}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setAdvancedFilters({});
    setPage(1);
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || Object.keys(advancedFilters).some(key => {
    const value = advancedFilters[key as keyof AdvancedFilters];
    return value !== undefined && value !== null && (Array.isArray(value) ? value.length > 0 : true);
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{title}</h2>
          <span className="text-xs text-muted-foreground">
            {total} entrega(s)
          </span>
        </div>
        <Button size="sm" onClick={() => window.location.href = '/administracion/ventas/entregas/nueva'}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Entrega
        </Button>
      </div>

      {/* KPIs */}
      {showKPIs && (
        <div className="grid grid-cols-4 gap-3">
          <Card
            className={cn('cursor-pointer transition-all', statusFilter === 'PENDIENTE' ? 'ring-2 ring-primary' : 'hover:shadow-md')}
            onClick={() => setStatusFilter(statusFilter === 'PENDIENTE' ? 'all' : 'PENDIENTE')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-muted">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.pendientes}</p>
                  <p className="text-[10px] text-muted-foreground">Pendientes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn('cursor-pointer transition-all', statusFilter === 'LISTA_PARA_DESPACHO' ? 'ring-2 ring-primary' : 'hover:shadow-md')}
            onClick={() => setStatusFilter(statusFilter === 'LISTA_PARA_DESPACHO' ? 'all' : 'LISTA_PARA_DESPACHO')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-info-muted">
                  <CheckCircle2 className="w-3.5 h-3.5 text-info-muted-foreground" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.listas}</p>
                  <p className="text-[10px] text-muted-foreground">Listas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn('cursor-pointer transition-all', statusFilter === 'EN_TRANSITO' ? 'ring-2 ring-primary' : 'hover:shadow-md')}
            onClick={() => setStatusFilter(statusFilter === 'EN_TRANSITO' ? 'all' : 'EN_TRANSITO')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-purple-100">
                  <Truck className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.enTransito}</p>
                  <p className="text-[10px] text-muted-foreground">En Tránsito</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={cn('cursor-pointer transition-all', statusFilter === 'ENTREGADA' ? 'ring-2 ring-primary' : 'hover:shadow-md')}
            onClick={() => setStatusFilter(statusFilter === 'ENTREGADA' ? 'all' : 'ENTREGADA')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-success-muted">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                </div>
                <div>
                  <p className="text-xl font-bold">{kpis.entregadas}</p>
                  <p className="text-[10px] text-muted-foreground">Entregadas</p>
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

        <EntregasAdvancedFilters
          filters={advancedFilters}
          onFiltersChange={(filters) => {
            setAdvancedFilters(filters);
            setPage(1);
          }}
          onClear={() => {
            setAdvancedFilters({});
            setPage(1);
          }}
        />

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
          onClick={() => { loadEntregas(); loadKPIs(); }}
          disabled={loading}
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Tabla */}
      {loading ? (
        <SkeletonTable rows={5} cols={8} />
      ) : entregas.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">No hay entregas</p>
          <p className="text-xs text-muted-foreground mt-1">Las entregas programadas aparecerán aquí</p>
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
                  <TableHead className="text-xs font-medium w-[100px]">N° Entrega</TableHead>
                  <TableHead className="text-xs font-medium w-[100px]">N° OV</TableHead>
                  {!clienteId && <TableHead className="text-xs font-medium">Cliente</TableHead>}
                  <TableHead className="text-xs font-medium w-[90px]">Fecha</TableHead>
                  <TableHead className="text-xs font-medium w-[90px]">Programada</TableHead>
                  <TableHead className="text-xs font-medium w-[110px]">Estado</TableHead>
                  <TableHead className="text-xs font-medium">Dirección</TableHead>
                  <TableHead className="text-xs font-medium text-right w-[90px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entregas.map((entrega) => (
                  <TableRow
                    key={entrega.id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => window.location.href = `/administracion/ventas/entregas/${entrega.id}`}
                  >
                    <TableCell className="text-xs">
                      <span className="font-medium">{entrega.numero}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entrega.sale?.numero || '-'}
                    </TableCell>
                    {!clienteId && (
                      <TableCell className="text-xs">{entrega.sale?.client?.legalName || entrega.sale?.client?.name || '-'}</TableCell>
                    )}
                    <TableCell className="text-xs">
                      {entrega.fecha ? format(new Date(entrega.fecha), 'dd/MM/yy', { locale: es }) : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entrega.fechaProgramada ? format(new Date(entrega.fechaProgramada), 'dd/MM/yy', { locale: es }) : '-'}
                    </TableCell>
                    <TableCell>{getEstadoBadge(entrega.status)}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1 max-w-[150px] truncate">
                        <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{entrega.direccionEntrega || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => window.location.href = `/administracion/ventas/entregas/${entrega.id}`}>
                            <Eye className="w-4 h-4 mr-2" />
                            Ver detalle
                          </DropdownMenuItem>

                          {entrega.status === 'PENDIENTE' && (
                            <DropdownMenuItem onClick={() => handlePreparar(entrega.id)}>
                              <Package className="w-4 h-4 mr-2" />
                              Iniciar preparación
                            </DropdownMenuItem>
                          )}

                          {entrega.status === 'EN_PREPARACION' && (
                            <DropdownMenuItem onClick={() => handleListar(entrega.id)}>
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Marcar como lista
                            </DropdownMenuItem>
                          )}

                          {entrega.status === 'LISTA_PARA_DESPACHO' && (
                            <>
                              <DropdownMenuItem onClick={() => handleDespachar(entrega.id)}>
                                <Truck className="w-4 h-4 mr-2" />
                                Despachar (envío)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRetirar(entrega.id)}>
                                <Package className="w-4 h-4 mr-2" />
                                Marcar retirada
                              </DropdownMenuItem>
                            </>
                          )}

                          {entrega.status === 'EN_TRANSITO' && (
                            <>
                              <DropdownMenuItem onClick={() => handleEntregar(entrega.id)}>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Confirmar entrega
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleFallar(entrega.id)}>
                                <X className="w-4 h-4 mr-2" />
                                Marcar fallida
                              </DropdownMenuItem>
                            </>
                          )}

                          {entrega.status === 'RETIRADA' && (
                            <DropdownMenuItem onClick={() => handleEntregar(entrega.id)}>
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Confirmar entrega
                            </DropdownMenuItem>
                          )}

                          {entrega.status === 'ENTREGA_FALLIDA' && (
                            <DropdownMenuItem onClick={() => handleReintentar(entrega.id)}>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Reintentar entrega
                            </DropdownMenuItem>
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
    </div>
  );
}
