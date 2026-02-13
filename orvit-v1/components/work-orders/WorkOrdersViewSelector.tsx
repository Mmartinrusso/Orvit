'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutList, Kanban, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCallback } from 'react';

export type WorkOrderView = 'lista' | 'bandeja' | 'calendario';

interface WorkOrdersViewSelectorProps {
  className?: string;
}

const VIEW_OPTIONS: { value: WorkOrderView; label: string; icon: typeof LayoutList }[] = [
  { value: 'lista', label: 'Lista', icon: LayoutList },
  { value: 'bandeja', label: 'Bandeja', icon: Kanban },
  { value: 'calendario', label: 'Calendario', icon: Calendar },
];

export function WorkOrdersViewSelector({ className }: WorkOrdersViewSelectorProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const currentView = (searchParams.get('view') as WorkOrderView) || 'lista';

  const handleViewChange = useCallback((newView: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (newView === 'lista') {
      // Default view - remove from URL to keep it clean
      params.delete('view');
    } else {
      params.set('view', newView);
    }

    // Preserve other params like preset
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  return (
    <Tabs value={currentView} onValueChange={handleViewChange} className={cn('w-fit', className)}>
      <TabsList className="h-9 p-1 bg-muted/50">
        {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="h-7 px-3 gap-1.5 text-xs font-normal data-[state=active]:font-medium"
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

// Hook para usar el view desde otros componentes
export function useWorkOrdersView(): WorkOrderView {
  const searchParams = useSearchParams();
  return (searchParams.get('view') as WorkOrderView) || 'lista';
}
