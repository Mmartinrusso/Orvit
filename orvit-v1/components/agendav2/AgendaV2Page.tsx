'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAgendaV2Header } from './AgendaV2HeaderContext';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';
import type { AgendaTask, AgendaTaskStatus, AgendaStats, CreateAgendaTaskInput, UpdateAgendaTaskInput } from '@/lib/agenda/types';
import { BoardView } from './BoardView';
import { InboxView } from './InboxView';
import { DashboardView } from './DashboardView';
import { ReportingView } from './ReportingView';
import { PortfolioView } from './PortfolioView';
import { FixedTasksView } from './FixedTasksView';
import { TaskDetailPanel } from './TaskDetailPanel';
import { CreateTaskModal } from './CreateTaskModal';
import { AgendaV2Sidebar, type TaskGroupItem } from './AgendaV2Sidebar';
import { CreateGroupModal, type CreateGroupInput } from './CreateGroupModal';

export type ViewMode = 'board' | 'inbox' | 'dashboard' | 'reporting' | 'portfolio' | 'fixed-tasks';

const VIEW_LABEL: Record<ViewMode, string> = {
  board:         'Mi Tarea',
  inbox:         'Inbox',
  dashboard:     'Dashboard',
  reporting:     'Reporting',
  portfolio:     'Portfolio',
  'fixed-tasks': 'Tareas Fijas',
};

