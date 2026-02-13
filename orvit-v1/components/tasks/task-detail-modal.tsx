"use client";

import { useState, useEffect } from "react";
import { X, Calendar, User, Tag, CheckCircle, Clock, FileText, MessageCircle, Download, Send, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { useTaskStore, Task } from "@/hooks/use-task-store";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { translateTag, getTagColor } from "@/lib/tag-utils";

// Interfaces para el chat
interface ChatMessage {
  id: string;
  content: string;
  userId: string;
  userName: string;
  userEmail: string;
  createdAt: string;
}

// Componente PriorityBadge usando colores del sistema
function PriorityBadge({ priority }: { priority: string }) {
  const getColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'alta':
      case 'high': 
        return 'text-red-500';
      case 'media':
      case 'medium': 
        return 'text-yellow-500';
      case 'baja':
      case 'low': 
        return 'text-green-500';
      default: 
        return 'text-gray-500';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'alta':
      case 'high':
        return 'Alta';
      case 'media':
      case 'medium':
        return 'Media';
      case 'baja':
      case 'low':
        return 'Baja';
      default:
        return priority;
    }
  };

  return (
    <span className={`text-xs font-medium ${getColor(priority)}`}>
      {getPriorityText(priority)}
    </span>
  );
}

// Componente ProgressBar usando colores del sistema
function ProgressBar({ value, showLabel = true }: { 
  value: number; 
  showLabel?: boolean;
}) {
  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span>Progreso</span>
          <span className="font-medium">{value}%</span>
        </div>
      )}
      <div className="w-full bg-muted rounded-full h-2">
        <div 
          className="bg-primary h-2 rounded-full transition-all duration-300" 
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// Componente InfoCard usando colores del sistema
function InfoCard({ icon: Icon, label, value }: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-muted rounded-md">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-sm font-medium truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function TaskDetailModal() {
  const { selectedTask, setSelectedTask, updateTask } = useTaskStore();
  const { toast } = useToast();
  const [taskDetails, setTaskDetails] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("detalles");
  
  // Estados para el chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    if (selectedTask) {
      // Fetch detalles completos de la tarea
      const fetchTaskDetails = async () => {
        setLoading(true);
        try {
          const response = await fetch(`/api/tasks/${selectedTask.id}`);
          if (response.ok) {
            const details = await response.json();
            setTaskDetails(details);
            setChatMessages(details.comments || []);
          }
        } catch (error) {
          console.error('Error fetching task details:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchTaskDetails();
    } else {
      // Limpiar estado cuando no hay tarea seleccionada
      setTaskDetails(null);
      setChatMessages([]);
      setNewMessage("");
      setActiveTab("detalles");
    }
  }, [selectedTask]);

  // Obtener usuario actual
  const getCurrentUserId = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userId') || '0';
    }
    return '0';
  };

  const isAssignedUser = () => {
    const currentUserId = getCurrentUserId();
    return String(task?.assignedTo?.id) === String(currentUserId);
  };

  const fetchTaskDetails = async (taskId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tasks/${taskId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const details = await response.json();
      setTaskDetails(details);
    } catch (error) {
      console.error('Error fetching task details:', error);
      setTaskDetails(selectedTask);
    } finally {
      setLoading(false);
    }
  };

  const fetchChatMessages = async (taskId: string) => {
    try {
      setLoadingChat(true);
      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const messages = await response.json();
        setChatMessages(messages);
      } else {
        setChatMessages([]);
      }
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      setChatMessages([]);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleToggleSubtask = async (subtaskId: string) => {
    if (!isAssignedUser() || !task) {
      toast({
        variant: "destructive",
        title: "Sin permisos",
        description: "Solo el usuario asignado puede modificar las subtareas.",
      });
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${task.id}/subtasks/${subtaskId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          completed: !task.subtasks.find(st => st.id === subtaskId)?.completed
        }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar subtarea');
      }

      const updatedTask = {
        ...task,
        subtasks: task.subtasks.map(st => 
          st.id === subtaskId 
            ? { ...st, completed: !st.completed }
            : st
        )
      };

      setTaskDetails(updatedTask);
      updateTask(task.id, updatedTask);

      toast({
        title: "Subtarea actualizada",
        description: "La subtarea se ha actualizado correctamente.",
      });
    } catch (error) {
      console.error('Error updating subtask:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar la subtarea.",
      });
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !task) return;

    try {
      setSendingMessage(true);
      const response = await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newMessage.trim()
        }),
      });

      if (response.ok) {
        const newMsg = await response.json();
        setChatMessages(prev => [...prev, newMsg]);
        setNewMessage("");
        
        toast({
          title: "Mensaje enviado",
          description: "Tu mensaje se ha enviado correctamente.",
        });
      } else {
        throw new Error('Error al enviar mensaje');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo enviar el mensaje.",
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleClose = () => {
    setSelectedTask(null);
    setTaskDetails(null);
  };

  if (!selectedTask) return null;

  const task = taskDetails || selectedTask;

  // Calcular progreso de subtareas
  const getSubtasksProgress = () => {
    if (!task.subtasks || task.subtasks.length === 0) return 0;
    const completed = task.subtasks.filter(st => st.completed).length;
    return Math.round((completed / task.subtasks.length) * 100);
  };

  return (
    <Dialog open={!!selectedTask} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        size="md"
        className="flex flex-col"
        aria-describedby="task-detail-description"
      >
        {/* Header minimalista y compacto */}
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-semibold mb-1 tracking-tight leading-tight">
                {task.title}
              </DialogTitle>
              <div className="flex items-center gap-1 flex-wrap mt-0.5">
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
                {task.tags && task.tags.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                    +{task.tags.length} etiquetas
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs compactos */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1 min-h-0">
          <TabsList className="w-full flex border-b border-border bg-transparent pt-1 flex-shrink-0">
            <TabsTrigger value="detalles" className="flex-1 text-sm font-medium py-1 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary text-muted-foreground transition-colors">
              Detalles
            </TabsTrigger>
            <TabsTrigger value="archivos" className="flex-1 text-sm font-medium py-1 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary text-muted-foreground transition-colors">
              Archivos ({task.files?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex-1 text-sm font-medium py-1 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary text-muted-foreground transition-colors">
              Chat ({chatMessages.length})
            </TabsTrigger>
          </TabsList>

          <DialogBody className="p-0">
            <TabsContent value="detalles" className="p-4 space-y-0 min-h-full">
              {/* Info principal refinada */}
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-border">
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Asignado a</div>
                  <div className="text-sm font-medium">{task.assignedTo?.name || 'Sin asignar'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Solicitante</div>
                  <div className="text-sm font-medium">{task.createdBy?.name || 'Sin especificar'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Fecha límite</div>
                  <div className="text-sm font-medium">{task.dueDate ? format(new Date(task.dueDate), 'dd MMM yyyy', { locale: es }) : 'Sin fecha límite'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold mb-0.5">Fecha creación</div>
                  <div className="text-sm font-medium">{format(new Date(task.createdAt), 'dd MMM yyyy', { locale: es })}</div>
                </div>
              </div>

              {/* Descripción refinada */}
              {task.description && (
                <div className="pt-4 pb-2 border-b border-border">
                  <div className="text-xs text-muted-foreground uppercase font-semibold mb-1 tracking-wide">Descripción</div>
                  <div className="text-sm text-foreground/90">
                    {task.description}
                  </div>
                </div>
              )}

              {/* Etiquetas refinadas */}
              {task.tags && task.tags.length > 0 && (
                <div className="pt-4 pb-2 border-b border-border">
                  <div className="text-xs text-muted-foreground uppercase font-semibold mb-1 tracking-wide">Etiquetas</div>
                  <div className="flex flex-wrap gap-1">
                    {task.tags.map((tag) => (
                      <Badge 
                        key={tag} 
                        variant="secondary" 
                        className={`text-xs px-1.5 py-0.5 ${getTagColor(tag)}`}
                      >
                        #{translateTag(tag)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Subtareas refinadas */}
              {task.subtasks && task.subtasks.length > 0 && (
                <div className="pt-4 pb-2">
                  <div className="text-xs text-muted-foreground uppercase font-semibold mb-1 tracking-wide">Subtareas</div>
                  <div className="mb-1">
                    <ProgressBar value={getSubtasksProgress()} />
                  </div>
                  <div className="space-y-1">
                    {task.subtasks.map((subtask) => (
                      <div key={subtask.id} className="flex items-center gap-2 py-0.5">
                        <Checkbox
                          checked={subtask.completed}
                          onCheckedChange={() => handleToggleSubtask(subtask.id)}
                          disabled={!isAssignedUser()}
                          className="h-4 w-4"
                        />
                        <span className={`text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>{subtask.title}</span>
                        {!isAssignedUser() && (
                          <span className="ml-auto text-xs text-muted-foreground">Solo el asignado puede modificar</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="archivos" className="p-4 min-h-full">
              {task.files && task.files.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-muted rounded-md">
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium">
                      Archivos adjuntos ({task.files.length})
                    </h3>
                  </div>
                  
                  {task.files.map((file) => (
                    <div 
                      key={file.id} 
                      className="bg-card border border-border rounded-lg p-6 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-muted rounded-md">
                            <FileText className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div>
                            <h4 className="font-medium text-base">{file.name}</h4>
                            {file.size && (
                              <p className="text-sm text-muted-foreground">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(file.url, '_blank')}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Descargar
                          </Button>
                          {file.url.match(/\.(pdf|doc|docx|txt)$/i) && (
                            <Button
                              size="sm"
                              onClick={() => window.open(file.url, '_blank')}
                            >
                              Ver archivo
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="p-4 bg-muted rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <FileText className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No hay archivos adjuntos</h3>
                  <p className="text-muted-foreground">Los archivos adjuntos aparecerán aquí</p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="chat" className="p-4 min-h-full flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-muted rounded-md">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">
                  Chat interno ({chatMessages.length} mensajes)
                </h3>
              </div>
              
              <div className="flex-1 bg-muted/50 border border-border rounded-lg p-4 mb-4 overflow-y-auto">
                {loadingChat ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <p className="text-sm text-muted-foreground mt-3">Cargando mensajes...</p>
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="p-3 bg-muted rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                      <MessageCircle className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h4 className="text-lg font-medium mb-2">No hay mensajes aún</h4>
                    <p className="text-muted-foreground">Sé el primero en escribir un mensaje</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatMessages.map((message) => {
                      const isOwnMessage = message.userId === getCurrentUserId();
                      return (
                        <div 
                          key={message.id}
                          className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg border ${
                            isOwnMessage 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-card border-border'
                          }`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-medium ${
                                isOwnMessage ? 'text-primary-foreground/80' : 'text-muted-foreground'
                              }`}>
                                {message.userName}
                              </span>
                              <span className={`text-xs ${
                                isOwnMessage ? 'text-primary-foreground/60' : 'text-muted-foreground/60'
                              }`}>
                                {format(new Date(message.createdAt), "HH:mm", { locale: es })}
                              </span>
                            </div>
                            <p className="text-sm leading-relaxed">{message.content}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 bg-card border border-border rounded-lg p-3">
                <Input
                  placeholder="Escribe un mensaje..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  disabled={sendingMessage}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !newMessage.trim()}
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>
          </DialogBody>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
} 