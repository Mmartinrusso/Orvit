import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { opportunitiesApi } from '@/api';
import type {
  OpportunityScanRequest,
  ApproveOpportunityRequest,
  RejectOpportunityRequest,
  OpportunityStatus,
  ResearchOpportunityRequest,
} from '@/api/types';

// ===========================================
// Scans
// ===========================================

/**
 * Get scan history
 */
export function useScanHistory(limit?: number) {
  return useQuery({
    queryKey: ['opportunity-scans', limit],
    queryFn: () => opportunitiesApi.getScanHistory(limit),
    staleTime: 30000,
  });
}

/**
 * Get active scans with polling
 */
export function useActiveScans(polling: boolean = false) {
  return useQuery({
    queryKey: ['active-opportunity-scans'],
    queryFn: () => opportunitiesApi.getActiveScans(),
    refetchInterval: polling ? 5000 : false,
  });
}

/**
 * Get scan details with opportunities
 */
export function useScanDetails(scanId: string, polling: boolean = false) {
  return useQuery({
    queryKey: ['opportunity-scan', scanId],
    queryFn: () => opportunitiesApi.getScanDetails(scanId),
    enabled: !!scanId,
    refetchInterval: polling ? 3000 : false,
  });
}

/**
 * Start a new scan
 */
export function useStartScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: OpportunityScanRequest) => opportunitiesApi.startScan(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity-scans'] });
      queryClient.invalidateQueries({ queryKey: ['active-opportunity-scans'] });
    },
  });
}

/**
 * Cancel a scan
 */
export function useCancelScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scanId: string) => opportunitiesApi.cancelScan(scanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity-scans'] });
      queryClient.invalidateQueries({ queryKey: ['active-opportunity-scans'] });
    },
  });
}

// ===========================================
// Opportunities
// ===========================================

/**
 * Get opportunities (optionally filtered by status)
 */
export function useOpportunities(status?: OpportunityStatus, limit?: number) {
  return useQuery({
    queryKey: ['opportunities', status, limit],
    queryFn: () => opportunitiesApi.getOpportunities(status, limit),
    staleTime: 30000,
  });
}

/**
 * Get pending opportunities (default view)
 */
export function usePendingOpportunities(limit?: number) {
  return useOpportunities('pending', limit);
}

/**
 * Get opportunity statistics
 */
export function useOpportunityStats() {
  return useQuery({
    queryKey: ['opportunity-stats'],
    queryFn: () => opportunitiesApi.getStats(),
    staleTime: 60000,
  });
}

/**
 * Get opportunity details
 */
export function useOpportunityDetails(opportunityId: string) {
  return useQuery({
    queryKey: ['opportunity', opportunityId],
    queryFn: () => opportunitiesApi.getOpportunityDetails(opportunityId),
    enabled: !!opportunityId,
  });
}

/**
 * Approve an opportunity
 */
export function useApproveOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      opportunityId,
      request,
    }: {
      opportunityId: string;
      request?: ApproveOpportunityRequest;
    }) => opportunitiesApi.approveOpportunity(opportunityId, request),
    onSuccess: (_, { opportunityId }) => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['opportunity-stats'] });
      // Also refresh task lists since a new task was created
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
    },
  });
}

/**
 * Reject an opportunity
 */
export function useRejectOpportunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      opportunityId,
      request,
    }: {
      opportunityId: string;
      request?: RejectOpportunityRequest;
    }) => opportunitiesApi.rejectOpportunity(opportunityId, request),
    onSuccess: (_, { opportunityId }) => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
      queryClient.invalidateQueries({ queryKey: ['opportunity-stats'] });
    },
  });
}

// ===========================================
// Research
// ===========================================

/**
 * Start a new research
 */
export function useStartResearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ResearchOpportunityRequest) => opportunitiesApi.startResearch(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['researches'] });
      queryClient.invalidateQueries({ queryKey: ['active-researches'] });
    },
  });
}

/**
 * Get research history
 */
export function useResearchHistory(limit?: number) {
  return useQuery({
    queryKey: ['researches', limit],
    queryFn: () => opportunitiesApi.getResearchHistory(limit),
    staleTime: 30000,
  });
}

/**
 * Get active researches with polling
 */
export function useActiveResearches(polling: boolean = false) {
  return useQuery({
    queryKey: ['active-researches'],
    queryFn: () => opportunitiesApi.getActiveResearches(),
    refetchInterval: polling ? 5000 : false,
  });
}

/**
 * Get research details
 */
export function useResearchDetails(researchId: string, polling: boolean = false) {
  return useQuery({
    queryKey: ['research', researchId],
    queryFn: () => opportunitiesApi.getResearchDetails(researchId),
    enabled: !!researchId,
    refetchInterval: polling ? 3000 : false,
  });
}

/**
 * Cancel a research
 */
export function useCancelResearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (researchId: string) => opportunitiesApi.cancelResearch(researchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['researches'] });
      queryClient.invalidateQueries({ queryKey: ['active-researches'] });
    },
  });
}
