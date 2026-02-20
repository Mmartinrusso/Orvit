'use client';

/**
 * RCADialog - Root Cause Analysis (5-Whys)
 *
 * Formulario interactivo para realizar análisis de causa raíz
 * usando la metodología de los 5 Por qué.
 *
 * P5.2: Root Cause Analysis
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  HelpCircle,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Target,
  Lightbulb,
  Save,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { DatePicker } from '@/components/ui/date-picker';

// ============================================================
// TIPOS Y SCHEMA
// ============================================================

interface RCADialogProps {
  isOpen: boolean;
  onClose: () => void;
  workOrderId: number;
  workOrderTitle?: string;
  onSuccess?: (rca: any) => void;
}

const whySchema = z.object({
  level: z.number().min(1).max(5),
  question: z.string().min(1, 'Pregunta requerida'),
  answer: z.string().min(1, 'Respuesta requerida')
});

const correctiveActionSchema = z.object({
  action: z.string().min(1, 'Acción requerida'),
  responsible: z.string().optional(),
  responsibleId: z.number().optional(),
  dueDate: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).default('PENDING')
});

const rcaFormSchema = z.object({
  whys: z.array(whySchema).min(1, 'Al menos un "Por qué" requerido').max(5),
  rootCause: z.string().optional(),
  conclusion: z.string().optional(),
  correctiveActions: z.array(correctiveActionSchema).optional(),
  status: z.enum(['DRAFT', 'COMPLETED', 'REVIEWED']).default('DRAFT')
});

type RCAFormData = z.infer<typeof rcaFormSchema>;

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function RCADialog({
  isOpen,
  onClose,
  workOrderId,
  workOrderTitle,
  onSuccess
}: RCADialogProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const queryClient = useQueryClient();

  // Cargar RCA existente
  const { data: rcaData, isLoading } = useQuery({
    queryKey: ['rca', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/work-orders/${workOrderId}/rca`);
      if (!res.ok) throw new Error('Error al cargar RCA');
      return res.json();
    },
    enabled: isOpen && !!workOrderId
  });

  // Form
  const form = useForm<RCAFormData>({
    resolver: zodResolver(rcaFormSchema),
    defaultValues: {
      whys: [
        { level: 1, question: '¿Por qué ocurrió la falla?', answer: '' }
      ],
      rootCause: '',
      conclusion: '',
      correctiveActions: [],
      status: 'DRAFT'
    }
  });

  const {
    fields: whyFields,
    append: appendWhy,
    remove: removeWhy
  } = useFieldArray({
    control: form.control,
    name: 'whys'
  });

  const {
    fields: actionFields,
    append: appendAction,
    remove: removeAction
  } = useFieldArray({
    control: form.control,
    name: 'correctiveActions'
  });

  // Cargar datos existentes
  useEffect(() => {
    if (rcaData?.exists && rcaData.rca) {
      const rca = rcaData.rca;
      form.reset({
        whys: rca.whys || [{ level: 1, question: '¿Por qué ocurrió la falla?', answer: '' }],
        rootCause: rca.rootCause || '',
        conclusion: rca.conclusion || '',
        correctiveActions: rca.correctiveActions || [],
        status: rca.status || 'DRAFT'
      });
      if (rca.correctiveActions?.length > 0) {
        setActionsOpen(true);
      }
    } else if (rcaData?.template) {
      form.reset({
        whys: rcaData.template.whys,
        rootCause: '',
        conclusion: '',
        correctiveActions: [],
        status: 'DRAFT'
      });
    }
  }, [rcaData, form]);

  // Mutation para guardar
  const saveMutation = useMutation({
    mutationFn: async (data: RCAFormData) => {
      const res = await fetch(`/api/work-orders/${workOrderId}/rca`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al guardar RCA');
      }

      return res.json();
    },
    onSuccess: (data) => {
      toast.success('RCA guardado', {
        description: data.message
      });

      queryClient.invalidateQueries({ queryKey: ['rca', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });

      if (onSuccess) {
        onSuccess(data.rca);
      }

      if (form.watch('status') === 'COMPLETED') {
        onClose();
      }
    },
    onError: (error: Error) => {
      toast.error('Error', { description: error.message });
    }
  });

  // Agregar siguiente "Por qué"
  const addNextWhy = () => {
    const currentWhys = form.getValues('whys');
    const lastWhy = currentWhys[currentWhys.length - 1];

    if (currentWhys.length < 5) {
      appendWhy({
        level: currentWhys.length + 1,
        question: currentWhys.length === 4
          ? '¿Por qué? (Causa raíz)'
          : '¿Por qué?',
        answer: ''
      });
    }
  };

  // Guardar como borrador
  const saveDraft = () => {
    form.setValue('status', 'DRAFT');
    form.handleSubmit((data) => saveMutation.mutate(data))();
  };

  // Completar RCA
  const completeRCA = () => {
    form.setValue('status', 'COMPLETED');
    form.handleSubmit((data) => saveMutation.mutate(data))();
  };

  const currentWhys = form.watch('whys');
  const canAddMore = currentWhys.length < 5;
  const isReviewed = rcaData?.rca?.status === 'REVIEWED';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Análisis de Causa Raíz (5-Whys)
          </DialogTitle>
          <DialogDescription>
            {workOrderTitle && (
              <span className="text-foreground">OT: {workOrderTitle}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : isReviewed ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
            <p className="font-medium text-foreground">RCA Revisado y Aprobado</p>
            <p className="text-sm text-muted-foreground mt-1">
              Este análisis ya fue revisado y no puede modificarse
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Los 5 Por Qué */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  Los 5 Por Qué
                </Label>
                <Badge variant="outline" className="text-xs">
                  {currentWhys.length}/5 niveles
                </Badge>
              </div>

              {/* Lista de Whys */}
              <div className="space-y-4">
                {whyFields.map((field, index) => (
                  <div
                    key={field.id}
                    className={cn(
                      'relative p-4 rounded-lg border-2 transition-colors',
                      index === currentWhys.length - 1
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border bg-muted/50'
                    )}
                  >
                    {/* Número de nivel */}
                    <div className={cn(
                      'absolute -left-3 -top-3 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold',
                      index === currentWhys.length - 1
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted-foreground text-background'
                    )}>
                      {index + 1}
                    </div>

                    <div className="space-y-3 ml-2">
                      {/* Pregunta */}
                      <div>
                        <Label className="text-sm text-foreground">
                          Pregunta
                        </Label>
                        <Input
                          {...form.register(`whys.${index}.question`)}
                          className="mt-1"
                          disabled={index < currentWhys.length - 1}
                        />
                      </div>

                      {/* Respuesta */}
                      <div>
                        <Label className="text-sm text-foreground">
                          Respuesta
                        </Label>
                        <Textarea
                          {...form.register(`whys.${index}.answer`)}
                          className="mt-1"
                          rows={2}
                          placeholder="¿Por qué ocurrió esto?"
                        />
                        {form.formState.errors.whys?.[index]?.answer && (
                          <p className="text-xs text-destructive mt-1">
                            {form.formState.errors.whys[index]?.answer?.message}
                          </p>
                        )}
                      </div>

                      {/* Botón eliminar (solo el último si hay más de 1) */}
                      {index === currentWhys.length - 1 && currentWhys.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeWhy(index)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Eliminar nivel
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Botón agregar más */}
              {canAddMore && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={addNextWhy}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar siguiente "¿Por qué?"
                </Button>
              )}
            </div>

            {/* Causa Raíz */}
            <div className="space-y-2">
              <Label className="text-base font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-destructive" />
                Causa Raíz Identificada
              </Label>
              <Textarea
                {...form.register('rootCause')}
                placeholder="Resumen de la causa raíz principal..."
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Se pre-llenará con la última respuesta si no se especifica
              </p>
            </div>

            {/* Conclusión */}
            <div className="space-y-2">
              <Label className="text-base font-medium flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-warning-muted-foreground" />
                Conclusión
              </Label>
              <Textarea
                {...form.register('conclusion')}
                placeholder="Conclusiones del análisis, lecciones aprendidas..."
                rows={2}
              />
            </div>

            {/* Acciones Correctivas (colapsable) */}
            <Collapsible open={actionsOpen} onOpenChange={setActionsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-between"
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Acciones Correctivas
                    {actionFields.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {actionFields.length}
                      </Badge>
                    )}
                  </span>
                  {actionsOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>

              <CollapsibleContent className="space-y-3 pt-3">
                {actionFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="p-3 border rounded-lg bg-muted space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <Input
                          {...form.register(`correctiveActions.${index}.action`)}
                          placeholder="Descripción de la acción..."
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive hover:text-destructive"
                        onClick={() => removeAction(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        {...form.register(`correctiveActions.${index}.responsible`)}
                        placeholder="Responsable"
                      />
                      <DatePicker
                        value={form.watch(`correctiveActions.${index}.dueDate`) || ''}
                        onChange={(date) => form.setValue(`correctiveActions.${index}.dueDate`, date)}
                        placeholder="Fecha límite"
                      />
                      <Select
                        value={form.watch(`correctiveActions.${index}.status`)}
                        onValueChange={(v) =>
                          form.setValue(
                            `correctiveActions.${index}.status`,
                            v as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
                          )
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">Pendiente</SelectItem>
                          <SelectItem value="IN_PROGRESS">En proceso</SelectItem>
                          <SelectItem value="COMPLETED">Completada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed"
                  onClick={() => appendAction({
                    action: '',
                    responsible: '',
                    dueDate: '',
                    status: 'PENDING'
                  })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar acción correctiva
                </Button>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
        </DialogBody>

        {!isLoading && !isReviewed && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saveMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={saveDraft}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Guardar Borrador
            </Button>
            <Button
              type="button"
              onClick={completeRCA}
              disabled={saveMutation.isPending || currentWhys.some(w => !w.answer)}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Completar RCA
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default RCADialog;
