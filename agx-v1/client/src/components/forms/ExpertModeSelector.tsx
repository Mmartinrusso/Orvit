import { Monitor, Server, Layers, FlaskConical, Shield, Zap, Wrench } from 'lucide-react';
import { cn } from '@/utils';
import type { ExpertMode } from '@/api';

interface ExpertModeSelectorProps {
  value: ExpertMode;
  onChange: (mode: ExpertMode) => void;
}

const modes: Array<{ mode: ExpertMode; icon: typeof Zap; label: string; color: string }> = [
  { mode: 'general', icon: Zap, label: 'General', color: 'text-blue-500 bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30' },
  { mode: 'frontend', icon: Monitor, label: 'Frontend', color: 'text-violet-500 bg-violet-50 border-violet-200 dark:bg-violet-500/10 dark:border-violet-500/30' },
  { mode: 'backend', icon: Server, label: 'Backend', color: 'text-green-500 bg-green-50 border-green-200 dark:bg-green-500/10 dark:border-green-500/30' },
  { mode: 'fullstack', icon: Layers, label: 'Full-Stack', color: 'text-indigo-500 bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/30' },
  { mode: 'testing', icon: FlaskConical, label: 'Testing', color: 'text-amber-500 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30' },
  { mode: 'devops', icon: Wrench, label: 'DevOps', color: 'text-teal-500 bg-teal-50 border-teal-200 dark:bg-teal-500/10 dark:border-teal-500/30' },
  { mode: 'security', icon: Shield, label: 'Security', color: 'text-red-500 bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/30' },
];

export function ExpertModeSelector({ value, onChange }: ExpertModeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {modes.map(({ mode, icon: Icon, label, color }) => {
        const isSelected = value === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-150',
              isSelected
                ? color
                : 'text-slate-400 bg-transparent border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
