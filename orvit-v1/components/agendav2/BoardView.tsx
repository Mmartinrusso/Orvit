'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { LayoutGrid, AlignJustify, BarChart2, SlidersHorizontal, AlertCircle, X, Check, CheckSquare, Square, Trash2 } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAssigneeName } from '@/lib/agenda/types';
import type { Priority } from '@/lib/agenda/types';
import { BoardColumn } from './BoardColumn';
import { TaskCalendarStrip } from './TaskCalendarStrip';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

import { format, parseISO, addDays, isToday, differenceInCalendarDays } from 'date-fns';
import type { AgendaTask, AgendaTaskStatus } from '@/lib/agenda/types';
import { toast } from 'sonner';

const BOARD_COLUMNS: AgendaTaskStatus[] = ['PENDING', 'IN_PROGRESS', 'WAITING', 'COMPLETED'];

interface BoardViewProps {
  tasks: AgendaTask[];
  onTaskClick: (task: AgendaTask) => void;
  onTaskStatusChange: (taskId: number, status: AgendaTaskStatus) => Promise<void>;
  onTaskDelete: (task: AgendaTask) => void;
  onEditTask?: (task: AgendaTask) => void;
  onBulkDelete?: (ids: number[]) => void;
  onCreateTask: (status: AgendaTaskStatus, date?: string) => void;
  isLoading: boolean;
}

