'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Clock,
  TrendingUp,
  CheckCircle2,
  History,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RecurrenceData {
  recurrence: {
    isRecurrent: boolean;
    recurrenceCount: number;
    windowDays: number;
    avgDaysBetweenFailures: number | null;
  };
  previousOccurrences: Array<{
    id: number;
    title: string;
    status: string;
    priority: string;
    reportedAt: string;
    resolvedAt?: string;
    daysAgo: number;
    lastSolution?: {
      id: number;
      diagnosis: string;
      solution: string;
      outcome: string;
      effectiveness?: number;
      performedBy?: { name: string };
    };
  }>;
  effectiveSolutions: Array<{
    id: number;
    diagnosis: string;
    solution: string;
    outcome: string;
    effectiveness: number;
    performedBy?: { name: string };
  }>;
}

interface RecurrencePanelProps {
  failureId: number;
  onSelectFailure?: (id: number) => void;
}

const priorityConfig: Record<string, { bg: string; color: string; border: string }> = {
  P1: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
  P2: { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
  P3: { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  P4: { bg: '#F0F9FF', color: '#0891B2', border: '#BAE6FD' },
};

const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
  REPORTED: { label: 'Reportada', bg: '#FEF2F2', color: '#DC2626' },
  IN_PROGRESS: { label: 'En Proceso', bg: '#FFFBEB', color: '#D97706' },
  RESOLVED: { label: 'Resuelta', bg: '#F0FDF4', color: '#16A34A' },
  CANCELLED: { label: 'Cancelada', bg: '#F5F5F5', color: '#6B7280' },
};

/**
 * Panel de reincidencia — inline styles matching FailureDetailSheet design
 */
export default function RecurrencePanel({ failureId, onSelectFailure }: RecurrencePanelProps) {
  const { data, isLoading, error } = useQuery<RecurrenceData>({
    queryKey: ['failure-recurrence', failureId],
    queryFn: async () => {
      const res = await fetch(`/api/failure-occurrences/${failureId}/recurrence`);
      if (!res.ok) throw new Error('Error al cargar reincidencia');
      return res.json();
    },
    enabled: !!failureId,
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[64, 96].map((h, i) => (
          <div
            key={i}
            style={{
              height: h,
              width: '100%',
              background: '#F3F4F6',
              borderRadius: 8,
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
          />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '16px 0' }}>
        Error al cargar historial de reincidencia
      </p>
    );
  }

  const { recurrence, previousOccurrences, effectiveSolutions } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Alerta de reincidencia */}
      {recurrence.isRecurrent && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 8,
            border: '1.5px solid #FECACA',
            background: '#FEF2F2',
          }}
        >
          <AlertTriangle style={{ width: 16, height: 16, color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#DC2626', margin: 0 }}>
              Falla Recurrente
            </p>
            <p style={{ fontSize: 12, color: '#991B1B', margin: '2px 0 0' }}>
              Esta falla ha ocurrido {recurrence.recurrenceCount} veces en los últimos {recurrence.windowDays} días.
              {recurrence.avgDaysBetweenFailures && (
                <span style={{ display: 'block', marginTop: 2 }}>
                  Promedio: cada {recurrence.avgDaysBetweenFailures} días
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Estadísticas rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div
          style={{
            border: '1.5px solid #E4E4E8',
            borderRadius: 8,
            padding: 12,
            textAlign: 'center',
            background: '#FAFAFA',
          }}
        >
          <p style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>
            {previousOccurrences.length}
          </p>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Fallas anteriores
          </p>
        </div>
        <div
          style={{
            border: '1.5px solid #E4E4E8',
            borderRadius: 8,
            padding: 12,
            textAlign: 'center',
            background: '#FAFAFA',
          }}
        >
          <p style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>
            {recurrence.avgDaysBetweenFailures ?? '—'}
          </p>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Días promedio
          </p>
        </div>
      </div>

      {/* Soluciones efectivas sugeridas */}
      {effectiveSolutions.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <TrendingUp style={{ width: 14, height: 14, color: '#16A34A' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Soluciones Efectivas
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {effectiveSolutions.map((solution) => (
              <div
                key={solution.id}
                style={{
                  borderRadius: 8,
                  border: '1.5px solid #BBF7D0',
                  background: '#F0FDF4',
                  padding: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#16A34A',
                      background: '#DCFCE7',
                      padding: '2px 8px',
                      borderRadius: 10,
                      border: '1px solid #BBF7D0',
                    }}
                  >
                    Efectividad: {solution.effectiveness}/5
                  </span>
                </div>
                <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', margin: 0 }}>
                  {solution.solution}
                </p>
                <p style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 0' }}>
                  Diagnóstico: {solution.diagnosis}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial de fallas */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <History style={{ width: 14, height: 14, color: '#6B7280' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Historial
          </span>
        </div>
        {previousOccurrences.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <RefreshCw style={{ width: 28, height: 28, color: '#D1D5DB', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
              No hay fallas anteriores registradas
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {previousOccurrences.map((occ) => {
              const prio = priorityConfig[occ.priority] || { bg: '#F5F5F5', color: '#6B7280', border: '#E5E7EB' };
              const status = statusConfig[occ.status] || { label: occ.status, bg: '#F5F5F5', color: '#6B7280' };

              return (
                <div
                  key={occ.id}
                  onClick={() => onSelectFailure?.(occ.id)}
                  style={{
                    borderRadius: 8,
                    border: '1.5px solid #E4E4E8',
                    padding: 12,
                    cursor: onSelectFailure ? 'pointer' : 'default',
                    transition: 'background 0.15s',
                    background: 'white',
                  }}
                  onMouseEnter={(e) => {
                    if (onSelectFailure) (e.currentTarget as HTMLDivElement).style.background = '#FAFAFA';
                  }}
                  onMouseLeave={(e) => {
                    if (onSelectFailure) (e.currentTarget as HTMLDivElement).style.background = 'white';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: '#111827',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {occ.title}
                      </p>
                      <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>
                        Hace {occ.daysAgo} días • {format(new Date(occ.reportedAt), 'd MMM yyyy', { locale: es })}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginLeft: 8, flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 10,
                          background: prio.bg,
                          color: prio.color,
                          border: `1px solid ${prio.border}`,
                        }}
                      >
                        {occ.priority}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          padding: '2px 7px',
                          borderRadius: 10,
                          background: status.bg,
                          color: status.color,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        {occ.status === 'RESOLVED' ? (
                          <CheckCircle2 style={{ width: 11, height: 11 }} />
                        ) : (
                          <Clock style={{ width: 11, height: 11 }} />
                        )}
                        {status.label}
                      </span>
                    </div>
                  </div>

                  {/* Última solución aplicada */}
                  {occ.lastSolution && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #E4E4E8' }}>
                      <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                        <span style={{ fontWeight: 600, color: '#374151' }}>Solución:</span>{' '}
                        {occ.lastSolution.solution}
                      </p>
                      {occ.lastSolution.effectiveness && (
                        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '3px 0 0' }}>
                          Efectividad: {occ.lastSolution.effectiveness}/5
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
