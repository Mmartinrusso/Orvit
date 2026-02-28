'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/date-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Droplet,
  Plus,
  Search,
  RefreshCw,
  MapPin,
  Clock,
  CheckCircle2,
  Calendar,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface LubricationPoint {
  id: number;
  name: string;
  machine_name: string;
  location: string;
  lubricantType: string;
  lubricantBrand: string;
  quantity: number;
  quantityUnit: string;
  method: string;
  frequencyDays: number;
  execution_count: number;
  last_execution: string | null;
}

interface LubricationExecution {
  id: number;
  point_name: string;
  machine_name: string;
  executedAt: string;
  executed_by_name: string;
  lubricantUsed: string;
  quantityUsed: number;
  condition: string;
  observations: string;
}

export default function LubricationPage() {
  const { currentCompany } = useCompany();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('points');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const FORM_DEFAULT = { machineId: '', name: '', location: '', lubricantType: '', lubricantBrand: '', quantity: '', quantityUnit: 'ml', method: 'MANUAL', frequencyDays: '30', instructions: '' };
  const [form, setForm] = useState(FORM_DEFAULT);
  const patchForm = (patch: Partial<typeof FORM_DEFAULT>) => setForm(prev => ({ ...prev, ...patch }));

  const { data: machinesData } = useQuery({
    queryKey: ['machines-dropdown', currentCompany?.id],
    queryFn: async () => {
      const res = await fetch(`/api/machines?companyId=${currentCompany?.id}`);
      if (!res.ok) return { machines: [] };
      return res.json();
    },
    enabled: !!currentCompany?.id,
  });
  const machines = machinesData?.machines || [];

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/lubrication?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al eliminar');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Punto de lubricación eliminado');
      queryClient.invalidateQueries({ queryKey: ['lubrication-points'] });
    },
    onError: (err: any) => toast.error(err.message || 'Error al eliminar punto de lubricación'),
  });

  const handleDelete = (id: number) => {
    if (!confirm('¿Eliminar este punto de lubricación? Esta acción no se puede deshacer.')) return;
    deleteMutation.mutate(id);
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof FORM_DEFAULT) => {
      const res = await fetch('/api/lubrication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineId: parseInt(data.machineId),
          name: data.name,
          location: data.location || undefined,
          lubricantType: data.lubricantType,
          lubricantBrand: data.lubricantBrand || undefined,
          quantity: data.quantity ? parseFloat(data.quantity) : undefined,
          quantityUnit: data.quantityUnit,
          method: data.method,
          frequencyDays: parseInt(data.frequencyDays),
          instructions: data.instructions || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al crear');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Punto de lubricación creado');
      setIsDialogOpen(false);
      setForm(FORM_DEFAULT);
      queryClient.invalidateQueries({ queryKey: ['lubrication-points'] });
    },
    onError: (err: any) => toast.error(err.message || 'Error al crear punto de lubricación'),
  });

  const { data: pointsData, isLoading: loadingPoints, refetch: refetchPoints } = useQuery({
    queryKey: ['lubrication-points', currentCompany?.id],
    queryFn: async () => {
      const res = await fetch(`/api/lubrication?companyId=${currentCompany?.id}&view=points`);
      if (!res.ok) throw new Error('Error al cargar puntos');
      return res.json();
    },
    enabled: !!currentCompany?.id,
  });

  const { data: executionsData, isLoading: loadingExecutions, refetch: refetchExecutions } = useQuery({
    queryKey: ['lubrication-executions', currentCompany?.id],
    queryFn: async () => {
      const res = await fetch(`/api/lubrication?companyId=${currentCompany?.id}&view=executions`);
      if (!res.ok) throw new Error('Error al cargar ejecuciones');
      return res.json();
    },
    enabled: !!currentCompany?.id && activeTab === 'executions',
  });

  const points: LubricationPoint[] = pointsData?.points || [];
  const executions: LubricationExecution[] = executionsData?.executions || [];

  const filteredPoints = points.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.machine_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.lubricantType?.toLowerCase().includes(search.toLowerCase())
  );

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'MANUAL': return <Badge variant="outline">Manual</Badge>;
      case 'AUTOMATIC': return <Badge className="bg-info-muted text-info-muted-foreground">Automático</Badge>;
      case 'CENTRALIZED': return <Badge className="bg-purple-100 text-purple-800">Centralizado</Badge>;
      default: return <Badge variant="outline">{method}</Badge>;
    }
  };

  const getConditionBadge = (condition: string) => {
    switch (condition) {
      case 'NORMAL': return <Badge className="bg-success-muted text-success">Normal</Badge>;
      case 'CONTAMINATED': return <Badge className="bg-warning-muted text-warning-muted-foreground">Contaminado</Badge>;
      case 'LOW_LEVEL': return <Badge className="bg-warning-muted text-warning-muted-foreground">Bajo Nivel</Badge>;
      case 'NEEDS_REPLACEMENT': return <Badge className="bg-destructive/10 text-destructive">Reemplazar</Badge>;
      default: return <Badge variant="outline">{condition}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Droplet className="h-6 w-6 text-warning-muted-foreground" />
            Gestión de Lubricación
          </h1>
          <p className="text-muted-foreground">
            Puntos de lubricación, programación y ejecución
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { refetchPoints(); refetchExecutions(); }} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          {hasPermission('lubrication.create') && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Punto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Agregar Punto de Lubricación</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Máquina *</Label>
                  <Select value={form.machineId} onValueChange={v => patchForm({ machineId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar máquina..." />
                    </SelectTrigger>
                    <SelectContent>
                      {machines.map((m: any) => (
                        <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nombre del Punto *</Label>
                  <Input
                    placeholder="Ej: Rodamiento principal"
                    value={form.name}
                    onChange={e => patchForm({ name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ubicación</Label>
                  <Input
                    placeholder="Ej: Lado operador, parte superior"
                    value={form.location}
                    onChange={e => patchForm({ location: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Lubricante *</Label>
                    <Input
                      placeholder="Ej: Grasa EP2"
                      value={form.lubricantType}
                      onChange={e => patchForm({ lubricantType: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Marca</Label>
                    <Input
                      placeholder="Ej: Shell Alvania"
                      value={form.lubricantBrand}
                      onChange={e => patchForm({ lubricantBrand: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Cantidad</Label>
                    <Input
                      type="number"
                      placeholder="50"
                      value={form.quantity}
                      onChange={e => patchForm({ quantity: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unidad</Label>
                    <Select value={form.quantityUnit} onValueChange={v => patchForm({ quantityUnit: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ml">ml</SelectItem>
                        <SelectItem value="g">gramos</SelectItem>
                        <SelectItem value="cc">cc</SelectItem>
                        <SelectItem value="L">litros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Frecuencia (días)</Label>
                    <Input
                      type="number"
                      value={form.frequencyDays}
                      onChange={e => patchForm({ frequencyDays: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Instrucciones</Label>
                  <Textarea
                    placeholder="Instrucciones detalladas para la lubricación..."
                    value={form.instructions}
                    onChange={e => patchForm({ instructions: e.target.value })}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createMutation.mutate(form)}
                  disabled={!form.machineId || !form.name || !form.lubricantType || createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creando...' : 'Crear Punto'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Puntos Totales</p>
                <p className="text-2xl font-bold">{points.length}</p>
              </div>
              <MapPin className="h-8 w-8 text-warning-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Manuales</p>
                <p className="text-2xl font-bold">{points.filter(p => p.method === 'MANUAL').length}</p>
              </div>
              <Droplet className="h-8 w-8 text-info-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Automáticos</p>
                <p className="text-2xl font-bold">{points.filter(p => p.method === 'AUTOMATIC').length}</p>
              </div>
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ejecuciones Hoy</p>
                <p className="text-2xl font-bold text-success">
                  {executions.filter(e =>
                    new Date(e.executedAt).toDateString() === new Date().toDateString()
                  ).length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="points">Puntos de Lubricación</TabsTrigger>
            <TabsTrigger value="executions">Historial de Ejecuciones</TabsTrigger>
          </TabsList>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <TabsContent value="points" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Punto</TableHead>
                    <TableHead>Máquina</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Lubricante</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Última Ejecución</TableHead>
                    <TableHead>Ejecuciones</TableHead>
                    {(hasPermission('lubrication.edit') || hasPermission('lubrication.delete')) && (
                      <TableHead className="w-[60px]">Acciones</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPoints ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">Cargando puntos de lubricación...</TableCell>
                    </TableRow>
                  ) : filteredPoints.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No se encontraron puntos de lubricación
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPoints.map((point) => (
                      <TableRow key={point.id}>
                        <TableCell className="font-medium">{point.name}</TableCell>
                        <TableCell>{point.machine_name}</TableCell>
                        <TableCell>{point.location || '-'}</TableCell>
                        <TableCell>
                          <div>
                            <p>{point.lubricantType}</p>
                            {point.lubricantBrand && (
                              <p className="text-xs text-muted-foreground">{point.lubricantBrand}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{point.quantity} {point.quantityUnit}</TableCell>
                        <TableCell>{getMethodBadge(point.method)}</TableCell>
                        <TableCell>
                          {point.last_execution ? (
                            <span className="text-sm">
                              {formatDistanceToNow(new Date(point.last_execution), { addSuffix: true, locale: es })}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{point.execution_count}</Badge>
                        </TableCell>
                        {(hasPermission('lubrication.edit') || hasPermission('lubrication.delete')) && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {hasPermission('lubrication.edit') && (
                                  <DropdownMenuItem onClick={() => toast.info('Edición de punto próximamente')}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                )}
                                {hasPermission('lubrication.delete') && (
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleDelete(point.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="executions" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Punto</TableHead>
                    <TableHead>Máquina</TableHead>
                    <TableHead>Ejecutado por</TableHead>
                    <TableHead>Lubricante</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Condición</TableHead>
                    <TableHead>Observaciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingExecutions ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">Cargando registros de lubricación...</TableCell>
                    </TableRow>
                  ) : executions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No hay ejecuciones registradas
                      </TableCell>
                    </TableRow>
                  ) : (
                    executions.map((exec) => (
                      <TableRow key={exec.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDateTime(exec.executedAt)}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{exec.point_name}</TableCell>
                        <TableCell>{exec.machine_name}</TableCell>
                        <TableCell>{exec.executed_by_name}</TableCell>
                        <TableCell>{exec.lubricantUsed || '-'}</TableCell>
                        <TableCell>{exec.quantityUsed || '-'}</TableCell>
                        <TableCell>{exec.condition ? getConditionBadge(exec.condition) : '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{exec.observations || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
