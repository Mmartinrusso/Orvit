'use client';

import { useState, useRef, useEffect } from 'react';
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

      queryClient.invalidateQueries({ queryKey: ['failures-grid'] });
      queryClient.invalidateQueries({ queryKey: ['failure-stats'] });
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
      router.push(`/mantenimiento/incidentes?id=${creationResult.occurrence.id}`);
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
              onSubmit={(e) => e.preventDefault()}
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              {/* ── Sticky Header: Título + Stepper ── */}
              <div style={{ flexShrink: 0, background: '#FFFFFF', borderBottom: '1px solid #E4E4E8' }}>
                <div className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="-ml-1"
                      style={{ height: '28px', width: '28px', borderRadius: '6px' }}
                      onClick={handlePrevFormStep}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {incidentType === 'ROTURA' ? 'Nueva Rotura' : 'Nueva Falla'}
                        <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: incidentType === 'ROTURA' ? '#FEE2E2' : '#FEF3C7', color: incidentType === 'ROTURA' ? '#DC2626' : '#D97706' }}>Reporte Rápido</span>
                      </h2>
                      <p style={{ fontSize: '12px', color: '#9CA3AF' }}>
                        Paso {currentFormStepIndex + 1} de {formStepIds.length}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    style={{ height: '28px', width: '28px', borderRadius: '6px' }}
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
                        <div style={{ height: '36px', width: '36px', borderRadius: '8px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <AlertTriangle style={{ height: '20px', width: '20px', color: '#D97706' }} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>¿Dónde ocurrió?</h3>
                          <p style={{ fontSize: '12px', color: '#6B7280' }}>
                            Seleccioná la máquina y componente(s) afectados
                          </p>
                        </div>
                      </div>

                      <FormField
                        control={form.control}
                        name="machineId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>Máquina / Componente(s) *</FormLabel>
                            <FormControl>
                              <div style={{ border: '1px solid #E4E4E8', borderRadius: '8px', padding: '8px 12px' }}>
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
                              </div>
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
                        <div style={{ height: '36px', width: '36px', borderRadius: '8px', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <AlertTriangle style={{ height: '20px', width: '20px', color: '#DC2626' }} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>¿Qué pasó?</h3>
                          <p style={{ fontSize: '12px', color: '#6B7280' }}>
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
                            <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>¿Qué pasó? *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ej: Se escucha ruido extraño en rodamiento"
                                style={{ border: '1px solid #E4E4E8', borderRadius: '8px' }}
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
                            <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>Síntomas (opcional)</FormLabel>
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
                          <FormItem className="flex flex-row items-center justify-between" style={{ border: '1px solid #E4E4E8', borderRadius: '8px', padding: '12px' }}>
                            <div className="space-y-0.5">
                              <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>¿Paró la producción?</FormLabel>
                              <p style={{ fontSize: '11px', color: '#9CA3AF' }}>
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
                            <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>Descripción detallada (opcional)</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describí el problema con más detalle..."
                                rows={3}
                                style={{ border: '1px solid #E4E4E8', borderRadius: '8px' }}
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
                        <div style={{ height: '36px', width: '36px', borderRadius: '8px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Camera style={{ height: '20px', width: '20px', color: '#2563EB' }} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Clasificación y evidencia</h3>
                          <p style={{ fontSize: '12px', color: '#6B7280' }}>
                            Agregá fotos y clasificá la falla (todo opcional)
                          </p>
                        </div>
                      </div>

                      {/* Upload foto — prominente */}
                      <div className="space-y-3">
                        <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>Foto</FormLabel>

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
                          style={{ width: '100%', borderRadius: '8px', border: '2px dashed #E4E4E8', padding: '24px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '8px', background: '#FAFAFA', cursor: isUploading ? 'not-allowed' : 'pointer', opacity: isUploading ? 0.5 : 1, transition: 'all 0.15s ease' }}
                          onMouseEnter={(e) => { if (!isUploading) { e.currentTarget.style.borderColor = '#D8D8DE'; e.currentTarget.style.background = '#F3F4F6'; }}}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E4E4E8'; e.currentTarget.style.background = '#FAFAFA'; }}
                        >
                          {isUploading ? (
                            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                          ) : (
                            <Camera className="h-8 w-8 text-muted-foreground" />
                          )}
                          <span style={{ fontSize: '13px', color: '#6B7280' }}>
                            {isUploading ? `Subiendo ${uploadProgress}%` : 'Tocar para sacar foto o subir imagen'}
                          </span>
                          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                            JPG, PNG hasta 5MB
                          </span>
                        </button>

                        {/* Barra de progreso */}
                        {isUploading && (
                          <div style={{ width: '100%', background: '#F3F4F6', borderRadius: '8px', height: '6px' }}>
                            <div
                              style={{ background: '#2563EB', height: '6px', borderRadius: '8px', transition: 'all 0.3s ease', width: `${uploadProgress}%` }}
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
                            <FormItem className="flex flex-row items-center justify-between" style={{ border: '1px solid #E4E4E8', borderRadius: '8px', padding: '12px' }}>
                              <div className="space-y-0.5">
                                <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151', cursor: 'pointer' }}>
                                  Falla Intermitente
                                </FormLabel>
                                <p style={{ fontSize: '11px', color: '#9CA3AF' }}>
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
                            <FormItem className="flex flex-row items-center justify-between" style={{ border: '1px solid #E4E4E8', borderRadius: '8px', padding: '12px' }}>
                              <div className="space-y-0.5">
                                <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151', cursor: 'pointer' }}>
                                  Riesgo Seguridad
                                </FormLabel>
                                <p style={{ fontSize: '11px', color: '#9CA3AF' }}>
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
                            <FormItem className="flex flex-row items-center justify-between" style={{ border: '1px solid #E4E4E8', borderRadius: '8px', padding: '12px' }}>
                              <div className="space-y-0.5">
                                <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151', cursor: 'pointer' }}>
                                  Solo Observación
                                </FormLabel>
                                <p style={{ fontSize: '11px', color: '#9CA3AF' }}>
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
              <div style={{ flexShrink: 0, background: '#FAFAFA', borderTop: '1px solid #E4E4E8', padding: '10px 24px' }}>
                <div className="flex items-center justify-between">
                  <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                    Paso {currentFormStepIndex + 1} de {formStepIds.length}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      style={{ borderRadius: '7px', border: '1px solid #E4E4E8', background: '#FFFFFF', fontSize: '13px' }}
                      onClick={handlePrevFormStep}
                    >
                      <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                      {isFirstFormStep ? 'Cancelar' : 'Anterior'}
                    </Button>

                    {!isLastFormStep ? (
                      <Button
                        type="button"
                        size="sm"
                        style={{ borderRadius: '7px', background: '#111827', color: '#FFFFFF', fontSize: '13px' }}
                        onClick={handleNextFormStep}
                      >
                        Siguiente
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        style={{ borderRadius: '7px', background: '#059669', color: '#FFFFFF', fontSize: '13px' }}
                        onClick={handleValidateAndSubmit}
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
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontSize: '16px', fontWeight: 600 }}>
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
            <div style={{ borderRadius: '8px', border: '1px solid #E4E4E8', padding: '12px', background: '#FAFAFA' }}>
              <div className="flex items-start justify-between">
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>{creationResult?.occurrence.title}</p>
                  <p style={{ fontSize: '11px', color: '#6B7280' }}>
                    Falla #{creationResult?.occurrence.id}
                  </p>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: creationResult?.occurrence.priority === 'P1' ? '#FEE2E2' : creationResult?.occurrence.priority === 'P2' ? '#FEF3C7' : '#F3F4F6', color: creationResult?.occurrence.priority === 'P1' ? '#DC2626' : creationResult?.occurrence.priority === 'P2' ? '#D97706' : '#6B7280' }}>
                  {creationResult?.occurrence.priority}
                </span>
              </div>
            </div>

            {creationResult?.workOrder && (
              <div style={{ borderRadius: '8px', border: '1px solid #E4E4E8', padding: '12px', background: '#EFF6FF' }}>
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4" style={{ color: '#2563EB' }} />
                  <div>
                    <p className="font-medium" style={{ color: '#2563EB' }}>
                      OT #{creationResult.workOrder.id}
                    </p>
                    <p style={{ fontSize: '12px', color: '#6B7280' }}>
                      {creationResult.workOrder.title}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {creationResult?.isObservation && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6B7280' }}>
                <AlertTriangle className="h-4 w-4" />
                <span>No se creó OT porque es solo una observación</span>
              </div>
            )}

            {creationResult?.resolvedImmediately && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#059669' }}>
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
              style={{ borderRadius: '7px', border: '1px solid #E4E4E8', background: '#FFFFFF', fontSize: '13px' }}
            >
              Cerrar
            </Button>

            {creationResult?.workOrder && (
              <Button
                onClick={handleViewWorkOrder}
                className="sm:flex-1"
                style={{ borderRadius: '7px', background: '#111827', color: '#FFFFFF', fontSize: '13px' }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Ver Orden de Trabajo
              </Button>
            )}

            {!creationResult?.workOrder && (
              <Button
                onClick={handleViewFailure}
                className="sm:flex-1"
                style={{ borderRadius: '7px', background: '#111827', color: '#FFFFFF', fontSize: '13px' }}
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
