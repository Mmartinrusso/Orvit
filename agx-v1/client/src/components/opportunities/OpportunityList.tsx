import { Lightbulb } from 'lucide-react';
import { OpportunityCard } from './OpportunityCard';
import { Spinner, EmptyState } from '@/components/common';
import type { Opportunity, ModelType, PipelineMode } from '@/api/types';

interface OpportunityListProps {
  opportunities: Opportunity[];
  isLoading: boolean;
  onApprove: (opportunityId: string, model?: ModelType, pipelineMode?: PipelineMode) => void;
  onReject: (opportunityId: string, reason?: string) => void;
  approvingIds?: Set<string>;
  rejectingIds?: Set<string>;
  emptyMessage?: string;
}

export function OpportunityList({
  opportunities,
  isLoading,
  onApprove,
  onReject,
  approvingIds = new Set(),
  rejectingIds = new Set(),
  emptyMessage = 'No hay oportunidades pendientes',
}: OpportunityListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <EmptyState
        icon={<Lightbulb className="h-12 w-12" />}
        title="Sin oportunidades"
        description={emptyMessage}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {opportunities.map((opportunity) => (
        <OpportunityCard
          key={opportunity.opportunity_id}
          opportunity={opportunity}
          onApprove={onApprove}
          onReject={onReject}
          isApproving={approvingIds.has(opportunity.opportunity_id)}
          isRejecting={rejectingIds.has(opportunity.opportunity_id)}
        />
      ))}
    </div>
  );
}
