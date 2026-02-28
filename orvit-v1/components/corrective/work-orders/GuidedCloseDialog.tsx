'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
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
import { Switch } from '@/components/ui/switch';
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  FileText,
  ArrowRight,
  Wrench,
  Clock,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { SolutionControlPlan, type ControlStep } from '@/components/solutions/SolutionControlPlan';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ClipboardCheck, ChevronDown } from 'lucide-react';

/**
 * Schema para cierre mínimo (obligatorio)
 */
const minimumCloseSchema = z.object({
  title: z
    .string()
    .max(150, 'Máximo 150 caracteres')
    .optional()
    .or(z.literal('')),
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
  // Corrección de diagnóstico
  confirmedCause: z.string().max(255).optional(),
  diagnosisMatchesReport: z.boolean().default(true),
  // Corrección de falla (máquina, componente, título, descripción)
  correctionTitle: z.string().max(100).optional().or(z.literal('')),
  correctionDescription: z.string().max(2000).optional().or(z.literal('')),
  correctionMachineId: z.number().int().positive().optional(),
  correctionComponentId: z.number().int().positive().optional(),
  correctionSubcomponentId: z.number().int().positive().optional(),
});

/**
 * Schema para cierre profesional (campos opcionales adicionales)
 */
const professionalCloseSchema = minimumCloseSchema.extend({
  finalComponentId: z.number().int().optional(),
  finalSubcomponentId: z.number().int().optional(),
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
 * Incluye sección de "Revisión del reporte" donde el técnico puede
 * confirmar o corregir lo que fue reportado originalmente.
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
  const [controlPlan, setControlPlan] = useState<ControlStep[]>([]);
  const [controlPlanOpen, setControlPlanOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<CloseFormData>({
    resolver: zodResolver(professionalCloseSchema),
    defaultValues: {
      title: '',
      diagnosis: '',
      solution: '',
      outcome: undefined,
      fixType: 'DEFINITIVA',
      diagnosisMatchesReport: true,
      confirmedCause: '',
      correctionTitle: '',
      correctionDescription: '',
    },
  });

  const diagnosisMatchesReport = form.watch('diagnosisMatchesReport');

  // Fetch datos de la falla asociada a esta OT
  const { data: failureData } = useQuery({
    queryKey: ['wo-failure-report', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/work-orders/${workOrderId}?include=failureOccurrences`);
      if (!res.ok) return null;
      const wo = await res.json();
      const fo = wo.failureOccurrences?.[0];
      if (!fo) return null;
      return {
        id: fo.id,
        title: fo.title || 'Sin título',
        description: fo.description || null,
        priority: fo.priority,
        status: fo.status,
        causedDowntime: fo.causedDowntime,
        machineId: wo.machineId as number | null,
        machineName: wo.machine?.name || null,
        componentName: wo.component?.name || null,
        incidentType: fo.incidentType,
      };
    },
    enabled: open,
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

  // Queries para corrección de falla (solo cuando toggle está OFF)
  const correctionMachineId = form.watch('correctionMachineId');
  const correctionComponentId = form.watch('correctionComponentId');

  const { data: machines } = useQuery({
    queryKey: ['machines-list'],
    queryFn: async () => {
      const res = await fetch('/api/machines');
      if (!res.ok) return [];
      const json = await res.json();
      return json.machines || [];
    },
    enabled: open && !diagnosisMatchesReport,
  });

  const { data: machineComponents } = useQuery({
    queryKey: ['machine-components', correctionMachineId],
    queryFn: async () => {
      const res = await fetch(`/api/machines/${correctionMachineId}/components`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open && !!correctionMachineId && !diagnosisMatchesReport,
  });

  const closeMutation = useMutation({
    mutationFn: async (data: CloseFormData) => {
      const res = await fetch(`/api/work-orders/${workOrderId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
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
      setControlPlan([]);
      setControlPlanOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (data: CloseFormData) => {
    const cleanData: Record<string, unknown> = {
      diagnosis: data.diagnosis,
      solution: data.solution,
      outcome: data.outcome,
      fixType: data.fixType || 'DEFINITIVA',
      closingMode: activeTab === 'minimum' ? 'MINIMUM' : 'PROFESSIONAL',
    };

    if (data.title && data.title.trim()) {
      cleanData.title = data.title.trim();
    }

    if (data.actualMinutes && data.actualMinutes > 0) {
      cleanData.actualMinutes = data.actualMinutes;
    }

    // Causa confirmada en SolutionApplied
    if (data.confirmedCause && data.confirmedCause.trim()) {
      cleanData.confirmedCause = data.confirmedCause.trim();
    }

    // Corrección de falla: actualiza el FailureOccurrence y guarda snapshot del original
    if (!data.diagnosisMatchesReport) {
      const correction: Record<string, unknown> = {};
      if (data.correctionTitle?.trim()) correction.title = data.correctionTitle.trim();
      if (data.correctionDescription?.trim()) correction.description = data.correctionDescription.trim();
      if (data.correctionMachineId) correction.machineId = data.correctionMachineId;
      if (data.correctionSubcomponentId) correction.subcomponentId = data.correctionSubcomponentId;
      if (data.confirmedCause?.trim()) correction.confirmedCause = data.confirmedCause.trim();
      if (Object.keys(correction).length > 0) {
        cleanData.correction = correction;
      }
    }

    // Campos profesionales
    if (activeTab === 'professional') {
      if (data.finalComponentId) cleanData.finalComponentId = data.finalComponentId;
      if (data.finalSubcomponentId) cleanData.finalSubcomponentId = data.finalSubcomponentId;
      if (data.effectiveness) cleanData.effectiveness = data.effectiveness;
      if (data.notes) cleanData.notes = data.notes;
    }

    // Plan de control
    const validSteps = controlPlan.filter(s => s.description.trim() && s.delayMinutes > 0);
    if (validSteps.length > 0) {
      cleanData.controlPlan = validSteps;
    }

    closeMutation.mutate(cleanData as CloseFormData);
  };

  const handleLoadPreviousSolution = (solutionId: number) => {
    const solution = previousSolutions?.find((s: any) => s.id === solutionId);
    if (solution) {
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
      <DialogContent size="lg" className="p-0 flex flex-col max-h-[90vh]" hideCloseButton>
        {/* ── Header ── */}
        <div className="flex-shrink-0 bg-background border-b">
          <div className="px-5 py-4 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                <h2 className="text-base font-semibold truncate">
                  Cierre de Orden de Trabajo
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Complete la información del trabajo realizado
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Contenido scrollable ── */}
        <Form {...form}>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
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

          {/* ── Sección: Lo que se reportó ── */}
          {failureData && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Lo que se reportó
                </p>
                <Badge
                  variant={failureData.incidentType === 'ROTURA' ? 'destructive' : 'outline'}
                  className="text-[10px] px-1.5 py-0"
                >
                  {failureData.incidentType || 'FALLA'}
                </Badge>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">{failureData.title}</p>
                {failureData.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {failureData.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {failureData.machineName && (
                    <span className="flex items-center gap-1">
                      <Wrench className="h-3 w-3" />
                      {failureData.machineName}
                      {failureData.componentName && ` > ${failureData.componentName}`}
                    </span>
                  )}
                  {failureData.causedDowntime && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Causó parada
                    </span>
                  )}
                </div>
              </div>

              {/* Toggle: ¿Coincide con lo que encontraste? */}
              <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">¿Coincide con lo que encontraste?</p>
                  <p className="text-[10px] text-muted-foreground">
                    Si no, contá qué era realmente más abajo
                  </p>
                </div>
                <Switch
                  checked={diagnosisMatchesReport}
                  onCheckedChange={(checked) => {
                    form.setValue('diagnosisMatchesReport', checked);
                    if (checked) {
                      form.setValue('confirmedCause', '');
                      form.setValue('correctionTitle', '');
                      form.setValue('correctionDescription', '');
                      form.setValue('correctionMachineId', undefined);
                      form.setValue('correctionComponentId', undefined);
                      form.setValue('correctionSubcomponentId', undefined);
                    } else if (failureData?.machineId) {
                      // Preseleccionar la máquina de la OT
                      form.setValue('correctionMachineId', failureData.machineId);
                    }
                  }}
                />
              </div>

              {/* Sección de corrección expandida — solo si NO coincide */}
              {!diagnosisMatchesReport && (
                <div className="rounded-md border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/50 p-3 space-y-3">
                  <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Corrección del reporte
                  </p>

                  {/* Título corregido */}
                  <FormField
                    control={form.control}
                    name="correctionTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Título corregido</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: Correa desgastada en motor principal"
                            className="text-sm bg-white dark:bg-background"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Máquina + Componente en grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="correctionMachineId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Máquina real</FormLabel>
                          <Select
                            onValueChange={(v) => {
                              field.onChange(parseInt(v));
                              // Reset componente y subcomponente al cambiar máquina
                              form.setValue('correctionComponentId', undefined);
                              form.setValue('correctionSubcomponentId', undefined);
                            }}
                            value={field.value?.toString() ?? ''}
                          >
                            <FormControl>
                              <SelectTrigger className="bg-white dark:bg-background text-sm">
                                <SelectValue placeholder="Seleccionar..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(machines || []).map((m: any) => (
                                <SelectItem key={m.id} value={m.id.toString()}>
                                  {m.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="correctionComponentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Componente real</FormLabel>
                          <Select
                            onValueChange={(v) => {
                              field.onChange(parseInt(v));
                              form.setValue('correctionSubcomponentId', undefined);
                            }}
                            value={field.value?.toString() ?? ''}
                            disabled={!correctionMachineId}
                          >
                            <FormControl>
                              <SelectTrigger className="bg-white dark:bg-background text-sm">
                                <SelectValue placeholder={correctionMachineId ? 'Seleccionar...' : 'Elegí máquina'} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(machineComponents || []).map((c: any) => (
                                <SelectItem key={c.id} value={c.id.toString()}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Subcomponente (si hay componente seleccionado y tiene subcomponentes) */}
                  {correctionComponentId && machineComponents && (() => {
                    const selectedComp = machineComponents.find((c: any) => c.id === correctionComponentId);
                    const subs = selectedComp?.subcomponents || [];
                    if (subs.length === 0) return null;
                    return (
                      <FormField
                        control={form.control}
                        name="correctionSubcomponentId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Subcomponente</FormLabel>
                            <Select
                              onValueChange={(v) => field.onChange(parseInt(v))}
                              value={field.value?.toString() ?? ''}
                            >
                              <FormControl>
                                <SelectTrigger className="bg-white dark:bg-background text-sm">
                                  <SelectValue placeholder="Seleccionar..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {subs.map((s: any) => (
                                  <SelectItem key={s.id} value={s.id.toString()}>
                                    {s.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    );
                  })()}

                  {/* Causa real */}
                  <FormField
                    control={form.control}
                    name="confirmedCause"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">¿Qué era realmente? (Causa real)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: No era el rodamiento, era la correa desgastada"
                            className="text-sm bg-white dark:bg-background"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Descripción corregida */}
                  <FormField
                    control={form.control}
                    name="correctionDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Descripción corregida (opcional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Detalle adicional sobre lo que encontraste..."
                            className="text-sm bg-white dark:bg-background"
                            rows={2}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <p className="text-[10px] text-orange-600 dark:text-orange-400">
                    La falla se actualizará con estos datos. Lo reportado originalmente queda guardado.
                  </p>
                </div>
              )}
            </div>
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

          {/* ── Formulario con tabs ── */}
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
                          placeholder="Ej: Rodamiento desgastado en motor principal, con juego axial excesivo"
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

                {/* Resultado + Tipo de Solución en fila */}
                <div className="grid grid-cols-2 gap-3">
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
                              <SelectValue placeholder="Seleccione..." />
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
                              <SelectValue placeholder="Seleccione..." />
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
                </div>

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
                          inputMode="numeric"
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

          {/* ─── Plan de control de seguimiento ─── */}
          <Collapsible open={controlPlanOpen} onOpenChange={setControlPlanOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-between h-8 px-2 text-sm font-normal text-muted-foreground hover:text-foreground"
              >
                <span className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  Plan de control de seguimiento
                  {controlPlan.length > 0 && (
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">
                      {controlPlan.length} {controlPlan.length === 1 ? 'paso' : 'pasos'}
                    </span>
                  )}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${controlPlanOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <SolutionControlPlan value={controlPlan} onChange={setControlPlan} />
            </CollapsibleContent>
          </Collapsible>
        </div>
        </Form>

        {/* ── Footer ── */}
        <DialogFooter className="px-5 py-4 border-t">
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
            className="bg-success hover:bg-success/90"
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
