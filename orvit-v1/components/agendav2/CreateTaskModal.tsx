'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  X, Circle, Clock, CheckCircle2, XCircle,
  CalendarCheck2, UserRound, Tag, Flame, NotebookPen,
  Plus, Loader2, ChevronDown, Check, Paperclip, ListChecks,
  FolderKanban,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useUsers } from '@/hooks/use-users';
import { useAuth } from '@/contexts/AuthContext';
import type { AgendaTask, AgendaTaskStatus, Priority, CreateAgendaTaskInput } from '@/lib/agenda/types';
import type { TaskGroupItem } from './AgendaV2Sidebar';

const EMPTY_GROUPS: readonly TaskGroupItem[] = [];

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: {
  value: AgendaTaskStatus;
  label: string;
  icon: typeof Circle;
  color: string;
  bg: string;
  animate?: 'spin' | 'pulse';
}[] = [
  { value: 'PENDING',     label: 'Pendiente',   icon: Circle,       color: '#64748B', bg: '#F1F5F9', animate: 'pulse' },
  { value: 'IN_PROGRESS', label: 'En Progreso',  icon: Loader2,      color: '#6366F1', bg: '#EEF2FF', animate: 'spin'  },
  { value: 'WAITING',     label: 'En Revisión',  icon: Clock,        color: '#D97706', bg: '#FFFBEB'                   },
  { value: 'COMPLETED',   label: 'Completada',   icon: CheckCircle2, color: '#16A34A', bg: '#F0FDF4'                   },
  { value: 'CANCELLED',   label: 'Cancelada',    icon: XCircle,      color: '#DC2626', bg: '#FFF1F2'                   },
];

const PRIORITY_OPTIONS: {
  value: Priority;
  label: string;
  color: string;
  bgColor: string;
}[] = [
  { value: 'LOW',    label: 'Baja',    color: '#6B7280', bgColor: '#F3F4F6' },
  { value: 'MEDIUM', label: 'Media',   color: '#1D4ED8', bgColor: '#EFF6FF' },
  { value: 'HIGH',   label: 'Alta',    color: '#D97706', bgColor: '#FEF3C7' },
  { value: 'URGENT', label: 'Urgente', color: '#DC2626', bgColor: '#FEE2E2' },
];

const DEFAULT_TAGS = [
  'Desarrollo', 'Marketing', 'Operaciones', 'Administración',
  'Soporte', 'Finanzas', 'RRHH', 'Infraestructura', 'Ventas', 'Legal',
];

const ASSIGNEE_CHIP_COLORS = [
  { bg: '#D1FAE5', color: '#059669' },
  { bg: '#FEF3C7', color: '#D97706' },
  { bg: '#E0E7FF', color: '#4338CA' },
  { bg: '#F9E4E2', color: '#C05060' },
  { bg: '#E5E7EB', color: '#374151' },
];

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function getFileExtColor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf: '#E24335', fig: '#A259FF', figma: '#A259FF',
    doc: '#2D5AFF', docx: '#2D5AFF', xls: '#21A366', xlsx: '#21A366',
    png: '#FF9500', jpg: '#FF9500', jpeg: '#FF9500', gif: '#FF9500', webp: '#FF9500',
    ppt: '#FF6B35', pptx: '#FF6B35', zip: '#8E8E93', rar: '#8E8E93',
    mp4: '#FF3B30', mov: '#FF3B30',
  };
  return map[ext] ?? '#9CA3AF';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type SubTask = { id: string; title: string; completed: boolean };

interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStatus?: AgendaTaskStatus;
  defaultDate?: string;
  defaultGroupId?: number | null;
  editTask?: AgendaTask;
  groups?: readonly TaskGroupItem[];
  onSave: (data: CreateAgendaTaskInput & { status?: AgendaTaskStatus }) => Promise<void>;
  isSaving: boolean;
  onRequestCreateGroup?: () => void;
}

// ── Field Row ─────────────────────────────────────────────────────────────────
function FieldRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Circle;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '10px 20px',
      borderBottom: '1px solid #F4F4F4',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        width: '148px', flexShrink: 0,
      }}>
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} style={{ color: '#9CA3AF' }} />
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#9CA3AF' }}>{label}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

