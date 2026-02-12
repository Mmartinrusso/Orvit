import { Search, Sparkles, Clock, CheckCircle, XCircle, Loader2, AlertTriangle, Lightbulb } from 'lucide-react';
import { Badge } from '@/components/common';
import { cn } from '@/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface HistoryItem {
  id: string;
  type: 'scan' | 'research';
  status: string;
  created_at: string;
  description: string;
  model?: string;
  opportunities_count?: number;
}

interface UnifiedHistoryPanelProps {
  scans: any[];
  researches: any[];
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
    case 'in_progress': return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    default: return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function getStatusVariant(status: string): 'success' | 'error' | 'warning' | 'neutral' {
  switch (status) {
    case 'completed': return 'success';
    case 'failed': return 'error';
    case 'in_progress': return 'warning';
    default: return 'neutral';
  }
}

export function UnifiedHistoryPanel({ scans, researches }: UnifiedHistoryPanelProps) {
  // Merge and sort by date
  const items: HistoryItem[] = [
    ...scans.map(s => ({
      id: s.scan_id || s.id,
      type: 'scan' as const,
      status: s.status,
      created_at: s.created_at,
      description: s.focus_prompt || 'Scan general del proyecto',
      model: s.model,
      opportunities_count: s.opportunities_found || s.opportunities?.length,
    })),
    ...researches.map(r => ({
      id: r.research_id || r.id,
      type: 'research' as const,
      status: r.status,
      created_at: r.created_at,
      description: r.idea || r.focus_prompt || 'Investigacion',
      model: r.model,
      opportunities_count: r.opportunities_found || r.opportunities?.length,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-dark-text-secondary">
        No hay actividad reciente
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-hover">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-dark-text">Actividad Reciente</h3>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-dark-border max-h-80 overflow-y-auto">
        {items.map((item) => (
          <div key={`${item.type}-${item.id}`} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors">
            <div className={cn(
              'p-1.5 rounded-lg',
              item.type === 'scan' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-amber-50 dark:bg-amber-900/20'
            )}>
              {item.type === 'scan'
                ? <Search className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                : <Sparkles className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-dark-text truncate">{item.description}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-400">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: es })}
                </span>
                {item.model && <Badge variant="neutral" className="text-xs">{item.model}</Badge>}
                {item.opportunities_count != null && item.opportunities_count > 0 && (
                  <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <Lightbulb className="h-3 w-3" />
                    {item.opportunities_count} oportunidad{item.opportunities_count !== 1 ? 'es' : ''}
                  </span>
                )}
                {item.status === 'completed' && (item.opportunities_count === 0 || item.opportunities_count == null) && (
                  <span className="text-xs text-amber-500 dark:text-amber-400">0 oportunidades</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {item.status === 'completed' && item.opportunities_count === 0 ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <Badge variant="warning" className="text-xs">Sin resultados</Badge>
                </>
              ) : (
                <>
                  {getStatusIcon(item.status)}
                  <Badge variant={getStatusVariant(item.status)} className="text-xs">
                    {item.status === 'completed' ? 'Completado' : item.status === 'failed' ? 'Error' : item.status === 'in_progress' ? 'En curso' : item.status}
                  </Badge>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
