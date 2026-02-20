'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Star, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { useAddSolution } from '@/hooks/maintenance/use-failure-solutions';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';

interface AddSolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  occurrenceId: number;
  failureTitle?: string;
  onSuccess?: () => void;
  employees?: { id: number; name: string }[];
  currentUserId?: number;
}

interface SolutionFormData {
  title: string;
  description: string;
  appliedById: string;
  appliedAt: string;
  actualHours: string;
  timeUnit: 'hours' | 'minutes';
  rootCause: string;
  preventiveActions: string;
  effectiveness: number | null;
  isPreferred: boolean;
}

export function AddSolutionDialog({
  open,
  onOpenChange,
  occurrenceId,
  failureTitle,
  onSuccess,
  employees = [],
  currentUserId,
}: AddSolutionDialogProps) {
  const { toast } = useToast();
  const addSolution = useAddSolution(occurrenceId);

  const [formData, setFormData] = useState<SolutionFormData>({
    title: '',
    description: '',
    appliedById: currentUserId ? String(currentUserId) : '',
    appliedAt: format(new Date(), 'yyyy-MM-dd'),
    actualHours: '',
    timeUnit: 'hours',
    rootCause: '',
    preventiveActions: '',
    effectiveness: null,
    isPreferred: false,
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        title: failureTitle ? `Solución para: ${failureTitle}` : '',
        description: '',
        appliedById: currentUserId ? String(currentUserId) : '',
        appliedAt: format(new Date(), 'yyyy-MM-dd'),
        actualHours: '',
        timeUnit: 'hours',
        rootCause: '',
        preventiveActions: '',
        effectiveness: null,
        isPreferred: false,
      });
    }
  }, [open, failureTitle, currentUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast({
        title: 'Error',
        description: 'El título de la solución es requerido',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.description.trim()) {
      toast({
        title: 'Error',
        description: 'La descripción de la solución es requerida',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.appliedById) {
      toast({
        title: 'Error',
        description: 'Selecciona quién aplicó la solución',
        variant: 'destructive',
      });
      return;
    }

    try {
      await addSolution.mutateAsync({
        title: formData.title.trim(),
        description: formData.description,
        appliedById: parseInt(formData.appliedById),
        appliedAt: formData.appliedAt,
        actualHours: formData.actualHours ? parseFloat(formData.actualHours) : undefined,
        timeUnit: formData.timeUnit,
        rootCause: formData.rootCause || undefined,
        preventiveActions: formData.preventiveActions || undefined,
        effectiveness: formData.effectiveness || undefined,
        isPreferred: formData.isPreferred,
      });

      toast({
        title: 'Solución agregada',
        description: 'La solución se ha registrado exitosamente',
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message || 'Error al agregar la solución',
        variant: 'destructive',
      });
    }
  };

  const handleEffectivenessClick = (rating: number) => {
    setFormData(prev => ({
      ...prev,
      effectiveness: prev.effectiveness === rating ? null : rating,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Agregar Nueva Solución</DialogTitle>
          <DialogDescription>
            Documenta una solución aplicada a esta falla. Puedes agregar múltiples soluciones.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs font-medium">
              Título de la solución *
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ej: Reemplazo de rodamiento principal"
            />
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Descripción detallada *</Label>
            <RichTextEditor
              content={formData.description}
              onChange={(content) => setFormData(prev => ({ ...prev, description: content }))}
              placeholder="Describe en detalle cómo se solucionó el problema..."
              minHeight="120px"
            />
          </div>

          {/* Quien lo hizo y Fecha */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Quien lo hizo *</Label>
              <Select
                value={formData.appliedById}
                onValueChange={(value) => setFormData(prev => ({ ...prev, appliedById: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appliedAt" className="text-xs font-medium">
                Fecha de aplicación
              </Label>
              <DatePicker
                value={formData.appliedAt}
                onChange={(date) => setFormData(prev => ({ ...prev, appliedAt: date }))}
                placeholder="Seleccionar fecha..."
              />
            </div>
          </div>

          {/* Tiempo y unidad */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="actualHours" className="text-xs font-medium">
                Tiempo invertido
              </Label>
              <div className="flex gap-2">
                <Input
                  id="actualHours"
                  type="number"
                  value={formData.actualHours}
                  onChange={(e) => setFormData(prev => ({ ...prev, actualHours: e.target.value }))}
                  placeholder="0"
                  min="0"
                  step="0.5"
                  className="flex-1"
                />
                <Select
                  value={formData.timeUnit}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, timeUnit: value as 'hours' | 'minutes' }))}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Horas</SelectItem>
                    <SelectItem value="minutes">Minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Efectividad */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Efectividad</Label>
              <div className="flex items-center gap-1 h-10">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => handleEffectivenessClick(rating)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={cn(
                        'h-6 w-6',
                        formData.effectiveness && rating <= formData.effectiveness
                          ? 'fill-warning-muted-foreground text-warning-muted-foreground'
                          : 'text-muted-foreground hover:text-warning-muted-foreground/50'
                      )}
                    />
                  </button>
                ))}
                {formData.effectiveness && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {formData.effectiveness}/5
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Causa raíz */}
          <div className="space-y-1.5">
            <Label htmlFor="rootCause" className="text-xs font-medium">
              Causa raíz identificada
            </Label>
            <Input
              id="rootCause"
              value={formData.rootCause}
              onChange={(e) => setFormData(prev => ({ ...prev, rootCause: e.target.value }))}
              placeholder="¿Por qué ocurrió esta falla?"
            />
          </div>

          {/* Acciones preventivas */}
          <div className="space-y-1.5">
            <Label htmlFor="preventiveActions" className="text-xs font-medium">
              Acciones preventivas recomendadas
            </Label>
            <Input
              id="preventiveActions"
              value={formData.preventiveActions}
              onChange={(e) => setFormData(prev => ({ ...prev, preventiveActions: e.target.value }))}
              placeholder="¿Qué hacer para evitar que vuelva a ocurrir?"
            />
          </div>

          {/* Marcar como preferida */}
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="isPreferred"
              checked={formData.isPreferred}
              onCheckedChange={(checked) =>
                setFormData(prev => ({ ...prev, isPreferred: checked === true }))
              }
            />
            <label
              htmlFor="isPreferred"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Marcar como solución preferida
            </label>
          </div>

        </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={addSolution.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={addSolution.isPending} onClick={handleSubmit}>
            {addSolution.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar Solución'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddSolutionDialog;
