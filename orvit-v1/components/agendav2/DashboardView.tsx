'use client';

import { useState } from 'react';
import {
  Send, FilePen, FileText, ClipboardPlus,
  FolderKanban, ListTodo, Loader2, CheckCircle2,
  MessageSquare, Link2, Plus,
  AlertCircle, MoreHorizontal, CheckCheck, Edit3, AtSign, X, ThumbsUp, Reply,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { AgendaTask } from '@/lib/agenda/types';

/* ─── Mock data ─────────────────────────────────────────── */

const QUICK_ACTIONS = [
  { label: 'Enviar factura',     icon: Send,         bg: '#F2F2F4', color: '#6B6B78' },
  { label: 'Borrador propuesta', icon: FilePen,      bg: '#EEF2F8', color: '#5880A8' },
  { label: 'Crear contrato',     icon: FileText,     bg: '#F5F3EB', color: '#8A7840' },
  { label: 'Agregar formulario', icon: ClipboardPlus,bg: '#EDF4F0', color: '#508070' },
];

const KPI_CARDS = [
  { label: 'Proyectos',   value: 12,  sub: 'Proyectos activos',    icon: FolderKanban, iconBg: '#EEF2FF', iconColor: '#4F46E5' },
  { label: 'Total Tareas',value: 108, sub: 'Tareas creadas',        icon: ListTodo,     iconBg: '#F0FDF4', iconColor: '#16A34A' },
  { label: 'En progreso', value: 12,  sub: 'Tarea',                 icon: Loader2,      iconBg: '#FFF7ED', iconColor: '#EA580C' },
  { label: 'Completadas', value: 76,  sub: 'Tarea',                 icon: CheckCircle2, iconBg: '#ECFDF5', iconColor: '#059669' },
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
  JD: { bg: '#D0E0F0', color: '#3070A8' },
  ME: { bg: '#D0EFE0', color: '#568177' },
  CA: { bg: '#F9F0DB', color: '#907840' },
  NE: { bg: '#F9E4E2', color: '#ED8A94' },
  MA: { bg: '#EEF2FF', color: '#4F46E5' },
};

const MOCK_TEAM = [
  { name: 'Jerome Bell',          role: 'Creative Director', initials: 'JB', img: 'https://i.pravatar.cc/40?img=12' },
  { name: 'Brooklyn Simmons',     role: 'UI Designer',       initials: 'BS', img: 'https://i.pravatar.cc/40?img=5'  },
  { name: 'Cameron Williamson',   role: 'Project Manager',   initials: 'CW', img: 'https://i.pravatar.cc/40?img=11' },
  { name: 'Robert Fox',           role: 'Graphic Design',    initials: 'RF', img: 'https://i.pravatar.cc/40?img=7'  },
];

const MOCK_MEETINGS = [
  { title: 'Revisión de sprint',      date: 'Feb 14', time: '10:00 AM', attendees: ['JD', 'ME', 'CA'], comments: 3, links: 2 },
  { title: 'Demo con cliente — UI',   date: 'Feb 14', time: '02:30 PM', attendees: ['NE', 'MA', 'JD'], comments: 5, links: 1 },
];

const MOCK_TODAY_PROJECTS = [
  {
    id: 1, category: 'ABC Projects',      title: 'Setup Wireframe',
    priority: 'MEDIUM', dueDate: 'Feb 14, 2027', chartColor: '#5880A8',
    desc: 'Automating deployment process for Designer team',
    progress: 40, comments: 6, links: 2,
    avatarImgs: ['https://i.pravatar.cc/40?img=12', 'https://i.pravatar.cc/40?img=3'],
  },
  {
    id: 2, category: 'Sosro Mobile App', title: 'Update Brand Logo Guidelines',
    priority: 'URGENT', dueDate: 'Feb 14, 2027', chartColor: '#A07880',
    desc: 'Minor revision on logo usage guide for design team',
    progress: 55, comments: 6, links: 1,
    avatarImgs: ['https://i.pravatar.cc/40?img=8', 'https://i.pravatar.cc/40?img=11'],
  },
];

// ─── Project Chat / Comments ─────────────────────────────────
interface MockAttachment { name: string; size: string; type: 'fig' | 'doc' | 'pdf' | 'img' }
interface MockComment {
  id: number; author: string; avatar: string; initials: string;
  time: string; text: string; attachment?: MockAttachment;
  replies?: Omit<MockComment, 'replies'>[];
}

const ATTACHMENT_STYLE: Record<string, { bg: string; label: string }> = {
  fig: { bg: '#7B62F6', label: 'Fig' },
  doc: { bg: '#2A5BAD', label: 'W'   },
  pdf: { bg: '#E04B4B', label: 'PDF' },
  img: { bg: '#34A853', label: 'IMG' },
};

const MOCK_COMMENTS: Record<number, MockComment[]> = {
  1: [
    {
      id: 1, author: 'Kiara Laras', avatar: 'https://i.pravatar.cc/40?img=47', initials: 'KL',
      time: 'Hace 2 h', text: '¿Qué te parece este estilo?',
      attachment: { name: 'ABC Dashboard Style.fig', size: '2,5 MB', type: 'fig' },
      replies: [
        {
          id: 2, author: 'Joe Tesla', avatar: 'https://i.pravatar.cc/40?img=68', initials: 'JT',
          time: 'Hace 2 h', text: '¡Está bien! pero debes seguir la dirección, revisa el brief',
          attachment: { name: 'Design System Guidelince.doc', size: '1,5 MB', type: 'doc' },
        },
      ],
    },
    {
      id: 3, author: 'Brooklyn S.', avatar: 'https://i.pravatar.cc/40?img=5', initials: 'BS',
      time: 'Hace 4 h', text: 'Actualicé las pantallas del dashboard, revisen los cambios.',
    },
    {
      id: 4, author: 'Jerome Bell', avatar: 'https://i.pravatar.cc/40?img=12', initials: 'JB',
      time: 'Ayer', text: '¿Alguien puede revisar el handoff de Figma antes del viernes?',
      replies: [
        {
          id: 5, author: 'Cameron W.', avatar: 'https://i.pravatar.cc/40?img=11', initials: 'CW',
          time: 'Ayer', text: 'Yo me encargo, lo reviso esta tarde.',
        },
      ],
    },
  ],
  2: [
    {
      id: 1, author: 'Nando Endae', avatar: 'https://i.pravatar.cc/40?img=8', initials: 'NE',
      time: 'Hace 1 h', text: 'Las guías de logo están listas para revisión.',
      attachment: { name: 'Logo_Guidelines_v2.pdf', size: '3,2 MB', type: 'pdf' },
      replies: [
        {
          id: 2, author: 'Jerome Bell', avatar: 'https://i.pravatar.cc/40?img=12', initials: 'JB',
          time: 'Hace 45 min', text: 'Visto, hay un ajuste menor en el espaciado del isotipo.',
        },
      ],
    },
    {
      id: 3, author: 'Brooklyn S.', avatar: 'https://i.pravatar.cc/40?img=5', initials: 'BS',
      time: 'Hace 3 h', text: 'El cliente pidió versión oscura del logo también.',
    },
  ],
};

const PRIORITY_CHIP: Record<string, { bg: string; color: string }> = {
  LOW:    { bg: '#F2F2F4', color: '#6B6B78' },
  MEDIUM: { bg: '#EEF2F8', color: '#5880A8' },
  HIGH:   { bg: '#F5F3EB', color: '#8A7840' },
  URGENT: { bg: '#F5F0F0', color: '#A07880' },
};
const PRIORITY_LABEL: Record<string, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', URGENT: 'Urgente' };

// ─── Milestone Tracker ──────────────────────────────────────
const MILESTONE_DATA: Record<string, { name: string; Target: number; Actual: number }[]> = {
  '1m': [
    { name: 'Sem 1', Target: 8,  Actual: 6  },
    { name: 'Sem 2', Target: 10, Actual: 9  },
    { name: 'Sem 3', Target: 7,  Actual: 5  },
    { name: 'Sem 4', Target: 9,  Actual: 8  },
  ],
  '3m': [
    { name: 'Ene', Target: 28, Actual: 22 },
    { name: 'Feb', Target: 32, Actual: 30 },
    { name: 'Mar', Target: 25, Actual: 20 },
  ],
  '6m': [
    { name: 'Ene', Target: 28, Actual: 22 },
    { name: 'Feb', Target: 32, Actual: 30 },
    { name: 'Mar', Target: 25, Actual: 20 },
    { name: 'Abr', Target: 38, Actual: 35 },
    { name: 'May', Target: 30, Actual: 28 },
    { name: 'Jun', Target: 42, Actual: 38 },
  ],
  '1y': [
    { name: 'E', Target: 28, Actual: 22 },
    { name: 'F', Target: 32, Actual: 30 },
    { name: 'M', Target: 25, Actual: 20 },
    { name: 'A', Target: 38, Actual: 35 },
    { name: 'M', Target: 30, Actual: 28 },
    { name: 'J', Target: 42, Actual: 38 },
    { name: 'J', Target: 35, Actual: 30 },
    { name: 'A', Target: 40, Actual: 36 },
    { name: 'S', Target: 28, Actual: 25 },
    { name: 'O', Target: 45, Actual: 40 },
    { name: 'N', Target: 38, Actual: 33 },
    { name: 'D', Target: 50, Actual: 46 },
  ],
};

// ─── Activity Feed ───────────────────────────────────────────
const MOCK_ACTIVITY = [
  {
    id: 1,
    avatar: 'https://i.pravatar.cc/40?img=12',
    initials: 'JD',
    name: 'Joe Doe',
    action: 'marcó como completado',
    target: 'Design Proposal',
    time: 'Hace 10 min',
    icon: CheckCheck,
    iconColor: '#508070',
  },
  {
    id: 2,
    avatar: 'https://i.pravatar.cc/40?img=5',
    initials: 'JS',
    name: 'Jane Studio',
    action: 'respondió el formulario',
    target: 'Graphic Design Brief',
    time: 'Hace 32 min',
    icon: Edit3,
    iconColor: '#5880A8',
  },
  {
    id: 3,
    avatar: 'https://i.pravatar.cc/40?img=8',
    initials: 'NE',
    name: 'Nando Endae',
    action: 'te mencionó en',
    target: 'ABC Project',
    time: 'Hace 1 h',
    icon: AtSign,
    iconColor: '#8A7840',
  },
  {
    id: 4,
    avatar: 'https://i.pravatar.cc/40?img=11',
    initials: 'CW',
    name: 'Cameron W.',
    action: 'actualizó el estado de',
    target: 'Mobile App Wireframes',
    time: 'Hace 2 h',
    icon: Edit3,
    iconColor: '#5880A8',
  },
];

/* ─── Component ─────────────────────────────────────────── */

interface DashboardViewProps {
  tasks?: AgendaTask[];
  stats?: unknown;
  isLoading?: boolean;
}

export function DashboardView({ isLoading }: DashboardViewProps) {
  const [ganttTab, setGanttTab] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [milestoneTab, setMilestoneTab] = useState<'1m' | '3m' | '6m' | '1y'>('6m');
  const [chatProjectId, setChatProjectId] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState('');
  const scale = GANTT_SCALES[ganttTab];
  const milestoneData = MILESTONE_DATA[milestoneTab];
  const chatProject = MOCK_TODAY_PROJECTS.find(p => p.id === chatProjectId) ?? null;
  const chatComments = chatProjectId ? (MOCK_COMMENTS[chatProjectId] ?? []) : [];

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '80px', background: '#F6F6F6', borderRadius: '16px', animationName: 'pulse', animationDuration: '1.5s', animationIterationCount: 'infinite' }} />
        ))}
      </div>
    );
  }

  // ── Inline render helpers ──
  function renderAttachment(att: MockAttachment) {
    const s = ATTACHMENT_STYLE[att.type] ?? { bg: '#888', label: '?' };
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', border: '1px solid #E4E4E4', background: '#FAFAFA', marginTop: '8px', cursor: 'pointer' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '8px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.5px' }}>{s.label}</span>
        </div>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 500, color: '#1A1A1A', lineHeight: 1.3, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</p>
          <p style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '1px' }}>{att.size}</p>
        </div>
      </div>
    );
  }

  function renderComment(c: Omit<MockComment, 'replies'>, isReply = false) {
    return (
      <div key={c.id} style={{ display: 'flex', gap: '10px', paddingLeft: isReply ? '40px' : '0' }}>
        <Avatar className="h-7 w-7 shrink-0" style={{ marginTop: '2px' }}>
          <AvatarImage src={c.avatar} />
          <AvatarFallback style={{ fontSize: '8px', fontWeight: 700, background: '#E5E7EB', color: '#374151' }}>{c.initials}</AvatarFallback>
        </Avatar>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>{c.author}</span>
            <span style={{ fontSize: '10px', color: '#9CA3AF' }}>{c.time}</span>
          </div>
          <p style={{ fontSize: '12px', color: '#374151', lineHeight: 1.55 }}>{c.text}</p>
          {c.attachment && renderAttachment(c.attachment)}
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            {(['Responder', 'Me gusta', 'Eliminar'] as const).map(action => (
              <button key={action} style={{ fontSize: '10px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500, transition: 'color 120ms ease' }}
                onMouseEnter={e => { e.currentTarget.style.color = action === 'Eliminar' ? '#E04B4B' : '#374151'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; }}
              >{action}</button>
            ))}
          </div>
        </div>
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
              key={a.label}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '11px 14px', borderRadius: '10px',
                background: '#FFFFFF', border: '1px solid #E4E4E4',
                cursor: 'pointer', textAlign: 'left',
                boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                transition: 'box-shadow 150ms ease, border-color 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,.09)'; e.currentTarget.style.borderColor = '#D8D8D8'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.06)'; e.currentTarget.style.borderColor = '#E4E4E4'; }}
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
        {KPI_CARDS.map(k => (
          <div
            key={k.label}
            style={{
              background: '#FFFFFF', border: '1px solid #E4E4E4', borderRadius: '10px',
              padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px',
              boxShadow: '0 1px 4px rgba(0,0,0,.06)',
              transition: 'box-shadow 150ms ease', cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 3px 12px rgba(0,0,0,.09)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,.06)'; }}
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
        <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E4', borderRadius: '16px', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#050505' }}>Time-Based Activity Map</p>
            <div style={{ display: 'flex', gap: '2px', background: '#F6F6F6', borderRadius: '9px', padding: '3px' }}>
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setGanttTab(tab)}
                  style={{
                    padding: '5px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                    fontSize: '11px', fontWeight: 600,
                    background: ganttTab === tab ? '#FFFFFF' : 'transparent',
                    color: ganttTab === tab ? '#050505' : '#9C9CAA',
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
          <div style={{ position: 'relative' }}>

            {/* TODAY vertical line */}
            {scale.inRange && (
              <div style={{
                position: 'absolute', top: 0, bottom: '28px',
                left: `calc(${TL_LEFT_W}px + (100% - ${TL_LEFT_W}px) * ${scale.todayFrac})`,
                width: '1.5px', background: '#1A1A1A', zIndex: 10, pointerEvents: 'none',
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
                    >
                      {/* Avatars */}
                      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        {t.avatars.slice(0, 3).map((av, ai) => (
                          <Avatar key={ai} className="h-[18px] w-[18px]" style={{ outline: `2px solid ${t.barBg}`, marginLeft: ai === 0 ? 0 : '-5px', zIndex: 3 - ai }}>
                            <AvatarFallback className="text-[7px] font-bold" style={{ background: AVATAR_COLORS[av]?.bg ?? '#F6F6F6', color: AVATAR_COLORS[av]?.color ?? '#575456' }}>
                              {av}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 400, color: '#050505', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                        {t.taskName}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 400, color: '#050505', flexShrink: 0 }}>
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
                      color: lIdx === scale.todayLabelIdx ? '#050505' : '#7A7A8A',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </div>
                ) : null)}
              </div>
            </div>

          </div>
        </div>

        {/* ── Today Projects (inside left column) ── */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E4', borderRadius: '16px', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#050505' }}>Proyectos de hoy</p>
            <button
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                height: '30px', padding: '0 12px',
                borderRadius: '8px', border: '1px solid #E4E4E4',
                background: '#050505', color: '#FFFFFF',
                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#333'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#050505'; }}
            >
              <Plus className="h-3 w-3" strokeWidth={2.5} />
              Nuevo proyecto
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {MOCK_TODAY_PROJECTS.map(p => {
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
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#050505', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.category}</span>
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
                      <span style={{ fontSize: '10px', fontWeight: 500, color: '#9C9CAA', whiteSpace: 'nowrap' }}>{p.dueDate}</span>
                    </div>
                  </div>
                  {/* Divider */}
                  <div style={{ borderTop: '1px solid #F2F2F4', marginBottom: '10px' }} />
                  {/* Row 3: task title */}
                  <p className="line-clamp-1" style={{ fontSize: '13px', fontWeight: 700, color: '#1A1A1A', marginBottom: '5px', lineHeight: 1.4 }}>{p.title}</p>
                  {/* Row 4: description */}
                  <p className="line-clamp-2" style={{ fontSize: '11px', color: '#9C9CAA', lineHeight: 1.5, marginBottom: '12px' }}>{p.desc}</p>
                  {/* Row 5: progress bar */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ width: '100%', height: '5px', borderRadius: '999px', background: '#EBEBEB', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${p.progress}%`, borderRadius: '999px', background: '#568177', transition: 'width 500ms ease' }} />
                    </div>
                    <p style={{ fontSize: '10px', color: '#9C9CAA', marginTop: '4px' }}>
                      <span style={{ fontWeight: 600, color: '#6B6B78' }}>Progress</span> : {p.progress}%
                    </p>
                  </div>
                  {/* Row 6: avatars + counts */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {p.avatarImgs.map((src, i) => (
                        <Avatar key={i} style={{ height: '24px', width: '24px', border: '2px solid #FFFFFF', marginLeft: i === 0 ? 0 : '-7px', boxShadow: '0 1px 3px rgba(0,0,0,.10)' }}>
                          <AvatarImage src={src} />
                          <AvatarFallback style={{ background: '#E5E7EB', color: '#374151', fontSize: '8px' }}>?</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={e => { e.stopPropagation(); setChatProjectId(p.id); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px',
                          color: chatProjectId === p.id ? '#3070A8' : '#9C9CAA',
                          background: chatProjectId === p.id ? '#EEF3F8' : 'transparent',
                          border: 'none', cursor: 'pointer', padding: '3px 6px', borderRadius: '6px',
                          transition: 'all 120ms ease', fontWeight: chatProjectId === p.id ? 600 : 400,
                        }}
                        onMouseEnter={e => { if (chatProjectId !== p.id) { e.currentTarget.style.color = '#3070A8'; e.currentTarget.style.background = '#F0F5FA'; } }}
                        onMouseLeave={e => { if (chatProjectId !== p.id) { e.currentTarget.style.color = '#9C9CAA'; e.currentTarget.style.background = 'transparent'; } }}
                      >
                        <MessageSquare className="h-3 w-3" /> {p.comments}
                      </button>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#9C9CAA' }}>
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
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E4', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>Team</p>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0, color: '#D1D5DB' }}>
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {MOCK_TEAM.map(m => (
                <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={m.img} alt={m.name} />
                    <AvatarFallback className="text-[9px] font-semibold" style={{ background: '#E5E7EB', color: '#374151' }}>{m.initials}</AvatarFallback>
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '12px', fontWeight: 500, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</p>
                    <p style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '1px' }}>{m.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Meetings */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E4', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>Upcoming Meeting</p>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0, color: '#D1D5DB' }}>
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {MOCK_MEETINGS.map(m => (
                <div key={m.title} style={{ borderBottom: '1px solid #F3F4F6', paddingBottom: '12px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 500, color: '#111827', marginBottom: '6px', lineHeight: 1.4 }}>{m.title}</p>
                  <p style={{ fontSize: '10px', color: '#9CA3AF', marginBottom: '8px' }}>{m.date === 'Feb 14' ? 'Monday, Feb 8, 2027' : m.date} · {m.time}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {m.attendees.slice(0, 3).map((av, i) => (
                        <Avatar key={i} className="h-5 w-5" style={{ outline: '1.5px solid #FFFFFF', marginLeft: i === 0 ? 0 : '-4px' }}>
                          <AvatarImage src={`https://i.pravatar.cc/20?img=${i + 3}`} />
                          <AvatarFallback className="text-[7px]" style={{ background: '#E5E7EB', color: '#6B7280' }}>{av}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#6B7280' }}>
                        <MessageSquare className="h-3 w-3" /> {m.comments}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#6B7280' }}>
                        <Link2 className="h-3 w-3" /> {m.links}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>{/* END MAIN ROW */}

      {/* ── Bottom row: Milestone Tracker + Activity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Milestone Tracker */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E4', borderRadius: '16px', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#050505' }}>Milestone Tracker</p>
            <div style={{ display: 'flex', gap: '2px', background: '#F6F6F6', borderRadius: '9px', padding: '3px' }}>
              {(['1m', '3m', '6m', '1y'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setMilestoneTab(tab)}
                  style={{
                    padding: '4px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                    fontSize: '11px', fontWeight: 600,
                    background: milestoneTab === tab ? '#FFFFFF' : 'transparent',
                    color: milestoneTab === tab ? '#050505' : '#9C9CAA',
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
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#568177' }} />
              Target
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#6B7280' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#E09458' }} />
              Actual
            </span>
          </div>

          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={milestoneData} barCategoryGap="30%" barGap={3}>
              <CartesianGrid vertical={false} stroke="#F0F0F4" strokeDasharray="0" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#9C9CAA', fontWeight: 600 }}
              />
              <Tooltip
                contentStyle={{
                  background: '#FFFFFF', border: '1px solid #E4E4E4',
                  borderRadius: '10px', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,.08)',
                }}
                cursor={{ fill: '#F6F6F6', radius: 6 }}
              />
              <Bar dataKey="Target" fill="#568177" radius={[5, 5, 0, 0]} maxBarSize={18} />
              <Bar dataKey="Actual"  fill="#E09458" radius={[5, 5, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Activity Feed */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E4', borderRadius: '16px', padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#050505' }}>Activity</p>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0, color: '#C0C0C8' }}>
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {MOCK_ACTIVITY.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    padding: '12px 0',
                    borderBottom: idx < MOCK_ACTIVITY.length - 1 ? '1px solid #F3F4F6' : 'none',
                  }}
                >
                  {/* Avatar */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={item.avatar} />
                      <AvatarFallback className="text-[9px] font-semibold" style={{ background: '#E5E7EB', color: '#374151' }}>{item.initials}</AvatarFallback>
                    </Avatar>
                    {/* Action icon badge */}
                    <div style={{
                      position: 'absolute', bottom: '-2px', right: '-2px',
                      width: '14px', height: '14px', borderRadius: '50%',
                      background: '#FFFFFF', border: '1px solid #E4E4E4',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon style={{ width: '8px', height: '8px', color: item.iconColor }} />
                    </div>
                  </div>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '12px', color: '#374151', lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 600 }}>{item.name}</span>
                      {' '}{item.action}{' '}
                      <span style={{ fontWeight: 600, color: '#050505' }}>{item.target}</span>
                    </p>
                    <p style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '2px' }}>{item.time}</p>
                  </div>
                </div>
              );
            })}
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
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '380px', zIndex: 50, background: '#FFFFFF', borderLeft: '1px solid #E4E4E4', boxShadow: '-4px 0 24px rgba(0,0,0,.08)', display: 'flex', flexDirection: 'column', animation: 'slideInRight 220ms cubic-bezier(0.22,1,0.36,1)' }}>
          <style>{`
            @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes slideInRight { from { transform: translateX(100%) } to { transform: translateX(0) } }
          `}</style>

          {/* Header */}
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #F0F0F4' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#050505' }}>Comentarios</p>
                <p style={{ fontSize: '11px', color: '#9C9CAA', marginTop: '2px' }}>{chatProject.category} · {chatProject.title}</p>
              </div>
              <button onClick={() => setChatProjectId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9C9CAA', lineHeight: 0, padding: '2px', borderRadius: '6px', transition: 'color 120ms ease' }} onMouseEnter={e => { e.currentTarget.style.color = '#374151'; }} onMouseLeave={e => { e.currentTarget.style.color = '#9C9CAA'; }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#9C9CAA', marginTop: '10px' }}>
              <MessageSquare className="h-3 w-3" />
              <span style={{ fontWeight: 600, color: '#374151' }}>{chatProject.comments}</span> comentarios
            </div>
          </div>

          {/* Comments list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {chatComments.map(c => (
              <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {renderComment(c)}
                {c.replies?.map(r => renderComment(r, true))}
              </div>
            ))}
          </div>

          {/* Input footer */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid #F0F0F4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src="https://i.pravatar.cc/40?img=12" />
                <AvatarFallback style={{ fontSize: '8px', fontWeight: 700, background: '#D0E0F0', color: '#3070A8' }}>Yo</AvatarFallback>
              </Avatar>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', background: '#F6F6F8', borderRadius: '20px', padding: '6px 12px' }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Escribe un comentario..."
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '12px', color: '#374151' }}
                  onKeyDown={e => { if (e.key === 'Enter' && chatInput.trim()) setChatInput(''); }}
                />
                <button onClick={() => setChatInput('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: chatInput.trim() ? '#3070A8' : '#C0C0C8', lineHeight: 0, transition: 'color 120ms ease' }}>
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

