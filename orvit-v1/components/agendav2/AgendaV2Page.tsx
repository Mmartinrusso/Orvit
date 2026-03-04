'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAgendaV2Header } from './AgendaV2HeaderContext';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import type { AgendaTask, AgendaTaskStatus, AgendaStats, CreateAgendaTaskInput, UpdateAgendaTaskInput } from '@/lib/agenda/types';
import { BoardView } from './BoardView';
import { useIsMobile } from '@/hooks/use-is-mobile';

const InboxView = dynamic(() => import('./InboxView').then(m => ({ default: m.InboxView })), { ssr: false });
const DashboardView = dynamic(() => import('./DashboardView').then(m => ({ default: m.DashboardView })), { ssr: false });
const ReportingView = dynamic(() => import('./ReportingView').then(m => ({ default: m.ReportingView })), { ssr: false });
const PortfolioView = dynamic(() => import('./PortfolioView').then(m => ({ default: m.PortfolioView })), { ssr: false });
const FixedTasksView = dynamic(() => import('./FixedTasksView').then(m => ({ default: m.FixedTasksView })), { ssr: false });
const TaskDetailPanel = dynamic(() => import('./TaskDetailPanel').then(m => ({ default: m.TaskDetailPanel })), { ssr: false });
const AgendaMobilePage = dynamic(() => import('./mobile/AgendaMobilePage').then(m => ({ default: m.AgendaMobilePage })), { ssr: false });
const CreateTaskModal = dynamic(() => import('./CreateTaskModal').then(m => ({ default: m.CreateTaskModal })), { ssr: false });
import { type TaskGroupItem } from './AgendaV2Sidebar';
import { CreateGroupModal, type CreateGroupInput } from './CreateGroupModal';
import { useAgendaSidebar } from '@/contexts/AgendaSidebarContext';

export type ViewMode = 'board' | 'inbox' | 'dashboard' | 'reporting' | 'portfolio' | 'fixed-tasks';

const VIEW_LABEL: Record<ViewMode, string> = {
  board:         'Mis Tareas',
  inbox:         'Bandeja',
  dashboard:     'Dashboard',
  reporting:     'Reportes',
  portfolio:     'Portfolio',
  'fixed-tasks': 'Tareas Fijas',
};

// ── API helpers ──────────────────────────────────────────────────────────────

async function fetchTasks(companyId: number): Promise<AgendaTask[]> {
  const res = await fetch(`/api/agenda/tasks?companyId=${companyId}&pageSize=200`);
  if (!res.ok) throw new Error('Error al cargar tareas');
  const data = await res.json();
  const raw = data?.data ?? data?.tasks ?? data;
  return Array.isArray(raw) ? raw : [];
}

async function fetchStats(companyId: number): Promise<AgendaStats> {
  const res = await fetch(`/api/agenda/stats?companyId=${companyId}`);
  if (!res.ok) throw new Error('Error al cargar stats');
  return res.json();
}

