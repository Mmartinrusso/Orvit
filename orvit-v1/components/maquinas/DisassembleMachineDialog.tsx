'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  ArrowRight,
  Box,
  CheckCircle2,
  ClipboardList,
  FileText,
  History,
  Loader2,
  Package,
  Settings,
  Wrench,
  AlertTriangle,
  Trash2,
  Archive,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

interface ComponentPreview {
  id: number;
  name: string;
  code?: string | null;
  type?: string | null;
  childrenCount: number;
  children: { id: number; name: string; childrenCount: number }[];
  stats: {
    workOrders: number;
    failures: number;
    documents: number;
    historyEvents: number;
    activeWorkOrders: number;
    lotInstallations: number;
    checklists: number;
  };
}

interface PreviewData {
  machine: {
    id: number;
    name: string;
    status: string;
    assetCode?: string | null;
  };
  components: ComponentPreview[];
  totals: {
    components: number;
    workOrders: number;
    failures: number;
    documents: number;
    machineOnlyDocuments: number;
    lotInstallations: number;
    checklists: number;
    machineOnlyChecklists: number;
    preventiveTemplates: number;
  };
  warnings: {
    hasActiveWorkOrders: boolean;
    totalActiveWorkOrders: number;
  };
}

interface ComponentAction {
  componentId: number;
  action: 'promote' | 'delete' | 'orphan';
  newMachineName?: string;
}

