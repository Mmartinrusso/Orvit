'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  FileText,
  Paperclip,
  Link2,
  AlertCircle,
} from 'lucide-react';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { AttachmentsDropzone } from './AttachmentsDropzone';
import { ComponentsTreeSelect } from './ComponentsTreeSelect';
import {
  InstructionScope,
  InstructionPayload,
  AttachmentDraft,
  Machine,
  ComponentNode,
  Instruction,
} from './types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface InstructionUpsertSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workstationId: string;
  workstationName?: string;
  mode: 'create' | 'edit';
  initialData?: Instruction;
  machines: Machine[];
  loadComponentsByMachine: (machineId: string) => Promise<ComponentNode[]>;
  onSave: (payload: InstructionPayload) => Promise<void>;
  onSuccess?: () => void;
}

type ValidationErrors = {
  title?: string;
  content?: string;
  scope?: string;
};

export function InstructionUpsertSheet({
  open,
  onOpenChange,
  workstationId,
  workstationName,
  mode,
  initialData,
  machines,
  loadComponentsByMachine,
  onSave,
  onSuccess,
}: InstructionUpsertSheetProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('contenido');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [scope, setScope] = useState<InstructionScope>('EQUIPMENT');
  const [machineIds, setMachineIds] = useState<string[]>([]);
  const [componentIds, setComponentIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [componentsByMachine, setComponentsByMachine] = useState<Map<string, ComponentNode[]>>(new Map());
  
  // Validation
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());

  // Reset form when opening/closing
  useEffect(() => {
    if (open) {
      if (initialData) {
        setTitle(initialData.title);
        setContentHtml(initialData.contentHtml || '');
        setScope(initialData.scope);
        setMachineIds(initialData.machineIds);
        setComponentIds(initialData.componentIds);
        setAttachments(initialData.attachments);
      } else {
        setTitle('');
        setContentHtml('');
        setScope('EQUIPMENT');
        setMachineIds([]);
        setComponentIds([]);
        setAttachments([]);
      }
      setActiveTab('contenido');
      setErrors({});
      setTouched(new Set());
      setHasChanges(false);
      setComponentsByMachine(new Map());
    }
  }, [open, initialData]);

  // Track changes
  useEffect(() => {
    if (!open) return;
    
    const hasFormChanges = 
      title !== (initialData?.title || '') ||
      contentHtml !== (initialData?.contentHtml || '') ||
      scope !== (initialData?.scope || 'EQUIPMENT') ||
      JSON.stringify(machineIds) !== JSON.stringify(initialData?.machineIds || []) ||
      JSON.stringify(componentIds) !== JSON.stringify(initialData?.componentIds || []) ||
      attachments.some(a => a.isNew || a.isDeleted);
    
    setHasChanges(hasFormChanges);
  }, [open, title, contentHtml, scope, machineIds, componentIds, attachments, initialData]);

  // Validate form
  const validate = useCallback((): boolean => {
    const newErrors: ValidationErrors = {};

    if (!title.trim()) {
      newErrors.title = 'El título es requerido';
    }

    const activeAttachments = attachments.filter(a => !a.isDeleted);
    if (!contentHtml.trim() && activeAttachments.length === 0) {
      newErrors.content = 'Agrega contenido o al menos un archivo adjunto';
    }

    if (scope === 'EQUIPMENT' && machineIds.length === 0) {
      newErrors.scope = 'Selecciona al menos una máquina o componente';
    }

    if (scope === 'MACHINES' && machineIds.length === 0) {
      newErrors.scope = 'Selecciona al menos una máquina';
    }

    if (scope === 'COMPONENTS' && componentIds.length === 0) {
      newErrors.scope = 'Selecciona al menos un componente';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, contentHtml, attachments, scope, machineIds, componentIds]);

  // Load components for a machine
  const handleLoadComponents = useCallback(async (machineId: string) => {
    if (componentsByMachine.has(machineId)) return componentsByMachine.get(machineId)!;
    
    try {
      const components = await loadComponentsByMachine(machineId);
      setComponentsByMachine(prev => new Map(prev).set(machineId, components));
      return components;
    } catch (error) {
      console.error('Error loading components:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los componentes',
        variant: 'destructive',
      });
      return [];
    }
  }, [componentsByMachine, loadComponentsByMachine, toast]);

  // Handle scope change
  const handleScopeChange = useCallback((newScope: InstructionScope) => {
    setScope(newScope);
    if (newScope === 'EQUIPMENT') {
      // Equipment uses the integrated selector, so we keep everything
    } else if (newScope === 'MACHINES') {
      setComponentIds([]);
    } else if (newScope === 'COMPONENTS') {
      // Components scope keeps both machines and components
    }
    setErrors(prev => ({ ...prev, scope: undefined }));
  }, []);

  // Handle save
  const handleSave = async () => {
    setTouched(new Set(['title', 'content', 'scope']));

    console.log('🔵 [INSTRUCTION SAVE] Estado del formulario:', {
      title,
      contentHtml,
      scope,
      machineIds,
      componentIds,
      attachments,
      attachmentsCount: attachments.length,
    });

    if (!validate()) {
      console.log('❌ [INSTRUCTION SAVE] Validación fallida:', errors);
      // Go to first tab with error
      if (errors.title || errors.content) {
        setActiveTab('contenido');
      } else if (errors.scope) {
        setActiveTab('asociaciones');
      }
      return;
    }

    setSaving(true);
    try {
      const payload: InstructionPayload = {
        workstationId,
        title: title.trim(),
        contentHtml: contentHtml.trim(),
        scope,
        machineIds: scope === 'EQUIPMENT' || scope === 'MACHINES' || scope === 'COMPONENTS' ? machineIds : [],
        componentIds: scope === 'EQUIPMENT' || scope === 'COMPONENTS' ? componentIds : [],
        attachments: attachments.filter(a => !a.isDeleted),
      };

      console.log('📤 [INSTRUCTION SAVE] Payload a enviar:', payload);
      console.log('📎 [INSTRUCTION SAVE] Archivos adjuntos filtrados:', {
        totalAttachments: attachments.length,
        filteredAttachments: payload.attachments.length,
        attachmentsDetail: payload.attachments.map(a => ({
          name: a.name,
          isNew: a.isNew,
          isDeleted: a.isDeleted,
          url: a.url,
          file: a.file ? `File: ${a.file.name}` : 'No file',
        })),
      });

      await onSave(payload);
      
      toast({
        title: mode === 'create' ? 'Instructivo creado' : 'Instructivo actualizado',
        description: 'Los cambios se guardaron correctamente',
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving instruction:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar el instructivo',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Count badges for tabs
  const attachmentsCount = attachments.filter(a => !a.isDeleted).length;
  const associationsCount = scope === 'EQUIPMENT'
    ? machineIds.length + componentIds.length
    : scope === 'MACHINES'
      ? machineIds.length
      : scope === 'COMPONENTS'
        ? componentIds.length
        : 0;

  const canSave = title.trim() && (contentHtml.trim() || attachmentsCount > 0) &&
    ((scope === 'EQUIPMENT' && machineIds.length > 0) ||
     (scope === 'MACHINES' && machineIds.length > 0) ||
     (scope === 'COMPONENTS' && componentIds.length > 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {/* Header */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {mode === 'create' ? 'Nuevo Instructivo' : 'Editar Instructivo'}
          </DialogTitle>
          <DialogDescription>
            Se asociará al puesto de trabajo{workstationName && `: ${workstationName}`}
          </DialogDescription>
        </DialogHeader>

        {/* Content with tabs */}
        <DialogBody>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-10">
                <TabsTrigger value="contenido" className="text-xs gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Contenido
                </TabsTrigger>
                <TabsTrigger value="archivos" className="text-xs gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  Archivos
                  {attachmentsCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                      {attachmentsCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="asociaciones" className="text-xs gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
                  Asociaciones
                  {associationsCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                      {associationsCount}
                    </Badge>
                  )}
                </TabsTrigger>
          </TabsList>

          {/* Tab: Contenido */}
          <TabsContent value="contenido" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-xs font-medium">
                    Título <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => {
                      console.log('✏️ [INSTRUCTION] Título cambiado:', e.target.value);
                      setTitle(e.target.value);
                      setTouched(prev => new Set([...prev, 'title']));
                    }}
                    onBlur={() => setTouched(prev => new Set([...prev, 'title']))}
                    placeholder="Ej: Procedimiento de arranque de máquina"
                    className={cn('h-10', touched.has('title') && errors.title && 'border-destructive')}
                    aria-invalid={touched.has('title') && !!errors.title}
                    aria-describedby={errors.title ? 'title-error' : undefined}
                  />
                  {touched.has('title') && errors.title && (
                    <p id="title-error" className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.title}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Contenido</Label>
                  <div className={cn(
                    'rounded-xl overflow-hidden',
                    touched.has('content') && errors.content && 'ring-1 ring-destructive'
                  )}>
                    <RichTextEditor
                      value={contentHtml}
                      onChange={(value) => {
                        console.log('📝 [INSTRUCTION] Contenido cambiado:', value);
                        setContentHtml(value);
                        setTouched(prev => new Set([...prev, 'content']));
                      }}
                      placeholder="Escribe el contenido del instructivo aquí..."
                      className="min-h-[260px] max-h-[420px]"
                    />
                  </div>
                  {touched.has('content') && errors.content && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.content}
                    </p>
                  )}
                </div>
              </TabsContent>

          {/* Tab: Archivos */}
          <TabsContent value="archivos" className="mt-4">
                <AttachmentsDropzone
                  attachments={attachments}
                  onChange={(newAttachments) => {
                    console.log('📎 [INSTRUCTION] Archivos cambiados:', newAttachments);
                    setAttachments(newAttachments);
                  }}
                  maxFiles={10}
                  maxSizeMB={25}
                  disabled={saving}
                />
              </TabsContent>

          {/* Tab: Asociaciones */}
          <TabsContent value="asociaciones" className="mt-4 space-y-4">
                <div className="space-y-3">
                  <Label className="text-xs font-medium">
                    Equipamiento <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Selecciona las máquinas, componentes y subcomponentes a los que aplica este instructivo
                  </p>
                  <ComponentsTreeSelect
                    machines={machines}
                    selectedMachineIds={machineIds}
                    componentsByMachine={componentsByMachine}
                    selectedComponentIds={componentIds}
                    onChange={(ids) => {
                      console.log('🔧 [INSTRUCTION] Componentes seleccionados:', ids);
                      setComponentIds(ids);
                      setTouched(prev => new Set([...prev, 'scope']));
                    }}
                    onMachinesChange={(ids) => {
                      console.log('⚙️ [INSTRUCTION] Máquinas seleccionadas:', ids);
                      setMachineIds(ids);
                      // Remove component selections from removed machines
                      const validComponentIds = componentIds.filter(cId => {
                        for (const mId of ids) {
                          const comps = componentsByMachine.get(mId);
                          if (comps) {
                            const findInTree = (nodes: ComponentNode[]): boolean => {
                              for (const node of nodes) {
                                if (String(node.id) === cId) return true;
                                if (node.children && findInTree(node.children)) return true;
                              }
                              return false;
                            };
                            if (findInTree(comps)) return true;
                          }
                        }
                        return false;
                      });
                      console.log('🔧 [INSTRUCTION] Componentes válidos después de filtrar:', validComponentIds);
                      setComponentIds(validComponentIds);
                    }}
                    disabled={saving}
                    loadComponents={handleLoadComponents}
                    showMachineSelector={true}
                  />

                  {touched.has('scope') && errors.scope && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.scope}
                    </p>
                  )}
                </div>
          </TabsContent>
          </Tabs>
        </DialogBody>

        {/* Footer */}
        <DialogFooter>
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="text-xs text-muted-foreground">
              {saving ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Guardando...
                </span>
              ) : hasChanges ? (
                <span className="text-amber-600">Cambios sin guardar</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={saving || !canSave}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === 'create' ? (
                  'Crear'
                ) : (
                  'Guardar'
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

