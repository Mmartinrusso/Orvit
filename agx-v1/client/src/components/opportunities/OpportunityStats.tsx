import {
  Lightbulb,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Card, Spinner } from '@/components/common';
import { cn } from '@/utils';

interface OpportunityStatsProps {
  stats: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    in_progress: number;
    completed: number;
    failed: number;
    by_category: Record<string, number>;
    by_priority: Record<string, number>;
  } | null;
  isLoading: boolean;
}

export function OpportunityStats({ stats, isLoading }: OpportunityStatsProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const statCards = [
    { label: 'Total', value: stats.total, icon: Lightbulb, color: 'bg-blue-100 text-blue-700' },
    { label: 'Pendientes', value: stats.pending, icon: Clock, color: 'bg-yellow-100 text-yellow-700' },
    { label: 'En Progreso', value: stats.in_progress, icon: Loader2, color: 'bg-indigo-100 text-indigo-700' },
    { label: 'Completadas', value: stats.completed, icon: CheckCircle, color: 'bg-green-100 text-green-700' },
    { label: 'Rechazadas', value: stats.rejected, icon: XCircle, color: 'bg-gray-100 text-gray-700' },
    { label: 'Fallidas', value: stats.failed, icon: AlertTriangle, color: 'bg-red-100 text-red-700' },
  ];

  const priorityColors: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-gray-400',
  };

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((stat) => (
          <Card key={stat.label} className="text-center">
            <div className={cn('inline-flex p-2 rounded-lg mb-2', stat.color)}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-dark-text">{stat.value}</div>
            <div className="text-sm text-gray-500 dark:text-dark-text-secondary">{stat.label}</div>
          </Card>
        ))}
      </div>

      {/* Priority Distribution */}
      {Object.keys(stats.by_priority).length > 0 && (
        <Card title="Por Prioridad">
          <div className="flex items-center gap-2">
            {Object.entries(stats.by_priority).map(([priority, count]) => (
              <div key={priority} className="flex items-center gap-2">
                <div className={cn('w-3 h-3 rounded-full', priorityColors[priority] || 'bg-gray-400')} />
                <span className="text-sm capitalize">{priority}: {count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Category Distribution */}
      {Object.keys(stats.by_category).length > 0 && (
        <Card title="Por Categoria">
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.by_category)
              .sort((a, b) => b[1] - a[1])
              .map(([category, count]) => (
                <span
                  key={category}
                  className="px-3 py-1 bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-dark-text rounded-full text-sm"
                >
                  {category.replace(/_/g, ' ')}: {count}
                </span>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