// ── Trigger button compartido ─────────────────────────────────────────────────
function FieldTrigger({
  children,
  placeholder,
  hasValue,
  onClick,
  showChevron = true,
}: {
  children?: React.ReactNode;
  placeholder: string;
  hasValue: boolean;
  onClick?: () => void;
  showChevron?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center',
        justifyContent: showChevron ? 'space-between' : 'flex-start',
        gap: '8px',
        padding: '7px 12px',
        borderRadius: '6px',
        border: '1px solid #E4E4E8',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: '13px', fontWeight: 400,
        color: hasValue ? '#111827' : '#9CA3AF',
        textAlign: 'left',
      }}
    >
      {hasValue ? children : <span>{placeholder}</span>}
      {showChevron && <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: '#9CA3AF' }} />}
    </button>
  );
}

// Estilos compartidos para PopoverContent
const dropdownStyle: React.CSSProperties = {
  padding: '4px',
  borderRadius: '8px',
  border: '1.5px solid #D8D8DE',
  boxShadow: '0 4px 16px rgba(0,0,0,.08)',
  background: '#FFFFFF',
  minWidth: '180px',
};

const dropdownItemStyle = (active: boolean): React.CSSProperties => ({
  width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
  padding: '8px 12px', borderRadius: '4px', border: 'none',
  background: active ? '#F4F4F6' : 'transparent',
  cursor: 'pointer', textAlign: 'left',
  fontSize: '13px', fontWeight: 500, color: '#111827',
});

