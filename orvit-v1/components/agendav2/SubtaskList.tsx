'use client';

import { useState, useRef, useEffect } from 'react';
import { Plus, GripVertical, Check, UserRound, X as XIcon, Trash2, SquarePen } from 'lucide-react';

const EMPTY_ASSIGNEES: readonly AssigneeOption[] = [];

export interface AssigneeOption {
  id?: number;
  name: string;
  initials: string;
  bg: string;
  color: string;
}
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface SubtaskItem {
  id: string;
  title: string;
  note?: string;
  assignee?: string;
  assigneeId?: number;
  completed: boolean;
}

interface SubtaskListProps {
  groupTitle?: string;
  subtasks: SubtaskItem[];
  onToggle?: (id: string, completed: boolean) => void;
  onAdd?: (title: string) => void;
  onUpdate?: (id: string, updates: Partial<SubtaskItem>) => void;
  onDelete?: (id: string) => void;
  onReorder?: (items: SubtaskItem[]) => void;
  readOnly?: boolean;
  hideFooter?: boolean;
  noAssign?: boolean;
  taskAssignees?: readonly AssigneeOption[];
}

// Minimal sortable wrapper — just forwards drag refs + handle props
function SortableItem({
  id,
  children,
}: {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children: (props: { listeners: any; attributes: any; isDragging: boolean }) => React.ReactNode;
}) {
  const {
    setNodeRef,
    transform,
    transition,
    listeners,
    attributes,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: 'relative',
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      {children({ listeners, attributes, isDragging })}
    </div>
  );
}

