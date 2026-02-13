'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { StandardDialog } from '@/components/ui/standard-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertTriangle,
  Loader2,
  ChevronDown,
  Camera,
  X,
  Zap,
  Eye,
  Clock,
  Upload,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useMachinesInitial } from '@/hooks/use-machines-initial';
import { cn } from '@/lib/utils';

interface QuickReportFormData {
  machineId: number | null;
  componentIds: number[];
  title: string;
  causedDowntime: boolean;
  isObservation: boolean;
  isSafetyRelated: boolean;
  isIntermittent: boolean;
  description: string;
  failureCategory: 'MECANICA' | 'ELECTRICA' | 'HIDRAULICA' | 'NEUMATICA' | 'OTRA';
  attachments: string[];
}

interface DuplicateOccurrence {
  id: number;
  title: string;
  status: string;
  priority: string;
  reportedAt: string;
  similarity: number;
}

interface FailureQuickReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: any) => void;
  preselectedMachineId?: number;
}

export default function FailureQuickReportDialog({
  isOpen,
  onClose,
  onSuccess,
  preselectedMachineId,
}: FailureQuickReportDialogProps) {
  const { currentCompany } = useCompany();
  const { machines, isLoading: machinesLoading } = useMachinesInitial();

  const [formData, setFormData] = useState<QuickReportFormData>({
    machineId: preselectedMachineId || null,
    componentIds: [],
    title: '',
    causedDowntime: false,
    isObservation: false,
    isSafetyRelated: false,
    isIntermittent: false,
    description: '',
    failureCategory: 'MECANICA',
    attachments: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateOccurrence[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        machineId: preselectedMachineId || null,
        componentIds: [],
        title: '',
        causedDowntime: false,
        isObservation: false,
        isSafetyRelated: false,
        isIntermittent: false,
        description: '',
        failureCategory: 'MECANICA',
        attachments: [],
      });
      setDuplicates([]);
      setShowDuplicateModal(false);
      setShowDetails(false);
    }
  }, [isOpen, preselectedMachineId]);

  const selectedMachine = machines?.find(m => m.id === formData.machineId);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        formDataUpload.append('folder', 'failures');

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formDataUpload,
        });

        if (!response.ok) throw new Error('Error al subir archivo');
        const data = await response.json();
        return data.url;
      });

      const urls = await Promise.all(uploadPromises);
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...urls],
      }));
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron subir los archivos',
        variant: 'destructive',
      });
    } finally {
      setUploadingFiles(false);
    }
  };

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (forceCreate = false, linkToOccurrenceId?: number) => {
    if (!formData.machineId) {
      toast({
        title: 'Error',
        description: 'Debe seleccionar una máquina',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.title.trim() || formData.title.length < 5) {
      toast({
        title: 'Error',
        description: 'El título debe tener al menos 5 caracteres',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/failure-occurrences/quick-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineId: formData.machineId,
          componentIds: formData.componentIds.length > 0 ? formData.componentIds : undefined,
          title: formData.title.trim(),
          causedDowntime: formData.causedDowntime,
          isObservation: formData.isObservation,
          isSafetyRelated: formData.isSafetyRelated,
          isIntermittent: formData.isIntermittent,
          description: formData.description || undefined,
          failureCategory: formData.failureCategory,
          attachments: formData.attachments.length > 0 ? formData.attachments : undefined,
          forceCreate,
          linkToOccurrenceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear reporte');
      }

      // Check for duplicates
      if (data.hasDuplicates && data.duplicates?.length > 0) {
        setDuplicates(data.duplicates);
        setShowDuplicateModal(true);
        return;
      }

      // Success
      const successMessage = formData.isObservation
        ? 'Observación registrada exitosamente'
        : data.workOrder
          ? `Falla reportada. OT #${data.workOrder.id} creada`
          : 'Falla reportada exitosamente';

      toast({
        title: 'Éxito',
        description: successMessage,
      });

      onSuccess?.(data);
      onClose();

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear el reporte',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkToDuplicate = (duplicateId: number) => {
    handleSubmit(false, duplicateId);
    setShowDuplicateModal(false);
  };

  const handleCreateAnyway = () => {
    handleSubmit(true);
    setShowDuplicateModal(false);
  };

  const isFormValid = formData.machineId && formData.title.trim().length >= 5;

  return (
    <>
      <StandardDialog
        open={isOpen && !showDuplicateModal}
        onOpenChange={(open) => !open && onClose()}
        title={formData.isObservation ? "Registrar Observación" : "Reporte Rápido de Falla"}
        description="Complete los campos mínimos para reportar en menos de 30 segundos"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              onClick={() => handleSubmit()}
              disabled={!isFormValid || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : formData.isObservation ? (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Registrar Observación
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Reportar Falla
                </>
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Tipo de reporte */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              {formData.isObservation ? (
                <Eye className="h-4 w-4 text-blue-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              )}
              <span className="text-sm font-medium">
                {formData.isObservation ? 'Observación (sin OT)' : 'Falla (crea OT automática)'}
              </span>
            </div>
            <Switch
              checked={formData.isObservation}
              onCheckedChange={(checked) => setFormData(prev => ({
                ...prev,
                isObservation: checked,
                causedDowntime: checked ? false : prev.causedDowntime,
              }))}
            />
          </div>

          {/* Máquina - OBLIGATORIO */}
          <div className="space-y-2">
            <Label htmlFor="machine" className="flex items-center gap-1">
              Máquina <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.machineId?.toString() || ''}
              onValueChange={(value) => setFormData(prev => ({
                ...prev,
                machineId: parseInt(value),
                componentIds: [],
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar máquina..." />
              </SelectTrigger>
              <SelectContent>
                {machinesLoading ? (
                  <SelectItem value="loading" disabled>Cargando...</SelectItem>
                ) : (
                  machines?.map((machine) => (
                    <SelectItem key={machine.id} value={machine.id.toString()}>
                      {machine.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Título - OBLIGATORIO */}
          <div className="space-y-2">
            <Label htmlFor="title" className="flex items-center gap-1">
              ¿Qué pasó? <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Ej: Ruido extraño en motor, Vibración excesiva..."
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className={cn(
                formData.title.length > 0 && formData.title.length < 5 && 'border-red-500'
              )}
            />
            {formData.title.length > 0 && formData.title.length < 5 && (
              <p className="text-xs text-red-500">Mínimo 5 caracteres</p>
            )}
          </div>

          {/* ¿Paró producción? - Solo si no es observación */}
          {!formData.isObservation && (
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-red-500" />
                <span className="text-sm">¿Paró la producción?</span>
              </div>
              <Switch
                checked={formData.causedDowntime}
                onCheckedChange={(checked) => setFormData(prev => ({
                  ...prev,
                  causedDowntime: checked,
                }))}
              />
            </div>
          )}

          {/* Seguridad */}
          <div className="flex items-center justify-between p-3 border rounded-lg border-red-200 bg-red-50/50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm">¿Riesgo de seguridad?</span>
            </div>
            <Switch
              checked={formData.isSafetyRelated}
              onCheckedChange={(checked) => setFormData(prev => ({
                ...prev,
                isSafetyRelated: checked,
              }))}
            />
          </div>

          {/* Foto - OPCIONAL */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Camera className="h-4 w-4" />
              Foto (opcional)
            </Label>
            <div className="flex flex-wrap gap-2">
              {formData.attachments.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Adjunto ${index + 1}`}
                    className="h-16 w-16 object-cover rounded border"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="h-16 w-16 flex items-center justify-center border-2 border-dashed rounded cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploadingFiles}
                />
                {uploadingFiles ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
              </label>
            </div>
          </div>

          {/* Detalles colapsables */}
          <Collapsible open={showDetails} onOpenChange={setShowDetails}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between">
                <span className="text-sm text-muted-foreground">+ Detalles opcionales</span>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  showDetails && "rotate-180"
                )} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              {/* Categoría */}
              <div className="space-y-2">
                <Label>Categoría de falla</Label>
                <Select
                  value={formData.failureCategory}
                  onValueChange={(value: any) => setFormData(prev => ({
                    ...prev,
                    failureCategory: value,
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MECANICA">Mecánica</SelectItem>
                    <SelectItem value="ELECTRICA">Eléctrica</SelectItem>
                    <SelectItem value="HIDRAULICA">Hidráulica</SelectItem>
                    <SelectItem value="NEUMATICA">Neumática</SelectItem>
                    <SelectItem value="OTRA">Otra</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Intermitente */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="text-sm">¿Es intermitente? (aparece y desaparece)</span>
                <Switch
                  checked={formData.isIntermittent}
                  onCheckedChange={(checked) => setFormData(prev => ({
                    ...prev,
                    isIntermittent: checked,
                  }))}
                />
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <Label>Descripción adicional</Label>
                <Textarea
                  placeholder="Detalles adicionales sobre la falla..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    description: e.target.value,
                  }))}
                  rows={3}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </StandardDialog>

      {/* Modal de duplicados */}
      <StandardDialog
        open={showDuplicateModal}
        onOpenChange={(open) => !open && setShowDuplicateModal(false)}
        title="Posibles duplicados detectados"
        description="Se encontraron fallas similares recientes. ¿Desea vincular a una existente?"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDuplicateModal(false)}>
              Cancelar
            </Button>
            <Button variant="secondary" onClick={handleCreateAnyway}>
              Crear de todos modos
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {duplicates.map((dup) => (
            <div
              key={dup.id}
              className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => handleLinkToDuplicate(dup.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-medium text-sm">{dup.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Reportada: {new Date(dup.reportedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{dup.status}</Badge>
                  <Badge
                    className={cn(
                      dup.similarity >= 90 ? 'bg-red-100 text-red-800' :
                      dup.similarity >= 70 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    )}
                  >
                    {dup.similarity}% similar
                  </Badge>
                </div>
              </div>
              <Button
                variant="link"
                size="sm"
                className="mt-2 p-0 h-auto text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLinkToDuplicate(dup.id);
                }}
              >
                Vincular a esta falla
              </Button>
            </div>
          ))}
        </div>
      </StandardDialog>
    </>
  );
}
