'use client';

import { useState } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  Inbox,
  BarChart2,
  FolderKanban,
  BookOpen,
  Target,
  ChevronDown,
  Plus,
  UserPlus,
  HelpCircle,
  MoreHorizontal,
  Users,
  Folder,
  Rocket,
  Hash,
  Pin,
  Calendar,
  Briefcase,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { AgendaTask } from '@/lib/agenda/types';

type ViewMode = 'board' | 'inbox' | 'dashboard' | 'reporting' | 'portfolio' | 'fixed-tasks';

export interface TaskGroupItem {
  id: number;
  name: string;
  color: string;
  icon?: string | null;
  isProject: boolean;
  taskCount: number;
  members: { userId: number; user: { name: string; avatar?: string | null } }[];
}

interface NavItem {
  value: ViewMode | null;
  label: string;
  icon: typeof LayoutDashboard;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { value: 'dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { value: 'board',      label: 'My Task',    icon: ClipboardList },
  { value: 'inbox',      label: 'Inbox',      icon: Inbox },
  { value: 'reporting',  label: 'Reporting',  icon: BarChart2 },
  { value: 'portfolio',  label: 'Portfolio',  icon: Briefcase },
  { value: null,         label: 'Accounts',   icon: BookOpen,    disabled: true },
  { value: null,         label: 'Goals',      icon: Target,      disabled: true },
];

interface AgendaV2SidebarProps {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  onCreateTask: () => void;
  tasks: AgendaTask[];
  groups: TaskGroupItem[];
  selectedGroupId: number | null;
  onSelectGroup: (id: number | null) => void;
  onCreateGroup: (isProject: boolean) => void;
  loadingGroups?: boolean;
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function GroupRow({
  group,
  isSelected,
  onClick,
}: {
  group: TaskGroupItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-150 group"
      style={{
        background: isSelected ? '#E8E8E8' : hovered ? '#EEEEEE' : 'transparent',
      }}
    >
      {/* Color dot */}
      <span
        className="h-2 w-2 rounded-full shrink-0 transition-transform duration-150"
        style={{
          background: group.color,
          transform: isSelected ? 'scale(1.3)' : 'scale(1)',
        }}
      />

      {/* Name */}
      <span
        className="text-[13px] flex-1 truncate transition-colors"
        style={{
          color: isSelected ? '#050505' : '#575456',
          fontWeight: isSelected ? 600 : 400,
        }}
      >
        {group.name}
      </span>

      {/* Task count */}
      {group.taskCount > 0 && (
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
          style={{
            background: isSelected ? '#050505' : '#E4E4E4',
            color: isSelected ? '#fff' : '#9C9CAA',
          }}
        >
          {group.taskCount}
        </span>
      )}

      {/* Members (proyectos) */}
      {group.isProject && group.members.length > 0 && (
        <div className="flex -space-x-1 shrink-0">
          {group.members.slice(0, 3).map((m) => (
            <Avatar key={m.userId} className="h-4 w-4 border border-white">
              {m.user.avatar && <AvatarImage src={m.user.avatar} />}
              <AvatarFallback style={{ fontSize: '7px', background: '#D0E0F0', color: '#3070A8' }}>
                {getInitials(m.user.name)}
              </AvatarFallback>
            </Avatar>
          ))}
          {group.members.length > 3 && (
            <div
              className="h-4 w-4 rounded-full border border-white flex items-center justify-center"
              style={{ fontSize: '7px', background: '#E4E4E4', color: '#575456' }}
            >
              +{group.members.length - 3}
            </div>
          )}
        </div>
      )}
    </button>
  );
}

export function AgendaV2Sidebar({
  view,
  onViewChange,
  onCreateTask,
  tasks,
  groups,
  selectedGroupId,
  onSelectGroup,
  onCreateGroup,
  loadingGroups,
}: AgendaV2SidebarProps) {
  const { user } = useAuth();
  const [groupsExpanded, setGroupsExpanded] = useState(true);
  const [projectsExpanded, setProjectsExpanded] = useState(true);

  const inboxCount = tasks.filter(t =>
    t.status === 'PENDING' || t.status === 'IN_PROGRESS'
  ).length;

  const simpleGroups = groups.filter(g => !g.isProject);
  const projects = groups.filter(g => g.isProject);

  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <aside
      className="flex flex-col shrink-0 h-full overflow-hidden"
      style={{ width: '244px', background: '#F5F5F5', borderRight: '1px solid #E4E4E4' }}
    >
      {/* ── User profile ───────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0" style={{ border: '2px solid #ffffff' }}>
            <AvatarFallback
              className="text-sm font-bold"
              style={{ background: '#D0E0F0', color: '#3070A8' }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold truncate" style={{ color: '#050505' }}>
              {user?.name || 'Usuario'}
            </p>
            <p className="text-[11px] truncate" style={{ color: '#9C9CAA' }}>
              {user?.email || ''}
            </p>
          </div>
          <button
            className="h-6 w-6 rounded flex items-center justify-center transition-colors hover:bg-[#E4E4E4]"
            style={{ color: '#9C9CAA' }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Create Task button ─────────────────────────────────── */}
      <div className="px-4 pb-5">
        <button
          onClick={onCreateTask}
          className="w-full h-10 flex items-center justify-center gap-2 text-white text-[13px] font-semibold transition-all duration-150 active:scale-[0.97]"
          style={{
            background: '#050505',
            borderRadius: '12px',
            boxShadow: '0 1px 2px rgba(0,0,0,.12)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#1a1a1a')}
          onMouseLeave={e => (e.currentTarget.style.background = '#050505')}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Create Task
        </button>
      </div>

      {/* ── Main navigation ────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5 pb-3">

        {NAV_ITEMS.map((item, idx) => {
          const Icon = item.icon;
          const isActive = !selectedGroupId && item.value && view === item.value;
          const badgeCount = item.value === 'inbox' ? inboxCount : 0;

          return (
            <button
              key={idx}
              disabled={item.disabled || !item.value}
              onClick={() => {
                if (item.value) {
                  onViewChange(item.value);
                  onSelectGroup(null);
                }
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors duration-100"
              style={{
                color: item.disabled ? '#C4C4C4' : isActive ? '#050505' : '#575456',
                background: isActive ? '#EDEDED' : 'transparent',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => {
                if (!item.disabled && !isActive) e.currentTarget.style.background = '#EEEEEE';
              }}
              onMouseLeave={e => {
                if (!item.disabled && !isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <Icon
                className="h-[17px] w-[17px] shrink-0"
                strokeWidth={isActive ? 2.5 : 2}
                style={{ color: item.disabled ? '#C4C4C4' : isActive ? '#050505' : '#575456' }}
              />
              <span className="text-[13px] flex-1 truncate" style={{ fontWeight: isActive ? 600 : 400 }}>
                {item.label}
              </span>
              {badgeCount > 0 && !item.disabled && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                  style={isActive
                    ? { background: '#050505', color: '#ffffff' }
                    : { background: '#E4E4E4', color: '#575456' }
                  }
                >
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}

        {/* ── Tareas Fijas section ────────────────────────────────── */}
        <div className="pt-3 pb-1">
          <div className="flex items-center gap-1 px-3 mb-1">
            {/* Clickable header — navigates to fixed-tasks view */}
            <button
              onClick={() => { onViewChange('fixed-tasks'); onSelectGroup(null); }}
              className="flex items-center gap-1.5 flex-1 py-1 rounded-lg transition-colors duration-100"
              style={{
                color: view === 'fixed-tasks' && !selectedGroupId ? '#050505' : '#9C9CAA',
                background: view === 'fixed-tasks' && !selectedGroupId ? '#EDEDED' : 'transparent',
                paddingLeft: '4px',
                paddingRight: '4px',
              }}
              onMouseEnter={e => {
                if (view !== 'fixed-tasks') (e.currentTarget as HTMLButtonElement).style.background = '#EEEEEE';
              }}
              onMouseLeave={e => {
                if (view !== 'fixed-tasks') (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              <Pin
                className="h-3 w-3 shrink-0"
                strokeWidth={view === 'fixed-tasks' && !selectedGroupId ? 2.5 : 2}
              />
              <span
                className="text-[10px] uppercase tracking-widest select-none"
                style={{ fontWeight: view === 'fixed-tasks' && !selectedGroupId ? 700 : 600 }}
              >
                Tareas Fijas
              </span>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); }}
              className="h-5 w-5 rounded-md flex items-center justify-center transition-all duration-150 hover:bg-[#E4E4E4] active:scale-90"
              style={{ color: '#9C9CAA' }}
              title="Nueva tarea fija"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {/* Preview — today's active tasks (max 3) */}
          {(() => {
            const today = new Date().toISOString().split('T')[0];
            const todayTasks = tasks.filter(t =>
              t.dueDate?.startsWith(today) &&
              t.status !== 'COMPLETED' &&
              t.status !== 'CANCELLED'
            ).slice(0, 3);

            if (todayTasks.length === 0) {
              return (
                <button
                  onClick={() => { onViewChange('fixed-tasks'); onSelectGroup(null); }}
                  className="w-full px-3 py-2 text-left"
                >
                  <p className="text-[11px]" style={{ color: '#C4C4C4' }}>
                    Sin tareas para hoy
                  </p>
                </button>
              );
            }

            return (
              <div className="space-y-0.5 px-1">
                {todayTasks.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { onViewChange('fixed-tasks'); onSelectGroup(null); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left"
                    onMouseEnter={e => (e.currentTarget.style.background = '#EEEEEE')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    style={{ background: 'transparent' }}
                  >
                    <Calendar className="h-3 w-3 shrink-0 flex-shrink-0" style={{ color: '#9C9CAA' }} />
                    <span className="text-[12px] flex-1 truncate text-left" style={{ color: '#575456' }}>
                      {t.title}
                    </span>
                  </button>
                ))}
              </div>
            );
          })()}
        </div>

        {/* ── Grupos section ─────────────────────────────────────── */}
        <div className="pt-4 pb-1">
          <div className="flex items-center gap-1 px-3 mb-1">
            <button
              onClick={() => setGroupsExpanded(!groupsExpanded)}
              className="flex items-center gap-1.5 flex-1 py-1 rounded transition-colors"
              style={{ color: '#9C9CAA' }}
            >
              <ChevronDown
                className="h-3 w-3 shrink-0 transition-transform duration-200"
                style={{ transform: groupsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
              />
              <span className="text-[10px] font-semibold uppercase tracking-widest select-none">
                Grupos
              </span>
            </button>
            <button
              onClick={() => onCreateGroup(false)}
              className="h-5 w-5 rounded-md flex items-center justify-center transition-all duration-150 hover:bg-[#E4E4E4] active:scale-90"
              style={{ color: '#9C9CAA' }}
              title="Nuevo grupo"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          <div
            className="overflow-hidden transition-all duration-200"
            style={{ maxHeight: groupsExpanded ? '999px' : '0', opacity: groupsExpanded ? 1 : 0 }}
          >
            <div className="space-y-0.5">
              {loadingGroups ? (
                <div className="px-3 py-2">
                  {[1, 2].map(i => (
                    <div key={i} className="h-7 rounded-xl animate-pulse mb-1" style={{ background: '#E8E8E8' }} />
                  ))}
                </div>
              ) : simpleGroups.length === 0 ? (
                <button
                  onClick={() => onCreateGroup(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] transition-colors"
                  style={{ color: '#9C9CAA' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#EEEEEE')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Hash className="h-3.5 w-3.5" />
                  <span>Crear primer grupo</span>
                </button>
              ) : (
                simpleGroups.map(g => (
                  <GroupRow
                    key={g.id}
                    group={g}
                    isSelected={selectedGroupId === g.id}
                    onClick={() => {
                      onSelectGroup(selectedGroupId === g.id ? null : g.id);
                      if (view !== 'board') onViewChange('board');
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Proyectos section ──────────────────────────────────── */}
        <div className="pt-2 pb-1">
          <div className="flex items-center gap-1 px-3 mb-1">
            <button
              onClick={() => setProjectsExpanded(!projectsExpanded)}
              className="flex items-center gap-1.5 flex-1 py-1 rounded transition-colors"
              style={{ color: '#9C9CAA' }}
            >
              <ChevronDown
                className="h-3 w-3 shrink-0 transition-transform duration-200"
                style={{ transform: projectsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
              />
              <span className="text-[10px] font-semibold uppercase tracking-widest select-none">
                Proyectos
              </span>
            </button>
            <button
              onClick={() => onCreateGroup(true)}
              className="h-5 w-5 rounded-md flex items-center justify-center transition-all duration-150 hover:bg-[#E4E4E4] active:scale-90"
              style={{ color: '#9C9CAA' }}
              title="Nuevo proyecto"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          <div
            className="overflow-hidden transition-all duration-200"
            style={{ maxHeight: projectsExpanded ? '999px' : '0', opacity: projectsExpanded ? 1 : 0 }}
          >
            <div className="space-y-0.5">
              {loadingGroups ? (
                <div className="px-3 py-2">
                  <div className="h-7 rounded-xl animate-pulse" style={{ background: '#E8E8E8' }} />
                </div>
              ) : projects.length === 0 ? (
                <button
                  onClick={() => onCreateGroup(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] transition-colors"
                  style={{ color: '#9C9CAA' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#EEEEEE')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Rocket className="h-3.5 w-3.5" />
                  <span>Crear primer proyecto</span>
                </button>
              ) : (
                projects.map(g => (
                  <GroupRow
                    key={g.id}
                    group={g}
                    isSelected={selectedGroupId === g.id}
                    onClick={() => {
                      onSelectGroup(selectedGroupId === g.id ? null : g.id);
                      if (view !== 'board') onViewChange('board');
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ── Bottom actions ─────────────────────────────────────── */}
      <div
        className="px-3 pb-5 pt-3 space-y-0.5"
        style={{ borderTop: '1px solid #E4E4E4' }}
      >
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-colors"
          style={{ color: '#575456' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#EEEEEE')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <UserPlus className="h-[17px] w-[17px] shrink-0" strokeWidth={2} />
          <span>Invite People</span>
        </button>
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-colors"
          style={{ color: '#575456' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#EEEEEE')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <HelpCircle className="h-[17px] w-[17px] shrink-0" strokeWidth={2} />
          <span>Help Center</span>
        </button>
      </div>
    </aside>
  );
}
