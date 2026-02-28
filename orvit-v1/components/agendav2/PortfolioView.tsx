'use client';

import { useMemo, useState } from 'react';
import { Users, Plus, MoreHorizontal, CheckCircle2, Clock, Circle, ChevronRight, Briefcase } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import type { AgendaTask } from '@/lib/agenda/types';
import type { TaskGroupItem } from './AgendaV2Sidebar';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

const STATUS_COLORS = {
  PENDING:     '#E8E8E8',
  IN_PROGRESS: '#D0E0F0',
  WAITING:     '#F9F0DB',
  COMPLETED:   '#D0EFE0',
  CANCELLED:   '#F9E4E2',
};

const STATUS_FG = {
  PENDING:     '#9C9CAA',
  IN_PROGRESS: '#3070A8',
  WAITING:     '#907840',
  COMPLETED:   '#568177',
  CANCELLED:   '#C05060',
};

// ── MiniDonut ─────────────────────────────────────────────────────────────────

function MiniDonut({ pct, color }: { pct: number; color: string }) {
  const data = [
    { value: pct,       fill: color },
    { value: 100 - pct, fill: '#F0F0F0' },
  ];
  return (
    <ResponsiveContainer width={56} height={56}>
      <RadialBarChart
        cx="50%" cy="50%"
        innerRadius="60%" outerRadius="90%"
        startAngle={90} endAngle={-270}
        data={data}
        barSize={6}
      >
        <RadialBar dataKey="value" cornerRadius={3} />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

// ── ProjectCard ───────────────────────────────────────────────────────────────

function ProjectCard({
  group,
  tasks,
  onClick,
}: {
  group: TaskGroupItem;
  tasks: AgendaTask[];
  onClick: () => void;
}) {
  const total     = tasks.length;
  const completed = tasks.filter(t => t.status === 'COMPLETED').length;
  const inProg    = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const pending   = tasks.filter(t => t.status === 'PENDING').length;
  const overdue   = tasks.filter(t => {
    if (!t.dueDate || t.status === 'COMPLETED' || t.status === 'CANCELLED') return false;
    return new Date(t.dueDate) < new Date();
  }).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#FFFFFF',
        border: `1.5px solid ${hovered ? group.color + '50' : '#EEEEEE'}`,
        borderRadius: '18px',
        padding: '20px',
        cursor: 'pointer',
        transition: 'all 200ms cubic-bezier(0.22,1,0.36,1)',
        boxShadow: hovered ? `0 8px 24px ${group.color}18` : '0 1px 3px rgba(0,0,0,.04)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          {/* Color icon */}
          <div
            style={{
              width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
              background: `${group.color}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `1.5px solid ${group.color}30`,
            }}
          >
            <Briefcase className="h-4.5 w-4.5" style={{ color: group.color }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#050505', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {group.name}
            </p>
            <p style={{ fontSize: '11px', color: '#9C9CAA', marginTop: '1px' }}>
              {total} tarea{total !== 1 ? 's' : ''}
              {overdue > 0 && (
                <span style={{ color: '#C05060', fontWeight: 600 }}> · {overdue} vencida{overdue !== 1 ? 's' : ''}</span>
              )}
            </p>
          </div>
        </div>

        <button
          onClick={e => e.stopPropagation()}
          style={{
            width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: 'pointer', color: '#9C9CAA',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F0F0F0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Mini donut */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <MiniDonut pct={pct} color={group.color} />
          <div
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 800, color: group.color }}>{pct}%</span>
          </div>
        </div>

        {/* Status breakdown */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {[
            { label: 'Completadas', count: completed, color: '#568177' },
            { label: 'En progreso',  count: inProg,    color: '#3070A8' },
            { label: 'Pendientes',  count: pending,   color: '#9C9CAA' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: item.color, flexShrink: 0,
                }}
              />
              <span style={{ fontSize: '10px', color: '#9C9CAA', flex: 1 }}>{item.label}</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#575456' }}>{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ height: '5px', background: '#F0F0F0', borderRadius: '999px', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%', width: `${pct}%`, background: group.color,
              borderRadius: '999px', transition: 'width 600ms ease',
            }}
          />
        </div>
      </div>

      {/* Members + action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Member avatars */}
        {group.members.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {group.members.slice(0, 4).map((m, i) => (
              <Avatar
                key={m.userId}
                className="h-6 w-6 border-2 border-white"
                style={{ marginLeft: i === 0 ? 0 : '-6px', zIndex: group.members.length - i }}
              >
                {m.user.avatar && <AvatarImage src={m.user.avatar} />}
                <AvatarFallback style={{ fontSize: '8px', background: `${group.color}30`, color: group.color }}>
                  {getInitials(m.user.name)}
                </AvatarFallback>
              </Avatar>
            ))}
            {group.members.length > 4 && (
              <div
                style={{
                  marginLeft: '-6px', width: '24px', height: '24px', borderRadius: '50%',
                  background: '#F0F0F0', border: '2px solid #FFFFFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '8px', fontWeight: 700, color: '#9C9CAA',
                }}
              >
                +{group.members.length - 4}
              </div>
            )}
            <span style={{ marginLeft: '6px', fontSize: '10px', color: '#9C9CAA' }}>
              {group.members.length} miembro{group.members.length !== 1 ? 's' : ''}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Users className="h-3.5 w-3.5" style={{ color: '#D0D0D8' }} />
            <span style={{ fontSize: '10px', color: '#D0D0D8' }}>Sin miembros</span>
          </div>
        )}

        {/* Arrow */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '2px',
            fontSize: '11px', color: group.color, fontWeight: 600,
            opacity: hovered ? 1 : 0,
            transition: 'opacity 150ms ease',
          }}
        >
          Ver tareas
          <ChevronRight className="h-3 w-3" />
        </div>
      </div>
    </div>
  );
}

// ── SimpleGroupCard (for non-project groups) ──────────────────────────────────

function SimpleGroupCard({
  group,
  tasks,
  onClick,
}: {
  group: TaskGroupItem;
  tasks: AgendaTask[];
  onClick: () => void;
}) {
  const completed = tasks.filter(t => t.status === 'COMPLETED').length;
  const total     = tasks.length;
  const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left',
        background: '#FAFAFA', border: '1px solid #EEEEEE',
        borderRadius: '12px', padding: '14px 16px',
        cursor: 'pointer', transition: 'all 150ms ease',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#F5F5F5'; e.currentTarget.style.borderColor = '#E0E0E0'; }}
      onMouseLeave={e => { e.currentTarget.style.background = '#FAFAFA'; e.currentTarget.style.borderColor = '#EEEEEE'; }}
    >
      <span
        style={{
          width: '10px', height: '10px', borderRadius: '50%',
          background: group.color, flexShrink: 0,
        }}
      />
      <span style={{ fontSize: '13px', fontWeight: 600, color: '#050505', flex: 1 }}>{group.name}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '60px', height: '4px', background: '#EEEEEE', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: group.color, borderRadius: '999px' }} />
        </div>
        <span style={{ fontSize: '11px', color: '#9C9CAA', minWidth: '28px', textAlign: 'right' }}>{total}</span>
      </div>
      <ChevronRight className="h-3.5 w-3.5" style={{ color: '#D0D0D8' }} />
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface PortfolioViewProps {
  groups: TaskGroupItem[];
  tasks: AgendaTask[];
  onSelectGroup: (id: number) => void;
  onCreateGroup: (isProject: boolean) => void;
  loadingGroups?: boolean;
}

export function PortfolioView({
  groups,
  tasks,
  onSelectGroup,
  onCreateGroup,
  loadingGroups,
}: PortfolioViewProps) {
  const projects     = groups.filter(g => g.isProject);
  const simpleGroups = groups.filter(g => !g.isProject);

  function tasksForGroup(groupId: number): AgendaTask[] {
    return tasks.filter(t => t.groupId === groupId);
  }

  if (loadingGroups) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              height: '220px', borderRadius: '18px',
              background: '#F0F0F0', animation: 'pulse 1.5s infinite',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── Projects ──────────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#050505' }}>Proyectos</h2>
            <p style={{ fontSize: '12px', color: '#9C9CAA', marginTop: '2px' }}>
              {projects.length} proyecto{projects.length !== 1 ? 's' : ''} activo{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => onCreateGroup(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 600,
              background: '#050505', color: '#FFFFFF', border: 'none', cursor: 'pointer',
              transition: 'opacity 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo proyecto
          </button>
        </div>

        {projects.length === 0 ? (
          <div
            style={{
              background: '#FAFAFA', border: '1.5px dashed #E0E0E0',
              borderRadius: '18px', padding: '48px 24px', textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '56px', height: '56px', borderRadius: '16px',
                background: '#F0F0F0', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 16px',
              }}
            >
              <Briefcase className="h-6 w-6" style={{ color: '#C8C8D0' }} />
            </div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#575456' }}>Sin proyectos aún</p>
            <p style={{ fontSize: '11px', color: '#9C9CAA', marginTop: '4px', marginBottom: '16px' }}>
              Creá tu primer proyecto para colaborar con tu equipo
            </p>
            <button
              onClick={() => onCreateGroup(true)}
              style={{
                padding: '9px 20px', borderRadius: '10px', fontSize: '12px', fontWeight: 600,
                background: '#050505', color: '#FFFFFF', border: 'none', cursor: 'pointer',
              }}
            >
              + Crear proyecto
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {projects.map(group => (
              <ProjectCard
                key={group.id}
                group={group}
                tasks={tasksForGroup(group.id)}
                onClick={() => onSelectGroup(group.id)}
              />
            ))}
            {/* New project card */}
            <button
              onClick={() => onCreateGroup(true)}
              style={{
                background: 'transparent', border: '1.5px dashed #E0E0E0',
                borderRadius: '18px', padding: '20px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '8px', minHeight: '180px', transition: 'all 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#C0C0C8'; e.currentTarget.style.background = '#FAFAFA'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E0E0E0'; e.currentTarget.style.background = 'transparent'; }}
            >
              <div
                style={{
                  width: '40px', height: '40px', borderRadius: '12px',
                  background: '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Plus className="h-5 w-5" style={{ color: '#9C9CAA' }} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#9C9CAA' }}>Nuevo proyecto</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Groups ────────────────────────────────────────────────── */}
      {simpleGroups.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#050505' }}>Grupos</h2>
            <button
              onClick={() => onCreateGroup(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
                background: '#F0F0F0', color: '#575456', border: 'none', cursor: 'pointer',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#E8E8E8'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F0F0F0'; }}
            >
              <Plus className="h-3 w-3" />
              Nuevo grupo
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {simpleGroups.map(group => (
              <SimpleGroupCard
                key={group.id}
                group={group}
                tasks={tasksForGroup(group.id)}
                onClick={() => onSelectGroup(group.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state when no groups at all */}
      {groups.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p style={{ fontSize: '13px', color: '#9C9CAA' }}>
            Creá grupos y proyectos desde el sidebar para verlos aquí
          </p>
        </div>
      )}
    </div>
  );
}
