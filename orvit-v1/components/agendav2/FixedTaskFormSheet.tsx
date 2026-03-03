'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, Plus, Loader2, Repeat, Clock, User, Zap, AlignLeft, ChevronDown, Check, Paperclip } from 'lucide-react';
import { FileTypeIcon } from '@/components/ui/file-type-icon';
import { toast } from 'sonner';
import { useUsers } from '@/hooks/use-users';
import { calculateNextExecution, TaskFrequency } from '@/lib/task-scheduler';

// ── Design tokens ─────────────────────────────────────────────────────────────

const FREQ_OPTIONS = [
  { key: 'diaria',     label: 'Diaria',     short: 'D',  bg: '#EDF4F0', border: '#C2D4C8', color: '#305848', icon: '#508070' },
  { key: 'semanal',    label: 'Semanal',    short: 'S',  bg: '#EEF3F8', border: '#CCDAE8', color: '#3A5878', icon: '#5880A8' },
  { key: 'quincenal',  label: 'Quincenal',  short: 'Q',  bg: '#F5F2EA', border: '#DED5B0', color: '#685C30', icon: '#8A7840' },
  { key: 'mensual',    label: 'Mensual',    short: 'M',  bg: '#F3EFF8', border: '#D8CBE8', color: '#584878', icon: '#806898' },
  { key: 'trimestral', label: 'Trimestral', short: 'T',  bg: '#FAF0EB', border: '#E8D0C0', color: '#784838', icon: '#A86848' },
  { key: 'semestral',  label: 'Semestral',  short: 'Se', bg: '#EBF4F4', border: '#B8D8D8', color: '#305858', icon: '#508080' },
  { key: 'anual',      label: 'Anual',      short: 'A',  bg: '#F0EEF8', border: '#C8C4D8', color: '#484858', icon: '#686878' },
] as const;

