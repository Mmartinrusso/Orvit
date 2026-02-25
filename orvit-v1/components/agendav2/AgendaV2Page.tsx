'use client';

import { useState, useMemo } from 'react';
import { Plus, Search, Bell, Share2, Users, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { toast } from 'sonner';
import type { AgendaTask, AgendaTaskStatus, AgendaStats, CreateAgendaTaskInput } from '@/lib/agenda/types';
import { BoardView } from './BoardView';
import { InboxView } from './InboxView';
import { DashboardView } from './DashboardView';
import { TaskDetailPanel } from './TaskDetailPanel';
import { CreateTaskModal } from './CreateTaskModal';
import { AgendaV2Sidebar } from './AgendaV2Sidebar';

export type ViewMode = 'board' | 'inbox' | 'dashboard';

const VIEW_LABEL: Record<ViewMode, string> = {
  board: 'Mi Tarea',
  inbox: 'Inbox',
  dashboard: 'Dashboard',
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
    method: 'PATCH',
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

// ── Component ─────────────────────────────────────────────────────────────────

export function AgendaV2Page() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();

  const [view, setView] = useState<ViewMode>('board');
  const [search, setSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState<AgendaTask | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<AgendaTaskStatus>('PENDING');

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

  // ── Derived data ───────────────────────────────────────────────────────────
  const apiTasks: AgendaTask[] = Array.isArray(rawTasks) ? rawTasks : [];
  // Use demo tasks when API returns no tasks (for visual preview)
  const safeTasks: AgendaTask[] = apiTasks.length > 0 ? apiTasks : DEMO_TASKS;

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return safeTasks;
    const lower = search.toLowerCase();
    return safeTasks.filter(t =>
      t.title.toLowerCase().includes(lower) ||
      (t.description || '').toLowerCase().includes(lower) ||
      (t.category || '').toLowerCase().includes(lower)
    );
  }, [safeTasks, search]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleTaskClick(task: AgendaTask) {
    setSelectedTask(task);
    setIsDetailOpen(true);
  }

  async function handleStatusChange(taskId: number, status: AgendaTaskStatus) {
    await statusMutation.mutateAsync({ taskId, status });
  }

  function handleTaskDelete(_task: AgendaTask) {
    toast.info('Eliminar tarea: disponible próximamente');
  }

  function handleCreateTask(status: AgendaTaskStatus) {
    setCreateDefaultStatus(status);
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
        onViewChange={setView}
        onCreateTask={() => { setCreateDefaultStatus('PENDING'); setIsCreateOpen(true); }}
        tasks={safeTasks}
      />

      {/* Main panel */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {/* TopBar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 20px',
            borderBottom: '1px solid #E4E4E4',
            background: '#FFFFFF',
            flexShrink: 0,
          }}
        >
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#9C9CAA' }}>Synchro</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: '#D0D0D0' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#050505' }} className="truncate">
              {VIEW_LABEL[view]}
            </span>
          </div>

          {/* Search */}
          <div className="relative mx-4 flex-1 max-w-xs hidden md:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: '#9C9CAA' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar tareas..."
              className="w-full outline-none"
              style={{
                paddingLeft: '32px',
                paddingRight: '12px',
                height: '36px',
                fontSize: '13px',
                background: '#FFFFFF',
                border: '1px solid #E4E4E4',
                borderRadius: '10px',
                color: '#050505',
              }}
            />
          </div>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Avatar group */}
            <div className="hidden sm:flex items-center" style={{ gap: '-6px' }}>
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  style={{
                    height: '28px',
                    width: '28px',
                    borderRadius: '50%',
                    border: '2px solid #FFFFFF',
                    background: '#F6F6F6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: i > 1 ? '-6px' : '0',
                  }}
                >
                  <Users className="h-3 w-3" style={{ color: '#9C9CAA' }} />
                </div>
              ))}
            </div>

            <button
              className="hidden sm:flex items-center gap-1.5"
              style={{
                height: '32px',
                padding: '0 12px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#575456',
                background: '#FFFFFF',
                border: '1px solid #E4E4E4',
                borderRadius: '10px',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F6F6F6'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
            >
              <Plus className="h-3 w-3" strokeWidth={2.5} />
              Invitar
            </button>

            <div className="hidden sm:block" style={{ width: '1px', height: '16px', background: '#E4E4E4', margin: '0 2px' }} />

            <button
              style={{
                height: '32px',
                width: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '10px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#9C9CAA',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F6F6F6'; e.currentTarget.style.color = '#575456'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9C9CAA'; }}
            >
              <Share2 className="h-3.5 w-3.5" />
            </button>
            <button
              style={{
                height: '32px',
                width: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '10px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#9C9CAA',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F6F6F6'; e.currentTarget.style.color = '#575456'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9C9CAA'; }}
            >
              <Bell className="h-3.5 w-3.5" />
            </button>

            {loadingTasks && (
              <RefreshCw className="h-3.5 w-3.5 animate-spin ml-1" style={{ color: '#9C9CAA' }} />
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px',
            background: '#FAFAFA',
          }}
        >
          {/* Page title row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#050505' }}>{VIEW_LABEL[view]}</h1>
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
        </div>
      </div>

      {/* Detail panel (Sheet) */}
      <TaskDetailPanel
        task={selectedTask}
        open={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onStatusChange={async (task, status) => {
          await handleStatusChange(task.id, status);
        }}
      />

      {/* Create task modal */}
      <CreateTaskModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        defaultStatus={createDefaultStatus}
        onSave={async (data) => { await createMutation.mutateAsync(data); }}
        isSaving={createMutation.isPending}
      />
    </div>
  );
}
