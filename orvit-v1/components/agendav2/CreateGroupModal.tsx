'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X, Folder, Rocket, Hash, Check, Users, ChevronDown,
  Loader2, Briefcase, Code2, PenTool, Megaphone, Database,
  BarChart2, Shield, Zap,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUsers } from '@/hooks/use-users';
import { useAuth } from '@/contexts/AuthContext';

// ── Presets ──────────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  '#3070A8', // blue (default)
  '#568177', // green
  '#907840', // amber
  '#C05060', // rose
  '#7040A8', // purple
  '#E09458', // orange
  '#4A90A4', // teal
  '#6366f1', // indigo
];

const ICON_PRESETS: { icon: typeof Folder; label: string }[] = [
  { icon: Folder,    label: 'Carpeta'   },
  { icon: Rocket,    label: 'Proyecto'  },
  { icon: Briefcase, label: 'Trabajo'   },
  { icon: Code2,     label: 'Código'    },
  { icon: PenTool,   label: 'Diseño'    },
  { icon: Megaphone, label: 'Marketing' },
  { icon: Database,  label: 'Datos'     },
  { icon: BarChart2, label: 'Análisis'  },
  { icon: Shield,    label: 'Legal'     },
  { icon: Zap,       label: 'Operaciones'},
];

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateGroupInput {
  name: string;
  color: string;
  icon: string;
  description?: string;
  isProject: boolean;
  memberUserIds: number[];
}