async function updateTaskStatus(taskId: number, status: AgendaTaskStatus) {
  const res = await fetch(`/api/agenda/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Error al actualizar tarea');
  return res.json();
}

async function createTask(data: CreateAgendaTaskInput & { status?: AgendaTaskStatus }) {
  const res = await fetch('/api/agenda/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al crear tarea');
  return res.json();
}

async function deleteTask(taskId: number) {
  const res = await fetch(`/api/agenda/tasks/${taskId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error al eliminar tarea');
  return res.json().catch(() => null);
}

async function duplicateTask(taskId: number) {
  const res = await fetch(`/api/agenda/tasks/${taskId}/duplicate`, { method: 'POST' });
  if (!res.ok) throw new Error('Error al duplicar tarea');
  return res.json();
}

async function updateTask(taskId: number, data: Partial<UpdateAgendaTaskInput>) {
  const res = await fetch(`/api/agenda/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al actualizar tarea');
  return res.json();
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AgendaV2Page() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const { setAgendaSidebar } = useAgendaSidebar();
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlView = searchParams.get('view') as ViewMode | null;
  const [view, setView] = useState<ViewMode>(urlView && VIEW_LABEL[urlView] ? urlView : 'board');
  const [viewAnimKey, setViewAnimKey] = useState(0);
  const agendaHeader = useAgendaV2Header();
  const search = agendaHeader?.search ?? '';
  const [selectedTask, setSelectedTask] = useState<AgendaTask | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  const changeView = useCallback((newView: ViewMode) => {
    setView(newView);
    setSelectedGroupId(null);
    setViewAnimKey(k => k + 1);
    const params = new URLSearchParams(searchParams.toString());
    if (newView === 'board') params.delete('view');
    else params.set('view', newView);
    router.replace(`/administracion/agenda${params.size ? '?' + params.toString() : ''}`, { scroll: false });
  }, [searchParams, router]);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [createGroupIsProject, setCreateGroupIsProject] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<AgendaTaskStatus>('PENDING');
  const [createDefaultDate, setCreateDefaultDate] = useState<string | undefined>(undefined);
  const [editingTask, setEditingTask] = useState<AgendaTask | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [newestTaskId, setNewestTaskId] = useState<number | null>(null);

  const companyId = currentCompany?.id;

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: rawTasks, isLoading: loadingTasks } = useQuery<AgendaTask[]>({
    queryKey: ['agendav2-tasks', companyId],
    queryFn: () => fetchTasks(companyId!),
    enabled: !!companyId,
    staleTime: 30_000,
  });

  const { data: stats } = useQuery<AgendaStats>({
    queryKey: ['agendav2-stats', companyId],
    queryFn: () => fetchStats(companyId!),
    enabled: !!companyId,
    staleTime: 60_000,
  });

  const { data: rawGroups, isLoading: loadingGroups } = useQuery<TaskGroupItem[]>({
    queryKey: ['agendav2-groups', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/agenda/task-groups?companyId=${companyId}`);
      if (!res.ok) throw new Error('Error al cargar grupos');
      return res.json();
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: AgendaTaskStatus }) =>
      updateTaskStatus(taskId, status),
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: ['agendav2-tasks', companyId] });
      queryClient.invalidateQueries({ queryKey: ['agendav2-stats', companyId] });
      if (updatedTask?.id && selectedTask?.id === updatedTask.id) setSelectedTask(updatedTask);
    },
    onError: () => toast.error('Error al actualizar el estado'),
  });

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({ queryKey: ['agendav2-tasks', companyId] });
      queryClient.invalidateQueries({ queryKey: ['agendav2-stats', companyId] });
      setIsCreateOpen(false);
      toast.success('Tarea creada');
      if (newTask?.id) {
        setNewestTaskId(newTask.id);
        setTimeout(() => setNewestTaskId(null), 1500);
      }
    },
    onError: () => toast.error('Error al crear la tarea'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendav2-tasks', companyId] });
      queryClient.invalidateQueries({ queryKey: ['agendav2-stats', companyId] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map(id => deleteTask(id))),
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['agendav2-tasks', companyId] });
      queryClient.invalidateQueries({ queryKey: ['agendav2-stats', companyId] });
      toast.success(`${ids.length} tarea${ids.length !== 1 ? 's' : ''} eliminada${ids.length !== 1 ? 's' : ''}`);
    },
    onError: () => toast.error('Error al eliminar las tareas'),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<UpdateAgendaTaskInput> }) =>
      updateTask(id, data),
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: ['agendav2-tasks', companyId] });
      queryClient.invalidateQueries({ queryKey: ['agendav2-stats', companyId] });
      setIsEditOpen(false);
      setEditingTask(null);
      toast.success('Tarea actualizada');
      if (updatedTask?.id && selectedTask?.id === updatedTask.id) setSelectedTask(updatedTask);
    },
    onError: () => toast.error('Error al actualizar la tarea'),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: number) => duplicateTask(id),
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({ queryKey: ['agendav2-tasks', companyId] });
      queryClient.invalidateQueries({ queryKey: ['agendav2-stats', companyId] });
      toast.success(`Tarea duplicada${newTask?.title ? `: "${newTask.title}"` : ''}`);
    },
    onError: () => toast.error('Error al duplicar la tarea'),
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data: CreateGroupInput) => {
      const res = await fetch('/api/agenda/task-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, companyId }),
      });
      if (!res.ok) throw new Error('Error al crear grupo');
      return res.json();
    },
    onSuccess: (newGroup) => {
      queryClient.invalidateQueries({ queryKey: ['agendav2-groups', companyId] });
      toast.success(`${newGroup.isProject ? 'Proyecto' : 'Grupo'} "${newGroup.name}" creado`);
      setSelectedGroupId(newGroup.id);
      changeView('board');
    },
    onError: () => toast.error('Error al crear grupo'),
  });

  const editGroupMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name: string } }) => {
      const res = await fetch(`/api/agenda/task-groups/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Error al editar grupo');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendav2-groups', companyId] });
      toast.success('Grupo actualizado');
    },
    onError: () => toast.error('Error al editar grupo'),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/agenda/task-groups/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar grupo');
      return res.json().catch(() => null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendav2-groups', companyId] });
      queryClient.invalidateQueries({ queryKey: ['agendav2-tasks', companyId] });
      toast.success('Grupo eliminado');
    },
    onError: () => toast.error('Error al eliminar grupo'),
  });

  // Sync loading state to header context (shows spinner in PageHeader)
  const setIsLoading = agendaHeader?.setIsLoading;
  useEffect(() => { setIsLoading?.(loadingTasks); }, [loadingTasks, setIsLoading]);

  // ── Derived data (early, needed for context sync) ──────────────────────────
  const safeTasks: AgendaTask[] = useMemo(
    () => Array.isArray(rawTasks) ? rawTasks : [],
    [rawTasks]
  );
  const groups: TaskGroupItem[] = useMemo(() => rawGroups ?? [], [rawGroups]);

  const filteredTasks = useMemo(() => {
    let tasks = safeTasks;

    // Filter by selected group
    if (selectedGroupId !== null) {
      tasks = tasks.filter(t => t.groupId === selectedGroupId);
    }

    // Filter by search
    if (search.trim()) {
      const lower = search.toLowerCase();
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(lower) ||
        (t.description || '').toLowerCase().includes(lower) ||
        (t.category || '').toLowerCase().includes(lower)
      );
    }
    return tasks;
  }, [safeTasks, search, selectedGroupId]);

  // Label for the active view/group
  const pageTitle = selectedGroupId
    ? (groups.find(g => g.id === selectedGroupId)?.name ?? VIEW_LABEL[view])
    : VIEW_LABEL[view];

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleTaskClick(task: AgendaTask) {
    setSelectedTask(task);
    setIsDetailOpen(true);
  }

  async function handleStatusChange(taskId: number, status: AgendaTaskStatus) {
    await statusMutation.mutateAsync({ taskId, status });
  }

  async function handleTaskDelete(task: AgendaTask) {
    try {
      await deleteMutation.mutateAsync(task.id);
      toast.success('Tarea eliminada');
      if (selectedTask?.id === task.id) {
        setIsDetailOpen(false);
        setSelectedTask(null);
      }
    } catch {
      toast.error('Error al eliminar la tarea');
    }
  }

  async function handleBulkDelete(ids: number[]) {
    await bulkDeleteMutation.mutateAsync(ids);
  }

  function handleEditTask(task: AgendaTask) {
    setEditingTask(task);
    setIsEditOpen(true);
  }

  function handleCreateTask(status: AgendaTaskStatus, date?: string) {
    setCreateDefaultStatus(status);
    setCreateDefaultDate(date);
    setIsCreateOpen(true);
  }

  async function handleDuplicateTask(task: AgendaTask) {
    await duplicateMutation.mutateAsync(task.id);
  }

  // ── Sync agenda sidebar state to context (renders in main Sidebar.tsx) ─────
  // Skip on mobile — mobile has its own navigation (BottomNav + AgendaDrawer)
  useEffect(() => {
    if (isMobile) {
      setAgendaSidebar(null);
      return;
    }
    setAgendaSidebar({
      view,
      tasks: safeTasks,
      groups,
      selectedGroupId,
      loadingGroups: loadingGroups ?? false,
      onViewChange: (v) => { changeView(v); },
      onCreateTask: () => handleCreateTask('PENDING'),
      onSelectGroup: setSelectedGroupId,
      onCreateGroup: (isProject) => {
        setCreateGroupIsProject(isProject);
        setIsCreateGroupOpen(true);
      },
      onEditGroup: (group) => {
        const newName = prompt('Nuevo nombre del grupo:', group.name);
        if (newName && newName.trim() && newName.trim() !== group.name) {
          editGroupMutation.mutate({ id: group.id, data: { name: newName.trim() } });
        }
      },
      onDeleteGroup: (group) => {
        if (confirm(`¿Eliminar el grupo "${group.name}"? Las tareas del grupo no se eliminarán.`)) {
          deleteGroupMutation.mutate(group.id);
          if (selectedGroupId === group.id) setSelectedGroupId(null);
        }
      },
    });
    return () => setAgendaSidebar(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, safeTasks, groups, selectedGroupId, loadingGroups, setAgendaSidebar, changeView, isMobile]);

  // ── Mobile render ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <AgendaMobilePage
          tasks={safeTasks}
          stats={stats}
          groups={groups}
          loadingGroups={loadingGroups}
          isLoading={loadingTasks}
          onToggleComplete={(taskId) => {
            const task = safeTasks.find((t) => t.id === taskId);
            const newStatus: AgendaTaskStatus =
              task?.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
            statusMutation.mutate({ taskId, status: newStatus });
          }}
          onCreateTask={() => setIsCreateOpen(true)}
          onStatusChange={(taskId, status) => statusMutation.mutate({ taskId, status })}
          onEditTask={handleEditTask}
          onDeleteTask={handleTaskDelete}
          onDuplicateTask={handleDuplicateTask}
          onSelectGroup={setSelectedGroupId}
          onCreateGroup={(isProject) => {
            setCreateGroupIsProject(isProject);
            setIsCreateGroupOpen(true);
          }}
        />
        {/* Create task modal — shared with desktop */}
        <CreateTaskModal
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          defaultStatus={createDefaultStatus}
          defaultDate={createDefaultDate}
          defaultGroupId={selectedGroupId}
          groups={groups}
          onSave={async (data) => { await createMutation.mutateAsync({ ...data, companyId: companyId! }); }}
          isSaving={createMutation.isPending}
          onRequestCreateGroup={() => setIsCreateGroupOpen(true)}
        />
        {/* Edit task modal — shared with desktop */}
        <CreateTaskModal
          open={isEditOpen}
          onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditingTask(null); }}
          editTask={editingTask ?? undefined}
          groups={groups}
          onSave={async (data) => {
            if (!editingTask) return;
            await editMutation.mutateAsync({
              id: editingTask.id,
              data: {
                title: data.title,
                description: data.description,
                priority: data.priority,
                dueDate: data.dueDate ?? null,
                category: data.category,
                status: data.status,
                assignedToUserId: data.assignedToUserId ?? null,
                groupId: data.groupId ?? null,
                isCompanyVisible: data.isCompanyVisible,
              },
            });
          }}
          isSaving={editMutation.isPending}
          onRequestCreateGroup={() => setIsCreateGroupOpen(true)}
        />
        <CreateGroupModal
          open={isCreateGroupOpen}
          defaultIsProject={createGroupIsProject}
          companyId={companyId ?? 0}
          onClose={() => setIsCreateGroupOpen(false)}
          onConfirm={async (data) => { await createGroupMutation.mutateAsync(data); }}
        />
      </>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex bg-background"
      style={{
        height: 'calc(100vh - 4rem)',
        overflow: 'hidden',
      }}
    >
      {/* Main panel — position:relative so expanded panel covers only this area */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden', position: 'relative' }}>
        {/* Content + inline detail panel */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Scrollable main content */}
          <div
            key={`view-${view}-${viewAnimKey}`}
            className="bg-background"
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '20px',
              animation: 'view-fade-in 220ms cubic-bezier(0.22,1,0.36,1) both',
            }}
          >
            <style>{`@keyframes view-fade-in { from { opacity:0; transform:translateY(7px); } to { opacity:1; transform:translateY(0); } }`}</style>
            {/* Page title row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {selectedGroupId && (
                  <span
                    style={{
                      display: 'inline-block', width: '10px', height: '10px',
                      borderRadius: '50%', flexShrink: 0,
                      background: groups.find(g => g.id === selectedGroupId)?.color ?? '#6366f1',
                    }}
                  />
                )}
                <h1 className="text-lg font-bold text-foreground">{pageTitle}</h1>
                {selectedGroupId && (
                  <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {groups.find(g => g.id === selectedGroupId)?.isProject ? 'Proyecto' : 'Grupo'}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {filteredTasks.length} tarea{filteredTasks.length !== 1 ? 's' : ''}
              </p>
            </div>

            {view === 'board' && (
              <BoardView
                tasks={filteredTasks}
                onTaskClick={handleTaskClick}
                onTaskStatusChange={handleStatusChange}
                onTaskDelete={handleTaskDelete}
                onEditTask={handleEditTask}
                onBulkDelete={handleBulkDelete}
                onDuplicateTask={handleDuplicateTask}
                onCreateTask={handleCreateTask}
                isLoading={loadingTasks}
                newestTaskId={newestTaskId}
              />
            )}

            {view === 'inbox' && (
              <InboxView
                tasks={filteredTasks}
                onTaskClick={handleTaskClick}
                onEdit={handleEditTask}
              />
            )}

            {view === 'dashboard' && (
              <DashboardView
                tasks={filteredTasks}
                stats={stats}
                isLoading={loadingTasks}
                onCreateTask={() => setIsCreateOpen(true)}
                onViewChange={(v) => changeView(v as ViewMode)}
                onTaskClick={handleTaskClick}
              />
            )}

            {view === 'reporting' && (
              <ReportingView
                tasks={safeTasks}
                stats={stats}
                isLoading={loadingTasks}
              />
            )}

            {view === 'portfolio' && (
              <PortfolioView
                groups={groups}
                tasks={safeTasks}
                onSelectGroup={(id) => {
                  setSelectedGroupId(id);
                  changeView('board');
                }}
                onCreateGroup={(isProject) => {
                  setCreateGroupIsProject(isProject);
                  setIsCreateGroupOpen(true);
                }}
                loadingGroups={loadingGroups}
              />
            )}

            {view === 'fixed-tasks' && (
              <FixedTasksView />
            )}
          </div>
        </div>
      </div>

      {/* Task detail modal — centered overlay */}
      <TaskDetailPanel
        task={selectedTask}
        open={isDetailOpen}
        onClose={() => { setIsDetailOpen(false); setIsPanelExpanded(false); }}
        expanded={isPanelExpanded}
        onExpandedChange={setIsPanelExpanded}
        groups={groups}
        onStatusChange={async (task, status) => {
          await handleStatusChange(task.id, status);
        }}
        onEdit={(task) => {
          setIsDetailOpen(false);
          handleEditTask(task);
        }}
        onDuplicate={handleDuplicateTask}
        onDelete={handleTaskDelete}
        onTaskUpdate={async (task, data) => {
          await editMutation.mutateAsync({ id: task.id, data: data as Partial<UpdateAgendaTaskInput> });
        }}
      />

      {/* Create task modal */}
      <CreateTaskModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        defaultStatus={createDefaultStatus}
        defaultDate={createDefaultDate}
        defaultGroupId={selectedGroupId}
        groups={groups}
        onSave={async (data) => { await createMutation.mutateAsync({ ...data, companyId: companyId! }); }}
        isSaving={createMutation.isPending}
        onRequestCreateGroup={() => setIsCreateGroupOpen(true)}
      />

      {/* Edit task modal */}
      <CreateTaskModal
        open={isEditOpen}
        onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditingTask(null); }}
        editTask={editingTask ?? undefined}
        groups={groups}
        onSave={async (data) => {
          if (!editingTask) return;
          await editMutation.mutateAsync({
            id: editingTask.id,
            data: {
              title: data.title,
              description: data.description,
              priority: data.priority,
              dueDate: data.dueDate ?? null,
              category: data.category,
              status: data.status,
              assignedToUserId: data.assignedToUserId ?? null,
              groupId: data.groupId ?? null,
              isCompanyVisible: data.isCompanyVisible,
            },
          });
        }}
        isSaving={editMutation.isPending}
        onRequestCreateGroup={() => setIsCreateGroupOpen(true)}
      />

      {/* Create group / project modal */}
      <CreateGroupModal
        open={isCreateGroupOpen}
        defaultIsProject={createGroupIsProject}
        companyId={companyId ?? 0}
        onClose={() => setIsCreateGroupOpen(false)}
        onConfirm={async (data) => {
          await createGroupMutation.mutateAsync(data);
        }}
      />
    </div>
  );
}
