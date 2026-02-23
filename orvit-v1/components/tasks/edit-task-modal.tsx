"use client";

import { useState, useEffect } from "react";
import { CalendarIcon, Plus, X, Loader2 } from "lucide-react";
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
import { formatDate } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { Task } from "@/hooks/use-task-store";
import { TaskFileUpload, TaskFileAttachment } from "@/components/ui/TaskFileUpload";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  name: string;
  email: string;
}

interface EditTaskModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: (task: Task) => void;
}

export function EditTaskModal({ task, isOpen, onClose, onTaskUpdated }: EditTaskModalProps) {
  const { toast } = useToast();
  
  const [title, setTitle] = useState("");
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
  const [updating, setUpdating] = useState(false);
  const [errors, setErrors] = useState<{
    title?: string;
    assignedTo?: string;
    dueDate?: string;
  }>({});

  // Cargar datos de la tarea cuando se abre el modal
  useEffect(() => {
    if (task && isOpen) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setAssignedTo(task.assignedTo?.id ? String(task.assignedTo.id) : "");
      setPriority(task.priority || "media");
      setDueDate(task.dueDate ? new Date(task.dueDate) : undefined);
      setTags(task.tags || []);
      setSubtasks(
        task.subtasks?.map((st) => ({
          id: String(st.id),
          title: st.title || "",
          completed: st.completed || false,
        })) || []
      );
      // Convertir archivos a TaskFileAttachment si existen
      if (task.files && task.files.length > 0) {
        setAttachments(
          task.files.map((f: any) => ({
            id: f.id || Math.random().toString(),
            name: f.name || f.filename || "Archivo",
            size: f.size || 0,
            url: f.url || f.path || "",
            type: f.type || f.mimetype || "application/octet-stream",
          }))
        );
      } else {
        setAttachments([]);
      }
    }
  }, [task, isOpen]);

  useEffect(() => {
    if (isOpen) {
      const loadUsers = async () => {
        try {
          setLoadingUsers(true);
          
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
          
          if (Array.isArray(data)) {
            setUsers(data);
          } else {
            setUsers([]);
          }
        } catch (error) {
          console.error('Error loading users:', error);
          setUsers([]);
        } finally {
          setLoadingUsers(false);
        }
      };

      loadUsers();
    } else {
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

  const handleUpdateTask = async () => {
    if (updating) {
      return;
    }

    if (!validate()) {
      return;
    }

    setUpdating(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        assignedToId: assignedTo,
        priority,
        dueDate: dueDate?.toISOString(),
        tags,
        subtasks: subtasks.map((st) => ({
          id: st.id,
          title: st.title,
          completed: st.completed,
        })),
        attachments,
      };

      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('token') || 'mock-token'}`
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || "Error al actualizar la tarea");
      }
      
      const updatedTask = await response.json();

      toast({ 
        title: "Tarea actualizada", 
        description: "La tarea fue actualizada exitosamente." 
      });
      
      onTaskUpdated(updatedTask);
      
      setTimeout(() => {
        onClose();
      }, 100);
    } catch (error) {
      console.error('Error al actualizar tarea:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo actualizar la tarea",
      });
    } finally {
      setUpdating(false);
    }
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
        onClose();
      }
    }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Editar Tarea</DialogTitle>
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
            onClick={onClose}
            disabled={updating}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleUpdateTask}
            disabled={updating || !title.trim() || !assignedTo || !dueDate}
          >
            {updating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Actualizando...
              </>
            ) : (
              "Actualizar Tarea"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
