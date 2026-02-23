'use client';

/**
 * ChecklistPanel - Panel de ejecución de checklists correctivos
 *
 * Permite:
 * - Ver checklists asignados a una OT
 * - Ejecutar fases con diferentes tipos de items
 * - Agregar checklists desde plantillas
 * - Ver progreso general
 *
 * P5.3: Checklists por tipo de falla
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Camera,
  Hash,
  Type,
  Plus,
  Loader2,
  CheckCircle2,
  Circle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

// ============================================================
// TIPOS
// ============================================================

interface ChecklistItem {
  id: string;
  description: string;
  type: 'check' | 'value' | 'text' | 'photo';
  required: boolean;
  unit?: string;
  minValue?: number;
  maxValue?: number;
}

interface ChecklistPhase {
  id: string;
  name: string;
  items: ChecklistItem[];
}

interface CompletedItem {
  id: string;
  checked?: boolean;
  value?: string | number;
  notes?: string;
  photo?: string;
}

interface CompletedPhase {
  id: string;
  items: CompletedItem[];
  completedAt?: string;
}

interface Checklist {
  id: number;
  name: string;
  template?: { id: number; name: string };
  phases: ChecklistPhase[];
  completedPhases: CompletedPhase[];
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  progress: number;
  totalItems: number;
  completedItems: number;
  completedBy?: { id: number; name: string };
  completedAt?: string;
}

interface ChecklistTemplate {
  id: number;
  name: string;
  description?: string;
  phasesCount: number;
  itemsCount: number;
  usageCount: number;
}

interface ChecklistPanelProps {
  workOrderId: number;
  readOnly?: boolean;
  className?: string;
}

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

function ChecklistItemRow({
  item,
  completed,
  onChange,
  disabled
}: {
  item: ChecklistItem;
  completed?: CompletedItem;
  onChange: (value: CompletedItem) => void;
  disabled: boolean;
}) {
  const isCompleted = !!completed?.checked || !!completed?.value || !!completed?.notes;

  const handleCheck = () => {
    onChange({
      id: item.id,
      checked: !completed?.checked
    });
  };

  const handleValueChange = (value: string) => {
    onChange({
      id: item.id,
      value: item.type === 'value' ? parseFloat(value) || value : value
    });
  };

  const getIcon = () => {
    switch (item.type) {
      case 'check': return <Check className="h-4 w-4" />;
      case 'value': return <Hash className="h-4 w-4" />;
      case 'text': return <Type className="h-4 w-4" />;
      case 'photo': return <Camera className="h-4 w-4" />;
      default: return <Circle className="h-4 w-4" />;
    }
  };

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-lg border transition-colors',
      isCompleted ? 'bg-success-muted border-success-muted' : 'bg-background border-border',
      disabled && 'opacity-60'
    )}>
      {/* Icono tipo */}
      <div className={cn(
        'shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        isCompleted ? 'bg-success-muted text-success' : 'bg-muted text-muted-foreground'
      )}>
        {getIcon()}
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <p className={cn(
            'text-sm font-medium',
            isCompleted ? 'text-success' : 'text-foreground'
          )}>
            {item.description}
          </p>
          {item.required && (
            <Badge variant="outline" className="text-xs h-5 px-1 shrink-0">
              Req
            </Badge>
          )}
        </div>

        {/* Input según tipo */}
        {item.type === 'check' && (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={completed?.checked || false}
              onCheckedChange={handleCheck}
              disabled={disabled}
            />
            <span className="text-xs text-muted-foreground">
              {completed?.checked ? 'Completado' : 'Marcar como completado'}
            </span>
          </div>
        )}

        {item.type === 'value' && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={completed?.value || ''}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder="Valor"
              className="w-32 h-8"
              disabled={disabled}
            />
            {item.unit && (
              <span className="text-sm text-muted-foreground">{item.unit}</span>
            )}
            {(item.minValue !== undefined || item.maxValue !== undefined) && (
              <span className="text-xs text-muted-foreground">
                ({item.minValue ?? '-'} - {item.maxValue ?? '-'})
              </span>
            )}
          </div>
        )}

        {item.type === 'text' && (
          <Textarea
            value={completed?.notes || ''}
            onChange={(e) => onChange({ id: item.id, notes: e.target.value })}
            placeholder="Observaciones..."
            className="min-h-[60px]"
            disabled={disabled}
          />
        )}

        {item.type === 'photo' && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
            >
              <Camera className="h-4 w-4 mr-2" />
              Tomar foto
            </Button>
            {completed?.photo && (
              <span className="text-xs text-success">Foto adjunta</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PhaseSection({
  phase,
  completedPhase,
  onItemChange,
  disabled,
  defaultOpen = false
}: {
  phase: ChecklistPhase;
  completedPhase?: CompletedPhase;
  onItemChange: (phaseId: string, item: CompletedItem) => void;
  disabled: boolean;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const completedItems = completedPhase?.items || [];
  const progress = phase.items.length > 0
    ? Math.round((completedItems.length / phase.items.length) * 100)
    : 0;
  const isComplete = progress === 100;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-between p-4 h-auto',
            isComplete && 'bg-success-muted hover:bg-success-muted/80'
          )}
        >
          <div className="flex items-center gap-3">
            {isComplete ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
            <div className="text-left">
              <p className={cn(
                'font-medium',
                isComplete ? 'text-success' : 'text-foreground'
              )}>
                {phase.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {completedItems.length}/{phase.items.length} items
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Progress value={progress} className="w-24 h-2" />
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-4 pb-4 space-y-2">
        {phase.items.map((item) => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            completed={completedItems.find(c => c.id === item.id)}
            onChange={(value) => onItemChange(phase.id, value)}
            disabled={disabled}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function TemplateSelector({
  isOpen,
  onClose,
  templates,
  onSelect,
  isLoading
}: {
  isOpen: boolean;
  onClose: () => void;
  templates: ChecklistTemplate[];
  onSelect: (templateId: number) => void;
  isLoading: boolean;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Seleccionar Plantilla</DialogTitle>
          <DialogDescription>
            Elige una plantilla de checklist para asignar a esta OT
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-2">
          {templates.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No hay plantillas disponibles</p>
            </div>
          ) : (
            templates.map((template) => (
              <Button
                key={template.id}
                variant="outline"
                className="w-full justify-start h-auto p-4"
                onClick={() => onSelect(template.id)}
                disabled={isLoading}
              >
                <div className="flex-1 text-left">
                  <p className="font-medium">{template.name}</p>
                  {template.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {template.phasesCount} fases
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {template.itemsCount} items
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Usado {template.usageCount}x
                    </span>
                  </div>
                </div>
              </Button>
            ))
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function ChecklistPanel({
  workOrderId,
  readOnly = false,
  className
}: ChecklistPanelProps) {
  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false);
  const [localChanges, setLocalChanges] = useState<Record<number, CompletedPhase[]>>({});
  const queryClient = useQueryClient();

  // Cargar checklists
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['work-order-checklists', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/work-orders/${workOrderId}/checklists`);
      if (!res.ok) throw new Error('Error al cargar checklists');
      return res.json();
    }
  });

  // Mutation para asignar checklist
  const assignMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const res = await fetch(`/api/work-orders/${workOrderId}/checklists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al asignar checklist');
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success('Checklist asignado');
      queryClient.invalidateQueries({ queryKey: ['work-order-checklists', workOrderId] });
      setTemplateSelectorOpen(false);
    },
    onError: (error: Error) => {
      toast.error('Error', { description: error.message });
    }
  });

  // Mutation para actualizar progreso
  const updateMutation = useMutation({
    mutationFn: async ({ checklistId, completedPhases, markComplete }: {
      checklistId: number;
      completedPhases: CompletedPhase[];
      markComplete?: boolean;
    }) => {
      const res = await fetch(`/api/work-orders/${workOrderId}/checklists`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklistId, completedPhases, markComplete })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al actualizar');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order-checklists', workOrderId] });
      setLocalChanges({});
    },
    onError: (error: Error) => {
      toast.error('Error', { description: error.message });
    }
  });

  // Handler para cambio de item
  const handleItemChange = (checklistId: number, phaseId: string, item: CompletedItem) => {
    setLocalChanges(prev => {
      const checklistPhases = prev[checklistId] || [];
      const phaseIndex = checklistPhases.findIndex(p => p.id === phaseId);

      if (phaseIndex >= 0) {
        const phase = checklistPhases[phaseIndex];
        const itemIndex = phase.items.findIndex(i => i.id === item.id);

        if (itemIndex >= 0) {
          phase.items[itemIndex] = item;
        } else {
          phase.items.push(item);
        }
      } else {
        checklistPhases.push({
          id: phaseId,
          items: [item]
        });
      }

      return { ...prev, [checklistId]: [...checklistPhases] };
    });
  };

  // Guardar progreso
  const saveProgress = (checklistId: number, markComplete = false) => {
    const checklist = data?.checklists?.find((c: Checklist) => c.id === checklistId);
    if (!checklist) return;

    // Mergear cambios locales con completados existentes
    const existingPhases = checklist.completedPhases || [];
    const localPhases = localChanges[checklistId] || [];

    const mergedPhases = [...existingPhases];
    localPhases.forEach(local => {
      const existingIndex = mergedPhases.findIndex(e => e.id === local.id);
      if (existingIndex >= 0) {
        // Mergear items
        const existingItems = mergedPhases[existingIndex].items;
        local.items.forEach(item => {
          const itemIndex = existingItems.findIndex(i => i.id === item.id);
          if (itemIndex >= 0) {
            existingItems[itemIndex] = item;
          } else {
            existingItems.push(item);
          }
        });
      } else {
        mergedPhases.push(local);
      }
    });

    updateMutation.mutate({
      checklistId,
      completedPhases: mergedPhases,
      markComplete
    });
  };

  const checklists = data?.checklists || [];
  const templates = data?.suggestedTemplates || [];

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex flex-col items-center py-8', className)}>
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-foreground mb-4">Error al cargar checklists</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-info-muted-foreground" />
          <h3 className="font-medium">Checklists</h3>
          {checklists.length > 0 && (
            <Badge variant="secondary">{checklists.length}</Badge>
          )}
        </div>

        {!readOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTemplateSelectorOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        )}
      </div>

      {/* Lista de checklists */}
      {checklists.length === 0 ? (
        <div className="text-center py-8 bg-muted rounded-lg border border-dashed">
          <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Sin checklists asignados</p>
          {!readOnly && templates.length > 0 && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setTemplateSelectorOpen(true)}
            >
              Agregar desde plantilla
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {checklists.map((checklist: Checklist) => {
            const hasChanges = !!localChanges[checklist.id]?.length;

            return (
              <div
                key={checklist.id}
                className="border rounded-lg overflow-hidden"
              >
                {/* Cabecera del checklist */}
                <div className="p-4 bg-muted border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{checklist.name}</p>
                      {checklist.template && (
                        <p className="text-xs text-muted-foreground">
                          Plantilla: {checklist.template.name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          checklist.status === 'COMPLETED' ? 'default' :
                          checklist.status === 'IN_PROGRESS' ? 'secondary' : 'outline'
                        }
                      >
                        {checklist.status === 'COMPLETED' ? 'Completado' :
                         checklist.status === 'IN_PROGRESS' ? 'En progreso' : 'Pendiente'}
                      </Badge>
                      <span className="text-sm text-foreground">
                        {checklist.progress}%
                      </span>
                    </div>
                  </div>
                  <Progress value={checklist.progress} className="mt-2 h-2" />
                </div>

                {/* Fases */}
                <div className="divide-y">
                  {checklist.phases.map((phase: ChecklistPhase, idx: number) => (
                    <PhaseSection
                      key={phase.id}
                      phase={phase}
                      completedPhase={
                        localChanges[checklist.id]?.find(p => p.id === phase.id) ||
                        checklist.completedPhases.find(p => p.id === phase.id)
                      }
                      onItemChange={(phaseId, item) =>
                        handleItemChange(checklist.id, phaseId, item)
                      }
                      disabled={readOnly || checklist.status === 'COMPLETED'}
                      defaultOpen={idx === 0 && checklist.status !== 'COMPLETED'}
                    />
                  ))}
                </div>

                {/* Footer con acciones */}
                {!readOnly && checklist.status !== 'COMPLETED' && (
                  <div className="p-4 bg-muted border-t flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => saveProgress(checklist.id, false)}
                      disabled={!hasChanges || updateMutation.isPending}
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : null}
                      Guardar progreso
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => saveProgress(checklist.id, true)}
                      disabled={checklist.progress < 100 || updateMutation.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Marcar completado
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Selector de plantillas */}
      <TemplateSelector
        isOpen={templateSelectorOpen}
        onClose={() => setTemplateSelectorOpen(false)}
        templates={templates}
        onSelect={(templateId) => assignMutation.mutate(templateId)}
        isLoading={assignMutation.isPending}
      />
    </div>
  );
}

export default ChecklistPanel;
