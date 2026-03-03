'use client';

import { useState } from 'react';
import { AgendaMobileLayout } from './AgendaMobileLayout';
import { AgendaHomeScreen } from './AgendaHomeScreen';
import { TaskDetailMobile } from './TaskDetailMobile';
import type { MobileTab } from './BottomNav';
import type { AgendaTask } from '@/lib/agenda/types';

interface AgendaMobilePageProps {
  tasks: AgendaTask[];
  onToggleComplete: (taskId: number) => void;
  onCreateTask: () => void;
}

export function AgendaMobilePage({ tasks, onToggleComplete, onCreateTask }: AgendaMobilePageProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [selectedTask, setSelectedTask] = useState<AgendaTask | null>(null);

  if (selectedTask) {
    return (
      <TaskDetailMobile
        task={selectedTask}
        members={[]} // TODO: pass real members from props
        onBack={() => setSelectedTask(null)}
        onRefresh={() => setSelectedTask(null)}
      />
    );
  }

  return (
    <AgendaMobileLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onCreateTask={onCreateTask}
    >
      {activeTab === 'home' && (
        <AgendaHomeScreen
          tasks={tasks}
          onTaskTap={(task) => setSelectedTask(task)}
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
