'use client';

import { useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bell, ChevronDown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { WeekStrip } from './WeekStrip';
import { TaskCardMobile } from './TaskCardMobile';
import { useAuth } from '@/contexts/AuthContext';
import type { AgendaTask } from '@/lib/agenda/types';

interface AgendaHomeScreenProps {
  tasks: AgendaTask[];
  onTaskTap: (task: AgendaTask) => void;
  onToggleComplete: (taskId: number) => void;
  onMenuOpen: () => void;
}

export function AgendaHomeScreen({
  tasks,
  onTaskTap,
  onToggleComplete,
  onMenuOpen,
}: AgendaHomeScreenProps) {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const { user } = useAuth();

  const dayTasks = tasks.filter((t) => {
    if (!t.dueDate) return false;
    return isSameDay(new Date(t.dueDate), selectedDate);
  });

  return (
    <div>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4"
        style={{
          paddingTop: 'max(env(safe-area-inset-top), 16px)',
          paddingBottom: '8px',
        }}
      >
        <button onClick={onMenuOpen} className="active:scale-95 transition-transform">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.avatar ?? undefined} />
            <AvatarFallback
              style={{
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: '#e0e7ff',
                color: '#4f46e5',
              }}
            >
              {user?.name?.slice(0, 2).toUpperCase() ?? 'U'}
            </AvatarFallback>
          </Avatar>
        </button>

        {/* Month/Year pill */}
        <button
          className="flex items-center gap-1.5 active:scale-95 transition-transform"
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '999px',
            padding: '6px 14px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            fontSize: '14px',
            fontWeight: 600,
            color: '#0f172a',
          }}
        >
          {format(selectedDate, 'MMMM, yyyy', { locale: es })}
          <ChevronDown className="h-3.5 w-3.5" style={{ color: '#94a3b8' }} />
        </button>

        {/* Bell */}
        <button
          className="flex items-center justify-center active:scale-95 transition-transform"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '999px',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          <Bell className="h-4 w-4" style={{ color: '#64748b' }} />
        </button>
      </div>

      {/* Week strip */}
      <WeekStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      {/* Section header */}
      <div className="flex items-center justify-between px-4 mb-3 mt-1">
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
          {isSameDay(selectedDate, new Date())
            ? 'Tareas de hoy'
            : format(selectedDate, "d 'de' MMMM", { locale: es })}
        </span>
        <div
          className="flex items-center justify-center rounded-full"
          style={{
            width: '22px',
            height: '22px',
            backgroundColor: '#0f172a',
            fontSize: '11px',
            fontWeight: 700,
            color: '#FFFFFF',
          }}
        >
          {dayTasks.length}
        </div>
      </div>

      {/* Task list */}
      {dayTasks.length === 0 ? (
        <div
          className="mx-4 text-center rounded-2xl py-10"
          style={{
            backgroundColor: '#FFFFFF',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>No hay tareas para este día</p>
        </div>
      ) : (
        <div className="pb-4">
          {dayTasks.map((task) => (
            <TaskCardMobile
              key={task.id}
              task={task}
              onTap={onTaskTap}
              onToggleComplete={onToggleComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
