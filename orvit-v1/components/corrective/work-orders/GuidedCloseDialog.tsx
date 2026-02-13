'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Schema para cierre mínimo (obligatorio)
 */
const minimumCloseSchema = z.object({
  title: z
    .string()
    .max(150, 'Máximo 150 caracteres')
    .optional()
    .or(z.literal('')),  // Permite vacío - se usará la solución como título
  diagnosis: z
    .string()
    .min(10, 'Mínimo 10 caracteres')
    .max(2000, 'Máximo 2000 caracteres'),
  solution: z
    .string()
    .min(10, 'Mínimo 10 caracteres')
    .max(5000, 'Máximo 5000 caracteres'),
  outcome: z.enum(['FUNCIONÓ', 'PARCIAL', 'NO_FUNCIONÓ'], {
    required_error: 'Seleccione resultado',
  }),
  fixType: z.enum(['PARCHE', 'DEFINITIVA']).default('DEFINITIVA'),
  actualMinutes: z.number().int().min(1).optional(),
});

/**
 * Schema para cierre profesional (campos opcionales adicionales)
 */
const professionalCloseSchema = minimumCloseSchema.extend({
  finalComponentId: z.number().int().optional(),
  finalSubcomponentId: z.number().int().optional(),
  confirmedCause: z.string().max(255).optional(),
  effectiveness: z.number().int().min(1).max(5).optional(),
  notes: z.string().max(2000).optional(),
});

type CloseFormData = z.infer<typeof professionalCloseSchema>;

