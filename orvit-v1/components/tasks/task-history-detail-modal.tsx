"use client";

import { useState, useEffect } from "react";
import { X, Calendar, User, Clock, FileText, Users, Building, Tag, MessageCircle, Trash2, Archive, Download, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { translateTag, getTagColor } from "@/lib/tag-utils";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface TaskHistoryItem {
  id: number;
  task: {
    id: number;
    title: string;
    description?: string;
    status: string;
    priority: string;
    dueDate?: string;
    assignedTo?: {
      id: number;
      name: string;
      email: string;
    };
    createdBy: {
      id: number;
      name: string;
      email: string;
    };
    company: {
      id: number;
      name: string;
    };
    companyId: number;
    tags?: string[];
    progress: number;
    createdAt: string;
    updatedAt: string;
    deletedBy: {
      id: number;
      name: string;
      email: string;
    };
    deletedAt: string;
    files?: {
      id: string;
      name: string;
      url: string;
      size?: number;
      type?: string;
      uploadedAt: string;
      uploadedBy?: {
        id: number;
        name: string;
        email: string;
      };
    }[];
    comments?: {
      id: string;
      content: string;
      userId: string;
      userName: string;
      userEmail: string;
      createdAt: string;
    }[];
  };
  deletedAt: Date;
  deletedBy: {
    id: number;
    name: string;
    email: string;
  };
}

interface TaskHistoryDetailModalProps {
  task: TaskHistoryItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskHistoryDetailModal({ task, isOpen, onClose }: TaskHistoryDetailModalProps) {
  const [activeTab, setActiveTab] = useState("detalles");
  const { toast } = useToast();

  // Los archivos y comentarios ya están incluidos en task.task.files y task.task.comments
  const taskFiles = task?.task?.files || [];
  const taskComments = task?.task?.comments || [];

  if (!task) return null;

  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'realizada':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'in-progress':
      case 'en-curso':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'pending':
      case 'pendiente':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
      case 'alta':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'medium':
      case 'media':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
      case 'baja':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'Alta';
      case 'medium':
        return 'Media';
      case 'low':
        return 'Baja';
      default:
        return priority;
    }
  };

  const getCurrentUserId = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userId') || '0';
    }
    return '0';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg" className="flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <DialogTitle className="text-xl font-semibold pr-6">
                {task.task.title}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <StatusBadge status={task.task.status} />
                <Badge className={getPriorityColor(task.task.priority)}>
                  {getPriorityText(task.task.priority)}
                </Badge>
                <Badge variant="destructive" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  <Trash2 className="h-3 w-3 mr-1" />
                  Eliminada
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1 min-h-0">
          <TabsList className="w-full flex border-b border-border bg-transparent pt-1 flex-shrink-0">
            <TabsTrigger value="detalles" className="flex-1 text-sm font-medium py-1 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary text-muted-foreground transition-colors">
              Detalles
            </TabsTrigger>
            <TabsTrigger value="archivos" className="flex-1 text-sm font-medium py-1 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary text-muted-foreground transition-colors">
              Archivos ({taskFiles.length})
            </TabsTrigger>
            <TabsTrigger value="comentarios" className="flex-1 text-sm font-medium py-1 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary text-muted-foreground transition-colors">
              Comentarios ({taskComments.length})
            </TabsTrigger>
          </TabsList>

          <DialogBody className="p-0">
            <TabsContent value="detalles" className="p-4 space-y-6">
              {/* Descripción */}
              {task.task.description && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-medium">Descripción</h3>
                  </div>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    {task.task.description}
                  </p>
                </div>
              )}

              <Separator />

              {/* Información General */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Asignación y Responsables
                  </h3>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <span className="text-muted-foreground">Creada por:</span>
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-medium">
                            {task.task.createdBy.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium">{task.task.createdBy.name}</span>
                      </div>
                    </div>

                    {task.task.assignedTo && (
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-muted-foreground">Asignada a:</span>
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
                            <span className="text-xs font-medium text-green-800">
                              {task.task.assignedTo.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium">{task.task.assignedTo.name}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <span className="text-muted-foreground">Empresa:</span>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{task.task.company.name}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Fechas y Progreso
                  </h3>
                  
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <span className="text-muted-foreground">Creada:</span>
                      <span className="font-medium">{formatDate(task.task.createdAt)}</span>
                    </div>

                    {task.task.dueDate && (
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-muted-foreground">Fecha límite:</span>
                        <span className="font-medium">{formatDate(task.task.dueDate)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <span className="text-muted-foreground">Progreso:</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300"
                            style={{ width: `${task.task.progress}%` }}
                          />
                        </div>
                        <span className="font-medium">{task.task.progress}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Etiquetas */}
              {task.task.tags && task.task.tags.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    Etiquetas
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {task.task.tags.map((tag, index) => (
                      <Badge 
                        key={index} 
                        variant="secondary" 
                        className={`text-xs px-3 py-1 font-semibold ${getTagColor(tag)}`}
                      >
                        {translateTag(tag)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Información de Eliminación */}
              <div className="space-y-3">
                <h3 className="font-medium flex items-center gap-2 text-red-600">
                  <Archive className="h-4 w-4" />
                  Información de Eliminación
                </h3>
                
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-red-700 dark:text-red-300">Eliminada por:</span>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                        <span className="text-xs font-medium text-red-800 dark:text-red-200">
                          {task.task.deletedBy.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-red-800 dark:text-red-200">
                        {task.task.deletedBy.name}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-red-700 dark:text-red-300">Fecha de eliminación:</span>
                    <span className="font-medium text-red-800 dark:text-red-200">
                      {formatDate(task.deletedAt)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-red-700 dark:text-red-300">ID original:</span>
                    <span className="font-mono text-sm font-medium text-red-800 dark:text-red-200">
                      #{task.task.id}
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="archivos" className="p-4 min-h-full">
              {activeTab === "archivos" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-muted rounded-md">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium">
                      Archivos adjuntos ({taskFiles.length})
                    </h3>
                  </div>
                  
                  {taskFiles.length === 0 ? (
                    <div className="text-center py-16">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <h3 className="text-lg font-medium text-foreground mb-2">Sin archivos adjuntos</h3>
                      <p className="text-muted-foreground">Esta tarea no tenía archivos adjuntos</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {taskFiles.map((file) => (
                        <div
                          key={file.id}
                          className="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-primary/10 rounded-md">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-sm truncate" title={file.name}>
                                {file.name}
                              </h4>
                              <p className="text-xs text-muted-foreground mt-1">
                                {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Tamaño desconocido'}
                              </p>
                              {file.uploadedBy && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Subido por: {file.uploadedBy.name}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(file.uploadedAt), "dd/MM/yyyy HH:mm", { locale: es })}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(file.url, '_blank')}
                              className="flex-1"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Descargar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="comentarios" className="p-4 min-h-full">
              {activeTab === "comentarios" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-muted rounded-md">
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium">
                      Historial de comentarios ({taskComments.length})
                    </h3>
                  </div>
                  
                  {taskComments.length === 0 ? (
                    <div className="text-center py-16">
                      <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <h3 className="text-lg font-medium text-foreground mb-2">Sin comentarios</h3>
                      <p className="text-muted-foreground">Esta tarea no tenía comentarios</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {taskComments.map((comment) => (
                        <div 
                          key={comment.id}
                          className="bg-card border border-border rounded-lg p-4"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xs font-medium">
                                {comment.userName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="font-medium text-sm">{comment.userName}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(comment.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed pl-8">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </DialogBody>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
} 