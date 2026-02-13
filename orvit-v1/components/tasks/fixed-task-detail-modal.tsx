"use client";

import { useState, useEffect } from "react";
import { 
  Clock, FileText, Users, Calendar, Download, ExternalLink, 
  CheckCircle, AlertCircle, Target, Building2, Play, Pause,
  Edit, Copy, History, Settings, Plus, X, RefreshCw, Trash2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { usePermissionRobust } from '@/hooks/use-permissions-robust';

interface FixedTask {
  id: string;
  title: string;
  description: string;
  frequency: 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'trimestral' | 'semestral' | 'anual';
  assignedTo: {
    id: string;
    name: string;
  };
  department: string;
  instructives: {
    id: string;
    title: string;
    content: string;
    attachments?: {
      url: string;
      name: string;
      size: number;
      type: string;
    }[];
  }[];
  estimatedTime: number;
  priority: 'baja' | 'media' | 'alta';
  isActive: boolean;
  lastExecuted?: string;
  nextExecution: string;
  createdAt: string;
  completedAt?: string;
  isCompleted?: boolean;
}

interface FixedTaskDetailModalProps {
  task: FixedTask | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: () => void;
  onEdit?: (task: FixedTask) => void;
  onExecute?: (task: FixedTask) => void;
  onToggleStatus?: (task: FixedTask) => void;
}

interface ExecutionHistory {
  id: string;
  executedAt: string;
  executedBy: string;
  duration: number;
  status: string;
  notes: string;
  attachments: string[];
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'alta': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800/50';
    case 'media': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800/50';
    case 'baja': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/50';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

function getFrequencyLabel(frequency: string) {
  const labels = {
    'diaria': 'Diaria',
    'semanal': 'Semanal',
    'quincenal': 'Quincenal',
    'mensual': 'Mensual',
    'trimestral': 'Trimestral',
    'semestral': 'Semestral',
    'anual': 'Anual'
  };
  return labels[frequency as keyof typeof labels] || frequency;
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours} horas`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric'
  });
}

// Función para obtener historial de ejecuciones desde la API
const fetchExecutionHistory = async (taskId: string): Promise<ExecutionHistory[]> => {
  try {
    const response = await fetch(`/api/fixed-tasks/${taskId}/executions`);
    
    if (!response.ok) {
      console.error('Error fetching execution history:', response.status);
      return [];
    }
    
    const data = await response.json();
    return data.executions || [];
  } catch (error) {
    console.error('Error fetching execution history:', error);
    return [];
  }
};

export function FixedTaskDetailModal({ 
  task, 
  isOpen, 
  onClose, 
  onTaskUpdated,
  onEdit,
  onExecute,
  onToggleStatus
}: FixedTaskDetailModalProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const { toast } = useToast();
  const { hasPermission: canEditFixedTask } = usePermissionRobust('editar_tarea_fija');
  const { hasPermission: canDeleteFixedTask } = usePermissionRobust('eliminar_tarea_fija');
  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddCommentModal, setShowAddCommentModal] = useState(false);

  // Cargar historial cuando se abre el modal o cambia la tarea
  useEffect(() => {
    if (task && isOpen) {
      loadExecutionHistory();
      // fetchExecutions();
    }
  }, [task?.id, isOpen]);

  const loadExecutionHistory = async () => {
    if (!task) return;
    
    setLoadingHistory(true);
    try {
      const history = await fetchExecutionHistory(task.id);
      setExecutionHistory(history);
    } catch (error) {
      console.error('Error loading execution history:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar el historial de ejecuciones",
        variant: "destructive",
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  // const fetchExecutions = async () => {
  //   if (!task) return;
    
  //   try {
  //     const response = await fetch(`/api/fixed-tasks/${task.id}/executions`);
  //     if (response.ok) {
  //       const data = await response.json();
  //       setExecutions(data);
  //     }
  //   } catch (error) {
  //     console.error('Error fetching executions:', error);
  //   }
  // };

  const handleSyncHistory = async () => {
    toast({
      title: "Sincronizando...",
      description: "Actualizando historial de ejecuciones",
    });

    await loadExecutionHistory();

    toast({
      title: "Historial sincronizado",
      description: `${executionHistory.length} ejecuciones encontradas`,
    });
  };

  const handleEdit = () => {
    setShowEditModal(true);
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const handleAddComment = () => {
    setShowAddCommentModal(true);
  };

  const handleTaskUpdated = () => {
    onTaskUpdated();
    setShowEditModal(false);
  };

  const handleTaskDeleted = () => {
    onTaskUpdated();
    setShowDeleteModal(false);
    onClose();
  };

  const handleCommentAdded = () => {
    onTaskUpdated();
    setShowAddCommentModal(false);
  };

  if (!task) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent size="lg" className="flex flex-col [&>button]:hidden">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <DialogTitle className="text-xl font-semibold">
                  {task.title}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={getPriorityColor(task.priority)}
                  >
                    Prioridad {task.priority}
                  </Badge>
                  <Badge variant="outline">
                    {getFrequencyLabel(task.frequency)}
                  </Badge>
                  <Badge variant="outline">
                    {task.department}
                  </Badge>
                  <Badge 
                    variant={task.isActive ? "default" : "destructive"}
                  >
                    {task.isActive ? "Activa" : "Inactiva"}
                  </Badge>
                  {task.isCompleted && (
                    <Badge 
                      variant="outline" 
                      className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800/50"
                    >
                      ✅ Completada
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2 items-start">
                {canEditFixedTask && onEdit && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleEdit}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                )}
                {canDeleteFixedTask && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </Button>
                )}
                {onExecute && task.isActive && !task.isCompleted && String(task.assignedTo.id) === String(currentUserId) && (
                  <Button 
                    size="sm"
                    onClick={() => onExecute(task)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Completar Tarea
                  </Button>
                )}
                {task.isCompleted && (
                  <Button 
                    size="sm"
                    variant="outline"
                    disabled
                    className="text-green-600 dark:text-green-400"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Completada
                  </Button>
                )}
                {onToggleStatus && canEditFixedTask && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onToggleStatus(task)}
                  >
                    {task.isActive ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                    {task.isActive ? "Desactivar" : "Activar"}
                  </Button>
                )}
                
                {/* Botón de cerrar personalizado */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="shrink-0 h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-4 w-fit">
                <TabsTrigger value="overview">Resumen</TabsTrigger>
                <TabsTrigger value="instructives">
                  Instructivos ({task.instructives.length})
                </TabsTrigger>
                <TabsTrigger value="schedule">Programación</TabsTrigger>
                <TabsTrigger value="history">Historial</TabsTrigger>
            </TabsList>

            <DialogBody>
              <TabsContent value="overview" className="space-y-6 mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Información General
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-1">Descripción</h4>
                        <p className="text-foreground">{task.description}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-1 flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            Asignado a
                          </h4>
                          <p className="text-foreground">{task.assignedTo.name}</p>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-1 flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Tiempo estimado
                          </h4>
                          <p className="text-foreground">{formatTime(task.estimatedTime)}</p>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-1 flex items-center gap-1">
                            <Building2 className="h-4 w-4" />
                            Departamento
                          </h4>
                          <p className="text-foreground">{task.department}</p>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-1 flex items-center gap-1">
                            <Target className="h-4 w-4" />
                            Frecuencia
                          </h4>
                          <p className="text-foreground">{getFrequencyLabel(task.frequency)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Programación
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {task.lastExecuted && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-1">Última ejecución</h4>
                          <p className="text-foreground">{formatDate(task.lastExecuted)}</p>
                        </div>
                      )}
                      
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-1">Próxima ejecución</h4>
                        <p className="text-foreground font-medium">{formatDate(task.nextExecution)}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-1">Creada el</h4>
                        <p className="text-foreground">{formatDate(task.createdAt)}</p>
                      </div>
                      
                      {task.completedAt && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-1">Completada el</h4>
                          <p className="text-foreground font-medium text-green-600 dark:text-green-400">
                            {formatDate(task.completedAt)}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="instructives" className="space-y-4 mt-0">
                  {task.instructives.map((instructive, index) => (
                    <Card key={instructive.id}>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          {instructive.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium text-sm text-muted-foreground mb-2">
                              Procedimiento paso a paso:
                            </h4>
                            <div className="bg-muted/50 rounded-lg p-4 border">
                              <pre className="whitespace-pre-wrap text-sm text-foreground font-mono">
                                {instructive.content}
                              </pre>
                            </div>
                          </div>
                          
                          {instructive.attachments && instructive.attachments.length > 0 && (
                            <div>
                              <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center gap-1">
                                <Download className="h-4 w-4" />
                                Archivos adjuntos:
                              </h4>
                              <div className="space-y-2">
                                {instructive.attachments.map((attachment, attachIndex) => (
                                  <div 
                                    key={attachIndex}
                                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
                                  >
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-4 w-4 text-primary" />
                                      <div>
                                        <span className="text-sm font-medium text-foreground">{attachment.name}</span>
                                        {attachment.size > 0 && (
                                          <span className="text-xs text-muted-foreground ml-2">
                                            ({(attachment.size / 1024 / 1024).toFixed(2)} MB)
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="h-8 px-2"
                                        onClick={() => window.open(attachment.url, '_blank')}
                                      >
                                        <Download className="h-3 w-3" />
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="h-8 px-2"
                                        onClick={() => window.open(attachment.url, '_blank')}
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {task.instructives.length === 0 && (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                        <h3 className="text-lg font-medium text-foreground mb-2">
                          Sin instructivos
                        </h3>
                        <p className="text-muted-foreground mb-4">
                          Esta tarea no tiene instructivos definidos
                        </p>
                        {onEdit && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              onClose();
                              onEdit(task);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Agregar instructivo
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                
                <TabsContent value="schedule" className="space-y-4 mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Configuración de programación
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-1">Frecuencia</h4>
                          <p className="text-foreground">{getFrequencyLabel(task.frequency)}</p>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-1">Estado</h4>
                          <Badge variant={task.isActive ? "default" : "destructive"}>
                            {task.isActive ? "Activa" : "Inactiva"}
                          </Badge>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-1">Próxima ejecución</h4>
                          <p className="text-foreground font-medium">{formatDate(task.nextExecution)}</p>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-1">Tiempo estimado</h4>
                          <p className="text-foreground">{formatTime(task.estimatedTime)}</p>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="flex gap-2">
                        <Button variant="outline">
                          <Edit className="h-4 w-4 mr-1" />
                          Modificar programación
                        </Button>
                        <Button variant="outline">
                          <Copy className="h-4 w-4 mr-1" />
                          Duplicar tarea
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="history" className="space-y-4 mt-0">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <History className="h-5 w-5" />
                          Historial de ejecuciones
                        </CardTitle>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleAddComment}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Agregar Comentario
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {loadingHistory ? (
                        <div className="flex items-center justify-center h-[200px]">
                          <div className="text-center">
                            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                            <p className="text-muted-foreground">Cargando historial...</p>
                          </div>
                        </div>
                      ) : executionHistory.length === 0 ? (
                        <div className="text-center py-8">
                          <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                          <h3 className="text-lg font-medium text-foreground mb-2">
                            Sin ejecuciones registradas
                          </h3>
                          <p className="text-muted-foreground">
                            Esta tarea no tiene ejecuciones registradas aún
                          </p>
                        </div>
                      ) : (
                        <ScrollArea className="h-[400px]">
                          <div className="space-y-4">
                            {executionHistory.map((execution: ExecutionHistory) => (
                            <div key={execution.id} className="border rounded-lg p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    <span className="font-medium text-sm text-foreground">
                                      Ejecutado por {execution.executedBy}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDate(execution.executedAt)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium text-foreground">
                                    {execution.duration} min
                                  </p>
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800/50"
                                  >
                                    Completado
                                  </Badge>
                                </div>
                              </div>
                              
                              {execution.notes && (
                                <div className="mb-3">
                                  <h5 className="text-xs font-medium text-muted-foreground mb-1">Notas:</h5>
                                  <p className="text-sm text-foreground bg-muted/50 p-2 rounded border">
                                    {execution.notes}
                                  </p>
                                </div>
                              )}
                              
                              {execution.attachments && execution.attachments.length > 0 && (
                                <div>
                                  <h5 className="text-xs font-medium text-muted-foreground mb-2">Archivos:</h5>
                                  <div className="flex flex-wrap gap-2">
                                    {execution.attachments.map((fileName, index) => (
                                      <div 
                                        key={index}
                                        className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800/50"
                                      >
                                        <FileText className="h-3 w-3" />
                                        {fileName}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
            </DialogBody>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Modales */}
      {/* {showEditModal && (
        <EditFixedTaskModal
          task={task}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onTaskUpdated={handleTaskUpdated}
        />
      )}

      {showDeleteModal && (
        <DeleteFixedTaskModal
          task={task}
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onTaskDeleted={handleTaskDeleted}
        />
      )}

      {showAddCommentModal && (
        <AddCommentModal
          taskId={task.id}
          isOpen={showAddCommentModal}
          onClose={() => setShowAddCommentModal(false)}
          onCommentAdded={handleCommentAdded}
        />
      )} */}
    </>
  );
} 