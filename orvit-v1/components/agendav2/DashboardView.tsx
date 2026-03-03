'use client';

import { useState, useMemo } from 'react';
import {
  Send, FilePen, FileText, ClipboardPlus,
  FolderKanban, ListTodo, Loader2, CheckCircle2,
  MessageSquare, Link2, Plus,
  MoreHorizontal, X,
  ClipboardList, AlertTriangle, BarChart2, CalendarClock,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { AgendaTask } from '@/lib/agenda/types';

/* ─── Constants ────────────────────────────────────────── */

const QUICK_ACTIONS = [
  { key: 'create',    label: 'Crear tarea',      icon: ClipboardPlus, bg: '#EDF4F0', color: '#508070' },
  { key: 'pending',   label: 'Ver pendientes',   icon: ClipboardList, bg: '#EEF2F8', color: '#5880A8' },
  { key: 'overdue',   label: 'Tareas vencidas',  icon: AlertTriangle, bg: '#FEF3F2', color: '#B42318' },
  { key: 'reporting', label: 'Ver reportes',     icon: BarChart2,     bg: '#F2F2F4', color: '#6B6B78' },
];

// ─── Time-Based Activity Map ──────────────────────────────

const TL_LEFT_W = 110; // px — fixed left column

const _now      = new Date();
const NOW_H     = _now.getHours() + _now.getMinutes() / 60;
const _wDay     = (_now.getDay() + 6) % 7; // Mon=0 .. Sun=6
const _mDays    = new Date(_now.getFullYear(), _now.getMonth() + 1, 0).getDate();

const GANTT_SCALES = {
  daily: {
    span: 7,
    labels:        ['09:00 AM','10:00 AM','11:00 AM','12:00 PM','01:00 PM','02:00 PM','03:00 PM','04:00 PM'],
    todayFrac:     Math.min(Math.max((NOW_H - 9) / 7, 0), 1),
    todayLabelIdx: Math.floor(NOW_H) >= 9 && Math.floor(NOW_H) <= 15 ? Math.floor(NOW_H) - 9 : -1,
    inRange:       NOW_H >= 9 && NOW_H <= 16,
    tasks: [
      { id:1, project:'Dashboard\nDesign', taskName:'Update Brand Logo Guidelines', startU:0.67, endU:3.1, progress:60, barBg:'#E6F5E0', barText:'#2E7D32', avatars:['JD','ME'] },
      { id:2, project:'Mobile App',        taskName:'Setup Wireframe',              startU:1.3,  endU:2.6, progress:50, barBg:'#FFF0E8', barText:'#A0522D', avatars:['CA']       },
      { id:3, project:'Landing Page',      taskName:'Update ABC Project',           startU:2.1,  endU:3.7, progress:40, barBg:'#EDE8FF', barText:'#5B4BD6', avatars:['JD','NE']  },
      { id:4, project:'Meeting',           taskName:'Dev Sync Meeting',             startU:5.0,  endU:6.5, progress: 0, barBg:'#EDE8FF', barText:'#5B4BD6', avatars:['MA','CA']  },
    ],
  },
  weekly: {
    span: 7,
    labels:        ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom',''],
    todayFrac:     Math.min((_wDay + NOW_H / 24) / 7, 1),
    todayLabelIdx: _wDay,
    inRange:       true,
    tasks: [
      { id:1, project:'Dashboard\nDesign', taskName:'UI Mockups & Wireframes', startU:0,   endU:3,   progress:65, barBg:'#E6F5E0', barText:'#2E7D32', avatars:['JD','ME']    },
      { id:2, project:'Mobile App',        taskName:'Sprint de desarrollo',    startU:1.5, endU:5,   progress:40, barBg:'#FFF0E8', barText:'#A0522D', avatars:['CA','NE']    },
      { id:3, project:'Landing Page',      taskName:'Revisión de diseño',      startU:2,   endU:4.5, progress:30, barBg:'#EDE8FF', barText:'#5B4BD6', avatars:['JD']         },
      { id:4, project:'Meeting',           taskName:'Sprint Review',           startU:4,   endU:5,   progress: 0, barBg:'#FFF0E8', barText:'#A0522D', avatars:['MA','CA','JD'] },
    ],
  },
  monthly: {
    span: 4,
    labels:        ['Sem 1','Sem 2','Sem 3','Sem 4',''],
    todayFrac:     Math.min((_now.getDate() - 1) / (_mDays - 1), 1),
    todayLabelIdx: Math.min(Math.floor((_now.getDate() - 1) / 7), 3),
    inRange:       true,
    tasks: [
      { id:1, project:'Dashboard\nDesign', taskName:'Wireframes & UI Kit',     startU:0,   endU:2.5, progress:55, barBg:'#E6F5E0', barText:'#2E7D32', avatars:['JD','ME'] },
      { id:2, project:'Mobile App',        taskName:'Desarrollo MVP',          startU:0.5, endU:3.5, progress:35, barBg:'#FFF0E8', barText:'#A0522D', avatars:['CA','NE'] },
      { id:3, project:'Landing Page',      taskName:'Contenido & SEO',         startU:1,   endU:4,   progress:20, barBg:'#EDE8FF', barText:'#5B4BD6', avatars:['JD']      },
      { id:4, project:'Meeting',           taskName:'Revisiones de cliente',   startU:1.5, endU:2.5, progress: 0, barBg:'#FFF0E8', barText:'#A0522D', avatars:['MA','CA'] },
    ],
  },
  yearly: {
    span: 12,
    labels:        ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic',''],
    todayFrac:     Math.min((_now.getMonth() + (_now.getDate() - 1) / _mDays) / 12, 1),
    todayLabelIdx: _now.getMonth(),
    inRange:       true,
    tasks: [
      { id:1, project:'Dashboard\nDesign', taskName:'Rediseño completo',           startU:0,  endU:6,  progress:30, barBg:'#E6F5E0', barText:'#2E7D32', avatars:['JD','ME']       },
      { id:2, project:'Mobile App',        taskName:'Desarrollo y lanzamiento',    startU:2,  endU:9,  progress:20, barBg:'#FFF0E8', barText:'#A0522D', avatars:['CA','NE']       },
      { id:3, project:'Landing Page',      taskName:'Mantenimiento continuo',      startU:0,  endU:12, progress:50, barBg:'#EDE8FF', barText:'#5B4BD6', avatars:['JD']            },
      { id:4, project:'Meeting',           taskName:'Reuniones de seguimiento',    startU:0,  endU:12, progress:80, barBg:'#FFF0E8', barText:'#A0522D', avatars:['MA','CA','JD']  },
    ],
  },
};

const AVATAR_COLORS: Record<string, { bg: string; color: string }> = {
  JD: { bg: '#EDE9FE', color: '#7C3AED' },
  ME: { bg: '#D0EFE0', color: '#059669' },
  CA: { bg: '#F9F0DB', color: '#D97706' },
  NE: { bg: '#F9E4E2', color: '#ED8A94' },
  MA: { bg: '#EEF2FF', color: '#4F46E5' },
};

const PRIORITY_CHIP: Record<string, { bg: string; color: string }> = {
  LOW:    { bg: '#F2F2F4', color: '#6B6B78' },
  MEDIUM: { bg: '#EEF2F8', color: '#5880A8' },
  HIGH:   { bg: '#F5F3EB', color: '#8A7840' },
  URGENT: { bg: '#F5F0F0', color: '#A07880' },
};
const PRIORITY_LABEL: Record<string, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', URGENT: 'Urgente' };

// ─── Milestone Tracker (built from real tasks) ──────────────

/* ─── Component ─────────────────────────────────────────── */

interface DashboardViewProps {
  tasks?: AgendaTask[];
  stats?: {
    total: number;
    pending: number;
    inProgress: number;
    waiting: number;
    completed: number;
    cancelled: number;
    overdue: number;
    dueToday: number;
    completedToday: number;
    urgentPending: number;
  } | null;
  isLoading?: boolean;
  onCreateTask?: () => void;
  onViewChange?: (view: string) => void;
  onTaskClick?: (task: AgendaTask) => void;
}

export function DashboardView({ tasks, stats, isLoading, onCreateTask, onViewChange, onTaskClick }: DashboardViewProps) {
  const [ganttTab, setGanttTab] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
  const [milestoneTab, setMilestoneTab] = useState<'1m' | '3m' | '6m' | '1y'>('6m');
  const [chatProjectId, setChatProjectId] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState('');

  // ── Build milestone data from real tasks ──
  const milestoneData = useMemo(() => {
    const allTasks = tasks || [];
    if (allTasks.length === 0) return [];

    const now = new Date();
    const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const MONTH_SHORT = ['E','F','M','A','M','J','J','A','S','O','N','D'];

    if (milestoneTab === '1m') {
      return [1, 2, 3, 4].map(week => {
        const weekStart = new Date(now.getFullYear(), now.getMonth(), (week - 1) * 7 + 1);
        const weekEnd = new Date(now.getFullYear(), now.getMonth(), week * 7);
        const due = allTasks.filter(t => t.dueDate && new Date(t.dueDate) >= weekStart && new Date(t.dueDate) <= weekEnd);
        const done = due.filter(t => t.status === 'COMPLETED');
        return { name: `Sem ${week}`, Target: due.length, Actual: done.length };
      });
    }
    if (milestoneTab === '3m') {
      return [-2, -1, 0].map(offset => {
        const m = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        const mEnd = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
        const due = allTasks.filter(t => t.dueDate && new Date(t.dueDate) >= m && new Date(t.dueDate) <= mEnd);
        const done = due.filter(t => t.status === 'COMPLETED');
        return { name: MONTH_NAMES[m.getMonth()], Target: due.length, Actual: done.length };
      });
    }
    if (milestoneTab === '6m') {
      return [-5, -4, -3, -2, -1, 0].map(offset => {
        const m = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        const mEnd = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
        const due = allTasks.filter(t => t.dueDate && new Date(t.dueDate) >= m && new Date(t.dueDate) <= mEnd);
        const done = due.filter(t => t.status === 'COMPLETED');
        return { name: MONTH_NAMES[m.getMonth()], Target: due.length, Actual: done.length };
      });
    }
    // 1y
    return Array.from({ length: 12 }, (_, i) => {
      const m = new Date(now.getFullYear(), i, 1);
      const mEnd = new Date(now.getFullYear(), i + 1, 0);
      const due = allTasks.filter(t => t.dueDate && new Date(t.dueDate) >= m && new Date(t.dueDate) <= mEnd);
      const done = due.filter(t => t.status === 'COMPLETED');
      return { name: MONTH_SHORT[i], Target: due.length, Actual: done.length };
    });
  }, [tasks, milestoneTab]);

  // ── Quick action handler ──
  const handleQuickAction = (key: string) => {
    if (key === 'create' && onCreateTask) onCreateTask();
    else if (key === 'pending' && onViewChange) onViewChange('board');
    else if (key === 'overdue' && onViewChange) onViewChange('board');
    else if (key === 'reporting' && onViewChange) onViewChange('reporting');
  };

  // ── Build Gantt data from real tasks ──
  const realGanttTasks = useMemo(() => {
    const active = (tasks || [])
      .filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED')
      .slice(0, 4);
    if (active.length === 0) return [];

    const BAR_STYLES = [
      { barBg: '#E6F5E0', barText: '#2E7D32' },
      { barBg: '#FFF0E8', barText: '#A0522D' },
      { barBg: '#EDE8FF', barText: '#5B4BD6' },
      { barBg: '#EEF2FF', barText: '#4F46E5' },
    ];

    const now = new Date();
    return active.map((t, i) => {
      const created = t.createdAt ? new Date(t.createdAt) : now;
      const due = t.dueDate ? new Date(t.dueDate) : new Date(now.getTime() + 3 * 86400000);
      const initials = t.assignees?.slice(0, 2).map(a =>
        ((a.firstName?.[0] || '') + (a.lastName?.[0] || '')).toUpperCase() || 'U'
      ) || [];
      return {
        id: t.id,
        project: t.group?.name || t.category || 'General',
        taskName: t.title.length > 30 ? t.title.slice(0, 28) + '…' : t.title,
        created, due, initials,
        progress: t._count ? Math.round(((t._count.subtasksDone || 0) / Math.max(t._count.subtasks || 1, 1)) * 100) : 0,
        ...BAR_STYLES[i % BAR_STYLES.length],
      };
    });
  }, [tasks]);

  // ── Compute scale with real positions ──
  const scale = useMemo(() => {
    const base = GANTT_SCALES[ganttTab];
    if (realGanttTasks.length === 0) return { ...base, tasks: [] };
    const now = new Date();

    const positionedTasks = realGanttTasks.map(t => {
      let startU = 0, endU = 1;
      if (ganttTab === 'daily') {
        // Spread tasks evenly across the day
        const idx = realGanttTasks.indexOf(t);
        startU = idx * 1.6 + 0.3;
        endU = startU + 1.5;
      } else if (ganttTab === 'weekly') {
        const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        weekStart.setHours(0, 0, 0, 0);
        const cDay = Math.max(0, (t.created.getTime() - weekStart.getTime()) / 86400000);
        const dDay = Math.max(cDay + 0.5, (t.due.getTime() - weekStart.getTime()) / 86400000);
        startU = Math.min(cDay, 6);
        endU = Math.min(dDay + 0.5, 7);
      } else if (ganttTab === 'monthly') {
        const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const cWeek = Math.max(0, (t.created.getTime() - mStart.getTime()) / (7 * 86400000));
        const dWeek = Math.max(cWeek + 0.3, (t.due.getTime() - mStart.getTime()) / (7 * 86400000));
        startU = Math.min(cWeek, 3.5);
        endU = Math.min(dWeek + 0.3, 4);
      } else {
        const yStart = new Date(now.getFullYear(), 0, 1);
        const cMonth = Math.max(0, (t.created.getTime() - yStart.getTime()) / (30.44 * 86400000));
        const dMonth = Math.max(cMonth + 0.5, (t.due.getTime() - yStart.getTime()) / (30.44 * 86400000));
        startU = Math.min(cMonth, 11);
        endU = Math.min(dMonth + 0.5, 12);
      }
      if (endU - startU < 0.5) endU = startU + 0.5;
      return { ...t, startU, endU, avatars: t.initials };
    });

    return { ...base, tasks: positionedTasks };
  }, [realGanttTasks, ganttTab]);

  const kpiCards = [
    { label: 'Total Tareas', value: stats?.total ?? 0,       sub: 'Tareas creadas',    icon: ListTodo,     iconBg: '#F0FDF4', iconColor: '#16A34A' },
    { label: 'Pendientes',   value: stats?.pending ?? 0,     sub: 'Sin iniciar',        icon: FolderKanban, iconBg: '#EEF2FF', iconColor: '#4F46E5' },
    { label: 'En progreso',  value: stats?.inProgress ?? 0,  sub: 'En curso',           icon: Loader2,      iconBg: '#FFF7ED', iconColor: '#EA580C' },
    { label: 'Completadas',  value: stats?.completed ?? 0,   sub: 'Finalizadas',        icon: CheckCircle2, iconBg: '#ECFDF5', iconColor: '#059669' },
  ];

  const todayProjects = (tasks || [])
    .filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED')
    .slice(0, 4)
    .map((t, i) => ({
      id: t.id,
      category: t.category || t.group?.name || 'General',
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString('es-AR', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Sin fecha',
      chartColor: ['#5880A8', '#A07880', '#508070', '#8A7840'][i % 4],
      desc: t.description || '',
      progress: t._count ? Math.round(((t._count.subtasksDone || 0) / Math.max(t._count.subtasks || 1, 1)) * 100) : 0,
      comments: t._count?.comments || 0,
      links: 0,
    }));

  const chatProject = todayProjects.find(p => p.id === chatProjectId) ?? null;
  const chatComments: any[] = [];

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '80px', background: '#F4F4F6', borderRadius: '16px', animationName: 'pulse', animationDuration: '1.5s', animationIterationCount: 'infinite' }} />
        ))}
      </div>
    );
  }

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* ── Quick Actions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {QUICK_ACTIONS.map(a => {
          const Icon = a.icon;
          return (
            <button
              key={a.key}
              onClick={() => handleQuickAction(a.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '11px 14px', borderRadius: '10px',
                background: '#FFFFFF', border: '1px solid #E4E4E8',
                cursor: 'pointer', textAlign: 'left',
                boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                transition: 'box-shadow 150ms ease, border-color 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,.09)'; e.currentTarget.style.borderColor = '#D8D8D8'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.06)'; e.currentTarget.style.borderColor = '#E4E4E8'; }}
            >
              <div style={{ height: '30px', width: '30px', borderRadius: '7px', background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon className="h-3.5 w-3.5" style={{ color: a.color }} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 400, color: '#374151', lineHeight: 1.3 }}>{a.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {kpiCards.map(k => (
          <div
            key={k.label}
            style={{
              background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: '12px',
              padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px',
              boxShadow: '0 1px 4px rgba(0,0,0,.04)',
              transition: 'box-shadow 150ms ease', cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 3px 12px rgba(0,0,0,.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,.04)'; }}
          >
            {/* Title + dots */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '12px', fontWeight: 500, color: '#8A8A9A' }}>{k.label}</p>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', lineHeight: 0, color: '#C0C0C8' }}>
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
            {/* Number + subtitle inline */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <p style={{ fontSize: '28px', fontWeight: 700, color: '#111827', lineHeight: 1 }}>{k.value}</p>
              <p style={{ fontSize: '11px', fontWeight: 400, color: '#9CA3AF' }}>{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main row: Left column (Gantt + Today Projects) + Right sidebar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px', alignItems: 'start' }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Time-Based Activity Map */}
        <div style={{ background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Mapa de Actividad</p>
            <div style={{ display: 'flex', gap: '2px', background: '#F4F4F6', borderRadius: '9px', padding: '3px' }}>
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setGanttTab(tab)}
                  style={{
                    padding: '5px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                    fontSize: '11px', fontWeight: 600,
                    background: ganttTab === tab ? '#FFFFFF' : 'transparent',
                    color: ganttTab === tab ? '#111827' : '#9CA3AF',
                    boxShadow: ganttTab === tab ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                    transition: 'all 150ms ease',
                  }}
                >
                  {{ daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual', yearly: 'Anual' }[tab]}
                </button>
              ))}
            </div>
          </div>

          {/* Gantt body */}
          {scale.tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF' }}>
              <CalendarClock className="h-8 w-8 mx-auto mb-2" style={{ color: '#D1D5DB' }} />
              <p style={{ fontSize: '13px', fontWeight: 500 }}>Sin tareas activas</p>
              <p style={{ fontSize: '11px', marginTop: '4px' }}>Creá una tarea para ver tu actividad aquí</p>
            </div>
          ) : (
          <div style={{ position: 'relative' }}>

            {/* TODAY vertical line */}
            {scale.inRange && (
              <div style={{
                position: 'absolute', top: 0, bottom: '28px',
                left: `calc(${TL_LEFT_W}px + (100% - ${TL_LEFT_W}px) * ${scale.todayFrac})`,
                width: '1.5px', background: '#1A1A1A', zIndex: 1, pointerEvents: 'none',
              }} />
            )}

            {/* Task rows */}
            {scale.tasks.map((t, i) => {
              const leftPct  = (t.startU / scale.span) * 100;
              const widthPct = ((t.endU - t.startU) / scale.span) * 100;
              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex', alignItems: 'center',
                    borderBottom: i < scale.tasks.length - 1 ? '1px solid #F4F4F6' : 'none',
                    minHeight: '64px', padding: '10px 0',
                  }}
                >
                  {/* Left: project name */}
                  <div style={{ width: `${TL_LEFT_W}px`, flexShrink: 0, paddingRight: '10px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 500, color: '#8A8A9A', lineHeight: 1.4, whiteSpace: 'pre-line', overflow: 'hidden' }}>
                      {t.project}
                    </p>
                  </div>

                  {/* Right: Gantt track */}
                  <div style={{ flex: 1, position: 'relative', height: '40px' }}>
                    {/* Vertical grid lines */}
                    {Array.from({ length: scale.span + 1 }, (_, gi) => (
                      <div key={gi} style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: `${(gi / scale.span) * 100}%`,
                        width: '1px', background: '#F0F0F4', pointerEvents: 'none',
                      }} />
                    ))}

                    {/* Task bar */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%', transform: 'translateY(-50%)',
                        height: '34px',
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        background: t.barBg,
                        borderRadius: '10px',
                        display: 'flex', alignItems: 'center', gap: '7px',
                        paddingLeft: '8px', paddingRight: '10px',
                        overflow: 'hidden', cursor: 'pointer',
                        transition: 'filter 120ms ease', zIndex: 2,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.filter = 'brightness(0.96)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.filter = 'none'; }}
                      onClick={() => {
                        const original = (tasks || []).find(task => task.id === t.id);
                        if (original) onTaskClick?.(original);
                      }}
                    >
                      {/* Avatars */}
                      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        {t.avatars.slice(0, 3).map((av, ai) => (
                          <Avatar key={ai} className="h-[18px] w-[18px]" style={{ outline: `2px solid ${t.barBg}`, marginLeft: ai === 0 ? 0 : '-5px', zIndex: 3 - ai }}>
                            <AvatarFallback className="text-[7px] font-bold" style={{ background: AVATAR_COLORS[av]?.bg ?? '#F4F4F6', color: AVATAR_COLORS[av]?.color ?? '#6B7280' }}>
                              {av}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 400, color: '#111827', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                        {t.taskName}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 400, color: '#111827', flexShrink: 0 }}>
                        {t.progress}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Period labels — at the bottom */}
            <div style={{ display: 'flex', marginTop: '6px' }}>
              <div style={{ width: `${TL_LEFT_W}px`, flexShrink: 0 }} />
              <div style={{ flex: 1, position: 'relative', height: '20px' }}>
                {scale.labels.map((label, lIdx) => label ? (
                  <div
                    key={lIdx}
                    style={{
                      position: 'absolute',
                      left: `${(lIdx / scale.span) * 100}%`,
                      transform: 'translateX(-50%)',
                      fontSize: '9px',
                      fontWeight: lIdx === scale.todayLabelIdx ? 800 : 600,
                      color: lIdx === scale.todayLabelIdx ? '#111827' : '#7A7A8A',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </div>
                ) : null)}
              </div>
            </div>

          </div>
          )}
        </div>

        {/* ── Today Projects (inside left column) ── */}
        <div style={{ background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: '12px', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Proyectos de hoy</p>
            <button
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                height: '30px', padding: '0 12px',
                borderRadius: '8px', border: '1px solid #E4E4E8',
                background: '#111827', color: '#FFFFFF',
                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#333'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#111827'; }}
            >
              <Plus className="h-3 w-3" strokeWidth={2.5} />
              Nuevo proyecto
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {todayProjects.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px 0', color: '#9CA3AF', fontSize: '12px' }}>
                Sin tareas activas
              </div>
            )}
            {todayProjects.map(p => {
              const chip = PRIORITY_CHIP[p.priority];
              return (
                <div
                  key={p.id}
                  style={{
                    background: '#FFFFFF', border: '1px solid #E8E8E8',
                    borderRadius: '14px', padding: '16px',
                    boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                    cursor: 'pointer', transition: 'box-shadow 150ms ease, border-color 150ms ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 3px 12px rgba(0,0,0,.09)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#D8D8D8'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,.06)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#E8E8E8'; }}
                >
                  {/* Row 1: category + menu */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.category}</span>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C0C0C8', flexShrink: 0, lineHeight: 0 }}>
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {/* Row 2: mini chart icon + date pill */}
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px', border: '1px solid #E8E8E8', borderRadius: '999px' }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                        <rect x="1" y="7" width="2" height="4" rx="0.4" fill={p.chartColor} opacity="0.5" />
                        <rect x="4" y="4.5" width="2" height="6.5" rx="0.4" fill={p.chartColor} opacity="0.75" />
                        <rect x="7" y="2" width="2" height="9" rx="0.4" fill={p.chartColor} />
                        <rect x="10" y="5" width="2" height="6" rx="0.4" fill={p.chartColor} opacity="0.6" />
                      </svg>
                      <span style={{ fontSize: '10px', fontWeight: 500, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{p.dueDate}</span>
                    </div>
                  </div>
                  {/* Divider */}
                  <div style={{ borderTop: '1px solid #F2F2F4', marginBottom: '10px' }} />
                  {/* Row 3: task title */}
                  <p className="line-clamp-1" style={{ fontSize: '13px', fontWeight: 700, color: '#1A1A1A', marginBottom: '5px', lineHeight: 1.4 }}>{p.title}</p>
                  {/* Row 4: description */}
                  <p className="line-clamp-2" style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: 1.5, marginBottom: '12px' }}>{p.desc}</p>
                  {/* Row 5: progress bar */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ width: '100%', height: '5px', borderRadius: '999px', background: '#EBEBEB', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${p.progress}%`, borderRadius: '999px', background: '#059669', transition: 'width 500ms ease' }} />
                    </div>
                    <p style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '4px' }}>
                      <span style={{ fontWeight: 600, color: '#6B6B78' }}>Progreso</span> : {p.progress}%
                    </p>
                  </div>
                  {/* Row 6: avatars + counts */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={e => { e.stopPropagation(); setChatProjectId(p.id); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px',
                          color: chatProjectId === p.id ? '#7C3AED' : '#9CA3AF',
                          background: chatProjectId === p.id ? '#EEF3F8' : 'transparent',
                          border: 'none', cursor: 'pointer', padding: '3px 6px', borderRadius: '6px',
                          transition: 'all 120ms ease', fontWeight: chatProjectId === p.id ? 600 : 400,
                        }}
                        onMouseEnter={e => { if (chatProjectId !== p.id) { e.currentTarget.style.color = '#7C3AED'; e.currentTarget.style.background = '#F0F5FA'; } }}
                        onMouseLeave={e => { if (chatProjectId !== p.id) { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.background = 'transparent'; } }}
                      >
                        <MessageSquare className="h-3 w-3" /> {p.comments}
                      </button>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#9CA3AF' }}>
                        <Link2 className="h-3 w-3" /> {p.links}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        </div>{/* END LEFT COLUMN */}

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Team */}
          <div style={{ background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>Equipo</p>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0, color: '#D1D5DB' }}>
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#9CA3AF', fontSize: '12px' }}>
              Sin miembros del equipo
            </div>
          </div>

          {/* Upcoming Meetings */}
          <div style={{ background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>Próximas Reuniones</p>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0, color: '#D1D5DB' }}>
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#9CA3AF', fontSize: '12px' }}>
              Sin reuniones programadas
            </div>
          </div>
        </div>
      </div>{/* END MAIN ROW */}

      {/* ── Bottom row: Milestone Tracker + Activity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Milestone Tracker */}
        <div style={{ background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Seguimiento de Hitos</p>
            <div style={{ display: 'flex', gap: '2px', background: '#F4F4F6', borderRadius: '9px', padding: '3px' }}>
              {(['1m', '3m', '6m', '1y'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setMilestoneTab(tab)}
                  style={{
                    padding: '4px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                    fontSize: '11px', fontWeight: 600,
                    background: milestoneTab === tab ? '#FFFFFF' : 'transparent',
                    color: milestoneTab === tab ? '#111827' : '#9CA3AF',
                    boxShadow: milestoneTab === tab ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                    transition: 'all 150ms ease',
                  }}
                >
                  {{ '1m': '1 Mes', '3m': '3 Meses', '6m': '6 Meses', '1y': '1 Año' }[tab]}
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '14px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#6B7280' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#059669' }} />
              Objetivo
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#6B7280' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#E09458' }} />
              Real
            </span>
          </div>

          {milestoneData.length === 0 || milestoneData.every(d => d.Target === 0 && d.Actual === 0) ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF' }}>
              <BarChart2 className="h-8 w-8 mx-auto mb-2" style={{ color: '#D1D5DB' }} />
              <p style={{ fontSize: '13px', fontWeight: 500 }}>Sin datos para este período</p>
              <p style={{ fontSize: '11px', marginTop: '4px' }}>Creá tareas con fecha límite para ver el seguimiento</p>
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={milestoneData} barCategoryGap="30%" barGap={3}>
              <CartesianGrid vertical={false} stroke="#F0F0F4" strokeDasharray="0" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#9CA3AF', fontWeight: 600 }}
              />
              <Tooltip
                contentStyle={{
                  background: '#FFFFFF', border: '1px solid #E4E4E8',
                  borderRadius: '10px', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,.08)',
                }}
                cursor={{ fill: '#F4F4F6', radius: 6 }}
              />
              <Bar dataKey="Target" fill="#059669" radius={[5, 5, 0, 0]} maxBarSize={18} />
              <Bar dataKey="Actual"  fill="#E09458" radius={[5, 5, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>

        {/* Activity Feed */}
        <div style={{ background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Actividad</p>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0, color: '#C0C0C8' }}>
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#9CA3AF', fontSize: '12px' }}>
            Sin actividad reciente
          </div>
        </div>

      </div>{/* END BOTTOM ROW */}

    </div>

    {/* ── Chat Panel Overlay ── */}
    {chatProject && (
      <>
        {/* Backdrop */}
        <div onClick={() => setChatProjectId(null)} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.08)', animation: 'fadeIn 150ms ease' }} />

        {/* Panel */}
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '380px', zIndex: 50, background: '#FFFFFF', borderLeft: '1px solid #E4E4E8', boxShadow: '-4px 0 24px rgba(0,0,0,.08)', display: 'flex', flexDirection: 'column', animation: 'slideInRight 220ms cubic-bezier(0.22,1,0.36,1)' }}>
          <style>{`
            @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes slideInRight { from { transform: translateX(100%) } to { transform: translateX(0) } }
          `}</style>

          {/* Header */}
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #F0F0F4' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Comentarios</p>
                <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>{chatProject.category} · {chatProject.title}</p>
              </div>
              <button onClick={() => setChatProjectId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', lineHeight: 0, padding: '2px', borderRadius: '6px', transition: 'color 120ms ease' }} onMouseEnter={e => { e.currentTarget.style.color = '#374151'; }} onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#9CA3AF', marginTop: '10px' }}>
              <MessageSquare className="h-3 w-3" />
              <span style={{ fontWeight: 600, color: '#374151' }}>{chatProject.comments}</span> comentarios
            </div>
          </div>

          {/* Comments list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {chatComments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: '12px' }}>
                Sin comentarios aún
              </div>
            ) : (
              chatComments.map((c: any) => (
                <div key={c.id} style={{ fontSize: '12px', color: '#374151' }}>{c.content}</div>
              ))
            )}
          </div>

          {/* Input footer */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid #F0F0F4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src="https://i.pravatar.cc/40?img=12" />
                <AvatarFallback style={{ fontSize: '8px', fontWeight: 700, background: '#EDE9FE', color: '#7C3AED' }}>Yo</AvatarFallback>
              </Avatar>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', background: '#F6F6F8', borderRadius: '20px', padding: '6px 12px' }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Escribe un comentario..."
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '12px', color: '#374151' }}
                  onKeyDown={e => { if (e.key === 'Enter' && chatInput.trim()) setChatInput(''); }}
                />
                <button onClick={() => setChatInput('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: chatInput.trim() ? '#7C3AED' : '#C0C0C8', lineHeight: 0, transition: 'color 120ms ease' }}>
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    )}
    </>
  );
}

