import { create } from 'zustand';
import { Task, TaskFilters, PaginatedResponse } from '@/lib/tasks/types';

// Re-exportar tipos para mantener compatibilidad
export type { Task } from '@/lib/tasks/types';

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface TaskStore {
  tasks: Task[];
  selectedTask: Task | null;
  isLoading: boolean;
  filters: TaskFilters;
  pagination: Pagination | null;

  // Actions
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  setSelectedTask: (task: Task | null) => void;
  setFilters: (filters: Partial<TaskFilters>) => void;
  setLoading: (loading: boolean) => void;
  setPagination: (pagination: Pagination | null) => void;
  setPage: (page: number) => void;

  // API methods
  fetchTasks: (page?: number) => Promise<void>;
  createTask: (taskData: any) => Promise<Task>;
  updateTaskAPI: (id: string, updates: any) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
}

const initialFilters: TaskFilters = {
  status: 'all',
  priority: 'all',
  assignedTo: 'all',
  dateRange: 'all',
  search: '',
};

// Debounce helper
let debounceTimeout: NodeJS.Timeout | null = null;
const DEBOUNCE_DELAY = 300;

// Helper para construir query params
const buildQueryParams = (filters: TaskFilters, page: number, pageSize: number): string => {
  const params = new URLSearchParams();

  if (filters.status !== 'all') params.append('status', filters.status);
  if (filters.priority !== 'all') params.append('priority', filters.priority);
  if (filters.assignedTo !== 'all') params.append('assignedTo', filters.assignedTo);
  if (filters.dateRange !== 'all') params.append('dateRange', filters.dateRange);
  if (filters.search) params.append('search', filters.search);

  params.append('page', String(page));
  params.append('pageSize', String(pageSize));

  return params.toString();
};

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  selectedTask: null,
  isLoading: false,
  filters: initialFilters,
  pagination: null,

  setTasks: (tasks) => set({ tasks }),

  addTask: (task) => set((state) => ({
    tasks: [task, ...state.tasks]
  })),

  updateTask: (id, updates) => set((state) => ({
    tasks: state.tasks.map(task =>
      task.id === id ? { ...task, ...updates } : task
    ),
    selectedTask: state.selectedTask?.id === id
      ? { ...state.selectedTask, ...updates }
      : state.selectedTask
  })),

  removeTask: (id) => set((state) => ({
    tasks: state.tasks.filter(task => task.id !== id),
    selectedTask: state.selectedTask?.id === id ? null : state.selectedTask
  })),

  setSelectedTask: (task) => {
    set({ selectedTask: task });
  },

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters }
    }));

    // Debounce para búsqueda, inmediato para otros filtros
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    const isSearchChange = 'search' in newFilters;
    const delay = isSearchChange ? DEBOUNCE_DELAY : 0;

    debounceTimeout = setTimeout(() => {
      get().fetchTasks(1); // Reset a página 1 cuando cambian filtros
    }, delay);
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setPagination: (pagination) => set({ pagination }),

  setPage: (page) => {
    set((state) => ({
      pagination: state.pagination ? { ...state.pagination, page } : null
    }));
    get().fetchTasks(page);
  },

  // API Methods
  fetchTasks: async (page?: number) => {
    const { filters, setLoading, setTasks, setPagination, pagination } = get();
    const currentPage = page || pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;

    try {
      setLoading(true);

      const queryParams = buildQueryParams(filters, currentPage, pageSize);
      const url = `/api/tasks${queryParams ? `?${queryParams}` : ''}`;

      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Manejar respuesta con paginación
      if (result.data && result.pagination) {
        setTasks(result.data);
        setPagination(result.pagination);
      } else if (Array.isArray(result)) {
        // Compatibilidad con formato anterior
        setTasks(result);
        setPagination(null);
      } else {
        setTasks(result.data || []);
        setPagination(result.pagination || null);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      // Mantener tareas existentes en caso de error
    } finally {
      setLoading(false);
    }
  },

  createTask: async (taskData) => {
    const { addTask } = get();

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      const newTask = await response.json();
      addTask(newTask);
      return newTask;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  },

  updateTaskAPI: async (id, updates) => {
    const { updateTask } = get();

    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      const updatedTask = await response.json();
      updateTask(id, updatedTask);
      return updatedTask;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  },

  deleteTask: async (id) => {
    const { removeTask, fetchTasks } = get();

    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Si la tarea no existe (404), removerla del estado local
        if (response.status === 404) {
          console.warn(`Tarea ${id} no existe en el servidor, removiendo del estado local`);
          removeTask(id);
          await fetchTasks();
          return;
        }

        throw new Error(errorData.error || `Error ${response.status}`);
      }

      removeTask(id);
    } catch (error) {
      console.error('Error deleting task:', error);

      // Si el error es que la tarea no existe, no re-arrojar
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Tarea no encontrada') || errorMessage.includes('404')) {
        console.warn(`Tarea ${id} no existe, removiendo del estado local`);
        removeTask(id);
        await fetchTasks();
        return;
      }

      throw error;
    }
  },
}));
