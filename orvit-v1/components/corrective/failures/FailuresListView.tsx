'use client';

import React, { useMemo, useState } from 'react';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar,
  MessageCircle,
  FileText,
  Zap,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Settings2,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  statusConfig,
  priorityConfig,
  formatPriority,
} from './FailureCard';
import type { FailureOccurrence } from './FailureCard';

/* ─── Props ─── */

interface FailuresListViewProps {
  failures: FailureOccurrence[];
  isLoading?: boolean;
  onSelectFailure?: (id: number) => void;
}

/* ─── Constants ─── */

const priorityDotColors: Record<string, string> = {
  P1: '#DC2626',
  P2: '#D97706',
  P3: '#7C3AED',
  P4: '#9CA3AF',
  URGENT: '#DC2626',
  HIGH: '#D97706',
  MEDIUM: '#7C3AED',
  LOW: '#9CA3AF',
};

type SortField = 'priority' | 'title' | 'status' | 'reportedAt' | 'machine';
type SortDir = 'asc' | 'desc';

const priorityOrder: Record<string, number> = { P1: 1, P2: 2, P3: 3, P4: 4, URGENT: 1, HIGH: 2, MEDIUM: 3, LOW: 4 };
const statusOrder: Record<string, number> = { REPORTED: 1, OPEN: 2, IN_PROGRESS: 3, RESOLVED: 4, CANCELLED: 5 };

/* ─── Helpers ─── */

