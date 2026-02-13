/**
 * Tipos centralizados para el módulo de tareas
 * Usados tanto en frontend como backend
 */

// =============================================================================
// TIPOS BASE
// =============================================================================

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskFile {
  id: string;
  name: string;
  url: string;
  size?: number;
  type?: string;
}

export interface TaskComment {
  id: string;
  content: string;
  userId: string;
  userName: string;
  userEmail: string;
  createdAt: string;
}

// =============================================================================
// TAREA NORMAL
// =============================================================================

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pendiente' | 'en-curso' | 'realizada' | 'cancelada';
  priority: 'baja' | 'media' | 'alta' | 'urgente';
  dueDate?: string;
  assignedTo: User;
  createdBy: User;
  tags: string[];
  subtasks: Subtask[];
  files: TaskFile[];
  comments?: TaskComment[];
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCreateInput {
  title: string;
  description?: string;
  assignedToId: string | number;
  priority?: 'baja' | 'media' | 'alta' | 'urgente';
  dueDate?: string;
  tags?: string[];
  subtasks?: { title: string; completed?: boolean }[];
  attachments?: { name: string; url: string; size?: number; type?: string }[];
}

export interface TaskUpdateInput {
  title?: string;
  description?: string;
  status?: 'pendiente' | 'en-curso' | 'realizada' | 'cancelada';
  priority?: 'baja' | 'media' | 'alta' | 'urgente';
  dueDate?: string | null;
  assignedToId?: string | number | null;
  tags?: string[];
  progress?: number;
  subtasks?: Subtask[];
}

// =============================================================================
// TAREA FIJA
// =============================================================================

export interface FixedTaskInstructive {
  id: string;
  title: string;
  content: string;
  attachments?: string[];
}

export interface FixedTask {
  id: string;
  title: string;
  description: string;
  frequency: 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'trimestral' | 'semestral' | 'anual';
  assignedTo: {
    id: string;
    name: string;
  };
  department: string;
  instructives: FixedTaskInstructive[];
  estimatedTime: number;
  priority: 'baja' | 'media' | 'alta';
  isActive: boolean;
  lastExecuted?: string;
  nextExecution: string;
  createdAt: string;
  completedAt?: string;
  isCompleted?: boolean;
}

export interface FixedTaskCreateInput {
  title: string;
  description?: string;
  frequency: 'diaria' | 'semanal' | 'quincenal' | 'mensual' | 'trimestral' | 'semestral' | 'anual';
  assignedTo?: { id: string; name?: string };
  department?: string;
  instructives?: { title: string; content: string; attachments?: string[] }[];
  estimatedTime?: number;
  priority?: 'baja' | 'media' | 'alta';
  isActive?: boolean;
  nextExecution: string;
  companyId: number | string;
}

// =============================================================================
// FILTROS
// =============================================================================

export interface TaskFilters {
  status: 'all' | 'pendiente' | 'en-curso' | 'realizada' | 'cancelada';
  priority: 'all' | 'baja' | 'media' | 'alta' | 'urgente';
  assignedTo: 'all' | string;
  dateRange: 'all' | 'yesterday' | 'today' | 'week' | 'month' | 'overdue';
  search: string;
}

export interface AdvancedFilters {
  statuses: string[];
  priorities: string[];
  tags: string[];
  assignedTo?: string;
  createdBy?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  hasAttachments: boolean;
  hasSubtasks: boolean;
}

// =============================================================================
// PAGINACIÓN
// =============================================================================

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// =============================================================================
// HISTORIAL
// =============================================================================

export interface TaskHistoryItem {
  id: number;
  task: {
    id: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    dueDate?: string;
    assignedTo?: User;
    createdBy?: User;
    deletedBy?: User;
    tags?: string[];
    progress?: number;
    files?: TaskFile[];
    comments?: TaskComment[];
  };
  deletedAt: string;
  deletedBy?: User;
}

// =============================================================================
// EJECUCIÓN DE TAREAS FIJAS
// =============================================================================

export interface FixedTaskExecution {
  id: string;
  fixedTaskId: string;
  userId: string;
  userName: string;
  duration?: number;
  notes?: string;
  attachments?: string[];
  completedAt: string;
}

// =============================================================================
// API RESPONSES
// =============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface TasksApiResponse extends ApiResponse<Task[]> {
  pagination?: PaginatedResponse<Task>['pagination'];
}

export interface FixedTasksApiResponse {
  success: boolean;
  tasks: FixedTask[];
  count: number;
}
