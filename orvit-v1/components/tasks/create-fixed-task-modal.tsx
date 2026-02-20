"use client";

import { useState, useEffect, useRef } from "react";
import { Clock, FileText, Users, Calendar, Plus, X, Edit, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUsers } from "@/hooks/use-users";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { calculateNextExecution, getFrequencyDescription, TaskFrequency } from "@/lib/task-scheduler";
import { InstructiveFileUpload } from "@/components/ui/InstructiveFileUpload";

interface CreateFixedTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTask: (taskData: NewFixedTaskData) => void;
  frequency?: string; // Frecuencia preseleccionada desde el kanban
  editingTask?: any; // Tarea que se está editando
}

interface FileAttachment {
  url: string;
  name: string;
  size: number;
  type: string;
}

interface NewFixedTaskData {
  title: string;
  description: string;
  frequency: TaskFrequency;
  assignedTo: {
    id: string;
    name: string;
  };
  department: string;
  instructives: {
    id: string;
    title: string;
    content: string;
    attachments: FileAttachment[];
  }[];
  estimatedTime: number;
  priority: 'baja' | 'media' | 'alta';
  isActive: boolean;
  nextExecution: string;
  executionTime: string;
  createdAt: string;
}

// Los usuarios ahora se obtienen dinámicamente de la base de datos



// Frecuencias disponibles
const frequencies: { value: TaskFrequency; label: string; description: string }[] = [
  { value: 'diaria', label: 'Diaria', description: 'Todos los días a la misma hora' },
  { value: 'semanal', label: 'Semanal', description: 'Todos los lunes' },
  { value: 'quincenal', label: 'Quincenal', description: 'El día 15 de cada mes' },
  { value: 'mensual', label: 'Mensual', description: 'El día 1 de cada mes' },
  { value: 'trimestral', label: 'Trimestral', description: 'El día 1 cada 3 meses' },
  { value: 'semestral', label: 'Semestral', description: 'El día 1 cada 6 meses' },
  { value: 'anual', label: 'Anual', description: 'El mismo día cada año' }
];

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'alta': return 'bg-destructive/10 text-destructive border-destructive/30';
    case 'media': return 'bg-warning-muted text-warning-muted-foreground border-warning-muted';
    case 'baja': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/50';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

