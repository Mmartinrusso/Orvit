"use client";

import { useState, useEffect, useMemo } from "react";
import {
  CheckCircle2,
  Clock,
  Calendar,
  User,
  FileText,
  Paperclip,
  Tag,
  Edit,
  Trash2,
  RotateCcw,
  MessageCircle,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Task } from "@/hooks/use-task-store";
import { toZonedTime } from "date-fns-tz";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: string;
  content: string;
  userId: string;
  userName: string;
  userEmail: string;
  createdAt: string;
}

const ARG_TIMEZONE = "America/Argentina/Buenos_Aires";

function formatDateArg(dateStr: string | undefined) {
  if (!dateStr) return "-";
  const zoned = toZonedTime(new Date(dateStr), ARG_TIMEZONE);
  return zoned.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | undefined) {
  if (!dateStr) return "-";
  const zoned = toZonedTime(new Date(dateStr), ARG_TIMEZONE);
  return zoned.toLocaleString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name?: string) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "—";
}

function PriorityBadge({ priority }: { priority: string }) {
  const getColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "alta":
      case "urgente":
        return "text-red-500";
      case "media":
        return "text-yellow-500";
      case "baja":
        return "text-green-500";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <Badge variant="outline" className={cn("text-xs", getColor(priority))}>
      {priority === "alta" ? "Alta" : priority === "media" ? "Media" : "Baja"}
    </Badge>
  );
}

interface TaskDetailPanelProps {
  task: Task | null;
  onComplete: () => void;
  onReopen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  onUpdateSubtask?: (taskId: string, subtaskId: string, completed: boolean) => void;
}

