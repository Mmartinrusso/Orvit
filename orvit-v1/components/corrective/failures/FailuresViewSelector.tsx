'use client';

import React from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { List, Repeat, Copy } from 'lucide-react';

export type FailuresView = 'reportes' | 'reincidencias' | 'duplicados';

const VIEWS: { id: FailuresView; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'reportes', label: 'Reportes', icon: List, description: 'Lista de fallas reportadas' },
  { id: 'reincidencias', label: 'Reincidencias', icon: Repeat, description: 'Fallas recurrentes por máquina' },
  { id: 'duplicados', label: 'Duplicados', icon: Copy, description: 'Reportes duplicados por revisar' },
];

export function useFailuresView(): FailuresView {
  const searchParams = useSearchParams();
  const view = searchParams.get('view') as FailuresView;
  return view && ['reportes', 'reincidencias', 'duplicados'].includes(view) ? view : 'reportes';
}

export function useSetFailuresView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (view: FailuresView) => {
    const params = new URLSearchParams(searchParams.toString());

    if (view === 'reportes') {
      params.delete('view');
    } else {
      params.set('view', view);
    }

    // Mantener preset si existe
    const preset = params.get('preset');
    if (preset) {
      params.set('preset', preset);
    }

    const queryString = params.toString();
    router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
  };
}

interface FailuresViewSelectorProps {
  className?: string;
}

export function FailuresViewSelector({ className }: FailuresViewSelectorProps) {
  const currentView = useFailuresView();
  const setView = useSetFailuresView();

  return (
    <div className={cn('flex bg-muted/40 border border-border rounded-lg p-0.5', className)}>
      {VIEWS.map((view) => {
        const Icon = view.icon;
        const isActive = currentView === view.id;

        return (
          <button
            key={view.id}
            onClick={() => setView(view.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              'hover:text-foreground',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground'
            )}
            title={view.description}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{view.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default FailuresViewSelector;
