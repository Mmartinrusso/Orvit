'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Clock, AlertTriangle, UserX } from 'lucide-react';
import { FailureFilters } from './FailureFiltersBar';

interface FailureStats {
  totalOpen: number;
  recurrences: number;
  withDowntime: number;
  unassigned: number;
}

interface FailureKPIsProps {
  activeFilter?: FailureFilters;
  onFilterChange?: (filters: FailureFilters) => void;
  incidentType?: string;
}

type KPIKey = 'totalOpen' | 'recurrences' | 'withDowntime' | 'unassigned';

interface KpiItem {
  key: KPIKey;
  title: string;
  description: string;
  icon: typeof AlertCircle;
  color: string;
  bg: string;
  filter: Partial<FailureFilters>;
}

const kpiDefinitions: KpiItem[] = [
  {
    key: 'totalOpen',
    title: 'Abiertas',
    description: 'Incidentes reportados o en proceso',
    icon: AlertCircle,
    color: '#3B82F6',
    bg: '#EFF6FF',
    filter: { status: ['REPORTED', 'IN_PROGRESS'] },
  },
  {
    key: 'recurrences',
    title: 'Reincidencias',
    description: 'Fallas repetidas en la misma máquina',
    icon: AlertTriangle,
    color: '#F59E0B',
    bg: '#FFFBEB',
    filter: { status: ['REPORTED', 'IN_PROGRESS'] },
  },
  {
    key: 'withDowntime',
    title: 'Con Parada',
    description: 'Incidentes que causaron parada de máquina',
    icon: Clock,
    color: '#EF4444',
    bg: '#FEF2F2',
    filter: { causedDowntime: true, status: ['REPORTED', 'IN_PROGRESS'] },
  },
  {
    key: 'unassigned',
    title: 'Sin Asignar',
    description: 'Sin orden de trabajo asociada',
    icon: UserX,
    color: '#6B7280',
    bg: '#F3F4F6',
    filter: { hasWorkOrder: false, status: ['REPORTED', 'IN_PROGRESS'] },
  },
];

/**
 * KPIs clickeables del dashboard de Fallas
 * Al hacer click, aplica filtros correspondientes
 */
export function FailureKPIs({ activeFilter, onFilterChange, incidentType }: FailureKPIsProps) {
  const { data: stats, isLoading } = useQuery<FailureStats>({
    queryKey: ['failure-stats', incidentType],
    queryFn: async () => {
      const params = incidentType ? `?incidentType=${incidentType}` : '';
      const res = await fetch(`/api/failure-occurrences/stats${params}`);
      if (!res.ok) throw new Error('Error al cargar estadísticas');
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Check if a KPI filter is active
  const isKPIActive = (kpiKey: KPIKey): boolean => {
    if (!activeFilter) return false;

    switch (kpiKey) {
      case 'totalOpen':
        return (
          activeFilter.status?.includes('REPORTED') &&
          activeFilter.status?.includes('IN_PROGRESS') &&
          !activeFilter.causedDowntime &&
          activeFilter.hasWorkOrder === undefined
        );
      case 'withDowntime':
        return activeFilter.causedDowntime === true;
      case 'unassigned':
        return activeFilter.hasWorkOrder === false;
      default:
        return false;
    }
  };

  const handleKPIClick = (kpi: KpiItem) => {
    if (!onFilterChange) return;

    // If already active, clear filters
    if (isKPIActive(kpi.key)) {
      onFilterChange({});
    } else {
      // Apply KPI filter (clear other filters first)
      onFilterChange(kpi.filter);
    }
  };

  const getValue = (key: KPIKey): number => {
    if (!stats) return 0;
    return stats[key] || 0;
  };

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{
            height: 72, borderRadius: 10,
            background: '#F8F8FA', border: '1px solid #E4E4E8',
          }}>
            <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: '#F0F0F4' }} />
              <div>
                <div style={{ width: 60, height: 8, borderRadius: 4, background: '#E4E4E8', marginBottom: 8 }} />
                <div style={{ width: 32, height: 18, borderRadius: 4, background: '#E4E4E8' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 12 }}>
      {kpiDefinitions.map((kpi) => {
        const Icon = kpi.icon;
        const isActive = isKPIActive(kpi.key);
        const value = getValue(kpi.key);

        return (
          <button
            key={kpi.key}
            onClick={() => handleKPIClick(kpi)}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '20px 20px',
              background: isActive ? '#111827' : '#FFFFFF',
              border: isActive ? '1.5px solid #111827' : '1.5px solid #E4E4E8',
              borderRadius: 10,
              cursor: 'pointer',
              transition: 'all 180ms cubic-bezier(0.22,1,0.36,1)',
              boxShadow: isActive
                ? '0 2px 8px rgba(17,24,39,0.18)'
                : '0 1px 3px rgba(0,0,0,0.04)',
              textAlign: 'left',
            }}
          >
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: isActive ? 'rgba(255,255,255,0.12)' : kpi.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              transition: 'background 180ms',
            }}>
              <Icon style={{
                width: 20, height: 20,
                color: isActive ? '#FFFFFF' : kpi.color,
                transition: 'color 180ms',
              }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 11, fontWeight: 500,
                color: isActive ? 'rgba(255,255,255,0.65)' : '#9CA3AF',
                lineHeight: '14px', marginBottom: 4,
                letterSpacing: '0.01em',
              }}>
                {kpi.title}
              </div>
              <div style={{
                fontSize: 28, fontWeight: 700,
                color: isActive ? '#FFFFFF' : '#111827',
                lineHeight: '32px',
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {value}
              </div>
              <div style={{
                fontSize: 10, fontWeight: 400,
                color: isActive ? 'rgba(255,255,255,0.45)' : '#B0B0B8',
                lineHeight: '13px', marginTop: 4,
              }}>
                {kpi.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
