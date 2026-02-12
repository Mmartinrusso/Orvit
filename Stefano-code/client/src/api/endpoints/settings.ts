import { apiClient } from '../client';
import type {
  KnowledgeBaseResponse,
  KnowledgeBaseUpdateRequest,
  KnowledgeBaseUpdateResponse,
} from '../types';

export const settingsApi = {
  // ===========================================
  // Knowledge Base
  // ===========================================

  /**
   * Get the current knowledge base
   */
  getKnowledgeBase: async (): Promise<KnowledgeBaseResponse> => {
    const response = await apiClient.get<KnowledgeBaseResponse>('/api/settings/knowledge-base');
    return response.data;
  },

  /**
   * Update the knowledge base
   */
  updateKnowledgeBase: async (request: KnowledgeBaseUpdateRequest): Promise<KnowledgeBaseUpdateResponse> => {
    const response = await apiClient.put<KnowledgeBaseUpdateResponse>('/api/settings/knowledge-base', request);
    return response.data;
  },

  /**
   * Delete/deactivate the knowledge base
   */
  deleteKnowledgeBase: async (): Promise<{ success: boolean; message?: string }> => {
    const response = await apiClient.delete<{ success: boolean; message?: string }>('/api/settings/knowledge-base');
    return response.data;
  },
};
