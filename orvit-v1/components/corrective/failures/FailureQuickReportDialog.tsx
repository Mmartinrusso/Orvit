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
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  Upload,
  Loader2,
  X,
  CheckCircle2,
  FileText,
  Wrench,
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

  // OPCIONALES (modo detallado - colapsable)
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

interface FailureQuickReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedMachineId?: number;
  preselectedComponentId?: string | number;
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
 * Dialog de reporte rápido de fallas
 *
 * UX "Cargar Poco":
 * - Modo rápido: 3 inputs + foto = 20-30s
 * - "+ Detalles" colapsable para datos opcionales
 *
 * Flujo:
 * 1. Usuario llena 3 campos básicos
 * 2. Submit → Detectar duplicados
 * 3. Si hay duplicados → Modal con opciones (Vincular | Nueva)
 * 4. Si NO hay duplicados → Crear directamente
 * 5. Si causedDowntime=true → Crear downtime automático
 */
export function FailureQuickReportDialog({
  open,
  onOpenChange,
  preselectedMachineId,
  preselectedComponentId,
}: FailureQuickReportDialogProps) {
  const router = useRouter();
  const { hasPermission, user } = useAuth();
  const [showDetails, setShowDetails] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingData, setPendingData] = useState<QuickReportFormData | null>(null);

  // Modal de éxito con acciones
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [creationResult, setCreationResult] = useState<CreationResult | null>(null);

  // Modal de asignación (solo si usuario tiene permiso de asignar)
  // Verificamos: permiso explícito O rol que típicamente puede asignar
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

  // Observar si es observación o cierre inmediato
  const isObservation = form.watch('isObservation');
  const resolveImmediately = form.watch('resolveImmediately');

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
      formData.append('entityId', 'temp'); // Temporal hasta crear la falla
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

      // Agregar a lista de archivos
      const newFile: UploadedFile = {
        url: data.url,
        fileName: data.fileName,
        originalName: data.originalName || file.name,
      };
      setUploadedFiles((prev) => [...prev, newFile]);

      // Actualizar form
      const currentAttachments = form.getValues('attachments') || [];
      form.setValue('attachments', [...currentAttachments, data.url]);

      toast.success('Foto subida');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al subir');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset input
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
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear falla');
      }

      return res.json();
    },
    onSuccess: (data) => {
      // Si retorna hasDuplicates=true → duplicados encontrados (HTTP 200)
      if (data.hasDuplicates && data.duplicates?.length > 0) {
        setDuplicates(data.duplicates);
        setShowDuplicateModal(true);
        setPendingData(form.getValues());
        return;
      }

      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['failure-occurrences'] });
      queryClient.invalidateQueries({ queryKey: ['failure-stats'] });
      queryClient.invalidateQueries({ queryKey: ['failure-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['failures-grid'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });

      // Si fue vinculado a existente
      if (data.wasLinkedToExisting && data.linkedTo) {
        toast.success(`Falla vinculada al caso #${data.linkedTo.id}`);
        resetAndClose();
        return;
      }

      // Guardar resultado para mostrar modal de acciones
      setCreationResult({
        occurrence: data.occurrence,
        workOrder: data.workOrder || undefined,
        isObservation: data.isObservation || false,
        resolvedImmediately: data.resolvedImmediately || false,
      });

      // Si hay OT creada y el usuario puede asignar → mostrar modal de asignación
      // Esto aplica para supervisores, no para operarios
      if (data.workOrder && canAssignWorkOrders) {
        setShowAssignDialog(true);
        toast.success('Falla reportada. Asigna la OT a un técnico.');
      } else {
        // Para operarios o si no hay OT → mostrar modal de éxito normal
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
    setShowDetails(false);
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
      // Forzar creación nueva (ignorar duplicados)
      quickReportMutation.mutate({ ...pendingData, forceCreate: true });
      setShowDuplicateModal(false);
    }
  };

  // Handler: Vincular a una falla existente
  const handleLinkDuplicate = async (mainOccurrenceId: number) => {
    if (pendingData) {
      // Crear falla vinculada al caso principal
      quickReportMutation.mutate({
        ...pendingData,
        linkToOccurrenceId: mainOccurrenceId,
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Nueva Falla - Reporte Rápido</DialogTitle>
            <DialogDescription>
              Complete los campos básicos. Use "+ Detalles" para información adicional.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              id="quick-report-form"
              className="flex flex-col flex-1 min-h-0"
            >
            <DialogBody className="space-y-4">
              {/* === SECCIÓN RÁPIDA (3 campos) === */}
              <div className="rounded-lg border p-4 space-y-4 bg-info-muted/50">
                <p className="text-sm font-medium text-info-muted-foreground">
                  Reporte Rápido
                </p>

                {/* 1. Máquina/Componente(s) */}
                <FormField
                  control={form.control}
                  name="machineId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        1. Máquina / Componente(s) *
                      </FormLabel>
                      <FormControl>
                        <ComponentTreeSelector
                          value={{
                            machineId: field.value,
                            componentIds: form.watch('componentIds'),
                            subcomponentIds: form.watch('subcomponentIds'),
                          }}
                          onChange={(selection) => {
                            // Si machineId es undefined, resetear todo el form field
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

                {/* 2. Título/Síntomas */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>2. ¿Qué pasó? *</FormLabel>
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

                {/* Síntomas (chips) */}
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

                {/* 3. ¿Paró producción? */}
                <FormField
                  control={form.control}
                  name="causedDowntime"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 bg-card">
                      <div className="space-y-0.5">
                        <FormLabel>
                          3. ¿Paró la producción?
                        </FormLabel>
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

                {/* Upload foto */}
                <div className="space-y-2">
                  <FormLabel>Foto (opcional)</FormLabel>

                  {/* Input oculto - capture="environment" abre cámara trasera en móviles */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={isUploading}
                  />

                  {/* Botón de subida */}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-3.5 w-3.5" />
                      )}
                      {isUploading ? `Subiendo ${uploadProgress}%` : 'Subir Foto'}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      JPG, PNG hasta 5MB
                    </span>
                  </div>

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
              </div>

              {/* === "+ DETALLES" COLAPSABLE === */}
              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full flex items-center justify-between"
                  >
                    <span className="text-sm font-medium">
                      {showDetails ? '− Ocultar Detalles' : '+ Agregar Detalles'}
                    </span>
                    <ChevronDown
                      className={cn('h-4 w-4 transition-transform', showDetails && 'rotate-180')}
                    />
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent className="pt-3">
                  <div className="rounded-lg border p-4 space-y-4 bg-muted/50">
                    <p className="text-xs font-medium text-muted-foreground">
                      Información adicional (opcional)
                    </p>

                    {/* Descripción detallada */}
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descripción Detallada</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describa el problema con más detalle..."
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

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
                                  // Si es observación, desactivar cierre inmediato
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

                    {/* Cierre inmediato - solo si NO es observación */}
                    {!isObservation && (
                      <div className="rounded-lg border border-success-muted p-4 bg-success-muted/50 space-y-3">
                        <FormField
                          control={form.control}
                          name="resolveImmediately"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between">
                              <div className="space-y-0.5">
                                <FormLabel className="cursor-pointer flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 text-success" />
                                  Ya lo resolví
                                </FormLabel>
                                <p className="text-xs text-muted-foreground">
                                  Registrar como solucionado inmediatamente (sin crear OT)
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

                        {/* Campo de solución con Rich Text - solo si resolveImmediately */}
                        {resolveImmediately && (
                          <FormField
                            control={form.control}
                            name="immediateSolution"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>¿Qué hiciste para solucionarlo?</FormLabel>
                                <FormControl>
                                  <RichTextEditor
                                    content={field.value || ''}
                                    onChange={field.onChange}
                                    placeholder="Describe la solución aplicada. Puedes usar formato y agregar imágenes..."
                                    minHeight="120px"
                                    onImageUpload={async (file: File) => {
                                      // Subir imagen a S3
                                      const formData = new FormData();
                                      formData.append('file', file);
                                      formData.append('entityType', 'failure-solution');
                                      formData.append('entityId', 'temp');
                                      formData.append('fileType', 'photo');

                                      const res = await fetch('/api/upload', {
                                        method: 'POST',
                                        body: formData,
                                      });

                                      if (!res.ok) {
                                        throw new Error('Error al subir imagen');
                                      }

                                      const data = await res.json();
                                      return data.url;
                                    }}
                                  />
                                </FormControl>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Usa el botón de imagen para agregar fotos de la reparación
                                </p>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

            </DialogBody>
            </form>
          </Form>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="quick-report-form"
              size="sm"
              disabled={quickReportMutation.isPending}
            >
              {quickReportMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Reportar Falla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Duplicados */}
      <DuplicateDetectionModal
        open={showDuplicateModal}
        onOpenChange={(open) => {
          setShowDuplicateModal(open);
          if (!open) {
            // Si cierra el modal sin elegir, limpiar datos
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
          {/* Resumen de lo creado */}
          <div className="space-y-3">
            {/* Falla */}
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

            {/* OT creada (si existe) */}
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

            {/* Info adicional según tipo */}
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

          {/* Acciones */}
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
              // Si cierra sin asignar, mostrar modal de éxito
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
            // Después de asignar exitosamente, cerrar todo
            resetAndClose();
          }}
        />
      )}
    </>
  );
}
