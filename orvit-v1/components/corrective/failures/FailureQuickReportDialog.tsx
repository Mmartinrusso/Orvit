'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Stepper, type Step } from '@/components/ui/stepper';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  X,
  CheckCircle2,
  FileText,
  Camera,
  AlertTriangle,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { ComponentTreeSelector } from './ComponentTreeSelector';
import { SymptomChips } from './SymptomChips';
import { DuplicateDetectionModal } from './DuplicateDetectionModal';
import { AssignAndPlanDialog } from '@/components/work-orders/AssignAndPlanDialog';
import { useAuth } from '@/contexts/AuthContext';

interface UploadedFile {
  url: string;
  fileName: string;
  originalName: string;
}

/**
 * Schema para Quick Report (modo rápido 20-30s)
 * Solo 3 campos obligatorios + foto opcional
 * Soporta múltiples componentes y subcomponentes
 */
const quickReportSchema = z.object({
  // OBLIGATORIOS (modo rápido)
  machineId: z.number({ required_error: 'Seleccione una máquina' }),
  componentIds: z.array(z.number()).optional(),
  subcomponentIds: z.array(z.number()).optional(),
  title: z.string().min(5, 'Mínimo 5 caracteres').max(100),
  causedDowntime: z.boolean().default(false),

  // OPCIONALES (modo detallado)
  description: z.string().optional(),
  symptomIds: z.array(z.number()).optional(),
  isIntermittent: z.boolean().default(false),
  isObservation: z.boolean().default(false),
  isSafetyRelated: z.boolean().default(false),
  attachments: z.array(z.string()).optional(),

  // CIERRE INMEDIATO (ya se resolvió en el momento)
  resolveImmediately: z.boolean().default(false),
  immediateSolution: z.string().optional(),
});

type QuickReportFormData = z.infer<typeof quickReportSchema>;

// Resultado de la creación
interface CreationResult {
  occurrence: {
    id: number;
    title: string;
    priority: string;
    status: string;
  };
  workOrder?: {
    id: number;
    title: string;
    status: string;
    priority: string;
  };
  isObservation: boolean;
  resolvedImmediately: boolean;
}

// ── Stepper config ──
type FormStep = 'equipo' | 'problema' | 'detalle';

const formSteps: Step[] = [
  { id: 'equipo', label: 'Equipo', description: '¿Dónde ocurrió?' },
  { id: 'problema', label: 'Problema', description: '¿Qué pasó?' },
  { id: 'detalle', label: 'Detalle', description: 'Clasificación y evidencia' },
];

const formStepIds: FormStep[] = ['equipo', 'problema', 'detalle'];

interface FailureQuickReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedMachineId?: number;
  preselectedComponentId?: string | number;
  incidentType?: 'FALLA' | 'ROTURA';
}

interface DuplicateCandidate {
  id: number;
  title: string;
  similarity: number;
  reportedAt: string;
  machine: { name: string };
  status: string;
}

/**
 * Dialog de reporte rápido de fallas — Stepper Wizard
 *
 * 3 pasos:
 * 1. Equipo — ¿Dónde ocurrió? (máquina/componentes)
 * 2. Problema — ¿Qué pasó? (título, síntomas, downtime, descripción)
 * 3. Detalle — Clasificación y evidencia (foto, flags, resolución inmediata)
 *
 * Flujo post-submit:
 * 1. Detectar duplicados → Modal con opciones
 * 2. Crear → Modal éxito + AssignAndPlan si supervisor
 */