// ── Component ─────────────────────────────────────────────────────────────────
export function CreateTaskModal({
  open,
  onOpenChange,
  defaultStatus = 'PENDING',
  defaultDate,
  defaultGroupId,
  editTask,
  groups = EMPTY_GROUPS,
  onSave,
  isSaving,
  onRequestCreateGroup,
}: CreateTaskModalProps) {
  const isEditMode = !!editTask;
  const { user: currentUser } = useAuth();
  const { users, loading: usersLoading } = useUsers();

  const [title, setTitle]                   = useState('');
  const [description, setDescription]       = useState('');
  const [priority, setPriority]             = useState<Priority>('MEDIUM');
  const [status, setStatus]                 = useState<AgendaTaskStatus>(defaultStatus);
  const [dueDateObj, setDueDateObj]         = useState<Date | undefined>(undefined);
  const [category, setCategory]             = useState('');
  const [assignedToUserIds, setAssignedToUserIds] = useState<number[]>([]);
  const [comment, setComment]               = useState('');

  const [dueTime, setDueTime] = useState<string>('');

  const [subtasks,   setSubtasks]   = useState<SubTask[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customTags, setCustomTags] = useState<string[]>(DEFAULT_TAGS);
  const [tagSearch,  setTagSearch]  = useState('');

  const [showStatusPop,   setShowStatusPop]   = useState(false);
  const [showDatePop,     setShowDatePop]     = useState(false);
  const [showAssigneePop, setShowAssigneePop] = useState(false);
  const [showTagPop,      setShowTagPop]      = useState(false);
  const [showPriorityPop, setShowPriorityPop] = useState(false);
  const [showGroupPop,    setShowGroupPop]    = useState(false);

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(defaultGroupId ?? null);

  // Sync al abrir — pre-fill from editTask when editing
  useEffect(() => {
    if (open) {
      if (editTask) {
        setTitle(editTask.title);
        setDescription(editTask.description ?? '');
        setPriority(editTask.priority);
        setStatus(editTask.status);
        setDueDateObj(editTask.dueDate ? new Date(editTask.dueDate + (editTask.dueDate.includes('T') ? '' : 'T12:00:00')) : undefined);
        setDueTime('');
        setCategory(editTask.category ?? '');
        const assignedId = editTask.assignedToUserId ?? null;
        setAssignedToUserIds(assignedId ? [assignedId] : []);
        setComment('');
        setSubtasks([]); setNewSubtask(''); setAttachments([]);
      } else {
        setStatus(defaultStatus);
        setTitle(''); setDescription(''); setPriority('MEDIUM');
        setDueDateObj(defaultDate ? new Date(defaultDate + 'T12:00:00') : undefined);
        setDueTime(''); setCategory(''); setAssignedToUserIds([]); setComment('');
        setSubtasks([]); setNewSubtask(''); setAttachments([]);
        setSelectedGroupId(defaultGroupId ?? null);
      }
      setShowStatusPop(false); setShowDatePop(false);
      setShowAssigneePop(false); setShowTagPop(false); setShowPriorityPop(false);
      setShowGroupPop(false);
      setTagSearch('');
    }
  }, [defaultStatus, defaultDate, editTask, open]);

  // Backdrop blur del overlay
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const overlay = document.querySelector(
        '[data-radix-portal] > :first-child:not([role="dialog"])'
      ) as HTMLElement | null;
      if (overlay) {
        overlay.style.backdropFilter = 'blur(6px)';
        overlay.style.setProperty('-webkit-backdrop-filter', 'blur(6px)');
        overlay.style.background = 'rgba(0,0,0,0.35)';
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const isValid          = title.trim().length > 0;
  const selectedStatus   = STATUS_OPTIONS.find(s => s.value === status)!;
  const selectedPriority = PRIORITY_OPTIONS.find(p => p.value === priority)!;
  const selectedUsers    = users.filter(u => assignedToUserIds.includes(u.id));
  const dueDateStr = dueDateObj
    ? format(dueDateObj, 'yyyy-MM-dd') + (dueTime ? `T${dueTime}:00` : '')
    : '';

  function toggleAssignee(userId: number) {
    setAssignedToUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  }

  async function handleSave() {
    if (!isValid || isSaving) return;
    await onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate: dueDateStr || undefined,
      category: category.trim() || undefined,
      status,
      assignedToUserId: assignedToUserIds[0] ?? undefined,
      groupId: selectedGroupId ?? undefined,
      isCompanyVisible: assignedToUserIds.length > 0,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Animación: línea al centro → se despliega arriba/abajo + contenido izq→der */}
      <style>{`
        @keyframes createTaskUnfold {
          0% {
            transform: translate(-50%, -50%) scaleY(0);
            opacity: 0;
            filter: blur(6px);
          }
          10% {
            transform: translate(-50%, -50%) scaleY(0.006);
            opacity: 1;
            filter: blur(4px);
          }
          100% {
            transform: translate(-50%, -50%) scaleY(1);
            opacity: 1;
            filter: blur(0px);
          }
        }
        @keyframes ctmRowReveal {
          0% {
            opacity: 0;
            transform: translateX(-18px);
            filter: blur(8px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
            filter: blur(0);
          }
        }
        .ctmodal-title { resize:none; overflow:hidden; }
        .ctmodal-title::placeholder { color:#D0D0D8; }
        .ctmodal-desc::placeholder { color:#C8C8D0; }
        /* Kill Tailwind's default animate-in/zoom-in on this modal */
        .create-task-modal { animation: none !important; }

        .create-task-modal[data-state="open"] {
          animation: createTaskUnfold 950ms cubic-bezier(.22, 1, .36, 1) both !important;
          transform-origin: center center !important;
        }
        .create-task-modal[data-state="open"] > * {
          opacity: 0;
          animation: ctmRowReveal 380ms cubic-bezier(.22, 1, .36, 1) both;
        }
        .create-task-modal[data-state="open"] > *:nth-child(1)  { animation-delay: 80ms; }
        .create-task-modal[data-state="open"] > *:nth-child(2)  { animation-delay: 110ms; }
        .create-task-modal[data-state="open"] > *:nth-child(3)  { animation-delay: 140ms; }
        .create-task-modal[data-state="open"] > *:nth-child(4)  { animation-delay: 170ms; }
        .create-task-modal[data-state="open"] > *:nth-child(5)  { animation-delay: 200ms; }
        .create-task-modal[data-state="open"] > *:nth-child(6)  { animation-delay: 230ms; }
        .create-task-modal[data-state="open"] > *:nth-child(7)  { animation-delay: 260ms; }
        .create-task-modal[data-state="open"] > *:nth-child(8)  { animation-delay: 290ms; }
        .create-task-modal[data-state="open"] > *:nth-child(9)  { animation-delay: 320ms; }
        .create-task-modal[data-state="open"] > *:nth-child(10) { animation-delay: 350ms; }
        .create-task-modal[data-state="open"] > *:nth-child(11) { animation-delay: 380ms; }
        .create-task-modal[data-state="open"] > *:nth-child(12) { animation-delay: 410ms; }
        .create-task-modal[data-state="open"] > *:nth-child(13) { animation-delay: 440ms; }
      `}</style>

      <DialogContent
        hideCloseButton
        className="create-task-modal p-0 overflow-hidden gap-0"
        style={{
          maxWidth: '520px',
          width: 'calc(100% - 32px)',
          borderRadius: '12px',
          border: '1.5px solid #D8D8DE',
          boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.07)',
          background: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90dvh',
        }}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '16px 20px 10px', flexShrink: 0,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            fontSize: '11px', fontWeight: 600, padding: '2px 8px',
            borderRadius: '6px', background: selectedStatus.bg, color: selectedStatus.color,
          }}>
            <span style={{ height: '5px', width: '5px', borderRadius: '50%', background: selectedStatus.color, flexShrink: 0 }} />
            {selectedStatus.label}
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => onOpenChange(false)}
            style={{
              height: '28px', width: '28px', borderRadius: '8px', border: 'none',
              background: 'transparent', color: '#9CA3AF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, transition: 'background 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F4F4F6'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ── Título + Descripción ─────────────────────────────── */}
        <div style={{ padding: '0 20px 16px' }}>
          <textarea
            autoFocus
            value={title}
            onChange={e => {
              setTitle(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            placeholder="Título de la tarea..."
            rows={1}
            className="ctmodal-title w-full outline-none"
            style={{
              fontSize: '18px', fontWeight: 600, color: '#111827',
              background: 'transparent', border: 'none',
              lineHeight: 1.3, marginBottom: '6px', fontFamily: 'inherit',
            }}
            onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
          />
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Agregar descripción..."
            rows={2}
            className="ctmodal-desc w-full outline-none resize-none"
            style={{
              fontSize: '14px', color: '#9CA3AF', lineHeight: 1.6,
              background: 'transparent', border: 'none',
              fontFamily: 'inherit', marginBottom: '0',
            }}
          />
        </div>

        {/* Full-width divider — same as FixedTaskFormSheet */}
        <div style={{ height: '1px', background: '#E4E4E8', margin: '0 0 4px' }} />

        {/* ── Scrollable body ───────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

        {/* ── Grupo ────────────────────────────────────────────── */}
        <FieldRow icon={FolderKanban} label="Grupo">
          <Popover open={showGroupPop} onOpenChange={setShowGroupPop}>
            <PopoverTrigger asChild>
              <button
                type="button"
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '7px 12px', borderRadius: '6px',
                  border: '1px solid #E4E4E8', background: 'transparent',
                  cursor: 'pointer', fontSize: '13px', fontWeight: 400,
                  color: selectedGroupId ? '#111827' : '#9CA3AF',
                  textAlign: 'left',
                }}
              >
                {selectedGroupId ? (
                  <>
                    <span style={{
                      display: 'inline-block', width: '8px', height: '8px',
                      borderRadius: '50%', flexShrink: 0,
                      background: groups.find(g => g.id === selectedGroupId)?.color ?? '#6366f1',
                    }} />
                    {groups.find(g => g.id === selectedGroupId)?.name}
                  </>
                ) : 'Sin grupo'}
                <ChevronDown className="h-3.5 w-3.5 ml-auto shrink-0" style={{ color: '#9CA3AF' }} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-0 w-64" style={dropdownStyle}>
              {/* Sin grupo */}
              <button
                type="button"
                onClick={() => { setSelectedGroupId(null); setShowGroupPop(false); }}
                style={dropdownItemStyle(selectedGroupId === null)}
              >
                <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Sin grupo</span>
                {selectedGroupId === null && <Check className="h-3 w-3 ml-auto" style={{ color: '#9CA3AF' }} />}
              </button>
              {/* Grupos existentes */}
              {groups.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => { setSelectedGroupId(g.id); setShowGroupPop(false); }}
                  style={dropdownItemStyle(selectedGroupId === g.id)}
                >
                  <span style={{
                    display: 'inline-block', width: '8px', height: '8px',
                    borderRadius: '50%', flexShrink: 0, background: g.color,
                  }} />
                  <span style={{ flex: 1 }}>{g.name}</span>
                  <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                    {g.isProject ? 'Proyecto' : 'Grupo'}
                  </span>
                  {selectedGroupId === g.id && <Check className="h-3 w-3" style={{ color: '#9CA3AF' }} />}
                </button>
              ))}
              {/* Crear nuevo grupo */}
              {onRequestCreateGroup && (
                <>
                  <div style={{ height: '1px', background: '#E4E4E8', margin: '4px 0' }} />
                  <button
                    type="button"
                    onClick={() => { setShowGroupPop(false); onRequestCreateGroup(); }}
                    style={{
                      ...dropdownItemStyle(false),
                      color: '#111827', fontWeight: 600,
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} style={{ color: '#111827' }} />
                    Nuevo grupo
                  </button>
                </>
              )}
            </PopoverContent>
          </Popover>
        </FieldRow>

        {/* ── Estado ───────────────────────────────────────────────── */}
        <FieldRow icon={CheckCircle2} label="Estado">
          <Popover open={showStatusPop} onOpenChange={setShowStatusPop}>
            <PopoverTrigger asChild>
              <button
                type="button"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '5px 10px', borderRadius: '6px',
                  border: '1px solid #E4E4E8', background: 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '2px 8px', borderRadius: '4px',
                  background: selectedStatus.bg, color: selectedStatus.color,
                  fontSize: '12px', fontWeight: 600,
                }}>
                  <selectedStatus.icon
                    className={`h-3 w-3 ${selectedStatus.animate === 'spin' ? 'animate-spin' : selectedStatus.animate === 'pulse' ? 'animate-pulse' : ''}`}
                  />
                  {selectedStatus.label}
                </span>
                <ChevronDown className="h-3 w-3" style={{ color: '#9CA3AF' }} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-0 w-52" style={dropdownStyle}>
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setStatus(opt.value); setShowStatusPop(false); }}
                  style={dropdownItemStyle(status === opt.value)}
                >
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '2px 8px', borderRadius: '4px',
                    background: opt.bg, color: opt.color,
                    fontSize: '12px', fontWeight: 600, flexShrink: 0,
                  }}>
                    <opt.icon className={`h-3 w-3 ${opt.animate === 'spin' ? 'animate-spin' : ''}`} />
                    {opt.label}
                  </span>
                  {status === opt.value && <Check className="h-3 w-3 ml-auto" style={{ color: '#9CA3AF' }} />}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </FieldRow>

        {/* ── Vencimiento ──────────────────────────────────────────── */}
        <FieldRow icon={CalendarCheck2} label="Vencimiento">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Popover open={showDatePop} onOpenChange={setShowDatePop}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 14px', borderRadius: '6px',
                    border: '1px solid #E4E4E8', background: 'transparent',
                    cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                    color: dueDateObj ? '#111827' : '#9CA3AF',
                    textAlign: 'left',
                  }}
                >
                  <span>{dueDateObj ? format(dueDateObj, "d MMM yyyy", { locale: es }) : 'Seleccionar fecha...'}</span>
                  {dueDateObj && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setDueDateObj(undefined); setDueTime(''); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9CA3AF', lineHeight: 1 }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-0 w-auto" style={{ ...dropdownStyle, minWidth: 'unset' }}>
                <Calendar
                  mode="single"
                  selected={dueDateObj}
                  onSelect={d => { setDueDateObj(d); setShowDatePop(false); }}
                  locale={es}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Hora opcional — aparece sólo cuando hay fecha */}
            {dueDateObj && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="time"
                  value={dueTime}
                  onChange={e => setDueTime(e.target.value)}
                  style={{
                    padding: '6px 10px', borderRadius: '8px',
                    border: '1px solid #E4E4E8', background: 'transparent',
                    fontSize: '12px', fontWeight: 500,
                    color: dueTime ? '#111827' : '#9CA3AF',
                    outline: 'none', cursor: 'pointer',
                  }}
                />
                {dueTime ? (
                  <button
                    type="button"
                    onClick={() => setDueTime('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9CA3AF', lineHeight: 1 }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : (
                  <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Hora opcional</span>
                )}
              </div>
            )}
          </div>
        </FieldRow>

        {/* ── Asignado (multi) ─────────────────────────────────────── */}
        <FieldRow icon={UserRound} label="Asignados">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
            {/* Chips de seleccionados */}
            {selectedUsers.map(u => {
              const c = ASSIGNEE_CHIP_COLORS[u.id % ASSIGNEE_CHIP_COLORS.length];
              return (
                <span key={u.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '3px 8px 3px 4px', borderRadius: '6px',
                  background: c.bg, color: c.color,
                  fontSize: '12px', fontWeight: 600,
                }}>
                  <div style={{
                    height: '18px', width: '18px', borderRadius: '50%',
                    background: c.color, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '8px', fontWeight: 700, flexShrink: 0,
                  }}>
                    {getInitials(u.name)}
                  </div>
                  {u.name.split(' ')[0]}
                  <button
                    type="button"
                    onClick={() => toggleAssignee(u.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', opacity: 0.5, lineHeight: 1 }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}

            {/* Botón para abrir el selector */}
            <Popover open={showAssigneePop} onOpenChange={setShowAssigneePop}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '5px 10px', borderRadius: '6px',
                    border: '1px dashed #D8D8DE', background: 'transparent',
                    cursor: 'pointer', fontSize: '12px', fontWeight: 500, color: '#9CA3AF',
                  }}
                >
                  <Plus className="h-3 w-3" />
                  {selectedUsers.length === 0 ? 'Agregar persona' : 'Agregar más'}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-0 w-56" style={{ ...dropdownStyle, maxHeight: '220px', overflowY: 'auto' }}>
                {usersLoading ? (
                  <div style={{ padding: '12px', textAlign: 'center' }}>
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" style={{ color: '#9CA3AF' }} />
                  </div>
                ) : users.length === 0 ? (
                  <div style={{ padding: '12px 16px', fontSize: '13px', color: '#9CA3AF' }}>Sin usuarios</div>
                ) : (
                  users.map(u => {
                    const chipColor = ASSIGNEE_CHIP_COLORS[u.id % ASSIGNEE_CHIP_COLORS.length];
                    const isSelected = assignedToUserIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleAssignee(u.id)}
                        style={dropdownItemStyle(isSelected)}
                      >
                        <div style={{
                          height: '24px', width: '24px', borderRadius: '50%', flexShrink: 0,
                          background: chipColor.bg, color: chipColor.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '9px', fontWeight: 700,
                        }}>
                          {getInitials(u.name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {u.name}
                          </div>
                          {u.specialty && (
                            <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{u.specialty}</div>
                          )}
                        </div>
                        {isSelected && <Check className="h-3 w-3 shrink-0" style={{ color: '#9CA3AF' }} />}
                      </button>
                    );
                  })
                )}
              </PopoverContent>
            </Popover>
          </div>
        </FieldRow>

        {/* ── Etiquetas ─────────────────────────────────────────────── */}
        <FieldRow icon={Tag} label="Etiquetas">
          <Popover open={showTagPop} onOpenChange={v => { setShowTagPop(v); if (!v) setTagSearch(''); }}>
            <PopoverTrigger asChild>
              <button
                type="button"
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 14px', borderRadius: '6px',
                  border: '1px solid #E4E4E8', background: 'transparent',
                  cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                  color: category ? '#111827' : '#9CA3AF',
                  textAlign: 'left',
                }}
              >
                <span>{category || 'Seleccionar...'}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: '#9CA3AF' }} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-0 w-56" style={dropdownStyle}>
              {/* Buscador */}
              <div style={{ padding: '8px 8px 4px' }}>
                <input
                  autoFocus
                  value={tagSearch}
                  onChange={e => setTagSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const trimmed = tagSearch.trim();
                      if (!trimmed) return;
                      if (!customTags.includes(trimmed)) setCustomTags(prev => [...prev, trimmed]);
                      setCategory(trimmed);
                      setShowTagPop(false);
                      setTagSearch('');
                    }
                  }}
                  placeholder="Buscar o crear..."
                  className="w-full outline-none"
                  style={{
                    padding: '7px 10px', borderRadius: '8px',
                    border: '1px solid #E4E4E8', background: '#FAFAFA',
                    fontSize: '12px', color: '#111827', width: '100%',
                  }}
                />
              </div>

              {/* Lista filtrada */}
              <div style={{ maxHeight: '180px', overflowY: 'auto', padding: '2px 4px 4px' }}>
                {(() => {
                  const q = tagSearch.trim().toLowerCase();
                  const filtered = customTags.filter(t => t.toLowerCase().includes(q));
                  const exactMatch = customTags.some(t => t.toLowerCase() === q);
                  return (
                    <>
                      {filtered.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => { setCategory(tag); setShowTagPop(false); setTagSearch(''); }}
                          style={dropdownItemStyle(category === tag)}
                        >
                          <span>{tag}</span>
                          {category === tag && <Check className="h-3 w-3 ml-auto" style={{ color: '#9CA3AF' }} />}
                        </button>
                      ))}
                      {tagSearch.trim() && !exactMatch && (
                        <button
                          type="button"
                          onClick={() => {
                            const newTag = tagSearch.trim();
                            setCustomTags(prev => [...prev, newTag]);
                            setCategory(newTag);
                            setShowTagPop(false);
                            setTagSearch('');
                          }}
                          style={{
                            ...dropdownItemStyle(false),
                            color: '#111827', fontWeight: 600,
                          }}
                        >
                          <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} style={{ color: '#111827' }} />
                          Crear "{tagSearch.trim()}"
                        </button>
                      )}
                      {filtered.length === 0 && !tagSearch.trim() && (
                        <div style={{ padding: '8px 12px', fontSize: '12px', color: '#9CA3AF' }}>Sin etiquetas</div>
                      )}
                    </>
                  );
                })()}
              </div>
            </PopoverContent>
          </Popover>
        </FieldRow>

        {/* ── Prioridad ─────────────────────────────────────────────── */}
        <FieldRow icon={Flame} label="Prioridad">
          <Popover open={showPriorityPop} onOpenChange={setShowPriorityPop}>
            <PopoverTrigger asChild>
              <button
                type="button"
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '5px 12px', borderRadius: '6px',
                  border: 'none', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 600,
                  color: selectedPriority.color,
                  background: selectedPriority.bgColor,
                  transition: 'opacity 150ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                {selectedPriority.label}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-0 w-40" style={dropdownStyle}>
              {PRIORITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setPriority(opt.value); setShowPriorityPop(false); }}
                  style={dropdownItemStyle(priority === opt.value)}
                >
                  <span style={{
                    display: 'inline-flex', padding: '2px 10px', borderRadius: '6px',
                    fontSize: '12px', fontWeight: 600,
                    color: opt.color, background: opt.bgColor,
                  }}>
                    {opt.label}
                  </span>
                  {priority === opt.value && <Check className="h-3 w-3 ml-auto" style={{ color: '#9CA3AF' }} />}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </FieldRow>

        {/* ── Subtareas ────────────────────────────────────────────── */}
        <FieldRow icon={ListChecks} label="Subtareas">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {subtasks.map(st => (
              <div key={st.id} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '5px 10px', borderRadius: '5px',
                background: 'transparent', border: '1px solid #E4E4E8',
              }}>
                <input
                  type="checkbox"
                  checked={st.completed}
                  onChange={() => setSubtasks(prev => prev.map(s => s.id === st.id ? { ...s, completed: !s.completed } : s))}
                  style={{ accentColor: '#111827', width: '13px', height: '13px', cursor: 'pointer', flexShrink: 0 }}
                />
                <span style={{
                  flex: 1, fontSize: '12px', color: st.completed ? '#9CA3AF' : '#6B7280',
                  textDecoration: st.completed ? 'line-through' : 'none',
                }}>
                  {st.title}
                </span>
                <button type="button" onClick={() => setSubtasks(prev => prev.filter(s => s.id !== st.id))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#D0D0D8', lineHeight: 1 }}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <input
              value={newSubtask}
              onChange={e => setNewSubtask(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const t = newSubtask.trim();
                  if (!t) return;
                  setSubtasks(prev => [...prev, { id: crypto.randomUUID(), title: t, completed: false }]);
                  setNewSubtask('');
                }
              }}
              placeholder="Agregar sub-tarea..."
              className="outline-none"
              style={{
                fontSize: '12px', color: '#111827', background: 'transparent',
                border: 'none', padding: '4px 2px', width: '100%',
              }}
            />
          </div>
        </FieldRow>

        {/* ── Archivos adjuntos ─────────────────────────────────────── */}
        <FieldRow icon={Paperclip} label="Archivos">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            {attachments.map((file, i) => {
              const ext = (file.name.split('.').pop() ?? 'file').toUpperCase().slice(0, 4);
              const color = getFileExtColor(file.name);
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '5px 8px 5px 6px', borderRadius: '8px',
                  border: '1px solid #E4E4E8', background: 'transparent',
                  maxWidth: '200px',
                }}>
                  <div style={{
                    height: '26px', width: '26px', borderRadius: '5px', flexShrink: 0,
                    background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: '8px', fontWeight: 800, color: '#FFF', letterSpacing: '-0.3px' }}>{ext}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#9CA3AF' }}>{formatFileSize(file.size)}</div>
                  </div>
                  <button type="button" onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9CA3AF', flexShrink: 0, lineHeight: 1 }}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
            <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }}
              onChange={e => { setAttachments(prev => [...prev, ...Array.from(e.target.files ?? [])]); e.target.value = ''; }} />
            <button type="button" onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 10px', borderRadius: '8px',
                border: '1px dashed #D8D8DE', background: 'transparent',
                cursor: 'pointer', color: '#9CA3AF', fontSize: '12px', fontWeight: 500,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#9CA3AF'; e.currentTarget.style.color = '#6B7280'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#D8D8DE'; e.currentTarget.style.color = '#9CA3AF'; }}
            >
              <Plus className="h-3 w-3" strokeWidth={2.5} />
              Adjuntar
            </button>
          </div>
        </FieldRow>

        {/* ── Add Section ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 24px', gap: '10px' }}>
          <div style={{ flex: 1, height: '1px', background: '#E4E4E8' }} />
          <button
            type="button"
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '4px 10px', borderRadius: '8px',
              border: 'none', background: 'transparent',
              cursor: 'pointer', color: '#9CA3AF',
              fontSize: '12px', fontWeight: 500,
              transition: 'color 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#6B7280'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#9CA3AF'; }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Agregar sección
          </button>
          <div style={{ flex: 1, height: '1px', background: '#E4E4E8' }} />
        </div>

        {/* ── Comentario ───────────────────────────────────────────── */}
        <div style={{ padding: '10px 24px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          {/* Avatar — fuera del recuadro gris */}
          {currentUser?.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              style={{ height: '32px', width: '32px', borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
            />
          ) : (
            <div style={{
              height: '32px', width: '32px', borderRadius: '50%', flexShrink: 0,
              background: '#F3F4F6', color: '#111827',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700,
            }}>
              {currentUser ? getInitials(currentUser.name) : '?'}
            </div>
          )}
          {/* Input gris */}
          <div style={{ flex: 1, background: '#F7F8FA', borderRadius: '6px', padding: '10px 14px', border: '1px solid #E4E4E8' }}>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Agregar un comentario..."
              rows={2}
              className="w-full outline-none resize-none"
              style={{ fontSize: '13px', color: '#111827', background: 'transparent', border: 'none', lineHeight: 1.5, width: '100%' }}
            />
          </div>
        </div>

        </div>{/* end scrollable body */}

        {/* ── Footer ───────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px 16px',
          borderTop: '1px solid #E4E4E8',
          flexShrink: 0,
          gap: '8px',
          flexWrap: 'wrap',
        }}>
          {/* Colaboradores = asignados seleccionados */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#9CA3AF', whiteSpace: 'nowrap' }}>Colaboradores</span>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {selectedUsers.length > 0 ? (
                <>
                  {selectedUsers.map((u, i) => {
                    const c = ASSIGNEE_CHIP_COLORS[u.id % ASSIGNEE_CHIP_COLORS.length];
                    return (
                      <div
                        key={u.id}
                        title={u.name}
                        style={{
                          height: '28px', width: '28px', borderRadius: '50%',
                          border: '2px solid #FFFFFF',
                          marginLeft: i > 0 ? '-8px' : '0',
                          background: c.bg, color: c.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '9px', fontWeight: 700, flexShrink: 0,
                        }}
                      >
                        {getInitials(u.name)}
                      </div>
                    );
                  })}
                </>
              ) : (
                <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Sin asignar</span>
              )}
            </div>
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              style={{
                height: '36px', padding: '0 16px', borderRadius: '6px',
                border: '1px solid #E4E4E8', background: 'transparent',
                fontSize: '13px', fontWeight: 600, color: '#6B7280',
                cursor: 'pointer', transition: 'background 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F4F4F6'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isValid || isSaving}
              style={{
                height: '36px', padding: '0 20px', borderRadius: '6px',
                border: 'none',
                background: isValid ? '#111827' : '#D0D0D0',
                fontSize: '13px', fontWeight: 600, color: '#FFFFFF',
                cursor: isValid ? 'pointer' : 'not-allowed',
                transition: 'background 150ms ease',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
              onMouseEnter={e => { if (isValid) e.currentTarget.style.background = '#000000'; }}
              onMouseLeave={e => { if (isValid) e.currentTarget.style.background = '#111827'; }}
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEditMode ? 'Guardar cambios' : 'Guardar'}
            </button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
