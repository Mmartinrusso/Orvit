'use client';

import { useState } from 'react';
import { Plus, GripVertical, Check, User } from 'lucide-react';
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
  completed: boolean;
}

interface SubtaskListProps {
  groupTitle?: string;
  subtasks: SubtaskItem[];
  onToggle?: (id: string, completed: boolean) => void;
  onAdd?: (title: string) => void;
  onUpdate?: (id: string, updates: Partial<SubtaskItem>) => void;
  onReorder?: (items: SubtaskItem[]) => void;
  readOnly?: boolean;
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
  onReorder,
  readOnly = false,
}: SubtaskListProps) {
  const [addingNew, setAddingNew]       = useState(false);
  const [newTitle, setNewTitle]         = useState('');
  const [noteEditId, setNoteEditId]     = useState<string | null>(null);
  const [noteText, setNoteText]         = useState('');
  const [assignEditId, setAssignEditId] = useState<string | null>(null);
  const [assignText, setAssignText]     = useState('');

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

  function openNoteEdit(subtask: SubtaskItem) {
    setAssignEditId(null);
    setNoteEditId(subtask.id);
    setNoteText(subtask.note ?? '');
  }

  function submitNote(id: string) {
    onUpdate?.(id, { note: noteText.trim() || undefined });
    setNoteEditId(null);
    setNoteText('');
  }

  function openAssignEdit(subtask: SubtaskItem) {
    setNoteEditId(null);
    setAssignEditId(subtask.id);
    setAssignText(subtask.assignee ?? '');
  }

  function submitAssign(id: string) {
    onUpdate?.(id, { assignee: assignText.trim() || undefined });
    setAssignEditId(null);
    setAssignText('');
  }

  return (
    <div className="space-y-2">
      {/* Subtask items — wrapped in DnD context for reordering */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={subtasks.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {subtasks.map((subtask) => (
            <SortableItem key={subtask.id} id={subtask.id}>
              {({ listeners, attributes, isDragging }) => (
                <div
                  className="group transition-colors"
                  style={{
                    background: isDragging ? '#FBFBFB' : '#FFFFFF',
                    border: isDragging ? '1px solid #568177' : '1px solid #E4E4E4',
                    borderRadius: '14px',
                    padding: '12px 14px',
                    opacity: subtask.completed ? 0.65 : 1,
                    boxShadow: isDragging ? '0 4px 16px rgba(0,0,0,.10)' : 'none',
                  }}
                  onMouseEnter={e => { if (!isDragging) (e.currentTarget as HTMLDivElement).style.background = '#FBFBFB'; }}
                  onMouseLeave={e => { if (!isDragging) (e.currentTarget as HTMLDivElement).style.background = '#FFFFFF'; }}
                >
                  <div className="flex items-start gap-3">
                    {/* Drag handle */}
                    {!readOnly && (
                      <GripVertical
                        {...listeners}
                        {...attributes}
                        className="h-4 w-4 mt-0.5 shrink-0 opacity-30 group-hover:opacity-60 transition-opacity"
                        style={{ color: '#9C9CAA', cursor: isDragging ? 'grabbing' : 'grab' }}
                      />
                    )}

                    {/* Checkbox */}
                    <button
                      onClick={() => onToggle?.(subtask.id, !subtask.completed)}
                      disabled={readOnly}
                      className="mt-0.5 h-4 w-4 flex items-center justify-center shrink-0 transition-colors duration-150"
                      style={{
                        border: subtask.completed ? 'none' : '1.5px solid #E4E4E4',
                        borderRadius: '4px',
                        background: subtask.completed ? '#568177' : 'transparent',
                      }}
                      onMouseEnter={e => { if (!subtask.completed) e.currentTarget.style.borderColor = '#568177'; }}
                      onMouseLeave={e => { if (!subtask.completed) e.currentTarget.style.borderColor = '#E4E4E4'; }}
                    >
                      {subtask.completed && <Check className="h-2.5 w-2.5 text-white" />}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[13px] leading-snug"
                        style={{ fontWeight: 500, color: '#050505', textDecoration: subtask.completed ? 'line-through' : 'none' }}
                      >
                        {subtask.title}
                      </p>

                      {/* Assignee chip */}
                      {subtask.assignee && assignEditId !== subtask.id && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <User className="h-3 w-3" style={{ color: '#3070A8' }} />
                          <span className="text-[11px] font-medium" style={{ color: '#3070A8' }}>{subtask.assignee}</span>
                        </div>
                      )}

                      {/* Note */}
                      {subtask.note && noteEditId !== subtask.id && (
                        <div className="mt-1.5 px-2 py-1" style={{ background: '#F6F6F6', borderRadius: '8px' }}>
                          <p className="text-[11px]" style={{ color: '#9C9CAA' }}>{subtask.note}</p>
                        </div>
                      )}

                      {/* Inline note editor */}
                      {noteEditId === subtask.id && (
                        <div className="mt-2" style={{ border: '1px solid #D0E0F0', borderRadius: '8px', overflow: 'hidden' }}>
                          <textarea
                            autoFocus
                            rows={2}
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            placeholder="Escribir nota..."
                            className="w-full outline-none resize-none px-2.5 py-1.5 bg-transparent"
                            style={{ fontSize: '12px', color: '#050505' }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitNote(subtask.id); }
                              if (e.key === 'Escape') { setNoteEditId(null); }
                            }}
                          />
                          <div className="flex justify-end gap-2 px-2 py-1" style={{ borderTop: '1px solid #E4E4E4', background: '#F6F6F6' }}>
                            <button
                              onClick={() => setNoteEditId(null)}
                              className="text-[11px] px-2 py-0.5 rounded"
                              style={{ color: '#9C9CAA' }}
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => submitNote(subtask.id)}
                              className="text-[11px] px-2.5 py-0.5 rounded font-semibold text-white"
                              style={{ background: '#568177' }}
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inline assign editor */}
                      {assignEditId === subtask.id && (
                        <div className="mt-2 flex items-center gap-2" style={{ border: '1px solid #D0E0F0', borderRadius: '8px', padding: '6px 10px' }}>
                          <User className="h-3.5 w-3.5 shrink-0" style={{ color: '#9C9CAA' }} />
                          <input
                            autoFocus
                            value={assignText}
                            onChange={e => setAssignText(e.target.value)}
                            placeholder="Nombre del responsable..."
                            className="flex-1 outline-none bg-transparent"
                            style={{ fontSize: '12px', color: '#050505' }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') submitAssign(subtask.id);
                              if (e.key === 'Escape') setAssignEditId(null);
                            }}
                            onBlur={() => submitAssign(subtask.id)}
                          />
                        </div>
                      )}

                      {/* Hover action buttons */}
                      {!readOnly && !subtask.completed && noteEditId !== subtask.id && assignEditId !== subtask.id && (
                        <div className="flex items-center gap-3 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          <button
                            onClick={() => openNoteEdit(subtask)}
                            className="text-[11px] flex items-center gap-0.5 transition-colors"
                            style={{ color: '#9C9CAA' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#575456')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#9C9CAA')}
                          >
                            <Plus className="h-2.5 w-2.5" /> Agregar nota
                          </button>
                          <button
                            onClick={() => openAssignEdit(subtask)}
                            className="text-[11px] flex items-center gap-0.5 transition-colors"
                            style={{ color: '#9C9CAA' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#575456')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#9C9CAA')}
                          >
                            <Plus className="h-2.5 w-2.5" /> Asignar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </SortableItem>
          ))}
        </SortableContext>
      </DndContext>

      {/* Inline add new */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: addingNew ? '80px' : '0',
          opacity: addingNew ? 1 : 0,
          transition: 'all 200ms ease',
        }}
      >
        <div
          className="flex items-center gap-3"
          style={{ background: '#FFFFFF', border: '1px dashed #568177', borderRadius: '14px', padding: '12px 14px' }}
        >
          <div style={{ width: '16px', height: '16px', border: '1.5px solid #E4E4E4', borderRadius: '4px', flexShrink: 0 }} />
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
            style={{ fontSize: '13px', color: '#050505' }}
          />
        </div>
      </div>

      {/* Footer */}
      {!readOnly && (
        <div className="flex items-center gap-4 pt-2" style={{ borderTop: '1px dashed #E4E4E4' }}>
          <button
            onClick={() => setAddingNew(true)}
            className="flex items-center gap-1 transition-colors"
            style={{ fontSize: '12px', color: '#9C9CAA' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#575456')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9C9CAA')}
          >
            <Plus className="h-3 w-3" /> Nueva subtarea
          </button>
          <button
            className="flex items-center gap-1 transition-colors"
            style={{ fontSize: '12px', color: '#9C9CAA' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#575456')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9C9CAA')}
          >
            ≡ Agregar descripción
          </button>
          <button
            className="flex items-center gap-1 transition-colors"
            style={{ fontSize: '12px', color: '#9C9CAA' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#575456')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9C9CAA')}
          >
            <Plus className="h-3 w-3" /> Asignar
          </button>
        </div>
      )}
    </div>
  );
}
