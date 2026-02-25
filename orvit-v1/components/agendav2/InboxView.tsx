'use client';

import { useState, useMemo } from 'react';
import { Search, Filter, MoreHorizontal, User, Paperclip, Calendar, AlertCircle, FileText, MessageSquare, Activity, Bookmark } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, formatDistanceToNow, isToday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { SubtaskList, type SubtaskItem } from './SubtaskList';
import type { AgendaTask, Priority, AgendaTaskStatus } from '@/lib/agenda/types';
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

// Avatar color pairs per spec
const AVATAR_PAIRS = [
  { bg: '#D0E0F0', color: '#3070A8' },
  { bg: '#D0EFE0', color: '#568177' },
  { bg: '#F9F0DB', color: '#907840' },
  { bg: '#F9E4E2', color: '#ED8A94' },
  { bg: '#F6F6F6', color: '#575456' },
];

const MOCK_SUBTASKS: SubtaskItem[] = [
  { id: '1', title: 'Reunión inicial y mapa de conceptos', note: 'Confirmar asistentes', completed: true },
  { id: '2', title: 'Recopilar referencias y moodboard', completed: false },
  { id: '3', title: 'Revisar brief del cliente', note: 'Ajuste menor al logo', completed: false },
  { id: '4', title: 'Preparar feedback y presentación', completed: false },
];

const MOCK_COMMENTS = [
  { id: 1, author: 'Juan P.', content: 'Revisé el documento, falta la sección de costos.', time: 'Hace 2h', bg: '#D0E0F0', color: '#3070A8' },
  { id: 2, author: 'María G.', content: 'Actualizado, pueden revisar ahora.', time: 'Hace 45m', bg: '#D0EFE0', color: '#568177' },
  { id: 3, author: 'Carlos R.', content: 'Perfecto, aprobado para producción.', time: 'Hace 20m', bg: '#F9F0DB', color: '#907840' },
];

const MOCK_ACTIVITY = [
  { id: 1, text: 'creó esta tarea', user: 'Juan P.', time: 'Hace 3 días' },
  { id: 2, text: 'cambió el estado a En progreso', user: 'María G.', time: 'Hace 2 días' },
  { id: 3, text: 'asignó la tarea', user: 'Juan P.', time: 'Hace 1 día' },
  { id: 4, text: 'agregó un comentario', user: 'Carlos R.', time: 'Hace 20m' },
];

const MOCK_ATTACHMENTS = [
  { name: 'Brief diseño.pdf', size: '1.5 MB', type: 'pdf' },
  { name: 'Dashboard.fig', size: '2.5 MB', type: 'fig' },
];

interface InboxViewProps {
  tasks: AgendaTask[];
  onTaskClick?: (task: AgendaTask) => void;
}

function timeAgo(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: es });
  } catch {
    return '';
  }
}

