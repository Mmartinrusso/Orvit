'use client';

import { type ReactNode } from 'react';
import { BottomNav, type MobileTab } from './BottomNav';

interface AgendaMobileLayoutProps {
  children: ReactNode;
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  onCreateTask: () => void;
  onMenuPress: () => void;
  hideNav?: boolean;
}

export function AgendaMobileLayout({
  children,
  activeTab,
  onTabChange,
  onCreateTask,
  onMenuPress,
  hideNav,
}: AgendaMobileLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>
      <BottomNav
        activeTab={activeTab}
        onTabChange={onTabChange}
        onCreateTask={onCreateTask}
        onMenuPress={onMenuPress}
        hidden={hideNav}
      />
    </div>
  );
}
