'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { WIDGETS_REGISTRY, canSeeWidget } from './registry';
import { useAdminDashboardSummary, type RangeKey } from '@/hooks/use-admin-dashboard-summary';
import { RefreshCcw, LayoutGrid } from 'lucide-react';

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: '7d',  label: '7 días'    },
  { value: '30d', label: '30 días'   },
  { value: '90d', label: '3 meses'   },
  { value: 'ytd', label: 'Este año'  },
];

function pickTitleFromData(data: { tasks?: unknown; costs?: unknown; purchases?: unknown; system?: unknown }) {
  if (data.system)    return { title: 'Panel de Administración', subtitle: 'Métricas, tendencias y actividad del sistema.' };
  if (data.purchases) return { title: 'Panel de Compras',        subtitle: 'Estados, gasto y acciones rápidas.' };
  if (data.costs)     return { title: 'Panel de Costos',         subtitle: 'Tendencias e impacto por categoría.' };
  if (data.tasks)     return { title: 'Panel de Tareas',         subtitle: 'Pendientes, estado y tu día.' };
  return { title: 'Panel', subtitle: 'Sin módulos habilitados.' };
}

export function DashboardShell() {
  const [range, setRange] = useState<RangeKey>('30d');
  const query = useAdminDashboardSummary(range);
  const data = query.data;

  const perms = useMemo(() => new Set(data?.meta?.permissions || []), [data?.meta?.permissions]);
  const { title, subtitle } = useMemo(() => pickTitleFromData(data || {}), [data]);

  const visibleWidgets = useMemo(() => {
    if (!data) return [];
    return WIDGETS_REGISTRY.filter((w) => canSeeWidget(w, perms, data)).sort((a, b) => a.order - b.order);
  }, [data, perms]);

  const kpiDefs    = useMemo(() => visibleWidgets.filter((w) =>  w.id.startsWith('kpi.')), [visibleWidgets]);
  const otherDefs  = useMemo(() => visibleWidgets.filter((w) => !w.id.startsWith('kpi.')), [visibleWidgets]);

  const kpiSpan = useMemo(() => {
    const n = kpiDefs.length;
    if (n <= 1) return 'col-span-12';
    if (n === 2) return 'col-span-12 md:col-span-6 lg:col-span-6';
    if (n === 3) return 'col-span-12 md:col-span-6 lg:col-span-4';
    return 'col-span-12 md:col-span-6 lg:col-span-3';
  }, [kpiDefs.length]);

  return (
    <>
      <style>{`
        @keyframes dash-header-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes dash-kpi-in {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes dash-widget-in {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .dash-refresh-btn:hover { background: #F4F4F4 !important; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 56px)' }}>

        {/* ── Sticky header ── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderBottom: '1px solid #E8E8E8',
          padding: '14px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
          flexWrap: 'wrap',
          animation: 'dash-header-in 300ms cubic-bezier(0.22,1,0.36,1) both',
        }}>
          {/* Title */}
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#050505', margin: 0, lineHeight: 1.2 }}>
              {title}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', flexWrap: 'wrap' }}>
              <p style={{ fontSize: '12px', color: '#9C9CAA', margin: 0 }}>{subtitle}</p>
              {data?.meta?.generatedAt && (
                <span style={{ fontSize: '11px', color: '#C8C8D0' }}>
                  · {new Date(data.meta.generatedAt).toLocaleString('es-AR')}
                </span>
              )}
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Range selector */}
            <div style={{ display: 'flex', gap: '3px', padding: '4px', background: '#F4F4F4', borderRadius: '10px' }}>
              {RANGE_OPTIONS.map(opt => {
                const active = range === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setRange(opt.value)}
                    style={{
                      height: '28px', padding: '0 12px', borderRadius: '7px',
                      border: 'none',
                      background: active ? '#FFFFFF' : 'transparent',
                      color: active ? '#050505' : '#9C9CAA',
                      fontSize: '12px', fontWeight: active ? 600 : 500,
                      cursor: 'pointer', transition: 'all 120ms ease',
                      boxShadow: active ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Refresh */}
            <button
              className="dash-refresh-btn"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                height: '36px', padding: '0 14px', borderRadius: '10px',
                border: '1px solid #E4E4E4', background: '#FAFAFA',
                color: '#575456', fontSize: '12px', fontWeight: 600,
                cursor: query.isFetching ? 'not-allowed' : 'pointer',
                opacity: query.isFetching ? 0.7 : 1,
                transition: 'all 120ms ease',
              }}
            >
              <RefreshCcw
                style={{ width: 13, height: 13 }}
                className={query.isFetching ? 'animate-spin' : ''}
              />
              Actualizar
            </button>
          </div>
        </div>

        {/* ── Loading skeleton ── */}
        {query.isLoading && !data && (
          <div className="grid grid-cols-12 gap-4 md:gap-5" style={{ padding: '24px 24px 0' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="col-span-12 md:col-span-6 lg:col-span-3 animate-pulse"
                style={{
                  height: '140px', borderRadius: '16px', background: '#F0F0F0',
                  animation: `dash-kpi-in 300ms cubic-bezier(0.22,1,0.36,1) ${i * 55}ms both`,
                }}
              />
            ))}
            <div
              className="col-span-12 lg:col-span-8 animate-pulse"
              style={{
                height: '340px', borderRadius: '16px', background: '#F0F0F0',
                animation: 'dash-widget-in 340ms cubic-bezier(0.22,1,0.36,1) 300ms both',
              }}
            />
          </div>
        )}

        {/* ── Widgets grid ── */}
        {!query.isLoading && data && (
          <div
            className="grid grid-cols-12 items-start"
            style={{ padding: '24px', gap: '16px', flex: 1 }}
          >
            {/* KPI row */}
            {kpiDefs.map((w, i) => (
              <div
                key={w.id}
                className={kpiSpan}
                style={{ animation: `dash-kpi-in 340ms cubic-bezier(0.22,1,0.36,1) ${i * 65}ms both` }}
              >
                {w.component({ data, range })}
              </div>
            ))}

            {/* Other widgets */}
            {otherDefs.map((w, i) => (
              <div
                key={w.id}
                className={cn(w.layout.sm || 'col-span-12', w.layout.md, w.layout.lg)}
                style={{ animation: `dash-widget-in 360ms cubic-bezier(0.22,1,0.36,1) ${(kpiDefs.length * 65) + i * 70 + 60}ms both` }}
              >
                {w.component({ data, range })}
              </div>
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!query.isLoading && !data && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <LayoutGrid style={{ width: 24, height: 24, color: '#C0C0C8' }} />
              </div>
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#050505', margin: '0 0 4px' }}>Sin datos disponibles</p>
              <p style={{ fontSize: '13px', color: '#9C9CAA', margin: 0 }}>No hay módulos habilitados para mostrar.</p>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