// ── Demo data (shown when API returns no tasks) ───────────────────────────────
// Dynamic dates relative to today so calendar shows populated + "today" indicator
function demoDate(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}
const DEMO_TASKS: AgendaTask[] = [
  // ── PENDING (To-do · 4) ── dates spread: D+4, D-2, D-3, D-1 ──────────────
  {
    id: 1001, title: 'Create Wireframe', description: 'Design low-fidelity wireframes for the main dashboard page', dueDate: demoDate(4),
    priority: 'HIGH', status: 'PENDING', category: 'ABC Dashboard',
    createdById: 1, createdBy: { id: 1, name: 'Joe Doe' },
    assignedToUserId: 2, assignedToUser: { id: 2, name: 'Jhon Els' },
    assignedToContactId: null, assignedToName: 'Jhon Els',
    source: 'WEB', discordMessageId: null, companyId: 1,
    notes: null, completedAt: null, completedNote: null,
    createdAt: '2026-02-10T09:00:00Z', updatedAt: '2026-02-12T10:00:00Z',
  },
  {
    id: 1002, title: 'Client Feedback', description: 'Collect feedback from the client about the visual proposal', dueDate: demoDate(-2),
    priority: 'MEDIUM', status: 'PENDING', category: 'Twinkle Website',
    createdById: 2, createdBy: { id: 2, name: 'Jhon Els' },
    assignedToUserId: 3, assignedToUser: { id: 3, name: 'Nando Endae' },
    assignedToContactId: null, assignedToName: 'Nando Endae',
    source: 'WEB', discordMessageId: null, companyId: 1,
    notes: null, completedAt: null, completedNote: null,
    createdAt: '2026-02-11T10:00:00Z', updatedAt: '2026-02-13T09:00:00Z',
  },
  {
    id: 1003, title: 'Draft Client Proposal', description: 'Prepare the initial proposal document for the client', dueDate: demoDate(-3),
    priority: 'MEDIUM', status: 'PENDING', category: 'Lumino Project',
    createdById: 3, createdBy: { id: 3, name: 'Nando Endae' },
    assignedToUserId: 1, assignedToUser: { id: 1, name: 'Joe Doe' },
    assignedToContactId: null, assignedToName: 'Joe Doe',
    source: 'WEB', discordMessageId: null, companyId: 1,
    notes: null, completedAt: null, completedNote: null,
    createdAt: '2026-02-12T11:00:00Z', updatedAt: '2026-02-12T11:00:00Z',
  },
  {
    id: 1004, title: 'Define Color Palette', description: 'Define brand colors and typography system', dueDate: demoDate(-1),
    priority: 'LOW', status: 'PENDING', category: 'Nila Project',
    createdById: 1, createdBy: { id: 1, name: 'Joe Doe' },
    assignedToUserId: 2, assignedToUser: { id: 2, name: 'Jhon Els' },
    assignedToContactId: null, assignedToName: 'Jhon Els',
    source: 'WEB', discordMessageId: null, companyId: 1,
    notes: null, completedAt: null, completedNote: null,
    createdAt: '2026-02-13T08:00:00Z', updatedAt: '2026-02-13T08:00:00Z',
  },
  // ── IN_PROGRESS (5) ── dates: D-1, D+0, D+1, D-2, D-1 ────────────────────
  {
    id: 1005, title: 'UI Testing', description: 'Test all navigation menu states and topbar interactions', dueDate: demoDate(-1),
    priority: 'HIGH', status: 'IN_PROGRESS', category: 'Sinen Dashboard',
    createdById: 2, createdBy: { id: 2, name: 'Jhon Els' },
    assignedToUserId: 3, assignedToUser: { id: 3, name: 'Nando Endae' },
    assignedToContactId: null, assignedToName: 'Nando Endae',
    source: 'WEB', discordMessageId: null, companyId: 1,
    notes: null, completedAt: null, completedNote: null,
    createdAt: '2026-02-08T09:00:00Z', updatedAt: '2026-02-14T08:00:00Z',
  },
  {
    id: 1006, title: 'Prototype Testing', description: 'Validate the full onboarding flow with real users', dueDate: demoDate(0),
    priority: 'HIGH', status: 'IN_PROGRESS', category: 'ABC Dashboard',
    createdById: 1, createdBy: { id: 1, name: 'Joe Doe' },
    assignedToUserId: 2, assignedToUser: { id: 2, name: 'Jhon Els' },
    assignedToContactId: null, assignedToName: 'Jhon Els',
    source: 'WEB', discordMessageId: null, companyId: 1,
    notes: null, completedAt: null, completedNote: null,
    createdAt: '2026-02-09T10:00:00Z', updatedAt: '2026-02-14T09:00:00Z',
  },
  {
    id: 1007, title: 'Finalize UI Screens', description: 'Export and deliver all final screens in Figma and PDF format', dueDate: demoDate(1),
    priority: 'MEDIUM', status: 'IN_PROGRESS', category: 'Sinen Dashboard',
    createdById: 3, createdBy: { id: 3, name: 'Nando Endae' },
    assignedToUserId: 1, assignedToUser: { id: 1, name: 'Joe Doe' },
    assignedToContactId: null, assignedToName: 'Joe Doe',
    source: 'WEB', discordMessageId: null, companyId: 1,
    notes: null, completedAt: null, completedNote: null,
    createdAt: '2026-02-10T14:00:00Z', updatedAt: '2026-02-14T16:00:00Z',
  },
  {
    id: 1008, title: 'Submit Final Screens', description: 'Submit all finalized screen designs for client approval', dueDate: demoDate(-2),
    priority: 'URGENT', status: 'IN_PROGRESS', category: 'Twinkle Website',
    createdById: 2, createdBy: { id: 2, name: 'Jhon Els' },
    assignedToUserId: 3, assignedToUser: { id: 3, name: 'Nando Endae' },
    assignedToContactId: null, assignedToName: 'Nando Endae',
    source: 'WEB', discordMessageId: null, companyId: 1,
    notes: null, completedAt: null, completedNote: null,
    createdAt: '2026-02-07T09:00:00Z', updatedAt: '2026-02-14T07:00:00Z',
  },
  {
    id: 1009, title: 'Client Feedback Meeting', description: 'Conduct feedback session with the client team', dueDate: demoDate(-1),
    priority: 'MEDIUM', status: 'IN_PROGRESS', category: 'Lumino Project',
    createdById: 1, createdBy: { id: 1, name: 'Joe Doe' },
    assignedToUserId: 2, assignedToUser: { id: 2, name: 'Jhon Els' },
    assignedToContactId: null, assignedToName: 'Jhon Els',
    source: 'WEB', discordMessageId: null, companyId: 1,
    notes: null, completedAt: null, completedNote: null,
    createdAt: '2026-02-11T12:00:00Z', updatedAt: '2026-02-14T12:00:00Z',
  },
  // ── WAITING (In Review · 3) ── dates: D+3, D+1, D+2 ──────────────────────
  {
    id: 1010, title: 'Update Style', description: 'Update the style guide with new design tokens and color system', dueDate: demoDate(3),
    priority: 'MEDIUM', status: 'WAITING', category: 'Twinkle Website',
    createdById: 2, createdBy: { id: 2, name: 'Jhon Els' },
    assignedToUserId: 3, assignedToUser: { id: 3, name: 'Nando Endae' },
    assignedToContactId: null, assignedToName: 'Nando Endae',
    source: 'WEB', discordMessageId: null, companyId: 1,
    notes: null, completedAt: null, completedNote: null,
    createdAt: '2026-02-05T10:00:00Z', updatedAt: '2026-02-13T14:00:00Z',
  },
  {
    id: 1011, title: 'Create Hi-Fi Design', description: 'Create high-fidelity prototype for the 5 key screens', dueDate: demoDate(1),
    priority: 'HIGH', status: 'WAITING', category: 'Sosro Mobile App',
    createdById: 3, createdBy: { id: 3, name: 'Nando Endae' },
    assignedToUserId: 1, assignedToUser: { id: 1, name: 'Joe Doe' },
    assignedToContactId: null, assignedToName: 'Joe Doe',
    source: 'WEB', discordMessageId: null, companyId: 1,
    notes: null, completedAt: null, completedNote: null,
    createdAt: '2026-02-06T11:00:00Z', updatedAt: '2026-02-14T10:00:00Z',
  },
  {
    id: 1012, title: 'Review Transitions', description: 'Review all micro-animation and transition specs', dueDate: demoDate(2),
    priority: 'LOW', status: 'WAITING', category: 'ABC Dashboard',
    createdById: 1, createdBy: { id: 1, name: 'Joe Doe' },
    assignedToUserId: 2, assignedToUser: { id: 2, name: 'Jhon Els' },
    assignedToContactId: null, assignedToName: 'Jhon Els',
    source: 'WEB', discordMessageId: null, companyId: 1,
    notes: null, completedAt: null, completedNote: null,
    createdAt: '2026-02-07T15:00:00Z', updatedAt: '2026-02-13T11:00:00Z',
  },
  // ── COMPLETED (4) ── dates: D-3, D-2, D+4, D+2 ──────────────────────────
  {
    id: 1013, title: 'Create Wireframe', description: 'Low-fidelity wireframes for the landing page', dueDate: demoDate(-3),
    priority: 'MEDIUM', status: 'COMPLETED', category: 'ABC Dashboard',
    createdById: 1, createdBy: { id: 1, name: 'Joe Doe' },
    assignedToUserId: 2, assignedToUser: { id: 2, name: 'Jhon Els' },
    assignedToContactId: null, assignedToName: 'Jhon Els',
    source: 'WEB', discordMessageId: null, companyId: 1,
    notes: null, completedAt: '2026-02-12T16:00:00Z', completedNote: 'Approved by client',
    createdAt: '2026-02-01T09:00:00Z', updatedAt: '2026-02-12T16:00:00Z',
  },
  {
    id: 1014, title: 'Client Feedback', description: 'Collect and document client feedback on all screens', dueDate: demoDate(-2),
    priority: 'HIGH', status: 'COMPLETED', category: 'ABC Dashboard',
    createdById: 2, createdBy: { id: 2, name: 'Jhon Els' },
    assignedToUserId: 3, assignedToUser: { id: 3, name: 'Nando Endae' },
    assignedToContactId: null, assignedToName: 'Nando Endae',
    source: 'WEB', discordMessageId: null, companyId: 1,
    notes: null, completedAt: '2026-02-13T14:00:00Z', completedNote: null,
    createdAt: '2026-02-02T10:00:00Z', updatedAt: '2026-02-13T14:00:00Z',
  },
  {
    id: 1015, title: 'Design System Setup', description: 'Set up the base component library and design tokens', dueDate: demoDate(4),
    priority: 'HIGH', status: 'COMPLETED', category: 'Sinen Dashboard',
    createdById: 3, createdBy: { id: 3, name: 'Nando Endae' },
    assignedToUserId: 1, assignedToUser: { id: 1, name: 'Joe Doe' },
    assignedToContactId: null, assignedToName: 'Joe Doe',
    source: 'WEB', discordMessageId: null, companyId: 1,
    notes: null, completedAt: '2026-02-11T14:00:00Z', completedNote: null,
    createdAt: '2026-01-28T10:00:00Z', updatedAt: '2026-02-11T14:00:00Z',
  },
  {
    id: 1016, title: 'Brand Guidelines', description: 'Document full brand guidelines for Twinkle Website', dueDate: demoDate(2),
    priority: 'MEDIUM', status: 'COMPLETED', category: 'Twinkle Website',
    createdById: 1, createdBy: { id: 1, name: 'Joe Doe' },
    assignedToUserId: 3, assignedToUser: { id: 3, name: 'Nando Endae' },
    assignedToContactId: null, assignedToName: 'Nando Endae',
    source: 'WEB', discordMessageId: null, companyId: 1,
    notes: null, completedAt: '2026-02-10T17:00:00Z', completedNote: null,
    createdAt: '2026-01-30T10:00:00Z', updatedAt: '2026-02-10T17:00:00Z',
  },
];

