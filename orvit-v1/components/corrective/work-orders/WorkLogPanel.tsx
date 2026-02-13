'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Plus,
  Clock,
  User,
  Wrench,
  Search,
  Timer,
  FileText,
  Truck,
  Package,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkLogPanelProps {
  workOrderId: number;
  className?: string;
}

interface WorkLog {
  id: number;
  activityType: string;
  description: string;
  performedBy: { id: number; name: string };
  startedAt: string;
  endedAt?: string;
  actualMinutes?: number;
}

const activityTypeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  EXECUTION: { label: 'Ejecución', icon: <Wrench className="h-4 w-4" />, color: 'bg-green-100 text-green-800' },
  DIAGNOSIS: { label: 'Diagnóstico', icon: <Search className="h-4 w-4" />, color: 'bg-blue-100 text-blue-800' },
  WAITING: { label: 'Espera', icon: <Timer className="h-4 w-4" />, color: 'bg-yellow-100 text-yellow-800' },
  TRAVEL: { label: 'Desplazamiento', icon: <Truck className="h-4 w-4" />, color: 'bg-purple-100 text-purple-800' },
  DOCUMENTATION: { label: 'Documentación', icon: <FileText className="h-4 w-4" />, color: 'bg-gray-100 text-gray-800' },
  INSPECTION: { label: 'Inspección', icon: <Search className="h-4 w-4" />, color: 'bg-cyan-100 text-cyan-800' },
  PARTS_PICKUP: { label: 'Retiro repuestos', icon: <Package className="h-4 w-4" />, color: 'bg-orange-100 text-orange-800' },
  OTHER: { label: 'Otro', icon: <HelpCircle className="h-4 w-4" />, color: 'bg-gray-100 text-gray-800' },
};

export function WorkLogPanel({ workOrderId, className }: WorkLogPanelProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    activityType: 'EXECUTION',
    description: '',
    actualMinutes: '',
  });

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['work-logs', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/work-orders/${workOrderId}/work-logs`);
      if (!res.ok) throw new Error('Error al cargar work logs');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (newLog: typeof formData) => {
      const res = await fetch(`/api/work-orders/${workOrderId}/work-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityType: newLog.activityType,
          description: newLog.description,
          actualMinutes: newLog.actualMinutes ? parseInt(newLog.actualMinutes) : undefined,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear registro');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-logs', workOrderId] });
      toast.success('Registro agregado exitosamente');
      setIsDialogOpen(false);
      setFormData({ activityType: 'EXECUTION', description: '', actualMinutes: '' });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      toast.error('La descripción es requerida');
      return;
    }
    createMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn('p-4', className)}>
        <p className="text-red-500 text-sm">Error al cargar registros de trabajo</p>
      </Card>
    );
  }

  const { data: workLogs, totalMinutes, totalHours } = data || {};

  return (
    <>
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base">Registros de Trabajo</CardTitle>
            {totalMinutes > 0 && (
              <p className="text-sm text-muted-foreground">
                Total: {totalHours}h ({totalMinutes} min)
              </p>
            )}
          </div>
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        </CardHeader>
        <CardContent>
          {workLogs && workLogs.length > 0 ? (
            <div className="space-y-3">
              {workLogs.map((log: WorkLog) => {
                const config = activityTypeConfig[log.activityType] || activityTypeConfig.OTHER;
                return (
                  <div
                    key={log.id}
                    className="flex gap-3 p-3 border rounded-lg"
                  >
                    {/* Icon */}
                    <div className={cn('p-2 rounded-full h-fit', config.color)}>
                      {config.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {config.label}
                        </Badge>
                        {log.actualMinutes && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {log.actualMinutes} min
                          </span>
                        )}
                      </div>

                      <p className="text-sm">{log.description}</p>

                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {log.performedBy?.name || 'Usuario'}
                        </span>
                        <span>
                          {new Date(log.startedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay registros de trabajo
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dialog para agregar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Registro de Trabajo</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Actividad</Label>
              <Select
                value={formData.activityType}
                onValueChange={(v) => setFormData({ ...formData, activityType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(activityTypeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        {config.icon}
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descripción *</Label>
              <Textarea
                placeholder="Describe la actividad realizada..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Tiempo (minutos)</Label>
              <Input
                type="number"
                placeholder="Opcional"
                value={formData.actualMinutes}
                onChange={(e) => setFormData({ ...formData, actualMinutes: e.target.value })}
                min="1"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default WorkLogPanel;
