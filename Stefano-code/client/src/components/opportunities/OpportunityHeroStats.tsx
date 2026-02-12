import { Lightbulb, Search, CheckCircle, TrendingUp } from 'lucide-react';
import { cn } from '@/utils';

interface OpportunityHeroStatsProps {
  pending: number;
  activeScans: number;
  approved: number;
  successRate: number;
}

export function OpportunityHeroStats({ pending, activeScans, approved, successRate }: OpportunityHeroStatsProps) {
  const stats = [
    {
      label: 'Pendientes',
      value: pending,
      icon: Lightbulb,
      color: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-500/10',
    },
    {
      label: 'Scans Activos',
      value: activeScans,
      icon: Search,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-500/10',
      pulse: activeScans > 0,
    },
    {
      label: 'Aprobadas',
      value: approved,
      icon: CheckCircle,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-500/10',
    },
    {
      label: 'Tasa de Exito',
      value: successRate,
      icon: TrendingUp,
      color: 'text-gray-600 dark:text-gray-400',
      bg: 'bg-gray-500/10',
      suffix: '%',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl bg-white dark:bg-dark-surface border border-slate-200/80 dark:border-slate-700/50 p-3.5 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3">
            <div className={cn('p-1.5 rounded-lg', stat.bg, stat.pulse && 'animate-pulse')}>
              <stat.icon className={cn('h-4 w-4', stat.color)} strokeWidth={1.5} />
            </div>
            <div>
              <p className={cn('text-lg font-bold tabular-nums leading-none', stat.color)}>
                {stat.value}{stat.suffix || ''}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">{stat.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
