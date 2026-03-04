'use client';

import React from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
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
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {VIEWS.map((view) => {
        const Icon = view.icon;
        const isActive = currentView === view.id;

        return (
          <button
            key={view.id}
            onClick={() => setView(view.id)}
            title={view.description}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px',
              fontSize: 13, fontWeight: isActive ? 600 : 500,
              color: isActive ? '#111827' : '#9CA3AF',
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid #111827' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 150ms ease',
              whiteSpace: 'nowrap',
            }}
          >
            <Icon style={{ width: 14, height: 14 }} />
            <span>{view.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default FailuresViewSelector;
