'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X,
  Calendar,
  User,
  Paperclip,
  MessageSquare,
  Activity,
  AlertCircle,
  FileText,
  Tag,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  UserPlus,
  Pencil,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format, isToday, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { SubtaskList, type SubtaskItem } from './SubtaskList';
import type { AgendaTask, AgendaTaskStatus, Priority } from '@/lib/agenda/types';
import {
  TASK_STATUS_CONFIG,
  getAssigneeName,
  isTaskOverdue,
} from '@/lib/agenda/types';

// Exact spec hex colors
const PRIORITY_CHIP: Record<Priority, { bg: string; text: string; label: string }> = {
  LOW:    { bg: '#F6F6F6', text: '#575456', label: 'Baja' },
  MEDIUM: { bg: '#D0E0F0', text: '#3070A8', label: 'Media' },
  HIGH:   { bg: '#F9F0DB', text: '#907840', label: 'Alta' },
  URGENT: { bg: '#F9E4E2', text: '#ED8A94', label: 'Urgente' },
};

const STATUS_CHIP: Record<AgendaTaskStatus, { bg: string; text: string; dot: string }> = {
  PENDING:     { bg: '#F6F6F6', text: '#050505', dot: '#9C9CAA' },
  IN_PROGRESS: { bg: '#D0E0F0', text: '#3070A8', dot: '#3070A8' },
  WAITING:     { bg: '#F9F0DB', text: '#907840', dot: '#907840' },
  COMPLETED:   { bg: '#D0EFE0', text: '#568177', dot: '#568177' },
  CANCELLED:   { bg: '#F9E4E2', text: '#ED8A94', dot: '#ED8A94' },
};

const MOCK_SUBTASKS: SubtaskItem[] = [
  { id: '1', title: 'Reunión inicial y mapa de conceptos', note: 'Confirmar asistentes', completed: true },
  { id: '2', title: 'Recopilar referencias y moodboard', completed: false },
  { id: '3', title: 'Revisar brief del cliente', note: 'Ajuste menor al logo y guía de diseño', completed: false },
  { id: '4', title: 'Preparar feedback y presentación', note: 'Versión 2 del documento', completed: false },
];

const MOCK_COMMENTS = [
  { id: 1, author: 'Juan P.', content: 'Revisé el documento, falta la sección de costos.', time: 'Hace 2h', bg: '#D0E0F0', color: '#3070A8' },
  { id: 2, author: 'María G.', content: 'Actualizado, pueden revisar ahora.', time: 'Hace 45m', bg: '#D0EFE0', color: '#568177' },
  { id: 3, author: 'Carlos R.', content: 'Perfecto, aprobado.', time: 'Hace 20m', bg: '#F9F0DB', color: '#907840' },
];

const MOCK_ACTIVITY = [
  { id: 1, text: 'creó esta tarea', user: 'Juan P.', time: 'Hace 3 días' },
  { id: 2, text: 'cambió el estado a En progreso', user: 'María G.', time: 'Hace 2 días' },
  { id: 3, text: 'asignó a Carlos R.', user: 'Juan P.', time: 'Hace 1 día' },
  { id: 4, text: 'agregó un comentario', user: 'Carlos R.', time: 'Hace 20m' },
];

const MOCK_ATTACHMENTS = [
  { name: 'Brief diseño.pdf', size: '1.5 MB', type: 'pdf' },
  { name: 'Dashboard.fig', size: '2.5 MB', type: 'fig' },
];

const PANEL_WIDTH_NORMAL = 750;

