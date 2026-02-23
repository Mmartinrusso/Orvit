'use client';

import { useState } from 'react';
import { cn, formatNumber } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Target,
  Search,
  Plus,
  MoreVertical,
  Eye,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Package,
  Percent,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  Pause,
  BarChart3,
  AlertCircle,
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
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

type GoalType =
  | 'VENTAS_MONTO'
  | 'VENTAS_CANTIDAD'
  | 'CLIENTES_NUEVOS'
  | 'MARGEN'
  | 'CONVERSION'
  | 'COBRANZAS';

type GoalLevel = 'EMPRESA' | 'VENDEDOR' | 'EQUIPO' | 'PRODUCTO' | 'CATEGORIA';

type GoalPeriod = 'DIARIO' | 'SEMANAL' | 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL';

interface SalesGoal {
  id: string;
  nombre: string;
  tipo: GoalType;
  nivel: GoalLevel;
  periodo: GoalPeriod;
  metaValor: number;
  fechaInicio: string;
  fechaFin: string;
  isActive: boolean;
  isClosed: boolean;
  tieneIncentivo: boolean;
  vendedor?: {
    id: string;
    name: string;
  };
  creator?: {
    id: string;
    name: string;
  };
  progress?: Array<{
    porcentajeCumplimiento: number;
    valorAlcanzado: number;
  }>;
}

interface GoalsResponse {
  data: SalesGoal[];
  summary: {
    totalMetas: number;
    metasActivas: number;
    cumplimientoPromedio: number;
    metasCerradas: number;
  };
}

const TIPOS_CONFIG: Record<GoalType, { label: string; icon: React.ElementType; color: string }> = {
  VENTAS_MONTO: { label: 'Monto Ventas', icon: DollarSign, color: 'text-success' },
  VENTAS_CANTIDAD: { label: 'Cantidad Ventas', icon: BarChart3, color: 'text-info-muted-foreground' },
  CLIENTES_NUEVOS: { label: 'Clientes Nuevos', icon: Users, color: 'text-purple-600' },
  MARGEN: { label: 'Margen', icon: Percent, color: 'text-warning-muted-foreground' },
  CONVERSION: { label: 'Conversión', icon: TrendingUp, color: 'text-teal-600' },
  COBRANZAS: { label: 'Cobranzas', icon: DollarSign, color: 'text-indigo-600' },
};

const NIVELES_CONFIG: Record<GoalLevel, { label: string; color: string }> = {
  EMPRESA: { label: 'Empresa', color: 'bg-purple-100 text-purple-700' },
  VENDEDOR: { label: 'Vendedor', color: 'bg-info-muted text-info-muted-foreground' },
  EQUIPO: { label: 'Equipo', color: 'bg-success-muted text-success' },
  PRODUCTO: { label: 'Producto', color: 'bg-warning-muted text-warning-muted-foreground' },
  CATEGORIA: { label: 'Categoría', color: 'bg-pink-100 text-pink-700' },
};

const PERIODOS_CONFIG: Record<GoalPeriod, string> = {
  DIARIO: 'Diario',
  SEMANAL: 'Semanal',
  MENSUAL: 'Mensual',
  TRIMESTRAL: 'Trimestral',
  ANUAL: 'Anual',
};