const PRIORITY_OPTIONS = [
  { key: 'baja',  label: 'Baja',  bg: '#F3F4F6', text: '#6B7280', activeBg: '#6B7280', activeText: '#FFF' },
  { key: 'media', label: 'Media', bg: '#EFF6FF', text: '#1D4ED8', activeBg: '#1D4ED8', activeText: '#FFF' },
  { key: 'alta',  label: 'Alta',  bg: '#FEF3C7', text: '#D97706', activeBg: '#D97706', activeText: '#FFF' },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface FileAttachment { url: string; name: string; size: number; type: string }

interface NewFixedTaskData {
  title: string;
  description: string;
  frequency: TaskFrequency;
  assignedTo: { id: string; name: string };
  department: string;
  instructives: { id: string; title: string; content: string; attachments: FileAttachment[] }[];
  estimatedTime: number;
  priority: 'baja' | 'media' | 'alta';
  isActive: boolean;
  nextExecution: string;
  executionTime: string;
  createdAt: string;
}

interface FixedTaskFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSubmit: (taskData: NewFixedTaskData) => Promise<void>;
  frequency?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editingTask?: any;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ── Property row (icon + label + control) ─────────────────────────────────────

function PropRow({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid #F4F4F4', gap: '0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '148px', flexShrink: 0, paddingTop: '2px' }}>
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: '#9CA3AF' }} />
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#9CA3AF' }}>{label}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FixedTaskFormSheet({ isOpen, onClose, onSubmit, frequency: preselectedFreq, editingTask }: FixedTaskFormSheetProps) {
  const { users, loading: usersLoading } = useUsers();
  const formInitRef = useRef<string | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [saving, setSaving] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showFreqDropdown, setShowFreqDropdown] = useState(false);
  const [showInstForm, setShowInstForm] = useState(false);
  const [mounted, setMounted] = useState(false);
  const freqDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!showFreqDropdown) return;
    function handler(e: MouseEvent) {
      if (freqDropdownRef.current && !freqDropdownRef.current.contains(e.target as Node)) {
        setShowFreqDropdown(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFreqDropdown]);

  const [form, setForm] = useState({
    title: '',
    description: '',
    frequency: (preselectedFreq as TaskFrequency) || ('diaria' as TaskFrequency),
    assignedUserId: '',
    estimatedTime: 30,
    priority: 'media' as 'baja' | 'media' | 'alta',
    isActive: true,
    executionTime: '08:00',
  });

  const [instructives, setInstructives] = useState<{ title: string; content: string; attachments: FileAttachment[] }[]>([]);
  const [newInst, setNewInst] = useState({ title: '', content: '' });
  const [newInstFiles, setNewInstFiles] = useState<FileAttachment[]>([]);
  const instFileInputRef = useRef<HTMLInputElement>(null);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) { formInitRef.current = null; return; }
    const sessionKey = editingTask ? `edit-${editingTask.id}` : 'new';
    if (formInitRef.current === sessionKey) return;
    formInitRef.current = sessionKey;

    if (editingTask) {
      const found = users.find(u => u.id.toString() === editingTask.assignedTo?.id?.toString());
      setForm({
        title: editingTask.title || '',
        description: editingTask.description || '',
        frequency: editingTask.frequency || 'diaria',
        assignedUserId: found ? `${found.type}-${found.id}` : (editingTask.assignedTo?.id?.toString() || ''),
        estimatedTime: editingTask.estimatedTime || 30,
        priority: editingTask.priority || 'media',
        isActive: editingTask.isActive !== undefined ? editingTask.isActive : true,
        executionTime: editingTask.executionTime || '08:00',
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setInstructives((editingTask.instructives || []).map((inst: any) => ({
        title: inst.title || '', content: inst.content || '', attachments: inst.attachments || [],
      })));
    } else {
      setForm({ title: '', description: '', frequency: (preselectedFreq as TaskFrequency) || 'diaria', assignedUserId: '', estimatedTime: 30, priority: 'media', isActive: true, executionTime: '08:00' });
      setInstructives([]);
    }
    setNewInst({ title: '', content: '' });
    setNewInstFiles([]);
    setShowInstForm(false);
    setShowUserDropdown(false);
    // Auto-focus title after animation
    setTimeout(() => titleRef.current?.focus(), 280);
  }, [isOpen, editingTask, preselectedFreq, users]);

  useEffect(() => {
    if (!isOpen || !editingTask || !users.length) return;
    setForm(prev => {
      if (prev.assignedUserId) return prev;
      const found = users.find(u => u.id.toString() === editingTask.assignedTo?.id?.toString());
      return found ? { ...prev, assignedUserId: `${found.type}-${found.id}` } : prev;
    });
  }, [users, isOpen, editingTask]);

  const selectedUser = users.find(u => `${u.type}-${u.id}` === form.assignedUserId);
  const freqConf = FREQ_OPTIONS.find(f => f.key === form.frequency);

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.title.trim())       { toast.error('El título es obligatorio'); return; }
    if (!form.description.trim()) { toast.error('La descripción es obligatoria'); return; }
    if (!form.assignedUserId)     { toast.error('Asigná la tarea a un usuario'); return; }
    if (form.estimatedTime < 1)   { toast.error('El tiempo estimado debe ser mayor a 0'); return; }
    setSaving(true);
    try {
      const [h, m] = form.executionTime.split(':').map(Number);
      const base = new Date(); base.setHours(h, m, 0, 0);
      const nextExecution = calculateNextExecution(form.frequency, base);
      let assignedId = selectedUser ? selectedUser.id.toString()
        : form.assignedUserId.includes('-') ? form.assignedUserId.split('-')[1]
        : form.assignedUserId;
      await onSubmit({
        title: form.title, description: form.description, frequency: form.frequency,
        assignedTo: { id: assignedId, name: selectedUser?.name || '' },
        department: 'Administración',
        instructives: instructives.map((inst, i) => ({ id: `${Date.now()}-${i}`, ...inst })),
        estimatedTime: form.estimatedTime, priority: form.priority,
        isActive: form.isActive, nextExecution: nextExecution.toISOString(),
        executionTime: form.executionTime, createdAt: new Date().toISOString(),
      });
    } catch {
      toast.error('Error al guardar la tarea');
    } finally {
      setSaving(false);
    }
  }

  function handleInstFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const mapped: FileAttachment[] = files.map(f => ({
      name: f.name,
      url: URL.createObjectURL(f),
      size: f.size,
      type: f.type,
    }));
    setNewInstFiles(prev => [...prev, ...mapped]);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  function removeInstFile(idx: number) {
    setNewInstFiles(prev => prev.filter((_, i) => i !== idx));
  }

  function addInstructive() {
    if (!newInst.title.trim() || !newInst.content.trim()) { toast.error('El instructivo necesita título y contenido'); return; }
    setInstructives(prev => [...prev, { title: newInst.title, content: newInst.content, attachments: newInstFiles }]);
    setNewInst({ title: '', content: '' });
    setNewInstFiles([]);
    setShowInstForm(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave();
  }

  if (!isOpen || !mounted) return null;

  return createPortal(
    <>
      <style>{`
        @keyframes ftmodal-bg {
          from { opacity:0; backdrop-filter:blur(0px); }
          to   { opacity:1; backdrop-filter:blur(6px); }
        }
        @keyframes ftmodal-in {
          0%   { opacity:0; transform:scaleY(0);     filter:blur(6px); }
          10%  { opacity:1; transform:scaleY(0.006); filter:blur(4px); }
          100% { opacity:1; transform:scaleY(1);     filter:blur(0px); }
        }
        .ftmodal-title { resize:none; overflow:hidden; }
        .ftmodal-title::placeholder { color:#D0D0D8; }
        .ftmodal-input::placeholder { color:#C8C8D0; }
        .ftmodal-input:focus { border-color:#9CA3AF !important; outline:none; }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position:'fixed', inset:0, zIndex:60, background:'rgba(0,0,0,0.40)', animation:'ftmodal-bg 300ms ease both', backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)' }}
      />

      {/* Modal */}
      <div
        onKeyDown={handleKeyDown}
        style={{
          position:'fixed', inset:0, zIndex:61, display:'flex',
          alignItems:'center', justifyContent:'center', pointerEvents:'none',
        }}
      >
        <div
          style={{
            width:'800px', maxWidth:'calc(100vw - 32px)', maxHeight:'92vh',
            background:'#FFFFFF', borderRadius:'8px',
            border:'1.5px solid #D8D8DE',
            boxShadow:'0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.07)',
            display:'flex', flexDirection:'column',
            animation:'ftmodal-in 950ms cubic-bezier(.22,1,.36,1) both',
            transformOrigin:'center center',
            pointerEvents:'auto',
          }}
          onClick={e => e.stopPropagation()}
        >

          {/* ── Modal header ── */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px 10px', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:'#F0F0F0', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Repeat className="h-3.5 w-3.5" style={{ color:'#9CA3AF' }} />
              </div>
              <span style={{ fontSize:'13px', fontWeight:600, color:'#9CA3AF' }}>
                {editingTask ? 'Editar tarea fija' : 'Nueva tarea fija'}
              </span>
              {freqConf && (
                <span style={{ display:'inline-flex', alignItems:'center', gap:'4px', padding:'2px 8px', borderRadius:'6px', background:freqConf.bg, border:`1px solid ${freqConf.border}`, fontSize:'11px', fontWeight:600, color:freqConf.color }}>
                  <span style={{ width:'13px', height:'13px', borderRadius:'3px', background:freqConf.icon, color:'#FFF', fontSize:'7px', fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>{freqConf.short}</span>
                  {freqConf.label}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ height:'28px', width:'28px', borderRadius:'8px', border:'none', background:'transparent', color:'#9CA3AF', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, transition:'background 150ms ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background='#F4F4F6'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background='transparent'; }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* ── Body ── */}
          <div style={{ flex:1, overflowY:'auto', padding:'0 20px 8px' }}>

            {/* Title */}
            <textarea
              ref={titleRef}
              className="ftmodal-title"
              value={form.title}
              onChange={e => {
                setForm(p => ({ ...p, title: e.target.value }));
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              placeholder="Título de la tarea..."
              rows={1}
              style={{ width:'100%', border:'none', outline:'none', fontSize:'18px', fontWeight:600, color:'#111827', lineHeight:1.3, marginBottom:'6px', background:'transparent', fontFamily:'inherit' }}
            />

            {/* Description */}
            <textarea
              className="ftmodal-input"
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Agregar descripción..."
              rows={2}
              style={{ width:'100%', border:'none', outline:'none', fontSize:'14px', color:'#9CA3AF', lineHeight:1.6, marginBottom:'16px', background:'transparent', fontFamily:'inherit', resize:'none' }}
            />

            {/* Divider */}
            <div style={{ height:'1px', background:'#E4E4E8', margin:'0 -20px 4px' }} />

            {/* ── Property rows ── */}

            {/* Frecuencia */}
            <PropRow icon={Repeat} label="Frecuencia">
              <div ref={freqDropdownRef} style={{ position:'relative', paddingTop:'2px' }}>
                {/* Trigger */}
                <button
                  onClick={() => setShowFreqDropdown(p => !p)}
                  style={{ display:'flex', alignItems:'center', gap:'8px', height:'34px', padding:'0 10px', borderRadius:'8px', border:`1px solid ${freqConf ? freqConf.border : '#E4E4E8'}`, background: freqConf ? freqConf.bg : '#FAFAFA', cursor:'pointer', minWidth:'160px', textAlign:'left', transition:'all 100ms ease' }}
                >
                  {freqConf ? (
                    <>
                      <span style={{ width:'18px', height:'18px', borderRadius:'4px', background:freqConf.icon, color:'#FFF', fontSize:'8px', fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{freqConf.short}</span>
                      <span style={{ fontSize:'13px', fontWeight:600, color:freqConf.color, flex:1 }}>{freqConf.label}</span>
                    </>
                  ) : (
                    <span style={{ fontSize:'13px', color:'#C0C0C8', flex:1 }}>Seleccionar...</span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: freqConf ? freqConf.color : '#C0C0C8', transform: showFreqDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform 150ms ease', opacity: 0.7 }} />
                </button>

                {/* Dropdown panel */}
                {showFreqDropdown && (
                  <div style={{ position:'absolute', top:'calc(100% + 5px)', left:0, zIndex:25, background:'#FFFFFF', border:'1px solid #E4E4E8', borderRadius:'12px', boxShadow:'0 8px 28px rgba(0,0,0,.12)', overflow:'hidden', minWidth:'200px' }}>
                    {FREQ_OPTIONS.map(f => {
                      const active = form.frequency === f.key;
                      return (
                        <button
                          key={f.key}
                          onClick={() => { setForm(p => ({ ...p, frequency: f.key as TaskFrequency })); setShowFreqDropdown(false); }}
                          style={{ width:'100%', display:'flex', alignItems:'center', gap:'10px', padding:'9px 12px', background: active ? f.bg : 'transparent', border:'none', cursor:'pointer', textAlign:'left', transition:'background 80ms ease' }}
                          onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background='#F8F8F8'; }}
                          onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background='transparent'; }}
                        >
                          <span style={{ width:'22px', height:'22px', borderRadius:'5px', background: active ? f.icon : '#E8E8E8', color:'#FFF', fontSize:'8px', fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'background 80ms' }}>{f.short}</span>
                          <span style={{ fontSize:'13px', fontWeight: active ? 600 : 500, color: active ? f.color : '#374151', flex:1 }}>{f.label}</span>
                          {active && (
                            <span style={{ width:'7px', height:'7px', borderRadius:'50%', background: f.icon, flexShrink:0 }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </PropRow>

            {/* Responsable */}
            <PropRow icon={User} label="Responsable">
              <div style={{ position:'relative' }}>
                <button
                  onClick={() => setShowUserDropdown(p => !p)}
                  style={{ display:'flex', alignItems:'center', gap:'8px', padding:'5px 10px', borderRadius:'8px', border:`1px solid ${showUserDropdown ? '#9CA3AF' : '#E4E4E8'}`, background: selectedUser ? '#FAFAFA' : 'transparent', cursor:'pointer', width:'100%', textAlign:'left', transition:'all 100ms ease' }}
                >
                  {selectedUser ? (
                    <>
                      <div style={{ width:'22px', height:'22px', borderRadius:'6px', background:'#E8E8E8', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <span style={{ fontSize:'9px', fontWeight:700, color:'#374151' }}>{getInitials(selectedUser.name)}</span>
                      </div>
                      <span style={{ fontSize:'13px', fontWeight:500, color:'#111827', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selectedUser.name}</span>
                    </>
                  ) : (
                    <span style={{ fontSize:'13px', color:'#C0C0C8', flex:1 }}>Sin asignar...</span>
                  )}
                  <ChevronDown className="h-3 w-3 shrink-0" style={{ color:'#C0C0C8', transform: showUserDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform 150ms ease' }} />
                </button>

                {/* User dropdown */}
                {showUserDropdown && (
                  <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:20, background:'#FFFFFF', border:'1px solid #E4E4E8', borderRadius:'12px', boxShadow:'0 8px 24px rgba(0,0,0,.10)', overflow:'hidden', maxHeight:'220px', overflowY:'auto' }}>
                    {usersLoading ? (
                      <div style={{ padding:'12px', fontSize:'12px', color:'#9CA3AF', textAlign:'center' }}>Cargando...</div>
                    ) : users.length === 0 ? (
                      <div style={{ padding:'12px', fontSize:'12px', color:'#9CA3AF', textAlign:'center' }}>Sin usuarios</div>
                    ) : users.map(u => {
                      const key = `${u.type}-${u.id}`;
                      const sel = form.assignedUserId === key;
                      return (
                        <button
                          key={key}
                          onClick={() => { setForm(p => ({ ...p, assignedUserId: sel ? '' : key })); setShowUserDropdown(false); }}
                          style={{ width:'100%', display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', background: sel ? '#F8F8F8' : 'transparent', border:'none', cursor:'pointer', textAlign:'left', transition:'background 80ms ease' }}
                          onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLButtonElement).style.background='#F8F8F8'; }}
                          onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLButtonElement).style.background='transparent'; }}
                        >
                          <div style={{ width:'28px', height:'28px', borderRadius:'7px', background: sel ? '#111827' : '#E8E8E8', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <span style={{ fontSize:'10px', fontWeight:700, color: sel ? '#FFF' : '#374151' }}>{getInitials(u.name)}</span>
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ fontSize:'13px', fontWeight:600, color:'#111827' }}>{u.name}</p>
                            <p style={{ fontSize:'10px', color:'#9CA3AF' }}>{u.companyRole}</p>
                          </div>
                          {sel && <Check className="h-3.5 w-3.5 shrink-0" style={{ color:'#111827' }} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </PropRow>

            {/* Prioridad */}
            <PropRow icon={Zap} label="Prioridad">
              <div style={{ display:'flex', gap:'6px', paddingTop:'2px' }}>
                {PRIORITY_OPTIONS.map(opt => {
                  const active = form.priority === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setForm(p => ({ ...p, priority: opt.key as 'baja' | 'media' | 'alta' }))}
                      style={{ height:'30px', padding:'0 14px', borderRadius:'8px', border:`1px solid ${active ? 'transparent' : '#E4E4E8'}`, background: active ? opt.activeBg : opt.bg, color: active ? opt.activeText : opt.text, fontSize:'12px', fontWeight:600, cursor:'pointer', transition:'all 120ms ease' }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </PropRow>

            {/* Tiempo + Hora */}
            <PropRow icon={Clock} label="Tiempo est.">
              <div style={{ display:'flex', alignItems:'center', gap:'10px', paddingTop:'2px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <input
                    type="number" min={1} value={form.estimatedTime}
                    onChange={e => setForm(p => ({ ...p, estimatedTime: Math.max(1, parseInt(e.target.value)||1) }))}
                    style={{ width:'72px', height:'30px', padding:'0 10px', border:'1px solid #E8E8E8', borderRadius:'8px', background:'#FAFAFA', fontSize:'13px', color:'#111827', outline:'none', textAlign:'center' }}
                    className="ftmodal-input"
                  />
                  <span style={{ fontSize:'12px', color:'#9CA3AF' }}>min</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <span style={{ fontSize:'12px', color:'#C0C0C8' }}>a las</span>
                  <input
                    type="time" value={form.executionTime}
                    onChange={e => setForm(p => ({ ...p, executionTime: e.target.value }))}
                    style={{ height:'30px', padding:'0 10px', border:'1px solid #E8E8E8', borderRadius:'8px', background:'#FAFAFA', fontSize:'13px', color:'#111827', outline:'none' }}
                  />
                </div>
              </div>
            </PropRow>

            {/* Estado */}
            <PropRow icon={AlignLeft} label="Estado">
              <div style={{ display:'flex', gap:'6px', paddingTop:'2px' }}>
                {([true, false] as const).map(val => {
                  const active = form.isActive === val;
                  return (
                    <button
                      key={String(val)}
                      onClick={() => setForm(p => ({ ...p, isActive: val }))}
                      style={{ height:'30px', padding:'0 14px', borderRadius:'8px', border:`1px solid ${active ? (val ? '#C2D4C8' : '#FEE2E2') : '#E4E4E8'}`, background: active ? (val ? '#EDF4F0' : '#FEF2F2') : 'transparent', color: active ? (val ? '#508070' : '#DC2626') : '#9CA3AF', fontSize:'12px', fontWeight:600, cursor:'pointer', transition:'all 120ms ease' }}
                    >
                      {val ? '● Activa' : '○ Inactiva'}
                    </button>
                  );
                })}
              </div>
            </PropRow>

            {/* Descripción (adicional si no se usó el textarea arriba) */}
            {/* (ya cubierto por el textarea de arriba) */}

            {/* Divider */}
            <div style={{ height:'1px', background:'#E4E4E8', margin:'4px -20px 0' }} />

            {/* Instructivos */}
            <div style={{ padding:'10px 0' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: showInstForm || instructives.length > 0 ? '10px' : '0' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <FileText className="h-3.5 w-3.5" style={{ color:'#9CA3AF' }} />
                  <span style={{ fontSize:'13px', fontWeight:500, color:'#9CA3AF' }}>
                    Instructivos{instructives.length > 0 ? ` (${instructives.length})` : ''}
                  </span>
                </div>
                <button
                  onClick={() => setShowInstForm(p => !p)}
                  style={{ display:'flex', alignItems:'center', gap:'4px', height:'24px', padding:'0 9px', borderRadius:'6px', border:'1px solid #E8E8E8', background:'transparent', color:'#9CA3AF', fontSize:'11px', fontWeight:600, cursor:'pointer', transition:'all 100ms ease' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background='#F4F4F4'; (e.currentTarget as HTMLButtonElement).style.color='#6B7280'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background='transparent'; (e.currentTarget as HTMLButtonElement).style.color='#9CA3AF'; }}
                >
                  <Plus className="h-3 w-3" /> Agregar
                </button>
              </div>

              {/* Existing instructives */}
              {instructives.length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:'5px', marginBottom:'8px' }}>
                  {instructives.map((inst, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'8px', padding:'8px 10px', borderRadius:'8px', background:'#F8F8F8', border:'1px solid #EBEBEB' }}>
                      <span style={{ width:'18px', height:'18px', borderRadius:'5px', background:'#E4E4EC', color:'#9CA3AF', fontSize:'9px', fontWeight:700, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:'1px' }}>{i+1}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:'12px', fontWeight:600, color:'#111827' }}>{inst.title}</p>
                        <p className="line-clamp-2" style={{ fontSize:'11px', color:'#9CA3AF', marginTop:'1px', lineHeight:1.4 }}>{inst.content}</p>
                        {inst.attachments.length > 0 && (
                          <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginTop:'5px' }}>
                            {inst.attachments.map((att, j) => (
                              <div key={j} style={{ display:'flex', alignItems:'center', gap:'4px', padding:'2px 6px', borderRadius:'5px', background:'#EDEDF0', border:'1px solid #E0E0E8' }}>
                                <FileTypeIcon name={att.name} size={14} />
                                <span style={{ fontSize:'10px', color:'#6B7280', fontWeight:500, maxWidth:'100px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{att.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setInstructives(prev => prev.filter((_, j) => j !== i))}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'#C8C8D0', padding:'1px', flexShrink:0 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color='#DC2626'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color='#C8C8D0'; }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Inline add form */}
              <div style={{ overflow:'hidden', maxHeight: showInstForm ? '400px' : '0', transition:'max-height 250ms ease' }}>
                <div style={{ display:'flex', flexDirection:'column', gap:'7px', padding:'1px 0 8px' }}>
                  <input
                    className="ftmodal-input"
                    value={newInst.title}
                    onChange={e => setNewInst(p => ({ ...p, title: e.target.value }))}
                    placeholder="Título del instructivo..."
                    style={{ width:'100%', height:'34px', padding:'0 12px', border:'1px solid #E8E8E8', borderRadius:'8px', background:'#FAFAFA', fontSize:'12px', color:'#111827', outline:'none', boxSizing:'border-box' }}
                  />
                  <textarea
                    className="ftmodal-input"
                    value={newInst.content}
                    onChange={e => setNewInst(p => ({ ...p, content: e.target.value }))}
                    placeholder="Contenido del instructivo..."
                    rows={2}
                    style={{ width:'100%', padding:'10px 12px', border:'1px solid #E8E8E8', borderRadius:'8px', background:'#FAFAFA', fontSize:'12px', color:'#111827', outline:'none', resize:'none', boxSizing:'border-box', fontFamily:'inherit' }}
                  />

                  {/* File upload zone */}
                  <div>
                    {/* Hidden real input */}
                    <input
                      ref={instFileInputRef}
                      type="file"
                      multiple
                      style={{ display:'none' }}
                      onChange={handleInstFileChange}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.zip,.rar"
                    />
                    {/* Drop zone / click to attach */}
                    <button
                      type="button"
                      onClick={() => instFileInputRef.current?.click()}
                      style={{ width:'100%', height:'38px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', borderRadius:'8px', border:'1.5px dashed #D8D8DE', background:'#FAFAFA', color:'#9CA3AF', fontSize:'12px', fontWeight:500, cursor:'pointer', transition:'all 100ms ease' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor='#A0A0A8'; (e.currentTarget as HTMLButtonElement).style.background='#F4F4F6'; (e.currentTarget as HTMLButtonElement).style.color='#6B7280'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor='#D8D8DE'; (e.currentTarget as HTMLButtonElement).style.background='#FAFAFA'; (e.currentTarget as HTMLButtonElement).style.color='#9CA3AF'; }}
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      Adjuntar archivos
                    </button>

                    {/* Attached files list */}
                    {newInstFiles.length > 0 && (
                      <div style={{ display:'flex', flexDirection:'column', gap:'4px', marginTop:'6px' }}>
                        {newInstFiles.map((f, i) => (
                          <div key={i} style={{ display:'flex', alignItems:'center', gap:'7px', padding:'5px 8px', borderRadius:'7px', background:'#F4F4F6', border:'1px solid #EBEBEB' }}>
                            <FileTypeIcon name={f.name} size={22} />
                            <span style={{ flex:1, fontSize:'11px', fontWeight:500, color:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                            <span style={{ fontSize:'10px', color:'#C0C0C8', flexShrink:0 }}>{(f.size / 1024).toFixed(0)} KB</span>
                            <button
                              type="button"
                              onClick={() => removeInstFile(i)}
                              style={{ background:'none', border:'none', cursor:'pointer', color:'#C8C8D0', padding:'1px', flexShrink:0, display:'flex' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color='#DC2626'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color='#C8C8D0'; }}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={addInstructive} style={{ height:'30px', padding:'0 14px', borderRadius:'7px', background:'#111827', color:'#FFF', border:'none', fontSize:'12px', fontWeight:600, cursor:'pointer', transition:'background 80ms ease' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background='#222'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background='#111827'; }}
                    >Agregar</button>
                    <button onClick={() => { setShowInstForm(false); setNewInst({ title:'', content:'' }); setNewInstFiles([]); }} style={{ height:'30px', padding:'0 14px', borderRadius:'7px', background:'#F0F0F0', color:'#9CA3AF', border:'none', fontSize:'12px', fontWeight:600, cursor:'pointer' }}>Cancelar</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div style={{ padding:'14px 20px 18px', borderTop:'1px solid #E4E4E8', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <span style={{ fontSize:'11px', color:'#C0C0C8' }}>⌘ + Enter para guardar</span>
            <div style={{ display:'flex', gap:'8px' }}>
              <button
                onClick={onClose}
                style={{ height:'36px', padding:'0 18px', borderRadius:'9px', border:'1px solid #E4E4E8', background:'transparent', color:'#6B7280', fontSize:'13px', fontWeight:600, cursor:'pointer', transition:'background 100ms ease' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background='#F4F4F4'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background='transparent'; }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ height:'36px', padding:'0 20px', borderRadius:'9px', border:'none', background: saving ? '#A0A0A8' : '#111827', color:'#FFF', fontSize:'13px', fontWeight:600, cursor: saving ? 'not-allowed' : 'pointer', transition:'background 150ms ease', display:'flex', alignItems:'center', gap:'6px' }}
                onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background='#1a1a1a'; }}
                onMouseLeave={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background= saving ? '#A0A0A8' : '#111827'; }}
              >
                {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando...</> : (editingTask ? 'Guardar cambios' : 'Crear tarea fija')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
