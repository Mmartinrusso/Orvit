import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsApi } from '@/api';
import type {
  CreateTicketRequest,
  ListTicketsRequest,
  ApproveTicketRequest,
  RejectTicketRequest,
} from '@/api';

/**
 * Hook to list tickets with filters
 */
export function useTickets(filters: ListTicketsRequest = {}) {
  return useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => ticketsApi.list(filters),
    staleTime: 10_000, // 10 seconds
  });
}

/**
 * Hook to get ticket details
 */
export function useTicketDetails(ticketId: string) {
  return useQuery({
    queryKey: ['tickets', ticketId],
    queryFn: () => ticketsApi.getById(ticketId),
    enabled: !!ticketId,
    // Poll every 5 seconds if ticket is in_progress
    refetchInterval: (query) => {
      const ticket = query.state.data?.ticket;
      if (ticket?.status === 'in_progress') {
        return 5_000;
      }
      return false;
    },
  });
}

/**
 * Hook to get ticket types
 */
export function useTicketTypes() {
  return useQuery({
    queryKey: ['ticket-types'],
    queryFn: () => ticketsApi.getTypes(),
    staleTime: Infinity, // Types don't change
  });
}

/**
 * Hook to create a ticket
 */
export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTicketRequest) => ticketsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

/**
 * Hook to approve a ticket
 */
export function useApproveTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, data }: { ticketId: string; data: ApproveTicketRequest }) =>
      ticketsApi.approve(ticketId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tickets', variables.ticketId] });
    },
  });
}

/**
 * Hook to reject a ticket
 */
export function useRejectTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ticketId, data }: { ticketId: string; data: RejectTicketRequest }) =>
      ticketsApi.reject(ticketId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tickets', variables.ticketId] });
    },
  });
}

/**
 * Hook to add comment to ticket
 */
export function useAddTicketComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      ticketId,
      content,
      createdBy,
    }: {
      ticketId: string;
      content: string;
      createdBy?: string;
    }) => ticketsApi.addComment(ticketId, content, createdBy),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tickets', variables.ticketId] });
    },
  });
}
