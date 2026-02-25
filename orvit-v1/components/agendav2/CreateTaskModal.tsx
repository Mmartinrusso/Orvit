'use client';

import { useState, useEffect } from 'react';
import {
  X, Circle, PlayCircle, Clock, CheckCircle2,
  CalendarDays, Users, Tag, Flame, MessageSquareText,
  Plus, Loader2, ChevronDown,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { AgendaTaskStatus, Priority, CreateAgendaTaskInput } from '@/lib/agenda/types';

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: {
  value: AgendaTaskStatus;
  label: string;
  icon: typeof Circle;
  color: string;
}[] = [
  { value: 'PENDING',     label: 'To-do',       icon: Circle,       color: '#575456' },
  { value: 'IN_PROGRESS', label: 'On Progress',  icon: PlayCircle,   color: '#3070A8' },
  { value: 'WAITING',     label: 'In Review',    icon: Clock,        color: '#907840' },
  { value: 'COMPLETED',   label: 'Completed',    icon: CheckCircle2, color: '#568177' },
];

const PRIORITY_OPTIONS: {
  value: Priority;
  label: string;
  color: string;
}[] = [
  { value: 'LOW',    label: 'Low',     color: '#9C9CAA' },
  { value: 'MEDIUM', label: 'Medium',  color: '#3070A8' },
  { value: 'HIGH',   label: 'High',    color: '#907840' },
  { value: 'URGENT', label: 'Urgent',  color: '#ED8A94' },
];

const TAG_SUGGESTIONS = [
  'Dashboard', 'ABC Dashboard', 'Twinkle Website', 'Sinen Dashboard',
  'Sosro Mobile App', 'Lumino Project', 'Nila Project',
];

const ASSIGNEE_COLORS = [
  { bg: '#D0EFE0', color: '#568177' },
  { bg: '#F9F0DB', color: '#907840' },
  { bg: '#F6F6F6', color: '#575456' },
  { bg: '#D0E0F0', color: '#3070A8' },
  { bg: '#F9E4E2', color: '#ED8A94' },
];

const COLLABORATOR_PHOTOS = [
  'https://i.pravatar.cc/32?img=12',
  'https://i.pravatar.cc/32?img=3',
  'https://i.pravatar.cc/32?img=8',
];

interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStatus?: AgendaTaskStatus;
  onSave: (data: CreateAgendaTaskInput & { status?: AgendaTaskStatus }) => Promise<void>;
  isSaving: boolean;
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
      gap: '0',
      padding: '14px 24px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        width: '130px', flexShrink: 0,
      }}>
        <Icon className="h-4 w-4 shrink-0" style={{ color: '#9C9CAA' }} />
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#575456' }}>{label}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export function CreateTaskModal({
  open,
  onOpenChange,
  defaultStatus = 'PENDING',
  onSave,
  isSaving,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('URGENT');
  const [status, setStatus] = useState<AgendaTaskStatus>(defaultStatus);
  const [dueDate, setDueDate] = useState('');
  const [category, setCategory] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [assigneeInput, setAssigneeInput] = useState('');
  const [comment, setComment] = useState('');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);

  // Sync status when defaultStatus changes
  useEffect(() => {
    if (open) {
      setStatus(defaultStatus);
      setTitle(''); setDescription(''); setPriority('URGENT');
      setDueDate(''); setCategory(''); setAssignees([]); setComment('');
      setShowTagDropdown(false); setShowStatusDropdown(false); setShowPriorityDropdown(false);
    }
  }, [defaultStatus, open]);

  // Add backdrop blur to overlay
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

  const isValid = title.trim().length > 0;
  const selectedStatus = STATUS_OPTIONS.find(s => s.value === status)!;
  const selectedPriority = PRIORITY_OPTIONS.find(p => p.value === priority)!;

  function addAssignee() {
    const name = assigneeInput.trim();
    if (name && !assignees.includes(name)) {
      setAssignees(prev => [...prev, name]);
    }
    setAssigneeInput('');
  }

  function removeAssignee(name: string) {
    setAssignees(prev => prev.filter(a => a !== name));
  }

  async function handleSave() {
    if (!isValid || isSaving) return;
    await onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate || undefined,
      category: category.trim() || undefined,
      status,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Custom keyframes — unfold from center line + content reveals L→R */}
      <style>{`
        @keyframes createTaskUnfold {
          0% {
            transform: translate(-50%, -50%) scaleY(0);
            opacity: 0;
          }
          10% {
            transform: translate(-50%, -50%) scaleY(0.006);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scaleY(1);
            opacity: 1;
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
        .create-task-modal[data-state="open"] {
          animation: createTaskUnfold 950ms cubic-bezier(.22, 1, .36, 1) both !important;
          transform-origin: center center !important;
        }
        .create-task-modal[data-state="open"] > * {
          opacity: 0;
          animation: ctmRowReveal 420ms cubic-bezier(.22, 1, .36, 1) both;
        }
        .create-task-modal[data-state="open"] > *:nth-child(1)  { animation-delay: 320ms; }
        .create-task-modal[data-state="open"] > *:nth-child(2)  { animation-delay: 370ms; }
        .create-task-modal[data-state="open"] > *:nth-child(3)  { animation-delay: 420ms; }
        .create-task-modal[data-state="open"] > *:nth-child(4)  { animation-delay: 470ms; }
        .create-task-modal[data-state="open"] > *:nth-child(5)  { animation-delay: 520ms; }
        .create-task-modal[data-state="open"] > *:nth-child(6)  { animation-delay: 570ms; }
        .create-task-modal[data-state="open"] > *:nth-child(7)  { animation-delay: 620ms; }
        .create-task-modal[data-state="open"] > *:nth-child(8)  { animation-delay: 670ms; }
        .create-task-modal[data-state="open"] > *:nth-child(9)  { animation-delay: 720ms; }
        .create-task-modal[data-state="open"] > *:nth-child(10) { animation-delay: 770ms; }
        .create-task-modal[data-state="open"] > *:nth-child(11) { animation-delay: 820ms; }
        .create-task-modal[data-state="open"] > *:nth-child(12) { animation-delay: 870ms; }
        .create-task-modal[data-state="open"] > *:nth-child(13) { animation-delay: 920ms; }
      `}</style>
      <DialogContent
        hideCloseButton
        className="create-task-modal p-0 overflow-hidden gap-0"
        style={{
          maxWidth: '520px',
          width: '100%',
          borderRadius: '20px',
          border: 'none',
          boxShadow: '0 25px 60px rgba(0,0,0,.15)',
          background: '#FFFFFF',
        }}
      >
        {/* ── Header ───────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '22px 24px 18px',
        }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#1A1A1A' }}>
            Create Task
          </span>
          <button
            onClick={() => onOpenChange(false)}
            style={{
              height: '30px', width: '30px', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#C0C0C8', background: 'transparent', border: 'none',
              cursor: 'pointer', flexShrink: 0,
              transition: 'all 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F6F6F6'; e.currentTarget.style.color = '#575456'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#C0C0C8'; }}
          >
            <X className="h-4.5 w-4.5" strokeWidth={1.5} />
          </button>
        </div>

        {/* ── Task name (clean inline input) ───────────────────────── */}
        <div style={{ padding: '0 24px 8px' }}>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Task name..."
            className="w-full outline-none"
            style={{
              fontSize: '14px', fontWeight: 500, color: '#1A1A1A',
              background: 'transparent', border: 'none',
              padding: '4px 0',
            }}
            onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }}
          />
        </div>

        <div style={{ borderTop: '1px solid #F0F0F0' }} />

        {/* ── Fields ───────────────────────────────────────────────── */}

        {/* Status */}
        <FieldRow icon={CheckCircle2} label="Status">
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowStatusDropdown(v => !v)}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid #E8E8E8',
                background: '#FFFFFF',
                cursor: 'pointer',
                fontSize: '13px', fontWeight: 500, color: '#1A1A1A',
              }}
            >
              <selectedStatus.icon className="h-3.5 w-3.5" style={{ color: selectedStatus.color }} />
              {selectedStatus.label}
            </button>
            {showStatusDropdown && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: '4px',
                background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,.10)', padding: '4px',
              }}>
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setStatus(opt.value); setShowStatusDropdown(false); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px', borderRadius: '8px', border: 'none',
                      background: status === opt.value ? '#F6F6F6' : 'transparent',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={e => { if (status !== opt.value) e.currentTarget.style.background = '#FAFAFA'; }}
                    onMouseLeave={e => { if (status !== opt.value) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <opt.icon className="h-3.5 w-3.5" style={{ color: opt.color }} />
                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#1A1A1A' }}>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </FieldRow>

        {/* Due date */}
        <FieldRow icon={CalendarDays} label="Due date">
          <input
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className="w-full outline-none"
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid #E8E8E8',
              fontSize: '13px', fontWeight: 500,
              color: dueDate ? '#1A1A1A' : '#C0C0C8',
              background: '#FFFFFF',
              cursor: 'pointer',
            }}
          />
        </FieldRow>

        {/* Assignee */}
        <FieldRow icon={Users} label="Assignee">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
            {assignees.map((name, idx) => {
              const c = ASSIGNEE_COLORS[idx % ASSIGNEE_COLORS.length];
              return (
                <span
                  key={name}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    padding: '4px 10px', borderRadius: '999px',
                    fontSize: '12px', fontWeight: 600,
                    background: c.bg, color: c.color,
                  }}
                >
                  {name}
                  <button
                    onClick={() => removeAssignee(name)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'inherit', lineHeight: 1, padding: 0, opacity: 0.6,
                      fontSize: '14px',
                    }}
                  >
                    ×
                  </button>
                </span>
              );
            })}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                value={assigneeInput}
                onChange={e => setAssigneeInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAssignee(); } }}
                placeholder={assignees.length === 0 ? 'Add assignee...' : ''}
                className="outline-none"
                style={{
                  fontSize: '12px', color: '#1A1A1A', background: 'transparent',
                  border: 'none', minWidth: '60px', maxWidth: '120px',
                }}
              />
              {!assigneeInput.trim() && (
                <button
                  onClick={() => {/* could open a people picker */}}
                  style={{
                    height: '22px', width: '22px', borderRadius: '50%',
                    background: '#F6F6F6', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Plus className="h-2.5 w-2.5" style={{ color: '#9C9CAA' }} />
                </button>
              )}
            </div>
          </div>
        </FieldRow>

        {/* Tags */}
        <FieldRow icon={Tag} label="Tags">
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowTagDropdown(v => !v)}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid #E8E8E8',
                background: '#FFFFFF',
                cursor: 'pointer',
                fontSize: '13px', fontWeight: 500,
                color: category ? '#1A1A1A' : '#C0C0C8',
              }}
            >
              <span>{category || 'Select...'}</span>
              <ChevronDown className="h-3.5 w-3.5" style={{ color: '#C0C0C8' }} />
            </button>
            {showTagDropdown && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: '4px',
                background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,.10)', padding: '4px',
                maxHeight: '200px', overflowY: 'auto',
              }}>
                {TAG_SUGGESTIONS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => { setCategory(tag); setShowTagDropdown(false); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      padding: '8px 12px', borderRadius: '8px', border: 'none',
                      background: category === tag ? '#F6F6F6' : 'transparent',
                      cursor: 'pointer', textAlign: 'left',
                      fontSize: '13px', fontWeight: 500, color: '#575456',
                    }}
                    onMouseEnter={e => { if (category !== tag) e.currentTarget.style.background = '#FAFAFA'; }}
                    onMouseLeave={e => { if (category !== tag) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </FieldRow>

        {/* Priority */}
        <FieldRow icon={Flame} label="Priority">
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowPriorityDropdown(v => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: '13px', fontWeight: 600, color: selectedPriority.color,
              }}
            >
              {selectedPriority.label}
            </button>
            {showPriorityDropdown && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: '4px',
                background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,.10)', padding: '4px', minWidth: '140px',
              }}>
                {PRIORITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setPriority(opt.value); setShowPriorityDropdown(false); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      padding: '8px 12px', borderRadius: '8px', border: 'none',
                      background: priority === opt.value ? '#F6F6F6' : 'transparent',
                      cursor: 'pointer', textAlign: 'left',
                      fontSize: '13px', fontWeight: 600, color: opt.color,
                    }}
                    onMouseEnter={e => { if (priority !== opt.value) e.currentTarget.style.background = '#FAFAFA'; }}
                    onMouseLeave={e => { if (priority !== opt.value) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </FieldRow>

        {/* Description */}
        <FieldRow icon={MessageSquareText} label="Description">
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Description"
            className="w-full outline-none"
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid #E8E8E8',
              fontSize: '13px', fontWeight: 400,
              color: '#1A1A1A',
              background: '#FFFFFF',
            }}
          />
        </FieldRow>

        {/* + Add Section */}
        <div style={{ padding: '6px 24px 2px' }}>
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 0', background: 'transparent', border: 'none',
              cursor: 'pointer', color: '#1A1A1A',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#575456'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#1A1A1A'; }}
          >
            <Plus className="h-3.5 w-3.5" />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Add Section</span>
          </button>
        </div>

        {/* ── Divider ──────────────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid #F0F0F0', margin: '6px 0' }} />

        {/* ── Comment area ─────────────────────────────────────────── */}
        <div style={{ padding: '10px 24px 14px' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            background: '#F4F4F5', borderRadius: '12px', padding: '12px 14px',
          }}>
            <img
              src="https://i.pravatar.cc/32?img=5"
              alt=""
              style={{
                height: '30px', width: '30px', borderRadius: '50%',
                flexShrink: 0, objectFit: 'cover',
              }}
            />
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Add a comment"
              rows={2}
              className="flex-1 outline-none resize-none"
              style={{
                fontSize: '13px', color: '#1A1A1A', background: 'transparent',
                border: 'none', lineHeight: 1.5, paddingTop: '4px',
              }}
            />
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px 20px',
        }}>
          {/* Collaborators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#9C9CAA' }}>Collaborators</span>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {COLLABORATOR_PHOTOS.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  style={{
                    height: '28px', width: '28px', borderRadius: '50%',
                    border: '2px solid #FFFFFF',
                    marginLeft: i > 0 ? '-8px' : '0',
                    objectFit: 'cover',
                  }}
                />
              ))}
              <button
                style={{
                  height: '28px', width: '28px', borderRadius: '50%',
                  border: '2px solid #FFFFFF', background: '#F4F4F5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginLeft: '-8px', cursor: 'pointer',
                }}
              >
                <Plus className="h-3 w-3" style={{ color: '#9C9CAA' }} />
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              style={{
                height: '38px', padding: '0 22px', borderRadius: '10px',
                border: '1px solid #E8E8E8', background: '#FFFFFF',
                fontSize: '13px', fontWeight: 600, color: '#575456',
                cursor: 'pointer', transition: 'background 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F6F6F6'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid || isSaving}
              style={{
                height: '38px', padding: '0 28px', borderRadius: '10px',
                border: 'none',
                background: isValid ? '#1A1A1A' : '#D0D0D0',
                fontSize: '13px', fontWeight: 600, color: '#FFFFFF',
                cursor: isValid ? 'pointer' : 'not-allowed',
                transition: 'background 150ms ease',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
              onMouseEnter={e => { if (isValid) e.currentTarget.style.background = '#000000'; }}
              onMouseLeave={e => { if (isValid) e.currentTarget.style.background = '#1A1A1A'; }}
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save
            </button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
