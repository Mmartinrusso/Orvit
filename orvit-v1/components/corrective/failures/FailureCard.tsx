'use client';

import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  MoreHorizontal,
  Eye,
  Pencil,
  FileText,
  CheckCircle,
  Link as LinkIcon,
  Trash2,
  Cog,
  Zap,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ── Types ──

export interface FailureOccurrence {
  id: number;
  title: string;
  description?: string;
  priority: string;
  status: string;
  causedDowntime: boolean;
  isIntermittent: boolean;
  isSafetyRelated?: boolean;
  reportedAt: string;
  resolvedAt?: string | null;
  machine?: { id: number; name: string };
  component?: { id: number; name: string };
  workOrder?: { id: number; status: string };
  workOrders?: Array<{ id: number; status: string }>;
  reportedBy?: { id: number; name: string; avatar?: string };
  reporter?: { id: number; name: string; email?: string };
  incidentType?: string;
}

export interface FailureCardProps {
  failure: FailureOccurrence;
  onSelect?: (id: number) => void;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  onCreateWorkOrder?: (id: number) => void;
  onResolve?: (id: number) => void;
  onLinkDuplicate?: (id: number) => void;
  onStatusChange?: (id: number, status: string) => void;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  isNewest?: boolean;
  animationDelay?: number;
}

// ── Config ──

export const statusConfig: Record<string, { color: string; label: string }> = {
  REPORTED: { color: '#9CA3AF', label: 'Reportada' },
  OPEN: { color: '#3B82F6', label: 'Abierta' },
  IN_PROGRESS: { color: '#7C3AED', label: 'En Proceso' },
  RESOLVED: { color: '#059669', label: 'Resuelta' },
  CANCELLED: { color: '#9CA3AF', label: 'Cancelada' },
};

export const priorityConfig: Record<string, { bg: string; text: string; label: string }> = {
  P1: { bg: '#FEE2E2', text: '#DC2626', label: 'Urgente' },
  P2: { bg: '#FEF3C7', text: '#D97706', label: 'Alta' },
  P3: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Media' },
  P4: { bg: '#F3F4F6', text: '#6B7280', label: 'Baja' },
  URGENT: { bg: '#FEE2E2', text: '#DC2626', label: 'Urgente' },
  HIGH: { bg: '#FEF3C7', text: '#D97706', label: 'Alta' },
  MEDIUM: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Media' },
  LOW: { bg: '#F3F4F6', text: '#6B7280', label: 'Baja' },
};

export const formatPriority = (priority: string) => {
  if (priority?.startsWith('P')) return priority;
  const map: Record<string, string> = { URGENT: 'P1', HIGH: 'P2', MEDIUM: 'P3', LOW: 'P4' };
  return map[priority] || priority;
};

const STATUS_CYCLE: string[] = ['REPORTED', 'OPEN', 'IN_PROGRESS', 'RESOLVED'];

// ── Component ──

