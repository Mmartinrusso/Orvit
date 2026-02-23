'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatDate } from '@/lib/date-utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  DollarSign,
  Calendar,
  CheckCircle,
} from 'lucide-react';

interface Rate {
  id: number;
  categoryId: number;
  gremio: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  dailyRate: number;
  hourlyRate: number | null;
  presenteeismRate: number | null;
  seniorityPct: number | null;
  notes: string | null;
  isCurrent: boolean;
}

interface RatesResponse {
  category: {
    id: number;
    name: string;
    gremio: string | null;
  };
  rates: Rate[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(value);
}

// formatDate imported from @/lib/date-utils

export default function TasasPage() {
  const confirm = useConfirm();
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const categoryId = params.id as string;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<Rate | null>(null);
  const [formData, setFormData] = useState({
    gremio: '',
    effectiveFrom: '',
    effectiveTo: '',
    dailyRate: '',
    hourlyRate: '',
    presenteeismRate: '',
    seniorityPct: '',
    notes: '',
  });

  // Fetch rates
  const { data, isLoading, error } = useQuery<RatesResponse>({
    queryKey: ['category-rates', categoryId],
    queryFn: async () => {
      const res = await fetch(`/api/nominas/categorias/${categoryId}/tasas`);
      if (!res.ok) throw new Error('Error al cargar tasas');
      return res.json();
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (rateData: typeof formData) => {
      const res = await fetch(`/api/nominas/categorias/${categoryId}/tasas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rateData,
          dailyRate: parseFloat(rateData.dailyRate),
          hourlyRate: rateData.hourlyRate ? parseFloat(rateData.hourlyRate) : null,
          presenteeismRate: rateData.presenteeismRate ? parseFloat(rateData.presenteeismRate) : null,
          seniorityPct: rateData.seniorityPct ? parseFloat(rateData.seniorityPct) : null,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear tasa');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-rates', categoryId] });
      toast.success('Tasa creada correctamente');
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (rateData: typeof formData & { id: number }) => {
      const res = await fetch(`/api/nominas/tasas/${rateData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rateData,
          dailyRate: parseFloat(rateData.dailyRate),
          hourlyRate: rateData.hourlyRate ? parseFloat(rateData.hourlyRate) : null,
          presenteeismRate: rateData.presenteeismRate ? parseFloat(rateData.presenteeismRate) : null,
          seniorityPct: rateData.seniorityPct ? parseFloat(rateData.seniorityPct) : null,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al actualizar tasa');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-rates', categoryId] });
      toast.success('Tasa actualizada');
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/nominas/tasas/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al eliminar tasa');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-rates', categoryId] });
      toast.success('Tasa eliminada');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleOpenDialog = (rate?: Rate) => {
    if (rate) {
      setEditingRate(rate);
      setFormData({
        gremio: rate.gremio,
        effectiveFrom: rate.effectiveFrom.split('T')[0],
        effectiveTo: rate.effectiveTo ? rate.effectiveTo.split('T')[0] : '',
        dailyRate: String(rate.dailyRate),
        hourlyRate: rate.hourlyRate ? String(rate.hourlyRate) : '',
        presenteeismRate: rate.presenteeismRate ? String(rate.presenteeismRate) : '',
        seniorityPct: rate.seniorityPct ? String(rate.seniorityPct) : '',
        notes: rate.notes || '',
      });
    } else {
      setEditingRate(null);
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        gremio: data?.category.gremio || '',
        effectiveFrom: today,
        effectiveTo: '',
        dailyRate: '',
        hourlyRate: '',
        presenteeismRate: '',
        seniorityPct: '',
        notes: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRate(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRate) {
      updateMutation.mutate({ ...formData, id: editingRate.id });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6">
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">Error al cargar las tasas</p>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>
              Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border">
        <div className="px-4 md:px-6 py-3 flex items-start gap-4 justify-between">
          <div className="min-w-0">
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 -ml-2"
              onClick={() => router.push('/administracion/nominas/categorias')}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver a Categorías
            </Button>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
              Tasas de Convenio - {data.category.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {data.category.gremio || 'Sin gremio asignado'}
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Tasa
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 pb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Historial de Tasas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.rates.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">
                  No hay tasas de convenio registradas
                </p>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Primera Tasa
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vigencia</TableHead>
                    <TableHead className="text-right">Valor Día</TableHead>
                    <TableHead className="text-right">Valor Hora</TableHead>
                    <TableHead className="text-right">Presentismo</TableHead>
                    <TableHead className="text-right">Antigüedad %</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rates.map((rate) => (
                    <TableRow key={rate.id}>
                      <TableCell>
                        <div className="text-sm">
                          {formatDate(rate.effectiveFrom)}
                          {rate.effectiveTo && (
                            <span className="text-muted-foreground">
                              {' '} - {formatDate(rate.effectiveTo)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(rate.dailyRate)}
                      </TableCell>
                      <TableCell className="text-right">
                        {rate.hourlyRate ? formatCurrency(rate.hourlyRate) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {rate.presenteeismRate ? formatCurrency(rate.presenteeismRate) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {rate.seniorityPct ? `${rate.seniorityPct}%` : '-'}
                      </TableCell>
                      <TableCell>
                        {rate.isCurrent ? (
                          <Badge className="bg-success-muted text-success">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Vigente
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Histórico</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(rate)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              const ok = await confirm({
                                title: 'Eliminar tasa',
                                description: '¿Eliminar esta tasa?',
                                confirmText: 'Eliminar',
                                variant: 'destructive',
                              });
                              if (ok) {
                                deleteMutation.mutate(rate.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-4">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              <strong>Nota:</strong> Al agregar una nueva tasa, la tasa anterior se cierra automáticamente.
              Los empleados de esta categoría que tengan conceptos vinculados a convenio
              (AGREEMENT_LINKED) actualizarán sus valores automáticamente.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingRate ? 'Editar Tasa' : 'Nueva Tasa de Convenio'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="effectiveFrom">Vigente Desde *</Label>
                  <Input
                    id="effectiveFrom"
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="effectiveTo">Vigente Hasta</Label>
                  <Input
                    id="effectiveTo"
                    type="date"
                    value={formData.effectiveTo}
                    onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="dailyRate">Valor Día *</Label>
                  <Input
                    id="dailyRate"
                    type="number"
                    step="0.01"
                    value={formData.dailyRate}
                    onChange={(e) => setFormData({ ...formData, dailyRate: e.target.value })}
                    placeholder="24451.59"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="hourlyRate">Valor Hora</Label>
                  <Input
                    id="hourlyRate"
                    type="number"
                    step="0.01"
                    value={formData.hourlyRate}
                    onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="presenteeismRate">Presentismo/Día</Label>
                  <Input
                    id="presenteeismRate"
                    type="number"
                    step="0.01"
                    value={formData.presenteeismRate}
                    onChange={(e) => setFormData({ ...formData, presenteeismRate: e.target.value })}
                    placeholder="2444.79"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="seniorityPct">% Antigüedad/Año</Label>
                  <Input
                    id="seniorityPct"
                    type="number"
                    step="0.01"
                    value={formData.seniorityPct}
                    onChange={(e) => setFormData({ ...formData, seniorityPct: e.target.value })}
                    placeholder="1.5"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notas</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ej: Acuerdo paritarias Oct 2025"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending)
                  ? 'Guardando...'
                  : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
