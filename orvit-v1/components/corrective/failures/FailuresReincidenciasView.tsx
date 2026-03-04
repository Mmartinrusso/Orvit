'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Wrench,
  TrendingUp,
  Clock,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { format, formatDistanceToNow, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface FailureOccurrence {
  id: number;
  title: string;
  status: string;
  priority: string;
  reportedAt: string;
  resolvedAt?: string;
  causedDowntime: boolean;
  machine?: { id: number; name: string; code?: string };
  subcomponent?: { id: number; name: string };
  failureId?: number;
}

interface RecurrenceGroup {
  key: string;
  machineId: number;
  machineName: string;
  machineCode?: string;
  subcomponentId?: number;
  subcomponentName?: string;
  occurrences: FailureOccurrence[];
  totalCount: number;
  openCount: number;
  lastOccurrence: string;
  avgDaysBetween: number;
  totalDowntimes: number;
  workOrdersCreated: number;
  uniqueWorkOrderIds: Set<number>;
}

type TimeWindow = '30' | '60' | '90' | '180' | '365';

interface FailuresReincidenciasViewProps {
  onSelectFailure?: (failureId: number) => void;
  className?: string;
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'OPEN': return 'Abierta';
    case 'REPORTED': return 'Reportada';
    case 'IN_PROGRESS': return 'En Proceso';
    case 'RESOLVED': return 'Resuelta';
    default: return status;
  }
};

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'OPEN':
    case 'REPORTED':
      return { color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' };
    case 'IN_PROGRESS':
      return { color: '#F59E0B', bg: '#FEF3C7', border: '#FDE68A' };
    case 'RESOLVED':
      return { color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0' };
    default:
      return { color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' };
  }
};

const getSeverityColor = (count: number) => {
  if (count >= 10) return '#EF4444';
  if (count >= 5) return '#F59E0B';
  return '#3B82F6';
};

export function FailuresReincidenciasView({
  onSelectFailure,
  className,
}: FailuresReincidenciasViewProps) {
  const { currentCompany } = useCompany();
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('30');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [minOccurrences, setMinOccurrences] = useState<string>('2');

  const { data: failures = [], isLoading, error, refetch } = useQuery({
    queryKey: ['failures-reincidencias', currentCompany?.id, timeWindow],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const dateFrom = subDays(new Date(), parseInt(timeWindow)).toISOString();
      const res = await fetch(
        `/api/failure-occurrences?companyId=${currentCompany.id}&dateFrom=${dateFrom}&take=500`
      );
      if (!res.ok) throw new Error('Error al cargar fallas');
      const data = await res.json();
      return data.data || data || [];
    },
    enabled: !!currentCompany?.id,
  });

  const recurrenceGroups = useMemo(() => {
    const groups = new Map<string, RecurrenceGroup>();

    failures.forEach((failure: FailureOccurrence) => {
      if (!failure.machine) return;

      const key = failure.subcomponent
        ? `${failure.machine.id}-${failure.subcomponent.id}`
        : `${failure.machine.id}-0`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          machineId: failure.machine.id,
          machineName: failure.machine.name,
          machineCode: failure.machine.code,
          subcomponentId: failure.subcomponent?.id,
          subcomponentName: failure.subcomponent?.name,
          occurrences: [],
          totalCount: 0,
          openCount: 0,
          lastOccurrence: failure.reportedAt,
          avgDaysBetween: 0,
          totalDowntimes: 0,
          workOrdersCreated: 0,
          uniqueWorkOrderIds: new Set<number>(),
        });
      }

      const group = groups.get(key)!;
      group.occurrences.push(failure);
      group.totalCount++;

      if (failure.status === 'OPEN' || failure.status === 'IN_PROGRESS') {
        group.openCount++;
      }
      if (failure.causedDowntime) {
        group.totalDowntimes++;
      }
      if (failure.failureId) {
        group.uniqueWorkOrderIds.add(failure.failureId);
      }
      if (new Date(failure.reportedAt) > new Date(group.lastOccurrence)) {
        group.lastOccurrence = failure.reportedAt;
      }
    });

    groups.forEach((group) => {
      group.workOrdersCreated = group.uniqueWorkOrderIds.size;
    });

    groups.forEach((group) => {
      if (group.occurrences.length > 1) {
        const sorted = group.occurrences
          .map((o) => new Date(o.reportedAt).getTime())
          .sort((a, b) => a - b);

        let totalDays = 0;
        for (let i = 1; i < sorted.length; i++) {
          totalDays += (sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24);
        }
        group.avgDaysBetween = Math.round(totalDays / (sorted.length - 1));
      }
    });

    return Array.from(groups.values())
      .filter((g) => g.totalCount >= parseInt(minOccurrences))
      .sort((a, b) => b.totalCount - a.totalCount);
  }, [failures, minOccurrences]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const stats = useMemo(() => ({
    totalGroups: recurrenceGroups.length,
    totalOccurrences: recurrenceGroups.reduce((sum, g) => sum + g.totalCount, 0),
    openIssues: recurrenceGroups.reduce((sum, g) => sum + g.openCount, 0),
    criticalGroups: recurrenceGroups.filter(g => g.totalCount >= 5).length,
  }), [recurrenceGroups]);

  if (isLoading) {
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ width: 200, height: 34, borderRadius: 7, background: '#F0F0F4' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 140, height: 34, borderRadius: 7, background: '#F0F0F4' }} />
            <div style={{ width: 110, height: 34, borderRadius: 7, background: '#F0F0F4' }} />
          </div>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 80, borderRadius: 8, background: '#F8F8FA', border: '1px solid #E4E4E8' }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={className} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        padding: 40, background: '#FFFFFF', borderRadius: 8, border: '1.5px solid #E4E4E8',
      }}>
        <AlertCircle style={{ width: 40, height: 40, color: '#EF4444' }} />
        <span style={{ fontSize: 14, color: '#EF4444', fontWeight: 500 }}>Error al cargar reincidencias</span>
        <button
          onClick={() => refetch()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', fontSize: 13, fontWeight: 500,
            background: '#FFFFFF', border: '1.5px solid #E4E4E8', borderRadius: 7,
            cursor: 'pointer', color: '#374151',
          }}
        >
          <RefreshCw style={{ width: 14, height: 14 }} />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Filters toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <StatBadge
            icon={<TrendingUp style={{ width: 12, height: 12 }} />}
            text={`${stats.totalGroups} grupos`}
          />
          <StatBadge text={`${stats.totalOccurrences} ocurrencias`} />
          {stats.openIssues > 0 && (
            <StatBadge
              icon={<AlertCircle style={{ width: 12, height: 12 }} />}
              text={`${stats.openIssues} abiertas`}
              color="#F59E0B"
            />
          )}
          {stats.criticalGroups > 0 && (
            <StatBadge
              icon={<AlertTriangle style={{ width: 12, height: 12 }} />}
              text={`${stats.criticalGroups} críticos`}
              color="#EF4444"
            />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value as TimeWindow)}
            style={{
              height: 34, padding: '0 10px', fontSize: 12, fontWeight: 500,
              background: '#FAFAFA', border: '1.5px solid #E4E4E8', borderRadius: 7,
              color: '#374151', cursor: 'pointer', outline: 'none',
              appearance: 'none', WebkitAppearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 10px center',
              paddingRight: 28,
            }}
          >
            <option value="30">Últimos 30 días</option>
            <option value="60">Últimos 60 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="180">Últimos 6 meses</option>
            <option value="365">Último año</option>
          </select>

          <select
            value={minOccurrences}
            onChange={(e) => setMinOccurrences(e.target.value)}
            style={{
              height: 34, padding: '0 10px', fontSize: 12, fontWeight: 500,
              background: '#FAFAFA', border: '1.5px solid #E4E4E8', borderRadius: 7,
              color: '#374151', cursor: 'pointer', outline: 'none',
              appearance: 'none', WebkitAppearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239CA3AF' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 10px center',
              paddingRight: 28,
            }}
          >
            <option value="2">2+ veces</option>
            <option value="3">3+ veces</option>
            <option value="5">5+ veces</option>
            <option value="10">10+ veces</option>
          </select>

          <button
            onClick={() => refetch()}
            style={{
              width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#FAFAFA', border: '1.5px solid #E4E4E8', borderRadius: 7,
              cursor: 'pointer', color: '#9CA3AF', transition: 'all 150ms',
            }}
            title="Actualizar"
          >
            <RefreshCw style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>

      {/* Groups list */}
      {recurrenceGroups.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          padding: '48px 24px', textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TrendingUp style={{ width: 24, height: 24, color: '#9CA3AF' }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Sin reincidencias detectadas
            </div>
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>
              No hay fallas repetidas en el período seleccionado
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recurrenceGroups.map((group) => (
            <RecurrenceGroupCard
              key={group.key}
              group={group}
              isExpanded={expandedGroups.has(group.key)}
              onToggle={() => toggleGroup(group.key)}
              onSelectFailure={onSelectFailure}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatBadge({ icon, text, color }: { icon?: React.ReactNode; text: string; color?: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', fontSize: 11, fontWeight: 500,
      color: color || '#6B7280',
      background: color ? `${color}10` : '#F3F4F6',
      border: `1px solid ${color ? `${color}30` : '#E5E7EB'}`,
      borderRadius: 20, whiteSpace: 'nowrap',
    }}>
      {icon}
      {text}
    </span>
  );
}

interface RecurrenceGroupCardProps {
  group: RecurrenceGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectFailure?: (failureId: number) => void;
}

function RecurrenceGroupCard({
  group,
  isExpanded,
  onToggle,
  onSelectFailure,
}: RecurrenceGroupCardProps) {
  const severityColor = getSeverityColor(group.totalCount);

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1.5px solid #E4E4E8',
      borderLeft: `3px solid ${severityColor}`,
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      {/* Header - clickable */}
      <div
        onClick={onToggle}
        style={{
          padding: '14px 16px',
          cursor: 'pointer',
          transition: 'background 150ms',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#FAFAFA'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isExpanded
              ? <ChevronDown style={{ width: 14, height: 14, color: '#9CA3AF', flexShrink: 0 }} />
              : <ChevronRight style={{ width: 14, height: 14, color: '#9CA3AF', flexShrink: 0 }} />
            }
            <Wrench style={{ width: 14, height: 14, color: '#9CA3AF', flexShrink: 0 }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                  {group.machineName}
                </span>
                {group.machineCode && (
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                    ({group.machineCode})
                  </span>
                )}
              </div>
              {group.subcomponentName && (
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                  Componente: {group.subcomponentName}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              padding: '3px 10px', fontSize: 12, fontWeight: 700,
              color: group.totalCount >= 5 ? '#FFFFFF' : severityColor,
              background: group.totalCount >= 5 ? severityColor : `${severityColor}15`,
              borderRadius: 5,
            }}>
              {group.totalCount}x
            </span>

            {group.openCount > 0 && (
              <span style={{
                padding: '3px 8px', fontSize: 10, fontWeight: 600,
                color: '#F59E0B', background: '#FEF3C7',
                border: '1px solid #FDE68A', borderRadius: 5,
              }}>
                {group.openCount} abiertas
              </span>
            )}

            {group.totalDowntimes > 0 && (
              <span style={{
                padding: '3px 8px', fontSize: 10, fontWeight: 600,
                color: '#EF4444', background: '#FEF2F2',
                border: '1px solid #FECACA', borderRadius: 5,
              }}>
                {group.totalDowntimes} paradas
              </span>
            )}
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          marginTop: 8, marginLeft: 38, fontSize: 11, color: '#9CA3AF',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock style={{ width: 11, height: 11 }} />
            Última: {formatDistanceToNow(new Date(group.lastOccurrence), { addSuffix: true, locale: es })}
          </span>
          {group.avgDaysBetween > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <TrendingUp style={{ width: 11, height: 11 }} />
              Promedio: cada {group.avgDaysBetween} días
            </span>
          )}
          <span>{group.workOrdersCreated} OTs generadas</span>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div style={{
          padding: '0 16px 14px',
          borderTop: '1px solid #F0F0F4',
        }}>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 4,
            marginLeft: 38, marginTop: 12,
            maxHeight: 280, overflowY: 'auto',
          }}>
            {group.occurrences
              .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime())
              .map((occ) => {
                const statusStyle = getStatusStyle(occ.status);
                return (
                  <div
                    key={occ.id}
                    onClick={() => onSelectFailure?.(occ.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', borderRadius: 6,
                      background: '#FAFAFA', border: '1px solid #F0F0F4',
                      cursor: 'pointer', transition: 'all 150ms',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#F0F0F4';
                      e.currentTarget.style.borderColor = '#E4E4E8';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#FAFAFA';
                      e.currentTarget.style.borderColor = '#F0F0F4';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        padding: '2px 7px', fontSize: 10, fontWeight: 600,
                        color: statusStyle.color, background: statusStyle.bg,
                        border: `1px solid ${statusStyle.border}`,
                        borderRadius: 4,
                      }}>
                        {getStatusLabel(occ.status)}
                      </span>
                      <span style={{
                        fontSize: 12, fontWeight: 500, color: '#374151',
                        maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {occ.title || `Falla #${occ.id}`}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {occ.causedDowntime && (
                        <span style={{
                          padding: '2px 6px', fontSize: 9, fontWeight: 600,
                          color: '#EF4444', background: '#FEF2F2',
                          borderRadius: 3, textTransform: 'uppercase',
                        }}>
                          Parada
                        </span>
                      )}
                      {occ.failureId && (
                        <span style={{
                          padding: '2px 6px', fontSize: 10, fontWeight: 500,
                          color: '#6B7280', background: '#F3F4F6',
                          borderRadius: 3,
                        }}>
                          OT #{occ.failureId}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {format(new Date(occ.reportedAt), 'dd/MM/yy HH:mm', { locale: es })}
                      </span>
                      <Eye style={{ width: 13, height: 13, color: '#C4C4CC' }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

export default FailuresReincidenciasView;
