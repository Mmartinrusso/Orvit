'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
} from '@/components/ui/dialog';
import {
  Plus,
  ChevronLeft,
  Loader2,
  Check,
  X,
  CreditCard,
  RefreshCcw,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  usePayrollAdvances,
  useCreateAdvance,
  useUpdateAdvance,
} from '@/hooks/use-payroll-dashboard';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: 'Pendiente', variant: 'secondary' },
  APPROVED: { label: 'Aprobado', variant: 'default' },
  ACTIVE: { label: 'Activo', variant: 'default' },
  COMPLETED: { label: 'Completado', variant: 'outline' },
  REJECTED: { label: 'Rechazado', variant: 'destructive' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
};

export default function AdelantosPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [newAdvance, setNewAdvance] = useState({
    employeeId: '',
    amount: 0,
    installmentsCount: 1,
    notes: '',
  });

  const { data, isLoading, error, refetch, isFetching } = usePayrollAdvances(filter);
  const createAdvanceMutation = useCreateAdvance();
  const updateAdvanceMutation = useUpdateAdvance();

  const handleCreateAdvance = async () => {
    if (!newAdvance.employeeId || newAdvance.amount <= 0) {
      toast({ title: 'Complete todos los campos', variant: 'destructive' });
      return;
    }

    try {
      await createAdvanceMutation.mutateAsync(newAdvance);
      toast({ title: 'Adelanto creado' });
      setDialogOpen(false);
      setNewAdvance({ employeeId: '', amount: 0, installmentsCount: 1, notes: '' });
    } catch (error) {
      toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await updateAdvanceMutation.mutateAsync({ id, action: 'approve' });
      toast({ title: 'Adelanto aprobado' });
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Motivo del rechazo:');
    if (!reason) return;

    try {
      await updateAdvanceMutation.mutateAsync({ id, action: 'reject', rejectReason: reason });
      toast({ title: 'Adelanto rechazado' });
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);

  const advances = data?.advances || [];

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
        <div className="px-4 md:px-6 pb-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
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
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Adelantos de Sueldo</h1>
          </div>
        </div>
        <div className="px-4 md:px-6 pb-6">
          <Card>
            <CardContent className="py-10 text-center">
              <AlertTriangle className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">Error al cargar los adelantos</p>
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
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Adelantos de Sueldo</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Solicitudes y aprobaciones de adelantos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className={cn(
                'inline-flex items-center border border-border rounded-md p-0.5 bg-muted/40 h-7',
                'px-2 text-[11px] font-normal gap-1.5',
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
                  Nuevo Adelanto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Solicitar Adelanto</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Empleado ID</Label>
                    <Input
                      value={newAdvance.employeeId}
                      onChange={(e) => setNewAdvance({ ...newAdvance, employeeId: e.target.value })}
                      placeholder="ID del empleado"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Monto</Label>
                    <Input
                      type="number"
                      value={newAdvance.amount}
                      onChange={(e) => setNewAdvance({ ...newAdvance, amount: parseFloat(e.target.value) })}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Cuotas</Label>
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={newAdvance.installmentsCount}
                      onChange={(e) => setNewAdvance({ ...newAdvance, installmentsCount: parseInt(e.target.value) })}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Notas</Label>
                    <Input
                      value={newAdvance.notes}
                      onChange={(e) => setNewAdvance({ ...newAdvance, notes: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <Button
                    onClick={handleCreateAdvance}
                    className="w-full h-9"
                    disabled={createAdvanceMutation.isPending}
                  >
                    {createAdvanceMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Crear Adelanto
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 pb-6 space-y-4">
        {/* Filtros */}
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PENDING">Pendientes</SelectItem>
              <SelectItem value="APPROVED">Aprobados</SelectItem>
              <SelectItem value="ACTIVE">Activos</SelectItem>
              <SelectItem value="COMPLETED">Completados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista de adelantos */}
        {advances.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <CreditCard className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No hay adelantos</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {advances.map((adv) => (
              <Card key={adv.id}>
                <CardContent className="py-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{adv.employeeName}</h3>
                        <Badge variant={statusConfig[adv.status]?.variant || 'secondary'} className="text-[10px]">
                          {statusConfig[adv.status]?.label || adv.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{adv.employeeRole}</p>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Monto: </span>
                          <span className="font-medium">{formatCurrency(adv.amount)}</span>
                          {adv.installmentsCount > 1 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({adv.installmentsCount} cuotas de {formatCurrency(adv.installmentAmount)})
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Pendiente: </span>
                          <span className="font-medium">{formatCurrency(adv.remainingAmount)}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Solicitado: {new Date(adv.requestDate).toLocaleDateString('es-AR')}
                      </p>
                    </div>

                    {adv.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-success border-success-muted hover:bg-success-muted"
                          onClick={() => handleApprove(adv.id)}
                          disabled={updateAdvanceMutation.isPending}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => handleReject(adv.id)}
                          disabled={updateAdvanceMutation.isPending}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Rechazar
                        </Button>
                      </div>
                    )}
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
