"use client";

import { useState, useMemo } from "react";
import { Eye, Pencil, Trash, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { TaskCard } from "./task-card";
import { EditTaskModal } from "./edit-task-modal";
import { NewTaskModal } from "./new-task-modal";
import { useTaskStore, Task } from "@/hooks/use-task-store";
import { toZonedTime, format } from 'date-fns-tz';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const ARG_TIMEZONE = 'America/Argentina/Buenos_Aires';

function formatDateArg(dateStr: string): string {
  if (!dateStr) return "-";
  const zoned = toZonedTime(new Date(dateStr), ARG_TIMEZONE);
  return format(zoned, 'dd/MM/yyyy', { timeZone: ARG_TIMEZONE });
}

interface TaskListProps {
  viewMode: "grid" | "table";
  tasks: Task[];
  user: { id: string } | null;
}

function groupTasksByDate(tasks: Task[]) {
  return tasks.reduce((acc, task) => {
    const fecha = task.dueDate ? formatDateArg(task.dueDate) : "Sin fecha";
    if (!acc[fecha]) acc[fecha] = [];
    acc[fecha].push(task);
    return acc;
  }, {} as Record<string, Task[]>);
}

export function TaskList({ viewMode, tasks, user }: TaskListProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const { 
    isLoading,
    setSelectedTask, 
    deleteTask,
    fetchTasks 
  } = useTaskStore();

  const handleDelete = async (id: string) => {
    try {
      await deleteTask(id);
    } catch (error) {
      console.error("Error al eliminar la tarea:", error);
      alert("Error al eliminar la tarea");
    }
  };

  const handleViewDetails = (task: Task) => {
    setSelectedTask(task);
  };

  // Las tareas ya vienen filtradas desde props
  const groupedTasks = useMemo(() => groupTasksByDate(tasks), [tasks]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Cargando tareas...</div>
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">No se encontraron tareas</h3>
          <p className="text-muted-foreground">
            No hay tareas que coincidan con los filtros seleccionados.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {viewMode === "grid" ? (
        Object.entries(groupedTasks)
          .sort(([fechaA], [fechaB]) => {
            const parse = (f: string) => {
              if (f === 'Sin fecha') return Infinity;
              const [d, m, y] = f.split('/');
              return new Date(`${y}-${m}-${d}`).getTime();
            };
            return parse(fechaA) - parse(fechaB);
          })
          .map(([fecha, tareas]) => (
            <div key={fecha} className="mb-8">
              <h2 className="text-lg font-bold mb-2">{fecha}</h2>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {tareas.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onDelete={() => handleDelete(task.id)}
                  />
                ))}
              </div>
            </div>
          ))
      ) : (
        Object.entries(groupedTasks)
          .sort(([fechaA], [fechaB]) => {
            const parse = (f: string) => {
              if (f === 'Sin fecha') return Infinity;
              const [d, m, y] = f.split('/');
              return new Date(`${y}-${m}-${d}`).getTime();
            };
            return parse(fechaA) - parse(fechaB);
          })
          .map(([fecha, tareas]) => (
            <div key={fecha} className="mb-8 w-full">
              <h2 className="text-lg font-bold mb-2">{fecha}</h2>
              <div className="w-full overflow-x-auto">
                <Table className="bg-card rounded-lg w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left pl-6 bg-muted">Título</TableHead>
                      <TableHead className="text-left pl-6 bg-muted">Descripción</TableHead>
                      <TableHead className="text-left pl-6 bg-muted">Estado</TableHead>
                      <TableHead className="text-left pl-6 bg-muted">Fecha</TableHead>
                      <TableHead className="text-left pl-6 bg-muted">Etiquetas</TableHead>
                      <TableHead className="text-left pl-6 bg-muted">Asignado</TableHead>
                      <TableHead className="text-left pl-6 bg-muted">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tareas.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-bold max-w-[180px] truncate pl-6">{task.title}</TableCell>
                        <TableCell className="max-w-[250px] truncate pl-6">{task.description || "-"}</TableCell>
                        <TableCell className="pl-6">
                          <Badge variant={task.status === 'realizada' ? 'default' : task.status === 'en-curso' ? 'secondary' : 'destructive'} className={task.status === 'realizada' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : ''}>
                            {task.status === 'realizada' ? 'Realizada' : task.status === 'en-curso' ? 'En Curso' : 'Pendiente'}
                          </Badge>
                        </TableCell>
                        <TableCell className="pl-6">{formatDateArg(task.dueDate || '')}</TableCell>
                        <TableCell className="pl-6">
                          {(task.tags ?? []).map((tag) => (
                            <Badge key={tag} variant="secondary" className="mr-1 mb-1 inline-block">{tag}</Badge>
                          ))}
                        </TableCell>
                        <TableCell className="pl-6">{task.assignedTo?.name || "-"}</TableCell>
                        <TableCell className="pl-6">
                          <div className="flex gap-2 items-center">
                            <Button size="icon" variant="ghost" onClick={() => handleViewDetails(task)} title="Ver Detalle">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {user && task.createdBy?.id?.toString() === user.id && (
                              <>
                                <Button size="icon" variant="ghost" onClick={() => setEditingTask(task)} title="Editar">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={() => handleDelete(task.id)} 
                                  title="Eliminar"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {user && task.assignedTo?.id?.toString() === user.id && task.status !== 'realizada' && (
                              <Button size="icon" variant="ghost" title="Completar">
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))
      )}
      
      <NewTaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onTaskCreated={() => {
          setModalOpen(false);
          fetchTasks(); // Refrescar las tareas después de crear una nueva
        }}
      />
      
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          isOpen={true}
          onClose={() => setEditingTask(null)}
          onTaskUpdated={() => {
            setEditingTask(null);
            fetchTasks(); // Refrescar las tareas después de actualizar
          }}
        />
      )}

    </>
  );
} 