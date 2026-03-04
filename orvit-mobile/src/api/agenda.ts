import { apiFetch } from "./client";
import type {
  AgendaTask,
  AgendaSubtask,
  AgendaComment,
  CreateTaskData,
} from "@/types/agenda";

// ── Tasks ────────────────────────────────────────────────────────

export async function getTasks(params: {
  companyId: number;
  status?: string;
  priority?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}): Promise<{ tasks: AgendaTask[]; totalCount: number }> {
  const search = new URLSearchParams();
  search.set("companyId", String(params.companyId));
  if (params.status) search.set("status", params.status);
  if (params.priority) search.set("priority", params.priority);
  if (params.search) search.set("search", params.search);
  if (params.sortBy) search.set("sortBy", params.sortBy);
  if (params.sortOrder) search.set("sortOrder", params.sortOrder);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));

  const res = await apiFetch<{ data: AgendaTask[]; pagination: { total: number } }>(
    `/api/agenda/tasks?${search.toString()}`
  );
  return { tasks: res.data, totalCount: res.pagination.total };
}

export async function getTask(id: number): Promise<AgendaTask> {
  return apiFetch(`/api/agenda/tasks/${id}`);
}

export async function createTask(
  companyId: number,
  data: CreateTaskData
): Promise<AgendaTask> {
  return apiFetch("/api/agenda/tasks", {
    method: "POST",
    body: JSON.stringify({ ...data, companyId }),
  });
}

export async function updateTask(
  id: number,
  data: Partial<CreateTaskData> & { status?: string; completedNote?: string }
): Promise<AgendaTask> {
  return apiFetch(`/api/agenda/tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteTask(id: number): Promise<void> {
  await apiFetch(`/api/agenda/tasks/${id}`, { method: "DELETE" });
}

// ── Subtasks ─────────────────────────────────────────────────────

export async function getSubtasks(taskId: number): Promise<AgendaSubtask[]> {
  return apiFetch(`/api/agenda/tasks/${taskId}/subtasks`);
}

export async function createSubtask(
  taskId: number,
  title: string
): Promise<AgendaSubtask> {
  return apiFetch(`/api/agenda/tasks/${taskId}/subtasks`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function toggleSubtask(
  taskId: number,
  subtaskId: number,
  done: boolean
): Promise<AgendaSubtask> {
  return apiFetch(`/api/agenda/tasks/${taskId}/subtasks/${subtaskId}`, {
    method: "PATCH",
    body: JSON.stringify({ done }),
  });
}

// ── Comments ─────────────────────────────────────────────────────

export async function getComments(
  taskId: number
): Promise<AgendaComment[]> {
  return apiFetch(`/api/agenda/tasks/${taskId}/comments`);
}

export async function addComment(
  taskId: number,
  content: string
): Promise<AgendaComment> {
  return apiFetch(`/api/agenda/tasks/${taskId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

// ── Voice-to-task ────────────────────────────────────────────────

export async function createTaskFromVoice(
  companyId: number,
  audioBase64: string,
  audioMimeType: string
): Promise<{ task: AgendaTask; transcription: string }> {
  return apiFetch("/api/agenda/tasks/from-voice", {
    method: "POST",
    body: JSON.stringify({ companyId, audioBase64, audioMimeType }),
  });
}
