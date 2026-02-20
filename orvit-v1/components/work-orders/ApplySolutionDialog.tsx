'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, Clock, Star, Wrench } from 'lucide-react';
import { usePreviousSolutions } from '@/hooks/use-previous-solutions';
import { cn } from '@/lib/utils';

interface ApplySolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderId: number;
  failureId: number;
  machineId?: number;
  failureTitle?: string;
  onSuccess?: () => void;
}

export function ApplySolutionDialog({
  open,
  onOpenChange,
  workOrderId,
  failureId,
  machineId,
  failureTitle,
  onSuccess
}: ApplySolutionDialogProps) {
  const queryClient = useQueryClient();

  // Estado del formulario
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedSolutionId, setSelectedSolutionId] = useState<string>('');
  const [actualHours, setActualHours] = useState('');
  const [timeUnit, setTimeUnit] = useState<'hours' | 'minutes'>('hours');
  const [notes, setNotes] = useState('');
  const [effectiveness, setEffectiveness] = useState('');

  // Campos para nueva solución
  const [newSolutionTitle, setNewSolutionTitle] = useState('');
  const [newSolutionDescription, setNewSolutionDescription] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [preventiveActions, setPreventiveActions] = useState('');

  // Obtener soluciones previas
  const { data, isLoading: loadingSolutions } = usePreviousSolutions({
    failureId,
    machineId,
    enabled: open
  });

  const previousSolutions = data?.solutions || [];

  // Mutation para aplicar solución
  const applyMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await fetch(`/api/work-orders/${workOrderId}/apply-solution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al aplicar solución');
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Solución aplicada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['previous-solutions'] });

      // Reset form
      setMode('existing');
      setSelectedSolutionId('');
      setActualHours('');
      setNotes('');
      setEffectiveness('');
      setNewSolutionTitle('');
      setNewSolutionDescription('');
      setRootCause('');
      setPreventiveActions('');

      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Error al aplicar solución');
    }
  });

  const handleSubmit = () => {
    // Validaciones
    if (!actualHours || parseFloat(actualHours) <= 0) {
      toast.error('Debe ingresar el tiempo real de trabajo');
      return;
    }

    if (mode === 'existing' && !selectedSolutionId) {
      toast.error('Debe seleccionar una solución');
      return;
    }

    if (mode === 'new') {
      if (!newSolutionTitle.trim()) {
        toast.error('Debe ingresar un título para la solución');
        return;
      }
      if (!newSolutionDescription.trim()) {
        toast.error('Debe ingresar una descripción de la solución');
        return;
      }
    }

    const payload: any = {
      actualHours,
      timeUnit,
      notes: notes.trim() || null,
      effectiveness: effectiveness ? parseInt(effectiveness) : null
    };

    if (mode === 'existing') {
      payload.existingSolutionId = selectedSolutionId;
    } else {
      payload.newSolution = {
        title: newSolutionTitle.trim(),
        description: newSolutionDescription.trim(),
        rootCause: rootCause.trim() || null,
        preventiveActions: preventiveActions.trim() || null,
        toolsUsed: null,
        sparePartsUsed: null,
        attachments: null
      };
    }

    applyMutation.mutate(payload);
  };

  const selectedSolution = previousSolutions.find(s => s.id.toString() === selectedSolutionId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Aplicar Solución</DialogTitle>
          <DialogDescription>
            {failureTitle || 'Seleccione una solución previa o cree una nueva para completar esta orden de trabajo'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {/* Selector: Solución existente o nueva */}
          <div className="space-y-2">
            <Label>Tipo de solución</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="existing" id="existing" />
                <Label htmlFor="existing" className="font-normal cursor-pointer">
                  Usar solución existente ({previousSolutions.length} disponibles)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="new" />
                <Label htmlFor="new" className="font-normal cursor-pointer">
                  Crear nueva solución
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Soluciones existentes */}
          {mode === 'existing' && (
            <div className="space-y-3">
              <Label>Seleccione una solución previa</Label>
              {loadingSolutions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : previousSolutions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No hay soluciones previas registradas para esta falla</p>
                  <p className="text-sm mt-2">Seleccione &quot;Crear nueva solución&quot; para registrar una</p>
                </div>
              ) : (
                <div className="grid gap-3 max-h-[300px] overflow-y-auto">
                  {previousSolutions.map((solution) => (
                    <button
                      key={solution.id}
                      type="button"
                      onClick={() => setSelectedSolutionId(solution.id.toString())}
                      className={cn(
                        'text-left p-4 border rounded-lg transition-all',
                        selectedSolutionId === solution.id.toString()
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{solution.title}</h4>
                            {solution.isPreferred && (
                              <Badge variant="secondary" className="text-xs">
                                <Star className="h-3 w-3 mr-1 fill-current" />
                                Preferida
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {solution.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {solution.actualHours} {solution.timeUnit === 'hours' ? 'hs' : 'min'}
                            </span>
                            {solution.effectiveness && (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Efectividad: {solution.effectiveness}/5
                              </span>
                            )}
                            <span>Por: {solution.appliedByName}</span>
                          </div>
                        </div>
                        {selectedSolutionId === solution.id.toString() && (
                          <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Nueva solución */}
          {mode === 'new' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-title">Título de la solución *</Label>
                <Input
                  id="new-title"
                  value={newSolutionTitle}
                  onChange={(e) => setNewSolutionTitle(e.target.value)}
                  placeholder="Ej: Reemplazo de rodamiento principal"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-description">Descripción detallada *</Label>
                <Textarea
                  id="new-description"
                  value={newSolutionDescription}
                  onChange={(e) => setNewSolutionDescription(e.target.value)}
                  placeholder="Describa paso a paso cómo se solucionó el problema..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="root-cause">Causa raíz (opcional)</Label>
                <Textarea
                  id="root-cause"
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  placeholder="¿Qué causó la falla?"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preventive">Acciones preventivas (opcional)</Label>
                <Textarea
                  id="preventive"
                  value={preventiveActions}
                  onChange={(e) => setPreventiveActions(e.target.value)}
                  placeholder="¿Qué se puede hacer para prevenir que vuelva a ocurrir?"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Campos comunes para ambas opciones */}
          <div className="border-t pt-4 space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Datos de ejecución
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="actual-hours">Tiempo real de trabajo *</Label>
                <Input
                  id="actual-hours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={actualHours}
                  onChange={(e) => setActualHours(e.target.value)}
                  placeholder="Ej: 2.5"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time-unit">Unidad</Label>
                <Select value={timeUnit} onValueChange={(v: any) => setTimeUnit(v)}>
                  <SelectTrigger id="time-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Horas</SelectItem>
                    <SelectItem value="minutes">Minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="effectiveness">Efectividad de la solución</Label>
              <Select value={effectiveness} onValueChange={setEffectiveness}>
                <SelectTrigger id="effectiveness">
                  <SelectValue placeholder="Seleccione una calificación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">⭐ - Muy baja</SelectItem>
                  <SelectItem value="2">⭐⭐ - Baja</SelectItem>
                  <SelectItem value="3">⭐⭐⭐ - Media</SelectItem>
                  <SelectItem value="4">⭐⭐⭐⭐ - Alta</SelectItem>
                  <SelectItem value="5">⭐⭐⭐⭐⭐ - Muy alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas adicionales (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones específicas de esta aplicación..."
                rows={3}
              />
            </div>
          </div>

          {/* Vista previa de solución seleccionada */}
          {mode === 'existing' && selectedSolution && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm">Solución seleccionada:</h4>
              <p className="text-sm">{selectedSolution.description}</p>
              {selectedSolution.rootCause && (
                <div className="text-xs text-muted-foreground">
                  <strong>Causa raíz:</strong> {selectedSolution.rootCause}
                </div>
              )}
              {selectedSolution.preventiveActions && (
                <div className="text-xs text-muted-foreground">
                  <strong>Prevención:</strong> {selectedSolution.preventiveActions}
                </div>
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applyMutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={applyMutation.isPending}>
            {applyMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Aplicando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Aplicar y completar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