export function InboxView({ tasks, onTaskClick }: InboxViewProps) {
  const [search, setSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState<AgendaTask | null>(tasks[0] || null);
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>(MOCK_SUBTASKS);

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks;
    const lower = search.toLowerCase();
    return tasks.filter(t =>
      t.title.toLowerCase().includes(lower) ||
      (t.description || '').toLowerCase().includes(lower)
    );
  }, [tasks, search]);

  function handleSelectTask(task: AgendaTask) {
    setSelectedTask(task);
    setSubtasks(MOCK_SUBTASKS);
  }

  const selected = selectedTask;
  const selectedOverdue = selected ? isTaskOverdue(selected) : false;
  const selectedPriority = selected ? PRIORITY_CHIP[selected.priority] : null;
  const selectedStatus = selected ? STATUS_CHIP[selected.status] : null;
  const selectedStatusConfig = selected ? TASK_STATUS_CONFIG[selected.status] : null;
  const completedCount = subtasks.filter(s => s.completed).length;
  const subtaskProgress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 10rem)',
        overflow: 'hidden',
        borderRadius: '16px',
        border: '1px solid #E4E4E4',
        background: '#FFFFFF',
      }}
    >
      {/* Left panel — inbox list */}
      <div
        style={{
          width: '300px',
          flexShrink: 0,
          borderRight: '1px solid #E4E4E4',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid #E4E4E4',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#050505' }}>Todas las tareas</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {[Filter, MoreHorizontal].map((Icon, i) => (
              <button
                key={i}
                style={{
                  height: '24px', width: '24px', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#9C9CAA', background: 'transparent', border: 'none', cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F6F6F6'; e.currentTarget.style.color = '#575456'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9C9CAA'; }}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #F0F0F0' }}>
          <div style={{ position: 'relative' }}>
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
              style={{ color: '#9C9CAA' }}
            />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar tareas..."
              className="w-full outline-none"
              style={{
                paddingLeft: '28px', paddingRight: '10px',
                height: '32px', fontSize: '12px',
                background: '#F6F6F6', border: 'none',
                borderRadius: '10px', color: '#050505',
              }}
            />
          </div>
        </div>

        {/* Task list */}
        <ScrollArea className="flex-1">
          <div style={{ padding: '4px 0' }}>
            {filteredTasks.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 16px', textAlign: 'center' }}>
                <p style={{ fontSize: '12px', color: '#9C9CAA' }}>No hay tareas</p>
              </div>
            ) : (
              filteredTasks.map((task, idx) => {
                const isSelected = selected?.id === task.id;
                const overdue = isTaskOverdue(task);
                const creatorName = task.createdBy?.name || 'Alguien';
                const initials = creatorName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                const avatarPair = AVATAR_PAIRS[idx % AVATAR_PAIRS.length];
                const hasUnread = task.status === 'PENDING' && idx < 2;

                return (
                  <button
                    key={task.id}
                    onClick={() => handleSelectTask(task)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: isSelected ? '12px 12px 12px 10px' : '12px',
                      borderBottom: '1px solid #F6F6F6',
                      borderLeft: isSelected ? '2px solid #050505' : '2px solid transparent',
                      background: isSelected ? '#F6F6F6' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 100ms ease',
                      display: 'block',
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#FAFAFA'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <Avatar className="h-8 w-8">
                          <AvatarFallback
                            className="text-[10px] font-bold"
                            style={{ background: avatarPair.bg, color: avatarPair.color }}
                          >
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        {hasUnread && (
                          <span
                            style={{
                              position: 'absolute', top: '-2px', right: '-2px',
                              height: '10px', width: '10px', borderRadius: '50%',
                              background: '#ED8A94', border: '2px solid #FFFFFF',
                            }}
                          />
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '12px', color: '#575456', lineHeight: 1.4 }}>
                          <span style={{ fontWeight: 700, color: '#050505' }}>{creatorName}</span>{' '}
                          <span>te asignó </span>
                          <span style={{ fontWeight: 600, color: '#050505' }}>{task.title}</span>
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                          <span style={{ fontSize: '10px', color: '#9C9CAA' }}>
                            {timeAgo(task.createdAt)}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {overdue && <AlertCircle className="h-3 w-3" style={{ color: '#ED8A94' }} />}
                            <Bookmark className="h-3 w-3" style={{ color: isSelected ? '#050505' : '#D0D0D0' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right panel — detail */}
      {selected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <ScrollArea className="flex-1">
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Priority + Status */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#9C9CAA', fontWeight: 500, width: '96px', flexShrink: 0 }}>Prioridad</span>
                  {selectedPriority && (
                    <span
                      style={{
                        fontSize: '12px', fontWeight: 600, padding: '4px 12px',
                        borderRadius: '999px', background: selectedPriority.bg, color: selectedPriority.text,
                      }}
                    >
                      {selectedPriority.label}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: '#9C9CAA', fontWeight: 500, width: '96px', flexShrink: 0 }}>Estado</span>
                  {selectedStatus && selectedStatusConfig && (
                    <span
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        fontSize: '12px', fontWeight: 600, padding: '4px 12px',
                        borderRadius: '999px', background: selectedStatus.bg, color: selectedStatus.text,
                      }}
                    >
                      <span style={{ height: '6px', width: '6px', borderRadius: '50%', background: selectedStatus.dot }} />
                      {selectedStatusConfig.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <span style={{ fontSize: '11px', color: '#9C9CAA', fontWeight: 500, width: '96px', flexShrink: 0, marginTop: '2px' }}>
                  Descripción
                </span>
                <p style={{ fontSize: '13px', color: '#575456', flex: 1, lineHeight: 1.6 }}>
                  {selected.description || selected.title}
                </p>
              </div>

              {/* Attachments */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9C9CAA' }}>
                    <Paperclip className="h-3.5 w-3.5" />
                    <span style={{ fontSize: '11px', fontWeight: 600 }}>Adjuntos ({MOCK_ATTACHMENTS.length})</span>
                  </div>
                  <button style={{ fontSize: '11px', color: '#3070A8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
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
                    <div style={{ flex: 1, height: '6px', background: '#E4E4E4', borderRadius: '999px', overflow: 'hidden' }}>
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
                            position: 'relative', zIndex: 1,
                            height: '24px', width: '24px', borderRadius: '50%',
                            background: '#FFFFFF', border: '2px solid #E4E4E4',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
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
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                height: '56px', width: '56px', borderRadius: '16px',
                background: '#F6F6F6', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 16px',
              }}
            >
              <FileText className="h-6 w-6" style={{ color: '#D0D0D0' }} />
            </div>
            <p style={{ fontSize: '13px', color: '#9C9CAA' }}>Seleccioná una tarea para ver el detalle</p>
          </div>
        </div>
      )}
    </div>
  );
}