export function CreateFixedTaskModal({ 
  isOpen, 
  onClose, 
  onCreateTask,
  frequency: preselectedFrequency,
  editingTask
}: CreateFixedTaskModalProps) {
  const { users: availableUsers, loading: usersLoading, error: usersError } = useUsers();
  

  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    frequency: (preselectedFrequency as TaskFrequency) || 'diaria',
    assignedUserId: '',
    estimatedTime: 30,
    priority: 'media' as 'baja' | 'media' | 'alta',
    isActive: true,
    executionTime: '08:00'
  });

  const [instructives, setInstructives] = useState<{
    title: string;
    content: string;
    attachments: FileAttachment[];
  }[]>([]);

  const [currentInstructive, setCurrentInstructive] = useState({
    title: '',
    content: '',
    attachments: [] as FileAttachment[]
  });

  const [isCreating, setIsCreating] = useState(false);

  // Ref para saber si el formulario ya fue inicializado en esta sesión del modal
  const formInitializedForRef = useRef<string | null>(null);

  const selectedUser = availableUsers.find(user => `${user.type}-${user.id}` === formData.assignedUserId);
  const selectedFrequency = frequencies.find(f => f.value === formData.frequency);

  // Inicializar formulario cuando se abre el modal.
  // availableUsers está en las deps para resolver assignedUserId, pero tras la primera
  // inicialización solo actualiza ese campo (sin resetear executionTime ni otros valores).
  useEffect(() => {
    if (!isOpen) {
      formInitializedForRef.current = null;
      return;
    }

    const sessionKey = editingTask ? `edit-${editingTask.id}` : 'new';
    const alreadyInitialized = formInitializedForRef.current === sessionKey;

    // Helper: resolver assignedUserId desde availableUsers
    const resolveAssignedUserId = () => {
      if (!editingTask?.assignedTo?.id) return '';
      const found = availableUsers.find(u => u.id.toString() === editingTask.assignedTo.id.toString());
      return found ? `${found.type}-${found.id}` : String(editingTask.assignedTo.id);
    };

    if (editingTask) {
      const assignedUserId = resolveAssignedUserId();
      if (!alreadyInitialized) {
        formInitializedForRef.current = sessionKey;
        setFormData({
          title: editingTask.title || '',
          description: editingTask.description || '',
          frequency: editingTask.frequency || 'diaria',
          assignedUserId,
          estimatedTime: editingTask.estimatedTime || 30,
          priority: editingTask.priority || 'media',
          isActive: editingTask.isActive !== undefined ? editingTask.isActive : true,
          executionTime: (editingTask as any).executionTime || '08:00',
        });
        if (editingTask.instructives && editingTask.instructives.length > 0) {
          setInstructives(editingTask.instructives.map((inst: any) => ({
            title: inst.title || '',
            content: inst.content || '',
            attachments: (inst.attachments || []).map((attachment: any) => {
              if (typeof attachment === 'string') {
                return { url: attachment, name: attachment.split('/').pop() || 'archivo', size: 0, type: 'unknown' };
              }
              return attachment;
            })
          })));
        }
      } else {
        // availableUsers recargó: solo actualizar assignedUserId sin tocar el resto
        setFormData(prev => ({ ...prev, assignedUserId }));
      }
    } else {
      if (!alreadyInitialized) {
        formInitializedForRef.current = sessionKey;
        setFormData({
          title: '',
          description: '',
          frequency: (preselectedFrequency as TaskFrequency) || 'diaria',
          assignedUserId: '',
          estimatedTime: 30,
          priority: 'media',
          isActive: true,
          executionTime: '08:00',
        });
        setInstructives([]);
        setCurrentInstructive({ title: '', content: '', attachments: [] });
      }
      // Si ya fue inicializado (nueva tarea), no resetear al recargar availableUsers
    }
  }, [editingTask, isOpen, preselectedFrequency, availableUsers]);

  // Calcular próxima ejecución basada en frecuencia y hora seleccionada
  const calculateNextExecutionDate = () => {
    const [hours, minutes] = formData.executionTime.split(':').map(Number);
    const baseDate = new Date();
    baseDate.setHours(hours, minutes, 0, 0);
    
    return calculateNextExecution(formData.frequency, baseDate);
  };

  const validateForm = () => {
    const errors: string[] = [];
    
    if (!formData.title.trim()) errors.push('El título es obligatorio');
    if (!formData.description.trim()) errors.push('La descripción es obligatoria');
    if (!formData.assignedUserId) errors.push('Debe asignar la tarea a un usuario');
    if (formData.estimatedTime < 1) errors.push('El tiempo estimado debe ser mayor a 0');
    
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Protección contra envíos múltiples
    if (isCreating) return;
    
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      toast.error(`Corregí los errores: ${validationErrors.join(', ')}`);
      return;
    }

    setIsCreating(true);

    try {
      const nextExecution = calculateNextExecutionDate();
      
      // Parsear assignedUserId para obtener el ID real
      let assignedId = '';
      if (formData.assignedUserId && selectedUser) {
        assignedId = selectedUser.id.toString();
      } else if (formData.assignedUserId.includes('-')) {
        // Formato: "USER-1" o "WORKER-2"
        assignedId = formData.assignedUserId.split('-')[1];
      } else {
        assignedId = formData.assignedUserId;
      }
      
      const taskData: NewFixedTaskData = {
        title: formData.title,
        description: formData.description,
        frequency: formData.frequency,
        assignedTo: {
          id: assignedId,
          name: selectedUser?.name || ''
        },
        department: 'Administración',
        instructives: instructives.map((inst, index) => ({
          id: `${Date.now()}-${index}`,
          title: inst.title,
          content: inst.content,
          attachments: inst.attachments
        })),
        estimatedTime: formData.estimatedTime,
        priority: formData.priority,
        isActive: formData.isActive,
        nextExecution: nextExecution.toISOString(),
        executionTime: formData.executionTime,
        createdAt: new Date().toISOString()
      };

      await onCreateTask(taskData);
      
      // Reset form solo después de éxito
      setFormData({
        title: '',
        description: '',
        frequency: 'diaria',
        assignedUserId: '',
        estimatedTime: 30,
        priority: 'media',
        isActive: true,
        executionTime: '08:00'
      });
      setInstructives([]);
      setCurrentInstructive({ title: '', content: '', attachments: [] });
      
      // Esperar un poco antes de cerrar para evitar double clicks
      setTimeout(() => {
        onClose();
      }, 100);
    } catch (error) {
      toast.error('Error al crear la tarea');
    } finally {
      setIsCreating(false);
    }
  };

  const addInstructive = () => {
    if (currentInstructive.title && currentInstructive.content) {
      setInstructives([...instructives, { ...currentInstructive }]);
      setCurrentInstructive({ title: '', content: '', attachments: [] });
    }
  };

  const removeInstructive = (index: number) => {
    setInstructives(instructives.filter((_, i) => i !== index));
  };



  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {editingTask ? 'Editar Tarea Fija' : 'Nueva Tarea Fija'}
            {(preselectedFrequency || editingTask?.frequency) && (
              <Badge variant="outline" className="ml-2 text-xs">
                {frequencies.find(f => f.value === (preselectedFrequency || editingTask?.frequency))?.label}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <DialogBody className="space-y-6">
              {/* Información básica */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Información General
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título de la tarea *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Ej: Revisión de documentación"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descripción *</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe detalladamente en qué consiste la tarea..."
                      rows={3}
                      required
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Programación y Asignación */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Programación y Asignación
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="frequency">Frecuencia *</Label>
                      <Select 
                        value={formData.frequency} 
                        onValueChange={(value: TaskFrequency) => setFormData({ ...formData, frequency: value })}
                        disabled={!!preselectedFrequency}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona frecuencia" />
                        </SelectTrigger>
                        <SelectContent>
                          {frequencies.map(freq => (
                            <SelectItem key={freq.value} value={freq.value}>
                              <div className="py-1">
                                <div className="font-medium">{freq.label}</div>
                                <div className="text-xs text-muted-foreground">{freq.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="assignedUser">Asignado a *</Label>
                      <Select value={formData.assignedUserId} onValueChange={(value) => {
                        setFormData({ 
                          ...formData, 
                          assignedUserId: value
                        });
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder={usersLoading ? "Cargando usuarios..." : `Selecciona usuario (${availableUsers.length} disponibles)`} />
                        </SelectTrigger>
                        <SelectContent>
                          {usersLoading ? (
                            <SelectItem value="loading" disabled>
                              Cargando usuarios...
                            </SelectItem>
                          ) : availableUsers.length === 0 ? (
                            <SelectItem value="no-users" disabled>
                              No hay usuarios disponibles
                            </SelectItem>
                          ) : (
                            availableUsers.map(user => (
                              <SelectItem key={`${user.type}-${user.id}`} value={`${user.type}-${user.id}`}>
                                <div className="py-1">
                                  <div className="font-medium">{user.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {user.type === 'WORKER' ? user.specialty || 'Operario' : 'Administración'}
                                  </div>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="executionTime">Hora de ejecución</Label>
                      <Input
                        id="executionTime"
                        type="time"
                        value={formData.executionTime}
                        onChange={(e) => setFormData({ ...formData, executionTime: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Vista previa de próxima ejecución */}
                  {formData.frequency && (
                    <div className="bg-muted/50 p-3 rounded-lg border">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span className="font-medium">Próxima ejecución:</span>
                        <span className="text-foreground">
                          {calculateNextExecutionDate().toLocaleString('es-ES', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {getFrequencyDescription(formData.frequency, formData.executionTime)}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Configuración de Tarea */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Configuración de Tarea
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="estimatedTime">Tiempo estimado (minutos)</Label>
                      <Input
                        id="estimatedTime"
                        type="number"
                        min="1"
                        value={formData.estimatedTime}
                        onChange={(e) => setFormData({ ...formData, estimatedTime: Number(e.target.value) })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="priority">Prioridad</Label>
                      <Select value={formData.priority} onValueChange={(value: 'baja' | 'media' | 'alta') => setFormData({ ...formData, priority: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baja">
                            <Badge variant="outline" className={getPriorityColor('baja')}>
                              Baja
                            </Badge>
                          </SelectItem>
                          <SelectItem value="media">
                            <Badge variant="outline" className={getPriorityColor('media')}>
                              Media
                            </Badge>
                          </SelectItem>
                          <SelectItem value="alta">
                            <Badge variant="outline" className={getPriorityColor('alta')}>
                              Alta
                            </Badge>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="isActive">Estado inicial</Label>
                      <div className="flex items-center space-x-2 h-10">
                        <Switch
                          id="isActive"
                          checked={formData.isActive}
                          onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                        />
                        <Label htmlFor="isActive" className="text-sm">
                          {formData.isActive ? 'Activa' : 'Inactiva'}
                        </Label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Instructivos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Instructivos de Trabajo
                    <Badge variant="secondary">{instructives.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Lista de instructivos existentes */}
                  {instructives.length > 0 && (
                    <div className="space-y-2">
                      {instructives.map((instructive, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded border">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{instructive.title}</div>
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {instructive.content}
                            </div>
                            {instructive.attachments.length > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                <FileText className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {instructive.attachments.length} archivo{instructive.attachments.length !== 1 ? 's' : ''} adjunto{instructive.attachments.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeInstructive(index)}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Separator />
                    </div>
                  )}

                  {/* Formulario para nuevo instructivo */}
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="instructiveTitle">Título del instructivo</Label>
                      <Input
                        id="instructiveTitle"
                        value={currentInstructive.title}
                        onChange={(e) => setCurrentInstructive({ ...currentInstructive, title: e.target.value })}
                        placeholder="Ej: Procedimiento de limpieza de filtros"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="instructiveContent">Contenido paso a paso</Label>
                      <Textarea
                        id="instructiveContent"
                        value={currentInstructive.content}
                        onChange={(e) => setCurrentInstructive({ ...currentInstructive, content: e.target.value })}
                        placeholder="1. Primer paso&#10;2. Segundo paso&#10;3. Tercer paso..."
                        rows={4}
                      />
                    </div>

                    {/* Archivos adjuntos */}
                    <div className="space-y-2">
                      <InstructiveFileUpload
                        entityType="task"
                        entityId="temp"
                        attachments={currentInstructive.attachments}
                        onAttachmentsChange={(attachments) => 
                          setCurrentInstructive({ ...currentInstructive, attachments })
                        }
                        title="Archivos del Instructivo"
                        description="Agrega documentos de referencia, imágenes o diagramas"
                        maxFiles={3}
                      />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={addInstructive}
                      disabled={!currentInstructive.title || !currentInstructive.content}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Instructivo
                    </Button>
                  </div>
                </CardContent>
              </Card>
          </DialogBody>

          <DialogFooter>
            <div className="text-sm text-muted-foreground mr-auto">
              * Campos obligatorios
            </div>
            <Button variant="outline" size="sm" onClick={onClose} disabled={isCreating}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isCreating || !formData.title.trim() || !formData.assignedUserId}
              style={{ pointerEvents: isCreating ? 'none' : 'auto' }}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {editingTask ? 'Guardando...' : 'Creando...'}
                </>
              ) : (
                <>
                  {editingTask ? (
                    <>
                      <Edit className="h-4 w-4 mr-2" />
                      Guardar Cambios
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Crear Tarea Fija
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 