"use client";

import { useState, useMemo, useEffect } from "react";
import { Clock, FileText, Users, Calendar, Eye, Edit, Trash2, Plus, Search, Filter, X, Play, CheckCircle, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getNextResetInfo, getFrequencyDescription } from "@/lib/task-scheduler";
import { usePermissions } from '@/hooks/use-permissions';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/providers/ThemeProvider';
import { cn } from '@/lib/utils';

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
    attachments?: string[];
  }[];
  estimatedTime: number; // en minutos
  priority: 'baja' | 'media' | 'alta';
  isActive: boolean;
  executionTime?: string;
  lastExecuted?: string;
  nextExecution: string;
  createdAt: string;
  completedAt?: string;
  isCompleted?: boolean;
}

interface FixedTasksKanbanProps {
  tasks?: FixedTask[];
  onTaskClick: (task: FixedTask) => void;
  onEditTask: (task: FixedTask) => void;
  onDeleteTask: (taskId: string) => void;
  onCreateTask: (frequency: string) => void;
  onExecuteTask: (task: FixedTask) => void;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

const frequencyColumns = [
  { key: 'diaria', title: 'Diarias', shortTitle: 'D', description: 'Cada día' },
  { key: 'semanal', title: 'Semanales', shortTitle: 'S', description: 'Cada semana' },
  { key: 'quincenal', title: 'Quincenales', shortTitle: 'Q', description: 'Cada 15 días' },
  { key: 'mensual', title: 'Mensuales', shortTitle: 'M', description: 'Cada mes' },
  { key: 'trimestral', title: 'Trimestrales', shortTitle: 'T', description: 'Cada 3 meses' },
  { key: 'semestral', title: 'Semestrales', shortTitle: 'Se', description: 'Cada 6 meses' },
  { key: 'anual', title: 'Anuales', shortTitle: 'A', description: 'Cada año' },
];

// Datos mock de tareas fijas
const mockFixedTasks: FixedTask[] = [
  {
    id: '1',
    title: 'Limpieza de filtros de aire',
    description: 'Limpieza y mantenimiento de filtros en sistema de climatización',
    frequency: 'diaria',
    assignedTo: { id: '1', name: 'Juan Pérez' },
    department: 'Mantenimiento',
    instructives: [
      {
        id: '1',
        title: 'Procedimiento de limpieza de filtros',
        content: `1. Detener el sistema de climatización
2. Retirar filtros con cuidado
3. Limpiar con agua y jabón neutro
4. Secar completamente antes de reinstalar
5. Verificar ajuste correcto
6. Reiniciar sistema y verificar funcionamiento`,
        attachments: ['filtros-diagrama.pdf', 'checklist-limpieza.docx']
      }
    ],
    estimatedTime: 30,
    priority: 'media',
    isActive: true,
    lastExecuted: '2024-01-15T08:00:00Z',
    nextExecution: '2024-01-16T08:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    isCompleted: true,
    completedAt: '2024-01-15T08:30:00Z'
  },
  {
    id: '2',
    title: 'Inspección de extintores',
    description: 'Verificación del estado y presión de extintores',
    frequency: 'semanal',
    assignedTo: { id: '2', name: 'Ana García' },
    department: 'Seguridad',
    instructives: [
      {
        id: '2',
        title: 'Protocolo de inspección de extintores',
        content: `1. Verificar ubicación y accesibilidad
2. Inspeccionar estado físico del extintor
3. Verificar presión en manómetro
4. Comprobar estado del precinto
5. Verificar etiquetas y fechas
6. Registrar observaciones
7. Reportar anomalías inmediatamente`,
        attachments: ['protocolo-extintores.pdf', 'planilla-inspeccion.xlsx']
      }
    ],
    estimatedTime: 45,
    priority: 'alta',
    isActive: true,
    nextExecution: '2024-01-22T09:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    isCompleted: false
  },
  {
    id: '3',
    title: 'Calibración de instrumentos',
    description: 'Calibración quincenal de instrumentos de medición',
    frequency: 'quincenal',
    assignedTo: { id: '3', name: 'Carlos López' },
    department: 'Calidad',
    instructives: [
      {
        id: '3',
        title: 'Procedimiento de calibración',
        content: `1. Preparar equipos de referencia
2. Verificar condiciones ambientales
3. Realizar mediciones de control
4. Ajustar instrumentos según especificaciones
5. Documentar resultados
6. Emitir certificados de calibración
7. Programar próxima calibración`,
        attachments: ['manual-calibracion.pdf', 'certificados-template.docx']
      }
    ],
    estimatedTime: 120,
    priority: 'alta',
    isActive: true,
    nextExecution: '2024-01-30T10:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    isCompleted: true,
    completedAt: '2024-01-30T11:45:00Z'
  },
  {
    id: '4',
    title: 'Mantenimiento preventivo de motores',
    description: 'Revisión mensual completa de motores eléctricos',
    frequency: 'mensual',
    assignedTo: { id: '4', name: 'Roberto Silva' },
    department: 'Mantenimiento',
    instructives: [
      {
        id: '4',
        title: 'Mantenimiento preventivo de motores',
        content: `1. Desconectar energía eléctrica
2. Inspección visual externa
3. Verificar conexiones eléctricas
4. Medir resistencia de aislamiento
5. Lubricar rodamientos
6. Limpiar bobinados
7. Verificar ventilación
8. Pruebas de funcionamiento`,
        attachments: ['manual-motores.pdf', 'tabla-lubricacion.xlsx']
      }
    ],
    estimatedTime: 180,
    priority: 'media',
    isActive: true,
    nextExecution: '2024-02-01T14:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    isCompleted: false
  },
  {
    id: '5',
    title: 'Auditoría de seguridad',
    description: 'Auditoría trimestral de procedimientos de seguridad',
    frequency: 'trimestral',
    assignedTo: { id: '5', name: 'María Rodríguez' },
    department: 'Seguridad',
    instructives: [
      {
        id: '5',
        title: 'Protocolo de auditoría de seguridad',
        content: `1. Planificar auditoría y notificar áreas
2. Revisar documentación de seguridad
3. Inspeccionar instalaciones
4. Verificar cumplimiento de procedimientos
5. Entrevistar personal
6. Documentar hallazgos
7. Elaborar informe
8. Seguimiento de acciones correctivas`,
        attachments: ['checklist-auditoria.pdf', 'formato-informe.docx']
      }
    ],
    estimatedTime: 480,
    priority: 'alta',
    isActive: true,
    nextExecution: '2024-04-01T08:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    isCompleted: false
  },
  {
    id: '6',
    title: 'Revisión de sistemas de emergencia',
    description: 'Prueba semestral de sistemas de emergencia y evacuación',
    frequency: 'semestral',
    assignedTo: { id: '6', name: 'Diego Fernández' },
    department: 'Seguridad',
    instructives: [
      {
        id: '6',
        title: 'Procedimiento de prueba de emergencia',
        content: `1. Coordinar con todas las áreas
2. Verificar sistemas de alarma
3. Probar rutas de evacuación
4. Verificar puntos de encuentro
5. Probar comunicaciones de emergencia
6. Evaluar tiempos de respuesta
7. Documentar resultados
8. Capacitar sobre mejoras`,
        attachments: ['plan-emergencia.pdf', 'cronograma-pruebas.xlsx']
      }
    ],
    estimatedTime: 360,
    priority: 'alta',
    isActive: true,
    nextExecution: '2024-07-01T09:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    isCompleted: false
  },
  {
    id: '7',
    title: 'Actualización de documentación ISO',
    description: 'Revisión anual de procedimientos y documentos ISO',
    frequency: 'anual',
    assignedTo: { id: '7', name: 'Patricia Morales' },
    department: 'Calidad',
    instructives: [
      {
        id: '7',
        title: 'Procedimiento de actualización ISO',
        content: `1. Revisar normativas vigentes
2. Evaluar procedimientos actuales
3. Identificar cambios necesarios
4. Actualizar documentación
5. Validar con responsables de área
6. Aprobar cambios
7. Comunicar actualizaciones
8. Capacitar al personal`,
        attachments: ['iso-guidelines.pdf', 'matriz-documentos.xlsx']
      }
    ],
    estimatedTime: 720,
    priority: 'media',
    isActive: true,
    nextExecution: '2024-12-01T08:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    isCompleted: false
  }
];

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'alta': return 'bg-destructive/10 text-destructive border-destructive/30';
    case 'media': return 'bg-warning-muted text-warning-muted-foreground border-warning-muted';
    case 'baja': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800';
    default: return 'bg-muted text-muted-foreground border-border';
  }
}

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

