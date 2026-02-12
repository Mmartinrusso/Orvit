import { apiClient } from '../client';
import type {
  OpportunityScanRequest,
  OpportunityScanResponse,
  OpportunityScanHistoryResponse,
  OpportunityScanDetailsResponse,
  OpportunitiesResponse,
  OpportunityDetailsResponse,
  OpportunityStatsResponse,
  ApproveOpportunityRequest,
  ApproveOpportunityResponse,
  RejectOpportunityRequest,
  ActiveScansResponse,
  OpportunityStatus,
  ResearchOpportunityRequest,
  ResearchOpportunityResponse,
  ResearchHistoryResponse,
  ResearchDetailsResponse,
  ActiveResearchesResponse,
} from '../types';

export const opportunitiesApi = {
  // ===========================================
  // Scans
  // ===========================================

  /**
   * Start a new opportunity scan
   */
  startScan: async (request: OpportunityScanRequest): Promise<OpportunityScanResponse> => {
    const response = await apiClient.post<OpportunityScanResponse>('/api/opportunities/scan', request);
    return response.data;
  },

  /**
   * Get scan history
   */
  getScanHistory: async (limit?: number): Promise<OpportunityScanHistoryResponse> => {
    const params = limit ? { limit: limit.toString() } : {};
    const response = await apiClient.get<OpportunityScanHistoryResponse>('/api/opportunities/scans', { params });
    return response.data;
  },

  /**
   * Get active scans
   */
  getActiveScans: async (): Promise<ActiveScansResponse> => {
    const response = await apiClient.get<ActiveScansResponse>('/api/opportunities/scans/active');
    return response.data;
  },

  /**
   * Get scan details with opportunities
   */
  getScanDetails: async (scanId: string): Promise<OpportunityScanDetailsResponse> => {
    const response = await apiClient.get<OpportunityScanDetailsResponse>(`/api/opportunities/scans/${scanId}`);
    return response.data;
  },

  /**
   * Cancel an active scan
   */
  cancelScan: async (scanId: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await apiClient.delete<{ success: boolean; message?: string; error?: string }>(
      `/api/opportunities/scans/${scanId}`
    );
    return response.data;
  },

  // ===========================================
  // Opportunities
  // ===========================================

  /**
   * Get opportunities (optionally filtered by status)
   */
  getOpportunities: async (status?: OpportunityStatus, limit?: number): Promise<OpportunitiesResponse> => {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (limit) params.limit = limit.toString();
    const response = await apiClient.get<OpportunitiesResponse>('/api/opportunities', { params });
    return response.data;
  },

  /**
   * Get opportunity statistics
   */
  getStats: async (): Promise<OpportunityStatsResponse> => {
    const response = await apiClient.get<OpportunityStatsResponse>('/api/opportunities/stats');
    return response.data;
  },

  /**
   * Get opportunity details
   */
  getOpportunityDetails: async (opportunityId: string): Promise<OpportunityDetailsResponse> => {
    const response = await apiClient.get<OpportunityDetailsResponse>(`/api/opportunities/${opportunityId}`);
    return response.data;
  },

  /**
   * Approve an opportunity (creates and starts a task)
   */
  approveOpportunity: async (
    opportunityId: string,
    request?: ApproveOpportunityRequest
  ): Promise<ApproveOpportunityResponse> => {
    const response = await apiClient.post<ApproveOpportunityResponse>(
      `/api/opportunities/${opportunityId}/approve`,
      request || {}
    );
    return response.data;
  },

  /**
   * Reject an opportunity
   */
  rejectOpportunity: async (
    opportunityId: string,
    request?: RejectOpportunityRequest
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await apiClient.post<{ success: boolean; message?: string; error?: string }>(
      `/api/opportunities/${opportunityId}/reject`,
      request || {}
    );
    return response.data;
  },

  // ===========================================
  // Research
  // ===========================================

  /**
   * Start a new research for an idea
   */
  startResearch: async (request: ResearchOpportunityRequest): Promise<ResearchOpportunityResponse> => {
    const response = await apiClient.post<ResearchOpportunityResponse>('/api/opportunities/research', request);
    return response.data;
  },

  /**
   * Get research history
   */
  getResearchHistory: async (limit?: number): Promise<ResearchHistoryResponse> => {
    const params = limit ? { limit: limit.toString() } : {};
    const response = await apiClient.get<ResearchHistoryResponse>('/api/opportunities/research', { params });
    return response.data;
  },

  /**
   * Get active researches
   */
  getActiveResearches: async (): Promise<ActiveResearchesResponse> => {
    const response = await apiClient.get<ActiveResearchesResponse>('/api/opportunities/research/active');
    return response.data;
  },

  /**
   * Get research details
   */
  getResearchDetails: async (researchId: string): Promise<ResearchDetailsResponse> => {
    const response = await apiClient.get<ResearchDetailsResponse>(`/api/opportunities/research/${researchId}`);
    return response.data;
  },

  /**
   * Cancel an active research
   */
  cancelResearch: async (researchId: string): Promise<{ success: boolean; message?: string; error?: string }> => {
    const response = await apiClient.delete<{ success: boolean; message?: string; error?: string }>(
      `/api/opportunities/research/${researchId}`
    );
    return response.data;
  },
};