interface GuidedCloseDialogProps {
  workOrderId: number;
  requiresReturnToProduction: boolean;
  returnToProductionConfirmed: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const outcomeLabels = {
  FUNCIONÓ: 'Funcionó Correctamente',
  PARCIAL: 'Funcionó Parcialmente (Seguimiento)',
  NO_FUNCIONÓ: 'No Resolvió el Problema',
};

const fixTypeLabels = {
  PARCHE: 'Solución Temporal (Parche)',
  DEFINITIVA: 'Solución Definitiva',
};

/**
 * Dialog de cierre guiado con tabs Mínimo | Profesional
 *
 * Validaciones:
 * - Si requiresReturnToProduction=true Y returnToProductionConfirmed=false → Bloquear
 * - Tab Mínimo: diagnosis, solution, outcome obligatorios
 * - Tab Profesional: Todos los campos opcionales
 */
export function GuidedCloseDialog({
  workOrderId,
  requiresReturnToProduction,
  returnToProductionConfirmed,
  open,
  onOpenChange,
}: GuidedCloseDialogProps) {
  const [activeTab, setActiveTab] = useState<'minimum' | 'professional'>(
    'minimum'
  );
  const queryClient = useQueryClient();

  // Siempre usar professionalCloseSchema ya que incluye todos los campos
  // minimumCloseSchema es un subset, así que professionalCloseSchema valida ambos casos
  const form = useForm<CloseFormData>({
    resolver: zodResolver(professionalCloseSchema),
    defaultValues: {
      title: '',
      diagnosis: '',
      solution: '',
      outcome: undefined,
      fixType: 'DEFINITIVA',
    },
  });

  // Fetch previous solutions (para sugerencias)
  const { data: previousSolutions } = useQuery({
    queryKey: ['previous-solutions', workOrderId],
    queryFn: async () => {
      const res = await fetch(
        `/api/work-orders/${workOrderId}/previous-solutions`
      );
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
    enabled: open,
  });

  const closeMutation = useMutation({
    mutationFn: async (data: CloseFormData) => {
      // data ya viene limpio desde handleSubmit con closingMode incluido
      const res = await fetch(`/api/work-orders/${workOrderId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        console.error('❌ [GuidedCloseDialog] Error response:', error);
        // Mensaje más claro para el caso de downtime abierto
        if (error.requiresAction && error.reason) {
          throw new Error(error.reason);
        }
        throw new Error(error.error || 'Error al cerrar orden');
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success('Orden de trabajo cerrada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['failure-occurrences'] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (data: CloseFormData) => {
    // Limpiar datos antes de enviar
    const cleanData: Record<string, unknown> = {
      diagnosis: data.diagnosis,
      solution: data.solution,
      outcome: data.outcome,
      fixType: data.fixType || 'DEFINITIVA',
      closingMode: activeTab === 'minimum' ? 'MINIMUM' : 'PROFESSIONAL',
    };

    // Agregar título solo si tiene contenido
    if (data.title && data.title.trim()) {
      cleanData.title = data.title.trim();
    }

    // Agregar tiempo real si se proporcionó
    if (data.actualMinutes && data.actualMinutes > 0) {
      cleanData.actualMinutes = data.actualMinutes;
    }

    // Campos profesionales (solo si estamos en tab profesional)
    if (activeTab === 'professional') {
      if (data.finalComponentId) cleanData.finalComponentId = data.finalComponentId;
      if (data.finalSubcomponentId) cleanData.finalSubcomponentId = data.finalSubcomponentId;
      if (data.confirmedCause) cleanData.confirmedCause = data.confirmedCause;
      if (data.effectiveness) cleanData.effectiveness = data.effectiveness;
      if (data.notes) cleanData.notes = data.notes;
    }

    console.log('📤 [GuidedCloseDialog] Enviando datos:', cleanData);
    closeMutation.mutate(cleanData as CloseFormData);
  };

  const handleLoadPreviousSolution = (solutionId: number) => {
    const solution = previousSolutions?.find((s: any) => s.id === solutionId);
    if (solution) {
      // Cargar título si existe, o generar uno desde la solución
      if (solution.title) {
        form.setValue('title', solution.title);
      } else if (solution.solution) {
        form.setValue('title', solution.solution.substring(0, 100));
      }
      form.setValue('diagnosis', solution.diagnosis);
      form.setValue('solution', solution.solution);
      form.setValue('fixType', solution.fixType || 'DEFINITIVA');
      if (solution.finalComponentId) {
        form.setValue('finalComponentId', solution.finalComponentId);
      }
      if (solution.finalSubcomponentId) {
        form.setValue('finalSubcomponentId', solution.finalSubcomponentId);
      }
      toast.info('Solución cargada como plantilla');
    }
  };

  // Si requiere retorno a producción y no está confirmado → Bloquear
  const isBlocked =
    requiresReturnToProduction && !returnToProductionConfirmed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Cierre de Orden de Trabajo
          </DialogTitle>
          <DialogDescription>
            Complete la información del trabajo realizado. Tab{' '}
            <strong>Mínimo</strong> para cierre rápido, <strong>Profesional</strong> para registro completo.
          </DialogDescription>
        </DialogHeader>

        {/* Contenido con scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Alerta de bloqueo */}
          {isBlocked && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>No se puede cerrar:</strong> Debe confirmar Retorno a
                Producción antes de cerrar esta orden (hay downtime abierto).
              </AlertDescription>
            </Alert>
          )}

          {/* Sugerencias de soluciones previas */}
          {previousSolutions && previousSolutions.length > 0 && !isBlocked && (
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-2">
                  Encontramos {previousSolutions.length} solución(es) aplicada(s)
                  anteriormente:
                </p>
                <div className="flex flex-wrap gap-2">
                  {previousSolutions.slice(0, 3).map((sol: any) => (
                    <Button
                      key={sol.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleLoadPreviousSolution(sol.id)}
                    >
                      Usar Solución #{sol.id}
                    </Button>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} id="close-form">
              <Tabs
                value={activeTab}
                onValueChange={(v) =>
                  setActiveTab(v as 'minimum' | 'professional')
                }
              >
                <TabsList className="grid w-full grid-cols-2 mb-5">
                  <TabsTrigger value="minimum">
                    Cierre Mínimo
                    <Badge variant="secondary" className="ml-2">
                      Rápido
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="professional">
                    Cierre Profesional
                    <Badge variant="secondary" className="ml-2">
                      Completo
                    </Badge>
                  </TabsTrigger>
                </TabsList>

              {/* TAB: Cierre Mínimo */}
              <TabsContent value="minimum" className="space-y-5">
                {/* Título del Mantenimiento */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título del Mantenimiento Realizado (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: Cambio de rodamiento motor principal"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Si lo dejás vacío, se usará la solución como título
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Diagnóstico */}
                <FormField
                  control={form.control}
                  name="diagnosis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>¿Qué encontraste? (Diagnóstico) *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Ej: Rodamiento desgastado en motor principal"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Solución */}
                <FormField
                  control={form.control}
                  name="solution"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>¿Qué hiciste? (Solución) *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Ej: Reemplazé el rodamiento por uno nuevo SKF 6205. Lubrique y alineé el eje."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Resultado */}
                <FormField
                  control={form.control}
                  name="outcome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resultado *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione resultado..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(outcomeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tipo de Solución */}
                <FormField
                  control={form.control}
                  name="fixType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Solución</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione tipo..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(fixTypeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tiempo Real */}
                <FormField
                  control={form.control}
                  name="actualMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tiempo Real (minutos)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="90"
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseInt(e.target.value) : undefined
                            )
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Tiempo total dedicado a esta orden
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* TAB: Cierre Profesional */}
              <TabsContent value="professional" className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Incluye todos los campos del cierre mínimo + datos adicionales
                  para análisis
                </p>

                {/* Causa Confirmada */}
                <FormField
                  control={form.control}
                  name="confirmedCause"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Causa Confirmada</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ej: Falta de lubricación programada"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Efectividad */}
                <FormField
                  control={form.control}
                  name="effectiveness"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Efectividad (1-5)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          placeholder="5"
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseInt(e.target.value) : undefined
                            )
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        1 = Baja, 5 = Muy alta
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Notas adicionales */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas Adicionales</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Observaciones, recomendaciones, lecciones aprendidas..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
              </Tabs>
            </form>
          </Form>
        </div>

        {/* Footer fijo */}
        <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="close-form"
            disabled={closeMutation.isPending || isBlocked}
            className="bg-green-600 hover:bg-green-700"
          >
            {closeMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Cerrar Orden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