export function FixedTasksKanban({ tasks: propTasks, onTaskClick, onEditTask, onDeleteTask, onCreateTask, onExecuteTask, canCreate = false, canEdit = false, canDelete = false }: FixedTasksKanbanProps) {
  const tasks = propTasks || mockFixedTasks;
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const { user } = useAuth();
  const { theme } = useTheme();



  // Obtener lista única de usuarios - usar tareas dinámicas
  const users = useMemo(() => {
    const tasksToUse = propTasks || mockFixedTasks;
    const uniqueUsers = tasksToUse.reduce((acc, task) => {
      if (!acc.find(u => u.id === task.assignedTo.id)) {
        acc.push(task.assignedTo);
      }
      return acc;
    }, [] as { id: string; name: string }[]);
    return uniqueUsers;
  }, [propTasks]);

  // Filtrar tareas
  const filteredTasks = useMemo(() => {
    const tasksToUse = propTasks || mockFixedTasks;
    return tasksToUse.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           task.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesUser = selectedUser === "all" || task.assignedTo.id === selectedUser;
      
      return matchesSearch && matchesUser;
    });
  }, [propTasks, searchTerm, selectedUser]);

  const getTasksByFrequency = (frequency: string) => {
    return filteredTasks.filter(task => task.frequency === frequency);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedUser("all");
  };

  const hasActiveFilters = searchTerm !== "" || selectedUser !== "all";

  return (
    <div className="space-y-4">
      {/* Header con controles de filtro */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
        {/* Búsqueda */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar tareas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 bg-background"
          />
        </div>

        {/* Filtro por usuario */}
        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger className="w-full sm:w-44 h-9 bg-background">
            <SelectValue placeholder="Usuario" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los usuarios</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Indicador de filtros activos */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Limpiar filtros
          </Button>
        )}

        {/* Contador */}
        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground px-2">
          <span className="font-medium text-foreground">{filteredTasks.length}</span>
          <span>de {(propTasks || mockFixedTasks).length}</span>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex gap-3 h-[600px] overflow-x-auto pb-4">
        {frequencyColumns.map((column) => {
          const columnTasks = getTasksByFrequency(column.key);
          const completedInColumn = columnTasks.filter(t => t.isCompleted).length;
          const columnProgress = columnTasks.length > 0 ? Math.round((completedInColumn / columnTasks.length) * 100) : 0;

          return (
            <div key={column.key} className="flex-shrink-0 w-72">
              <Card className="h-full bg-card border-border shadow-sm">
                <CardHeader className="p-3 border-b border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                        <span className="text-xs font-bold text-muted-foreground">{column.shortTitle}</span>
                      </div>
                      <div>
                        <CardTitle className="text-sm font-medium text-foreground">
                          {column.title}
                        </CardTitle>
                        <p className="text-[10px] text-muted-foreground">{column.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="bg-muted text-foreground text-xs font-semibold px-2 py-1 rounded-md">
                        {columnTasks.length}
                      </span>
                      {canCreate && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                          onClick={() => onCreateTask(column.key)}
                          aria-label="Agregar"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* Progress bar for column */}
                  {columnTasks.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-1">
                        <div
                          className="bg-primary/70 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${columnProgress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">{columnProgress}%</span>
                    </div>
                  )}
                </CardHeader>
                
                <CardContent className="p-2">
                  <ScrollArea className="h-[480px]">
                    <div className="space-y-2 pr-2">
                      {columnTasks.map((task) => (
                        <div
                          key={task.id}
                          className={cn(
                            "group cursor-pointer rounded-lg border p-3 transition-all duration-200",
                            task.isCompleted
                              ? 'bg-muted/20 border-border/60 hover:border-border hover:shadow-sm'
                              : 'bg-card border-border hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5'
                          )}
                          onClick={() => onTaskClick(task)}
                        >
                          {/* Header con título y acciones */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              {task.isCompleted && (
                                <div className="flex items-center gap-1.5 mb-1">
                                  <CheckCircle className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-[10px] text-muted-foreground font-medium">Completada</span>
                                </div>
                              )}
                              <h4 className={cn(
                                "text-sm font-medium line-clamp-2",
                                task.isCompleted ? 'text-muted-foreground' : 'text-foreground'
                              )}>
                                {task.title}
                              </h4>
                            </div>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              {!task.isCompleted && task.isActive && onExecuteTask && String(task.assignedTo.id) === String(user?.id) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-primary hover:bg-primary/10"
                                  onClick={(e) => { e.stopPropagation(); onExecuteTask(task); }}
                                  title="Completar"
                                  aria-label="Ejecutar"
                                >
                                  <Play className="h-3 w-3" />
                                </Button>
                              )}
                              {canEdit && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-accent"
                                  onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                                  aria-label="Editar"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }}
                                  aria-label="Eliminar"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Descripción */}
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                            {task.description}
                          </p>

                          {/* Asignado a - destacado */}
                          <div className="flex items-center gap-2 mb-3 p-2 bg-muted/50 rounded-md">
                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                              <Users className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{task.assignedTo.name}</p>
                              <p className="text-[10px] text-muted-foreground">{task.department}</p>
                            </div>
                          </div>

                          {/* Metadata compacta */}
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-3">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{task.executionTime || formatTime(task.estimatedTime)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              <span>{task.instructives.length}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(task.nextExecution).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                            </div>
                          </div>

                          {/* Estado de reinicio para tareas completadas */}
                          {task.isCompleted && (
                            <div className="flex items-center gap-1.5 text-[10px] mb-3 px-2 py-1.5 rounded-md bg-muted/70 text-muted-foreground">
                              <RotateCcw className="h-3 w-3" />
                              <span>{getNextResetInfo(task.frequency, task.nextExecution).text}</span>
                            </div>
                          )}

                          {/* Footer con badge de prioridad */}
                          <div className="flex items-center justify-between pt-2 border-t border-border/30">
                            <Badge variant="outline" className={cn("text-[10px] h-5", getPriorityColor(task.priority))}>
                              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                            </Badge>

                            {!task.isActive && (
                              <Badge variant="destructive" className="text-[10px] h-5">Inactiva</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {columnTasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 px-4">
                          <div className="w-14 h-14 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mb-4">
                            <Calendar className="h-6 w-6 text-muted-foreground/50" />
                          </div>
                          {hasActiveFilters ? (
                            <>
                              <p className="text-sm font-medium text-foreground mb-1">Sin resultados</p>
                              <p className="text-xs text-muted-foreground text-center max-w-[180px]">
                                No hay tareas que coincidan con los filtros aplicados
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-medium text-foreground mb-1">Sin tareas</p>
                              <p className="text-xs text-muted-foreground text-center mb-4 max-w-[180px]">
                                No hay tareas {column.title.toLowerCase()} programadas
                              </p>
                              {canCreate && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => onCreateTask(column.key)}
                                >
                                  <Plus className="h-3 w-3 mr-1.5" />
                                  Crear
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
} 