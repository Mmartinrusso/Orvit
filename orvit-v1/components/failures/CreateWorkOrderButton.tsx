'use client';

/**
 * CreateWorkOrderButton - Botón para crear OT desde observación
 *
 * Permite convertir una observación (falla sin OT) en una
 * Orden de Trabajo Correctiva completa.
 *
 * P5: Integración Fallas → OT
 */

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  FileText,
  Plus,
  Loader2,
  AlertTriangle,
  Calendar,
  User,
  Flag,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// ============================================================
// TIPOS Y SCHEMA
// ============================================================

interface CreateWorkOrderButtonProps {
  failureOccurrenceId: number;
  failureTitle: string;
  machineName?: string;
  componentName?: string;
  priority?: string;
  isSafetyRelated?: boolean;
  causedDowntime?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  onSuccess?: (workOrder: any) => void;
}

const createWOSchema = z.object({
  title: z.string().min(5, 'Mínimo 5 caracteres').max(255),
  description: z.string().optional(),
  priority: z.enum(['P1', 'P2', 'P3', 'P4']),
  assignedToId: z.number().optional(),
  scheduledDate: z.string().optional(),
  estimatedMinutes: z.number().min(1).optional()
});

type CreateWOFormData = z.infer<typeof createWOSchema>;

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function CreateWorkOrderButton({
  failureOccurrenceId,
  failureTitle,
  machineName,
  componentName,
  priority = 'P3',
  isSafetyRelated = false,
  causedDowntime = false,
  disabled = false,
  variant = 'default',
  size = 'default',
  className,
  onSuccess
}: CreateWorkOrderButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  // Form
  const form = useForm<CreateWOFormData>({
    resolver: zodResolver(createWOSchema),
    defaultValues: {
      title: `Correctivo: ${failureTitle}`,
      description: '',
      priority: priority as 'P1' | 'P2' | 'P3' | 'P4',
      estimatedMinutes: 60
    }
  });

  // Mutation para crear OT
  const createMutation = useMutation({
    mutationFn: async (data: CreateWOFormData) => {
      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          type: 'CORRECTIVE',
          origin: 'FAILURE',
          failureOccurrenceId,
          isSafetyRelated,
          causedDowntime
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear OT');
      }

      return res.json();
    },
    onSuccess: (data) => {
      toast.success('Orden de Trabajo creada', {
        description: `OT #${data.workOrder?.id || 'nueva'} creada exitosamente`
      });

      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['failure-occurrences'] });
      queryClient.invalidateQueries({
        queryKey: ['failure-occurrence', failureOccurrenceId]
      });

      setIsOpen(false);
      form.reset();

      if (onSuccess) {
        onSuccess(data.workOrder);
      }
    },
    onError: (error: Error) => {
      toast.error('Error', { description: error.message });
    }
  });

  const handleSubmit = (data: CreateWOFormData) => {
    createMutation.mutate(data);
  };

  // Colores de prioridad
  const priorityColors: Record<string, string> = {
    P1: 'bg-destructive/10 text-destructive border-destructive/20',
    P2: 'bg-warning-muted text-warning-muted-foreground border-warning-muted',
    P3: 'bg-warning-muted text-warning-muted-foreground border-warning-muted',
    P4: 'bg-success-muted text-success border-success-muted'
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn('gap-2', className)}
        onClick={() => setIsOpen(true)}
        disabled={disabled}
      >
        <Plus className="h-4 w-4" />
        Crear OT
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-info-muted-foreground" />
              Crear Orden de Trabajo
            </DialogTitle>
            <DialogDescription>
              Crear OT correctiva desde la observación reportada
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
          {/* Info de la falla */}
          <div className="bg-muted rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground truncate">
                  {failureTitle}
                </p>
                {(machineName || componentName) && (
                  <p className="text-xs text-muted-foreground truncate">
                    {[machineName, componentName].filter(Boolean).join(' → ')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {isSafetyRelated && (
                <Badge variant="destructive" className="text-xs">
                  Seguridad
                </Badge>
              )}
              {causedDowntime && (
                <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">
                  Con Downtime
                </Badge>
              )}
            </div>
          </div>

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4" id="create-wo-form">
            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="title">Título de la OT *</Label>
              <Input
                id="title"
                {...form.register('title')}
                placeholder="Título descriptivo de la orden"
              />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            {/* Prioridad */}
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <div className="flex gap-2">
                {(['P1', 'P2', 'P3', 'P4'] as const).map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      'flex-1',
                      form.watch('priority') === p && priorityColors[p]
                    )}
                    onClick={() => form.setValue('priority', p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {form.watch('priority') === 'P1' && 'Urgente - Requiere atención inmediata'}
                {form.watch('priority') === 'P2' && 'Alta - Atender en las próximas horas'}
                {form.watch('priority') === 'P3' && 'Media - Programar para esta semana'}
                {form.watch('priority') === 'P4' && 'Baja - Programar cuando sea conveniente'}
              </p>
            </div>

            {/* Tiempo estimado */}
            <div className="space-y-2">
              <Label htmlFor="estimatedMinutes">Tiempo estimado (minutos)</Label>
              <Input
                id="estimatedMinutes"
                type="number"
                min="1"
                {...form.register('estimatedMinutes', { valueAsNumber: true })}
                placeholder="60"
              />
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="description">Descripción adicional</Label>
              <Textarea
                id="description"
                {...form.register('description')}
                placeholder="Instrucciones adicionales, contexto, etc..."
                rows={3}
              />
            </div>

          </form>
          </DialogBody>

          <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="create-wo-form"
                disabled={createMutation.isPending}
                className="gap-2"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Crear OT
                  </>
                )}
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CreateWorkOrderButton;
