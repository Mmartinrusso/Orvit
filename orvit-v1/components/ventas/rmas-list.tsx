'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@/lib/date-utils';
import {
  RefreshCw,
  Search,
  Plus,
  MoreVertical,
  Eye,
  CheckCircle2,
  XCircle,
  Package,
  Truck,
  ClipboardCheck,
  AlertCircle,
  Clock,
  FileText,
  Ban,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

type RMAStatus =
  | 'SOLICITADO'
  | 'EN_REVISION'
  | 'APROBADO'
  | 'RECHAZADO'
  | 'EN_TRANSITO'
  | 'RECIBIDO'
  | 'EN_EVALUACION'
  | 'PROCESADO'
  | 'CERRADO'
  | 'CANCELADO';

type RMAType = 'DEVOLUCION' | 'CAMBIO' | 'REPARACION' | 'GARANTIA';

interface RMA {
  id: string;
  numero: string;
  tipo: RMAType;
  estado: RMAStatus;
  categoriaMotivo: string;
  fechaSolicitud: string;
  fechaAprobacion?: string;
  fechaRecepcion?: string;
  fechaCierre?: string;
  montoTotal?: number;
  client?: {
    id: string;
    legalName: string;
  };
  solicitante?: {
    id: string;
    name: string;
  };
  items?: Array<{
    id: string;
    cantidad: number;
    product: {
      name: string;
    };
  }>;
}

interface RMAsResponse {
  data: RMA[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    total: number;
    pendientes: number;
    aprobados: number;
    rechazados: number;
    procesados: number;
  };
}

const ESTADOS_CONFIG: Record<
  RMAStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  SOLICITADO: {
    label: 'Solicitado',
    color: 'bg-info-muted text-info-muted-foreground',
    icon: Clock,
  },
  EN_REVISION: {
    label: 'En Revisión',
    color: 'bg-warning-muted text-warning-muted-foreground',
    icon: FileText,
  },
  APROBADO: {
    label: 'Aprobado',
    color: 'bg-success-muted text-success',
    icon: CheckCircle2,
  },
  RECHAZADO: {
    label: 'Rechazado',
    color: 'bg-destructive/10 text-destructive',
    icon: XCircle,
  },
  EN_TRANSITO: {
    label: 'En Tránsito',
    color: 'bg-purple-100 text-purple-700',
    icon: Truck,
  },
  RECIBIDO: {
    label: 'Recibido',
    color: 'bg-indigo-100 text-indigo-700',
    icon: Package,
  },
  EN_EVALUACION: {
    label: 'En Evaluación',
    color: 'bg-warning-muted text-warning-muted-foreground',
    icon: ClipboardCheck,
  },
  PROCESADO: {
    label: 'Procesado',
    color: 'bg-teal-100 text-teal-700',
    icon: CheckCircle2,
  },
  CERRADO: {
    label: 'Cerrado',
    color: 'bg-muted text-foreground',
    icon: CheckCircle2,
  },
  CANCELADO: {
    label: 'Cancelado',
    color: 'bg-muted text-muted-foreground',
    icon: Ban,
  },
};