export function FailureCard({
  failure,
  onSelect,
  onEdit,
  onDelete,
  onCreateWorkOrder,
  onResolve,
  onLinkDuplicate,
  onStatusChange,
  canCreate = true,
  canEdit = true,
  canDelete = false,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
  isNewest = false,
  animationDelay = 0,
}: FailureCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: failure.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const [isHovered, setIsHovered] = useState(false);

  const displayPriority = formatPriority(failure.priority);
  const pInfo = priorityConfig[failure.priority] || priorityConfig[displayPriority] || priorityConfig.P3;
  const sInfo = statusConfig[failure.status] || statusConfig.OPEN;
  const hasWorkOrder = (failure.workOrders?.length ?? 0) > 0 || !!failure.workOrder;
  const isResolved = failure.status === 'RESOLVED' || failure.status === 'CANCELLED';
  const reporterName = failure.reportedBy?.name || failure.reporter?.name;
  const reporterInitials = reporterName
    ? reporterName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : null;

  const timeAgo = formatDistanceToNow(new Date(failure.reportedAt), { addSuffix: true, locale: es });

  const handleQuickStatusChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onStatusChange) return;
    const currentIndex = STATUS_CYCLE.indexOf(failure.status);
    const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];
    onStatusChange(failure.id, nextStatus);
  };

  const handleQuickOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.(failure.id);
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        style={{
          position: 'relative',
          background: isSelected ? '#F5F3FF' : '#FFFFFF',
          border: `1.5px solid ${isSelected ? '#7C3AED' : '#E4E4E8'}`,
          borderRadius: '10px',
          padding: '16px 18px',
          cursor: 'pointer',
          userSelect: 'none',
          boxShadow: '0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.07)',
          animationName: isNewest ? 'card-new-in' : 'card-cascade-in',
          animationDuration: isNewest ? '420ms' : '1300ms',
          animationTimingFunction: 'cubic-bezier(0.22,1,0.36,1)',
          animationFillMode: 'both',
          animationDelay: isNewest ? '0ms' : `${animationDelay}ms`,
          transition: 'background 120ms ease, border-color 120ms ease, box-shadow 150ms ease',
        }}
        {...(selectionMode ? {} : { ...attributes, ...listeners })}
        onClick={() => {
          if (isDragging) return;
          if (selectionMode) { onToggleSelect?.(failure.id); }
          else { onSelect?.(failure.id); }
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.08), 0 8px 28px rgba(0,0,0,.10)';
          e.currentTarget.style.borderColor = isSelected ? '#7C3AED' : '#D8D8E0';
          setIsHovered(true);
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.07)';
          e.currentTarget.style.borderColor = isSelected ? '#7C3AED' : '#E4E4E8';
          setIsHovered(false);
        }}
      >
        {/* Select checkbox */}
        {selectionMode && (
          <div
            style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10 }}
            onClick={e => { e.stopPropagation(); onToggleSelect?.(failure.id); }}
          >
            <div style={{
              width: '18px', height: '18px', borderRadius: '5px',
              border: `2px solid ${isSelected ? '#7C3AED' : '#D1D5DB'}`,
              background: isSelected ? '#7C3AED' : '#FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 120ms ease',
            }}>
              {isSelected && <Check className="h-2.5 w-2.5" style={{ color: '#FFFFFF' }} />}
            </div>
          </div>
        )}

        {/* ── Row 1: status dot + date + quick actions + menu ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '10px',
          paddingLeft: selectionMode ? '24px' : '0',
          transition: 'padding 150ms ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
            <span style={{
              width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
              background: sInfo.color,
            }} />
            <span style={{
              fontSize: '13px', fontWeight: 400,
              color: '#6B7280',
              whiteSpace: 'nowrap',
            }}>
              {format(new Date(failure.reportedAt), 'd MMM', { locale: es })}
            </span>
          </div>

          {/* Quick actions + Menu */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onPointerDown={e => e.stopPropagation()}
          >
            <TooltipProvider>
              {isHovered && !selectionMode && onStatusChange && canEdit && !isResolved && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleQuickStatusChange}
                      style={{
                        height: '24px', width: '24px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '6px', border: '1px solid #E4E4E8',
                        background: '#FFFFFF', color: '#6B7280', cursor: 'pointer', flexShrink: 0,
                        transition: 'all 100ms ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#F5F3FF'; e.currentTarget.style.color = '#7C3AED'; e.currentTarget.style.borderColor = '#C4B5FD'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.borderColor = '#E4E4E8'; }}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top"><p className="text-xs">Avanzar estado</p></TooltipContent>
                </Tooltip>
              )}
              {isHovered && !selectionMode && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleQuickOpen}
                      style={{
                        height: '24px', width: '24px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '6px', border: '1px solid #E4E4E8',
                        background: '#FFFFFF', color: '#6B7280', cursor: 'pointer', flexShrink: 0,
                        transition: 'all 100ms ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#F5F3FF'; e.currentTarget.style.color = '#7C3AED'; e.currentTarget.style.borderColor = '#C4B5FD'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.borderColor = '#E4E4E8'; }}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top"><p className="text-xs">Ver detalle</p></TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button
                  style={{
                    height: '24px', width: '24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '6px', border: '1px solid transparent',
                    background: 'transparent', color: '#9CA3AF', cursor: 'pointer', flexShrink: 0,
                    transition: 'all 120ms ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#111827'; e.currentTarget.style.borderColor = '#E4E4E8'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.borderColor = 'transparent'; }}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem className="text-xs" onClick={(e) => { e.stopPropagation(); onSelect?.(failure.id); }}>
                  <Eye className="h-3 w-3 mr-2" /> Ver detalles
                </DropdownMenuItem>
                {onEdit && canEdit && (
                  <DropdownMenuItem className="text-xs" onClick={(e) => { e.stopPropagation(); onEdit(failure.id); }}>
                    <Pencil className="h-3 w-3 mr-2" /> Editar
                  </DropdownMenuItem>
                )}
                {canCreate && !hasWorkOrder && !isResolved && onCreateWorkOrder && (
                  <DropdownMenuItem className="text-xs" onClick={(e) => { e.stopPropagation(); onCreateWorkOrder(failure.id); }}>
                    <FileText className="h-3 w-3 mr-2" /> Crear OT
                  </DropdownMenuItem>
                )}
                {canEdit && !isResolved && onResolve && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-xs" onClick={(e) => { e.stopPropagation(); onResolve(failure.id); }}>
                      <CheckCircle className="h-3 w-3 mr-2" /> Resolver
                    </DropdownMenuItem>
                  </>
                )}
                {canEdit && !isResolved && onLinkDuplicate && (
                  <DropdownMenuItem className="text-xs" onClick={(e) => { e.stopPropagation(); onLinkDuplicate(failure.id); }}>
                    <LinkIcon className="h-3 w-3 mr-2" /> Vincular duplicado
                  </DropdownMenuItem>
                )}
                {canDelete && onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-xs text-destructive focus:text-destructive"
                      onClick={(e) => { e.stopPropagation(); onDelete(failure.id); }}
                    >
                      <Trash2 className="h-3 w-3 mr-2" /> Eliminar
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{ borderTop: '1px solid #E4E4E8', marginBottom: '12px' }} />

        {/* ── Title ── */}
        <p className="line-clamp-2" style={{
          fontSize: '15px', fontWeight: 600, color: '#111827',
          lineHeight: 1.35, letterSpacing: '-0.01em',
          marginBottom: failure.description ? '4px' : '10px',
        }}>
          {failure.title}
        </p>

        {/* ── Description (truncated) ── */}
        {failure.description && (
          <p className="line-clamp-2" style={{
            fontSize: '12.5px', color: '#6B7280',
            lineHeight: 1.5, marginBottom: '10px',
          }}>
            {failure.description}
          </p>
        )}

        {/* ── Machine ── */}
        {failure.machine?.name && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            marginBottom: '10px',
          }}>
            <Cog className="h-3.5 w-3.5" style={{ color: '#9CA3AF', flexShrink: 0 }} />
            <span style={{ fontSize: '12.5px', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {failure.machine.name}
            </span>
          </div>
        )}

        {/* ── Badges row: Priority + indicators ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 500,
            padding: '2px 8px', borderRadius: '4px',
            backgroundColor: pInfo.bg, color: pInfo.text,
            lineHeight: '18px',
          }}>
            {displayPriority} {pInfo.label}
          </span>
          {failure.causedDowntime && (
            <span style={{
              fontSize: '11px', fontWeight: 500,
              padding: '2px 8px', borderRadius: '4px',
              backgroundColor: '#FEE2E2', color: '#DC2626',
              display: 'flex', alignItems: 'center', gap: '3px',
              lineHeight: '18px',
            }}>
              <Zap className="h-2.5 w-2.5" /> Downtime
            </span>
          )}
          {failure.isIntermittent && (
            <span style={{
              fontSize: '11px', fontWeight: 500,
              padding: '2px 8px', borderRadius: '4px',
              backgroundColor: '#FEF3C7', color: '#D97706',
              lineHeight: '18px',
            }}>
              Intermitente
            </span>
          )}
          {failure.isSafetyRelated && (
            <span style={{
              fontSize: '11px', fontWeight: 500,
              padding: '2px 8px', borderRadius: '4px',
              backgroundColor: '#FEE2E2', color: '#DC2626',
              display: 'flex', alignItems: 'center', gap: '3px',
              lineHeight: '18px',
            }}>
              <AlertTriangle className="h-2.5 w-2.5" /> Seguridad
            </span>
          )}
        </div>

        {/* ── Bottom row: Work order + Reporter ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: '10px', borderTop: '1px solid #E4E4E8',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {hasWorkOrder && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '12px', color: '#6B7280',
              }}>
                <FileText className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
                OT #{failure.workOrder?.id || failure.workOrders?.[0]?.id}
              </span>
            )}
            {!hasWorkOrder && (
              <span style={{ fontSize: '12px', color: '#D1D5DB' }}>
                {timeAgo}
              </span>
            )}
          </div>

          {reporterInitials && (
            <div
              title={reporterName}
              style={{
                height: '26px', width: '26px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '9px', fontWeight: 700,
                background: '#EDE9FE', color: '#7C3AED',
                border: '2px solid #FFFFFF',
                boxShadow: '0 1px 3px rgba(0,0,0,.10)',
              }}
            >
              {reporterInitials}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Simplified card for DragOverlay
 */
export function FailureCardOverlay({ failure }: { failure: FailureOccurrence }) {
  const displayPriority = formatPriority(failure.priority);
  const pInfo = priorityConfig[failure.priority] || priorityConfig[displayPriority] || priorityConfig.P3;
  const sInfo = statusConfig[failure.status] || statusConfig.OPEN;

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1.5px solid #D8D8DE',
      borderRadius: '10px',
      padding: '16px 18px',
      width: '280px',
      transform: 'rotate(2deg)',
      opacity: 0.92,
      boxShadow: '0 8px 32px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.10)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
        <span style={{
          width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
          background: sInfo.color,
        }} />
        <span style={{ fontSize: '13px', color: '#6B7280' }}>
          {format(new Date(failure.reportedAt), 'd MMM', { locale: es })}
        </span>
      </div>
      <div style={{ borderTop: '1px solid #E4E4E8', marginBottom: '10px' }} />
      <p className="line-clamp-1" style={{
        fontSize: '15px', fontWeight: 600, color: '#111827',
        lineHeight: 1.35, letterSpacing: '-0.01em', marginBottom: '8px',
      }}>
        {failure.title}
      </p>
      {failure.machine?.name && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
          <Cog className="h-3 w-3" style={{ color: '#9CA3AF' }} />
          <span style={{ fontSize: '12px', color: '#6B7280' }}>{failure.machine.name}</span>
        </div>
      )}
      <span style={{
        fontSize: '11px', fontWeight: 500,
        padding: '2px 8px', borderRadius: '4px',
        backgroundColor: pInfo.bg, color: pInfo.text,
      }}>
        {displayPriority} {pInfo.label}
      </span>
    </div>
  );
}
