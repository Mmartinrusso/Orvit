'use client';

import { useState } from 'react';
import { Plus, GripVertical, Check } from 'lucide-react';

export interface SubtaskItem {
  id: string;
  title: string;
  note?: string;
  completed: boolean;
}

interface SubtaskListProps {
  groupTitle?: string;
  subtasks: SubtaskItem[];
  onToggle?: (id: string, completed: boolean) => void;
  onAdd?: (title: string) => void;
  readOnly?: boolean;
}

export function SubtaskList({ groupTitle = 'Subtareas', subtasks, onToggle, onAdd, readOnly = false }: SubtaskListProps) {
  const [addingNew, setAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  function handleAddSubmit() {
    if (!newTitle.trim()) { setAddingNew(false); return; }
    onAdd?.(newTitle.trim());
    setNewTitle('');
    setAddingNew(false);
  }

  return (
    <div className="space-y-2">
      {/* Subtask items */}
      {subtasks.map((subtask) => (
        <div
          key={subtask.id}
          className="flex items-start gap-3 group transition-colors"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E4E4E4',
            borderRadius: '14px',
            padding: '12px 14px',
            opacity: subtask.completed ? 0.65 : 1,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#FBFBFB')}
          onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
        >
          {/* Drag handle */}
          {!readOnly && (
            <GripVertical
              className="h-4 w-4 mt-0.5 shrink-0 cursor-grab opacity-30 group-hover:opacity-60 transition-opacity"
              style={{ color: '#9C9CAA' }}
            />
          )}

          {/* Checkbox (square) */}
          <button
            onClick={() => onToggle?.(subtask.id, !subtask.completed)}
            disabled={readOnly}
            className="mt-0.5 h-4 w-4 flex items-center justify-center shrink-0 transition-colors duration-150"
            style={{
              border: subtask.completed ? 'none' : '1.5px solid #E4E4E4',
              borderRadius: '4px',
              background: subtask.completed ? '#568177' : 'transparent',
            }}
            onMouseEnter={e => {
              if (!subtask.completed) e.currentTarget.style.borderColor = '#568177';
            }}
            onMouseLeave={e => {
              if (!subtask.completed) e.currentTarget.style.borderColor = '#E4E4E4';
            }}
          >
            {subtask.completed && <Check className="h-2.5 w-2.5 text-white" />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p
              className="text-[13px] leading-snug"
              style={{
                fontWeight: 500,
                color: '#050505',
                textDecoration: subtask.completed ? 'line-through' : 'none',
              }}
            >
              {subtask.title}
            </p>
            {subtask.note && (
              <div
                className="mt-1.5 px-2 py-1"
                style={{ background: '#F6F6F6', borderRadius: '8px' }}
              >
                <p className="text-[11px]" style={{ color: '#9C9CAA' }}>{subtask.note}</p>
              </div>
            )}
            {!readOnly && !subtask.completed && (
              <div className="flex items-center gap-3 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <button
                  className="text-[11px] flex items-center gap-0.5 transition-colors"
                  style={{ color: '#9C9CAA' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#575456')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9C9CAA')}
                >
                  <Plus className="h-2.5 w-2.5" /> Add Note
                </button>
                <button
                  className="text-[11px] flex items-center gap-0.5 transition-colors"
                  style={{ color: '#9C9CAA' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#575456')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9C9CAA')}
                >
                  <Plus className="h-2.5 w-2.5" /> Add Assign
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Inline add */}
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
          style={{
            background: '#FFFFFF',
            border: '1px dashed #568177',
            borderRadius: '14px',
            padding: '12px 14px',
          }}
        >
          <div
            style={{ width: '16px', height: '16px', border: '1.5px solid #E4E4E4', borderRadius: '4px', flexShrink: 0 }}
          />
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
        <div
          className="flex items-center gap-4 pt-2"
          style={{ borderTop: '1px dashed #E4E4E4' }}
        >
          <button
            onClick={() => setAddingNew(true)}
            className="flex items-center gap-1 transition-colors"
            style={{ fontSize: '12px', color: '#9C9CAA' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#575456')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9C9CAA')}
          >
            <Plus className="h-3 w-3" /> New subtask
          </button>
          <button
            className="flex items-center gap-1 transition-colors"
            style={{ fontSize: '12px', color: '#9C9CAA' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#575456')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9C9CAA')}
          >
            ≡ Add Description
          </button>
          <button
            className="flex items-center gap-1 transition-colors"
            style={{ fontSize: '12px', color: '#9C9CAA' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#575456')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9C9CAA')}
          >
            + Add Assign
          </button>
        </div>
      )}
    </div>
  );
}