export function SubtaskList({
  groupTitle = 'Subtareas',
  subtasks,
  onToggle,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
  readOnly = false,
  hideFooter = false,
  noAssign = false,
  taskAssignees = EMPTY_ASSIGNEES,
}: SubtaskListProps) {
  const [addingNew, setAddingNew]     = useState(false);
  const [newTitle, setNewTitle]       = useState('');
  const [hoveredId, setHoveredId]     = useState<string | null>(null);
  const [focusedId, setFocusedId]     = useState<string | null>(null);
  const [noteTexts, setNoteTexts]     = useState<Record<string, string>>({});
  const [assignPopId, setAssignPopId] = useState<string | null>(null);
  const [poppingId, setPoppingId]     = useState<string | null>(null);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editTitle, setEditTitle]     = useState('');
  const assignPopRef                  = useRef<HTMLDivElement>(null);
  const noteInputRef                  = useRef<HTMLInputElement>(null);
  const titleInputRef                 = useRef<HTMLInputElement>(null);

  function startEdit(subtask: SubtaskItem) {
    if (readOnly || subtask.completed) return;
    setEditingId(subtask.id);
    setEditTitle(subtask.title);
    setTimeout(() => { titleInputRef.current?.select(); }, 0);
  }

  function commitEdit(subtask: SubtaskItem) {
    const val = editTitle.trim();
    setEditingId(null);
    if (val && val !== subtask.title) {
      onUpdate?.(subtask.id, { title: val });
    }
  }

  // Close assignee popover on outside click
  useEffect(() => {
    if (!assignPopId) return;
    function handler(e: MouseEvent) {
      if (assignPopRef.current && !assignPopRef.current.contains(e.target as Node)) {
        setAssignPopId(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [assignPopId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = subtasks.findIndex(s => s.id === String(active.id));
    const newIndex  = subtasks.findIndex(s => s.id === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder?.(arrayMove(subtasks, oldIndex, newIndex));
  }

  function handleAddSubmit() {
    if (!newTitle.trim()) { setAddingNew(false); return; }
    onAdd?.(newTitle.trim());
    setNewTitle('');
    setAddingNew(false);
  }

  function getNoteText(subtask: SubtaskItem): string {
    return noteTexts[subtask.id] !== undefined ? noteTexts[subtask.id] : (subtask.note ?? '');
  }

  function handleNoteChange(id: string, val: string) {
    setNoteTexts(prev => ({ ...prev, [id]: val }));
  }

  function submitNote(subtask: SubtaskItem) {
    const val = getNoteText(subtask).trim();
    onUpdate?.(subtask.id, { note: val || undefined });
    // Clear local draft
    setNoteTexts(prev => { const n = { ...prev }; delete n[subtask.id]; return n; });
  }

  function handleAddNote(subtask: SubtaskItem) {
    submitNote(subtask);
  }

  function toggleAssignPop(subtask: SubtaskItem) {
    setAssignPopId(prev => prev === subtask.id ? null : subtask.id);
  }

  function assignPerson(subtaskId: string, person: AssigneeOption | null) {
    onUpdate?.(subtaskId, { assignee: person?.name ?? undefined, assigneeId: person?.id ?? undefined });
    setAssignPopId(null);
  }

  return (
    <div className="space-y-2">
      <style>{`
        @keyframes checkbox-pop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.5); }
          70%  { transform: scale(0.85); }
          100% { transform: scale(1); }
        }
        @keyframes subtask-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes subtask-expand {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Subtask items — wrapped in DnD context for reordering */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={subtasks.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {subtasks.map((subtask) => {
            // Panel expands ONLY on explicit action (click note bubble / click note icon / assign pop)
            const isHovered  = hoveredId === subtask.id;
            const isExpanded = !readOnly && !subtask.completed && (
              focusedId === subtask.id ||
              assignPopId === subtask.id
            );
            const noteVal    = getNoteText(subtask);

            return (
              <SortableItem key={subtask.id} id={subtask.id}>
                {({ listeners, attributes, isDragging }) => (
                  <div
                    onMouseEnter={() => { if (!isDragging) setHoveredId(subtask.id); }}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      background: '#FFFFFF',
                      border: `1px solid ${isDragging ? '#059669' : isExpanded ? '#D8D8DE' : isHovered ? '#D1D5DB' : '#E4E4E8'}`,
                      borderRadius: '10px',
                      padding: '8px 12px',
                      opacity: subtask.completed ? 0.65 : 1,
                      boxShadow: isDragging ? '0 4px 16px rgba(0,0,0,.10)' : isExpanded ? '0 2px 8px rgba(0,0,0,.06)' : 'none',
                      transition: 'border-color 120ms, box-shadow 120ms',
                    }}
                  >
                    {/* ── Main row ── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {/* Drag handle */}
                      {!readOnly && (
                        <GripVertical
                          {...listeners}
                          {...attributes}
                          style={{ width: '14px', height: '14px', flexShrink: 0, color: '#C8C8D0', cursor: isDragging ? 'grabbing' : 'grab', opacity: isHovered || isExpanded ? 0.7 : 0.3 }}
                        />
                      )}

                      {/* Checkbox */}
                      <button
                        onClick={() => {
                          if (!subtask.completed) {
                            setPoppingId(subtask.id);
                            setTimeout(() => setPoppingId(null), 400);
                          }
                          onToggle?.(subtask.id, !subtask.completed);
                        }}
                        disabled={readOnly}
                        style={{
                          width: '16px', height: '16px', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: subtask.completed ? 'none' : '1.5px solid #D1D5DB',
                          borderRadius: '4px',
                          background: subtask.completed ? '#059669' : 'transparent',
                          cursor: readOnly ? 'default' : 'pointer',
                          transition: 'background 200ms, border-color 150ms',
                          animation: poppingId === subtask.id ? 'checkbox-pop 350ms cubic-bezier(0.22,1,0.36,1) both' : undefined,
                        }}
                        onMouseEnter={e => { if (!subtask.completed && !readOnly) e.currentTarget.style.borderColor = '#059669'; }}
                        onMouseLeave={e => { if (!subtask.completed && !readOnly) e.currentTarget.style.borderColor = '#D1D5DB'; }}
                      >
                        {subtask.completed && <Check style={{ width: '10px', height: '10px', color: '#FFF' }} />}
                      </button>

                      {/* Title — click to edit */}
                      {editingId === subtask.id ? (
                        <input
                          ref={titleInputRef}
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitEdit(subtask);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          onBlur={() => commitEdit(subtask)}
                          style={{
                            flex: 1, minWidth: 0, border: 'none', outline: 'none',
                            fontSize: '13px', fontWeight: 500, color: '#111827', lineHeight: 1.4,
                            background: 'transparent', padding: 0,
                          }}
                        />
                      ) : (
                        <p
                          onClick={() => startEdit(subtask)}
                          style={{
                            flex: 1, minWidth: 0,
                            fontSize: '13px', fontWeight: 500, color: '#111827', lineHeight: 1.4,
                            textDecoration: subtask.completed ? 'line-through' : 'none',
                            cursor: readOnly || subtask.completed ? 'default' : 'text',
                          }}
                        >
                          {subtask.title}
                        </p>
                      )}

                      {/* Right — assignee chip + trash */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {subtask.assignee && (() => {
                          const found = taskAssignees.find(a => a.name === subtask.assignee);
                          return (
                            <div
                              onClick={() => !readOnly && toggleAssignPop(subtask)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '2px 6px 2px 4px', borderRadius: '4px',
                                background: found?.bg ?? '#EDE9FE', cursor: readOnly ? 'default' : 'pointer',
                              }}
                            >
                              <div style={{ width: '13px', height: '13px', borderRadius: '50%', background: found?.color ?? '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '7px', fontWeight: 700, color: '#FFF' }}>{found?.initials ?? subtask.assignee![0]}</span>
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: found?.color ?? '#7C3AED' }}>{subtask.assignee}</span>
                              {!readOnly && (
                                <XIcon
                                  style={{ width: '10px', height: '10px', color: found?.color ?? '#7C3AED', opacity: 0.6, marginLeft: '1px' }}
                                  onClick={e => { e.stopPropagation(); assignPerson(subtask.id, null); }}
                                />
                              )}
                            </div>
                          );
                        })()}

                        {/* Note icon — only when no note and no expanded panel */}
                        {!readOnly && !subtask.completed && !subtask.note && !isExpanded && (
                          <button
                            onClick={() => setFocusedId(subtask.id)}
                            style={{
                              width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              borderRadius: '5px', border: 'none', background: 'transparent', color: '#C8C8D0',
                              cursor: 'pointer', flexShrink: 0,
                              opacity: isHovered ? 1 : 0, transition: 'opacity 150ms, color 120ms, background 120ms',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.background = '#F4F4F6'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#C8C8D0'; e.currentTarget.style.background = 'transparent'; }}
                          >
                            <SquarePen style={{ width: '11px', height: '11px' }} />
                          </button>
                        )}
                        {!readOnly && (
                          <button
                            onClick={() => onDelete?.(subtask.id)}
                            style={{
                              width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              borderRadius: '5px', border: 'none', background: 'transparent', color: '#C8C8D0',
                              cursor: 'pointer', flexShrink: 0,
                              opacity: isHovered || isExpanded ? 1 : 0, transition: 'opacity 150ms, color 120ms, background 120ms',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FEE2E2'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#C8C8D0'; e.currentTarget.style.background = 'transparent'; }}
                          >
                            <Trash2 style={{ width: '11px', height: '11px' }} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ── Expanded panel: note input + action buttons ── */}
                    {!readOnly && !subtask.completed && isExpanded && (
                      <div
                        style={{
                          marginTop: '10px',
                          paddingLeft: '26px',
                          animation: 'subtask-expand 160ms cubic-bezier(0.22,1,0.36,1) both',
                        }}
                      >
                        {/* Note input — comment style */}
                        <div style={{ display: 'flex', gap: '7px', alignItems: 'flex-start', marginBottom: '6px' }}>
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#F0F0F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                            <SquarePen style={{ width: '10px', height: '10px', color: '#6B7280' }} />
                          </div>
                          <div style={{ flex: 1, border: '1.5px solid #E4E4E8', borderRadius: '6px', background: '#FAFAFA', overflow: 'hidden', transition: 'border-color 120ms' }}
                            onFocusCapture={e => (e.currentTarget.style.borderColor = '#374151')}
                            onBlurCapture={e => (e.currentTarget.style.borderColor = '#E4E4E8')}
                          >
                            <input
                              ref={noteInputRef}
                              value={noteVal}
                              onChange={e => handleNoteChange(subtask.id, e.target.value)}
                              placeholder="Agregar una nota..."
                              onKeyDown={e => {
                                if (e.key === 'Enter') { handleAddNote(subtask); setHoveredId(null); setFocusedId(null); }
                                if (e.key === 'Escape') { setHoveredId(null); setFocusedId(null); }
                              }}
                              style={{
                                width: '100%', border: 'none', outline: 'none',
                                padding: '6px 10px', fontSize: '12px', color: '#374151',
                                background: 'transparent', boxSizing: 'border-box',
                              }}
                              onFocus={e => setFocusedId(subtask.id)}
                              onBlur={e => { setFocusedId(null); submitNote(subtask); }}
                            />
                          </div>
                          <button
                            onMouseDown={e => { e.preventDefault(); handleAddNote(subtask); setHoveredId(null); setFocusedId(null); }}
                            style={{
                              height: '28px', padding: '0 10px', borderRadius: '6px',
                              border: 'none', background: noteVal.trim() ? '#111827' : '#E4E4E8',
                              color: noteVal.trim() ? '#FFFFFF' : '#9CA3AF',
                              fontSize: '11px', fontWeight: 600, cursor: noteVal.trim() ? 'pointer' : 'default',
                              flexShrink: 0, transition: 'background 150ms, color 150ms',
                            }}
                          >
                            Guardar
                          </button>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '29px' }}>
                          {/* Add Assign */}
                          {!noAssign && (
                            <div style={{ position: 'relative' }}>
                              <button
                                onMouseDown={e => { e.preventDefault(); toggleAssignPop(subtask); }}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                                  height: '26px', padding: '0 10px', borderRadius: '6px',
                                  border: '1px solid #E4E4E8', background: '#FFFFFF',
                                  fontSize: '12px', fontWeight: 500, color: '#6B7280',
                                  cursor: 'pointer', transition: 'background 100ms, border-color 100ms',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#F4F4F6'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#E4E4E8'; }}
                              >
                                <UserRound style={{ width: '12px', height: '12px' }} />
                                Add Assign
                              </button>

                              {/* Assignee dropdown */}
                              {assignPopId === subtask.id && (
                                <div
                                  ref={assignPopRef}
                                  style={{
                                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20,
                                    background: '#FFFFFF', border: '1.5px solid #D8D8DE', borderRadius: '10px',
                                    boxShadow: '0 4px 16px rgba(0,0,0,.10)', padding: '6px',
                                    minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '2px',
                                  }}
                                >
                                  {taskAssignees.length === 0 ? (
                                    <p style={{ fontSize: '11px', color: '#9CA3AF', padding: '4px 8px' }}>Sin personas en la tarea</p>
                                  ) : taskAssignees.map(person => (
                                    <button
                                      key={person.name}
                                      onClick={() => assignPerson(subtask.id, person)}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '6px 8px', borderRadius: '7px', border: 'none',
                                        background: subtask.assignee === person.name ? person.bg : 'transparent',
                                        cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background 100ms',
                                      }}
                                      onMouseEnter={e => { if (subtask.assignee !== person.name) e.currentTarget.style.background = '#F4F4F6'; }}
                                      onMouseLeave={e => { if (subtask.assignee !== person.name) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: person.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span style={{ fontSize: '9px', fontWeight: 700, color: person.color }}>{person.initials}</span>
                                      </div>
                                      <span style={{ fontSize: '12px', fontWeight: 500, color: '#111827' }}>{person.name}</span>
                                      {subtask.assignee === person.name && <Check style={{ width: '12px', height: '12px', marginLeft: 'auto', color: person.color }} />}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Note display when collapsed — click to edit */}
                    {subtask.note && !isExpanded && (
                      <div
                        onClick={() => !readOnly && setFocusedId(subtask.id)}
                        style={{ display: 'flex', gap: '7px', alignItems: 'flex-start', marginTop: '5px', cursor: readOnly ? 'default' : 'pointer' }}
                      >
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#F0F0F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                          <SquarePen style={{ width: '10px', height: '10px', color: '#6B7280' }} />
                        </div>
                        <div style={{ background: '#F4F4F6', border: '1px solid #E4E4E8', borderRadius: '6px 8px 8px 6px', padding: '5px 10px', maxWidth: 'calc(100% - 30px)' }}>
                          <p style={{ fontSize: '12px', color: '#374151', margin: 0, lineHeight: 1.4 }}>{subtask.note}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </SortableItem>
            );
          })}
        </SortableContext>
      </DndContext>

      {/* Inline add new — hidden when hideFooter */}
      {!hideFooter && <div
        style={{
          overflow: 'hidden',
          maxHeight: addingNew ? '80px' : '0',
          opacity: addingNew ? 1 : 0,
          transition: 'all 200ms ease',
        }}
      >
        <div
          className="flex items-center gap-3"
          style={{ background: '#FFFFFF', border: '1px dashed #059669', borderRadius: '8px', padding: '8px 12px' }}
        >
          <div style={{ width: '16px', height: '16px', border: '1.5px solid #E4E4E8', borderRadius: '4px', flexShrink: 0 }} />
          <input
            autoFocus={addingNew}
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddSubmit();
              if (e.key === 'Escape') { setAddingNew(false); setNewTitle(''); }
            }}
            onBlur={handleAddSubmit}
            placeholder="Nombre de la subtarea..."
            className="flex-1 outline-none bg-transparent"
            style={{ fontSize: '13px', color: '#111827' }}
          />
        </div>
      </div>}

      {/* Footer — hidden when hideFooter (controlled externally) */}
      {!readOnly && !hideFooter && (
        <div className="flex items-center gap-4 pt-2" style={{ borderTop: '1px dashed #E4E4E8', marginBottom: '8px' }}>
          <button
            onClick={() => setAddingNew(true)}
            className="flex items-center gap-1 transition-colors"
            style={{ fontSize: '12px', color: '#9CA3AF' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#6B7280')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
          >
            <Plus className="h-3 w-3" /> Nueva subtarea
          </button>
        </div>
      )}
    </div>
  );
}