export function SalesGoalsList() {
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [nivelFilter, setNivelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<GoalsResponse>({
    queryKey: ['ventas-goals', search, tipoFilter, nivelFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(tipoFilter !== 'all' && { tipo: tipoFilter }),
        ...(nivelFilter !== 'all' && { nivel: nivelFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });

      const response = await fetch(`/api/ventas/metas?${params}`);
      if (!response.ok) throw new Error('Error al cargar metas');
      return response.json();
    },
  });

  const activarMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const response = await fetch(`/api/ventas/metas/${goalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate' }),
      });
      if (!response.ok) throw new Error('Error al activar meta');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventas-goals'] });
      toast({
        title: 'Meta activada',
        description: 'La meta ha sido activada exitosamente',
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

  const desactivarMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const response = await fetch(`/api/ventas/metas/${goalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate' }),
      });
      if (!response.ok) throw new Error('Error al desactivar meta');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventas-goals'] });
      toast({
        title: 'Meta desactivada',
        description: 'La meta ha sido desactivada',
      });
    },
  });

  const cerrarMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const response = await fetch(`/api/ventas/metas/${goalId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' }),
      });
      if (!response.ok) throw new Error('Error al cerrar meta');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ventas-goals'] });
      toast({
        title: 'Meta cerrada',
        description: 'La meta ha sido cerrada exitosamente',
      });
    },
  });

  const goals = data?.data || [];
  const summary = data?.summary;

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-semibold">Error al cargar metas</p>
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
      {summary && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Metas</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalMetas}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Metas Activas</CardTitle>
              <Play className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {summary.metasActivas}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cumplimiento Promedio</CardTitle>
              <TrendingUp className="h-4 w-4 text-info-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-info-muted-foreground">
                {formatNumber(summary.cumplimientoPromedio, 1)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Metas Cerradas</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">
                {summary.metasCerradas}
              </div>
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
                  placeholder="Buscar metas..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="VENTAS_MONTO">Monto Ventas</SelectItem>
                <SelectItem value="VENTAS_CANTIDAD">Cantidad Ventas</SelectItem>
                <SelectItem value="CLIENTES_NUEVOS">Clientes Nuevos</SelectItem>
                <SelectItem value="MARGEN">Margen</SelectItem>
                <SelectItem value="CONVERSION">Conversión</SelectItem>
                <SelectItem value="COBRANZAS">Cobranzas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={nivelFilter} onValueChange={setNivelFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Nivel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los niveles</SelectItem>
                <SelectItem value="EMPRESA">Empresa</SelectItem>
                <SelectItem value="VENDEDOR">Vendedor</SelectItem>
                <SelectItem value="EQUIPO">Equipo</SelectItem>
                <SelectItem value="PRODUCTO">Producto</SelectItem>
                <SelectItem value="CATEGORIA">Categoría</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="active">Activas</SelectItem>
                <SelectItem value="inactive">Inactivas</SelectItem>
                <SelectItem value="closed">Cerradas</SelectItem>
              </SelectContent>
            </Select>

            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Meta
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Goals List */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : goals.length === 0 ? (
            <div className="text-center py-12">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold">No hay metas</p>
              <p className="text-sm text-muted-foreground">
                No se encontraron metas con los filtros aplicados
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nivel</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Meta</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Progreso</TableHead>
                  <TableHead>Fechas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {goals.map((goal) => {
                  const tipoConfig = TIPOS_CONFIG[goal.tipo];
                  const nivelConfig = NIVELES_CONFIG[goal.nivel];
                  const TipoIcon = tipoConfig.icon;

                  // Calculate progress percentage
                  const latestProgress = goal.progress?.[0];
                  const cumplimiento = latestProgress?.porcentajeCumplimiento || 0;
                  const valorAlcanzado = latestProgress?.valorAlcanzado || 0;

                  return (
                    <TableRow key={goal.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {goal.nombre}
                          {goal.tieneIncentivo && (
                            <Badge variant="outline" className="bg-warning-muted text-warning-muted-foreground">
                              Con incentivo
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TipoIcon className={cn('h-4 w-4', tipoConfig.color)} />
                          <span className="text-sm">{tipoConfig.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={nivelConfig.color}>{nivelConfig.label}</Badge>
                      </TableCell>
                      <TableCell>{PERIODOS_CONFIG[goal.periodo]}</TableCell>
                      <TableCell className="font-mono">
                        {goal.tipo.includes('MONTO') || goal.tipo === 'COBRANZAS'
                          ? `$${goal.metaValor.toLocaleString()}`
                          : goal.tipo === 'MARGEN' || goal.tipo === 'CONVERSION'
                          ? `${goal.metaValor}%`
                          : goal.metaValor.toString()}
                      </TableCell>
                      <TableCell>{goal.vendedor?.name || '-'}</TableCell>
                      <TableCell>
                        <div className="space-y-1 min-w-[200px]">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">
                              {formatNumber(cumplimiento, 1)}%
                            </span>
                            <span className="text-muted-foreground">
                              {goal.tipo.includes('MONTO') || goal.tipo === 'COBRANZAS'
                                ? `$${valorAlcanzado.toLocaleString()}`
                                : goal.tipo === 'MARGEN' || goal.tipo === 'CONVERSION'
                                ? `${valorAlcanzado}%`
                                : valorAlcanzado.toString()}
                            </span>
                          </div>
                          <Progress value={Math.min(cumplimiento, 100)} />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col gap-1">
                          <span>
                            {format(new Date(goal.fechaInicio), 'dd/MM/yy', {
                              locale: es,
                            })}
                          </span>
                          <span className="text-muted-foreground">
                            {format(new Date(goal.fechaFin), 'dd/MM/yy', {
                              locale: es,
                            })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {goal.isActive && !goal.isClosed && (
                            <Badge className="bg-success-muted text-success">
                              <Play className="mr-1 h-3 w-3" />
                              Activa
                            </Badge>
                          )}
                          {!goal.isActive && !goal.isClosed && (
                            <Badge className="bg-muted text-foreground">
                              <Pause className="mr-1 h-3 w-3" />
                              Inactiva
                            </Badge>
                          )}
                          {goal.isClosed && (
                            <Badge className="bg-muted text-muted-foreground">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Cerrada
                            </Badge>
                          )}
                        </div>
                      </TableCell>
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
                            <DropdownMenuItem>
                              <BarChart3 className="mr-2 h-4 w-4" />
                              Registrar progreso
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />

                            {goal.isActive && !goal.isClosed && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => desactivarMutation.mutate(goal.id)}
                                >
                                  <Pause className="mr-2 h-4 w-4" />
                                  Desactivar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => cerrarMutation.mutate(goal.id)}
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Cerrar meta
                                </DropdownMenuItem>
                              </>
                            )}

                            {!goal.isActive && !goal.isClosed && (
                              <DropdownMenuItem
                                onClick={() => activarMutation.mutate(goal.id)}
                              >
                                <Play className="mr-2 h-4 w-4" />
                                Activar
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