export function BoardView({
  tasks,
  onTaskClick,
  onTaskStatusChange,
  onTaskDelete,
  onEditTask,
  onBulkDelete,
  onCreateTask,
  isLoading,
}: BoardViewProps) {
  const [activeDragTask, setActiveDragTask] = useState<AgendaTask | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [subView, setSubView] = useState<'kanban' | 'spreadsheet' | 'timeline'>('kanban');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showFilter, setShowFilter] = useState(false);
  const [filterPriorities, setFilterPriorities] = useState<Priority[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterAssignees, setFilterAssignees] = useState<string[]>([]);
  const [filterProgress, setFilterProgress] = useState<('none' | 'in_progress' | 'done')[]>([]);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showFilter) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Element;
      // Ignore clicks inside Radix UI portals (Select dropdown, DatePicker calendar, etc.)
      if (target.closest('[data-radix-popper-content-wrapper]') || target.closest('[data-radix-portal]')) return;
      if (filterRef.current && !filterRef.current.contains(target)) {
        setShowFilter(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilter]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Unique assignees derived from task list
  const assigneeOptions = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    tasks.forEach(t => {
      const name = getAssigneeName(t);
      if (name && name !== 'Sin asignar' && !seen.has(name)) {
        seen.add(name);
        result.push(name);
      }
    });
    return result;
  }, [tasks]);

  // Filter tasks: calendar date hover + active filters
  const visibleTasks = useMemo(() => {
    let result = tasks;
    if (hoveredDate) {
      result = result.filter(t => t.dueDate && format(parseISO(t.dueDate), 'yyyy-MM-dd') === hoveredDate);
    }
    if (filterPriorities.length > 0) {
      result = result.filter(t => filterPriorities.includes(t.priority));
    }
    if (filterDateFrom) {
      result = result.filter(t => t.dueDate && t.dueDate >= filterDateFrom);
    }
    if (filterDateTo) {
      result = result.filter(t => t.dueDate && t.dueDate <= filterDateTo);
    }
    if (filterAssignees.length > 0) {
      result = result.filter(t => filterAssignees.includes(getAssigneeName(t)));
    }
    if (filterProgress.length > 0) {
      result = result.filter(t => {
        if (filterProgress.includes('none') && t.status === 'PENDING') return true;
        if (filterProgress.includes('in_progress') && (t.status === 'IN_PROGRESS' || t.status === 'WAITING')) return true;
        if (filterProgress.includes('done') && t.status === 'COMPLETED') return true;
        return false;
      });
    }
    return result;
  }, [tasks, hoveredDate, filterPriorities, filterDateFrom, filterDateTo, filterAssignees, filterProgress]);

  const activeFilterCount = filterPriorities.length + filterAssignees.length + filterProgress.length + (filterDateFrom ? 1 : 0) + (filterDateTo ? 1 : 0);

  function togglePriority(p: Priority) {
    setFilterPriorities(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }
  function toggleAssignee(name: string) {
    setFilterAssignees(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);
  }
  function toggleProgress(v: 'none' | 'in_progress' | 'done') {
    setFilterProgress(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }
  function clearFilters() {
    setFilterPriorities([]);
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterAssignees([]);
    setFilterProgress([]);
  }

  function toggleSelectMode() {
    setIsSelectMode(prev => !prev);
    setSelectedIds(new Set());
  }

  function toggleTaskSelection(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(visibleTasks.map(t => t.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setIsSelectMode(false);
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    onBulkDelete?.(Array.from(selectedIds));
    clearSelection();
  }

  const tasksByStatus = useMemo(() => {
    const map: Record<AgendaTaskStatus, AgendaTask[]> = {
      PENDING: [],
      IN_PROGRESS: [],
      WAITING: [],
      COMPLETED: [],
      CANCELLED: [],
    };
    visibleTasks.forEach(task => {
      if (map[task.status]) {
        map[task.status].push(task);
      }
    });
    return map;
  }, [visibleTasks]);

  function handleDragStart(event: DragStartEvent) {
    const taskId = Number(event.active.id);
    const task = tasks.find(t => t.id === taskId);
    if (task) setActiveDragTask(task);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = Number(active.id);
    const overId = over.id as string;

    // If dropped on a column
    const targetStatus = BOARD_COLUMNS.find(s => s === overId) as AgendaTaskStatus | undefined;
    if (targetStatus) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status !== targetStatus) {
        try {
          await onTaskStatusChange(taskId, targetStatus);
        } catch {
          toast.error('Error al mover la tarea');
        }
      }
      return;
    }

    // If dropped on another task (find its status)
    const overTask = tasks.find(t => t.id === Number(overId));
    if (overTask) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status !== overTask.status) {
        try {
          await onTaskStatusChange(taskId, overTask.status);
        } catch {
          toast.error('Error al mover la tarea');
        }
      }
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Calendar skeleton */}
        <div className="bg-muted/30 rounded-xl h-32 animate-pulse" />
        {/* Board skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {BOARD_COLUMNS.map(col => (
            <div key={col} className="space-y-2">
              <div className="h-8 bg-muted/40 rounded-lg animate-pulse" />
              {[1, 2, 3].map(i => (
                <div key={i} className="h-28 bg-muted/30 rounded-lg animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Task Calendar Strip — hover a date to filter board below */}
      <TaskCalendarStrip tasks={tasks} onTaskClick={onTaskClick} onHoverDate={setHoveredDate} />

      {/* All Task — card container */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E4E4E4', borderRadius: '16px', overflow: 'hidden' }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F0F0F0' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#050505' }}>
            All Task
            {hoveredDate && (
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#9C9CAA', marginLeft: '10px' }}>
                — {format(parseISO(hoveredDate), 'd MMM yyyy')}
              </span>
            )}
          </span>

          {/* View switcher + filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Select mode toggle */}
            <button
              onClick={toggleSelectMode}
              title={isSelectMode ? 'Salir de selección' : 'Seleccionar tareas'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: '34px', width: '34px',
                border: `1px solid ${isSelectMode ? '#3070A8' : '#E4E4E4'}`,
                borderRadius: '10px',
                background: isSelectMode ? '#EBF2FB' : '#FAFAFA',
                color: isSelectMode ? '#3070A8' : '#9C9CAA',
                cursor: 'pointer', transition: 'all 150ms ease',
              }}
              onMouseEnter={e => { if (!isSelectMode) { e.currentTarget.style.background = '#F0F0F0'; e.currentTarget.style.color = '#575456'; } }}
              onMouseLeave={e => { if (!isSelectMode) { e.currentTarget.style.background = '#FAFAFA'; e.currentTarget.style.color = '#9C9CAA'; } }}
            >
              {isSelectMode ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E4E4E4', borderRadius: '10px', overflow: 'hidden', background: '#FAFAFA' }}>
              {([
                { v: 'spreadsheet', Icon: AlignJustify, label: 'Spreadsheet' },
                { v: 'timeline',    Icon: BarChart2,    label: 'Timeline' },
                { v: 'kanban',      Icon: LayoutGrid,   label: 'Kanban' },
              ] as const).map(({ v, Icon, label }, i) => {
                const active = subView === v;
                return (
                  <button
                    key={v}
                    onClick={() => setSubView(v)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '7px 14px', border: 'none',
                      borderRight: i < 2 ? '1px solid #E4E4E4' : 'none',
                      background: active ? '#FFFFFF' : 'transparent',
                      color: active ? '#050505' : '#9C9CAA',
                      fontSize: '12px', fontWeight: active ? 600 : 500,
                      cursor: 'pointer',
                      boxShadow: active ? '0 1px 4px rgba(0,0,0,.06)' : 'none',
                      transition: 'all 150ms ease',
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Filter — standalone with popover */}
            <div ref={filterRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => setShowFilter(p => !p)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '34px', width: '34px', border: `1px solid ${activeFilterCount > 0 ? '#3070A8' : '#E4E4E4'}`, borderRadius: '10px', background: activeFilterCount > 0 ? '#EBF2FB' : '#FAFAFA', color: activeFilterCount > 0 ? '#3070A8' : '#9C9CAA', cursor: 'pointer', transition: 'all 150ms ease', position: 'relative' }}
                onMouseEnter={e => { if (!activeFilterCount) { e.currentTarget.style.background = '#F0F0F0'; e.currentTarget.style.color = '#575456'; } }}
                onMouseLeave={e => { if (!activeFilterCount) { e.currentTarget.style.background = '#FAFAFA'; e.currentTarget.style.color = '#9C9CAA'; } }}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {activeFilterCount > 0 && (
                  <span style={{ position: 'absolute', top: '-5px', right: '-5px', width: '14px', height: '14px', borderRadius: '50%', background: '#3070A8', color: '#FFF', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Filter panel */}
              {showFilter && (
                <div style={{ position: 'absolute', top: '42px', right: 0, width: '260px', background: '#FFFFFF', border: '1px solid #E4E4E4', borderRadius: '14px', boxShadow: '0 8px 28px rgba(0,0,0,.11)', zIndex: 50, padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#050505' }}>Filtros</span>
                    {activeFilterCount > 0 && (
                      <button onClick={clearFilters} style={{ fontSize: '11px', color: '#3070A8', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Limpiar todo</button>
                    )}
                  </div>

                  {/* Priority */}
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#9C9CAA', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Prioridad</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {([
                        { v: 'LOW',    label: 'Baja',    color: '#6B7280' },
                        { v: 'MEDIUM', label: 'Media',   color: '#3070A8' },
                        { v: 'HIGH',   label: 'Alta',    color: '#D97706' },
                        { v: 'URGENT', label: 'Urgente', color: '#DC2626' },
                      ] as const).map(({ v, label, color }) => {
                        const active = filterPriorities.includes(v);
                        return (
                          <button key={v} onClick={() => togglePriority(v)} style={{ padding: '4px 10px', borderRadius: '999px', border: `1.5px solid ${active ? color : '#DDDDE0'}`, background: active ? `${color}18` : 'transparent', color: active ? color : '#9C9CAA', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 120ms ease' }}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Date range */}
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#9C9CAA', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fecha de vencimiento</p>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <DatePicker
                          value={filterDateFrom}
                          onChange={v => setFilterDateFrom(v)}
                          placeholder="Desde"
                          className="h-8 text-xs"
                        />
                      </div>
                      <span style={{ fontSize: '11px', color: '#C8C8D0', flexShrink: 0 }}>—</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <DatePicker
                          value={filterDateTo}
                          onChange={v => setFilterDateTo(v)}
                          placeholder="Hasta"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Assignees — dropdown selector */}
                  {assigneeOptions.length > 0 && (
                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 700, color: '#9C9CAA', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Asignado a</p>

                      {/* Selected chips */}
                      {filterAssignees.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                          {filterAssignees.map(name => (
                            <span key={name} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px 2px 4px', borderRadius: '999px', background: '#EBF2FB', border: '1px solid #BFCFE8', fontSize: '11px', fontWeight: 600, color: '#1A4A80' }}>
                              <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#3070A8', color: '#FFF', fontSize: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </span>
                              {name}
                              <button onClick={() => toggleAssignee(name)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#3070A8', marginLeft: '1px' }}>
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Dropdown to add */}
                      <Select
                        value=""
                        onValueChange={name => { if (name) toggleAssignee(name); }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Agregar persona..." />
                        </SelectTrigger>
                        <SelectContent>
                          {assigneeOptions.filter(n => !filterAssignees.includes(n)).map(name => (
                            <SelectItem key={name} value={name} className="text-xs">
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#E0E0E6', color: '#9C9CAA', fontSize: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  {name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </span>
                                {name}
                              </span>
                            </SelectItem>
                          ))}
                          {assigneeOptions.every(n => filterAssignees.includes(n)) && (
                            <SelectItem value="__none__" disabled className="text-xs text-muted-foreground">Todos seleccionados</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Progress */}
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#9C9CAA', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Progreso</p>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {([
                        { v: 'none',        label: '0%',       color: '#6B6B78' },
                        { v: 'in_progress', label: 'En curso', color: '#3070A8' },
                        { v: 'done',        label: '100%',     color: '#2E7A5E' },
                      ] as const).map(({ v, label, color }) => {
                        const active = filterProgress.includes(v);
                        return (
                          <button key={v} onClick={() => toggleProgress(v)} style={{ flex: 1, padding: '5px 0', borderRadius: '8px', border: `1.5px solid ${active ? color : '#DDDDE0'}`, background: active ? `${color}18` : 'transparent', color: active ? color : '#9C9CAA', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 120ms ease' }}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>

        {/* Floating selection action bar */}
        {selectedIds.size > 0 && (
          <>
            <style>{`
              @keyframes sel-bar-up {
                from { opacity: 0; transform: translate(-50%, 16px); }
                to   { opacity: 1; transform: translate(-50%, 0); }
              }
            `}</style>
            <div style={{
              position: 'fixed', bottom: '32px', left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 100,
              display: 'flex', alignItems: 'center', gap: '16px',
              padding: '10px 20px',
              background: '#FFFFFF',
              border: '1px solid #E4E4E4',
              borderRadius: '999px',
              boxShadow: '0 8px 32px rgba(0,0,0,.14)',
              animation: 'sel-bar-up 260ms cubic-bezier(0.22,1,0.36,1)',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#050505' }}>
                <CheckSquare className="h-4 w-4" style={{ color: '#3070A8' }} />
                {selectedIds.size} tarea{selectedIds.size !== 1 ? 's' : ''} seleccionada{selectedIds.size !== 1 ? 's' : ''}
              </span>
              <div style={{ width: '1px', height: '16px', background: '#E4E4E4' }} />
              <button
                onClick={selectAllVisible}
                style={{ fontSize: '12px', fontWeight: 600, color: '#3070A8', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Seleccionar todas ({visibleTasks.length})
              </button>
              <button
                onClick={clearSelection}
                style={{ fontSize: '12px', fontWeight: 600, color: '#9C9CAA', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkDelete}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 16px', borderRadius: '999px',
                  border: 'none', background: '#DC2626',
                  color: '#FFFFFF', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  transition: 'background 150ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#B91C1C'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#DC2626'; }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </button>
            </div>
          </>
        )}

        {/* Content */}
        <style>{`
          @keyframes view-switch-in {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes item-fade-up {
            from { opacity: 0; transform: translateY(14px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        <div
          key={subView}
          style={{
            padding: subView === 'kanban' ? '20px' : '0',
            animation: 'view-switch-in 300ms cubic-bezier(0.22,1,0.36,1)',
          }}
        >
          {subView === 'timeline' ? (() => {
            const DAYS = 28;
            const start = addDays(new Date(), -7);
            const cols = Array.from({ length: DAYS }, (_, i) => addDays(start, i));
            const ROW_H = 38;
            const COL_W = 42;
            const LABEL_W = 200;
            const tasksWithDate = visibleTasks.filter(t => t.dueDate);
            return (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: LABEL_W + COL_W * DAYS, fontSize: '12px' }}>
                  {/* Date header */}
                  <div style={{ display: 'flex', borderBottom: '1px solid #F0F0F0', position: 'sticky', top: 0, background: '#FFFFFF', zIndex: 2 }}>
                    {isSelectMode && <div style={{ width: 40, flexShrink: 0, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div onClick={() => selectedIds.size === tasksWithDate.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(tasksWithDate.map(t => t.id)))} style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${selectedIds.size === tasksWithDate.length && tasksWithDate.length > 0 ? '#3070A8' : '#CCCCCC'}`, background: selectedIds.size === tasksWithDate.length && tasksWithDate.length > 0 ? '#3070A8' : '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {selectedIds.size === tasksWithDate.length && tasksWithDate.length > 0 && <Check className="h-2.5 w-2.5" style={{ color: '#FFF' }} />}
                      </div>
                    </div>}
                    <div style={{ width: LABEL_W, flexShrink: 0, padding: '8px 16px', fontWeight: 600, fontSize: '11px', color: '#9C9CAA' }}>Tarea</div>
                    {cols.map(day => {
                      const today = isToday(day);
                      return (
                        <div key={day.toISOString()} style={{ width: COL_W, flexShrink: 0, textAlign: 'center', padding: '8px 0', fontWeight: today ? 700 : 500, color: today ? '#050505' : '#9C9CAA', borderLeft: '1px solid #F6F6F6', background: today ? '#F8F8F8' : 'transparent' }}>
                          <div style={{ fontSize: '10px' }}>{format(day, 'EEE').slice(0, 2)}</div>
                          <div style={{ fontSize: '11px' }}>{format(day, 'd')}</div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Task rows */}
                  {tasksWithDate.length === 0 ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9C9CAA' }}>Sin tareas con fecha</div>
                  ) : tasksWithDate.map((task, i) => {
                    const due = parseISO(task.dueDate!);
                    const dayIdx = differenceInCalendarDays(due, start);
                    const inRange = dayIdx >= 0 && dayIdx < DAYS;
                    const STATUS_COLOR: Record<string, string> = { PENDING: '#575456', IN_PROGRESS: '#3070A8', WAITING: '#907840', COMPLETED: '#568177', CANCELLED: '#ED8A94' };
                    return (
                      <div key={task.id} onClick={() => isSelectMode ? toggleTaskSelection(task.id) : onTaskClick(task)} style={{ display: 'flex', alignItems: 'center', borderBottom: i < tasksWithDate.length - 1 ? '1px solid #F6F6F6' : 'none', height: ROW_H, cursor: 'pointer', transition: 'background 120ms ease', animation: 'item-fade-up 340ms cubic-bezier(0.22,1,0.36,1) both', animationDelay: `${Math.min(i, 8) * 45}ms`, background: selectedIds.has(task.id) ? '#EBF2FB' : 'transparent' }}
                        onMouseEnter={e => { if (!selectedIds.has(task.id)) e.currentTarget.style.background = '#FAFAFA'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = selectedIds.has(task.id) ? '#EBF2FB' : 'transparent'; }}
                      >
                        {/* Checkbox in select mode */}
                        {isSelectMode && (
                          <div style={{ width: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${selectedIds.has(task.id) ? '#3070A8' : '#CCCCCC'}`, background: selectedIds.has(task.id) ? '#3070A8' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {selectedIds.has(task.id) && <Check className="h-2.5 w-2.5" style={{ color: '#FFF' }} />}
                            </div>
                          </div>
                        )}
                        {/* Label */}
                        <div style={{ width: LABEL_W, flexShrink: 0, padding: '0 16px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontWeight: 500, color: '#050505' }}>{task.title}</div>
                        {/* Grid cells */}
                        {cols.map((day, ci) => {
                          const today = isToday(day);
                          const isDue = ci === dayIdx;
                          return (
                            <div key={ci} style={{ width: COL_W, flexShrink: 0, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid #F6F6F6', background: today ? '#FAFAFA' : 'transparent', position: 'relative' }}>
                              {today && <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: '#050505', opacity: 0.12, transform: 'translateX(-50%)' }} />}
                              {isDue && inRange && (
                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[task.status] ?? '#9C9CAA', boxShadow: `0 0 0 3px ${STATUS_COLOR[task.status] ?? '#9C9CAA'}22`, zIndex: 1 }} />
                              )}
                            </div>
                          );
                        })}
                        {/* Out-of-range badge */}
                        {!inRange && (
                          <div style={{ position: 'absolute', right: 16, fontSize: '10px', color: '#9C9CAA', fontWeight: 500 }}>
                            {format(due, 'd MMM')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })() : subView === 'kanban' ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', alignItems: 'start' }}>
                {BOARD_COLUMNS.map((status, i) => (
                  <div
                    key={status}
                    style={{
                      animation: 'item-fade-up 380ms cubic-bezier(0.22,1,0.36,1) both',
                      animationDelay: `${i * 70}ms`,
                    }}
                  >
                    <BoardColumn
                      status={status}
                      tasks={tasksByStatus[status]}
                      onTaskClick={onTaskClick}
                      onStatusChange={(task, newStatus) => onTaskStatusChange(task.id, newStatus)}
                      onDelete={onTaskDelete}
                      onEdit={onEditTask}
                      onCreateTask={(status) => onCreateTask(status, hoveredDate ?? undefined)}
                      isSelectMode={isSelectMode}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleTaskSelection}
                      columnIndex={i}
                    />
                  </div>
                ))}
              </div>
              <DragOverlay>
                {activeDragTask ? (
                  <div className="opacity-90 rotate-2 scale-105">
                    <div className="bg-card border border-border rounded-lg p-3 shadow-xl w-72">
                      <p className="text-xs font-semibold text-foreground mb-1">{activeDragTask.category || 'Sin categoría'}</p>
                      <p className="text-sm text-foreground">{activeDragTask.title}</p>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : (
            /* Spreadsheet view — simple table */
            // eslint-disable-next-line no-constant-condition
            subView === 'spreadsheet' &&
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
                  {isSelectMode && (
                    <th style={{ padding: '10px 12px', width: '40px' }}>
                      <div
                        onClick={() => selectedIds.size === visibleTasks.length ? setSelectedIds(new Set()) : selectAllVisible()}
                        style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${selectedIds.size === visibleTasks.length && visibleTasks.length > 0 ? '#3070A8' : '#CCCCCC'}`, background: selectedIds.size === visibleTasks.length && visibleTasks.length > 0 ? '#3070A8' : '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {selectedIds.size === visibleTasks.length && visibleTasks.length > 0 && <Check className="h-2.5 w-2.5" style={{ color: '#FFF' }} />}
                      </div>
                    </th>
                  )}
                  {['Tarea', 'Estado', 'Prioridad', 'Vencimiento', 'Asignado a'].map(col => (
                    <th key={col} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#9C9CAA', whiteSpace: 'nowrap' }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleTasks.length === 0 ? (
                  <tr><td colSpan={isSelectMode ? 6 : 5} style={{ padding: '32px 16px', textAlign: 'center', color: '#9C9CAA', fontSize: '13px' }}>Sin tareas</td></tr>
                ) : visibleTasks.map((task, i) => {
                  const isSelected = selectedIds.has(task.id);
                  return (
                    <tr
                      key={task.id}
                      onClick={() => isSelectMode ? toggleTaskSelection(task.id) : onTaskClick(task)}
                      style={{ borderBottom: i < visibleTasks.length - 1 ? '1px solid #F6F6F6' : 'none', cursor: 'pointer', transition: 'background 120ms ease', animation: 'item-fade-up 320ms cubic-bezier(0.22,1,0.36,1) both', animationDelay: `${Math.min(i, 10) * 35}ms`, background: isSelected ? '#EBF2FB' : 'transparent' }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#FAFAFA'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isSelected ? '#EBF2FB' : 'transparent'; }}
                    >
                      {isSelectMode && (
                        <td style={{ padding: '10px 12px', width: '40px' }}>
                          <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: `2px solid ${isSelected ? '#3070A8' : '#CCCCCC'}`, background: isSelected ? '#3070A8' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isSelected && <Check className="h-2.5 w-2.5" style={{ color: '#FFF' }} />}
                          </div>
                        </td>
                      )}
                      <td style={{ padding: '10px 16px', fontWeight: 500, color: '#050505', maxWidth: '260px' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{task.title}</span>
                        {task.category && <span style={{ fontSize: '11px', color: '#9C9CAA' }}>{task.category}</span>}
                      </td>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', border: '1.5px solid #D8D8D8' }}>
                          {{ PENDING: 'Por hacer', IN_PROGRESS: 'En progreso', WAITING: 'En revisión', COMPLETED: 'Completado', CANCELLED: 'Cancelado' }[task.status]}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', border: '1.5px solid #D8D8D8', color: { LOW: '#6B7280', MEDIUM: '#3070A8', HIGH: '#D97706', URGENT: '#DC2626' }[task.priority] }}>
                          {{ LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', URGENT: 'Urgente' }[task.priority]}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', color: task.dueDate ? '#575456' : '#C8C8D0', whiteSpace: 'nowrap', fontSize: '12px' }}>
                        {task.dueDate ? format(parseISO(task.dueDate), 'd MMM yyyy') : '—'}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#575456', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {getAssigneeName(task)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
