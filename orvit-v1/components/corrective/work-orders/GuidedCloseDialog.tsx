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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  FileText,
  Wrench,
  Clock,
  X,
  ListChecks,
  Package,
  Paperclip,
  Plus,
  ChevronsUpDown,
  Check,
  Timer,
  Shield,
  Search,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ClipboardCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ComponentTreeSelector } from '@/components/corrective/failures/ComponentTreeSelector';
import { Stepper, type Step } from '@/components/ui/stepper';

// ─── Types ───

interface UsedItem {
  id: number;
  name: string;
  quantity: number;
}

interface ControlPlanItem {
  order: number;
  delayMinutes: number;
  description: string;
  type: 'from_resolution' | 'from_previous';
}

const minimumCloseSchema = z.object({
  title: z.string().max(150, 'Máximo 150 caracteres').optional().or(z.literal('')),
  diagnosis: z.string().min(10, 'Mínimo 10 caracteres').max(2000, 'Máximo 2000 caracteres'),
  solution: z.string().min(10, 'Mínimo 10 caracteres').max(5000, 'Máximo 5000 caracteres'),
  outcome: z.enum(['FUNCIONÓ', 'PARCIAL', 'NO_FUNCIONÓ'], { required_error: 'Seleccione resultado' }),
  fixType: z.enum(['PARCHE', 'DEFINITIVA']).default('DEFINITIVA'),
  actualMinutes: z.number().int().min(1).optional(),
  confirmedCause: z.string().max(255).optional(),
  diagnosisMatchesReport: z.boolean().default(true),
  correctionTitle: z.string().max(100).optional().or(z.literal('')),
  correctionDescription: z.string().max(2000).optional().or(z.literal('')),
  correctionMachineId: z.number().int().positive().optional(),
  correctionComponentId: z.number().int().positive().optional(),
  correctionSubcomponentId: z.number().int().positive().optional(),
  correctionCategory: z.string().optional(),
  correctionIncidentType: z.enum(['FALLA', 'ROTURA']).optional(),
  repairAction: z.enum(['CAMBIO', 'REPARACION']).optional(),
});

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

type FormStep = 'report' | 'resolution' | 'materials';

const FORM_STEPS: Step[] = [
  { id: 'report', label: 'Reporte', description: '¿Qué se reportó?' },
  { id: 'resolution', label: 'Resolución', description: '¿Cómo se resolvió?' },
  { id: 'materials', label: 'Materiales', description: 'Recursos y seguimiento' },
];

const FORM_STEP_IDS: FormStep[] = ['report', 'resolution', 'materials'];