// File type icon — solid colored square with recognizable logo marks
function FileTypeIcon({ type }: { type: string }) {
  const ext = type.toLowerCase();

  // PDF — red square, bold "PDF" text
  if (ext === 'pdf') return (
    <svg width="28" height="28" viewBox="0 0 36 36" fill="none" style={{ flexShrink: 0 }}>
      <rect width="36" height="36" rx="8" fill="#E03B2E"/>
      <text x="18" y="23" textAnchor="middle" fontSize="12" fontWeight="bold" fill="white" fontFamily="Arial, Helvetica, sans-serif">PDF</text>
    </svg>
  );

  // Word — blue square, double-V "W" stroke
  if (ext === 'doc' || ext === 'docx') return (
    <svg width="28" height="28" viewBox="0 0 36 36" fill="none" style={{ flexShrink: 0 }}>
      <rect width="36" height="36" rx="8" fill="#2B7CD3"/>
      <path d="M7 13L11 23L18 16L25 23L29 13" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  // Excel — green square, X stroke
  if (ext === 'xls' || ext === 'xlsx') return (
    <svg width="28" height="28" viewBox="0 0 36 36" fill="none" style={{ flexShrink: 0 }}>
      <rect width="36" height="36" rx="8" fill="#1E7E45"/>
      <path d="M10 12L26 24M26 12L10 24" stroke="white" strokeWidth="2.6" strokeLinecap="round"/>
    </svg>
  );

  // Figma — white card, correct 5-node logo
  // Red D-shape (top-left) tangent to Salmon ○ (top-right)
  // Purple ○ (mid-left) | Blue ○ (mid-right)
  // Green ○ (bot-left only)
  // Each node is 10px wide, 10px tall; left col center x=13.5, right col center x=23.5
  if (ext === 'fig' || ext === 'figma') return (
    <svg width="28" height="28" viewBox="0 0 36 36" fill="none" style={{ flexShrink: 0 }}>
      <rect width="36" height="36" rx="8" fill="#FFFFFF" stroke="#E8E8EC" strokeWidth="1"/>
      {/* Red D-shape: left col, top row. Arc rightmost point = x=18.5 */}
      <path d="M8 5H13.5C16.3 5 18.5 7.2 18.5 10C18.5 12.8 16.3 15 13.5 15H8V5Z" fill="#F24E1E"/>
      {/* Salmon circle: right col, top row. cx=23.5, tangent to red at x=18.5 */}
      <circle cx="23.5" cy="10" r="5" fill="#FF7262"/>
      {/* Purple circle: left col, mid row */}
      <circle cx="13.5" cy="20" r="5" fill="#A259FF"/>
      {/* Blue circle: right col, mid row */}
      <circle cx="23.5" cy="20" r="5" fill="#1ABCFE"/>
      {/* Green circle: left col, bottom row */}
      <circle cx="13.5" cy="30" r="4.5" fill="#0ACF83"/>
    </svg>
  );

  // PowerPoint — orange square, P stroke
  if (ext === 'ppt' || ext === 'pptx') return (
    <svg width="28" height="28" viewBox="0 0 36 36" fill="none" style={{ flexShrink: 0 }}>
      <rect width="36" height="36" rx="8" fill="#D14B25"/>
      <path d="M11 12V24M11 12H18C20.2 12 22 13.8 22 16C22 18.2 20.2 20 18 20H11" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  // Images — amber square, mountain scene
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return (
    <svg width="28" height="28" viewBox="0 0 36 36" fill="none" style={{ flexShrink: 0 }}>
      <rect width="36" height="36" rx="8" fill="#C07000"/>
      <circle cx="11" cy="12" r="3" fill="white" opacity="0.85"/>
      <path d="M4 27L12 17L18 22L23 15L32 27H4Z" fill="white" opacity="0.7"/>
    </svg>
  );

  // ZIP — grey square, "ZIP" text
  if (ext === 'zip' || ext === 'rar' || ext === '7z') return (
    <svg width="28" height="28" viewBox="0 0 36 36" fill="none" style={{ flexShrink: 0 }}>
      <rect width="36" height="36" rx="8" fill="#6B7280"/>
      <text x="18" y="23" textAnchor="middle" fontSize="12" fontWeight="bold" fill="white" fontFamily="Arial, Helvetica, sans-serif">ZIP</text>
    </svg>
  );

  // Generic fallback — slate square, extension label
  const label = ext.toUpperCase().slice(0, 4);
  const fs = label.length > 3 ? '9' : '12';
  return (
    <svg width="28" height="28" viewBox="0 0 36 36" fill="none" style={{ flexShrink: 0 }}>
      <rect width="36" height="36" rx="8" fill="#9CA3AF"/>
      <text x="18" y="23" textAnchor="middle" fontSize={fs} fontWeight="bold" fill="white" fontFamily="Arial, Helvetica, sans-serif">{label}</text>
    </svg>
  );
}

interface TaskDetailPanelProps {
  task: AgendaTask | null;
  open: boolean;
  onClose: () => void;
  onStatusChange?: (task: AgendaTask, status: AgendaTaskStatus) => Promise<void>;
  onEdit?: (task: AgendaTask) => void;
  expanded?: boolean;
  onExpandedChange?: (v: boolean) => void;
}

export function TaskDetailPanel({ task, open, onClose, onEdit, expanded = false, onExpandedChange }: TaskDetailPanelProps) {
  const [subtasks, setSubtasks]   = useState<SubtaskItem[]>(MOCK_SUBTASKS);
  const [activeTab, setActiveTab] = useState<'subtasks' | 'comments' | 'activities'>('subtasks');
  const [tabAnimKey, setTabAnimKey] = useState(0);
  const [openAnim,   setOpenAnim]   = useState(false);
  const [expandAnim, setExpandAnim] = useState<'expand' | 'contract' | null>(null);
  const prevOpenRef     = useRef(false);
  const prevExpandedRef = useRef(expanded);

  // Trigger slide-in animation when panel opens
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setOpenAnim(true);
      const t = setTimeout(() => setOpenAnim(false), 580);
      prevOpenRef.current = true;
      return () => clearTimeout(t);
    }
    if (!open) prevOpenRef.current = false;
  }, [open]);

  // Trigger zoom animation when panel expands / contracts
  useEffect(() => {
    if (expanded !== prevExpandedRef.current) {
      setExpandAnim(expanded ? 'expand' : 'contract');
      const t = setTimeout(() => setExpandAnim(null), 700);
      prevExpandedRef.current = expanded;
      return () => clearTimeout(t);
    }
  }, [expanded]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const panelWidth = expanded ? undefined : `${PANEL_WIDTH_NORMAL}px`;

  const statusConfig  = task ? TASK_STATUS_CONFIG[task.status] : null;
  const statusChip    = task ? STATUS_CHIP[task.status]    : null;
  const priorityChip  = task ? PRIORITY_CHIP[task.priority] : null;
  const isOverdue     = task ? isTaskOverdue(task)          : false;
  const assigneeName  = task ? getAssigneeName(task)        : '';
  const assigneeInitials = assigneeName && assigneeName !== 'Sin asignar'
    ? assigneeName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : null;

  const completedCount  = subtasks.filter(s => s.completed).length;
  const subtaskProgress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

  return (
    <>
    <style>{`
      @keyframes panel-slide-in {
        from { opacity: 0; transform: translateX(48px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes panel-expand {
        from { opacity: 0; transform: translateX(48px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes panel-contract {
        from { opacity: 0; transform: translateX(48px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes tab-fade-in {
        from { opacity: 0; transform: translateY(5px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `}</style>
    {/* Outer wrapper — inline when normal, absolute overlay when expanded */}
    <div
      style={
        expanded && open
          ? {
              position: 'absolute',
              inset: 0,
              zIndex: 20,
              overflow: 'hidden',
              background: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
            }
          : {
              width:    open ? panelWidth : '0px',
              minWidth: open ? panelWidth : '0px',
              flexShrink: 0,
              overflow: 'hidden',
              borderLeft: '1px solid #E4E4E4',
              background: '#FFFFFF',
              transition: 'min-width 300ms cubic-bezier(.4,0,.2,1), width 300ms cubic-bezier(.4,0,.2,1)',
              display: 'flex',
              flexDirection: 'column',
            }
      }
    >
      {/* Inner — full height, animates on open + expand */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          opacity: open ? 1 : 0,
          transition: 'opacity 180ms ease',
          animation: expandAnim
            ? `panel-${expandAnim} 700ms cubic-bezier(0.22,1,0.36,1) forwards`
            : openAnim
            ? 'panel-slide-in 580ms cubic-bezier(0.22,1,0.36,1)'
            : undefined,
        }}
      >
        {task && statusConfig && statusChip && priorityChip ? (
          <>
            {/* Header — single row */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #E4E4E4', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Icon */}
              <div style={{ height: '30px', width: '30px', borderRadius: '9px', background: '#F6F6F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText className="h-3.5 w-3.5" style={{ color: '#9C9CAA' }} />
              </div>

              {/* Title block: name + time below */}
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flexShrink: 1 }}>
                <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#050505', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                  {task.title}
                </h2>
                {task.createdAt && (
                  <span style={{ fontSize: '10px', color: '#B0B0BC', fontWeight: 500, lineHeight: 1.3, marginTop: '1px' }}>
                    {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true, locale: es })}
                  </span>
                )}
              </div>

              {/* Chips */}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: statusChip.bg, color: statusChip.text, flexShrink: 0 }}>
                <span style={{ height: '5px', width: '5px', borderRadius: '50%', background: statusChip.dot, flexShrink: 0 }} />
                {statusConfig.label}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: priorityChip.bg, color: priorityChip.text, flexShrink: 0 }}>
                {priorityChip.label}
              </span>
              {isOverdue && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: '#F9E4E2', color: '#ED8A94', flexShrink: 0 }}>
                  <AlertCircle className="h-3 w-3" /> Vencida
                </span>
              )}

              <div style={{ flex: 1 }} />

              {/* Avatars */}
              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <Avatar className="h-6 w-6" style={{ outline: '2px solid #FFFFFF', marginRight: '-6px', zIndex: 2 }}>
                  <AvatarFallback className="text-[8px] font-bold" style={{ background: '#D0EFE0', color: '#568177' }}>
                    {task.createdBy?.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() ?? '?'}
                  </AvatarFallback>
                </Avatar>
                {assigneeInitials && task.assignedToUserId !== task.createdById && (
                  <Avatar className="h-6 w-6" style={{ outline: '2px solid #FFFFFF', zIndex: 1 }}>
                    <AvatarFallback className="text-[8px] font-bold" style={{ background: '#D0E0F0', color: '#3070A8' }}>
                      {assigneeInitials}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>

              {/* + Agregar */}
              <button
                style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '26px', padding: '0 9px', borderRadius: '7px', border: '1px solid #E4E4E4', background: '#FFFFFF', color: '#575456', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 150ms ease', flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F6F6F6'; e.currentTarget.style.borderColor = '#D0D0D8'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E4E4E4'; }}
              >
                <UserPlus className="h-3 w-3" />
                Agregar
              </button>

              {/* ... menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    style={{ height: '26px', width: '26px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#9C9CAA', cursor: 'pointer', transition: 'all 150ms ease', flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#F6F6F6'; e.currentTarget.style.color = '#575456'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9C9CAA'; }}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-xs gap-2" onClick={() => task && onEdit?.(task)}>
                    <Pencil className="h-3 w-3" /> Editar tarea
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Divider */}
              <div style={{ width: '1px', height: '16px', background: '#E4E4E4', flexShrink: 0 }} />

              {/* Expand */}
              <button
                onClick={() => onExpandedChange?.(!expanded)}
                title={expanded ? 'Reducir panel' : 'Expandir panel'}
                style={{ height: '26px', width: '26px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9C9CAA', background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'all 150ms ease' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F6F6F6'; e.currentTarget.style.color = '#575456'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9C9CAA'; }}
              >
                {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>

              {/* Close */}
              <button
                onClick={onClose}
                style={{ height: '26px', width: '26px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9C9CAA', background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'all 150ms ease' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F6F6F6'; e.currentTarget.style.color = '#575456'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9C9CAA'; }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Scrollable body */}
            <ScrollArea className="flex-1">
              <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {/* Meta fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Assignee */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100px', flexShrink: 0, color: '#9C9CAA' }}>
                      <User className="h-3.5 w-3.5" />
                      <span style={{ fontSize: '12px', fontWeight: 500 }}>Asignado</span>
                    </div>
                    {assigneeInitials ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[9px] font-bold" style={{ background: '#D0E0F0', color: '#3070A8' }}>
                            {assigneeInitials}
                          </AvatarFallback>
                        </Avatar>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#575456' }}>{assigneeName}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#9C9CAA' }}>Sin asignar</span>
                    )}
                  </div>

                  {/* Due date */}
                  {task.dueDate && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100px', flexShrink: 0, color: '#9C9CAA' }}>
                        <Calendar className="h-3.5 w-3.5" />
                        <span style={{ fontSize: '12px', fontWeight: 500 }}>Vencimiento</span>
                      </div>
                      <span style={{
                        fontSize: '13px', fontWeight: 500,
                        color: isOverdue ? '#ED8A94' : isToday(new Date(task.dueDate)) ? '#907840' : '#575456',
                      }}>
                        {format(new Date(task.dueDate), "d 'de' MMMM, yyyy", { locale: es })}
                      </span>
                    </div>
                  )}

                  {/* Category */}
                  {task.category && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100px', flexShrink: 0, color: '#9C9CAA' }}>
                        <Tag className="h-3.5 w-3.5" />
                        <span style={{ fontSize: '12px', fontWeight: 500 }}>Categoría</span>
                      </div>
                      <span style={{
                        fontSize: '12px', fontWeight: 600, padding: '2px 10px',
                        borderRadius: '999px', background: '#D0E0F0', color: '#3070A8',
                      }}>
                        {task.category}
                      </span>
                    </div>
                  )}

                  {/* Description */}
                  {task.description && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100px', flexShrink: 0, color: '#9C9CAA', marginTop: '2px' }}>
                        <FileText className="h-3.5 w-3.5" />
                        <span style={{ fontSize: '12px', fontWeight: 500 }}>Descripción</span>
                      </div>
                      <p style={{ fontSize: '13px', color: '#575456', lineHeight: 1.6, flex: 1 }}>
                        {task.description}
                      </p>
                    </div>
                  )}
                </div>

                {/* Attachments */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#9C9CAA' }}>
                      <Paperclip className="h-3 w-3" />
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>Adjuntos ({MOCK_ATTACHMENTS.length})</span>
                    </div>
                    <button style={{ fontSize: '10px', color: '#3070A8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                      Descargar todo
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {MOCK_ATTACHMENTS.map(att => (
                      <div
                        key={att.name}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '5px 10px 5px 6px',
                          background: '#FFFFFF',
                          border: '1px solid #E8E8EC', borderRadius: '10px',
                          cursor: 'pointer', transition: 'box-shadow 150ms ease, border-color 150ms ease',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,.07)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#D0D0D8'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = '#E8E8EC'; }}
                      >
                        <FileTypeIcon type={att.type} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: '12px', fontWeight: 600, color: '#050505', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{att.name}</p>
                          <p style={{ fontSize: '10px', color: '#9C9CAA', marginTop: '1px' }}>{att.size}</p>
                        </div>
                      </div>
                    ))}
                    <button
                      style={{
                        height: '38px', width: '32px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', background: '#F6F6F6',
                        border: '1.5px dashed #E4E4E4', borderRadius: '10px',
                        cursor: 'pointer', color: '#9C9CAA', fontSize: '16px',
                        transition: 'all 150ms ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#3070A8'; e.currentTarget.style.background = '#D0E0F0'; e.currentTarget.style.color = '#3070A8'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E4E4E4'; e.currentTarget.style.background = '#F6F6F6'; e.currentTarget.style.color = '#9C9CAA'; }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid #E4E4E4', margin: '0 0 2px' }} />

                {/* Tabs */}
                <div>
                  {/* Tab bar */}
                  <div style={{ display: 'flex', borderBottom: '1px solid #E4E4E4', marginBottom: '16px' }}>
                    {([
                      { key: 'subtasks',   label: 'Subtareas' },
                      { key: 'comments',   label: `Comentarios ${MOCK_COMMENTS.length}` },
                      { key: 'activities', label: 'Actividades' },
                    ] as const).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => { setActiveTab(tab.key); setTabAnimKey(k => k + 1); }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '0 16px 10px',
                          fontSize: '13px', fontWeight: 600,
                          color: activeTab === tab.key ? '#050505' : '#9C9CAA',
                          borderBottom: activeTab === tab.key ? '2px solid #050505' : '2px solid transparent',
                          marginBottom: '-1px',
                          transition: 'color 150ms ease, border-color 150ms ease',
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab content — animated on switch */}
                  <div key={tabAnimKey} style={{ animation: 'tab-fade-in 150ms ease both' }}>

                  {/* Subtareas */}
                  {activeTab === 'subtasks' && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div style={{ flex: 1, height: '6px', background: '#E4E4E4', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: '999px', background: '#568177', width: `${subtaskProgress}%`, transition: 'width 500ms ease' }} />
                        </div>
                        <span style={{ fontSize: '11px', color: '#9C9CAA', fontWeight: 500, flexShrink: 0 }}>{subtaskProgress}%</span>
                      </div>
                      <SubtaskList
                        groupTitle="Proceso de trabajo"
                        subtasks={subtasks}
                        onToggle={(id, completed) =>
                          setSubtasks(prev => prev.map(s => s.id === id ? { ...s, completed } : s))
                        }
                        onAdd={(title) =>
                          setSubtasks(prev => [...prev, { id: Date.now().toString(), title, completed: false }])
                        }
                        onUpdate={(id, updates) =>
                          setSubtasks(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
                        }
                        onReorder={(items) => setSubtasks(items)}
                      />
                    </div>
                  )}

                  {/* Comentarios */}
                  {activeTab === 'comments' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {MOCK_COMMENTS.map(comment => (
                        <div key={comment.id} style={{ display: 'flex', gap: '12px' }}>
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarFallback className="text-[9px] font-bold" style={{ background: comment.bg, color: comment.color }}>
                              {comment.author.split(' ').map(w => w[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#050505' }}>{comment.author}</span>
                              <span style={{ fontSize: '11px', color: '#9C9CAA' }}>{comment.time}</span>
                            </div>
                            <div style={{ background: '#F6F6F6', borderRadius: '12px', borderTopLeftRadius: '4px', padding: '8px 12px' }}>
                              <p style={{ fontSize: '13px', color: '#575456', lineHeight: 1.5 }}>{comment.content}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: '12px', paddingTop: '4px', borderTop: '1px solid #E4E4E4' }}>
                        <div style={{ height: '28px', width: '28px', borderRadius: '50%', background: '#F6F6F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <MessageSquare className="h-3.5 w-3.5" style={{ color: '#9C9CAA' }} />
                        </div>
                        <input
                          placeholder="Escribe un comentario..."
                          className="flex-1 outline-none"
                          style={{
                            fontSize: '13px', background: 'transparent',
                            color: '#050505', borderBottom: '1px solid #E4E4E4',
                            paddingBottom: '6px',
                          }}
                          onFocus={e => { e.currentTarget.style.borderBottomColor = '#3070A8'; }}
                          onBlur={e => { e.currentTarget.style.borderBottomColor = '#E4E4E4'; }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Actividades */}
                  {activeTab === 'activities' && (
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '11px', top: '12px', bottom: '12px', width: '1px', background: '#E4E4E4' }} />
                      {MOCK_ACTIVITY.map(activity => (
                        <div key={activity.id} style={{ display: 'flex', gap: '12px', paddingBottom: '16px' }}>
                          <div
                            style={{
                              position: 'relative', zIndex: 1, height: '24px', width: '24px',
                              borderRadius: '50%', background: '#FFFFFF',
                              border: '2px solid #E4E4E4', display: 'flex',
                              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}
                          >
                            <Activity className="h-2.5 w-2.5" style={{ color: '#9C9CAA' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0, paddingTop: '2px' }}>
                            <p style={{ fontSize: '13px', color: '#575456' }}>
                              <span style={{ fontWeight: 600, color: '#050505' }}>{activity.user}</span>{' '}
                              {activity.text}
                            </p>
                            <p style={{ fontSize: '11px', color: '#9C9CAA', marginTop: '2px' }}>{activity.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  </div>{/* end tab-fade-in wrapper */}
                </div>
              </div>
            </ScrollArea>

          </>
        ) : null}
      </div>
    </div>
    </>
  );
}
