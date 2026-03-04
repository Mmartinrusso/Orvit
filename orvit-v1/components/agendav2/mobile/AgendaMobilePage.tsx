'use client';

import { useState, useMemo, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { addDays, subDays } from 'date-fns';
import { AgendaMobileLayout } from './AgendaMobileLayout';
import { AgendaHomeScreen } from './AgendaHomeScreen';
import { TaskDetailMobile } from './TaskDetailMobile';
import { AgendaDrawer } from './AgendaDrawer';
import { BoardMobile } from './BoardMobile';
import { DashboardMobile } from './DashboardMobile';
import { InboxMobile } from './InboxMobile';
import { ReportingMobile } from './ReportingMobile';
import { FixedTasksMobile } from './FixedTasksMobile';
import { PortfolioMobile } from './PortfolioMobile';
import { MobileMoreSheet, type MobileView } from './MobileMoreSheet';
import type { MobileTab } from './BottomNav';
import type { AgendaTask, AgendaTaskStatus, AgendaStats } from '@/lib/agenda/types';
import type { TaskGroupItem as SidebarGroupItem } from '../AgendaV2Sidebar';

interface TaskGroupItem {
  id: number;
  name: string;
  color?: string | null;
  isProject: boolean;
  _count?: { tasks: number };
}

interface AgendaMobilePageProps {
  tasks: AgendaTask[];
  stats?: AgendaStats | null;
  groups: TaskGroupItem[];
  loadingGroups?: boolean;
  isLoading?: boolean;
  onToggleComplete: (taskId: number) => void;
  onCreateTask: () => void;
  onStatusChange?: (taskId: number, status: AgendaTaskStatus) => void;
  onEditTask?: (task: AgendaTask) => void;
  onDeleteTask?: (task: AgendaTask) => void;
  onDuplicateTask?: (task: AgendaTask) => void;
  onSelectGroup?: (groupId: number) => void;
  onCreateGroup?: (isProject: boolean) => void;
  companyUsers?: Array<{ id: number; name: string; avatar?: string | null }>; // reserved for admin filter
}


// ── Mock data for preview ────────────────────────────────────────────────────

const now = new Date();
const today = now.toISOString();

function mockTask(overrides: Partial<AgendaTask> & { id: number; title: string }): AgendaTask {
  return {
    description: null,
    dueDate: null,
    priority: 'MEDIUM',
    status: 'PENDING',
    category: null,
    createdById: 1,
    createdBy: { id: 1, name: 'Martin Russo', avatar: null },
    assignedToUserId: null,
    assignedToUser: null,
    assignedToContactId: null,
    assignedToContact: null,
    assignedToName: null,
    source: 'WEB',
    discordMessageId: null,
    companyId: 1,
    reminders: [],
    notes: null,
    completedAt: null,
    completedNote: null,
    groupId: null,
    group: null,
    isArchived: false,
    archivedAt: null,
    isCompanyVisible: false,
    externalNotified: false,
    externalNotifiedAt: null,
    comments: [],
    subtasks: [],
    _count: { comments: 0, subtasks: 0, subtasksDone: 0 },
    createdAt: subDays(now, 3).toISOString(),
    updatedAt: today,
    ...overrides,
  };
}

const MOCK_TASKS: AgendaTask[] = [
  mockTask({
    id: -1, title: 'Revisar cotización proveedor ABC', status: 'IN_PROGRESS', priority: 'HIGH',
    dueDate: today, category: 'Compras',
    assignedToUser: { id: 1, name: 'Martin Russo', avatar: null }, assignedToUserId: 1, assignedToName: 'Martin Russo',
    groupId: -1, group: { id: -1, name: 'Esbribana' },
    subtasks: [
      { id: -1, title: 'Comparar precios con competencia', done: true, taskId: -1, createdAt: today, updatedAt: today },
      { id: -2, title: 'Validar condiciones de pago', done: false, taskId: -1, createdAt: today, updatedAt: today },
      { id: -3, title: 'Enviar a aprobación', done: false, taskId: -1, createdAt: today, updatedAt: today },
    ],
    _count: { comments: 2, subtasks: 3, subtasksDone: 1 },
    description: 'Revisar la cotización enviada por el proveedor ABC para insumos de mantenimiento. Comparar con proveedores alternativos.',
  }),
  mockTask({
    id: -2, title: 'Actualizar manual de procedimientos', status: 'PENDING', priority: 'MEDIUM',
    dueDate: today, category: 'Documentación',
    assignedToUser: { id: 2, name: 'Ana García', avatar: null }, assignedToUserId: 2, assignedToName: 'Ana García',
    groupId: -2, group: { id: -2, name: 'Estudio Contable' },
    _count: { comments: 0, subtasks: 2, subtasksDone: 0 },
    subtasks: [
      { id: -4, title: 'Sección de seguridad', done: false, taskId: -2, createdAt: today, updatedAt: today },
      { id: -5, title: 'Sección de calidad', done: false, taskId: -2, createdAt: today, updatedAt: today },
    ],
  }),
  mockTask({
    id: -3, title: 'Programar mantenimiento preventivo línea 3', status: 'IN_PROGRESS', priority: 'URGENT',
    dueDate: subDays(now, 1).toISOString(), category: 'Mantenimiento',
    assignedToUser: { id: 3, name: 'Carlos López', avatar: null }, assignedToUserId: 3, assignedToName: 'Carlos López',
    groupId: -1, group: { id: -1, name: 'Esbribana' },
    _count: { comments: 5, subtasks: 4, subtasksDone: 2 },
    subtasks: [
      { id: -6, title: 'Coordinar con producción', done: true, taskId: -3, createdAt: today, updatedAt: today },
      { id: -7, title: 'Preparar repuestos', done: true, taskId: -3, createdAt: today, updatedAt: today },
      { id: -8, title: 'Ejecutar mantenimiento', done: false, taskId: -3, createdAt: today, updatedAt: today },
      { id: -9, title: 'Validar funcionamiento', done: false, taskId: -3, createdAt: today, updatedAt: today },
    ],
    description: 'Mantenimiento preventivo programado para la línea de producción 3. Incluye cambio de rodamientos y lubricación.',
  }),
  mockTask({
    id: -4, title: 'Cerrar balance mensual febrero', status: 'COMPLETED', priority: 'HIGH',
    dueDate: subDays(now, 2).toISOString(), category: 'Contabilidad',
    completedAt: subDays(now, 1).toISOString(),
    assignedToUser: { id: 2, name: 'Ana García', avatar: null }, assignedToUserId: 2, assignedToName: 'Ana García',
    groupId: -2, group: { id: -2, name: 'Estudio Contable' },
    _count: { comments: 3, subtasks: 0, subtasksDone: 0 },
  }),
  mockTask({
    id: -5, title: 'Preparar presentación trimestral', status: 'PENDING', priority: 'MEDIUM',
    dueDate: addDays(now, 2).toISOString(), category: 'Administración',
    assignedToUser: { id: 1, name: 'Martin Russo', avatar: null }, assignedToUserId: 1, assignedToName: 'Martin Russo',
    groupId: -3, group: { id: -3, name: 'Proyecto Alpha' },
  }),
  mockTask({
    id: -6, title: 'Capacitación equipo nuevo software', status: 'WAITING', priority: 'MEDIUM',
    dueDate: addDays(now, 1).toISOString(), category: 'RRHH',
    assignedToUser: { id: 4, name: 'Laura Martínez', avatar: null }, assignedToUserId: 4, assignedToName: 'Laura Martínez',
    groupId: -3, group: { id: -3, name: 'Proyecto Alpha' },
  }),
  mockTask({
    id: -7, title: 'Auditoría interna de calidad', status: 'PENDING', priority: 'HIGH',
    dueDate: addDays(now, 3).toISOString(), category: 'Calidad',
    assignedToUser: { id: 3, name: 'Carlos López', avatar: null }, assignedToUserId: 3, assignedToName: 'Carlos López',
    groupId: -1, group: { id: -1, name: 'Esbribana' },
    _count: { comments: 1, subtasks: 5, subtasksDone: 0 },
    subtasks: [
      { id: -10, title: 'Preparar documentación', done: false, taskId: -7, createdAt: today, updatedAt: today },
      { id: -11, title: 'Revisar registros', done: false, taskId: -7, createdAt: today, updatedAt: today },
      { id: -12, title: 'Entrevistar operarios', done: false, taskId: -7, createdAt: today, updatedAt: today },
      { id: -13, title: 'Redactar informe', done: false, taskId: -7, createdAt: today, updatedAt: today },
      { id: -14, title: 'Presentar hallazgos', done: false, taskId: -7, createdAt: today, updatedAt: today },
    ],
  }),
  mockTask({
    id: -8, title: 'Solicitar repuestos bomba hidráulica', status: 'COMPLETED', priority: 'URGENT',
    dueDate: subDays(now, 3).toISOString(), category: 'Compras',
    completedAt: subDays(now, 2).toISOString(),
    assignedToUser: { id: 1, name: 'Martin Russo', avatar: null }, assignedToUserId: 1, assignedToName: 'Martin Russo',
    groupId: -1, group: { id: -1, name: 'Esbribana' },
  }),
  mockTask({
    id: -9, title: 'Configurar alertas de vencimiento', status: 'IN_PROGRESS', priority: 'LOW',
    dueDate: today, category: 'Sistema',
    assignedToUser: { id: 1, name: 'Martin Russo', avatar: null }, assignedToUserId: 1, assignedToName: 'Martin Russo',
  }),
  mockTask({
    id: -10, title: 'Reunión con proveedor de lubricantes', status: 'PENDING', priority: 'LOW',
    dueDate: addDays(now, 5).toISOString(), category: 'Compras',
    assignedToUser: { id: 4, name: 'Laura Martínez', avatar: null }, assignedToUserId: 4, assignedToName: 'Laura Martínez',
    groupId: -2, group: { id: -2, name: 'Estudio Contable' },
  }),
  mockTask({
    id: -11, title: 'Verificar stock mínimo de insumos', status: 'PENDING', priority: 'MEDIUM',
    dueDate: today, category: 'Inventario',
    assignedToUser: { id: 3, name: 'Carlos López', avatar: null }, assignedToUserId: 3, assignedToName: 'Carlos López',
    groupId: -1, group: { id: -1, name: 'Esbribana' },
  }),
  mockTask({
    id: -12, title: 'Generar reporte de costos operativos', status: 'COMPLETED', priority: 'MEDIUM',
    dueDate: subDays(now, 1).toISOString(), category: 'Costos',
    completedAt: today,
    assignedToUser: { id: 2, name: 'Ana García', avatar: null }, assignedToUserId: 2, assignedToName: 'Ana García',
    groupId: -2, group: { id: -2, name: 'Estudio Contable' },
  }),
  // ── Delegated tasks (created by user 1, assigned to others, due today) ──
  mockTask({
    id: -13, title: 'Enviar factura cliente Petropack', status: 'PENDING', priority: 'HIGH',
    dueDate: today, category: 'Ventas',
    createdById: 1, createdBy: { id: 1, name: 'Martin Russo', avatar: null },
    assignedToUser: { id: 2, name: 'Ana García', avatar: null }, assignedToUserId: 2, assignedToName: 'Ana García',
    groupId: -2, group: { id: -2, name: 'Estudio Contable' },
  }),
  mockTask({
    id: -14, title: 'Coordinar entrega de repuestos', status: 'IN_PROGRESS', priority: 'MEDIUM',
    dueDate: today, category: 'Compras',
    createdById: 1, createdBy: { id: 1, name: 'Martin Russo', avatar: null },
    assignedToUser: { id: 3, name: 'Carlos López', avatar: null }, assignedToUserId: 3, assignedToName: 'Carlos López',
    groupId: -1, group: { id: -1, name: 'Esbribana' },
    _count: { comments: 1, subtasks: 2, subtasksDone: 1 },
    subtasks: [
      { id: -15, title: 'Confirmar stock con proveedor', done: true, taskId: -14, createdAt: today, updatedAt: today },
      { id: -16, title: 'Agendar retiro', done: false, taskId: -14, createdAt: today, updatedAt: today },
    ],
  }),
  mockTask({
    id: -15, title: 'Llamar a proveedor de lubricantes', status: 'PENDING', priority: 'LOW',
    dueDate: today, category: 'Compras',
    createdById: 1, createdBy: { id: 1, name: 'Martin Russo', avatar: null },
    assignedToUser: { id: 4, name: 'Laura Martínez', avatar: null }, assignedToUserId: 4, assignedToName: 'Laura Martínez',
  }),
];

const MOCK_GROUPS: TaskGroupItem[] = [
  { id: -1, name: 'Esbribana', color: '#3B82F6', isProject: false, _count: { tasks: 5 } },
  { id: -2, name: 'Estudio Contable', color: '#8B5CF6', isProject: false, _count: { tasks: 4 } },
  { id: -3, name: 'Proyecto Alpha', color: '#F59E0B', isProject: true, _count: { tasks: 2 } },
];

const MOCK_STATS: AgendaStats = {
  total: 15,
  pending: 6,
  inProgress: 4,
  waiting: 1,
  completed: 3,
  cancelled: 0,
  overdue: 1,
  dueToday: 4,
  completedToday: 1,
  urgentPending: 1,
  topAssignees: [
    { name: 'Martin Russo', count: 4, type: 'user' },
    { name: 'Carlos López', count: 3, type: 'user' },
    { name: 'Ana García', count: 3, type: 'user' },
    { name: 'Laura Martínez', count: 2, type: 'user' },
  ],
};


// ─────────────────────────────────────────────────────────────────────────────

export function AgendaMobilePage({
  tasks,
  stats,
  groups,
  loadingGroups,
  onToggleComplete,
  onCreateTask,
  onStatusChange,
  onEditTask,
  onDeleteTask,
  onDuplicateTask,
  onSelectGroup,
  onCreateGroup,
  companyUsers,
}: AgendaMobilePageProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [activeView, setActiveView] = useState<MobileView>('home');
  const [selectedTask, setSelectedTask] = useState<AgendaTask | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [fixedFormOpen, setFixedFormOpen] = useState(false);

  // Always merge mock data with real data so the preview looks populated
  // TODO: Remove mock data merge once user approves design
  // Patch mock delegated tasks to use the real user's ID so they show up correctly
  const patchedMocks = useMemo(() => {
    if (!user) return MOCK_TASKS;
    return MOCK_TASKS.map((t) => {
      if (t.createdById === 1 && t.assignedToUserId && t.assignedToUserId !== 1) {
        // This is a delegated mock — patch createdById to real user
        return { ...t, createdById: user.id, createdBy: { id: user.id, name: user.name ?? 'Yo', avatar: null } };
      }
      if (t.assignedToUserId === 1) {
        // This is assigned to "me" — patch to real user
        return { ...t, assignedToUserId: user.id, assignedToUser: { id: user.id, name: user.name ?? 'Yo', avatar: null }, assignedToName: user.name ?? 'Yo' };
      }
      if (!t.assignedToUserId && t.createdById === 1) {
        // Unassigned, created by "me"
        return { ...t, createdById: user.id, createdBy: { id: user.id, name: user.name ?? 'Yo', avatar: null } };
      }
      return t;
    });
  }, [user]);

  const effectiveTasks = useMemo(() => [...tasks, ...patchedMocks], [tasks, patchedMocks]);
  const effectiveGroups = useMemo(() => [...groups, ...MOCK_GROUPS], [groups]);
  const effectiveStats = stats ?? MOCK_STATS;
  const effectiveUsers = useMemo(() => companyUsers ?? [], [companyUsers]);

  // Map bottom nav tabs to views
  const handleTabChange = (tab: MobileTab) => {
    setActiveTab(tab);
    if (tab === 'home') setActiveView('home');
    else if (tab === 'board') setActiveView('board');
    else if (tab === 'dashboard') setActiveView('dashboard');
  };

  // Navigate from "More" sheet
  const handleMoreNavigate = (view: MobileView) => {
    setActiveView(view);
    // Update tab highlight for main views
    if (view === 'home') setActiveTab('home');
    else if (view === 'board') setActiveTab('board');
    else if (view === 'dashboard') setActiveTab('dashboard');
    else setActiveTab('more');
  };

  const handleTaskTap = (task: AgendaTask) => {
    setSelectedTask(task);
  };

  // Drawer view state — independent from sidebar context
  const [drawerView, setDrawerView] = useState<'board' | 'inbox' | 'dashboard' | 'reporting' | 'portfolio' | 'fixed-tasks'>('board');

  // Convert groups to sidebar format for the drawer
  const drawerGroups: SidebarGroupItem[] = useMemo(
    () => effectiveGroups.map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color ?? '#64748b',
      isProject: g.isProject,
      taskCount: g._count?.tasks ?? effectiveTasks.filter(t => t.groupId === g.id).length,
      members: [],
    })),
    [effectiveGroups, effectiveTasks]
  );

  // Back to home from secondary views (must be before any conditional return)
  const goBack = useCallback(() => {
    setActiveView('home');
    setActiveTab('home');
  }, []);

  // Task detail view (full screen)
  if (selectedTask) {
    return (
      <TaskDetailMobile
        task={selectedTask}
        members={effectiveUsers}
        onBack={() => setSelectedTask(null)}
        onRefresh={() => setSelectedTask(null)}
        onStatusChange={onStatusChange}
        onEdit={(task) => {
          onEditTask?.(task);
          setSelectedTask(null);
        }}
        onDuplicate={(task) => {
          onDuplicateTask?.(task);
          setSelectedTask(null);
        }}
        onDelete={(task) => {
          onDeleteTask?.(task);
          setSelectedTask(null);
        }}
      />
    );
  }

  // Whether we're on a secondary view (accessed from "Más" sheet)
  const isSecondaryView = activeView === 'inbox' || activeView === 'reporting' || activeView === 'portfolio';

  // Determine which view to render
  const renderView = () => {
    switch (activeView) {
      case 'home':
        return (
          <AgendaHomeScreen
            tasks={effectiveTasks}
            groups={groups}
            onTaskTap={handleTaskTap}
            onToggleComplete={onToggleComplete}
            onMenuOpen={() => setDrawerOpen(true)}
          />
        );
      case 'board':
        return (
          <BoardMobile
            tasks={effectiveTasks}
            companyUsers={effectiveUsers}
            onTaskTap={handleTaskTap}
            onToggleComplete={onToggleComplete}
            onCreateTask={onCreateTask}
          />
        );
      case 'dashboard':
        return (
          <DashboardMobile
            tasks={effectiveTasks}
            stats={effectiveStats}
            onTaskTap={handleTaskTap}
          />
        );
      case 'inbox':
        return (
          <InboxMobile
            tasks={effectiveTasks}
            onTaskTap={handleTaskTap}
            onToggleComplete={onToggleComplete}
          />
        );
      case 'reporting':
        return (
          <ReportingMobile
            tasks={effectiveTasks}
            stats={effectiveStats}
          />
        );
      case 'fixed-tasks':
        return (
          <FixedTasksMobile
            createFormOpen={fixedFormOpen}
            onCreateFormClose={() => setFixedFormOpen(false)}
          />
        );
      case 'portfolio':
        return (
          <PortfolioMobile
            groups={effectiveGroups}
            tasks={effectiveTasks}
            onSelectGroup={(id) => {
              onSelectGroup?.(id);
              setActiveView('board');
              setActiveTab('board');
            }}
            onCreateGroup={() => onCreateGroup?.(false)}
            loadingGroups={loadingGroups}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Left navigation drawer — works independently from sidebar context */}
      <AgendaDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        view={drawerView}
        onViewChange={(v) => {
          setDrawerView(v);
          setActiveView(v as MobileView);
          if (v === 'board') setActiveTab('board');
          else if (v === 'dashboard') setActiveTab('dashboard');
          else setActiveTab('more');
          setDrawerOpen(false);
        }}
        onCreateTask={() => {
          onCreateTask();
          setDrawerOpen(false);
        }}
        tasks={effectiveTasks}
        groups={drawerGroups}
        selectedGroupId={null}
        onSelectGroup={(id) => {
          onSelectGroup?.(id);
          setDrawerOpen(false);
        }}
        onCreateGroup={(isProject) => {
          onCreateGroup?.(isProject);
          setDrawerOpen(false);
        }}
        loadingGroups={loadingGroups}
      />

      {/* More sheet */}
      <MobileMoreSheet
        open={moreSheetOpen}
        onOpenChange={setMoreSheetOpen}
        onNavigate={handleMoreNavigate}
      />

      <AgendaMobileLayout
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onCreateTask={() => {
          if (activeView === 'fixed-tasks') {
            setFixedFormOpen(true);
          } else {
            onCreateTask();
          }
        }}
        onMenuPress={() => setDrawerOpen(true)}
        hideNav={drawerOpen}
      >
        {isSecondaryView && (
          <div className="flex items-center gap-3 px-4 pt-3 pb-1">
            <button
              onClick={goBack}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-muted active:scale-95 transition-transform"
            >
              <ArrowLeft className="h-4 w-4 text-foreground" />
            </button>
          </div>
        )}
        {renderView()}
      </AgendaMobileLayout>
    </>
  );
}
