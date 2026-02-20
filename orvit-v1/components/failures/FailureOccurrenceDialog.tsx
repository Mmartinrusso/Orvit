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
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  CheckCircle,
  Plus,
  AlertTriangle,
  Clock,
  User,
  Star,
  History,
  Wrench
} from 'lucide-react';
import { cn, stripHtmlTags } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';

interface FailureOccurrenceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  failure: any; // The failure type from the catalog
  hideUnresolvedOption?: boolean; // Hide "unresolved" option (for WorkOrder context)
  workOrderId?: number; // If opened from WorkOrder, this is the WO ID
}

interface PreviousSolution {
  id: number | string; // Puede ser number (FailureSolution) o string (legacy-X, wo-X)
  title: string;
  description: string;
  appliedByName: string | null;
  appliedById: number | null;
  appliedAt: string;
  actualHours: number | null;
  timeUnit: string;
  effectiveness: number | null;
  isPreferred: boolean;
  toolsUsed?: any[];
  sparePartsUsed?: any[];
  rootCause?: string;
  preventiveActions?: string;
}

type SolutionMode = 'existing' | 'new' | 'unresolved';

export default function FailureOccurrenceDialog({
  isOpen,
  onClose,
  onSuccess,
  failure,
  hideUnresolvedOption = false,
  workOrderId
}: FailureOccurrenceDialogProps) {
  const { currentCompany, currentSector } = useCompany();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [loadingSolutions, setLoadingSolutions] = useState(false);
  const [previousSolutions, setPreviousSolutions] = useState<PreviousSolution[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // Form state
  const [solutionMode, setSolutionMode] = useState<SolutionMode>('existing');
  const [selectedSolutionId, setSelectedSolutionId] = useState<number | string | null>(null);
  const [notes, setNotes] = useState('');

  // New solution form
  const [newSolution, setNewSolution] = useState({
    title: '',
    description: '',
    appliedById: null as number | null,
    actualHours: 0,
    timeUnit: 'hours' as 'hours' | 'minutes',
    rootCause: '',
    preventiveActions: '',
  });

  // Load previous solutions when dialog opens
  useEffect(() => {
    if (isOpen && failure?.id) {
      fetchPreviousSolutions();
      fetchEmployees();
    }
  }, [isOpen, failure?.id]);

  // Auto-select preferred solution if exists
  useEffect(() => {
    if (previousSolutions.length > 0 && !selectedSolutionId) {
      const preferred = previousSolutions.find(s => s.isPreferred);
      if (preferred) {
        setSelectedSolutionId(preferred.id);
      } else {
        setSelectedSolutionId(previousSolutions[0].id);
      }
    }
  }, [previousSolutions]);

  // Set default mode based on available solutions
  useEffect(() => {
    if (previousSolutions.length === 0) {
      setSolutionMode('new');
    } else {
      setSolutionMode('existing');
    }
  }, [previousSolutions]);

  const fetchPreviousSolutions = async () => {
    setLoadingSolutions(true);
    try {
      const response = await fetch(`/api/failures/${failure.id}/solutions`);
      if (response.ok) {
        const data = await response.json();
        setPreviousSolutions(data.solutions || []);
      }
    } catch (error) {
      console.error('Error fetching previous solutions:', error);
    } finally {
      setLoadingSolutions(false);
    }
  };

  const fetchEmployees = async () => {
    if (!currentCompany?.id) return;
    try {
      const response = await fetch(`/api/users?companyId=${currentCompany.id}`);
      if (response.ok) {
        const data = await response.json();
        const users = data.users || data || [];
        setEmployees(Array.isArray(users) ? users : []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSubmit = async () => {
    // Validación temprana: si es modo 'existing' debe haber una solución seleccionada
    if (solutionMode === 'existing' && !selectedSolutionId) {
      toast({
        title: 'Error',
        description: 'Debe seleccionar una solución de la lista',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      let solutionData: any = null;

      // Obtener el userId como número
      const currentUserId = user?.id ? (typeof user.id === 'string' ? parseInt(user.id) : user.id) : null;

      // Preparar datos de la solución según el modo
      if (solutionMode === 'existing' && selectedSolutionId) {
        const selectedSol = previousSolutions.find(s => s.id === selectedSolutionId);
        if (selectedSol) {
          // Asegurar que appliedById sea un número
          const appliedById = selectedSol.appliedById
            ? (typeof selectedSol.appliedById === 'string' ? parseInt(selectedSol.appliedById) : selectedSol.appliedById)
            : currentUserId;
          solutionData = {
            title: selectedSol.title,
            description: selectedSol.description,
            appliedById: appliedById,
            actualHours: selectedSol.actualHours || 0,
            timeUnit: selectedSol.timeUnit || 'hours',
            rootCause: selectedSol.rootCause,
            preventiveActions: selectedSol.preventiveActions,
            toolsUsed: selectedSol.toolsUsed,
            sparePartsUsed: selectedSol.sparePartsUsed,
          };
        }
      } else if (solutionMode === 'new') {
        if (!newSolution.title || !newSolution.description) {
          toast({
            title: 'Error',
            description: 'Título y descripción de la solución son requeridos',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        // Asegurar que appliedById sea un número
        const appliedById = newSolution.appliedById
          ? (typeof newSolution.appliedById === 'string' ? parseInt(newSolution.appliedById as any) : newSolution.appliedById)
          : currentUserId;
        solutionData = {
          title: newSolution.title,
          description: newSolution.description,
          appliedById: appliedById,
          actualHours: newSolution.actualHours,
          timeUnit: newSolution.timeUnit,
          rootCause: newSolution.rootCause,
          preventiveActions: newSolution.preventiveActions,
        };
      }

      // Si se abrió desde un WorkOrder, usar el endpoint de apply-solution
      if (workOrderId && solutionData) {
        const payload: any = {
          actualHours: solutionData.actualHours,
          timeUnit: solutionData.timeUnit || 'hours',
          notes: notes || null,
          effectiveness: null // TODO: agregar campo de efectividad si es necesario
        };

        if (solutionMode === 'existing' && selectedSolutionId) {
          // Validar que selectedSolutionId sea un número o string válido
          if (!selectedSolutionId) {
            toast({
              title: 'Error',
              description: 'Debe seleccionar una solución válida',
              variant: 'destructive',
            });
            setLoading(false);
            return;
          }
          payload.existingSolutionId = selectedSolutionId;
        } else if (solutionMode === 'new') {
          payload.newSolution = {
            title: solutionData.title,
            description: solutionData.description,
            rootCause: solutionData.rootCause || null,
            preventiveActions: solutionData.preventiveActions || null,
            toolsUsed: solutionData.toolsUsed || null,
            sparePartsUsed: solutionData.sparePartsUsed || null,
            attachments: null
          };
        }

        const response = await fetch(`/api/work-orders/${workOrderId}/apply-solution`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Error al aplicar solución');
        }

        const result = await response.json();

        toast({
          title: 'Solución aplicada',
          description: 'La orden de trabajo se completó exitosamente',
        });

        onSuccess();
        handleClose();
        return;
      }

      // Crear la ocurrencia en la tabla de ocurrencias
      // NO creamos un nuevo WorkOrder - la falla ya existe, solo registramos la ocurrencia
      const occurrenceData: any = {
        failureTypeId: failure.id,
        machineId: failure.machineId,
        reportedBy: user?.id,
        notes: notes || `Ocurrencia registrada el ${new Date().toLocaleString('es-ES')}`,
        status: solutionMode === 'unresolved' ? 'OPEN' : 'RESOLVED',
        title: failure.title,
        description: failure.description,
        // ✅ Si es una solución existente, enviar solo el ID para reutilizarla
        ...(solutionMode === 'existing' && selectedSolutionId && {
          existingSolutionId: selectedSolutionId,
          hasSolution: true,
        }),
        // ✅ Si es una solución nueva, enviar todos los datos para crearla
        ...(solutionMode === 'new' && solutionData && {
          hasSolution: true,
          solution: solutionData,
        }),
      };

      const occurrenceResponse = await fetch(`/api/failures/${failure.id}/occurrences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(occurrenceData),
      });

      if (!occurrenceResponse.ok) {
        const error = await occurrenceResponse.json();
        throw new Error(error.error || 'Error al crear la ocurrencia');
      }

      const occurrenceResult = await occurrenceResponse.json();

      // ✅ El backend ya maneja la creación de WorkOrder, FailureSolution y SolutionApplication
      // No necesitamos crear nada más manualmente

      toast({
        title: solutionMode === 'unresolved' ? 'Ocurrencia registrada' : 'Mantenimiento correctivo creado',
        description: solutionMode === 'unresolved'
          ? 'La falla fue registrada sin solución'
          : 'Se registró la ocurrencia y se creó el mantenimiento correctivo',
      });

      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: (error as Error).message || 'No se pudo registrar la ocurrencia',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset state
    setSolutionMode('existing');
    setSelectedSolutionId(null);
    setNotes('');
    setNewSolution({
      title: '',
      description: '',
      appliedById: null,
      actualHours: 0,
      timeUnit: 'hours',
      rootCause: '',
      preventiveActions: '',
    });
    setPreviousSolutions([]);
    onClose();
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning-muted-foreground" />
            {workOrderId ? 'Aplicar Solución a Orden de Trabajo' : 'Registrar Ocurrencia de Falla'}
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">{failure?.title}</span>
            {failure?.machineName && (
              <span className="text-muted-foreground"> - {failure.machineName}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* Info de la falla */}
            <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Máquina:</span>
                <span>{failure?.machineName || 'N/A'}</span>
              </div>
              {failure?.componentName && (
                <div className="ml-6">
                  <span className="text-muted-foreground">Componente:</span> {failure.componentName}
                </div>
              )}
              {failure?.subcomponentName && (
                <div className="ml-6">
                  <span className="text-muted-foreground">Subcomponente:</span> {failure.subcomponentName}
                </div>
              )}
            </div>

            {/* Solution mode selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">¿Cómo se resolvió?</Label>
              <RadioGroup
                value={solutionMode}
                onValueChange={(value) => setSolutionMode(value as SolutionMode)}
                className="space-y-2"
              >
                {previousSolutions.length > 0 && (
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="existing" id="existing" />
                    <Label htmlFor="existing" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-info-muted-foreground" />
                        <span>Usar solución anterior</span>
                        <Badge variant="secondary" className="ml-2">
                          {previousSolutions.length} disponible{previousSolutions.length > 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </Label>
                  </div>
                )}

                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="new" id="new" />
                  <Label htmlFor="new" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-success" />
                      <span>Crear nueva solución</span>
                    </div>
                  </Label>
                </div>

                {!hideUnresolvedOption && (
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="unresolved" id="unresolved" />
                    <Label htmlFor="unresolved" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
                        <span>Sin resolver todavía</span>
                      </div>
                    </Label>
                  </div>
                )}
              </RadioGroup>
            </div>

            {/* Previous solutions list */}
            {solutionMode === 'existing' && (
              <div className="space-y-3">
                <Label>Seleccionar solución</Label>
                {loadingSolutions ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : previousSolutions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No hay soluciones anteriores registradas
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {previousSolutions.map((solution) => (
                      <Card
                        key={solution.id}
                        className={cn(
                          "cursor-pointer transition-all",
                          selectedSolutionId === solution.id
                            ? "border-primary ring-1 ring-primary"
                            : "hover:border-muted-foreground/50"
                        )}
                        onClick={() => setSelectedSolutionId(solution.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm truncate">
                                  {solution.title}
                                </span>
                                {solution.isPreferred && (
                                  <Badge variant="secondary" className="flex-shrink-0">
                                    <Star className="h-3 w-3 mr-1 fill-warning-muted-foreground text-warning-muted-foreground" />
                                    Preferida
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                {stripHtmlTags(solution.description)}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                {solution.appliedByName && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {solution.appliedByName}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDate(solution.appliedAt)}
                                </span>
                                {solution.actualHours && (
                                  <span>
                                    {solution.actualHours} {solution.timeUnit === 'minutes' ? 'min' : 'hrs'}
                                  </span>
                                )}
                                {solution.effectiveness && (
                                  <span className="flex items-center gap-0.5">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Star
                                        key={star}
                                        className={cn(
                                          "h-3 w-3",
                                          star <= solution.effectiveness!
                                            ? "fill-warning-muted-foreground text-warning-muted-foreground"
                                            : "text-muted-foreground"
                                        )}
                                      />
                                    ))}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex-shrink-0 ml-2">
                              <div
                                className={cn(
                                  "w-4 h-4 rounded-full border-2",
                                  selectedSolutionId === solution.id
                                    ? "border-primary bg-primary"
                                    : "border-muted-foreground/30"
                                )}
                              >
                                {selectedSolutionId === solution.id && (
                                  <CheckCircle className="h-3 w-3 text-primary-foreground m-auto" />
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* New solution form */}
            {solutionMode === 'new' && (
              <div className="space-y-4 border rounded-lg p-4 bg-muted/30 max-h-[300px] overflow-y-auto">
                  <div className="space-y-2">
                    <Label htmlFor="solution-title">Título de la solución *</Label>
                    <Input
                      id="solution-title"
                      value={newSolution.title}
                      onChange={(e) => setNewSolution({ ...newSolution, title: e.target.value })}
                      placeholder="Ej: Reemplazo de rodamiento"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Descripción de la solución *</Label>
                    <RichTextEditor
                      value={newSolution.description}
                      onChange={(value) => setNewSolution({ ...newSolution, description: value })}
                      placeholder="Describe los pasos realizados para resolver la falla..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="applied-by">Quién lo hizo</Label>
                      <Select
                        value={newSolution.appliedById?.toString() || ''}
                        onValueChange={(value) => setNewSolution({ ...newSolution, appliedById: parseInt(value) })}
                      >
                        <SelectTrigger id="applied-by">
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id.toString()}>
                              {emp.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="time-spent">Tiempo empleado</Label>
                      <div className="flex gap-2">
                        <Input
                          id="time-spent"
                          type="number"
                          min="0"
                          step="0.5"
                          value={newSolution.actualHours}
                          onChange={(e) => setNewSolution({ ...newSolution, actualHours: parseFloat(e.target.value) || 0 })}
                          className="flex-1"
                        />
                        <Select
                          value={newSolution.timeUnit}
                          onValueChange={(value) => setNewSolution({ ...newSolution, timeUnit: value as 'hours' | 'minutes' })}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hours">Horas</SelectItem>
                            <SelectItem value="minutes">Minutos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="root-cause">Causa raíz (opcional)</Label>
                    <Textarea
                      id="root-cause"
                      value={newSolution.rootCause}
                      onChange={(e) => setNewSolution({ ...newSolution, rootCause: e.target.value })}
                      placeholder="¿Por qué ocurrió esta falla?"
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="preventive-actions">Acciones preventivas (opcional)</Label>
                    <Textarea
                      id="preventive-actions"
                      value={newSolution.preventiveActions}
                      onChange={(e) => setNewSolution({ ...newSolution, preventiveActions: e.target.value })}
                      placeholder="¿Qué hacer para evitar que vuelva a ocurrir?"
                      rows={2}
                    />
                  </div>
              </div>
            )}

            {/* Notes for unresolved */}
            {solutionMode === 'unresolved' && (
              <div className="space-y-2">
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Agregar notas sobre la ocurrencia..."
                  rows={3}
                />
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={loading || (solutionMode === 'existing' && !selectedSolutionId) || (solutionMode === 'new' && (!newSolution.title || !newSolution.description))}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {workOrderId ? 'Aplicando...' : 'Registrando...'}
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                {workOrderId ? 'Aplicar Solución y Completar' : 'Registrar Ocurrencia'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
