import { apiClient } from '../client';
import type {
  TaskRequest,
  TaskResponse,
  TaskHistoryResponse,
  ActiveTasksResponse,
  QueuedTasksResponse,
  TaskStatsResponse,
  TaskDetailsResponse,
  CancelTaskResponse,
  HealthResponse,
  TaskLogsResponse,
  EnhancePromptRequest,
  EnhancePromptResponse,
} from '../types';

export const tasksApi = {
  // POST /api/task
  create: async (data: TaskRequest): Promise<TaskResponse> => {
    const response = await apiClient.post<TaskResponse>('/api/task', data);
    return response.data;
  },

  // GET /api/tasks
  getHistory: async (limit: number = 50): Promise<TaskHistoryResponse> => {
    const response = await apiClient.get<TaskHistoryResponse>('/api/tasks', {
      params: { limit },
    });
    return response.data;
  },

  // GET /api/tasks/active
  getActive: async (): Promise<ActiveTasksResponse> => {
    const response = await apiClient.get<ActiveTasksResponse>('/api/tasks/active');
    return response.data;
  },

  // GET /api/tasks/active/:taskId/logs
  getLiveLogs: async (taskId: string, since?: string): Promise<TaskLogsResponse> => {
    const params: Record<string, string> = {};
    if (since) params.since = since;
    const response = await apiClient.get<TaskLogsResponse>(`/api/tasks/active/${taskId}/logs`, { params });
    return response.data;
  },

  // GET /api/tasks/queue
  getQueue: async (): Promise<QueuedTasksResponse> => {
    const response = await apiClient.get<QueuedTasksResponse>('/api/tasks/queue');
    return response.data;
  },

  // GET /api/tasks/stats
  getStats: async (startDate?: Date, endDate?: Date): Promise<TaskStatsResponse> => {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate.toISOString();
    if (endDate) params.end_date = endDate.toISOString();

    const response = await apiClient.get<TaskStatsResponse>('/api/tasks/stats', { params });
    return response.data;
  },

  // GET /api/tasks/:taskId
  getById: async (taskId: string): Promise<TaskDetailsResponse> => {
    const response = await apiClient.get<TaskDetailsResponse>(`/api/tasks/${taskId}`);
    return response.data;
  },

  // DELETE /api/tasks/:taskId
  cancel: async (taskId: string): Promise<CancelTaskResponse> => {
    const response = await apiClient.delete<CancelTaskResponse>(`/api/tasks/${taskId}`);
    return response.data;
  },

  // POST /api/tasks/:taskId/retry
  retry: async (taskId: string): Promise<TaskResponse> => {
    const response = await apiClient.post<TaskResponse>(`/api/tasks/${taskId}/retry`);
    return response.data;
  },

  // GET /api/tasks/interrupted
  getInterrupted: async (): Promise<{ success: boolean; count: number; tasks: Array<{
    task_id: string;
    input_prompt: string;
    model: string;
    status: string;
    last_stage: string | null;
    stages_completed: string[];
    created_at: string;
    started_at: string | null;
  }> }> => {
    const response = await apiClient.get('/api/tasks/interrupted');
    return response.data;
  },

  // POST /api/tasks/:taskId/dismiss
  dismiss: async (taskId: string): Promise<{ success: boolean }> => {
    const response = await apiClient.post(`/api/tasks/${taskId}/dismiss`);
    return response.data;
  },

  // POST /api/task/recommend
  recommend: async (prompt: string): Promise<{
    success: boolean;
    recommendation: {
      recommended_mode: string;
      recommended_model: string;
      reason: string;
      confidence: number;
    };
  }> => {
    const response = await apiClient.post('/api/task/recommend', { prompt });
    return response.data;
  },

  // POST /api/task/enhance-prompt
  enhancePrompt: async (data: EnhancePromptRequest): Promise<EnhancePromptResponse> => {
    const response = await apiClient.post<EnhancePromptResponse>('/api/task/enhance-prompt', data);
    return response.data;
  },
};

export const healthApi = {
  // GET /health
  check: async (): Promise<HealthResponse> => {
    const response = await apiClient.get<HealthResponse>('/health');
    return response.data;
  },
};
