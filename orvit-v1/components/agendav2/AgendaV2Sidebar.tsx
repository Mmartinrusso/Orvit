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
  Star,
  MoreHorizontal,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { AgendaTask } from '@/lib/agenda/types';

type ViewMode = 'board' | 'inbox' | 'dashboard';

interface NavItem {
  value: ViewMode | null;
  label: string;
  icon: typeof LayoutDashboard;
  disabled?: boolean;
}

interface AgendaV2SidebarProps {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  onCreateTask: () => void;
  tasks: AgendaTask[];
}

const NAV_ITEMS: NavItem[] = [
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { value: 'board', label: 'My Task', icon: ClipboardList },
  { value: 'inbox', label: 'Inbox', icon: Inbox },
  { value: null, label: 'Reporting', icon: BarChart2, disabled: true },
  { value: null, label: 'Portfolio', icon: FolderKanban, disabled: true },
  { value: null, label: 'Accounts', icon: BookOpen, disabled: true },
  { value: null, label: 'Goals', icon: Target, disabled: true },
];

export function AgendaV2Sidebar({ view, onViewChange, onCreateTask, tasks }: AgendaV2SidebarProps) {
  const { user } = useAuth();
  const [favExpanded, setFavExpanded] = useState(true);

  const inboxCount = tasks.filter(t =>
    t.status === 'PENDING' || t.status === 'IN_PROGRESS'
  ).length;

  const categories = Array.from(
    new Set(tasks.map(t => t.category).filter(Boolean))
  ).slice(0, 5) as string[];

  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <aside
      className="flex flex-col shrink-0 h-full overflow-hidden"
      style={{ width: '244px', background: '#F5F5F5', borderRight: '1px solid #E4E4E4' }}
    >
      {/* User profile */}
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

      {/* Create Task button */}
      <div className="px-4 pb-5">
        <button
          onClick={onCreateTask}
          className="w-full h-10 flex items-center justify-center gap-2 text-white text-[13px] font-semibold transition-colors active:scale-[0.97]"
          style={{
            background: '#050505',
            borderRadius: '12px',
            boxShadow: '0 1px 2px rgba(0,0,0,.12)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#000000')}
          onMouseLeave={e => (e.currentTarget.style.background = '#050505')}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Create Task
        </button>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {NAV_ITEMS.map((item, idx) => {
          const Icon = item.icon;
          const isActive = item.value && view === item.value;
          const badgeCount = item.value === 'inbox' ? inboxCount : 0;

          return (
            <button
              key={idx}
              disabled={item.disabled || !item.value}
              onClick={() => item.value && onViewChange(item.value)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors duration-100"
              style={{
                color: item.disabled ? '#9C9CAA' : isActive ? '#050505' : '#575456',
                background: isActive ? '#EDEDED' : 'transparent',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={e => {
                if (!item.disabled && !isActive) {
                  e.currentTarget.style.background = '#F6F6F6';
                }
              }}
              onMouseLeave={e => {
                if (!item.disabled && !isActive) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <Icon
                className="h-[17px] w-[17px] shrink-0"
                strokeWidth={isActive ? 2.5 : 2}
                style={{ color: item.disabled ? '#9C9CAA' : isActive ? '#050505' : '#575456' }}
              />
              <span
                className="text-[13px] flex-1 truncate"
                style={{ fontWeight: isActive ? 600 : 400 }}
              >
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

        {/* Favourites section */}
        <div className="pt-5 pb-1">
          <button
            onClick={() => setFavExpanded(!favExpanded)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-left transition-colors"
            style={{ color: '#9C9CAA' }}
          >
            <ChevronDown
              className="h-3 w-3 shrink-0 transition-transform duration-200"
              style={{ transform: favExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
            />
            <span className="flex-1 text-[10px] font-semibold uppercase tracking-widest">
              Favourite
            </span>
            <Plus className="h-3 w-3" />
          </button>

          {favExpanded && (
            <div className="mt-1 space-y-0.5">
              {categories.length === 0 ? (
                <p className="text-[11px] px-3 py-1.5" style={{ color: '#9C9CAA' }}>
                  Sin categorías aún
                </p>
              ) : (
                categories.map(cat => (
                  <div
                    key={cat}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] cursor-pointer transition-colors group"
                    style={{ color: '#575456' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F6F6F6')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Star className="h-3.5 w-3.5 shrink-0" style={{ color: '#9C9CAA' }} />
                    <span className="truncate flex-1">{cat}</span>
                    <MoreHorizontal className="h-3 w-3 opacity-0 group-hover:opacity-100 shrink-0" />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Bottom actions */}
      <div
        className="px-3 pb-5 pt-3 space-y-0.5"
        style={{ borderTop: '1px solid #E4E4E4' }}
      >
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-colors"
          style={{ color: '#575456' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F6F6F6')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <UserPlus className="h-[17px] w-[17px] shrink-0" strokeWidth={2} />
          <span>Invite People</span>
        </button>
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-colors"
          style={{ color: '#575456' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F6F6F6')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <HelpCircle className="h-[17px] w-[17px] shrink-0" strokeWidth={2} />
          <span>Help Center</span>
        </button>
      </div>
    </aside>
  );
}
