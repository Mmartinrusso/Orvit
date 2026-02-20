'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import {
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  DollarSign,
  Calendar,
  CheckCircle2,
} from 'lucide-react';

interface Rate {
  id: number;
  companyId: number;
  unionCategoryId: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  dailyRate: number;
  hourlyRate: number | null;
  presenteeismRate: number | null;
  seniorityPct: number | null;
  notes: string | null;
  createdAt: string;
  isCurrent: boolean;
}

interface RatesResponse {
  category: {
    id: number;
    name: string;
    code: string | null;
    unionName: string;
    conventionCode: string | null;
  };
  rates: Rate[];
  currentRate: Rate | null;
  total: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function TasasPage() {
  const confirm = useConfirm();
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const unionId = params.id as string;
  const categoryId = params.categoryId as string;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<Rate | null>(null);
  const [formData, setFormData] = useState({
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
    queryKey: ['union-category-rates', unionId, categoryId],
    queryFn: async () => {
      const res = await fetch(
        `/api/nominas/gremios/${unionId}/categorias/${categoryId}/tasas?includeHistorical=true`
      );
      if (!res.ok) throw new Error('Error al cargar tasas');
      return res.json();
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { rateId?: number }) => {
      const method = data.rateId ? 'PUT' : 'POST';
      const body = {
        ...data,
        dailyRate: parseFloat(data.dailyRate),
        hourlyRate: data.hourlyRate ? parseFloat(data.hourlyRate) : null,
        presenteeismRate: data.presenteeismRate ? parseFloat(data.presenteeismRate) : null,
        seniorityPct: data.seniorityPct ? parseFloat(data.seniorityPct) : null,
      };

      const res = await fetch(`/api/nominas/gremios/${unionId}/categorias/${categoryId}/tasas`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al guardar');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['union-category-rates', unionId, categoryId] });
      toast.success(editingRate ? 'Tasa actualizada' : 'Tasa creada');
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (rateId: number) => {
      const res = await fetch(
        `/api/nominas/gremios/${unionId}/categorias/${categoryId}/tasas?rateId=${rateId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al eliminar');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['union-category-rates', unionId, categoryId] });
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
        effectiveFrom: rate.effectiveFrom.split('T')[0],
        effectiveTo: rate.effectiveTo ? rate.effectiveTo.split('T')[0] : '',
        dailyRate: rate.dailyRate.toString(),
        hourlyRate: rate.hourlyRate?.toString() || '',
        presenteeismRate: rate.presenteeismRate?.toString() || '',
        seniorityPct: rate.seniorityPct?.toString() || '',
        notes: rate.notes || '',
      });
    } else {
      setEditingRate(null);
      const today = new Date().toISOString().split('T')[0];
      setFormData({
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
    saveMutation.mutate({
      ...formData,
      rateId: editingRate?.id,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="border-b border-border">
          <div className="px-4 md:px-6 py-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">Error al cargar las tasas</p>
            <Button variant="outline" className="mt-4" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const category = data?.category;
  const rates = data?.rates || [];
  const currentRate = data?.currentRate;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border">
        <div className="px-4 md:px-6 py-3 flex items-start gap-4 justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => router.push('/administracion/nominas/gremios')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
                Tasas de Convenio
              </h1>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground ml-10">
              <span>{category?.unionName}</span>
              <span>•</span>
              <span className="font-medium">{category?.name}</span>
              {category?.conventionCode && (
                <>
                  <span>•</span>
                  <Badge variant="secondary">CCT {category.conventionCode}</Badge>
                </>
              )}
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Tasa
              </Button>
            </DialogTrigger>
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
                      <p className="text-xs text-muted-foreground">
                        Dejar vacio si esta vigente
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="dailyRate">Valor Dia *</Label>
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
                        placeholder="3056.45"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="presenteeismRate">Presentismo/Dia</Label>
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
                      <Label htmlFor="seniorityPct">% Antiguedad/Año</Label>
                      <Input
                        id="seniorityPct"
                        type="number"
                        step="0.01"
                        value={formData.seniorityPct}
                        onChange={(e) => setFormData({ ...formData, seniorityPct: e.target.value })}
                        placeholder="1"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="notes">Notas</Label>
                    <Input
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Ej: Acuerdo paritario Oct 2025"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Current Rate Card */}
      {currentRate && (
        <div className="px-4 md:px-6">
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Tasa Vigente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Valor Dia</div>
                  <div className="text-lg font-semibold">{formatCurrency(currentRate.dailyRate)}</div>
                </div>
                {currentRate.hourlyRate && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Valor Hora</div>
                    <div className="text-lg font-semibold">{formatCurrency(currentRate.hourlyRate)}</div>
                  </div>
                )}
                {currentRate.presenteeismRate && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Presentismo/Dia</div>
                    <div className="text-lg font-semibold">{formatCurrency(currentRate.presenteeismRate)}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Desde</div>
                  <div className="text-lg font-semibold">{formatDate(currentRate.effectiveFrom)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Content */}
      <div className="px-4 md:px-6 pb-6 space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Historial de Tasas</h2>

        {rates.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Sin tasas</h3>
              <p className="text-muted-foreground mb-4">
                Crea la primera tasa de convenio para esta categoria
              </p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Crear Tasa
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {rates.map((rate) => (
              <Card
                key={rate.id}
                className={rate.isCurrent ? 'border-primary/30' : ''}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {formatDate(rate.effectiveFrom)}
                          </span>
                          <span className="text-muted-foreground">-</span>
                          <span className="font-medium">
                            {rate.effectiveTo ? formatDate(rate.effectiveTo) : 'Vigente'}
                          </span>
                        </div>
                        {rate.isCurrent && (
                          <Badge variant="default" className="bg-primary">Actual</Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Dia: </span>
                          <span className="font-medium">{formatCurrency(rate.dailyRate)}</span>
                        </div>
                        {rate.hourlyRate && (
                          <div>
                            <span className="text-muted-foreground">Hora: </span>
                            <span className="font-medium">{formatCurrency(rate.hourlyRate)}</span>
                          </div>
                        )}
                        {rate.presenteeismRate && (
                          <div>
                            <span className="text-muted-foreground">Presentismo: </span>
                            <span className="font-medium">{formatCurrency(rate.presenteeismRate)}</span>
                          </div>
                        )}
                        {rate.seniorityPct && (
                          <div>
                            <span className="text-muted-foreground">Antiguedad: </span>
                            <span className="font-medium">{rate.seniorityPct}%/año</span>
                          </div>
                        )}
                      </div>

                      {rate.notes && (
                        <p className="text-sm text-muted-foreground mt-2">{rate.notes}</p>
                      )}
                    </div>

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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
