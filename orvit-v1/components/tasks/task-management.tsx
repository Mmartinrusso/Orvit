"use client";

import { useState } from "react";
import { FixedTasksKanban } from "./fixed-tasks-kanban";
import { FixedTaskDetailModal } from "./fixed-task-detail-modal";
import { TaskExecutionModal } from "./task-execution-modal";

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
  estimatedTime: number;
  priority: 'baja' | 'media' | 'alta';
  isActive: boolean;
  lastExecuted?: string;
  nextExecution: string;
  createdAt: string;
  completedAt?: string;
  isCompleted?: boolean;
}

interface ExecutionData {
  actualTime: number;
  notes: string;
  attachments: File[];
  executedBy: string;
  completedAt: string;
}

export function TaskManagement() {
  const [selectedTask, setSelectedTask] = useState<FixedTask | null>(null);
  const [executingTask, setExecutingTask] = useState<FixedTask | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [tasks, setTasks] = useState<FixedTask[]>([]);

  const handleTaskClick = (task: FixedTask) => {
    setSelectedTask(task);
    setShowDetailModal(true);
  };

  const handleEditTask = (task: FixedTask) => {
    // TODO: Implementar edición de tarea
  };

  const handleDeleteTask = (taskId: string) => {
    // TODO: Implementar eliminación de tarea
  };

  const handleCreateTask = (frequency: string) => {
    // TODO: Implementar creación de tarea
  };

  const handleExecuteTask = (task: FixedTask) => {
    setExecutingTask(task);
    setShowExecutionModal(true);
  };

  const handleExecuteFromDetail = (task: FixedTask) => {
    setShowDetailModal(false);
    handleExecuteTask(task);
  };

  const handleCompleteTask = async (taskId: string, executionData: ExecutionData) => {
    try {
      // Simular llamada a API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Actualizar el estado de la tarea
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === taskId 
            ? { 
                ...task, 
                isCompleted: true, 
                completedAt: executionData.completedAt,
                lastExecuted: executionData.completedAt
              }
            : task
        )
      );

      // Cerrar modal de ejecución
      setShowExecutionModal(false);
      setExecutingTask(null);
      
      // Mostrar notificación de éxito
      // TODO: Implementar sistema de notificaciones
      
    } catch (error) {
      console.error("Error al completar tarea:", error);
      throw error;
    }
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedTask(null);
  };

  const handleCloseExecutionModal = () => {
    setShowExecutionModal(false);
    setExecutingTask(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tareas Programadas</h1>
          <p className="text-muted-foreground">
            Gestiona y ejecuta las tareas de mantenimiento preventivo
          </p>
        </div>
      </div>

      <FixedTasksKanban
        onTaskClick={handleTaskClick}
        onEditTask={handleEditTask}
        onDeleteTask={handleDeleteTask}
        onCreateTask={handleCreateTask}
        onExecuteTask={handleExecuteTask}
      />

      <FixedTaskDetailModal
        task={selectedTask}
        isOpen={showDetailModal}
        onClose={handleCloseDetailModal}
        onEdit={handleEditTask}
        onExecute={handleExecuteFromDetail}
        onToggleStatus={(task) => {
          // TODO: Implementar toggle de estado
        }}
      />

      <TaskExecutionModal
        task={executingTask}
        isOpen={showExecutionModal}
        onClose={handleCloseExecutionModal}
        onComplete={handleCompleteTask}
      />
    </div>
  );
} 