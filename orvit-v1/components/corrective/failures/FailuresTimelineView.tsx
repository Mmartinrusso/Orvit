'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert } from 'lucide-react';
import {
  addDays,
  startOfDay,
  differenceInCalendarDays,
  format,
  isToday,
  startOfWeek,
  endOfWeek,
  getDay,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { statusConfig, formatPriority, priorityConfig } from './FailureCard';
import type { FailureOccurrence } from './FailureCard';

/* ─── Config ─── */

const COL_W = 90;
const LABEL_W = 220;
const ROW_H = 48;
const BAR_H = 28;
const DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/* ─── Props ─── */

interface FailuresTimelineViewProps {
  failures: FailureOccurrence[];
  isLoading?: boolean;
  onSelectFailure?: (id: number) => void;
}

/* ─── Helpers ─── */

function getInitials(name?: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function getWeekRanges(days: Date[]): Array<{ label: string; span: number }> {
  const ranges: Array<{ label: string; span: number }> = [];
  let i = 0;
  while (i < days.length) {
    const wStart = startOfWeek(days[i], { weekStartsOn: 1 });
    let count = 0;
    while (i + count < days.length) {
      const dWs = startOfWeek(days[i + count], { weekStartsOn: 1 });
      if (dWs.getTime() !== wStart.getTime()) break;
      count++;
    }
    const wEnd = endOfWeek(wStart, { weekStartsOn: 1 });
    const label = `${format(wStart, 'd MMM', { locale: es })} — ${format(wEnd, 'd MMM', { locale: es })}`;
    ranges.push({ label, span: count });
    i += count;
  }
  return ranges;
}

/* ─── Component ─── */

export function FailuresTimelineView({
  failures,
  isLoading = false,
  onSelectFailure,
}: FailuresTimelineViewProps) {
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));

  const DAYS_BEFORE = 7;
  const DAYS_AFTER = 23;

  const days = useMemo(() => {
    const start = addDays(anchorDate, -DAYS_BEFORE);
    return Array.from({ length: DAYS_BEFORE + DAYS_AFTER }, (_, i) => addDays(start, i));
  }, [anchorDate]);

  const totalDays = days.length;
  const windowStart = days[0];
  const windowEnd = days[days.length - 1];
  const weekRanges = useMemo(() => getWeekRanges(days), [days]);

  const goBack = useCallback(() => setAnchorDate(p => addDays(p, -7)), []);
  const goForward = useCallback(() => setAnchorDate(p => addDays(p, 7)), []);
  const goToday = useCallback(() => setAnchorDate(startOfDay(new Date())), []);

  // Filter & sort failures within the window
  const visible = useMemo(() => {
    return failures
      .filter(f => {
        const fStart = startOfDay(new Date(f.reportedAt));
        const fEnd = f.resolvedAt ? startOfDay(new Date(f.resolvedAt)) : startOfDay(new Date());
        return fEnd >= windowStart && fStart <= windowEnd;
      })
      .sort((a, b) => new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime());
  }, [failures, windowStart, windowEnd]);

  const todayIdx = useMemo(
    () => differenceInCalendarDays(startOfDay(new Date()), windowStart),
    [windowStart],
  );

  const totalWidth = LABEL_W + totalDays * COL_W;

  if (isLoading) {
    return (
      <div style={{ padding: 0 }}>
        <Skeleton className="h-10 w-full rounded-none" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none border-b" />
        ))}
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '60px 20px', textAlign: 'center',
      }}>
        <CalendarDays style={{ width: 32, height: 32, color: '#9CA3AF', marginBottom: 12 }} />
        <p style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 4 }}>
          Sin incidentes en este período
        </p>
        <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>
          Ajustá el rango o los filtros
        </p>
        <button
          onClick={goToday}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 500,
            border: '1px solid #E4E4E8', borderRadius: 6,
            background: '#FAFAFA', color: '#374151', cursor: 'pointer',
          }}
        >
          Ir a hoy
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes tl-fade {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .tl-row { animation: tl-fade 340ms cubic-bezier(0.22,1,0.36,1) both; }
        .tl-row:hover { background: #FAFBFC; }
        .tl-nav-btn {
          width: 30px; height: 30px; display: flex; align-items: center;
          justify-content: center; border: 1px solid #E4E4E8; border-radius: 6px;
          background: #FAFAFA; color: #9CA3AF; cursor: pointer; transition: 120ms;
        }
        .tl-nav-btn:hover { border-color: #D1D5DB; background: #F3F4F6; color: #374151; }
      `}</style>

      {/* Nav controls */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', borderBottom: '1px solid #F0F0F4',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="tl-nav-btn" onClick={goBack}><ChevronLeft style={{ width: 14, height: 14 }} /></button>
          <button
            onClick={goToday}
            style={{
              padding: '4px 10px', fontSize: 11, fontWeight: 500,
              border: '1px solid #E4E4E8', borderRadius: 6,
              background: '#FAFAFA', color: '#374151', cursor: 'pointer',
            }}
          >
            Hoy
          </button>
          <button className="tl-nav-btn" onClick={goForward}><ChevronRight style={{ width: 14, height: 14 }} /></button>
        </div>
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>
          {format(windowStart, 'd MMM', { locale: es })} — {format(windowEnd, 'd MMM yyyy', { locale: es })}
        </span>
      </div>

      {/* Timeline */}
      <div className="no-scrollbar" style={{ overflowX: 'auto', width: '100%' }}>
        <div style={{ minWidth: totalWidth, width: '100%', fontSize: 12 }}>

          {/* Week headers */}
          <div style={{
            display: 'flex', borderBottom: '1px solid #F0F0F0',
            position: 'sticky', top: 0, background: '#FAFAFA', zIndex: 3,
          }}>
            <div style={{ width: LABEL_W, flexShrink: 0 }} />
            {weekRanges.map((wr, i) => (
              <div key={i} style={{
                width: wr.span * COL_W, flexShrink: 0, textAlign: 'center',
                padding: '8px 0', fontSize: 10, fontWeight: 600, color: '#9CA3AF',
                borderLeft: i > 0 ? '1px solid #E4E4E8' : 'none',
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                {wr.label}
              </div>
            ))}
          </div>

          {/* Day headers */}
          <div style={{
            display: 'flex', borderBottom: '1.5px solid #E4E4E8',
            position: 'sticky', top: 32, background: '#FFFFFF', zIndex: 2,
          }}>
            <div style={{
              width: LABEL_W, flexShrink: 0, padding: '8px 16px',
              fontWeight: 600, fontSize: 11, color: '#9CA3AF',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              Incidente
            </div>
            {days.map((day, i) => {
              const weekend = getDay(day) === 0 || getDay(day) === 6;
              const today = isToday(day);
              return (
                <div key={i} style={{
                  width: COL_W, flexShrink: 0, textAlign: 'center', padding: '6px 0',
                  fontWeight: today ? 700 : 400,
                  color: today ? '#FFFFFF' : weekend ? '#C9CDD3' : '#6B7280',
                  borderLeft: '1px solid #F0F0F4',
                  background: today ? '#111827' : weekend ? '#FAFBFC' : 'transparent',
                  borderRadius: today ? 8 : 0,
                }}>
                  <div style={{
                    fontSize: 9, textTransform: 'uppercase',
                    letterSpacing: '0.06em', opacity: 0.8,
                  }}>
                    {DAY_ABBR[getDay(day)]}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: today ? 800 : 500 }}>
                    {format(day, 'd')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Incident rows */}
          {visible.map((f, idx) => {
            const sInfo = statusConfig[f.status] || statusConfig.OPEN;
            const reporterName = f.reportedBy?.name || f.reporter?.name;
            const reported = new Date(f.reportedAt);
            const isUnresolved = f.status !== 'RESOLVED' && f.status !== 'CANCELLED';
            const daysOpen = differenceInCalendarDays(new Date(), reported);
            const overdue = isUnresolved && daysOpen > 7;

            // Bar position
            const fStart = startOfDay(new Date(f.reportedAt));
            const fEnd = f.resolvedAt ? startOfDay(new Date(f.resolvedAt)) : startOfDay(new Date());
            const clampedStart = fStart < windowStart ? windowStart : fStart;
            const clampedEnd = fEnd > windowEnd ? windowEnd : fEnd;
            const startCol = differenceInCalendarDays(clampedStart, windowStart);
            const endCol = differenceInCalendarDays(clampedEnd, windowStart);
            const barLeft = LABEL_W + startCol * COL_W + 3;
            const barWidth = Math.max(COL_W - 6, (endCol - startCol + 1) * COL_W - 6);

            const barBorderColor = overdue ? '#FCA5A5' : `${sInfo.color}50`;
            const barEdgeColor = overdue ? '#EF4444' : sInfo.color;

            return (
              <div
                key={f.id}
                className="tl-row"
                onClick={() => onSelectFailure?.(f.id)}
                style={{
                  display: 'flex', alignItems: 'center',
                  borderBottom: '1px solid #F3F4F6',
                  height: ROW_H, cursor: 'pointer', transition: 'background 120ms',
                  animationDelay: `${idx * 20}ms`, background: 'transparent',
                }}
              >
                {/* Left label */}
                <div style={{
                  width: LABEL_W, flexShrink: 0, padding: '0 16px',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: sInfo.color, flexShrink: 0,
                    boxShadow: `${sInfo.color}30 0 0 0 2px`,
                  }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                      fontWeight: 500, color: '#111827', fontSize: 12,
                    }}>
                      {f.title}
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: overdue ? '#DC2626' : '#9CA3AF',
                      fontWeight: overdue ? 600 : 400,
                      display: 'flex', alignItems: 'center', gap: 4, marginTop: 2,
                    }}>
                      {overdue && (
                        <CircleAlert style={{ width: 10, height: 10 }} />
                      )}
                      <span>{format(reported, 'd MMM', { locale: es })}</span>
                      {reporterName && (
                        <>
                          <span style={{ color: '#D1D5DB' }}>&middot;</span>
                          <span style={{ color: '#9CA3AF', fontWeight: 400 }}>{reporterName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Grid cells */}
                <div style={{ display: 'flex', flex: 1, position: 'relative', height: '100%' }}>
                  {days.map((day, i) => {
                    const weekend = getDay(day) === 0 || getDay(day) === 6;
                    const today = isToday(day);
                    return (
                      <div key={i} style={{
                        width: COL_W, flexShrink: 0, height: '100%',
                        borderLeft: '1px solid #F0F0F4',
                        background: today
                          ? 'rgba(17,24,39,0.04)'
                          : weekend ? '#FAFBFC' : 'transparent',
                        position: 'relative',
                      }}>
                        {today && (
                          <div style={{
                            position: 'absolute', top: 0, bottom: 0,
                            left: '50%', width: 2, background: '#111827',
                            opacity: 0.2, transform: 'translateX(-50%)',
                          }} />
                        )}
                      </div>
                    );
                  })}

                  {/* Gantt bar */}
                  <div style={{
                    position: 'absolute',
                    left: startCol * COL_W + 3,
                    width: barWidth,
                    top: '50%', transform: 'translateY(-50%)',
                    height: BAR_H,
                    background: 'rgba(243,244,246,0.5)',
                    borderRadius: 7,
                    border: `1.5px solid ${barBorderColor}`,
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '0 8px',
                    zIndex: 1, overflow: 'hidden',
                  }}>
                    {/* User avatar */}
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'rgba(156,163,175,0.125)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, position: 'relative', zIndex: 1,
                    }}>
                      <span style={{ fontSize: 8, fontWeight: 700, color: '#9CA3AF' }}>
                        {getInitials(reporterName)}
                      </span>
                    </div>

                    {/* Status edge */}
                    <div style={{
                      position: 'absolute', right: -1, top: -1, bottom: -1,
                      width: 5, borderRadius: '0 7px 7px 0',
                      background: barEdgeColor,
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
