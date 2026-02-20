'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
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
} from 'lucide-react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

interface MachineComponent {
  id: number;
  name: string;
  code?: string | null;
  type?: string | null;
  description?: string | null;
  criticality?: number | null;
  isSafetyCritical?: boolean;
}

interface Machine {
  id: number;
  name: string;
  sectorId?: number | null;
  plantZoneId?: number | null;
  areaId?: number | null;
}

interface PreviewData {
  component: MachineComponent;
  originMachine: Machine;
  counts: {
    subcomponents: number;
    workOrders: number;
    failures: number;
    documents: number;
    historyEvents: number;
  };
  warnings: {
    hasActiveWorkOrders: boolean;
    activeWorkOrdersCount: number;
  };
  mainSubcomponents: { id: number; name: string }[];
}

interface PromoteToMachineDialogProps {
  component: MachineComponent | null;
  originMachine: Machine | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newMachine: any) => void;
}

export default function PromoteToMachineDialog({
  component,
  originMachine,
  isOpen,
  onClose,
  onSuccess,
}: PromoteToMachineDialogProps) {
  // Estados de carga
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estados del formulario
  const [newMachineName, setNewMachineName] = useState('');
  const [migrateHistory, setMigrateHistory] = useState<'move' | 'keep'>('move');
  const [migrateDocuments, setMigrateDocuments] = useState<'move' | 'copy' | 'none'>('move');
  const [keepHistoryInOrigin, setKeepHistoryInOrigin] = useState(true);

  // Estado de resultado
  const [result, setResult] = useState<any>(null);

  // Cargar preview al abrir
  const loadPreview = useCallback(async () => {
    if (!component?.id) return;

    setLoadingPreview(true);
    setError(null);

    try {
      const res = await fetch(`/api/components/${component.id}/promote-preview`, {
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al cargar preview');
      }

      const data = await res.json();
      setPreviewData(data);
      setNewMachineName(data.component.name);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoadingPreview(false);
    }
  }, [component?.id]);

  useEffect(() => {
    if (isOpen && component?.id) {
      loadPreview();
      setResult(null);
    }
  }, [isOpen, component?.id, loadPreview]);

  // Ejecutar promoción
  const handlePromote = async () => {
    if (!component?.id || !newMachineName.trim()) return;

    setExecuting(true);
    setError(null);

    const operationId = uuidv4();

    try {
      const res = await fetch(`/api/components/${component.id}/promote-to-machine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          operationId,
          newMachineName: newMachineName.trim(),
          migrateHistory,
          migrateDocuments,
          keepHistoryInOrigin,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al promover componente');
      }

      setResult(data);
      toast.success(`Máquina "${data.newMachine.name}" creada exitosamente`);

      if (onSuccess) {
        onSuccess(data.newMachine);
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
      onClose();
    }
  };

  // Renderizar contenido según estado
  const renderContent = () => {
    // Loading preview
    if (loadingPreview) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">Analizando componente...</p>
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
            <div className="h-16 w-16 rounded-full bg-success-muted flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h3 className="text-lg font-semibold mb-2">¡Conversión exitosa!</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              El componente ha sido convertido en una máquina independiente
            </p>
          </div>

          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Nueva máquina:</span>
                <span className="font-medium">{result.newMachine.name}</span>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span>{result.migratedComponents} componentes</span>
                </div>
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  <span>{result.migratedWorkOrders} OTs</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span>{result.migratedFailures} fallas</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>{result.migratedDocuments} documentos</span>
                </div>
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
      <div className="space-y-6">
        {/* Info del componente */}
        <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Box className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium">{previewData.component.name}</h4>
            <p className="text-sm text-muted-foreground">
              De: <span className="font-medium">{previewData.originMachine.name}</span>
            </p>
            {previewData.component.code && (
              <Badge variant="outline" className="mt-1 text-xs">
                {previewData.component.code}
              </Badge>
            )}
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-2" />
          <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
            <Wrench className="h-5 w-5 text-success" />
          </div>
        </div>

        {/* Resumen de migración */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Se migrarán:</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{previewData.counts.subcomponents}</p>
                <p className="text-xs text-muted-foreground">Subcomponentes</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{previewData.counts.workOrders}</p>
                <p className="text-xs text-muted-foreground">Órdenes de trabajo</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{previewData.counts.failures}</p>
                <p className="text-xs text-muted-foreground">Registros de fallas</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{previewData.counts.documents}</p>
                <p className="text-xs text-muted-foreground">Documentos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Warning de OTs activas */}
        {previewData.warnings.hasActiveWorkOrders && (
          <div className="flex items-start gap-3 p-3 bg-warning-muted border border-warning-muted rounded-lg">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-warning-muted-foreground">
                Hay {previewData.warnings.activeWorkOrdersCount} OT(s) activa(s)
              </p>
              <p className="text-xs text-warning">
                Las órdenes de trabajo en progreso serán migradas a la nueva máquina
              </p>
            </div>
          </div>
        )}

        {/* Configuración */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="machineName">Nombre de la nueva máquina</Label>
            <Input
              id="machineName"
              value={newMachineName}
              onChange={(e) => setNewMachineName(e.target.value)}
              placeholder="Nombre de la máquina"
            />
          </div>

          <Separator />

          {/* Opción de historial */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Historial (OTs y Fallas)
            </Label>
            <RadioGroup
              value={migrateHistory}
              onValueChange={(v) => setMigrateHistory(v as 'move' | 'keep')}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="move" id="history-move" />
                <Label htmlFor="history-move" className="font-normal cursor-pointer">
                  Mover a la nueva máquina <span className="text-muted-foreground">(recomendado)</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="keep" id="history-keep" />
                <Label htmlFor="history-keep" className="font-normal cursor-pointer">
                  Mantener en máquina origen
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Opción de documentos */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentos
            </Label>
            <RadioGroup
              value={migrateDocuments}
              onValueChange={(v) => setMigrateDocuments(v as 'move' | 'copy' | 'none')}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="move" id="docs-move" />
                <Label htmlFor="docs-move" className="font-normal cursor-pointer">
                  Mover <span className="text-muted-foreground">(mantiene vínculo al componente)</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="copy" id="docs-copy" />
                <Label htmlFor="docs-copy" className="font-normal cursor-pointer">
                  Copiar <span className="text-muted-foreground">(duplica los documentos)</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="none" id="docs-none" />
                <Label htmlFor="docs-none" className="font-normal cursor-pointer">
                  No migrar
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Opción de nota en origen */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="keepHistory"
              checked={keepHistoryInOrigin}
              onCheckedChange={(v) => setKeepHistoryInOrigin(!!v)}
            />
            <Label htmlFor="keepHistory" className="font-normal cursor-pointer">
              Crear nota en máquina origen <span className="text-muted-foreground">(registrar que el componente fue removido)</span>
            </Label>
          </div>
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
            onClick={handlePromote}
            disabled={executing || !newMachineName.trim()}
          >
            {executing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirmar conversión
              </>
            )}
          </Button>
        </DialogFooter>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Convertir Componente en Máquina
          </DialogTitle>
          {!result && (
            <DialogDescription>
              Esta acción creará una nueva máquina independiente a partir del componente seleccionado
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogBody>
          {renderContent()}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