const TIPOS_CONFIG: Record<RMAType, { label: string; color: string }> = {
  DEVOLUCION: { label: 'Devolución', color: 'bg-destructive/10 text-destructive border-destructive/30' },
  CAMBIO: { label: 'Cambio', color: 'bg-info-muted text-info-muted-foreground border-info-muted' },
  REPARACION: { label: 'Reparación', color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted' },
  GARANTIA: { label: 'Garantía', color: 'bg-success-muted text-success border-success-muted' },
};

export function RMASList() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<RMAsResponse>({
    queryKey: ['ventas-rmas', page, search, statusFilter, tipoFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(statusFilter !== 'all' && { estado: statusFilter }),
        ...(tipoFilter !== 'all' && { tipo: tipoFilter }),
      });

      const response = await fetch(`/api/ventas/rmas?${params}`);
      if (!response.ok) throw new Error('Error al cargar RMAs');
      return response.json();
    },
  });

  const aprobarMutation = useMutation({
    mutationFn: async (rmaId: string) => {
      const response = await fetch(`/api/ventas/rmas/${rmaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'aprobar' }),
      });
      if (!response.ok) throw new Error('Error al aprobar RMA');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventas-rmas'] });
      toast({
        title: 'RMA aprobado',
        description: 'El RMA ha sido aprobado exitosamente',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const rechazarMutation = useMutation({
    mutationFn: async (rmaId: string) => {
      const response = await fetch(`/api/ventas/rmas/${rmaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rechazar', motivo: 'Rechazado por revisión' }),
      });
      if (!response.ok) throw new Error('Error al rechazar RMA');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventas-rmas'] });
      toast({
        title: 'RMA rechazado',
        description: 'El RMA ha sido rechazado',
      });
    },
  });

  const recibirMutation = useMutation({
    mutationFn: async (rmaId: string) => {
      const response = await fetch(`/api/ventas/rmas/${rmaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recibir' }),
      });
      if (!response.ok) throw new Error('Error al marcar como recibido');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventas-rmas'] });
      toast({
        title: 'RMA recibido',
        description: 'El producto ha sido marcado como recibido',
      });
    },
  });

  const procesarMutation = useMutation({
    mutationFn: async (rmaId: string) => {
      const response = await fetch(`/api/ventas/rmas/${rmaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'procesar' }),
      });
      if (!response.ok) throw new Error('Error al procesar RMA');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventas-rmas'] });
      toast({
        title: 'RMA procesado',
        description: 'El RMA ha sido procesado exitosamente',
      });
    },
  });

  const cerrarMutation = useMutation({
    mutationFn: async (rmaId: string) => {
      const response = await fetch(`/api/ventas/rmas/${rmaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cerrar' }),
      });
      if (!response.ok) throw new Error('Error al cerrar RMA');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventas-rmas'] });
      toast({
        title: 'RMA cerrado',
        description: 'El RMA ha sido cerrado exitosamente',
      });
    },
  });

  const rmas = data?.data || [];
  const pagination = data?.pagination;
  const stats = data?.stats;

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-semibold">Error al cargar RMAs</p>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'Error desconocido'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total RMAs</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <Clock className="h-4 w-4 text-info-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-info-muted-foreground">{stats.pendientes}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aprobados</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.aprobados}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rechazados</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.rechazados}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Procesados</CardTitle>
              <Package className="h-4 w-4 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-teal-600">{stats.procesados}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número o cliente..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8"
                />
              </div>
            </div>

            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="SOLICITADO">Solicitado</SelectItem>
                <SelectItem value="EN_REVISION">En Revisión</SelectItem>
                <SelectItem value="APROBADO">Aprobado</SelectItem>
                <SelectItem value="RECHAZADO">Rechazado</SelectItem>
                <SelectItem value="EN_TRANSITO">En Tránsito</SelectItem>
                <SelectItem value="RECIBIDO">Recibido</SelectItem>
                <SelectItem value="EN_EVALUACION">En Evaluación</SelectItem>
                <SelectItem value="PROCESADO">Procesado</SelectItem>
                <SelectItem value="CERRADO">Cerrado</SelectItem>
                <SelectItem value="CANCELADO">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={tipoFilter}
              onValueChange={(value) => {
                setTipoFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="DEVOLUCION">Devolución</SelectItem>
                <SelectItem value="CAMBIO">Cambio</SelectItem>
                <SelectItem value="REPARACION">Reparación</SelectItem>
                <SelectItem value="GARANTIA">Garantía</SelectItem>
              </SelectContent>
            </Select>

            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo RMA
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : rmas.length === 0 ? (
            <div className="text-center py-12">
              <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold">No hay RMAs</p>
              <p className="text-sm text-muted-foreground">
                No se encontraron RMAs con los filtros aplicados
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Fecha Solicitud</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rmas.map((rma) => {
                    const estadoConfig = ESTADOS_CONFIG[rma.estado];
                    const tipoConfig = TIPOS_CONFIG[rma.tipo];
                    const Icon = estadoConfig.icon;

                    return (
                      <TableRow key={rma.id}>
                        <TableCell className="font-medium">{rma.numero}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={tipoConfig.color}>
                            {tipoConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rma.client?.legalName || 'Sin cliente'}
                        </TableCell>
                        <TableCell>
                          <Badge className={estadoConfig.color}>
                            <Icon className="mr-1 h-3 w-3" />
                            {estadoConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {rma.categoriaMotivo.replace(/_/g, ' ')}
                        </TableCell>
                        <TableCell>
                          {formatDate(rma.fechaSolicitud)}
                        </TableCell>
                        <TableCell>{rma.items?.length || 0}</TableCell>
                        <TableCell>{rma.solicitante?.name || '-'}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver detalles
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />

                              {rma.estado === 'SOLICITADO' && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => aprobarMutation.mutate(rma.id)}
                                  >
                                    <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
                                    Aprobar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => rechazarMutation.mutate(rma.id)}
                                  >
                                    <XCircle className="mr-2 h-4 w-4 text-destructive" />
                                    Rechazar
                                  </DropdownMenuItem>
                                </>
                              )}

                              {rma.estado === 'EN_TRANSITO' && (
                                <DropdownMenuItem
                                  onClick={() => recibirMutation.mutate(rma.id)}
                                >
                                  <Package className="mr-2 h-4 w-4" />
                                  Marcar como recibido
                                </DropdownMenuItem>
                              )}

                              {rma.estado === 'EN_EVALUACION' && (
                                <DropdownMenuItem
                                  onClick={() => procesarMutation.mutate(rma.id)}
                                >
                                  <ClipboardCheck className="mr-2 h-4 w-4" />
                                  Procesar
                                </DropdownMenuItem>
                              )}

                              {rma.estado === 'PROCESADO' && (
                                <DropdownMenuItem
                                  onClick={() => cerrarMutation.mutate(rma.id)}
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Cerrar RMA
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

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {(pagination.page - 1) * pagination.limit + 1} -{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                    {pagination.total} RMAs
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === pagination.totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
