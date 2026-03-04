'use client';

import { useState, type CSSProperties } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  Inbox,
  BarChart2,
  ChevronDown,
  Plus,
  UserPlus,
  HelpCircle,
  MoreHorizontal,
  Rocket,
  Hash,
  Briefcase,
  Repeat2,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { AgendaTask } from '@/lib/agenda/types';
import { SidebarGroupsSkeleton, SidebarProjectSkeleton } from './TaskCardSkeleton';

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
  { value: 'dashboard',    label: 'Dashboard',      icon: LayoutDashboard },
  { value: 'board',        label: 'Mis Tareas',     icon: ClipboardList },
  { value: 'inbox',        label: 'Bandeja',        icon: Inbox },
  { value: 'fixed-tasks',  label: 'Tareas Fijas',   icon: Repeat2 },
  { value: 'reporting',    label: 'Reportes',       icon: BarChart2 },
  { value: 'portfolio',    label: 'Portfolio',      icon: Briefcase },
];

export interface AgendaV2SidebarProps {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  onCreateTask: () => void;
  tasks: AgendaTask[];
  groups: TaskGroupItem[];
  selectedGroupId: number | null;
  onSelectGroup: (id: number | null) => void;
  onCreateGroup: (isProject: boolean) => void;
  onEditGroup?: (group: TaskGroupItem) => void;
  onDeleteGroup?: (group: TaskGroupItem) => void;
  loadingGroups?: boolean;
  /** Override inline styles on the root <aside> element (e.g. to change width) */
  asideStyle?: CSSProperties;
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function GroupRow({
  group,
  isSelected,
  onClick,
  onEdit,
  onDelete,
}: {
  group: TaskGroupItem;
  isSelected: boolean;
  onClick: () => void;
  onEdit?: (group: TaskGroupItem) => void;
  onDelete?: (group: TaskGroupItem) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={cn(
        'w-full flex items-center gap-0 rounded-xl transition-all duration-150 group relative',
        isSelected ? 'bg-accent' : hovered ? 'bg-accent/50' : 'bg-transparent',
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={onClick}
        className="flex-1 flex items-center gap-2.5 px-3 py-2 text-left min-w-0"
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
          className={cn(
            'text-[13px] flex-1 truncate transition-colors',
            isSelected ? 'text-foreground font-semibold' : 'text-muted-foreground',
          )}
        >
          {group.name}
        </span>

        {/* Task count */}
        {group.taskCount > 0 && (
          <span
            className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
              isSelected ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
            )}
          >
            {group.taskCount}
          </span>
        )}

        {/* Members (proyectos) */}
        {group.isProject && group.members.length > 0 && (
          <div className="flex -space-x-1 shrink-0">
            {group.members.slice(0, 3).map((m) => (
              <Avatar key={m.userId} className="h-4 w-4 border border-background">
                {m.user.avatar && <AvatarImage src={m.user.avatar} />}
                <AvatarFallback className="text-[7px] bg-primary/10 text-primary">
                  {getInitials(m.user.name)}
                </AvatarFallback>
              </Avatar>
            ))}
            {group.members.length > 3 && (
              <div className="h-4 w-4 rounded-full border border-background flex items-center justify-center text-[7px] bg-muted text-muted-foreground">
                +{group.members.length - 3}
              </div>
            )}
          </div>
        )}
      </button>

      {/* Context menu — only visible on hover */}
      {(onEdit || onDelete) && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-1.5 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-5 w-5 rounded-md flex items-center justify-center transition-colors text-muted-foreground hover:bg-accent"
                onClick={e => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[150px]">
              {onEdit && (
                <DropdownMenuItem className="text-xs gap-2" onClick={() => onEdit(group)}>
                  <Pencil className="h-3 w-3" /> Renombrar
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  <div className="h-px bg-border my-1" />
                  <DropdownMenuItem className="text-xs gap-2 text-red-600 focus:text-red-600" onClick={() => onDelete(group)}>
                    <Trash2 className="h-3 w-3" /> Eliminar
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
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
  onEditGroup,
  onDeleteGroup,
  loadingGroups,
  asideStyle,
}: AgendaV2SidebarProps) {
  const [groupsExpanded, setGroupsExpanded] = useState(true);
  const [projectsExpanded, setProjectsExpanded] = useState(true);

  const inboxCount = tasks.filter(t =>
    t.status === 'PENDING' || t.status === 'IN_PROGRESS'
  ).length;

  const simpleGroups = groups.filter(g => !g.isProject);
  const projects = groups.filter(g => g.isProject);

  return (
    <aside
      className="flex flex-col shrink-0 h-full overflow-hidden bg-muted/40 border-r border-border"
      style={{ width: '244px', ...asideStyle }}
    >
      {/* ── Create Task button ─────────────────────────────────── */}
      <div className="px-4 pt-5 pb-4">
        <button
          onClick={onCreateTask}
          className="w-full h-10 flex items-center justify-center gap-2 text-primary-foreground text-[13px] font-semibold rounded-xl bg-foreground hover:bg-foreground/90 transition-all duration-150 active:scale-[0.97] shadow-sm"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Crear Tarea
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
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors duration-100',
                item.disabled ? 'text-muted-foreground/40 cursor-not-allowed' :
                isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50 cursor-pointer',
              )}
            >
              <Icon
                className="h-[17px] w-[17px] shrink-0"
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className="text-[13px] flex-1 truncate" style={{ fontWeight: isActive ? 600 : 400 }}>
                {item.label}
              </span>
              {badgeCount > 0 && !item.disabled && (
                <span
                  className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                    isActive ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}

        {/* ── Grupos section ─────────────────────────────────────── */}
        <div className="pt-4 pb-1">
          <div className="flex items-center gap-1 px-3 mb-1">
            <button
              onClick={() => setGroupsExpanded(!groupsExpanded)}
              className="flex items-center gap-1.5 flex-1 py-1 rounded transition-colors text-muted-foreground"
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
              className="h-5 w-5 rounded-md flex items-center justify-center transition-all duration-150 text-muted-foreground hover:bg-accent active:scale-90"
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
                <SidebarGroupsSkeleton />
              ) : simpleGroups.length === 0 ? (
                <button
                  onClick={() => onCreateGroup(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] text-muted-foreground hover:bg-accent/50 transition-colors"
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
                    onEdit={onEditGroup}
                    onDelete={onDeleteGroup}
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
              className="flex items-center gap-1.5 flex-1 py-1 rounded transition-colors text-muted-foreground"
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
              className="h-5 w-5 rounded-md flex items-center justify-center transition-all duration-150 text-muted-foreground hover:bg-accent active:scale-90"
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
                <SidebarProjectSkeleton />
              ) : projects.length === 0 ? (
                <button
                  onClick={() => onCreateGroup(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] text-muted-foreground hover:bg-accent/50 transition-colors"
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
                    onEdit={onEditGroup}
                    onDelete={onDeleteGroup}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ── Bottom actions ─────────────────────────────────────── */}
      <div className="px-3 pb-5 pt-3 space-y-0.5 border-t border-border">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-muted-foreground hover:bg-accent/50 transition-colors">
          <UserPlus className="h-[17px] w-[17px] shrink-0" strokeWidth={2} />
          <span>Invitar Personas</span>
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-muted-foreground hover:bg-accent/50 transition-colors">
          <HelpCircle className="h-[17px] w-[17px] shrink-0" strokeWidth={2} />
          <span>Centro de Ayuda</span>
        </button>
      </div>
    </aside>
  );
}
