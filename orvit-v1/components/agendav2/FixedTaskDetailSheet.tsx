'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, Calendar, Users, Play, Edit2, Trash2, RotateCcw, CheckCircle2, ExternalLink, ChevronDown, FileText } from 'lucide-react';
import { FileTypeIcon } from '@/components/ui/file-type-icon';
import { format, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ── Design tokens ─────────────────────────────────────────────────────────

const FREQ_CONF: Record<string, { label: string; short: string; bg: string; border: string; color: string; icon: string }> = {
  diaria:     { label: 'Diaria',      short: 'D',  bg: '#EDF4F0', border: '#C2D4C8', color: '#305848', icon: '#508070' },
  semanal:    { label: 'Semanal',     short: 'S',  bg: '#EEF3F8', border: '#CCDAE8', color: '#3A5878', icon: '#5880A8' },
  quincenal:  { label: 'Quincenal',   short: 'Q',  bg: '#F5F2EA', border: '#DED5B0', color: '#685C30', icon: '#8A7840' },
  mensual:    { label: 'Mensual',     short: 'M',  bg: '#F3EFF8', border: '#D8CBE8', color: '#584878', icon: '#806898' },
  trimestral: { label: 'Trimestral',  short: 'T',  bg: '#FAF0EB', border: '#E8D0C0', color: '#784838', icon: '#A86848' },
  semestral:  { label: 'Semestral',   short: 'Se', bg: '#EBF4F4', border: '#B8D8D8', color: '#305858', icon: '#508080' },
  anual:      { label: 'Anual',       short: 'A',  bg: '#F0EEF8', border: '#C8C4D8', color: '#484858', icon: '#686878' },
};

const PRIORITY_CONF: Record<string, { label: string; bg: string; text: string }> = {
  baja:  { label: 'Baja',  bg: '#F3F4F6', text: '#6B7280' },
  media: { label: 'Media', bg: '#EFF6FF', text: '#1D4ED8' },
  alta:  { label: 'Alta',  bg: '#FEF3C7', text: '#D97706' },
};

const TABS = ['Instructivos', 'Historial'] as const;
type Tab = typeof TABS[number];

// ── Types ─────────────────────────────────────────────────────────────────

interface FixedTask {
  id: string;
  title: string;
  description: string;
  frequency: string;
  assignedTo: { id: string; name: string };
  department: string;
  instructives: { id: string; title: string; content: string; attachments?: string[] }[];
  estimatedTime: number;
  priority: 'baja' | 'media' | 'alta';
  isActive: boolean;
  executionTime?: string;
  lastExecuted?: string;
  nextExecution: string;
  createdAt: string;
  completedAt?: string;
  isCompleted?: boolean;
}

interface Attachment {
  name: string;
  url: string;
  size?: string;
}

interface Execution {
  id: string;
  executedBy: string;
  executedAt: string;
  duration?: number;
  notes?: string;
  status?: string;
  attachments?: Attachment[];
}


interface FixedTaskDetailSheetProps {
  task: FixedTask | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (task: FixedTask) => void;
  onExecute: (task: FixedTask) => void;
  onDelete: (id: string) => Promise<void>;
  onTaskUpdated: () => void;
  currentUserId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function formatTime(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

// ── Main component ────────────────────────────────────────────────────────

export function FixedTaskDetailSheet({ task, isOpen, onClose, onEdit, onExecute, onDelete, onTaskUpdated, currentUserId }: FixedTaskDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Instructivos');
  const [tabKey, setTabKey] = useState(0);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [execLoading, setExecLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [histFilter, setHistFilter] = useState<'todos' | 'este-mes' | 'mes-anterior' | 'ultimos-3m'>('todos');
  const [histFilterOpen, setHistFilterOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isOpen) { setActiveTab('Instructivos'); setTabKey(k => k + 1); }
  }, [isOpen, task?.id]);

  useEffect(() => {
    if (activeTab !== 'Historial' || !task?.id) return;
    async function load() {
      setExecLoading(true);
      try {
        const res = await fetch(`/api/fixed-tasks/${task!.id}/executions`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setExecutions(data.executions || []);
        } else {
          setExecutions([]);
        }
      } catch {
        setExecutions([]);
      } finally {
        setExecLoading(false);
      }
    }
    load();
  }, [activeTab, task?.id]);

  async function handleDelete() {
    if (!task) return;
    setDeleting(true);
    try {
      await onDelete(task.id);
      onClose();
    } catch {
      toast.error('Error al eliminar la tarea');
    } finally {
      setDeleting(false);
    }
  }

  function switchTab(tab: Tab) { setActiveTab(tab); setTabKey(k => k + 1); }

  const filteredExecutions = useMemo(() => {
    if (histFilter === 'todos') return executions;
    const now = new Date();
    if (histFilter === 'este-mes') {
      return executions.filter(e => {
        const d = new Date(e.executedAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    }
    if (histFilter === 'mes-anterior') {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return executions.filter(e => {
        const d = new Date(e.executedAt);
        return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear();
      });
    }
    if (histFilter === 'ultimos-3m') {
      const cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      return executions.filter(e => new Date(e.executedAt) >= cutoff);
    }
    return executions;
  }, [executions, histFilter]);

  if (!isOpen || !task || !mounted) return null;

  const freq = FREQ_CONF[task.frequency];
  const prio = PRIORITY_CONF[task.priority];
  const isOverdue = !task.isCompleted && isPast(new Date(task.nextExecution));
  const canExecute = !task.isCompleted && task.isActive && String(task.assignedTo.id) === String(currentUserId);

  return createPortal(
    <>
      <style>{`
        @keyframes ftd-overlay  { from { opacity:0 } to { opacity:1 } }
        @keyframes ftd-unfold {
          from { transform:translate(-50%,-50%) scale(0.96); opacity:0 }
          to   { transform:translate(-50%,-50%) scale(1);    opacity:1 }
        }
        @keyframes ftd-reveal {
          from { opacity:0; transform:translateY(6px) }
          to   { opacity:1; transform:translateY(0) }
        }
        @keyframes ftd-tab {
          from { opacity:0; transform:translateY(4px) }
          to   { opacity:1; transform:translateY(0) }
        }
      `}</style>

      {/* Overlay */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(5,5,5,0.45)', animation: 'ftd-overlay 180ms ease both' }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', zIndex: 61,
        width: '1020px', maxWidth: '95vw', height: '950px', maxHeight: '98vh',
        background: '#FFFFFF',
        border: '1.5px solid #D8D8DE',
        borderRadius: '8px',
        boxShadow: '0 4px 32px rgba(0,0,0,.12), 0 1px 4px rgba(0,0,0,.06)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transformOrigin: 'center center',
        animation: 'ftd-unfold 500ms cubic-bezier(0.22,1,0.36,1) both',
      }}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

          {/* ── Header ── */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E4E4E8', flexShrink: 0, animation: 'ftd-reveal 420ms cubic-bezier(0.22,1,0.36,1) 160ms both' }}>

            {/* Row 1: chips + action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              {task.isCompleted && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: '#EDF4F0', color: '#508070' }}>
                  <CheckCircle2 style={{ width: '12px', height: '12px' }} /> Completada
                </span>
              )}
              {!task.isActive && (
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: '#F3F4F6', color: '#6B7280' }}>
                  Inactiva
                </span>
              )}
              {isOverdue && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: '#FEE2E2', color: '#DC2626' }}>
                  Vencida
                </span>
              )}
              {!task.isCompleted && !isOverdue && task.isActive && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: '#F3F4F6', color: '#6B7280' }}>
                  <span style={{ height: '5px', width: '5px', borderRadius: '50%', background: '#9CA3AF', flexShrink: 0 }} />
                  Pendiente
                </span>
              )}
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: '#F4F4F6', color: '#6B7280' }}>
                {task.department}
              </span>
              <div style={{ flex: 1 }} />
              {canExecute && (
                <button
                  onClick={() => onExecute(task)}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 10px', borderRadius: '7px', border: 'none', background: '#111827', color: '#FFF', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'opacity 120ms ease' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.8'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                >
                  <Play style={{ width: '12px', height: '12px' }} /> Ejecutar
                </button>
              )}
              <button
                onClick={() => onEdit(task)}
                style={{ height: '28px', width: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', transition: '150ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F6'; (e.currentTarget as HTMLButtonElement).style.color = '#374151'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'; }}
              >
                <Edit2 style={{ width: '14px', height: '14px' }} />
              </button>
              <button
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={deleting}
                style={{ height: '28px', width: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#9CA3AF', cursor: deleting ? 'not-allowed' : 'pointer', transition: '150ms' }}
                onMouseEnter={e => { if (!deleting) { (e.currentTarget as HTMLButtonElement).style.background = '#FEE2E2'; (e.currentTarget as HTMLButtonElement).style.color = '#DC2626'; }}}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'; }}
              >
                <Trash2 style={{ width: '14px', height: '14px' }} />
              </button>
              <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar esta tarea fija?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. La tarea fija y todos sus datos serán eliminados permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive hover:bg-destructive/90"
                      onClick={handleDelete}
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <button
                onClick={onClose}
                style={{ height: '28px', width: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', transition: '150ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F4F4F6'; (e.currentTarget as HTMLButtonElement).style.color = '#374151'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'; }}
              >
                <X style={{ width: '14px', height: '14px' }} />
              </button>
            </div>

            {/* Title */}
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', lineHeight: 1.3, letterSpacing: '-0.02em', marginBottom: '14px' }}>
              {task.title}
            </h2>

            {/* Meta row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {/* Assignee */}
              <div style={{ display: 'flex', alignItems: 'center', cursor: 'default' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#F0F0F0', border: '2px solid #FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '8px', fontWeight: 700, color: '#374151' }}>{getInitials(task.assignedTo.name)}</span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280', marginLeft: '8px' }}>{task.assignedTo.name}</span>
              </div>
              <div style={{ width: '1px', height: '18px', background: '#E4E4E8' }} />
              {/* Priority */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280' }}>Prioridad</span>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: prio.bg, color: prio.text }}>
                  {prio.label}
                </span>
              </div>
              {freq && (
                <>
                  <div style={{ width: '1px', height: '18px', background: '#E4E4E8' }} />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: freq.bg, border: `1px solid ${freq.border}`, color: freq.color }}>
                    <span style={{ width: '13px', height: '13px', borderRadius: '3px', background: freq.icon, color: '#FFF', fontSize: '7px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {freq.short}
                    </span>
                    {freq.label}
                  </span>
                </>
              )}
              <div style={{ width: '1px', height: '18px', background: '#E4E4E8' }} />
              {/* Next execution */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar style={{ width: '14px', height: '14px', color: '#9CA3AF' }} />
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280' }}>Próxima ejecución</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: isOverdue ? '#DC2626' : '#111827' }}>
                  {format(new Date(task.nextExecution), "d 'de' MMMM", { locale: es })}
                </span>
              </div>
            </div>
          </div>

          {/* ── Content area ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'ftd-reveal 420ms cubic-bezier(0.22,1,0.36,1) 260ms both' }}>

            {/* Description + meta (always visible, like normal task) */}
            <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '12px', flexShrink: 0, borderBottom: '1px solid #F0F0F4' }}>
              <p style={{ fontSize: '15px', color: '#374151', lineHeight: 1.7, margin: 0, letterSpacing: '-0.01em', whiteSpace: 'pre-wrap' }}>
                {task.description || <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Sin descripción</span>}
              </p>

              {/* Meta strip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
                  <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 500 }}>Tiempo estimado</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{formatTime(task.estimatedTime)}</span>
                </div>
                <div style={{ width: '1px', height: '14px', background: '#E4E4E8' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
                  <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 500 }}>Departamento</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{task.department}</span>
                </div>
                {task.executionTime && (
                  <>
                    <div style={{ width: '1px', height: '14px', background: '#E4E4E8' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
                      <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 500 }}>Tiempo real</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{task.executionTime}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Completion info */}
              {task.isCompleted && task.completedAt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#EDF4F0', borderRadius: '8px', border: '1px solid #C2D4C8' }}>
                  <CheckCircle2 style={{ width: '14px', height: '14px', flexShrink: 0, color: '#508070' }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#305848' }}>Completada el </span>
                  <span style={{ fontSize: '12px', color: '#508070' }}>
                    {format(new Date(task.completedAt), "d 'de' MMMM 'a las' HH:mm", { locale: es })}
                  </span>
                </div>
              )}
            </div>

            {/* ── Tabs section ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '14px 20px 0' }}>

              {/* Tabs control — segmented, full width */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', background: '#F4F4F6', borderRadius: '8px', padding: '3px', flexShrink: 0 }}>
                {TABS.map(tab => {
                  const active = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => switchTab(tab)}
                      style={{
                        flex: 1, border: 'none', cursor: 'pointer', padding: '7px 14px', borderRadius: '6px',
                        fontSize: '12px', fontWeight: 600, letterSpacing: '-0.01em', textAlign: 'center',
                        background: active ? '#FFFFFF' : 'transparent',
                        color: active ? '#111827' : '#9CA3AF',
                        boxShadow: active ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                        transition: '150ms',
                      }}
                    >
                      {tab}{tab === 'Instructivos' ? ` (${task.instructives.length})` : ''}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '16px' }}>
                <div key={tabKey} style={{ animation: 'ftd-tab 220ms cubic-bezier(0.22,1,0.36,1) both' }}>

                  {/* ── Instructivos ── */}
                  {activeTab === 'Instructivos' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {task.instructives.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                          <FileText style={{ width: '32px', height: '32px', margin: '0 auto 12px', color: '#C8C8D0' }} />
                          <p style={{ fontSize: '14px', fontWeight: 600, color: '#9CA3AF' }}>Sin instructivos</p>
                          <p style={{ fontSize: '12px', color: '#C8C8D0', marginTop: '4px' }}>Editá la tarea para agregar instructivos</p>
                        </div>
                      )}
                      {task.instructives.map((inst, i) => {
                        const attachments: Attachment[] = (inst.attachments || []).map((a: any) =>
                          typeof a === 'string' ? { name: a.split('/').pop() || 'Archivo', url: a } : a
                        );
                        return (
                          <div key={inst.id || i} style={{ borderRadius: '10px', border: '1px solid #E4E4E8', overflow: 'hidden' }}>
                            {/* Instructive header */}
                            <div style={{ padding: '10px 16px', background: '#F8F8F8', borderBottom: '1px solid #E4E4E8', display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ width: '22px', height: '22px', borderRadius: '6px', background: '#111827', color: '#FFF', fontSize: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {i + 1}
                              </span>
                              <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', flex: 1 }}>{inst.title}</p>
                              {attachments.length > 0 && (
                                <span style={{ fontSize: '11px', fontWeight: 500, color: '#9CA3AF' }}>
                                  {attachments.length} archivo{attachments.length > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                            {/* Content */}
                            <div style={{ padding: '14px 16px' }}>
                              <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.75, whiteSpace: 'pre-wrap', margin: 0 }}>{inst.content}</p>
                              {/* Attachments */}
                              {attachments.length > 0 && (
                                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Documentos adjuntos</p>
                                  {attachments.map((att, j) => {
                                    return (
                                      <a
                                        key={j}
                                        href={att.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #E4E4E8', background: '#FAFAFA', textDecoration: 'none', transition: 'background 120ms' }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#F0F0F0'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#FAFAFA'; }}
                                      >
                                        <FileTypeIcon name={att.name} size={32} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</p>
                                          {att.size && <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>{att.size}</p>}
                                        </div>
                                        <ExternalLink style={{ width: '13px', height: '13px', color: '#9CA3AF', flexShrink: 0 }} />
                                      </a>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Historial ── */}
                  {activeTab === 'Historial' && (
                    <div>
                      {/* Date filter — compact dropdown */}
                      {!execLoading && executions.length > 0 && (() => {
                        const FILTER_OPTS = [
                          { key: 'todos',        label: 'Todos los períodos' },
                          { key: 'este-mes',     label: 'Este mes' },
                          { key: 'mes-anterior', label: 'Mes anterior' },
                          { key: 'ultimos-3m',   label: 'Últimos 3 meses' },
                        ] as const;
                        const currentLabel = FILTER_OPTS.find(o => o.key === histFilter)?.label ?? 'Todos los períodos';
                        const hasFilter = histFilter !== 'todos';
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <div style={{ position: 'relative' }}>
                              <button
                                onClick={() => setHistFilterOpen(p => !p)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '6px',
                                  height: '30px', padding: '0 10px',
                                  borderRadius: '8px',
                                  border: `1px solid ${hasFilter ? '#111827' : '#E4E4E8'}`,
                                  background: hasFilter ? '#111827' : '#FAFAFA',
                                  color: hasFilter ? '#FFF' : '#374151',
                                  fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: '120ms',
                                }}
                              >
                                {currentLabel}
                                <ChevronDown style={{ width: '13px', height: '13px', flexShrink: 0, opacity: 0.7, transform: histFilterOpen ? 'rotate(180deg)' : 'none', transition: '150ms' }} />
                              </button>
                              {histFilterOpen && (
                                <>
                                  {/* Click-outside overlay */}
                                  <div onClick={() => setHistFilterOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 5 }} />
                                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 10, background: '#FFF', border: '1px solid #E4E4E8', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,.10)', overflow: 'hidden', minWidth: '180px' }}>
                                    {FILTER_OPTS.map(opt => {
                                      const active = histFilter === opt.key;
                                      return (
                                        <button
                                          key={opt.key}
                                          onClick={() => { setHistFilter(opt.key); setHistFilterOpen(false); }}
                                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: active ? '#F8F8F8' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: active ? 600 : 500, color: active ? '#111827' : '#6B7280', textAlign: 'left', transition: '80ms' }}
                                          onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = '#F8F8F8'; }}
                                          onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                                        >
                                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: active ? '#111827' : 'transparent', border: active ? 'none' : '1.5px solid #D1D5DB', flexShrink: 0 }} />
                                          {opt.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </>
                              )}
                            </div>
                            {hasFilter && (
                              <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                                {filteredExecutions.length} resultado{filteredExecutions.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      {execLoading && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {[1, 2, 3].map(i => (
                            <div key={i} className="animate-pulse" style={{ height: '88px', borderRadius: '10px', background: '#F0F0F0' }} />
                          ))}
                        </div>
                      )}
                      {!execLoading && filteredExecutions.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                          <RotateCcw style={{ width: '32px', height: '32px', margin: '0 auto 12px', color: '#C8C8D0' }} />
                          <p style={{ fontSize: '14px', fontWeight: 600, color: '#9CA3AF' }}>
                            {histFilter === 'todos' ? 'Sin historial' : 'Sin ejecuciones en este período'}
                          </p>
                          <p style={{ fontSize: '12px', color: '#C0C0C8', marginTop: '4px' }}>
                            {histFilter === 'todos' ? 'Esta tarea aún no ha sido ejecutada' : 'Probá seleccionando otro período'}
                          </p>
                        </div>
                      )}
                      {!execLoading && filteredExecutions.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {filteredExecutions.map((exec, i) => {
                            const execAtts: Attachment[] = (exec.attachments || []).map((a: any) =>
                              typeof a === 'string' ? { name: a.split('/').pop() || 'Archivo', url: a } : a
                            );
                            return (
                              <div key={exec.id || i} style={{ borderRadius: '10px', border: '1px solid #E4E4E8', overflow: 'hidden' }}>
                                {/* Execution header */}
                                <div style={{ padding: '10px 16px', background: '#F8F8F8', borderBottom: '1px solid #E4E4E8', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  {/* Avatar */}
                                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#E8E8E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#374151' }}>{getInitials(exec.executedBy || 'U')}</span>
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>{exec.executedBy || 'Usuario desconocido'}</p>
                                    <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>
                                      {format(new Date(exec.executedAt), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                                    </p>
                                  </div>
                                  {/* Meta chips */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                    {exec.duration ? (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', background: '#F3F4F6', color: '#6B7280' }}>
                                        <Clock style={{ width: '10px', height: '10px' }} /> {formatTime(exec.duration)}
                                      </span>
                                    ) : null}
                                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', background: '#DCFCE7', color: '#16A34A' }}>
                                      Completada
                                    </span>
                                  </div>
                                </div>
                                {/* Body: notes + attachments */}
                                {(exec.notes || execAtts.length > 0) && (
                                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {exec.notes && (
                                      <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.65, margin: 0 }}>{exec.notes}</p>
                                    )}
                                    {execAtts.length > 0 && (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                        <p style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                                          Archivos adjuntos ({execAtts.length})
                                        </p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                          {execAtts.map((att, j) => (
                                            <a
                                              key={j}
                                              href={att.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '6px 10px', borderRadius: '7px', border: '1px solid #E4E4E8', background: '#FAFAFA', textDecoration: 'none', transition: 'background 120ms' }}
                                              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#F0F0F0'; }}
                                              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#FAFAFA'; }}
                                            >
                                              <FileTypeIcon name={att.name} size={26} />
                                              <div style={{ minWidth: 0 }}>
                                                <p style={{ fontSize: '11px', fontWeight: 600, color: '#111827', margin: 0, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</p>
                                                {att.size && <p style={{ fontSize: '10px', color: '#9CA3AF', margin: 0 }}>{att.size}</p>}
                                              </div>
                                              <ExternalLink style={{ width: '11px', height: '11px', color: '#9CA3AF', flexShrink: 0 }} />
                                            </a>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>,
    document.body
  );
}