interface CreateGroupModalProps {
  open: boolean;
  defaultIsProject?: boolean;
  companyId: number;
  onClose: () => void;
  onConfirm: (data: CreateGroupInput) => Promise<void>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CreateGroupModal({
  open,
  defaultIsProject = false,
  companyId,
  onClose,
  onConfirm,
}: CreateGroupModalProps) {
  const { user: currentUser } = useAuth();
  const { users: allUsers } = useUsers(companyId);

  const [isProject, setIsProject] = useState(defaultIsProject);
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [iconIdx, setIconIdx] = useState(0);
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberDropOpen, setMemberDropOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  // Sync defaultIsProject when prop changes
  useEffect(() => {
    if (open) {
      setIsProject(defaultIsProject);
      setName('');
      setColor(COLOR_PRESETS[0]);
      setIconIdx(defaultIsProject ? 1 : 0);
      setDescription('');
      setSelectedMembers([]);
      setMemberSearch('');
      setError('');
      setSaving(false);
      // Mount animation
      setMounted(false);
      setTimeout(() => {
        setMounted(true);
        setTimeout(() => nameRef.current?.focus(), 50);
      }, 10);
    }
  }, [open, defaultIsProject]);

  const filteredUsers = (allUsers ?? []).filter(u =>
    u.id !== currentUser?.id &&
    u.name.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const selectedUserObjs = (allUsers ?? []).filter(u => selectedMembers.includes(u.id));

  function toggleMember(userId: number) {
    setSelectedMembers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  }

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    setError('');
    try {
      await onConfirm({
        name: trimmed,
        color,
        icon: ICON_PRESETS[iconIdx].label,
        description: description.trim() || undefined,
        isProject,
        memberUserIds: selectedMembers,
      });
      onClose();
    } catch {
      setError('Error al crear. Intentá de nuevo.');
      setSaving(false);
    }
  }

  const SelectedIcon = ICON_PRESETS[iconIdx].icon;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="p-0 overflow-hidden [&>button]:hidden"
        style={{
          maxWidth: '480px',
          width: '100%',
          borderRadius: '20px',
          border: '1px solid #E4E4E4',
          boxShadow: '0 24px 60px rgba(0,0,0,.12)',
          animation: mounted ? 'cgm-in 220ms cubic-bezier(0.22,1,0.36,1)' : 'none',
        }}
      >
        <style>{`
          @keyframes cgm-in {
            from { opacity: 0; transform: scale(0.94) translateY(6px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes cgm-row-in {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .cgm-row { animation: cgm-row-in 200ms ease both; }
        `}</style>

        {/* ── Header ────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-6 pt-6 pb-5"
          style={{ borderBottom: '1px solid #F0F0F0' }}
        >
          {/* Icon preview */}
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200"
            style={{ background: `${color}18`, border: `2px solid ${color}40` }}
          >
            <SelectedIcon className="h-5 w-5" style={{ color }} />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-bold" style={{ color: '#050505' }}>
              {isProject ? 'Nuevo Proyecto' : 'Nuevo Grupo'}
            </h2>
            <p className="text-[12px]" style={{ color: '#9C9CAA' }}>
              {isProject
                ? 'Proyecto compartido con tu equipo'
                : 'Grupo de tareas personales o de empresa'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center transition-colors hover:bg-[#F0F0F0]"
            style={{ color: '#9C9CAA' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-6 space-y-5">

          {/* Type toggle */}
          <div className="cgm-row" style={{ animationDelay: '40ms' }}>
            <div
              className="flex rounded-xl p-1 gap-1"
              style={{ background: '#F0F0F0' }}
            >
              {[
                { label: 'Grupo', value: false, icon: Hash },
                { label: 'Proyecto', value: true, icon: Rocket },
              ].map(({ label, value, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => setIsProject(value)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150"
                  style={{
                    background: isProject === value ? '#FFFFFF' : 'transparent',
                    color: isProject === value ? '#050505' : '#9C9CAA',
                    boxShadow: isProject === value ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
                  }}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="cgm-row" style={{ animationDelay: '70ms' }}>
            <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#9C9CAA' }}>
              Nombre *
            </label>
            <input
              ref={nameRef}
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
              placeholder={isProject ? 'ej. Campaña Q1, App Mobile...' : 'ej. Estudio Contable, RRHH...'}
              className="w-full px-4 py-3 text-[14px] outline-none transition-all duration-150"
              style={{
                background: '#FAFAFA',
                border: error ? '1.5px solid #E05060' : '1.5px solid #E8E8E8',
                borderRadius: '12px',
                color: '#050505',
              }}
              onFocus={e => { if (!error) e.target.style.borderColor = '#3070A8'; }}
              onBlur={e => { if (!error) e.target.style.borderColor = '#E8E8E8'; }}
            />
            {error && (
              <p className="text-[11px] mt-1" style={{ color: '#E05060' }}>{error}</p>
            )}
          </div>

          {/* Color + Icon */}
          <div className="cgm-row flex gap-4" style={{ animationDelay: '100ms' }}>
            {/* Color */}
            <div className="flex-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#9C9CAA' }}>
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className="h-7 w-7 rounded-lg transition-all duration-150 active:scale-90"
                    style={{
                      background: c,
                      border: color === c ? `2px solid ${c}` : '2px solid transparent',
                      boxShadow: color === c ? `0 0 0 3px ${c}30, 0 0 0 1px ${c}` : 'none',
                      transform: color === c ? 'scale(1.15)' : 'scale(1)',
                    }}
                  >
                    {color === c && <Check className="h-3.5 w-3.5 mx-auto text-white" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Icon */}
            <div className="flex-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#9C9CAA' }}>
                Ícono
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ICON_PRESETS.map((preset, i) => {
                  const Ic = preset.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => setIconIdx(i)}
                      title={preset.label}
                      className="h-7 w-7 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90"
                      style={{
                        background: iconIdx === i ? `${color}18` : '#F0F0F0',
                        border: iconIdx === i ? `1.5px solid ${color}60` : '1.5px solid transparent',
                      }}
                    >
                      <Ic className="h-3.5 w-3.5" style={{ color: iconIdx === i ? color : '#9C9CAA' }} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="cgm-row" style={{ animationDelay: '130ms' }}>
            <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#9C9CAA' }}>
              Descripción <span style={{ color: '#C4C4C4', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="¿Para qué es este grupo?"
              rows={2}
              className="w-full px-4 py-3 text-[13px] outline-none resize-none transition-all duration-150"
              style={{
                background: '#FAFAFA',
                border: '1.5px solid #E8E8E8',
                borderRadius: '12px',
                color: '#050505',
              }}
              onFocus={e => (e.target.style.borderColor = '#3070A8')}
              onBlur={e => (e.target.style.borderColor = '#E8E8E8')}
            />
          </div>

          {/* Members (solo si isProject) */}
          <div
            className="overflow-hidden transition-all duration-250"
            style={{ maxHeight: isProject ? '400px' : '0', opacity: isProject ? 1 : 0 }}
          >
            <div className="pt-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#9C9CAA' }}>
                <Users className="h-3 w-3 inline mr-1" />
                Miembros del Proyecto
              </label>

              {/* Selected members chips */}
              {selectedUserObjs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedUserObjs.map(u => (
                    <div
                      key={u.id}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium transition-all duration-150"
                      style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
                    >
                      <Avatar className="h-4 w-4">
                        {u.avatar && <AvatarImage src={u.avatar} />}
                        <AvatarFallback style={{ fontSize: '7px', background: `${color}30` }}>
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      {u.name.split(' ')[0]}
                      <button
                        onClick={() => toggleMember(u.id)}
                        className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Member search input */}
              <div className="relative">
                <input
                  value={memberSearch}
                  onChange={e => { setMemberSearch(e.target.value); setMemberDropOpen(true); }}
                  onFocus={() => setMemberDropOpen(true)}
                  onBlur={() => setTimeout(() => setMemberDropOpen(false), 150)}
                  placeholder="Buscar miembro..."
                  className="w-full px-4 py-2.5 text-[13px] outline-none transition-all duration-150"
                  style={{
                    background: '#FAFAFA',
                    border: '1.5px solid #E8E8E8',
                    borderRadius: '10px',
                    color: '#050505',
                  }}
                  onFocusCap={e => (e.currentTarget.style.borderColor = '#3070A8')}
                  onBlurCapture={e => (e.currentTarget.style.borderColor = '#E8E8E8')}
                />

                {/* Dropdown */}
                {memberDropOpen && filteredUsers.length > 0 && (
                  <div
                    className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-10"
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E4E4E4',
                      boxShadow: '0 8px 24px rgba(0,0,0,.10)',
                      animation: 'cgm-in 120ms ease',
                    }}
                  >
                    <div className="max-h-[160px] overflow-y-auto py-1">
                      {filteredUsers.map(u => {
                        const selected = selectedMembers.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            onMouseDown={() => toggleMember(u.id)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                            style={{ background: selected ? `${color}08` : 'transparent' }}
                            onMouseEnter={e => (e.currentTarget.style.background = `${color}08`)}
                            onMouseLeave={e => (e.currentTarget.style.background = selected ? `${color}08` : 'transparent')}
                          >
                            <Avatar className="h-7 w-7 shrink-0">
                              {u.avatar && <AvatarImage src={u.avatar} />}
                              <AvatarFallback style={{ fontSize: '10px', background: '#D0E0F0', color: '#3070A8' }}>
                                {getInitials(u.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium truncate" style={{ color: '#050505' }}>{u.name}</p>
                              {u.email && <p className="text-[11px] truncate" style={{ color: '#9C9CAA' }}>{u.email}</p>}
                            </div>
                            {selected && (
                              <Check className="h-4 w-4 shrink-0" style={{ color }} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Preview strip ──────────────────────────────────── */}
          {name.trim() && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200"
              style={{ background: '#F6F6F6', border: '1px solid #EEEEEE' }}
            >
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${color}20` }}
              >
                <SelectedIcon className="h-4 w-4" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: '#050505' }}>
                  {name.trim()}
                </p>
                <p className="text-[11px]" style={{ color: '#9C9CAA' }}>
                  {isProject
                    ? `Proyecto · ${selectedMembers.length + 1} miembro${selectedMembers.length !== 0 ? 's' : ''}`
                    : 'Grupo de tareas'}
                </p>
              </div>
              <div
                className="h-2 w-2 rounded-full shrink-0"
                style={{ background: color }}
              />
            </div>
          )}

          {/* ── Footer buttons ─────────────────────────────────── */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 h-11 rounded-xl text-[14px] font-semibold transition-all duration-150 active:scale-[0.97]"
              style={{ background: '#F0F0F0', color: '#575456' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#E8E8E8')}
              onMouseLeave={e => (e.currentTarget.style.background = '#F0F0F0')}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !name.trim()}
              className="flex-1 h-11 rounded-xl text-[14px] font-semibold text-white flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
              style={{ background: color, boxShadow: `0 2px 8px ${color}40` }}
              onMouseEnter={e => { if (!saving && name.trim()) e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {isProject ? <Rocket className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
                  Crear {isProject ? 'Proyecto' : 'Grupo'}
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
