'use client';

import { type ReactNode } from 'react';
import { BottomNav, type MobileTab } from './BottomNav';

interface AgendaMobileLayoutProps {
  children: ReactNode;
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  onCreateTask: () => void;
}

export function AgendaMobileLayout({
  children,
  activeTab,
  onTabChange,
  onCreateTask,
}: AgendaMobileLayoutProps) {
  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ backgroundColor: '#F5F3EF' }}
    >
      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: '80px' }}>
        {children}
      </main>
      <BottomNav
        activeTab={activeTab}
        onTabChange={onTabChange}
        onCreateTask={onCreateTask}
      />
    </div>
  );
}
