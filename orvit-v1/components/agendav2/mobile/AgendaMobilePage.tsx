'use client';

import { useState } from 'react';
import { AgendaMobileLayout } from './AgendaMobileLayout';
import { AgendaHomeScreen } from './AgendaHomeScreen';
import type { MobileTab } from './BottomNav';
import type { AgendaTask } from '@/lib/agenda/types';

interface AgendaMobilePageProps {
  tasks: AgendaTask[];
  onToggleComplete: (taskId: number) => void;
  onCreateTask: () => void;
}

export function AgendaMobilePage({ tasks, onToggleComplete, onCreateTask }: AgendaMobilePageProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');

  return (
    <AgendaMobileLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onCreateTask={onCreateTask}
    >
      {activeTab === 'home' && (
        <AgendaHomeScreen
          tasks={tasks}
          onTaskTap={(task) => {
            // TODO Task 13: push to full-screen task detail
            console.log('Open task:', task.id);
          }}
          onToggleComplete={onToggleComplete}
          onMenuOpen={() => {
            // TODO Task 14: open mobile drawer with AgendaV2Sidebar
          }}
        />
      )}
      {activeTab === 'tasks' && (
        <div className="p-4">
          <p className="text-sm text-muted-foreground text-center pt-8">
            Vista de tareas — próximamente
          </p>
        </div>
      )}
      {activeTab === 'dashboard' && (
        <div className="p-4">
          <p className="text-sm text-muted-foreground text-center pt-8">
            Dashboard — próximamente
          </p>
        </div>
      )}
      {activeTab === 'profile' && (
        <div className="p-4">
          <p className="text-sm text-muted-foreground text-center pt-8">
            Perfil — próximamente
          </p>
        </div>
      )}
    </AgendaMobileLayout>
  );
}