export function FailureQuickReportDialog({
  open,
  onOpenChange,
  preselectedMachineId,
  preselectedComponentId,
  incidentType = 'FALLA',
}: FailureQuickReportDialogProps) {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  // ── Stepper state ──
  const [formStep, setFormStep] = useState<FormStep>('equipo');

  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingData, setPendingData] = useState<QuickReportFormData | null>(null);

  // Modal de éxito con acciones
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [creationResult, setCreationResult] = useState<CreationResult | null>(null);

  // Modal de asignación (solo si usuario tiene permiso de asignar)
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const userRole = user?.role?.toUpperCase() || '';
  const canAssignWorkOrders =
    hasPermission('work_orders.assign') ||
    userRole.includes('ADMIN') ||
    userRole.includes('SUPERVISOR') ||
    userRole.includes('COORDINADOR') ||
    userRole.includes('JEFE') ||
    userRole.includes('GERENTE') ||
    userRole.includes('ENCARGADO');

  // Upload state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  const form = useForm<QuickReportFormData>({
    resolver: zodResolver(quickReportSchema),
    defaultValues: {
      title: '',
      description: '',
      componentIds: [],
      subcomponentIds: [],
      causedDowntime: false,
      isIntermittent: false,
      isObservation: false,
      isSafetyRelated: false,
      symptomIds: [],
      attachments: [],
      resolveImmediately: false,
      immediateSolution: '',
    },
  });

  // Preseleccionar máquina y componente cuando el dialog se abre
  useEffect(() => {
    if (open && preselectedMachineId) {
      form.setValue('machineId', preselectedMachineId);
      if (preselectedComponentId) {
        form.setValue('componentIds', [Number(preselectedComponentId)]);
      }
    }
  }, [open, preselectedMachineId, preselectedComponentId]);

  // Observar si es observación
  const isObservation = form.watch('isObservation');

  // ── Stepper navigation ──
  const currentFormStepIndex = formStepIds.indexOf(formStep);
  const isFirstFormStep = currentFormStepIndex === 0;
  const isLastFormStep = currentFormStepIndex === formStepIds.length - 1;

  const handleNextFormStep = async () => {
    // Validar campos del paso actual antes de avanzar
    let isValid = true;
    if (formStep === 'equipo') {
      isValid = await form.trigger('machineId');
      if (!isValid) toast.error('Seleccioná una máquina');
    } else if (formStep === 'problema') {
      isValid = await form.trigger('title');
      if (!isValid) toast.error('Completá el título (mínimo 5 caracteres)');
    }
    if (isValid && !isLastFormStep) {
      setFormStep(formStepIds[currentFormStepIndex + 1]);
    }
  };

  const handlePrevFormStep = () => {
    if (isFirstFormStep) {
      onOpenChange(false);
    } else {
      setFormStep(formStepIds[currentFormStepIndex - 1]);
    }
  };

  const handleStepClick = (stepId: string) => {
    setFormStep(stepId as FormStep);
  };

  // ── Validación y submit ──
  const handleValidateAndSubmit = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      const errors = form.formState.errors;
      if (errors.machineId) {
        setFormStep('equipo');
        toast.error('Seleccioná una máquina en el paso 1');
      } else if (errors.title) {
        setFormStep('problema');
        toast.error('Completá el título en el paso 2');
      } else {
        toast.error('Revisá los campos obligatorios');
      }
      return;
    }
    form.handleSubmit(handleSubmit)();
  };

  // Upload handler
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Solo se permiten imágenes (JPG, PNG, GIF, WebP)');
      return;
    }

    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('El archivo es muy grande. Máximo 5MB');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'failure');
      formData.append('entityId', 'temp');
      formData.append('fileType', 'photo');

      // Simular progreso
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al subir archivo');
      }

      const data = await response.json();

      const newFile: UploadedFile = {
        url: data.url,
        fileName: data.fileName,
        originalName: data.originalName || file.name,
      };
      setUploadedFiles((prev) => [...prev, newFile]);

      const currentAttachments = form.getValues('attachments') || [];
      form.setValue('attachments', [...currentAttachments, data.url]);

      toast.success('Foto subida');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al subir');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Remover archivo
  const handleRemoveFile = (urlToRemove: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.url !== urlToRemove));
    const currentAttachments = form.getValues('attachments') || [];
    form.setValue(
      'attachments',
      currentAttachments.filter((url) => url !== urlToRemove)
    );
  };

  // Mutation: Quick Report
  const quickReportMutation = useMutation({
    mutationFn: async (data: QuickReportFormData & { forceCreate?: boolean; linkToOccurrenceId?: number }) => {
      const res = await fetch('/api/failure-occurrences/quick-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, incidentType }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear falla');
      }

      return res.json();
    },
    onSuccess: (data) => {
      if (data.hasDuplicates && data.duplicates?.length > 0) {
        setDuplicates(data.duplicates);
        setShowDuplicateModal(true);
        setPendingData(form.getValues());
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['failure-occurrences'] });
      queryClient.invalidateQueries({ queryKey: ['failure-stats'] });
      queryClient.invalidateQueries({ queryKey: ['failure-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['failures-grid'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });

      if (data.wasLinkedToExisting && data.linkedTo) {
        toast.success(`Falla vinculada al caso #${data.linkedTo.id}`);
        resetAndClose();
        return;
      }

      setCreationResult({
        occurrence: data.occurrence,
        workOrder: data.workOrder || undefined,
        isObservation: data.isObservation || false,
        resolvedImmediately: data.resolvedImmediately || false,
      });

      if (data.workOrder && canAssignWorkOrders) {
        setShowAssignDialog(true);
        toast.success('Falla reportada. Asigna la OT a un técnico.');
      } else {
        setShowSuccessModal(true);
      }

      setShowDuplicateModal(false);
      setPendingData(null);
      setDuplicates([]);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (data: QuickReportFormData) => {
    quickReportMutation.mutate(data);
  };

  // Reset y cerrar todo
  const resetAndClose = () => {
    form.reset();
    setUploadedFiles([]);
    setShowDuplicateModal(false);
    setShowSuccessModal(false);
    setShowAssignDialog(false);
    setPendingData(null);
    setDuplicates([]);
    setCreationResult(null);
    setFormStep('equipo');
    onOpenChange(false);
  };

  // Handler: Ver la OT creada
  const handleViewWorkOrder = () => {
    if (creationResult?.workOrder) {
      resetAndClose();
      router.push(`/mantenimiento/ordenes-trabajo?id=${creationResult.workOrder.id}`);
    }
  };

  // Handler: Ver la falla creada
  const handleViewFailure = () => {
    if (creationResult?.occurrence) {
      resetAndClose();
      router.push(`/mantenimiento/fallas?id=${creationResult.occurrence.id}`);
    }
  };

  // Handler: Crear nueva falla ignorando duplicados
  const handleCreateNewAfterDuplicates = () => {
    if (pendingData) {
      quickReportMutation.mutate({ ...pendingData, forceCreate: true });
      setShowDuplicateModal(false);
    }
  };

  // Handler: Vincular a una falla existente
  const handleLinkDuplicate = async (mainOccurrenceId: number) => {
    if (pendingData) {
      quickReportMutation.mutate({
        ...pendingData,
        linkToOccurrenceId: mainOccurrenceId,
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          size="xl"
          className="p-0 flex flex-col max-h-[90vh]"
          hideCloseButton
        >
          <Form {...form}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleValidateAndSubmit();
              }}
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              {/* ── Sticky Header: Título + Stepper ── */}
              <div className="flex-shrink-0 bg-background border-b">
                <div className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 -ml-1"
                      onClick={handlePrevFormStep}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <h2 className="text-base font-semibold flex items-center gap-2">
                        {incidentType === 'ROTURA' ? 'Nueva Rotura' : 'Nueva Falla'}
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                        >
                          Reporte Rápido
                        </Badge>
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Paso {currentFormStepIndex + 1} de {formStepIds.length}
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
                    steps={formSteps}
                    currentStep={formStep}
                    onStepClick={handleStepClick}
                    className="w-full max-w-md"
                  />
                </div>
              </div>

              {/* ── Contenido Scrollable ── */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-4 py-5 sm:px-6 sm:py-6 space-y-4">

                  {/* ═══ PASO 1: EQUIPO ═══ */}
                  {formStep === 'equipo' && (
                    <div className="space-y-5">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-9 w-9 rounded-lg bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
                          <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold">¿Dónde ocurrió?</h3>
                          <p className="text-xs text-muted-foreground">
                            Seleccioná la máquina y componente(s) afectados
                          </p>
                        </div>
                      </div>

                      <FormField
                        control={form.control}
                        name="machineId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Máquina / Componente(s) *</FormLabel>
                            <FormControl>
                              <ComponentTreeSelector
                                value={{
                                  machineId: field.value,
                                  componentIds: form.watch('componentIds'),
                                  subcomponentIds: form.watch('subcomponentIds'),
                                }}
                                onChange={(selection) => {
                                  if (selection.machineId === undefined) {
                                    form.setValue('machineId', undefined as any);
                                    form.setValue('componentIds', []);
                                    form.setValue('subcomponentIds', []);
                                  } else {
                                    form.setValue('machineId', selection.machineId);
                                    form.setValue('componentIds', selection.componentIds);
                                    form.setValue('subcomponentIds', selection.subcomponentIds);
                                  }
                                }}
                                allowMultiple={true}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* ═══ PASO 2: PROBLEMA ═══ */}
                  {formStep === 'problema' && (
                    <div className="space-y-5">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-9 w-9 rounded-lg bg-red-100 dark:bg-red-950 flex items-center justify-center">
                          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold">¿Qué pasó?</h3>
                          <p className="text-xs text-muted-foreground">
                            Describí el problema de la forma más clara posible
                          </p>
                        </div>
                      </div>

                      {/* Título */}
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>¿Qué pasó? *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ej: Se escucha ruido extraño en rodamiento"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Síntomas */}
                      <FormField
                        control={form.control}
                        name="symptomIds"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Síntomas (opcional)</FormLabel>
                            <FormControl>
                              <SymptomChips
                                value={field.value || []}
                                onChange={field.onChange}
                                machineId={form.watch('machineId')}
                                componentId={form.watch('componentIds')?.[0]}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {/* ¿Paró producción? */}
                      <FormField
                        control={form.control}
                        name="causedDowntime"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-card">
                            <div className="space-y-0.5">
                              <FormLabel>¿Paró la producción?</FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Se iniciará el registro de downtime automáticamente
                              </p>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {/* Descripción detallada */}
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descripción detallada (opcional)</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describí el problema con más detalle..."
                                rows={3}
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* ═══ PASO 3: DETALLE ═══ */}
                  {formStep === 'detalle' && (
                    <div className="space-y-5">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                          <Camera className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold">Clasificación y evidencia</h3>
                          <p className="text-xs text-muted-foreground">
                            Agregá fotos y clasificá la falla (todo opcional)
                          </p>
                        </div>
                      </div>

                      {/* Upload foto — prominente */}
                      <div className="space-y-3">
                        <FormLabel>Foto</FormLabel>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleFileSelect}
                          className="hidden"
                          disabled={isUploading}
                        />

                        {/* Zona de drop/click */}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className={cn(
                            'w-full rounded-lg border-2 border-dashed p-6 flex flex-col items-center gap-2 transition-colors',
                            'hover:border-primary/50 hover:bg-muted/50',
                            isUploading && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          {isUploading ? (
                            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                          ) : (
                            <Camera className="h-8 w-8 text-muted-foreground" />
                          )}
                          <span className="text-sm text-muted-foreground">
                            {isUploading ? `Subiendo ${uploadProgress}%` : 'Tocar para sacar foto o subir imagen'}
                          </span>
                          <span className="text-xs text-muted-foreground/60">
                            JPG, PNG hasta 5MB
                          </span>
                        </button>

                        {/* Barra de progreso */}
                        {isUploading && (
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        )}

                        {/* Preview de fotos subidas */}
                        {uploadedFiles.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {uploadedFiles.map((file) => (
                              <div
                                key={file.url}
                                className="relative group rounded-lg border overflow-hidden"
                              >
                                <img
                                  src={file.url}
                                  alt={file.originalName}
                                  className="h-16 w-16 object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFile(file.url)}
                                  className="absolute top-0.5 right-0.5 p-0.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Flags opcionales */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <FormField
                          control={form.control}
                          name="isIntermittent"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-card">
                              <div className="space-y-0.5">
                                <FormLabel className="cursor-pointer">
                                  Falla Intermitente
                                </FormLabel>
                                <p className="text-xs text-muted-foreground">
                                  Aparece y desaparece
                                </p>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="isSafetyRelated"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-card">
                              <div className="space-y-0.5">
                                <FormLabel className="cursor-pointer">
                                  Riesgo Seguridad
                                </FormLabel>
                                <p className="text-xs text-muted-foreground">
                                  Puede causar lesiones
                                </p>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="isObservation"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-card">
                              <div className="space-y-0.5">
                                <FormLabel className="cursor-pointer">
                                  Solo Observación
                                </FormLabel>
                                <p className="text-xs text-muted-foreground">
                                  No requiere acción
                                </p>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={(checked) => {
                                    field.onChange(checked);
                                    if (checked) {
                                      form.setValue('resolveImmediately', false);
                                    }
                                  }}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                    </div>
                  )}

                </div>
              </div>

              {/* ── Sticky Footer: Navegación ── */}
              <div className="flex-shrink-0 bg-muted/30 border-t px-4 py-2.5 sm:px-6 sm:py-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Paso {currentFormStepIndex + 1} de {formStepIds.length}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePrevFormStep}
                    >
                      <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                      {isFirstFormStep ? 'Cancelar' : 'Anterior'}
                    </Button>

                    {!isLastFormStep ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleNextFormStep}
                      >
                        Siguiente
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        size="sm"
                        disabled={quickReportMutation.isPending}
                      >
                        {quickReportMutation.isPending && (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        )}
                        Reportar Falla
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal de Duplicados */}
      <DuplicateDetectionModal
        open={showDuplicateModal}
        onOpenChange={(open) => {
          setShowDuplicateModal(open);
          if (!open) {
            setPendingData(null);
            setDuplicates([]);
          }
        }}
        duplicates={duplicates}
        onLinkDuplicate={handleLinkDuplicate}
        onCreateNew={handleCreateNewAfterDuplicates}
        isLinking={quickReportMutation.isPending}
      />

      {/* Modal de Éxito con Acciones */}
      <Dialog open={showSuccessModal} onOpenChange={(open) => {
        if (!open) resetAndClose();
      }}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              {creationResult?.isObservation
                ? 'Observación Registrada'
                : creationResult?.resolvedImmediately
                  ? 'Falla Resuelta'
                  : 'Falla Reportada'}
            </DialogTitle>
            <DialogDescription>
              {creationResult?.isObservation
                ? 'La observación ha sido registrada para seguimiento.'
                : creationResult?.resolvedImmediately
                  ? 'La falla ha sido registrada y marcada como resuelta.'
                  : 'Se creó una orden de trabajo para resolver esta falla.'}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
          <div className="space-y-3">
            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{creationResult?.occurrence.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Falla #{creationResult?.occurrence.id}
                  </p>
                </div>
                <Badge variant={
                  creationResult?.occurrence.priority === 'P1' ? 'destructive' :
                  creationResult?.occurrence.priority === 'P2' ? 'default' :
                  'secondary'
                }>
                  {creationResult?.occurrence.priority}
                </Badge>
              </div>
            </div>

            {creationResult?.workOrder && (
              <div className="rounded-lg border border-info-muted p-3 bg-info-muted/50">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-info-muted-foreground" />
                  <div>
                    <p className="font-medium text-info-muted-foreground">
                      OT #{creationResult.workOrder.id}
                    </p>
                    <p className="text-xs text-info-muted-foreground">
                      {creationResult.workOrder.title}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {creationResult?.isObservation && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                <span>No se creó OT porque es solo una observación</span>
              </div>
            )}

            {creationResult?.resolvedImmediately && (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                <span>Marcada como resuelta inmediatamente</span>
              </div>
            )}
          </div>
          </DialogBody>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={resetAndClose}
              className="sm:flex-1"
            >
              Cerrar
            </Button>

            {creationResult?.workOrder && (
              <Button
                onClick={handleViewWorkOrder}
                className="sm:flex-1"
              >
                <FileText className="h-4 w-4 mr-2" />
                Ver Orden de Trabajo
              </Button>
            )}

            {!creationResult?.workOrder && (
              <Button
                onClick={handleViewFailure}
                className="sm:flex-1"
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver Detalle
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Asignación (solo para supervisores con permiso) */}
      {creationResult?.workOrder && (
        <AssignAndPlanDialog
          open={showAssignDialog}
          onOpenChange={(open) => {
            setShowAssignDialog(open);
            if (!open) {
              setShowSuccessModal(true);
            }
          }}
          workOrder={{
            id: creationResult.workOrder.id,
            title: creationResult.workOrder.title,
            priority: creationResult.workOrder.priority,
            status: creationResult.workOrder.status,
          }}
          onSuccess={() => {
            resetAndClose();
          }}
        />
      )}
    </>
  );
}