export function GuidedCloseDialog({
  workOrderId,
  requiresReturnToProduction,
  returnToProductionConfirmed,
  open,
  onOpenChange,
}: GuidedCloseDialogProps) {
  const [currentStep, setCurrentStep] = useState<FormStep>('report');
  const [expandedSolutionId, setExpandedSolutionId] = useState<number | null>(null);
  const [controlPlan, setControlPlan] = useState<ControlPlanItem[]>([]);
  const [verificationChecks, setVerificationChecks] = useState<Record<string, boolean>>({});
  const [toolsUsed, setToolsUsed] = useState<UsedItem[]>([]);
  const [sparePartsUsed, setSparePartsUsed] = useState<UsedItem[]>([]);
  const [toolComboOpen, setToolComboOpen] = useState(false);
  const [sparePartComboOpen, setSparePartComboOpen] = useState(false);
  const [newControlDesc, setNewControlDesc] = useState('');
  const [newControlDelay, setNewControlDelay] = useState('');
  const [newControlType, setNewControlType] = useState<'from_resolution' | 'from_previous'>('from_resolution');
  const [correctionTree, setCorrectionTree] = useState<{
    machineId?: number;
    componentIds?: number[];
    subcomponentIds?: number[];
  }>({});
  const [attachments, setAttachments] = useState<{ url: string; filename: string; type: 'IMAGE' | 'DOCUMENT' }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();

  const VERIFICATION_ITEMS = [
    { id: 'equipTest', label: 'Probé el equipo después de la intervención' },
    { id: 'areaClean', label: 'Limpié el área de trabajo' },
    { id: 'toolsReturned', label: 'Devolví herramientas y materiales' },
    { id: 'areaSafe', label: 'El área quedó en condiciones seguras' },
  ];

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
        machineId: (fo.machineId || wo.machineId) as number | null,
        machineName: wo.machine?.name || null,
        componentName: wo.component?.name || null,
        incidentType: fo.incidentType,
        failureCategory: fo.failureCategory,
      };
    },
    enabled: open,
  });

  const { data: previousSolutions } = useQuery({
    queryKey: ['previous-solutions', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/work-orders/${workOrderId}/previous-solutions`);
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
    enabled: open,
  });

  const correctionIncidentType = form.watch('correctionIncidentType');
  const effectiveIncidentType = diagnosisMatchesReport
    ? failureData?.incidentType
    : (correctionIncidentType || failureData?.incidentType);
  const isRotura = effectiveIncidentType === 'ROTURA';

  const currentStepIndex = FORM_STEP_IDS.indexOf(currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === FORM_STEP_IDS.length - 1;

  const { data: allTools } = useQuery<{ id: number; name: string; code?: string }[]>({
    queryKey: ['panol-tools-all'],
    queryFn: async () => {
      const [r1, r2] = await Promise.all([
        fetch('/api/tools/search?itemType=HAND_TOOL&limit=50'),
        fetch('/api/tools/search?itemType=TOOL&limit=50'),
      ]);
      const t1 = r1.ok ? await r1.json() : [];
      const t2 = r2.ok ? await r2.json() : [];
      const map = new Map<number, any>();
      [...t1, ...t2].forEach((t: any) => map.set(t.id, t));
      return Array.from(map.values()).sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const { data: allSpareParts } = useQuery<{ id: number; name: string; code?: string }[]>({
    queryKey: ['panol-spare-parts-all'],
    queryFn: async () => {
      const [r1, r2] = await Promise.all([
        fetch('/api/tools/search?itemType=SPARE_PART&limit=50'),
        fetch('/api/tools/search?itemType=CONSUMABLE&limit=50'),
      ]);
      const t1 = r1.ok ? await r1.json() : [];
      const t2 = r2.ok ? await r2.json() : [];
      const map = new Map<number, any>();
      [...t1, ...t2].forEach((t: any) => map.set(t.id, t));
      return Array.from(map.values()).sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
    staleTime: 5 * 60 * 1000,
    enabled: open,
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
        if (error.requiresAction && error.reason) throw new Error(error.reason);
        throw new Error(error.error || 'Error al cerrar orden');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Orden de trabajo cerrada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['failure-occurrences'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders-dashboard'] });
      onOpenChange(false);
      form.reset();
      setCurrentStep('report');
      setExpandedSolutionId(null);
      setControlPlan([]);
      setVerificationChecks({});
      setToolsUsed([]);
      setSparePartsUsed([]);
      setToolComboOpen(false);
      setSparePartComboOpen(false);
      setNewControlDesc('');
      setNewControlDelay('');
      setNewControlType('from_resolution');
      setCorrectionTree({});
      setAttachments([]);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ─── Item management ───

  const addItem = (list: UsedItem[], setList: (items: UsedItem[]) => void, item: { id: number; name: string }) => {
    const existing = list.find(i => i.id === item.id);
    if (existing) {
      setList(list.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setList([...list, { id: item.id, name: item.name, quantity: 1 }]);
    }
  };

  const removeItem = (list: UsedItem[], setList: (items: UsedItem[]) => void, id: number) => {
    setList(list.filter(i => i.id !== id));
  };

  const updateItemQty = (list: UsedItem[], setList: (items: UsedItem[]) => void, id: number, qty: number) => {
    setList(list.map(i => i.id === id ? { ...i, quantity: Math.max(1, qty) } : i));
  };

  const addControl = () => {
    if (!newControlDesc.trim()) return;
    const delay = parseInt(newControlDelay) || 60;
    setControlPlan(prev => [
      ...prev,
      { order: prev.length + 1, delayMinutes: delay, description: newControlDesc.trim(), type: newControlType },
    ]);
    setNewControlDesc('');
    setNewControlDelay('');
    setNewControlType('from_resolution');
  };

  const removeControl = (order: number) => {
    setControlPlan(prev =>
      prev.filter(c => c.order !== order).map((c, i) => ({ ...c, order: i + 1 }))
    );
  };

  const handleNextStep = async () => {
    if (currentStep === 'report') {
      setCurrentStep('resolution');
    } else if (currentStep === 'resolution') {
      const valid = await form.trigger(['diagnosis', 'solution', 'outcome']);
      if (valid) setCurrentStep('materials');
    }
  };

  const handlePrevStep = () => {
    if (!isFirstStep) {
      setCurrentStep(FORM_STEP_IDS[currentStepIndex - 1]);
    }
  };

  const handleSubmit = (data: CloseFormData) => {
    const cleanData: Record<string, unknown> = {
      diagnosis: data.diagnosis,
      solution: data.solution,
      outcome: data.outcome,
      fixType: data.fixType || 'DEFINITIVA',
      closingMode: 'PROFESSIONAL',
    };

    if (data.title && data.title.trim()) cleanData.title = data.title.trim();
    if (data.actualMinutes && data.actualMinutes > 0) cleanData.actualMinutes = data.actualMinutes;
    if (data.confirmedCause && data.confirmedCause.trim()) cleanData.confirmedCause = data.confirmedCause.trim();

    if (!data.diagnosisMatchesReport) {
      const correction: Record<string, unknown> = {};
      if (data.correctionTitle?.trim()) correction.title = data.correctionTitle.trim();
      if (data.correctionDescription?.trim()) correction.description = data.correctionDescription.trim();
      if (data.correctionMachineId) correction.machineId = data.correctionMachineId;
      if (data.correctionComponentId) correction.componentId = data.correctionComponentId;
      if (data.correctionSubcomponentId) correction.subcomponentId = data.correctionSubcomponentId;
      if (data.correctionCategory) correction.failureCategory = data.correctionCategory;
      if (data.correctionIncidentType) correction.incidentType = data.correctionIncidentType;
      if (data.confirmedCause?.trim()) correction.confirmedCause = data.confirmedCause.trim();
      if (Object.keys(correction).length > 0) cleanData.correction = correction;
      if (data.correctionComponentId) cleanData.finalComponentId = data.correctionComponentId;
      if (data.correctionSubcomponentId) cleanData.finalSubcomponentId = data.correctionSubcomponentId;
    }

    if (data.repairAction) cleanData.repairAction = data.repairAction;
    if (data.finalComponentId && !cleanData.finalComponentId) cleanData.finalComponentId = data.finalComponentId;
    if (data.finalSubcomponentId && !cleanData.finalSubcomponentId) cleanData.finalSubcomponentId = data.finalSubcomponentId;
    if (data.effectiveness) cleanData.effectiveness = data.effectiveness;
    if (data.notes) cleanData.notes = data.notes;

    if (sparePartsUsed.length > 0) cleanData.sparePartsUsed = sparePartsUsed;
    if (toolsUsed.length > 0) cleanData.toolsUsed = toolsUsed;
    if (attachments.length > 0) cleanData.attachments = attachments;

    const validSteps = controlPlan.filter(s => s.description.trim() && s.delayMinutes > 0);
    if (validSteps.length > 0) {
      cleanData.controlPlan = validSteps.map(s => ({
        order: s.order,
        delayMinutes: s.delayMinutes,
        description: s.description,
        delayFrom: s.type === 'from_resolution' ? 'close' : 'previous',
      }));
    }

    closeMutation.mutate(cleanData as CloseFormData);
  };

  const handleUploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'solution');
      formData.append('entityId', String(workOrderId));
      formData.append('fileType', file.type.startsWith('image/') ? 'IMAGE' : 'DOCUMENT');
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Error al subir archivo');
      const data = await res.json();
      const type: 'IMAGE' | 'DOCUMENT' = file.type.startsWith('image/') ? 'IMAGE' : 'DOCUMENT';
      setAttachments(prev => [...prev, { url: data.url, filename: file.name, type }]);
    } catch {
      toast.error('Error al subir archivo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleLoadPreviousSolution = (solutionId: number) => {
    const solution = previousSolutions?.find((s: any) => s.id === solutionId);
    if (solution) {
      form.setValue('title', solution.title || solution.solution?.substring(0, 100) || '');
      form.setValue('diagnosis', solution.diagnosis);
      form.setValue('solution', solution.solution);
      form.setValue('fixType', solution.fixType || 'DEFINITIVA');
      if (solution.finalComponentId) form.setValue('finalComponentId', solution.finalComponentId);
      if (solution.finalSubcomponentId) form.setValue('finalSubcomponentId', solution.finalSubcomponentId);
      setExpandedSolutionId(null);
      toast.info('Solución cargada — continuá en el paso 2');
      setCurrentStep('resolution');
    }
  };

  const isBlocked = requiresReturnToProduction && !returnToProductionConfirmed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="p-0 flex flex-col max-h-[90vh]" hideCloseButton>

        {/* ── Header + Stepper ── */}
        <div className="flex-shrink-0 bg-background border-b">
          <div className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 -ml-1"
                onClick={isFirstStep ? () => onOpenChange(false) : handlePrevStep}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Cierre de Orden de Trabajo
                </h2>
                <p className="text-xs text-muted-foreground">
                  Paso {currentStepIndex + 1} de {FORM_STEP_IDS.length}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex justify-center px-4 pb-3 sm:px-6 sm:pb-4">
            <Stepper
              steps={FORM_STEPS}
              currentStep={currentStep}
              onStepClick={(id) => setCurrentStep(id as FormStep)}
              className="w-full max-w-lg"
            />
          </div>
        </div>

        {/* ── Form ── */}
        <Form {...form}>
          <form
            id="close-form"
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

              {/* Blocked alert */}
              {isBlocked && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>No se puede cerrar:</strong> Debe confirmar Retorno a Producción antes de cerrar esta orden (hay downtime abierto).
                  </AlertDescription>
                </Alert>
              )}

              {/* ────────────────── STEP 1: Reporte ────────────────── */}
              {currentStep === 'report' && (
                <div className="space-y-5">

                  {/* Lo que se reportó */}
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

                      <div className="space-y-1.5">
                        <p className="text-sm font-medium">{failureData.title}</p>
                        {failureData.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{failureData.description}</p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {failureData.machineName && (
                            <span className="flex items-center gap-1">
                              <Wrench className="h-3 w-3" />
                              {failureData.machineName}
                              {failureData.componentName && ` › ${failureData.componentName}`}
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

                      {/* Toggle ¿Coincide? */}
                      <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium">¿Coincide con lo que encontraste?</p>
                          <p className="text-[10px] text-muted-foreground">
                            Si no, contá qué era realmente
                          </p>
                        </div>
                        <Switch
                          checked={diagnosisMatchesReport}
                          onCheckedChange={(checked) => {
                            form.setValue('diagnosisMatchesReport', checked);
                            // Al activar corrección por primera vez (correctionMachineId aún vacío), preseleccionar valores
                            if (!checked && !form.getValues('correctionMachineId')) {
                              const initialTree: { machineId?: number } = {};
                              if (failureData?.machineId) {
                                form.setValue('correctionMachineId', failureData.machineId);
                                initialTree.machineId = failureData.machineId;
                              }
                              setCorrectionTree(initialTree);
                              if (failureData?.failureCategory) {
                                form.setValue('correctionCategory', failureData.failureCategory);
                              }
                              if (failureData?.incidentType === 'FALLA' || failureData?.incidentType === 'ROTURA') {
                                form.setValue('correctionIncidentType', failureData.incidentType);
                              }
                            }
                            // No limpiar los campos al volver a ON — solo se ocultan.
                            // Los datos de corrección se ignoran en el submit si diagnosisMatchesReport === true.
                          }}
                        />
                      </div>

                      {/* Corrección expandida */}
                      {!diagnosisMatchesReport && (
                        <div className="rounded-md border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/50 p-3 space-y-3">
                          <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Corrección del reporte
                          </p>

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

                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-orange-700 dark:text-orange-400">
                              Máquina / Componente real
                            </p>
                            <div className="bg-white dark:bg-background rounded-md border border-orange-200/50 dark:border-orange-900/50 p-2">
                              <ComponentTreeSelector
                                value={correctionTree}
                                onChange={(selection) => {
                                  setCorrectionTree(selection);
                                  form.setValue('correctionMachineId', selection.machineId);
                                  form.setValue('correctionComponentId', selection.componentIds?.[0]);
                                  form.setValue('correctionSubcomponentId', selection.subcomponentIds?.[0]);
                                }}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <FormField
                              control={form.control}
                              name="correctionCategory"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Categoría real</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                    <FormControl>
                                      <SelectTrigger className="bg-white dark:bg-background text-sm">
                                        <SelectValue placeholder="Seleccionar..." />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="MECANICA">⚙️ Mecánica</SelectItem>
                                      <SelectItem value="ELECTRICA">⚡ Eléctrica</SelectItem>
                                      <SelectItem value="HIDRAULICA">💧 Hidráulica</SelectItem>
                                      <SelectItem value="NEUMATICA">💨 Neumática</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="correctionIncidentType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Tipo de incidente</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                    <FormControl>
                                      <SelectTrigger className="bg-white dark:bg-background text-sm">
                                        <SelectValue placeholder="Seleccionar..." />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="FALLA">⚠️ Falla</SelectItem>
                                      <SelectItem value="ROTURA">💥 Rotura</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

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

                  {/* Soluciones anteriores */}
                  {previousSolutions && previousSolutions.length > 0 && !isBlocked && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
                        <p className="text-sm font-medium">
                          {previousSolutions.length} solución{previousSolutions.length !== 1 ? 'es' : ''} aplicada{previousSolutions.length !== 1 ? 's' : ''} anteriormente
                        </p>
                      </div>
                      <div className="space-y-2">
                        {previousSolutions.slice(0, 5).map((sol: any) => (
                          <div key={sol.id} className="rounded-lg border bg-muted/20 overflow-hidden">
                            {/* Card header */}
                            <div className="flex items-center gap-3 px-3 py-2.5">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {sol.title || sol.solution?.substring(0, 60) || `Solución #${sol.id}`}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {sol.fixType === 'DEFINITIVA' ? 'Definitiva' : 'Parche temporal'}
                                  {sol.createdAt && ` · ${new Date(sol.createdAt).toLocaleDateString('es-AR')}`}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs px-2.5 shrink-0"
                                onClick={() => setExpandedSolutionId(expandedSolutionId === sol.id ? null : sol.id)}
                              >
                                <ChevronDown
                                  className={cn(
                                    'h-3.5 w-3.5 mr-1 transition-transform',
                                    expandedSolutionId === sol.id ? 'rotate-180' : ''
                                  )}
                                />
                                {expandedSolutionId === sol.id ? 'Ocultar' : 'Ver detalle'}
                              </Button>
                            </div>

                            {/* Preview expandido */}
                            {expandedSolutionId === sol.id && (
                              <div className="border-t bg-background px-3 py-3 space-y-3">
                                {sol.diagnosis && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                      Diagnóstico
                                    </p>
                                    <p className="text-xs text-foreground leading-relaxed">{sol.diagnosis}</p>
                                  </div>
                                )}
                                {sol.solution && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                      Solución aplicada
                                    </p>
                                    <p className="text-xs text-foreground leading-relaxed">{sol.solution}</p>
                                  </div>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-8 text-xs w-full"
                                  onClick={() => handleLoadPreviousSolution(sol.id)}
                                >
                                  <Check className="h-3.5 w-3.5 mr-1.5" />
                                  Usar esta solución
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ────────────────── STEP 2: Resolución ────────────────── */}
              {currentStep === 'resolution' && (
                <div className="space-y-5">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título del Mantenimiento Realizado (opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Cambio de rodamiento motor principal" {...field} />
                        </FormControl>
                        <FormDescription>Si lo dejás vacío, se usará la solución como título</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="outcome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Resultado *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(outcomeLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
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
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(fixTypeLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormDescription>Tiempo total dedicado a esta orden</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isRotura && (
                    <FormField
                      control={form.control}
                      name="repairAction"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Acción realizada</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="¿Cambiaste o reparaste?" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="CAMBIO">Cambio (se reemplazó el componente)</SelectItem>
                              <SelectItem value="REPARACION">Reparación (se reparó el componente)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>Aplica para incidentes tipo Rotura</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

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
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormDescription>1 = Baja, 5 = Muy alta</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                </div>
              )}

              {/* ────────────────── STEP 3: Materiales y Seguimiento ────────────────── */}
              {currentStep === 'materials' && (
                <div className="space-y-6">

                  {/* Repuestos */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      Repuestos usados
                      {sparePartsUsed.length > 0 && (
                        <span className="bg-muted px-1.5 py-0.5 rounded-full text-xs">{sparePartsUsed.length}</span>
                      )}
                    </p>
                    <Popover open={sparePartComboOpen} onOpenChange={setSparePartComboOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={sparePartComboOpen}
                          className="w-full justify-between h-9 text-sm font-normal"
                        >
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Search className="h-3.5 w-3.5" />
                            {sparePartsUsed.length > 0
                              ? `${sparePartsUsed.length} seleccionado${sparePartsUsed.length > 1 ? 's' : ''}`
                              : 'Seleccionar repuestos...'}
                          </span>
                          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Filtrar por nombre..." className="text-sm h-9" />
                          <CommandList>
                            <CommandEmpty className="text-sm py-4 text-center">No se encontraron repuestos</CommandEmpty>
                            <CommandGroup>
                              {(allSpareParts || []).map((sp) => {
                                const isSelected = sparePartsUsed.some(u => u.id === sp.id);
                                const selectedItem = sparePartsUsed.find(u => u.id === sp.id);
                                return (
                                  <CommandItem
                                    key={sp.id}
                                    value={`${sp.name} ${sp.code || ''}`}
                                    onSelect={() => {
                                      if (isSelected) removeItem(sparePartsUsed, setSparePartsUsed, sp.id);
                                      else addItem(sparePartsUsed, setSparePartsUsed, sp);
                                    }}
                                    className="text-sm"
                                  >
                                    <div className={cn(
                                      'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border shrink-0',
                                      isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'
                                    )}>
                                      {isSelected && <Check className="h-3 w-3" />}
                                    </div>
                                    <Package className="h-3.5 w-3.5 text-muted-foreground mr-1.5 shrink-0" />
                                    <span className="flex-1 truncate">{sp.name}</span>
                                    {sp.code && <span className="text-muted-foreground text-xs ml-1 shrink-0">{sp.code}</span>}
                                    {isSelected && (
                                      <div className="flex items-center gap-1 ml-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                        <span className="text-xs text-muted-foreground">×</span>
                                        <input
                                          type="number"
                                          min={1}
                                          value={selectedItem?.quantity ?? 1}
                                          onChange={(e) => { e.stopPropagation(); updateItemQty(sparePartsUsed, setSparePartsUsed, sp.id, parseInt(e.target.value) || 1); }}
                                          onPointerDown={(e) => e.stopPropagation()}
                                          onKeyDown={(e) => e.stopPropagation()}
                                          className="h-6 w-12 text-xs text-center rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                                        />
                                      </div>
                                    )}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {sparePartsUsed.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {sparePartsUsed.map((item) => (
                          <div key={item.id} className="flex items-center gap-1.5 text-xs bg-muted/60 rounded-md px-2.5 py-1.5 border">
                            <span className="truncate max-w-[120px]">{item.name}</span>
                            <span className="text-muted-foreground">×</span>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => updateItemQty(sparePartsUsed, setSparePartsUsed, item.id, parseInt(e.target.value) || 1)}
                              className="h-5 w-9 text-xs text-center rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => removeItem(sparePartsUsed, setSparePartsUsed, item.id)}>
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Herramientas */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      Herramientas usadas
                      {toolsUsed.length > 0 && (
                        <span className="bg-muted px-1.5 py-0.5 rounded-full text-xs">{toolsUsed.length}</span>
                      )}
                    </p>
                    <Popover open={toolComboOpen} onOpenChange={setToolComboOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={toolComboOpen}
                          className="w-full justify-between h-9 text-sm font-normal"
                        >
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Search className="h-3.5 w-3.5" />
                            {toolsUsed.length > 0
                              ? `${toolsUsed.length} seleccionada${toolsUsed.length > 1 ? 's' : ''}`
                              : 'Seleccionar herramientas...'}
                          </span>
                          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Filtrar por nombre..." className="text-sm h-9" />
                          <CommandList>
                            <CommandEmpty className="text-sm py-4 text-center">No se encontraron herramientas</CommandEmpty>
                            <CommandGroup>
                              {(allTools || []).map((t) => {
                                const isSelected = toolsUsed.some(u => u.id === t.id);
                                const selectedItem = toolsUsed.find(u => u.id === t.id);
                                return (
                                  <CommandItem
                                    key={t.id}
                                    value={`${t.name} ${t.code || ''}`}
                                    onSelect={() => {
                                      if (isSelected) removeItem(toolsUsed, setToolsUsed, t.id);
                                      else addItem(toolsUsed, setToolsUsed, t);
                                    }}
                                    className="text-sm"
                                  >
                                    <div className={cn(
                                      'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border shrink-0',
                                      isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'
                                    )}>
                                      {isSelected && <Check className="h-3 w-3" />}
                                    </div>
                                    <Wrench className="h-3.5 w-3.5 text-muted-foreground mr-1.5 shrink-0" />
                                    <span className="flex-1 truncate">{t.name}</span>
                                    {t.code && <span className="text-muted-foreground text-xs ml-1 shrink-0">{t.code}</span>}
                                    {isSelected && (
                                      <div className="flex items-center gap-1 ml-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                        <span className="text-xs text-muted-foreground">×</span>
                                        <input
                                          type="number"
                                          min={1}
                                          value={selectedItem?.quantity ?? 1}
                                          onChange={(e) => { e.stopPropagation(); updateItemQty(toolsUsed, setToolsUsed, t.id, parseInt(e.target.value) || 1); }}
                                          onPointerDown={(e) => e.stopPropagation()}
                                          onKeyDown={(e) => e.stopPropagation()}
                                          className="h-6 w-12 text-xs text-center rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                                        />
                                      </div>
                                    )}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {toolsUsed.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {toolsUsed.map((item) => (
                          <div key={item.id} className="flex items-center gap-1.5 text-xs bg-muted/60 rounded-md px-2.5 py-1.5 border">
                            <span className="truncate max-w-[120px]">{item.name}</span>
                            <span className="text-muted-foreground">×</span>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => updateItemQty(toolsUsed, setToolsUsed, item.id, parseInt(e.target.value) || 1)}
                              className="h-5 w-9 text-xs text-center rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => removeItem(toolsUsed, setToolsUsed, item.id)}>
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Archivos y fotos */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Archivos y fotos</p>
                    {attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {attachments.map((att, idx) => (
                          <div key={idx} className="relative group">
                            {att.type === 'IMAGE' ? (
                              <img src={att.url} alt={att.filename} className="h-16 w-16 object-cover rounded-md border" />
                            ) : (
                              <div className="h-16 w-16 rounded-md border bg-muted flex items-center justify-center">
                                <FileText className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <button
                              type="button"
                              className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className={cn(
                      'flex items-center gap-2 h-9 px-3 rounded-md border border-dashed text-sm text-muted-foreground hover:text-foreground hover:border-border cursor-pointer transition-colors',
                      isUploading && 'opacity-50 pointer-events-none'
                    )}>
                      {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                      {isUploading ? 'Subiendo...' : 'Subir foto o archivo'}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx"
                        multiple
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          for (const file of files) await handleUploadFile(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  <div className="border-t pt-4 space-y-5">
                    {/* Verificación */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-muted-foreground" />
                        Verificación antes de cerrar
                        {Object.values(verificationChecks).filter(Boolean).length > 0 && (
                          <span className="text-xs bg-success/10 text-success px-1.5 py-0.5 rounded-full">
                            {Object.values(verificationChecks).filter(Boolean).length}/{VERIFICATION_ITEMS.length}
                          </span>
                        )}
                      </p>
                      <div className="rounded-md border bg-muted/20 p-3 space-y-2.5">
                        <p className="text-[10px] text-muted-foreground">
                          Confirmá que realizaste las siguientes verificaciones antes de cerrar la orden:
                        </p>
                        {VERIFICATION_ITEMS.map((item) => (
                          <div key={item.id} className="flex items-center gap-2.5">
                            <Checkbox
                              id={`verify-${item.id}`}
                              checked={!!verificationChecks[item.id]}
                              onCheckedChange={(checked) =>
                                setVerificationChecks(prev => ({ ...prev, [item.id]: !!checked }))
                              }
                            />
                            <label
                              htmlFor={`verify-${item.id}`}
                              className="text-sm text-foreground cursor-pointer select-none"
                            >
                              {item.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Plan de control */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                        Plan de control de seguimiento
                        {controlPlan.length > 0 && (
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">
                            {controlPlan.length} {controlPlan.length === 1 ? 'paso' : 'pasos'}
                          </span>
                        )}
                      </p>

                      {controlPlan.length === 0 ? (
                        <div className="text-center py-5 text-muted-foreground border rounded-md bg-muted/10">
                          <Shield className="h-6 w-6 mx-auto mb-1.5 opacity-30" />
                          <p className="text-sm">No hay controles programados</p>
                          <p className="text-xs">Agregá verificaciones para asegurar que la solución funciona</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {controlPlan.map((ctrl) => (
                            <div key={ctrl.order} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2.5 border">
                              <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5">
                                #{ctrl.order}
                              </Badge>
                              <span className="flex-1 text-sm">{ctrl.description}</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'shrink-0 text-[10px]',
                                  ctrl.type === 'from_previous'
                                    ? 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400'
                                    : ''
                                )}
                              >
                                {ctrl.type === 'from_previous' ? (
                                  <>
                                    <Clock className="h-2.5 w-2.5 mr-0.5" />
                                    +{ctrl.delayMinutes >= 60
                                      ? `${Math.floor(ctrl.delayMinutes / 60)}h${ctrl.delayMinutes % 60 > 0 ? ` ${ctrl.delayMinutes % 60}m` : ''}`
                                      : `${ctrl.delayMinutes}m`
                                    } del anterior
                                  </>
                                ) : (
                                  <>
                                    <Timer className="h-2.5 w-2.5 mr-0.5" />
                                    {ctrl.delayMinutes >= 60
                                      ? `${Math.floor(ctrl.delayMinutes / 60)}h${ctrl.delayMinutes % 60 > 0 ? ` ${ctrl.delayMinutes % 60}m` : ''}`
                                      : `${ctrl.delayMinutes}m`
                                    } desde resolución
                                  </>
                                )}
                              </Badge>
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => removeControl(ctrl.order)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Agregar control */}
                      <div className="space-y-2 border rounded-lg p-3 bg-background">
                        <p className="text-xs font-medium">Agregar control</p>
                        <Input
                          placeholder="Ej: Verificar que no pierda presión"
                          value={newControlDesc}
                          onChange={(e) => setNewControlDesc(e.target.value)}
                          className="h-9"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); addControl(); }
                          }}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={newControlType}
                            onValueChange={(v) => setNewControlType(v as 'from_resolution' | 'from_previous')}
                          >
                            <SelectTrigger className="h-8 text-xs w-auto min-w-[170px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="from_resolution">
                                <span className="flex items-center gap-1.5">
                                  <Timer className="h-3 w-3" />
                                  Desde la resolución
                                </span>
                              </SelectItem>
                              <SelectItem value="from_previous">
                                <span className="flex items-center gap-1.5">
                                  <Clock className="h-3 w-3" />
                                  Desde el control anterior
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">después de</span>
                            <Input
                              type="number"
                              placeholder="60"
                              value={newControlDelay}
                              onChange={(e) => setNewControlDelay(e.target.value)}
                              className="h-8 w-16 text-xs"
                              min={1}
                            />
                            <span className="text-xs text-muted-foreground">min</span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-8 text-xs"
                            onClick={addControl}
                            disabled={!newControlDesc.trim()}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Agregar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="flex-shrink-0 bg-muted/30 border-t px-4 py-2.5 sm:px-6 sm:py-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Paso {currentStepIndex + 1} de {FORM_STEP_IDS.length}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={isFirstStep ? () => onOpenChange(false) : handlePrevStep}
                  >
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                    {isFirstStep ? 'Cancelar' : 'Anterior'}
                  </Button>

                  {!isLastStep ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleNextStep}
                      disabled={isBlocked}
                    >
                      Siguiente
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      size="sm"
                      disabled={closeMutation.isPending || isBlocked}
                      className="bg-success hover:bg-success/90"
                    >
                      {closeMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Cerrar Orden
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