interface DisassembleMachineDialogProps {
  machine: { id: number; name: string } | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function DisassembleMachineDialog({
  machine,
  isOpen,
  onClose,
  onSuccess,
}: DisassembleMachineDialogProps) {
  // Estados de carga
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estados del formulario
  const [componentActions, setComponentActions] = useState<Map<number, ComponentAction>>(new Map());
  const [deleteMachine, setDeleteMachine] = useState(false);
  const [migrateHistory, setMigrateHistory] = useState<'move' | 'keep'>('move');
  const [migrateDocuments, setMigrateDocuments] = useState<'move' | 'copy' | 'none'>('move');

  // Estado para componentes expandidos
  const [expandedComponents, setExpandedComponents] = useState<Set<number>>(new Set());

  // Estado de resultado
  const [result, setResult] = useState<any>(null);

  // Cargar preview al abrir
  const loadPreview = useCallback(async () => {
    if (!machine?.id) return;

    setLoadingPreview(true);
    setError(null);

    try {
      const res = await fetch(`/api/machines/${machine.id}/disassemble-preview`, {
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al cargar preview');
      }

      const data = await res.json();
      setPreviewData(data);

      // Inicializar acciones por defecto: todos promover
      const initialActions = new Map<number, ComponentAction>();
      data.components.forEach((comp: ComponentPreview) => {
        initialActions.set(comp.id, {
          componentId: comp.id,
          action: 'promote',
          newMachineName: comp.name,
        });
      });
      setComponentActions(initialActions);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoadingPreview(false);
    }
  }, [machine?.id]);

  useEffect(() => {
    if (isOpen && machine?.id) {
      loadPreview();
      setResult(null);
      setExpandedComponents(new Set());
    }
  }, [isOpen, machine?.id, loadPreview]);

  // Actualizar acción de un componente
  const updateComponentAction = (componentId: number, action: ComponentAction['action'], newMachineName?: string) => {
    const newActions = new Map(componentActions);
    const existing = newActions.get(componentId);
    newActions.set(componentId, {
      componentId,
      action,
      newMachineName: newMachineName ?? existing?.newMachineName ?? previewData?.components.find(c => c.id === componentId)?.name,
    });
    setComponentActions(newActions);
  };

  // Actualizar nombre de nueva máquina
  const updateMachineName = (componentId: number, name: string) => {
    const newActions = new Map(componentActions);
    const existing = newActions.get(componentId);
    if (existing) {
      newActions.set(componentId, { ...existing, newMachineName: name });
      setComponentActions(newActions);
    }
  };

  // Toggle expandir componente
  const toggleExpand = (componentId: number) => {
    const newExpanded = new Set(expandedComponents);
    if (newExpanded.has(componentId)) {
      newExpanded.delete(componentId);
    } else {
      newExpanded.add(componentId);
    }
    setExpandedComponents(newExpanded);
  };

  // Ejecutar desarme
  const handleDisassemble = async () => {
    if (!machine?.id) return;

    // Validar que haya al menos una acción
    const actions = Array.from(componentActions.values());
    if (actions.length === 0) {
      toast.error('No hay componentes para procesar');
      return;
    }

    setExecuting(true);
    setError(null);

    const operationId = uuidv4();

    try {
      const res = await fetch(`/api/machines/${machine.id}/disassemble`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          operationId,
          componentActions: actions,
          deleteMachine,
          migrateHistory,
          migrateDocuments,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al desarmar máquina');
      }

      setResult(data);
      toast.success('Máquina desarmada exitosamente');

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setExecuting(false);
    }
  };

  // Cerrar dialog
  const handleClose = () => {
    if (!executing) {
      setPreviewData(null);
      setResult(null);
      setError(null);
      setComponentActions(new Map());
      onClose();
    }
  };

  // Contar por tipo de acción
  const actionCounts = {
    promote: Array.from(componentActions.values()).filter(a => a.action === 'promote').length,
    delete: Array.from(componentActions.values()).filter(a => a.action === 'delete').length,
    orphan: Array.from(componentActions.values()).filter(a => a.action === 'orphan').length,
  };

  // Renderizar contenido según estado
  const renderContent = () => {
    // Loading preview
    if (loadingPreview) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">Analizando máquina...</p>
        </div>
      );
    }

    // Error
    if (error && !previewData) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-8 w-8 text-destructive mb-4" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={loadPreview} className="mt-4">
            Reintentar
          </Button>
        </div>
      );
    }

    // Resultado exitoso
    if (result) {
      return (
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Desarme completado</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              La máquina ha sido desarmada exitosamente
            </p>
          </div>

          {result.promotedMachines && result.promotedMachines.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm font-medium mb-3">Nuevas máquinas creadas:</p>
                <div className="space-y-2">
                  {result.promotedMachines.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div>
                        <span className="font-medium">{m.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          (de {m.fromComponent})
                        </span>
                      </div>
                      <Badge variant="secondary">{m.componentsCount} componentes</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Componentes eliminados:</span>
                <span>{result.deletedComponentsCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">OTs migradas:</span>
                <span>{result.migratedWorkOrders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fallas migradas:</span>
                <span>{result.migratedFailures}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Documentos migrados:</span>
                <span>{result.migratedDocuments}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Inst. de lotes migradas:</span>
                <span>{result.migratedLotInstallations || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Preventivos migrados:</span>
                <span>{result.migratedPreventiveTemplates || 0}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium">
                <span>Máquina original:</span>
                <span>{result.machineDeleted ? 'Eliminada' : 'Dada de baja'}</span>
              </div>
            </CardContent>
          </Card>

          <DialogFooter>
            <Button onClick={handleClose}>Cerrar</Button>
          </DialogFooter>
        </div>
      );
    }

    // Formulario principal
    if (!previewData) return null;

    return (
      <div className="space-y-4">
        {/* Info de máquina */}
        <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
            <Settings className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium">{previewData.machine.name}</h4>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
              <span>{previewData.totals.components} componentes</span>
              <span>•</span>
              <span>{previewData.totals.workOrders} OTs</span>
              <span>•</span>
              <span>{previewData.totals.failures} fallas</span>
              <span>•</span>
              <span className="font-medium text-amber-600">{previewData.totals.preventiveTemplates} preventivos</span>
            </div>
          </div>
        </div>

        {/* Warning de OTs activas */}
        {previewData.warnings.hasActiveWorkOrders && (
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Hay {previewData.warnings.totalActiveWorkOrders} OT(s) activa(s)
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Las órdenes de trabajo serán migradas según la configuración
              </p>
            </div>
          </div>
        )}

        {/* Lista de componentes */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Componentes ({previewData.components.length})</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Selecciona qué hacer con cada componente
          </p>

          <ScrollArea className="h-[350px] border rounded-lg p-2">
            <div className="space-y-2">
              {previewData.components.map((component) => {
                const action = componentActions.get(component.id);
                const isExpanded = expandedComponents.has(component.id);

                return (
                  <Card key={component.id} className="overflow-hidden">
                    <CardContent className="p-3 space-y-3">
                      {/* Header del componente */}
                      <div className="flex items-start gap-2">
                        {component.children.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleExpand(component.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{component.name}</span>
                            {component.code && (
                              <Badge variant="outline" className="text-[10px]">{component.code}</Badge>
                            )}
                          </div>
                          <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                            <span>{component.childrenCount} subcomp.</span>
                            <span>{component.stats.workOrders} OTs</span>
                            <span>{component.stats.failures} fallas</span>
                            <span>{component.stats.checklists} prev.</span>
                            {component.stats.activeWorkOrders > 0 && (
                              <span className="text-amber-600">{component.stats.activeWorkOrders} activas</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Selector de acción */}
                      <div className="flex items-center gap-2">
                        <Select
                          value={action?.action || 'promote'}
                          onValueChange={(v) => updateComponentAction(component.id, v as any)}
                        >
                          <SelectTrigger className="h-8 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="promote">
                              <div className="flex items-center gap-2">
                                <Wrench className="h-3 w-3 text-green-600" />
                                Convertir en máquina
                              </div>
                            </SelectItem>
                            <SelectItem value="delete">
                              <div className="flex items-center gap-2">
                                <Trash2 className="h-3 w-3 text-red-600" />
                                Eliminar
                              </div>
                            </SelectItem>
                            <SelectItem value="orphan">
                              <div className="flex items-center gap-2">
                                <Archive className="h-3 w-3 text-gray-600" />
                                Archivar (huérfano)
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Input para nombre de nueva máquina */}
                      {action?.action === 'promote' && (
                        <Input
                          placeholder="Nombre de la nueva máquina"
                          value={action.newMachineName || ''}
                          onChange={(e) => updateMachineName(component.id, e.target.value)}
                          className="h-8 text-xs"
                        />
                      )}

                      {/* Subcomponentes expandidos */}
                      {isExpanded && component.children.length > 0 && (
                        <div className="pl-6 border-l-2 border-muted space-y-1">
                          {component.children.map((child) => (
                            <div key={child.id} className="text-xs text-muted-foreground flex items-center gap-2 py-1">
                              <Box className="h-3 w-3" />
                              <span>{child.name}</span>
                              {child.childrenCount > 0 && (
                                <span className="text-[10px]">({child.childrenCount} sub)</span>
                              )}
                              <ArrowRight className="h-3 w-3 mx-1" />
                              <span className="text-green-600">será componente</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Resumen de acciones */}
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1">
            <Wrench className="h-3 w-3 text-green-600" />
            <span>{actionCounts.promote} a máquina</span>
          </div>
          <div className="flex items-center gap-1">
            <Trash2 className="h-3 w-3 text-red-600" />
            <span>{actionCounts.delete} a eliminar</span>
          </div>
          <div className="flex items-center gap-1">
            <Archive className="h-3 w-3 text-gray-600" />
            <span>{actionCounts.orphan} a archivar</span>
          </div>
        </div>

        <Separator />

        {/* Opciones de migración */}
        <div className="grid grid-cols-2 gap-4">
          {/* Historial */}
          <div className="space-y-2">
            <Label className="text-xs">Historial (OTs, Fallas)</Label>
            <RadioGroup
              value={migrateHistory}
              onValueChange={(v) => setMigrateHistory(v as 'move' | 'keep')}
              className="space-y-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="move" id="hist-move" />
                <Label htmlFor="hist-move" className="text-xs font-normal cursor-pointer">
                  Mover a nuevas máquinas
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="keep" id="hist-keep" />
                <Label htmlFor="hist-keep" className="text-xs font-normal cursor-pointer">
                  No migrar
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Documentos */}
          <div className="space-y-2">
            <Label className="text-xs">Documentos</Label>
            <RadioGroup
              value={migrateDocuments}
              onValueChange={(v) => setMigrateDocuments(v as 'move' | 'copy' | 'none')}
              className="space-y-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="move" id="doc-move" />
                <Label htmlFor="doc-move" className="text-xs font-normal cursor-pointer">
                  Mover
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="copy" id="doc-copy" />
                <Label htmlFor="doc-copy" className="text-xs font-normal cursor-pointer">
                  Copiar
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="none" id="doc-none" />
                <Label htmlFor="doc-none" className="text-xs font-normal cursor-pointer">
                  No migrar
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <Separator />

        {/* Opción de máquina original */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="deleteMachine"
            checked={deleteMachine}
            onCheckedChange={(v) => setDeleteMachine(!!v)}
          />
          <Label htmlFor="deleteMachine" className="text-sm font-normal cursor-pointer">
            Eliminar máquina original
            <span className="text-xs text-muted-foreground ml-1">
              (si no, quedará como "Dada de baja")
            </span>
          </Label>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={executing}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDisassemble}
            disabled={executing || actionCounts.promote + actionCounts.delete + actionCounts.orphan === 0}
          >
            {executing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Settings className="h-4 w-4 mr-2" />
                Desarmar Máquina
              </>
            )}
          </Button>
        </DialogFooter>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Desarmar Máquina
          </DialogTitle>
          {!result && (
            <DialogDescription>
              Descompone la máquina en sus componentes, convirtiéndolos en máquinas independientes
            </DialogDescription>
          )}
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
