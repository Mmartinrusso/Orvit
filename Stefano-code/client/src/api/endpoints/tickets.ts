import { apiClient } from '../client';
import type {
  CreateTicketRequest,
  CreateTicketResponse,
  ListTicketsRequest,
  ListTicketsResponse,
  GetTicketDetailsResponse,
  ApproveTicketRequest,
  ApproveTicketResponse,
  RejectTicketRequest,
  RejectTicketResponse,
  TicketTypeInfo,
} from '../types';

export const ticketsApi = {
  /**
   * Create a new ticket
   */
  create: async (data: CreateTicketRequest): Promise<CreateTicketResponse> => {
    const response = await apiClient.post<CreateTicketResponse>('/api/tickets', data);
    return response.data;
  },

  /**
   * List tickets with filters
   */
  list: async (params: ListTicketsRequest = {}): Promise<ListTicketsResponse> => {
    const response = await apiClient.get<ListTicketsResponse>('/api/tickets', { params });
    return response.data;
  },

  /**
   * Get ticket details with comments and task
   */
  getById: async (ticketId: string): Promise<GetTicketDetailsResponse> => {
    const response = await apiClient.get<GetTicketDetailsResponse>(`/api/tickets/${ticketId}`);
    return response.data;
  },

  /**
   * Approve ticket and start task
   */
  approve: async (ticketId: string, data: ApproveTicketRequest): Promise<ApproveTicketResponse> => {
    const response = await apiClient.post<ApproveTicketResponse>(`/api/tickets/${ticketId}/approve`, data);
    return response.data;
  },

  /**
   * Reject ticket
   */
  reject: async (ticketId: string, data: RejectTicketRequest): Promise<RejectTicketResponse> => {
    const response = await apiClient.post<RejectTicketResponse>(`/api/tickets/${ticketId}/reject`, data);
    return response.data;
  },

  /**
   * Add comment to ticket
   */
  addComment: async (ticketId: string, content: string, createdBy?: string): Promise<{ success: boolean }> => {
    const response = await apiClient.post(`/api/tickets/${ticketId}/comments`, {
      content,
      created_by: createdBy,
    });
    return response.data;
  },

  /**
   * Get all ticket types
   */
  getTypes: async (): Promise<{ success: boolean; types: TicketTypeInfo[] }> => {
    const response = await apiClient.get('/api/tickets/types');
    return response.data;
  },
};
