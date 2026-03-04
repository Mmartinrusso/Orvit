export type Priority = "LOW" | "MEDIUM" | "HIGH";
export type TaskStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "WAITING"
  | "COMPLETED"
  | "CANCELLED";

export interface AgendaTask {
  id: number;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: Priority;
  status: TaskStatus;
  category: string | null;
  createdById: number;
  assignedToUserId: number | null;
  assignedToContactId: number | null;
  assignedToName: string | null;
  source: string;
  companyId: number;
  groupId: number | null;
  completedAt: string | null;
  isArchived: boolean;
  isCompanyVisible: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: number; name: string; avatar: string | null };
  assignedToUser?: { id: number; name: string; avatar: string | null } | null;
  group?: { id: number; name: string; color: string | null; icon: string | null } | null;
  _count: { comments: number; subtasks?: number; subtasksDone?: number };
  subtaskTotal?: number;
  subtaskDone?: number;
}

export interface AgendaSubtask {
  id: number;
  title: string;
  done: boolean;
  note: string | null;
  sortOrder: number;
  taskId: number;
}

export interface AgendaComment {
  id: number;
  content: string;
  createdAt: string;
  authorId: number;
  author: { id: number; name: string; avatar: string | null };
}

export interface CreateTaskData {
  title: string;
  description?: string;
  dueDate?: string;
  priority?: Priority;
  assignedToUserId?: number;
  category?: string;
  source?: string;
}
