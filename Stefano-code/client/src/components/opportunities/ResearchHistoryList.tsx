import { useNavigate } from 'react-router-dom';
import { Lightbulb, Clock, Coins, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { Card, Badge, Spinner, EmptyState } from '@/components/common';
import type { ResearchOpportunity } from '@/api/types';
import { formatRelativeTime, formatNumber } from '@/utils';

interface ResearchHistoryListProps {
  researches: ResearchOpportunity[];
  isLoading: boolean;
}

export function ResearchHistoryList({ researches, isLoading }: ResearchHistoryListProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      </Card>
    );
  }

  if (researches.length === 0) {
    return (
      <EmptyState
        icon={<Lightbulb className="h-12 w-12" />}
        title="Sin investigaciones"
        description="Aun no has investigado ninguna idea. Usa el formulario para empezar."
      />
    );
  }

  const getStatusBadge = (status: ResearchOpportunity['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="default">Pendiente</Badge>;
      case 'in_progress':
      case 'researching':
        return <Badge variant="warning">En Progreso</Badge>;
      case 'completed':
        return <Badge variant="success">Completado</Badge>;
      case 'failed':
        return <Badge variant="danger">Fallido</Badge>;
      case 'cancelled':
        return <Badge variant="default">Cancelado</Badge>;
    }
  };

  const getStatusIcon = (status: ResearchOpportunity['status']) => {
    switch (status) {
      case 'in_progress':
      case 'researching':
        return <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />;
      case 'completed':
        return <Lightbulb className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Lightbulb className="h-5 w-5 text-gray-400" />;
    }
  };

  const isResearching = (status: ResearchOpportunity['status']) =>
    status === 'researching' || status === 'in_progress';

  return (
    <div className="space-y-3">
      {researches.map((research) => (
        <Card
          key={research.research_id}
          className="hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => navigate(`/opportunities/research/${research.research_id}`)}
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              {getStatusIcon(research.status)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text truncate">
                  {research.result_json?.idea_summary || 'Investigacion sin titulo'}
                </h3>
                {getStatusBadge(research.status)}
              </div>

              <p className="text-sm text-gray-600 dark:text-dark-text-secondary line-clamp-2 mb-2">
                {research.idea}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-dark-text-secondary">
                {research.created_at && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(research.created_at)}
                  </div>
                )}
                {research.total_tokens > 0 && (
                  <div className="flex items-center gap-1">
                    <Coins className="h-3 w-3" />
                    {formatNumber(research.total_tokens)} tokens
                  </div>
                )}
                {isResearching(research.status) && (
                  <div className="flex items-center gap-1">
                    <div className="w-16 bg-gray-200 dark:bg-dark-hover rounded-full h-1.5">
                      <div
                        className="bg-yellow-500 h-1.5 rounded-full"
                        style={{ width: `${research.progress}%` }}
                      />
                    </div>
                    <span>{research.progress}%</span>
                  </div>
                )}
              </div>
            </div>

            <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
          </div>
        </Card>
      ))}
    </div>
  );
}
