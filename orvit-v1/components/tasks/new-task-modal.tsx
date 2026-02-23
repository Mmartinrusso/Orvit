"use client";

import { useState, useEffect } from "react";
import { CalendarIcon, Plus, X, Layers, Loader2 } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDate } from "@/lib/date-utils";
import { useTaskStore } from "@/hooks/use-task-store";
import { useToast } from "@/hooks/use-toast";
import { TaskFileUpload, TaskFileAttachment } from "@/components/ui/TaskFileUpload";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  email: string;
}

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: (task: any) => void;
  defaultGroupId?: number | null;
}

export function NewTaskModal({ isOpen, onClose, onTaskCreated, defaultGroupId }: NewTaskModalProps) {
  const { createTask } = useTaskStore();
  const { toast } = useToast();
  const { currentCompany } = useCompany();

  const [title, setTitle] = useState("");
  const [groupId, setGroupId] = useState<number | null>(defaultGroupId ?? null);
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState("media");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [tag, setTag] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [subtask, setSubtask] = useState("");
  const [subtasks, setSubtasks] = useState<{id: string; title: string; completed: boolean}[]>([]);
  const [attachments, setAttachments] = useState<TaskFileAttachment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errors, setErrors] = useState<{
    title?: string;
    assignedTo?: string;
    dueDate?: string;
  }>({});
  
  const { data: groups = [] } = useQuery<any[]>({
    queryKey: ['task-groups', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const res = await fetch(`/api/task-groups?companyId=${currentCompany.id}`, {
        credentials: 'include',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.data || [];
    },
    enabled: !!currentCompany?.id,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (isOpen) {
      setGroupId(defaultGroupId ?? null);
      const loadUsers = async () => {
        try {
          setLoadingUsers(true);
          
          // Obtener token del localStorage
          const token = localStorage.getItem('token') || 'mock-token';
          
          const response = await fetch('/api/users', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
          }
          
          const data = await response.json();
          
          // Verificar que la respuesta sea un array
          if (Array.isArray(data)) {
            setUsers(data);
          } else {
            setUsers([]);
          }
        } catch (error) {
          console.error('❌ Error loading users:', error);
          setUsers([]); // Array vacío en caso de error
        } finally {
          setLoadingUsers(false);
        }
      };

      loadUsers();
    } else {
      // Limpiar cuando se cierra el modal
      setUsers([]);
      setLoadingUsers(false);
    }
  }, [isOpen]);
  
  const validate = () => {
    const newErrors: typeof errors = {};
    if (!title.trim()) {
      newErrors.title = "El título es requerido";
    }
    if (!assignedTo) {
      newErrors.assignedTo = "Debes asignar la tarea a un usuario";
    }
    if (!dueDate) {
      newErrors.dueDate = "Debes seleccionar una fecha límite";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateTask = async () => {
    // Protección contra envíos múltiples
    if (creating) {
      return;
    }

    if (!validate()) {
      return;
    }

    setCreating(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        assignedToId: assignedTo,
        priority,
        dueDate: dueDate.toISOString(),
        groupId: groupId ?? undefined,
        tags,
        subtasks,
        attachments,
      };

      if (onTaskCreated) {
        await onTaskCreated(payload);
      } else {
        // Solo usar el hook si no hay función externa de creación
        await createTask(payload);
      }

      toast({ 
        title: "Tarea creada", 
        description: "La tarea fue creada exitosamente." 
      });
      
      resetForm();
      
      // Esperar un poco antes de cerrar para evitar double clicks
      setTimeout(() => {
        onClose();
      }, 100);
    } catch (error) {
      console.error('Error al crear tarea:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo crear la tarea",
      });
    } finally {
      setCreating(false);
    }
  };
  
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setAssignedTo("");
    setPriority("media");
    setDueDate(undefined);
    setGroupId(defaultGroupId ?? null);
    setTag("");
    setTags([]);
    setSubtask("");
    setSubtasks([]);
    setAttachments([]);
    setErrors({});
  };
  
  const handleAddTag = () => {
    if (!tag.trim()) return;
    if (!tags.includes(tag.trim())) {
      setTags([...tags, tag.trim()]);
    }
    setTag("");
  };
  
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };
  
  const handleAddSubtask = () => {
    if (!subtask.trim()) return;
    
    setSubtasks([
      ...subtasks, 
      { 
        id: Math.random().toString(36).substring(2, 9),
        title: subtask.trim(),
        completed: false
      }
    ]);
    setSubtask("");
  };
  
  const handleRemoveSubtask = (id: string) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        resetForm();
        onClose();
      }
    }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Nueva Tarea</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-6">
            {/* Sección: Básico */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-3">Información básica</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">
                      Título <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="title"
                      placeholder="Título de la tarea"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        if (errors.title) setErrors({ ...errors, title: undefined });
                      }}
                      className={cn(
                        errors.title ? "border-destructive hover:border-destructive" : "hover:border-primary/50",
                        "transition-colors"
                      )}
                      autoFocus
                    />
                    {errors.title && (
                      <p className="text-xs text-destructive mt-1">{errors.title}</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="assigned">
                        Asignado a <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={assignedTo}
                        onValueChange={(value) => {
                          setAssignedTo(value);
                          if (errors.assignedTo) setErrors({ ...errors, assignedTo: undefined });
                        }}
                        disabled={loadingUsers}
                      >
                        <SelectTrigger className={cn(
                          errors.assignedTo ? "border-destructive hover:border-destructive" : "hover:border-primary/50",
                          "transition-colors"
                        )}>
                          <SelectValue placeholder={loadingUsers ? "Cargando usuarios..." : "Seleccionar usuario"} />
                        </SelectTrigger>
                        <SelectContent>
                          {loadingUsers && (
                            <SelectItem value="loading" disabled>Cargando usuarios...</SelectItem>
                          )}
                          {!loadingUsers && (!Array.isArray(users) || users.length === 0) && (
                            <SelectItem value="sin-usuarios" disabled>No hay usuarios disponibles</SelectItem>
                          )}
                          {!loadingUsers && Array.isArray(users) && users.length > 0 && users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.assignedTo && (
                        <p className="text-xs text-destructive mt-1">{errors.assignedTo}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Usuario responsable de completar la tarea
                      </p>
                    </div>
                    
                    <div>
                      <Label htmlFor="dueDate">
                        Fecha límite <span className="text-destructive">*</span>
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal transition-colors",
                              !dueDate && "text-muted-foreground",
                              errors.dueDate ? "border-destructive hover:border-destructive" : "hover:border-primary/50"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dueDate ? formatDate(dueDate) : "Seleccionar fecha"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={dueDate}
                            onSelect={(date) => {
                              setDueDate(date);
                              if (errors.dueDate) setErrors({ ...errors, dueDate: undefined });
                            }}
                            initialFocus
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            fromDate={new Date()}
                          />
                        </PopoverContent>
                      </Popover>
                      {errors.dueDate && (
                        <p className="text-xs text-destructive mt-1">{errors.dueDate}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Fecha esperada de finalización
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="priority">Prioridad</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger className="hover:border-primary/50 transition-colors">
                        <SelectValue placeholder="Media" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baja">Baja</SelectItem>
                        <SelectItem value="media">Media</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {groups.length > 0 && (
                    <div>
                      <Label className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                        Grupo (opcional)
                      </Label>
                      <Select
                        value={groupId?.toString() ?? 'none'}
                        onValueChange={(v) => setGroupId(v === 'none' ? null : parseInt(v))}
                      >
                        <SelectTrigger className="hover:border-primary/50 transition-colors">
                          <SelectValue placeholder="Sin grupo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin grupo</SelectItem>
                          {groups.map((g: any) => (
                            <SelectItem key={g.id} value={g.id.toString()}>
                              <span className="flex items-center gap-2">
                                <span
                                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: g.color }}
                                />
                                {g.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* Sección: Descripción */}
            <div>
              <h3 className="text-sm font-medium mb-3">Descripción</h3>
              <Textarea
                id="description"
                placeholder="Descripción detallada de la tarea (opcional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="resize-none hover:border-primary/50 transition-colors"
              />
            </div>
            
            <Separator />
            
            {/* Sección: Etiquetas */}
            <div>
              <h3 className="text-sm font-medium mb-3">Etiquetas</h3>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  placeholder="Presiona Enter para agregar"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="flex-1 hover:border-primary/50 transition-colors"
                />
                <Button 
                  type="button" 
                  onClick={handleAddTag} 
                  variant="outline"
                  size="icon"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">
                      {t}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="ml-1.5 hover:bg-muted rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            <Separator />
            
            {/* Sección: Subtareas */}
            <div>
              <h3 className="text-sm font-medium mb-3">Subtareas</h3>
              <div className="flex gap-2">
                <Input
                  id="subtasks"
                  placeholder="Presiona Enter para agregar"
                  value={subtask}
                  onChange={(e) => setSubtask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSubtask();
                    }
                  }}
                  className="flex-1 hover:border-primary/50 transition-colors"
                />
                <Button 
                  type="button" 
                  onClick={handleAddSubtask} 
                  variant="outline"
                  size="icon"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {subtasks.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {subtasks.map((s) => (
                    <div 
                      key={s.id} 
                      className="flex items-center justify-between p-2 rounded-md border border-border hover:bg-muted/50"
                    >
                      <span className="text-sm">{s.title}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemoveSubtask(s.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <Separator />
            
            {/* Sección: Adjuntos */}
            <div>
              <h3 className="text-sm font-medium mb-3">Archivos Adjuntos</h3>
              <TaskFileUpload
                attachments={attachments}
                onChange={setAttachments}
                maxFiles={5}
                maxSizePerFile={10 * 1024 * 1024}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Máximo 5 archivos, 10MB por archivo
              </p>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetForm();
              onClose();
            }}
            disabled={creating}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleCreateTask}
            disabled={creating || !title.trim() || !assignedTo || !dueDate}
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              "Crear Tarea"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 