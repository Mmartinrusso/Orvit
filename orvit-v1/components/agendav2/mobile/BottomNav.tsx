'use client';

import { CircleUserRound, ClipboardList, Plus, PieChart, AlignJustify } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileTab = 'home' | 'board' | 'dashboard' | 'more';

interface BottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  onCreateTask: () => void;
  onMenuPress: () => void;
  hidden?: boolean;
}

const LEFT_TABS = [
  { id: 'home' as const, icon: CircleUserRound, label: 'Mi día' },
  { id: 'board' as const, icon: ClipboardList, label: 'Tareas' },
];

const RIGHT_TABS = [
  { id: 'dashboard' as const, icon: PieChart, label: 'Resumen' },
  { id: 'more' as const, icon: AlignJustify, label: 'Menú' },
];

export function BottomNav({ activeTab, onTabChange, onCreateTask, onMenuPress, hidden }: BottomNavProps) {
  const handlePress = (id: MobileTab) => {
    if (id === 'more') {
      onMenuPress();
    } else {
      onTabChange(id);
    }
  };

  const renderTab = (tab: { id: MobileTab; icon: typeof CircleUserRound; label: string }) => {
    const isActive = activeTab === tab.id && tab.id !== 'more';

    return (
      <button
        key={tab.id}
        onClick={() => handlePress(tab.id)}
        className={cn(
          'relative flex flex-col items-center gap-1 flex-1 pt-2.5 pb-1 group transition-all duration-200',
          'active:opacity-70'
        )}
      >
        <tab.icon
          className={cn(
            'h-[22px] w-[22px] transition-colors duration-200',
            isActive ? 'text-foreground' : 'text-muted-foreground/50'
          )}
          strokeWidth={isActive ? 2 : 1.5}
        />
        <span
          className={cn(
            'text-[10px] leading-none transition-colors duration-200',
            isActive ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground/50'
          )}
        >
          {tab.label}
        </span>
      </button>
    );
  };

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out',
        hidden && 'translate-y-full pointer-events-none'
      )}
    >
      <div
        className="bg-background border-t border-border/50"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 6px)' }}
      >
        <div className="flex items-end">
          {LEFT_TABS.map(renderTab)}

          {/* Center FAB */}
          <div className="flex items-center justify-center flex-1 -mt-4 pb-1">
            <button
              onClick={onCreateTask}
              className={cn(
                'flex items-center justify-center w-[48px] h-[48px] rounded-full',
                'bg-foreground text-background',
                'shadow-sm active:scale-[0.92] transition-transform duration-150'
              )}
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>

          {RIGHT_TABS.map(renderTab)}
        </div>
      </div>
    </div>
  );
}
