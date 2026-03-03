'use client';

import { useState } from 'react';
import { AgendaMobileLayout } from './AgendaMobileLayout';
import { AgendaHomeScreen } from './AgendaHomeScreen';
import { TaskDetailMobile } from './TaskDetailMobile';
import { AgendaDrawer } from './AgendaDrawer';
import { useAgendaSidebar } from '@/contexts/AgendaSidebarContext';
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Pull sidebar state from context (populated by AgendaV2Page via setAgendaSidebar)
  const { agendaSidebar } = useAgendaSidebar();

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
    <>
      {/* Left navigation drawer — renders AgendaV2Sidebar inside */}
      {agendaSidebar && (
        <AgendaDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          view={agendaSidebar.view}
          onViewChange={(v) => {
            agendaSidebar.onViewChange(v);
            setDrawerOpen(false);
          }}
          onCreateTask={() => {
            agendaSidebar.onCreateTask();
            setDrawerOpen(false);
          }}
          tasks={agendaSidebar.tasks}
          groups={agendaSidebar.groups}
          selectedGroupId={agendaSidebar.selectedGroupId}
          onSelectGroup={(id) => {
            agendaSidebar.onSelectGroup(id);
            setDrawerOpen(false);
          }}
          onCreateGroup={(isProject) => {
            agendaSidebar.onCreateGroup(isProject);
            setDrawerOpen(false);
          }}
          loadingGroups={agendaSidebar.loadingGroups}
        />
      )}

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
            onMenuOpen={() => setDrawerOpen(true)}
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
    </>
  );
}
