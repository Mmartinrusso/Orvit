'use client';

import { useState, useMemo } from 'react';
import { MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, isToday, parseISO, isSaturday, isSunday } from 'date-fns';
import type { AgendaTask } from '@/lib/agenda/types';

interface TaskCalendarStripProps {
  tasks: AgendaTask[];
  onTaskClick: (task: AgendaTask) => void;
  /** Emitted when hovering a date column (null = mouse left the calendar) */
  onHoverDate?: (dateKey: string | null) => void;
}

// Auto-navigate calendar to the week containing most tasks
function computeInitialOffset(tasks: AgendaTask[]) {
  const dates = tasks.filter(t => t.dueDate).map(t => parseISO(t.dueDate!));
  if (dates.length === 0) return 0;
  dates.sort((a, b) => a.getTime() - b.getTime());
  const median = dates[Math.floor(dates.length / 2)];
  const today = new Date();
  return Math.round((median.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

// Column Y-offsets create the scatter / staggered timeline look (matches Synchro)
const COL_STAGGER = [35, 8, 25, 0, 40, 0, 6, 28];

// Priority → left border accent color (matches TaskCard / TaskDetailPanel palette)
const PRIORITY_COLOR: Record<string, string> = {
  LOW:    '#9CA3AF',
  MEDIUM: '#7C3AED',
  HIGH:   '#D97706',
  URGENT: '#DC2626',
};

export function TaskCalendarStrip({ tasks, onTaskClick, onHoverDate }: TaskCalendarStripProps) {
  const [weekOffset, setWeekOffset] = useState(() => computeInitialOffset(tasks));
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // 8 days centered around "today + weekOffset"
  const days = useMemo(() => {
    const center = addDays(new Date(), weekOffset * 7);
    return Array.from({ length: 8 }, (_, i) => addDays(center, i - 3));
  }, [weekOffset]);

  const tasksByDay = useMemo(() => {
    const map: Record<string, AgendaTask[]> = {};
    days.forEach(day => { map[format(day, 'yyyy-MM-dd')] = []; });
    tasks.forEach(task => {
      if (!task.dueDate) return;
      const key = format(parseISO(task.dueDate), 'yyyy-MM-dd');
      if (map[key]) map[key].push(task);
    });
    return map;
  }, [tasks, days]);

  // Active day = selected (locked) takes priority over hover
  const activeDay = selectedDay ?? hoveredDay;
  const isAnyActive = activeDay !== null;

  function handleHover(key: string | null) {
    setHoveredDay(key);
    // Only emit hover filter when nothing is locked
    if (!selectedDay) onHoverDate?.(key);
  }

  function handleClick(key: string) {
    if (selectedDay === key) {
      // Deselect — unlock filter
      setSelectedDay(null);
      onHoverDate?.(hoveredDay);
    } else {
      // Lock filter on this day
      setSelectedDay(key);
      onHoverDate?.(key);
    }
  }

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1.5px solid #D8D8DE',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.07)',
      overflow: 'hidden',
    }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
      }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827', letterSpacing: '-0.01em' }}>Calendario de tareas</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <NavBtn onClick={() => setWeekOffset(p => p - 1)}><ChevronLeft className="h-3.5 w-3.5" /></NavBtn>
          <NavBtn onClick={() => setWeekOffset(p => p + 1)}><ChevronRight className="h-3.5 w-3.5" /></NavBtn>
          <NavBtn onClick={() => setWeekOffset(0)}><MoreHorizontal className="h-3.5 w-3.5" /></NavBtn>
        </div>
      </div>

      {/* ── Timeline grid ──────────────────────────────────────────── */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', position: 'relative' }}
        onMouseLeave={() => { setHoveredDay(null); if (!selectedDay) onHoverDate?.(null); }}
      >
        {days.map((day, idx) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDay[key] || [];
          const todayCol = isToday(day);
          const weekend = isSaturday(day) || isSunday(day);
          const isThis = activeDay === key;
          const isSelected = selectedDay === key;
          const isDimmed = isAnyActive && !isThis;

          return (
            <div
              key={key}
              onMouseEnter={() => handleHover(key)}
              onClick={() => handleClick(key)}
              style={{
                borderLeft: idx > 0 ? '1px solid #E4E4E8' : 'none',
                position: 'relative',
                minHeight: '190px',
                transition: 'opacity 300ms ease, background 300ms ease',
                opacity: isDimmed ? 0.3 : 1,
                background: isThis ? '#F8F8F8' : 'transparent',
                cursor: 'pointer',
              }}
            >
              {/* Date header */}
              <div style={{
                padding: '10px 6px 8px',
                textAlign: 'center',
                borderBottom: '1px solid #E4E4E8',
              }}>
                <span style={{
                  fontSize: '12px',
                  fontWeight: (todayCol || isThis) ? 700 : 500,
                  color: (todayCol || isThis) ? '#111827' : '#9CA3AF',
                }}>
                  {format(day, 'd MMM')}
                </span>
                {/* Small lock indicator when day is pinned */}
                {isSelected && (
                  <div style={{
                    width: '4px', height: '4px', borderRadius: '50%',
                    background: '#111827', margin: '3px auto 0',
                  }} />
                )}
              </div>

              {/* Vertical line — centered in column */}
              {(() => {
                const showLine = isThis || (todayCol && !isAnyActive);
                return (
                  <>
                    <div style={{
                      position: 'absolute', left: '50%', top: '38px', bottom: '0',
                      width: '2px', background: '#111827',
                      transform: `translateX(-50%) scaleY(${showLine ? 1 : 0})`,
                      transformOrigin: 'bottom',
                      transition: 'transform 600ms cubic-bezier(.4,0,.2,1)',
                      zIndex: 1, pointerEvents: 'none',
                    }} />
                    <div style={{
                      position: 'absolute', left: '50%', top: '34px',
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: '#111827',
                      transform: `translateX(-50%) scale(${showLine ? 1 : 0})`,
                      opacity: showLine ? 1 : 0,
                      transition: 'transform 350ms ease 400ms, opacity 350ms ease 400ms',
                      zIndex: 2, pointerEvents: 'none',
                    }} />
                  </>
                );
              })()}

              {/* Weekend hatching */}
              {weekend && !isThis && (
                <div style={{
                  position: 'absolute', inset: 0, top: '36px',
                  opacity: 0.06,
                  backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 1px, transparent 8px)',
                  pointerEvents: 'none',
                }} />
              )}

              {/* Task pills — animate top→bottom with staggered delays */}
              <div style={{
                padding: '8px 5px',
                paddingTop: `${COL_STAGGER[idx] + 8}px`,
                display: 'flex', flexDirection: 'column', gap: '6px',
                position: 'relative', zIndex: 4,
              }}>
                {dayTasks.slice(0, 3).map((task, pillIdx) => {
                  const isActive = isThis || (todayCol && !isAnyActive);
                  const pillCount = Math.min(dayTasks.length, 3);
                  const pillDelay = 250 + (pillCount - 1 - pillIdx) * 140; // bottom pill first, then up
                  return (
                    <button
                      key={task.id}
                      onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '5px 8px', borderRadius: '8px',
                        fontSize: '11px', fontWeight: 500, lineHeight: 1.35,
                        border: isActive ? 'none' : '1px solid #EDEDED',
                        borderLeft: isActive ? `3px solid ${PRIORITY_COLOR[(task as any).priority ?? 'LOW'] ?? '#9CA3AF'}` : `3px solid ${PRIORITY_COLOR[(task as any).priority ?? 'LOW'] ?? '#9CA3AF'}`,
                        background: isActive ? '#111827' : '#FFFFFF',
                        color: isActive ? '#FFFFFF' : '#374151',
                        cursor: 'pointer',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        boxShadow: isActive ? '0 2px 8px rgba(0,0,0,.18)' : '0 1px 3px rgba(0,0,0,.04)',
                        opacity: isActive ? 1 : 0.75,
                        transition: `background 350ms ease ${pillDelay}ms, color 350ms ease ${pillDelay}ms, border 350ms ease ${pillDelay}ms, box-shadow 350ms ease ${pillDelay}ms, opacity 350ms ease ${pillDelay}ms`,
                      }}
                    >
                      {task.title}
                    </button>
                  );
                })}
                {dayTasks.length > 3 && (
                  <p style={{ fontSize: '9px', color: '#9CA3AF', padding: '0 4px', fontWeight: 500 }}>
                    +{dayTasks.length - 3} más
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Small nav button helper */
function NavBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: '28px', width: '28px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#9CA3AF', background: 'transparent',
        border: 'none', borderRadius: '8px', cursor: 'pointer',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#F4F4F6'; e.currentTarget.style.color = '#6B7280'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
    >
      {children}
    </button>
  );
}
