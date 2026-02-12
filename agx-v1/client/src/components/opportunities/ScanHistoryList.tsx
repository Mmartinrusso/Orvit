import { useNavigate } from 'react-router-dom';
import { Search, Clock, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Card, Badge, Spinner, EmptyState, Button } from '@/components/common';
import type { OpportunityScan, OpportunityScanStatus } from '@/api/types';
import { formatRelativeTime, formatTokens } from '@/utils';
import { cn } from '@/utils';

interface ScanHistoryListProps {
  scans: OpportunityScan[];
  isLoading: boolean;
}

const statusConfig: Record<
  OpportunityScanStatus,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  pending: { icon: Clock, color: 'bg-gray-100 text-gray-700', label: 'Pendiente' },
  in_progress: { icon: Loader2, color: 'bg-blue-100 text-blue-700', label: 'En Progreso' },
  completed: { icon: CheckCircle, color: 'bg-green-100 text-green-700', label: 'Completado' },
  failed: { icon: XCircle, color: 'bg-red-100 text-red-700', label: 'Fallido' },
  cancelled: { icon: AlertTriangle, color: 'bg-yellow-100 text-yellow-700', label: 'Cancelado' },
};

export function ScanHistoryList({ scans, isLoading }: ScanHistoryListProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (scans.length === 0) {
    return (
      <EmptyState
        icon={<Search className="h-12 w-12" />}
        title="Sin scans"
        description="No hay scans de oportunidades registrados"
      />
    );
  }

  return (
    <div className="space-y-3">
      {scans.map((scan) => {
        const config = statusConfig[scan.status];
        const StatusIcon = config.icon;

        return (
          <Card
            key={scan.scan_id}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/opportunities/scan/${scan.scan_id}`)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn('p-2 rounded-lg', config.color)}>
                  <StatusIcon
                    className={cn(
                      'h-5 w-5',
                      scan.status === 'in_progress' && 'animate-spin'
                    )}
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-dark-text">
                      {scan.repo_url || (scan.repos_json && `${scan.repos_json.length} repos`)}
                    </span>
                    <Badge className={config.color}>{config.label}</Badge>
                  </div>

                  <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-dark-text-secondary mt-1">
                    {scan.created_at && <span>{formatRelativeTime(scan.created_at)}</span>}
                    {scan.status === 'completed' && (
                      <>
                        <span>|</span>
                        <span>{scan.opportunities_found} oportunidades</span>
                      </>
                    )}
                    {scan.total_tokens > 0 && (
                      <>
                        <span>|</span>
                        <span>{formatTokens(scan.total_tokens)} tokens</span>
                      </>
                    )}
                  </div>

                  {scan.focus_prompt && (
                    <p className="text-sm text-gray-500 dark:text-dark-text-secondary mt-1 line-clamp-1">
                      Enfoque: {scan.focus_prompt}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {scan.status === 'in_progress' && (
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 dark:bg-dark-hover rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${scan.progress}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 dark:text-dark-text-secondary">{scan.progress}%</span>
                  </div>
                )}

                <Button variant="ghost" size="sm">
                  Ver
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
