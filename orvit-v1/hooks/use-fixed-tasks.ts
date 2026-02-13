import { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';

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

interface UseFixedTasksReturn {
  tasks: FixedTask[];
  loading: boolean;
  error: string | null;
  createTask: (taskData: any) => Promise<FixedTask>;
  updateTask: (taskId: string, taskData: any) => Promise<FixedTask>;
  deleteTask: (taskId: string) => Promise<void>;
  refetch: () => void;
}

export function useFixedTasks(): UseFixedTasksReturn {
  const [tasks, setTasks] = useState<FixedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  // Función para verificar y reiniciar tareas que necesiten reinicio
  const checkAndResetTasks = async () => {
    if (!currentCompany?.id) return;

    try {
      const response = await fetch('/api/fixed-tasks/check-resets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          companyId: currentCompany.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.tasksReset > 0) {
          toast({
            title: "🔄 Tareas reiniciadas",
            description: data.message,
            duration: 5000,
          });
        }
      }
    } catch (error) {
      // Silently fail
    }
  };

  const fetchTasks = async () => {
    if (!currentCompany?.id) {
      setError('No hay empresa seleccionada');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Primero verificar y reiniciar tareas que necesiten reinicio
      await checkAndResetTasks();

      // Luego obtener todas las tareas actualizadas
      const response = await fetch(`/api/fixed-tasks?companyId=${currentCompany.id}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener tareas fijas');
      }

      const data = await response.json();
      
      if (data.success) {
        setTasks(data.tasks);
      } else {
        throw new Error(data.error || 'Error al obtener tareas fijas');
      }
    } catch (err) {
      console.error('Error fetching fixed tasks:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      
      // Fallback con tareas mock si falla
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const createTask = async (taskData: any): Promise<FixedTask> => {
    if (!currentCompany?.id) {
      throw new Error('No hay empresa seleccionada');
    }

    try {
      const response = await fetch('/api/fixed-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...taskData,
          companyId: currentCompany.id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al crear tarea fija');
      }

      const data = await response.json();
      
      if (data.success) {
        const newTask = data.task;
        setTasks(prevTasks => [newTask, ...prevTasks]);
        return newTask;
      } else {
        throw new Error(data.error || 'Error al crear tarea fija');
      }
    } catch (err) {
      console.error('Error creating fixed task:', err);
      throw err;
    }
  };

  const updateTask = async (taskId: string, taskData: any): Promise<FixedTask> => {
    try {
      const response = await fetch(`/api/fixed-tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar tarea fija');
      }

      const data = await response.json();
      
      if (data.success) {
        const updatedTask = data.task;
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === taskId ? updatedTask : task
          )
        );
        return updatedTask;
      } else {
        throw new Error(data.error || 'Error al actualizar tarea fija');
      }
    } catch (err) {
      console.error('Error updating fixed task:', err);
      throw err;
    }
  };

  const deleteTask = async (taskId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/fixed-tasks/${taskId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al eliminar tarea fija');
      }

      const data = await response.json();
      
      if (data.success) {
        setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
      } else {
        throw new Error(data.error || 'Error al eliminar tarea fija');
      }
    } catch (err) {
      console.error('Error deleting fixed task:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [currentCompany?.id]);

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
    refetch: fetchTasks
  };
} 