function getInitials(name?: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function isOverdue(f: FailureOccurrence): boolean {
  if (f.status === 'RESOLVED' || f.status === 'CANCELLED') return false;
  const reported = new Date(f.reportedAt);
  return differenceInDays(new Date(), reported) > 7;
}

/* ─── Component ─── */

export function FailuresListView({
  failures,
  isLoading = false,
  onSelectFailure,
}: FailuresListViewProps) {
  const [sortField, setSortField] = useState<SortField>('reportedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'reportedAt' ? 'desc' : 'asc');
    }
  };

  const sorted = useMemo(
    () =>
      [...failures].sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
          case 'priority':
            cmp = (priorityOrder[a.priority] || 5) - (priorityOrder[b.priority] || 5);
            break;
          case 'title':
            cmp = (a.title || '').localeCompare(b.title || '', 'es');
            break;
          case 'status':
            cmp = (statusOrder[a.status] || 5) - (statusOrder[b.status] || 5);
            break;
          case 'reportedAt':
            cmp = new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime();
            break;
          case 'machine':
            cmp = (a.machine?.name || '').localeCompare(b.machine?.name || '', 'es');
            break;
        }
        return sortDir === 'asc' ? cmp : -cmp;
      }),
    [failures, sortField, sortDir],
  );

  if (isLoading) {
    return (
      <div style={{ padding: 0 }}>
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-none border-b" />
        ))}
      </div>
    );
  }

  if (failures.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '60px 20px', textAlign: 'center',
      }}>
        <Settings2 style={{ width: 32, height: 32, color: '#9CA3AF', marginBottom: 12 }} />
        <p style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 4 }}>
          Sin incidentes
        </p>
        <p style={{ fontSize: 12, color: '#9CA3AF' }}>
          No se encontraron incidentes con los filtros actuales
        </p>
      </div>
    );
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    const style = { width: 10, height: 10, marginLeft: 4 };
    if (sortField !== field) return <ArrowUpDown style={{ ...style, color: '#D1D5DB' }} />;
    return sortDir === 'asc'
      ? <ArrowUp style={{ ...style, color: '#111827' }} />
      : <ArrowDown style={{ ...style, color: '#111827' }} />;
  };

  return (
    <>
      <style>{`
        @keyframes inc-list-fade {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .inc-list-row {
          animation: inc-list-fade 320ms cubic-bezier(0.22,1,0.36,1) both;
        }
        .inc-list-row:hover { background: #FAFBFC !important; }
      `}</style>

      <div style={{ padding: 0, fontSize: 13 }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 3fr) 130px 110px 150px minmax(120px, 1.2fr) 160px',
          borderBottom: '1.5px solid #E4E4E8',
        }}>
          {[
            { label: 'Incidente', field: 'title' as SortField },
            { label: 'Estado', field: 'status' as SortField },
            { label: 'Prioridad', field: 'priority' as SortField },
            { label: 'Reportada', field: 'reportedAt' as SortField },
            { label: 'Máquina', field: 'machine' as SortField },
            { label: 'Reportado por', field: null },
          ].map((col) => (
            <div
              key={col.label}
              onClick={col.field ? () => toggleSort(col.field!) : undefined}
              style={{
                padding: '10px 16px',
                fontSize: 10,
                fontWeight: 600,
                color: '#9CA3AF',
                whiteSpace: 'nowrap',
                background: '#F8F8FA',
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
                display: 'flex',
                alignItems: 'center',
                cursor: col.field ? 'pointer' : 'default',
                userSelect: 'none' as const,
              }}
            >
              {col.label}
              {col.field && <SortIcon field={col.field} />}
            </div>
          ))}
        </div>

        {/* Rows */}
        {sorted.map((f, idx) => {
          const sInfo = statusConfig[f.status] || statusConfig.OPEN;
          const dp = formatPriority(f.priority);
          const pInfo = priorityConfig[f.priority] || priorityConfig[dp] || priorityConfig.P3;
          const dotColor = priorityDotColors[f.priority] || priorityDotColors[dp] || '#9CA3AF';
          const reported = new Date(f.reportedAt);
          const overdue = isOverdue(f);
          const reporterName = f.reportedBy?.name || f.reporter?.name;
          const hasWorkOrder = f.workOrder?.id || (f.workOrders && f.workOrders.length > 0);
          const woId = f.workOrder?.id || f.workOrders?.[0]?.id;

          return (
            <div
              key={f.id}
              className="inc-list-row"
              onClick={() => onSelectFailure?.(f.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(280px, 3fr) 130px 110px 150px minmax(120px, 1.2fr) 160px',
                alignItems: 'center',
                borderBottom: '1px solid #F0F0F4',
                cursor: 'pointer',
                transition: '120ms',
                background: 'transparent',
                borderLeft: `3px solid ${dotColor}`,
                position: 'relative' as const,
                animationDelay: `${idx * 20}ms`,
              }}
            >
              {/* Incidente */}
              <div style={{ padding: '12px 16px', minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{
                  width: 9, height: 9, borderRadius: '50%',
                  background: sInfo.color, flexShrink: 0, marginTop: 5,
                  boxShadow: `${sInfo.color}15 0 0 0 3px`,
                }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    display: 'block', fontSize: 13, fontWeight: 600, color: '#111827',
                    lineHeight: 1.35,
                  }}>
                    {f.title}
                  </span>
                  {f.description && (
                    <span style={{
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      display: 'block', fontSize: 11, color: '#9CA3AF',
                      lineHeight: 1.4, marginTop: 2, maxWidth: '100%',
                    }}>
                      {f.description}
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' as const }}>
                    {hasWorkOrder && (
                      <span style={{
                        fontSize: 10, color: '#6B7280', background: '#F3F4F6',
                        padding: '2px 7px', borderRadius: 4, fontWeight: 500,
                        border: '1px solid #E5E7EB',
                      }}>
                        OT #{woId}
                      </span>
                    )}
                    {f.causedDowntime && (
                      <span style={{
                        fontSize: 10, color: '#DC2626', background: '#FEF2F2',
                        padding: '2px 6px', borderRadius: 4,
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        border: '1px solid #FECACA',
                      }}>
                        <Zap style={{ width: 10, height: 10 }} />
                        Downtime
                      </span>
                    )}
                    {f.isIntermittent && (
                      <span style={{
                        fontSize: 10, color: '#D97706', background: '#FFFBEB',
                        padding: '2px 6px', borderRadius: 4,
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        border: '1px solid #FDE68A',
                      }}>
                        <AlertTriangle style={{ width: 10, height: 10 }} />
                        Intermitente
                      </span>
                    )}
                    {reporterName && (
                      <span style={{ fontSize: 10, color: '#B0B0B8' }}>
                        por {reporterName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Estado */}
              <div style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '4px 10px',
                  borderRadius: 6, background: '#F8F8FA', color: '#6B7280',
                  border: '1px solid #E5E7EB',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: sInfo.color,
                  }} />
                  {sInfo.label}
                </span>
              </div>

              {/* Prioridad */}
              <div style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '4px 10px',
                  borderRadius: 6, background: pInfo.bg, color: pInfo.text,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <span style={{ fontSize: 10 }}>
                    {dp === 'P1' ? '!!' : dp === 'P2' ? '!' : '\u2192'}
                  </span>
                  {dp} {pInfo.label}
                </span>
              </div>

              {/* Reportada */}
              <div style={{ padding: '14px 16px', whiteSpace: 'nowrap', fontSize: 12 }}>
                <div>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    color: overdue ? '#DC2626' : '#6B7280',
                    fontWeight: overdue ? 500 : 400, fontSize: 12,
                  }}>
                    <Calendar style={{
                      width: 12, height: 12,
                      color: overdue ? '#DC2626' : '#9CA3AF',
                      flexShrink: 0,
                    }} />
                    {format(reported, 'd MMM yyyy', { locale: es })}
                  </span>
                  {overdue && (
                    <span style={{
                      fontSize: 10, color: '#EF4444', fontWeight: 600,
                      marginTop: 2, display: 'block', paddingLeft: 17,
                    }}>
                      {formatDistanceToNow(reported, { locale: es, addSuffix: false }).replace('alrededor de ', '')}
                    </span>
                  )}
                </div>
              </div>

              {/* Máquina */}
              <div style={{ padding: '14px 16px', fontSize: 12, minWidth: 0 }}>
                <span style={{
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  display: 'block', color: f.machine?.name ? '#374151' : '#D1D5DB',
                  fontWeight: f.machine?.name ? 500 : 400,
                }}>
                  {f.machine?.name || '—'}
                </span>
              </div>

              {/* Reportado por */}
              <div style={{ padding: '14px 16px', fontSize: 12, whiteSpace: 'nowrap' }}>
                {reporterName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${pInfo.bg}, ${pInfo.bg})`,
                      border: `1.5px solid ${pInfo.text}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: pInfo.text }}>
                        {getInitials(reporterName)}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#374151', fontWeight: 500, fontSize: 12, display: 'block' }}>
                        {reporterName}
                      </span>
                      <span style={{ color: '#B0B0B8', fontSize: 10, display: 'block', marginTop: 1 }}>
                        Reportó
                      </span>
                    </div>
                  </div>
                ) : (
                  <span style={{ color: '#D1D5DB' }}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
