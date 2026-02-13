'use client';

import React, { useRef, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { CalendarDays, Calendar, FileText, ClipboardCheck, BarChart3 } from 'lucide-react';

export type PreventivoView = 'hoy' | 'calendario' | 'planes' | 'checklists' | 'metricas';

const VIEWS: { id: PreventivoView; label: string; shortLabel: string; icon: React.ElementType; description: string }[] = [
  { id: 'hoy', label: 'Hoy', shortLabel: 'Hoy', icon: CalendarDays, description: 'Tareas pendientes y vencidas' },
  { id: 'calendario', label: 'Calendario', shortLabel: 'Calendario', icon: Calendar, description: 'Vista calendario de mantenimientos' },
  { id: 'planes', label: 'Planes', shortLabel: 'Planes', icon: FileText, description: 'Configuración de planes preventivos' },
  { id: 'checklists', label: 'Checklists', shortLabel: 'Checklists', icon: ClipboardCheck, description: 'Plantillas de checklists' },
  { id: 'metricas', label: 'Métricas', shortLabel: 'Métricas', icon: BarChart3, description: 'KPIs, ejecuciones y auditoría' },
];

export function usePreventivoView(): PreventivoView {
  const searchParams = useSearchParams();
  const view = searchParams.get('view') as PreventivoView;
  return view && VIEWS.some(v => v.id === view) ? view : 'hoy';
}

export function useSetPreventivoView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (view: PreventivoView) => {
    const params = new URLSearchParams(searchParams.toString());

    if (view === 'hoy') {
      params.delete('view');
    } else {
      params.set('view', view);
    }

    const queryString = params.toString();
    router.push(`${pathname}${queryString ? `?${queryString}` : ''}`);
  };
}

interface PreventivoViewSelectorProps {
  className?: string;
}

export function PreventivoViewSelector({ className }: PreventivoViewSelectorProps) {
  const currentView = usePreventivoView();
  const setView = useSetPreventivoView();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeButtonRef = useRef<HTMLButtonElement>(null);

  // Scroll al tab activo en móvil
  useEffect(() => {
    if (activeButtonRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const activeBtn = activeButtonRef.current;
      const containerRect = container.getBoundingClientRect();
      const btnRect = activeBtn.getBoundingClientRect();

      // Centrar el botón activo
      const scrollLeft = activeBtn.offsetLeft - (containerRect.width / 2) + (btnRect.width / 2);
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    }
  }, [currentView]);

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        'flex bg-muted/40 border border-border rounded-lg p-0.5',
        'overflow-x-auto scrollbar-hide',
        'md:overflow-visible',
        className
      )}
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {VIEWS.map((view) => {
        const Icon = view.icon;
        const isActive = currentView === view.id;

        return (
          <button
            key={view.id}
            ref={isActive ? activeButtonRef : null}
            onClick={() => setView(view.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap flex-shrink-0',
              'hover:text-foreground',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground'
            )}
            title={view.description}
          >
            <Icon className="h-3.5 w-3.5" />
            {/* Móvil: mostrar shortLabel, Desktop: mostrar label completo */}
            <span className="sm:hidden">{view.shortLabel}</span>
            <span className="hidden sm:inline">{view.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default PreventivoViewSelector;