export function TaskDetailPanel({
  task,
  onComplete,
  onReopen,
  onEdit,
  onDelete,
  canEdit = false,
  canDelete = false,
  onUpdateSubtask,
}: TaskDetailPanelProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("detalles");
  const { toast } = useToast();
  
  // Estados para el chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Cargar mensajes cuando cambia la tarea o se abre el tab de chat
  useEffect(() => {
    if (task && activeTab === "chat") {
      fetchChatMessages();
    }
  }, [task?.id, activeTab]);

  const fetchChatMessages = async () => {
    if (!task) return;
    try {
      setLoadingChat(true);
      const response = await fetch(`/api/tasks/${task.id}/comments`, {
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

  const getCurrentUserId = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userId') || '0';
    }
    return '0';
  };

  // Usar useMemo para recalcular el progreso cuando cambien las subtareas
  // Debe estar antes del early return para cumplir las reglas de hooks
  const subtasksProgress = useMemo(() => {
    if (!task || !task.subtasks || task.subtasks.length === 0) return 0;
    const completed = task.subtasks.filter((s) => s.completed || s.done).length;
    return Math.round((completed / task.subtasks.length) * 100);
  }, [task?.subtasks]);

  const isCompleted = task?.status === "realizada";

  if (!task) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center">
        <div>
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">
            Seleccioná una tarea para ver detalles
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col border border-border bg-background rounded-lg">
        {/* Header Sticky */}
        <div className="p-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold leading-tight mb-1">{task.title}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />
                {task.dueDate && (
                  <Badge variant="outline" className="text-xs">
                    {formatDateArg(task.dueDate)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {task.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-4 pt-2 pb-2 shrink-0">
            <div className="bg-muted/40 border border-border rounded-md p-0.5">
              <TabsList className="w-full h-7 bg-transparent border-0 shadow-none">
                <TabsTrigger value="detalles" className="text-xs font-normal h-6 px-2 flex-1 data-[state=active]:bg-background data-[state=active]:shadow-sm">Detalles</TabsTrigger>
                {task.subtasks && task.subtasks.length > 0 && (
                  <TabsTrigger value="subtareas" className="text-xs font-normal h-6 px-2 flex-1 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    Subtareas ({task.subtasks.filter((s) => s.completed || s.done).length}/{task.subtasks.length})
                  </TabsTrigger>
                )}
                <TabsTrigger value="archivos" className="text-xs font-normal h-6 px-2 flex-1 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Archivos {task.files && task.files.length > 0 ? `(${task.files.length})` : ''}
                </TabsTrigger>
                <TabsTrigger value="chat" className="text-xs font-normal h-6 px-2 flex-1 data-[state=active]:bg-background data-[state=active]:shadow-sm">Chat</TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 flex flex-col">
            {activeTab === "chat" ? (
              // Chat fuera del ScrollArea
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="px-4 pt-4 pb-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-muted rounded-md">
                      <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-medium text-foreground">
                      Chat interno ({chatMessages.length} {chatMessages.length === 1 ? 'mensaje' : 'mensajes'})
                    </h3>
                  </div>
                </div>
                
                <div className="flex-1 min-h-0 bg-muted/50 border-x-0 border-y border-border px-4 py-4 overflow-y-auto">
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
                    <div className="space-y-3">
                      {chatMessages.map((message) => {
                        const isOwnMessage = message.userId === getCurrentUserId();
                        return (
                          <div 
                            key={message.id}
                            className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[75%] px-3 py-2 rounded-lg ${
                              isOwnMessage 
                                ? 'bg-primary text-primary-foreground' 
                                : 'bg-card border border-border'
                            }`}>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-[11px] font-medium ${
                                  isOwnMessage ? 'text-primary-foreground/80' : 'text-muted-foreground'
                                }`}>
                                  {message.userName}
                                </span>
                                <span className={`text-[11px] ${
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
                
                <div className="px-4 pt-3 pb-4 shrink-0">
                  <div className="flex gap-2 bg-card border border-border rounded-lg p-2.5">
                    <Input
                      placeholder="Escribe un mensaje..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                      disabled={sendingMessage}
                      className="flex-1 h-9 text-sm"
                    />
                    <Button 
                      onClick={handleSendMessage}
                      disabled={sendingMessage || !newMessage.trim()}
                      size="sm"
                      className="h-9 w-9 p-0"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              // Otros tabs dentro del ScrollArea
              <ScrollArea className="flex-1">
                <div className="p-4">
                  <TabsContent value="detalles" className="mt-0 space-y-4">
                    {/* Metadatos en grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Asignado a</div>
                        <div className="text-sm font-medium">
                          {task.assignedTo?.name || "Sin asignar"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Solicitante</div>
                        <div className="text-sm font-medium">
                          {task.createdBy?.name || task.requester?.name || "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Creada</div>
                        <div className="text-sm font-medium">{formatDateArg(task.createdAt)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Actualizada</div>
                        <div className="text-sm font-medium">{formatDateTime(task.updatedAt)}</div>
                      </div>
                      {task.dueDate && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Fecha límite</div>
                          <div className="text-sm font-medium">{formatDateArg(task.dueDate)}</div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Descripción */}
                    {task.description ? (
                      <div className="w-full min-w-0 max-w-full">
                        <h3 className="text-sm font-medium mb-2">Descripción</h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed break-all max-w-full" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                          {task.description}
                        </p>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground italic">
                        Sin descripción
                      </div>
                    )}
                  </TabsContent>

                  {/* Subtareas Tab */}
                  {task.subtasks && task.subtasks.length > 0 && (
                    <TabsContent value="subtareas" className="mt-0">
                      <div className="pt-4 pb-2">
                        <div className="text-sm font-medium text-foreground mb-1">
                          Subtareas
                        </div>
                        <div className="mb-1">
                          <div className="w-full">
                            <div className="flex justify-between text-xs text-muted-foreground mb-2">
                              <span>Progreso</span>
                              <span className="font-medium">{subtasksProgress}%</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full transition-all duration-300"
                                style={{ width: `${subtasksProgress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          {task.subtasks.map((subtask) => {
                            const isCompleted = subtask.completed || subtask.done;
                            return (
                              <div
                                key={subtask.id}
                                className="flex items-center gap-2 py-0.5"
                              >
                                <Checkbox
                                  checked={isCompleted}
                                  onCheckedChange={(checked) => {
                                    if (onUpdateSubtask) {
                                      onUpdateSubtask(task.id, subtask.id, checked === true);
                                    }
                                  }}
                                  disabled={!onUpdateSubtask}
                                  className="h-4 w-4"
                                />
                                <span
                                  className={cn(
                                    "text-sm",
                                    isCompleted && "line-through text-muted-foreground"
                                  )}
                                >
                                  {subtask.title}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </TabsContent>
                  )}

                  {/* Archivos Tab */}
                  <TabsContent value="archivos" className="mt-0">
                    {task.files && task.files.length > 0 ? (
                      <div className="space-y-2">
                        {task.files.map((file) => (
                          <a
                            key={file.id}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 rounded-md border border-border hover:bg-muted/50 transition-colors"
                          >
                            <div className="p-2 bg-muted rounded-md">
                              <Paperclip className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{file.name}</div>
                              {file.size && (
                                <div className="text-xs text-muted-foreground">
                                  {(file.size / 1024).toFixed(1)} KB
                                </div>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.preventDefault();
                                window.open(file.url, "_blank");
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Paperclip className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground">
                          No hay archivos adjuntos
                        </p>
                      </div>
                    )}
                  </TabsContent>
                </div>
              </ScrollArea>
            )}
          </div>
        </Tabs>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border shrink-0 space-y-2">
          {!isCompleted ? (
            <Button
              onClick={onComplete}
              className="w-full"
              size="sm"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Completar tarea
            </Button>
          ) : (
            <Button
              onClick={onReopen}
              variant="outline"
              className="w-full"
              size="sm"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reabrir tarea
            </Button>
          )}
          <div className="flex gap-2">
            {canEdit && (
              <Button
                onClick={onEdit}
                variant="outline"
                className="flex-1"
                size="sm"
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            )}
            {canDelete && (
              <Button
                onClick={() => setIsDeleteDialogOpen(true)}
                variant="outline"
                className="flex-1 text-destructive hover:text-destructive"
                size="sm"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La tarea será eliminada
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete();
                setIsDeleteDialogOpen(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

