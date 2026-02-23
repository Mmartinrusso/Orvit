'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus,
  ChevronLeft,
  Loader2,
  TrendingUp,
  TrendingDown,
  Wand2,
  RefreshCcw,
  AlertTriangle,
  Users,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PayrollUnion {
  id: number;
  name: string;
  code: string | null;
}

interface SalaryComponent {
  id: number;
  code: string;
  name: string;
  type: string;
  calcType: string;
  calcValue: number | null;
  calcFormula: string | null;
  isActive: boolean;
  unionId: number | null;
  unionName: string | null;
}

export default function ComponentesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterUnionId, setFilterUnionId] = useState<string>('all');
  const [newComponent, setNewComponent] = useState({
    code: '',
    name: '',
    unionId: '', // '' = global
    type: 'EARNING',
    calcType: 'FIXED',
    calcValue: 0,
    calcFormula: '',
    order: 0,
  });

  // Fetch gremios
  const { data: unionsData } = useQuery<{ unions: PayrollUnion[] }>({
    queryKey: ['payroll-unions'],
    queryFn: async () => {
      const res = await fetch('/api/nominas/gremios');
      if (!res.ok) throw new Error('Error al cargar gremios');
      return res.json();
    },
  });

  // Fetch componentes
  const { data: componentsData, isLoading, error, refetch, isFetching } = useQuery<SalaryComponent[]>({
    queryKey: ['salary-components', filterUnionId],
    queryFn: async () => {
      let url = '/api/nominas/componentes?includeInactive=true';
      if (filterUnionId && filterUnionId !== 'all') {
        url += `&unionId=${filterUnionId}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Error al cargar componentes');
      return res.json();
    },
  });

  // Crear componente
  const createMutation = useMutation({
    mutationFn: async (data: typeof newComponent) => {
      const res = await fetch('/api/nominas/componentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: data.code,
          name: data.name,
          unionId: data.unionId || null,
          type: data.type,
          calcType: data.calcType,
          calcValue: data.calcValue,
          calcFormula: data.calcFormula,
          order: data.order,
          conceptType: 'FIXED_INPUT',
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear componente');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salary-components'] });
      toast.success('Componente creado');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setNewComponent({
      code: '',
      name: '',
      unionId: '',
      type: 'EARNING',
      calcType: 'FIXED',
      calcValue: 0,
      calcFormula: '',
      order: 0,
    });
  };

  const initializeDefaults = async () => {
    try {
      const res = await fetch('/api/payroll/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initializeDefaults: true }),
      });

      if (res.ok) {
        toast.success('Componentes inicializados');
        refetch();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error al inicializar');
      }
    } catch {
      toast.error('Error al inicializar componentes');
    }
  };

  const handleCreate = () => {
    createMutation.mutate(newComponent);
  };

  const components = componentsData || [];

  // Filtrar por gremio si es necesario
  const filteredComponents = filterUnionId === 'all'
    ? components
    : filterUnionId === 'global'
      ? components.filter(c => c.unionId === null)
      : components;

  const earnings = filteredComponents.filter((c) => c.type === 'EARNING');
  const deductions = filteredComponents.filter((c) => c.type === 'DEDUCTION');

  // Loading
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6 grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-6">
            <Skeleton className="h-80" />
          </div>
          <div className="col-span-12 lg:col-span-6">
            <Skeleton className="h-80" />
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Componentes Salariales</h1>
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6">
          <Card>
            <CardContent className="py-10 text-center">
              <AlertTriangle className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">Error al cargar los componentes</p>
              <Button onClick={() => refetch()} variant="outline">
                <RefreshCcw className="w-4 h-4 mr-2" />
                Reintentar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border">
        <div className="px-4 md:px-6 py-3 flex items-start gap-4 justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/administracion/nominas')}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Componentes Salariales</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Fórmulas de haberes y descuentos por gremio
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {components.length === 0 && (
              <Button variant="outline" size="sm" onClick={initializeDefaults} className="h-8">
                <Wand2 className="mr-2 h-3.5 w-3.5" />
                Inicializar Defaults
              </Button>
            )}
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className={cn(
                'inline-flex items-center border border-border rounded-md p-0.5 bg-muted/40 h-7',
                'px-2 text-xs font-normal gap-1.5',
                'hover:bg-muted disabled:opacity-50',
                isFetching && 'bg-background shadow-sm'
              )}
            >
              <RefreshCcw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              Actualizar
            </button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8">
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Nuevo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nuevo Componente Salarial</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* Selector de Gremio */}
                  <div className="space-y-2">
                    <Label className="text-xs">Gremio</Label>
                    <Select
                      value={newComponent.unionId || 'global'}
                      onValueChange={(v) => setNewComponent({ ...newComponent, unionId: v === 'global' ? '' : v })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Global (todos los gremios)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">
                          <div className="flex items-center gap-2">
                            <Globe className="h-3.5 w-3.5" />
                            Global (todos los gremios)
                          </div>
                        </SelectItem>
                        {unionsData?.unions.map((union) => (
                          <SelectItem key={union.id} value={union.id.toString()}>
                            <div className="flex items-center gap-2">
                              <Users className="h-3.5 w-3.5" />
                              {union.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Los componentes globales aplican a todos los empleados. Los específicos solo al gremio seleccionado.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Código</Label>
                      <Input
                        value={newComponent.code}
                        onChange={(e) => setNewComponent({ ...newComponent, code: e.target.value.toUpperCase() })}
                        placeholder="PRESENTISMO"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Nombre</Label>
                      <Input
                        value={newComponent.name}
                        onChange={(e) => setNewComponent({ ...newComponent, name: e.target.value })}
                        placeholder="Presentismo"
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Tipo</Label>
                      <Select
                        value={newComponent.type}
                        onValueChange={(v) => setNewComponent({ ...newComponent, type: v })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EARNING">Haberes (+)</SelectItem>
                          <SelectItem value="DEDUCTION">Descuento (-)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Tipo de Cálculo</Label>
                      <Select
                        value={newComponent.calcType}
                        onValueChange={(v) => setNewComponent({ ...newComponent, calcType: v })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FIXED">Fijo</SelectItem>
                          <SelectItem value="PERCENTAGE">Porcentaje</SelectItem>
                          <SelectItem value="FORMULA">Fórmula</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {newComponent.calcType === 'PERCENTAGE' && (
                    <div className="space-y-2">
                      <Label className="text-xs">Porcentaje (%)</Label>
                      <Input
                        type="number"
                        value={newComponent.calcValue}
                        onChange={(e) => setNewComponent({ ...newComponent, calcValue: parseFloat(e.target.value) })}
                        className="h-9"
                      />
                    </div>
                  )}

                  {newComponent.calcType === 'FIXED' && (
                    <div className="space-y-2">
                      <Label className="text-xs">Valor Fijo</Label>
                      <Input
                        type="number"
                        value={newComponent.calcValue}
                        onChange={(e) => setNewComponent({ ...newComponent, calcValue: parseFloat(e.target.value) })}
                        className="h-9"
                      />
                    </div>
                  )}

                  {newComponent.calcType === 'FORMULA' && (
                    <div className="space-y-2">
                      <Label className="text-xs">Fórmula</Label>
                      <Input
                        value={newComponent.calcFormula}
                        onChange={(e) => setNewComponent({ ...newComponent, calcFormula: e.target.value })}
                        placeholder="base * 0.0833"
                        className="h-9"
                      />
                      <p className="text-xs text-muted-foreground">
                        Variables: base, gross, years, months, days_worked, days_in_period
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs">Orden</Label>
                    <Input
                      type="number"
                      value={newComponent.order}
                      onChange={(e) => setNewComponent({ ...newComponent, order: parseInt(e.target.value) })}
                      className="h-9"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={createMutation.isPending || !newComponent.code || !newComponent.name}
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Crear
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Filtro por Gremio */}
      <div className="px-4 md:px-6">
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium">Filtrar por Gremio:</Label>
          <Select value={filterUnionId} onValueChange={setFilterUnionId}>
            <SelectTrigger className="w-[250px] h-9">
              <SelectValue placeholder="Todos los gremios" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  Todos los componentes
                </div>
              </SelectItem>
              <SelectItem value="global">
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" />
                  Solo Globales
                </div>
              </SelectItem>
              {unionsData?.unions.map((union) => (
                <SelectItem key={union.id} value={union.id.toString()}>
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" />
                    {union.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 pb-6 grid grid-cols-12 gap-4 md:gap-6">
        {/* Haberes */}
        <div className="col-span-12 lg:col-span-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-success" />
                Haberes
              </CardTitle>
              <CardDescription className="text-xs">Conceptos que suman al sueldo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {earnings.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No hay haberes configurados</p>
                ) : (
                  earnings.map((c) => (
                    <div
                      key={c.id}
                      className="flex justify-between items-center p-3 rounded-lg bg-success-muted/50 border border-success-muted"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{c.name}</p>
                          {c.unionId ? (
                            <Badge variant="outline" className="text-[9px] shrink-0">
                              <Users className="h-2.5 w-2.5 mr-1" />
                              {c.unionName}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[9px] shrink-0">
                              <Globe className="h-2.5 w-2.5 mr-1" />
                              Global
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {c.calcType === 'PERCENTAGE' && `${c.calcValue}%`}
                          {c.calcType === 'FIXED' && `$${c.calcValue}`}
                          {c.calcType === 'FORMULA' && c.calcFormula}
                        </p>
                      </div>
                      <Badge variant={c.isActive ? 'default' : 'secondary'} className="text-xs ml-2">
                        {c.code}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Descuentos */}
        <div className="col-span-12 lg:col-span-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-destructive" />
                Descuentos
              </CardTitle>
              <CardDescription className="text-xs">Conceptos que se deducen del sueldo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {deductions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No hay descuentos configurados</p>
                ) : (
                  deductions.map((c) => (
                    <div
                      key={c.id}
                      className="flex justify-between items-center p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{c.name}</p>
                          {c.unionId ? (
                            <Badge variant="outline" className="text-[9px] shrink-0">
                              <Users className="h-2.5 w-2.5 mr-1" />
                              {c.unionName}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[9px] shrink-0">
                              <Globe className="h-2.5 w-2.5 mr-1" />
                              Global
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {c.calcType === 'PERCENTAGE' && `${c.calcValue}%`}
                          {c.calcType === 'FIXED' && `$${c.calcValue}`}
                          {c.calcType === 'FORMULA' && c.calcFormula}
                        </p>
                      </div>
                      <Badge variant="destructive" className="text-xs ml-2">
                        {c.code}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
