import { apiClient } from '../client';
import type {
  SkillsListResponse,
  SkillDetailResponse,
  SkillSaveRequest,
  SkillMatchResponse,
} from '../types';

export const skillsApi = {
  list: async (): Promise<SkillsListResponse> => {
    const response = await apiClient.get<SkillsListResponse>('/api/skills');
    return response.data;
  },

  get: async (skillId: string): Promise<SkillDetailResponse> => {
    const response = await apiClient.get<SkillDetailResponse>(`/api/skills/${skillId}`);
    return response.data;
  },

  create: async (data: SkillSaveRequest): Promise<{ success: boolean; skill: { id: string; name: string } }> => {
    const response = await apiClient.post('/api/skills', data);
    return response.data;
  },

  update: async (skillId: string, data: Omit<SkillSaveRequest, 'id'>): Promise<{ success: boolean }> => {
    const response = await apiClient.put(`/api/skills/${skillId}`, data);
    return response.data;
  },

  delete: async (skillId: string): Promise<{ success: boolean }> => {
    const response = await apiClient.delete(`/api/skills/${skillId}`);
    return response.data;
  },

  match: async (prompt: string): Promise<SkillMatchResponse> => {
    const response = await apiClient.post<SkillMatchResponse>('/api/skills/match', { prompt });
    return response.data;
  },
};
