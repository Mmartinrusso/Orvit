'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CloudUpload,
  X,
  File,
  ExternalLink,
  Plus,
  Star,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { DatePicker } from '@/components/ui/date-picker';
import { useAuth } from '@/contexts/AuthContext';
import { useAddSolution } from '@/hooks/maintenance/use-failure-solutions';

interface LoadSolutionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (solutionData: any) => void;
  failureData?: any;
}

interface SolutionData {
  title: string;
  solution: string;
  actualHours: number;
  timeUnit: 'hours' | 'minutes';
  appliedBy: string;
  appliedById: number | null; // User.id es Int, no UUID
  appliedDate: string;
  toolsUsed: Array<{
    id: string;
    name: string;
    quantity: number;
  }>;
  sparePartsUsed: Array<{
    id: string;
    name: string;
    quantity: number;
  }>;
  rootCause: string;
  preventiveActions: string;
  effectiveness: number | null;
  isPreferred: boolean;
  files: File[];
}

export default function LoadSolutionDialog({
  isOpen,
  onClose,
  onSave,
  failureData
}: LoadSolutionDialogProps) {
  const { currentCompany, currentSector } = useCompany();
  const { user } = useAuth();

  // ✅ Hook para agregar solución a FailureOccurrence
  const occurrenceId = failureData?.occurrenceId || null;
  const addSolution = useAddSolution(occurrenceId);

  const [solutionData, setSolutionData] = useState<SolutionData>({
    title: '',
    solution: '',
    actualHours: 0,
    timeUnit: 'hours',
    appliedBy: '',
    appliedById: null,
    appliedDate: new Date().toISOString().split('T')[0],
    toolsUsed: [],
    sparePartsUsed: [],
    rootCause: '',
    preventiveActions: '',
    effectiveness: null,
    isPreferred: false,
    files: []
  });

  const [tools, setTools] = useState<any[]>([]);
  const [spareParts, setSpareParts] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Cargar herramientas, repuestos y empleados al abrir el modal
  useEffect(() => {
    if (isOpen) {
      fetchTools();
      fetchSpareParts();
      fetchEmployees();
    }
  }, [isOpen, currentSector?.id, currentCompany?.id]);

  const fetchTools = async () => {
    try {
      const response = await fetch('/api/tools');
      if (response.ok) {
        const data = await response.json();
        setTools(data.tools || []);
      }
    } catch (error) {
      console.error('Error fetching tools:', error);
    }
  };

  const fetchSpareParts = async () => {
    // ✅ API de repuestos no existe actualmente, dejar vacío
    // TODO: Crear API /api/spare-parts cuando se implemente el módulo de repuestos
    setSpareParts([]);
  };

  // ✅ Cargar usuarios del sistema (User) en lugar de CostEmployee
  const fetchEmployees = async () => {
    if (!currentCompany?.id) return;

    try {
      // Usar API de usuarios del sistema
      const response = await fetch(`/api/users?companyId=${currentCompany.id}`);
      if (response.ok) {
        const data = await response.json();
        // La API puede devolver { users: [...] } o directamente el array
        const users = data.users || data || [];
        setEmployees(Array.isArray(users) ? users : []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      setSolutionData(prev => ({
        ...prev,
        files: [...prev.files, ...fileArray]
      }));
    }
  };

  const removeFile = (index: number) => {
    setSolutionData(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }));
  };

  const addTool = () => {
    setSolutionData(prev => ({
      ...prev,
      toolsUsed: [
        ...prev.toolsUsed,
        { id: '', name: '', quantity: 1 }
      ]
    }));
  };

  const updateTool = (index: number, field: string, value: any) => {
    setSolutionData(prev => ({
      ...prev,
      toolsUsed: prev.toolsUsed.map((tool, i) => 
        i === index ? { ...tool, [field]: value } : tool
      )
    }));
  };

  const removeTool = (index: number) => {
    setSolutionData(prev => ({
      ...prev,
      toolsUsed: prev.toolsUsed.filter((_, i) => i !== index)
    }));
  };

  const addSparePart = () => {
    setSolutionData(prev => ({
      ...prev,
      sparePartsUsed: [
        ...prev.sparePartsUsed,
        { id: '', name: '', quantity: 1 }
      ]
    }));
  };

  const updateSparePart = (index: number, field: string, value: any) => {
    setSolutionData(prev => ({
      ...prev,
      sparePartsUsed: prev.sparePartsUsed.map((part, i) => 
        i === index ? { ...part, [field]: value } : part
      )
    }));
  };

  const removeSparePart = (index: number) => {
    setSolutionData(prev => ({
      ...prev,
      sparePartsUsed: prev.sparePartsUsed.filter((_, i) => i !== index)
    }));
  };

  const handleClose = () => {
    // Reset form
    setSolutionData({
      title: '',
      solution: '',
      actualHours: 0,
      timeUnit: 'hours',
      appliedBy: '',
      appliedById: null,
      appliedDate: new Date().toISOString().split('T')[0],
      toolsUsed: [],
      sparePartsUsed: [],
      rootCause: '',
      preventiveActions: '',
      effectiveness: null,
      isPreferred: false,
      files: []
    });
    onClose();
  };

  // Manejar click en estrellas de efectividad
  const handleEffectivenessClick = (rating: number) => {
    setSolutionData(prev => ({
      ...prev,
      effectiveness: prev.effectiveness === rating ? null : rating
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones
    if (!solutionData.title.trim()) {
      toast({
        title: "Error",
        description: "El título de la solución es requerido",
        variant: "destructive",
      });
      return;
    }

    if (!solutionData.solution.trim()) {
      toast({
        title: "Error",
        description: "La descripción de la solución es requerida",
        variant: "destructive",
      });
      return;
    }

    if (!solutionData.appliedById) {
      toast({
        title: "Error",
        description: "Selecciona quién aplicó la solución",
        variant: "destructive",
      });
      return;
    }

    // Verificar que tenemos el ID de la falla existente
    if (!failureData?.id) {
      toast({
        title: "Error",
        description: "No se encontró el ID de la falla a actualizar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // ✅ NUEVO: Si tenemos occurrenceId, crear FailureSolution en la nueva tabla
      if (occurrenceId) {
        await addSolution.mutateAsync({
          title: solutionData.title.trim(),
          description: solutionData.solution,
          appliedById: solutionData.appliedById,
          appliedAt: solutionData.appliedDate,
          actualHours: solutionData.actualHours || undefined,
          timeUnit: solutionData.timeUnit,
          toolsUsed: solutionData.toolsUsed.length > 0 ? solutionData.toolsUsed : undefined,
          sparePartsUsed: solutionData.sparePartsUsed.length > 0 ? solutionData.sparePartsUsed : undefined,
          rootCause: solutionData.rootCause || undefined,
          preventiveActions: solutionData.preventiveActions || undefined,
          effectiveness: solutionData.effectiveness || undefined,
          isPreferred: solutionData.isPreferred,
        });

        // También actualizar el WorkOrder a COMPLETED
        const completedDate = new Date().toISOString();
        await fetch(`/api/work-orders/${failureData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'COMPLETED',
            completedDate: completedDate,
            actualHours: solutionData.actualHours,
          }),
        });

        toast({
          title: "Solución Registrada",
          description: "La solución se ha guardado exitosamente",
          duration: 3000,
        });

        onSave({
          ...solutionData,
          failureData,
          workOrderId: failureData.id,
          occurrenceId,
        });

        handleClose();
        return;
      }

      // ✅ FALLBACK: Si no hay occurrenceId (datos legacy), usar el método anterior
      const completedDate = new Date().toISOString();

      // Obtener notas existentes para preservar datos de la falla
      let existingNotes: any = {};
      try {
        if (failureData.notes) {
          existingNotes = typeof failureData.notes === 'string'
            ? JSON.parse(failureData.notes)
            : failureData.notes;
        }
      } catch (e) {
        // Failed to parse existing notes
      }

      const updateData = {
        title: failureData?.title || solutionData.title,
        description: failureData?.description || solutionData.solution,
        type: 'CORRECTIVE',
        priority: failureData?.priority || 'MEDIUM',
        machineId: failureData?.machineId,
        estimatedHours: failureData?.estimatedTime || 0,
        actualHours: solutionData.actualHours,
        status: 'COMPLETED',
        completedDate: completedDate,
        notes: JSON.stringify({
          ...existingNotes,
          failureTitle: failureData?.title,
          failureDescription: failureData?.description,
          failureType: failureData?.failureType || existingNotes.failureType,
          affectedComponents: failureData?.affectedComponents || existingNotes.affectedComponents,
          componentNames: existingNotes.componentNames || [],
          reportDate: failureData?.reportDate || existingNotes.reportedDate,
          timeUnit: failureData?.timeUnit || existingNotes.timeUnit,
          failureFiles: failureData?.files?.map((f: any) => f.name) || existingNotes.attachments || [],
          reportedByName: existingNotes.reportedByName || failureData?.createdByName || null,
          reportedById: existingNotes.reportedById || failureData?.createdById || null,
          solution: solutionData.solution,
          solutionTitle: solutionData.title,
          toolsUsed: solutionData.toolsUsed,
          sparePartsUsed: solutionData.sparePartsUsed,
          appliedBy: solutionData.appliedBy,
          appliedById: solutionData.appliedById,
          appliedDate: solutionData.appliedDate,
          actualHours: solutionData.actualHours,
          solutionTimeUnit: solutionData.timeUnit,
          rootCause: solutionData.rootCause,
          preventiveActions: solutionData.preventiveActions,
          effectiveness: solutionData.effectiveness,
          isPreferred: solutionData.isPreferred,
          solutionFiles: solutionData.files.map(f => f.name)
        }),
        sectorId: currentSector?.id || null
      };

      const response = await fetch(`/api/work-orders/${failureData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error al actualizar: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();

      toast({
        title: "Solución Registrada",
        description: "Se ha completado el mantenimiento correctivo con la solución aplicada",
        duration: 3000,
      });

      onSave({
        ...solutionData,
        failureData,
        workOrderId: result.id || failureData.id
      });

      handleClose();

    } catch (error) {
      console.error('Error al registrar mantenimiento correctivo:', error);
      toast({
        title: "Error",
        description: (error as Error).message || "No se pudo registrar el mantenimiento correctivo",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Cargar Mantenimiento Aplicado</DialogTitle>
          <DialogDescription>
            Carga la solución aplicada para la falla: {failureData?.title}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título de la solución */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs font-medium">Título de la solución *</Label>
            <Input
              id="title"
              value={solutionData.title}
              onChange={(e) => setSolutionData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ej: Reemplazo de rodamiento principal"
              className="text-sm"
            />
          </div>

          {/* Solución aplicada con editor rico */}
          <div className="space-y-1.5">
            <Label htmlFor="solution" className="text-xs font-medium">Descripción detallada *</Label>
            <RichTextEditor
              content={solutionData.solution}
              onChange={(content) => setSolutionData(prev => ({ ...prev, solution: content }))}
              placeholder="Describe cómo se solucionó el problema. Puedes agregar imágenes directamente..."
              minHeight="120px"
            />
          </div>

          {/* Quien lo hizo y Fecha de aplicación */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="appliedBy" className="text-xs font-medium">Quien lo hizo *</Label>
              <Select
                value={solutionData.appliedById ? String(solutionData.appliedById) : ''}
                onValueChange={(value) => {
                  const selectedEmployee = employees.find(e => e.id.toString() === value);
                  setSolutionData(prev => ({
                    ...prev,
                    appliedById: parseInt(value), // User.id es Int
                    appliedBy: selectedEmployee?.name || ''
                  }));
                }}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Seleccionar empleado..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.length > 0 ? (
                    employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id.toString()}>
                        {employee.name || `Empleado ${employee.id}`}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="sin-empleados" disabled>
                      No hay empleados disponibles
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appliedDate" className="text-xs font-medium">Fecha de aplicación</Label>
              <DatePicker
                value={solutionData.appliedDate}
                onChange={(date) => setSolutionData(prev => ({ ...prev, appliedDate: date }))}
                placeholder="Seleccionar fecha..."
                className="text-sm"
              />
            </div>
          </div>

          {/* Archivos de solución */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Archivos de solución</Label>
            <div>
              <input
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"
                className="hidden"
                id="solution-files-input"
                type="file"
                onChange={handleFileChange}
              />
              <label
                htmlFor="solution-files-input"
                className="flex items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-muted-foreground/50 transition-colors bg-muted hover:bg-accent"
              >
                <div className="text-center">
                  <CloudUpload className="w-6 h-6 mx-auto text-muted-foreground mb-1.5" />
                  <p className="text-xs text-foreground">Haz clic o arrastra archivos aquí</p>
                  <p className="text-[10px] text-muted-foreground">PDF, DOC, XLS, imágenes hasta 10MB cada una</p>
                </div>
              </label>
            </div>
            
            {/* Lista de archivos */}
            {solutionData.files.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {solutionData.files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs truncate">{file.name}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="h-7 w-7 p-0 shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tiempo real */}
          <div className="space-y-1.5">
            <Label htmlFor="actualHours" className="text-xs font-medium">Tiempo real</Label>
            <div className="flex gap-2">
              <Input
                id="actualHours"
                type="number"
                placeholder="0"
                min="0"
                step="0.5"
                value={solutionData.actualHours}
                onChange={(e) => setSolutionData(prev => ({ ...prev, actualHours: Number(e.target.value) }))}
                className="flex-1 text-sm"
              />
              <Select 
                value={solutionData.timeUnit} 
                onValueChange={(value: any) => setSolutionData(prev => ({ ...prev, timeUnit: value }))}
              >
                <SelectTrigger className="w-24 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Horas</SelectItem>
                  <SelectItem value="minutes">Minutos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Herramientas utilizadas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Herramientas utilizadas</Label>
              <Button type="button" variant="outline" size="sm" onClick={addTool} className="h-8 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Crear herramienta
              </Button>
            </div>
            <div className="space-y-2">
              {solutionData.toolsUsed.map((tool, index) => (
                <div key={index} className="grid grid-cols-3 gap-2">
                  <Select 
                    value={tool.name} 
                    onValueChange={(value) => updateTool(index, 'name', value)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Seleccionar herramientas..." />
                    </SelectTrigger>
                    <SelectContent>
                      {tools.map((availableTool) => (
                        <SelectItem key={availableTool.id} value={availableTool.name}>
                          {availableTool.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Cantidad"
                    value={tool.quantity}
                    onChange={(e) => updateTool(index, 'quantity', Number(e.target.value))}
                    min="1"
                    className="text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => removeTool(index)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {solutionData.toolsUsed.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  No se han agregado herramientas
                </p>
              )}
            </div>
          </div>

          {/* Repuestos utilizados */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Repuestos utilizados</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Repuestos utilizados (solo repuestos de componentes seleccionados)
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Select>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Seleccionar repuestos de componentes..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-parts">No hay repuestos disponibles</SelectItem>
                </SelectContent>
              </Select>
              {solutionData.sparePartsUsed.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  No se han agregado repuestos
                </p>
              )}
            </div>
          </div>

          {/* Causa raíz */}
          <div className="space-y-1.5">
            <Label htmlFor="rootCause" className="text-xs font-medium">Causa raíz identificada</Label>
            <Input
              id="rootCause"
              value={solutionData.rootCause}
              onChange={(e) => setSolutionData(prev => ({ ...prev, rootCause: e.target.value }))}
              placeholder="¿Por qué ocurrió esta falla?"
              className="text-sm"
            />
          </div>

          {/* Acciones preventivas */}
          <div className="space-y-1.5">
            <Label htmlFor="preventiveActions" className="text-xs font-medium">Acciones preventivas recomendadas</Label>
            <Input
              id="preventiveActions"
              value={solutionData.preventiveActions}
              onChange={(e) => setSolutionData(prev => ({ ...prev, preventiveActions: e.target.value }))}
              placeholder="¿Qué hacer para evitar que vuelva a ocurrir?"
              className="text-sm"
            />
          </div>

          {/* Efectividad y Solución preferida */}
          <div className="grid grid-cols-2 gap-4">
            {/* Efectividad */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Efectividad</Label>
              <div className="flex items-center gap-1 h-9">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => handleEffectivenessClick(rating)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={cn(
                        'h-5 w-5',
                        solutionData.effectiveness && rating <= solutionData.effectiveness
                          ? 'fill-warning-muted-foreground text-warning-muted-foreground'
                          : 'text-muted-foreground hover:text-warning-muted-foreground/50'
                      )}
                    />
                  </button>
                ))}
                {solutionData.effectiveness && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {solutionData.effectiveness}/5
                  </span>
                )}
              </div>
            </div>

            {/* Marcar como preferida */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Solución preferida</Label>
              <div className="flex items-center space-x-2 h-9">
                <Checkbox
                  id="isPreferred"
                  checked={solutionData.isPreferred}
                  onCheckedChange={(checked) =>
                    setSolutionData(prev => ({ ...prev, isPreferred: checked === true }))
                  }
                />
                <label
                  htmlFor="isPreferred"
                  className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Marcar como solución preferida
                </label>
              </div>
            </div>
          </div>

        </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={loading || addSolution.isPending}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={loading || addSolution.isPending} onClick={handleSubmit}>
            {(loading || addSolution.isPending) ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar Solución'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