// ── API helpers ──────────────────────────────────────────────────────────────

async function fetchTasks(companyId: number): Promise<AgendaTask[]> {
  const res = await fetch(`/api/agenda/tasks?companyId=${companyId}&pageSize=200`);
  if (!res.ok) throw new Error('Error al cargar tareas');
  const data = await res.json();
  const raw = data?.tasks ?? data;
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

  const [view, setView] = useState<ViewMode>('board');
  const [viewAnimKey, setViewAnimKey] = useState(0);
  const agendaHeader = useAgendaV2Header();
  const search = agendaHeader?.search ?? '';
  const [selectedTask, setSelectedTask] = useState<AgendaTask | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [createGroupIsProject, setCreateGroupIsProject] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<AgendaTaskStatus>('PENDING');
  const [createDefaultDate, setCreateDefaultDate] = useState<string | undefined>(undefined);
  const [editingTask, setEditingTask] = useState<AgendaTask | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

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

  const groups: TaskGroupItem[] = rawGroups ?? [];

  // ── Mutations ──────────────────────────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: AgendaTaskStatus }) =>
      updateTaskStatus(taskId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendav2-tasks', companyId] });
      queryClient.invalidateQueries({ queryKey: ['agendav2-stats', companyId] });
    },
    onError: () => toast.error('Error al actualizar el estado'),
  });

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendav2-tasks', companyId] });
      queryClient.invalidateQueries({ queryKey: ['agendav2-stats', companyId] });
      setIsCreateOpen(false);
      toast.success('Tarea creada');
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendav2-tasks', companyId] });
      queryClient.invalidateQueries({ queryKey: ['agendav2-stats', companyId] });
      setIsEditOpen(false);
      setEditingTask(null);
      toast.success('Tarea actualizada');
    },
    onError: () => toast.error('Error al actualizar la tarea'),
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
      setView('board');
    },
    onError: () => toast.error('Error al crear grupo'),
  });

  // Sync loading state to header context (shows spinner in PageHeader)
  const setIsLoading = agendaHeader?.setIsLoading;
  useEffect(() => { setIsLoading?.(loadingTasks); }, [loadingTasks, setIsLoading]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const apiTasks: AgendaTask[] = Array.isArray(rawTasks) ? rawTasks : [];
  // Use demo tasks when API returns no tasks (for visual preview)
  const safeTasks: AgendaTask[] = apiTasks.length > 0 ? apiTasks : DEMO_TASKS;

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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 4rem)',
        overflow: 'hidden',
        background: '#FFFFFF',
      }}
    >
      {/* Inner sidebar */}
      <AgendaV2Sidebar
        view={view}
        onViewChange={(v) => { setView(v); setSelectedGroupId(null); setViewAnimKey(k => k + 1); }}
        onCreateTask={() => handleCreateTask('PENDING')}
        tasks={safeTasks}
        groups={groups}
        selectedGroupId={selectedGroupId}
        onSelectGroup={setSelectedGroupId}
        onCreateGroup={(isProject) => {
          setCreateGroupIsProject(isProject);
          setIsCreateGroupOpen(true);
        }}
        loadingGroups={loadingGroups}
      />

      {/* Main panel — position:relative so expanded panel covers only this area */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden', position: 'relative' }}>
        {/* Content + inline detail panel */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Scrollable main content */}
          <div
            key={`view-${view}-${viewAnimKey}`}
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '20px',
              background: '#FFFFFF',
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
                <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#050505' }}>{pageTitle}</h1>
                {selectedGroupId && (
                  <span style={{ fontSize: '11px', color: '#9C9CAA', background: '#F0F0F0', padding: '2px 8px', borderRadius: '20px' }}>
                    {groups.find(g => g.id === selectedGroupId)?.isProject ? 'Proyecto' : 'Grupo'}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '12px', color: '#9C9CAA' }}>
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
                onCreateTask={handleCreateTask}
                isLoading={loadingTasks}
              />
            )}

            {view === 'inbox' && (
              <InboxView
                tasks={filteredTasks}
                onTaskClick={handleTaskClick}
              />
            )}

            {view === 'dashboard' && (
              <DashboardView
                tasks={filteredTasks}
                stats={stats}
                isLoading={loadingTasks}
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
                  setView('board');
                  setViewAnimKey(k => k + 1);
                }}
                onCreateGroup={(isProject) => {
                  setCreateGroupIsProject(isProject);
                  setIsCreateGroupOpen(true);
                }}
                loadingGroups={loadingGroups}
              />
            )}

            {view === 'fixed-tasks' && (
              <FixedTasksView
                tasks={filteredTasks}
                onTaskClick={handleTaskClick}
                onCreateTask={handleCreateTask}
                isLoading={loadingTasks}
              />
            )}
          </div>

          {/* Inline detail panel — slides in from the right without overlay */}
          <TaskDetailPanel
            task={selectedTask}
            open={isDetailOpen}
            onClose={() => { setIsDetailOpen(false); setIsPanelExpanded(false); }}
            expanded={isPanelExpanded}
            onExpandedChange={setIsPanelExpanded}
            onStatusChange={async (task, status) => {
              await handleStatusChange(task.id, status);
            }}
            onEdit={(task) => {
              setIsDetailOpen(false);
              handleEditTask(task);
            }}
          />
        </div>
      </div>

      {/* Create task modal */}
      <CreateTaskModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        defaultStatus={createDefaultStatus}
        defaultDate={createDefaultDate}
        defaultGroupId={selectedGroupId}
        groups={groups}
        onSave={async (data) => { await createMutation.mutateAsync(data); }}
        isSaving={createMutation.isPending}
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
