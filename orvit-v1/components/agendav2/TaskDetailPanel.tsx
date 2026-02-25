'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, isToday } from 'date-fns';
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

interface TaskDetailPanelProps {
  task: AgendaTask | null;
  open: boolean;
  onClose: () => void;
  onStatusChange?: (task: AgendaTask, status: AgendaTaskStatus) => Promise<void>;
}

export function TaskDetailPanel({ task, open, onClose }: TaskDetailPanelProps) {
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>(MOCK_SUBTASKS);

  if (!task) return null;

  const statusConfig = TASK_STATUS_CONFIG[task.status];
  const statusChip = STATUS_CHIP[task.status];
  const priorityChip = PRIORITY_CHIP[task.priority];
  const isOverdue = isTaskOverdue(task);
  const assigneeName = getAssigneeName(task);
  const assigneeInitials = assigneeName !== 'Sin asignar'
    ? assigneeName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : null;

  const completedCount = subtasks.filter(s => s.completed).length;
  const subtaskProgress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[500px] p-0 flex flex-col gap-0 overflow-hidden"
        style={{ background: '#FFFFFF', borderLeft: '1px solid #E4E4E4' }}
      >
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #E4E4E4' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
            <div
              style={{
                height: '36px', width: '36px', borderRadius: '10px',
                background: '#F6F6F6', display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0,
              }}
            >
              <FileText className="h-4 w-4" style={{ color: '#9C9CAA' }} />
            </div>
            <h2
              style={{
                flex: 1, fontSize: '15px', fontWeight: 700, color: '#050505',
                lineHeight: 1.3, WebkitLineClamp: 2, overflow: 'hidden',
                display: '-webkit-box', WebkitBoxOrient: 'vertical' as const,
                paddingTop: '2px',
              }}
            >
              {task.title}
            </h2>
            <button
              onClick={onClose}
              style={{
                height: '28px', width: '28px', borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#9C9CAA', background: 'transparent', border: 'none',
                cursor: 'pointer', flexShrink: 0, transition: 'all 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F6F6F6'; e.currentTarget.style.color = '#575456'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9C9CAA'; }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Status + priority chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginLeft: '48px' }}>
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                fontSize: '11px', fontWeight: 600, padding: '4px 10px',
                borderRadius: '999px', background: statusChip.bg, color: statusChip.text,
              }}
            >
              <span style={{ height: '6px', width: '6px', borderRadius: '50%', background: statusChip.dot }} />
              {statusConfig.label}
            </span>
            <span
              style={{
                fontSize: '11px', fontWeight: 600, padding: '4px 10px',
                borderRadius: '999px', background: priorityChip.bg, color: priorityChip.text,
              }}
            >
              {priorityChip.label}
            </span>
            {isOverdue && (
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  fontSize: '11px', fontWeight: 600, padding: '4px 10px',
                  borderRadius: '999px', background: '#F9E4E2', color: '#ED8A94',
                }}
              >
                <AlertCircle className="h-3 w-3" /> Vencida
              </span>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Meta fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Assignee */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100px', flexShrink: 0, color: '#9C9CAA' }}>
                  <User className="h-3.5 w-3.5" />
                  <span style={{ fontSize: '11px', fontWeight: 500 }}>Asignado</span>
                </div>
                {assigneeInitials ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Avatar className="h-6 w-6">
                      <AvatarFallback
                        className="text-[9px] font-bold"
                        style={{ background: '#D0E0F0', color: '#3070A8' }}
                      >
                        {assigneeInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#575456' }}>{assigneeName}</span>
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
                    <span style={{ fontSize: '11px', fontWeight: 500 }}>Vencimiento</span>
                  </div>
                  <span style={{
                    fontSize: '12px', fontWeight: 500,
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
                    <span style={{ fontSize: '11px', fontWeight: 500 }}>Categoría</span>
                  </div>
                  <span
                    style={{
                      fontSize: '11px', fontWeight: 600, padding: '2px 10px',
                      borderRadius: '999px', background: '#D0E0F0', color: '#3070A8',
                    }}
                  >
                    {task.category}
                  </span>
                </div>
              )}

              {/* Description */}
              {task.description && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100px', flexShrink: 0, color: '#9C9CAA', marginTop: '2px' }}>
                    <FileText className="h-3.5 w-3.5" />
                    <span style={{ fontSize: '11px', fontWeight: 500 }}>Descripción</span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#575456', lineHeight: 1.6, flex: 1 }}>
                    {task.description}
                  </p>
                </div>
              )}
            </div>

            {/* Attachments */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9C9CAA' }}>
                  <Paperclip className="h-3.5 w-3.5" />
                  <span style={{ fontSize: '11px', fontWeight: 600 }}>Adjuntos ({MOCK_ATTACHMENTS.length})</span>
                </div>
                <button
                  style={{ fontSize: '11px', color: '#3070A8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                >
                  Descargar todo
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {MOCK_ATTACHMENTS.map(att => (
                  <div
                    key={att.name}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px', background: '#F6F6F6',
                      border: '1px solid #E4E4E4', borderRadius: '12px',
                      cursor: 'pointer', transition: 'background 150ms ease',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#EFEFEF'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#F6F6F6'; }}
                  >
                    <div
                      style={{
                        height: '24px', width: '24px', borderRadius: '6px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '9px', fontWeight: 700,
                        background: att.type === 'pdf' ? '#F9E4E2' : '#D0E0F0',
                        color: att.type === 'pdf' ? '#ED8A94' : '#3070A8',
                      }}
                    >
                      {att.type.toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontSize: '11px', fontWeight: 600, color: '#050505', lineHeight: 1 }}>{att.name}</p>
                      <p style={{ fontSize: '9px', color: '#9C9CAA', marginTop: '2px' }}>{att.size}</p>
                    </div>
                  </div>
                ))}
                <button
                  style={{
                    height: '46px', width: '46px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', background: '#F6F6F6',
                    border: '1.5px dashed #E4E4E4', borderRadius: '12px',
                    cursor: 'pointer', color: '#9C9CAA', fontSize: '18px',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#3070A8'; e.currentTarget.style.background = '#D0E0F0'; e.currentTarget.style.color = '#3070A8'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E4E4E4'; e.currentTarget.style.background = '#F6F6F6'; e.currentTarget.style.color = '#9C9CAA'; }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="subtasks" className="w-full">
              <TabsList
                className="w-full justify-start rounded-none h-auto p-0 gap-0"
                style={{ background: 'transparent', borderBottom: '1px solid #E4E4E4' }}
              >
                {[
                  { value: 'subtasks', label: 'Subtareas' },
                  { value: 'comments', label: `Comentarios ${MOCK_COMMENTS.length}` },
                  { value: 'activities', label: 'Actividades' },
                ].map(tab => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#050505] data-[state=active]:bg-transparent data-[state=active]:shadow-none pb-2.5 pt-0 transition-all duration-150"
                    style={{ fontSize: '12px', fontWeight: 600, padding: '0 16px 10px', color: '#9C9CAA' }}
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="subtasks" className="mt-4">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div
                    style={{
                      flex: 1, height: '6px', background: '#E4E4E4',
                      borderRadius: '999px', overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%', borderRadius: '999px',
                        background: '#568177', width: `${subtaskProgress}%`,
                        transition: 'width 500ms ease',
                      }}
                    />
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
                />
              </TabsContent>

              <TabsContent value="comments" className="mt-4">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {MOCK_COMMENTS.map(comment => (
                    <div key={comment.id} style={{ display: 'flex', gap: '12px' }}>
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback
                          className="text-[9px] font-bold"
                          style={{ background: comment.bg, color: comment.color }}
                        >
                          {comment.author.split(' ').map(w => w[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#050505' }}>{comment.author}</span>
                          <span style={{ fontSize: '10px', color: '#9C9CAA' }}>{comment.time}</span>
                        </div>
                        <div style={{ background: '#F6F6F6', borderRadius: '12px', borderTopLeftRadius: '4px', padding: '8px 12px' }}>
                          <p style={{ fontSize: '12px', color: '#575456', lineHeight: 1.5 }}>{comment.content}</p>
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
                        fontSize: '12px', background: 'transparent',
                        color: '#050505', borderBottom: '1px solid #E4E4E4',
                        paddingBottom: '6px',
                      }}
                      onFocus={e => { e.currentTarget.style.borderBottomColor = '#3070A8'; }}
                      onBlur={e => { e.currentTarget.style.borderBottomColor = '#E4E4E4'; }}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="activities" className="mt-4">
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
                        <p style={{ fontSize: '12px', color: '#575456' }}>
                          <span style={{ fontWeight: 600, color: '#050505' }}>{activity.user}</span>{' '}
                          {activity.text}
                        </p>
                        <p style={{ fontSize: '10px', color: '#9C9CAA', marginTop: '2px' }}>{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderTop: '1px solid #E4E4E4' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, height: '36px', borderRadius: '10px',
              border: '1px solid #E4E4E4', fontSize: '12px', fontWeight: 600,
              color: '#575456', background: '#FFFFFF', cursor: 'pointer',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F6F6F6'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
          >
            Cerrar
          </button>
          <button
            style={{
              flex: 1, height: '36px', borderRadius: '10px',
              border: 'none', fontSize: '12px', fontWeight: 600,
              color: '#FFFFFF', background: '#050505', cursor: 'pointer',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#000000'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#050505'; }}
          >
            Guardar cambios
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
