'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  AlertCircle,
  RefreshCw,
  Copy,
  Link2,
  Unlink,
  Eye,
  Calendar,
  User,
  Wrench,
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface FailureOccurrence {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  reportedAt: string;
  causedDowntime: boolean;
  isLinkedDuplicate: boolean;
  linkedToOccurrenceId?: number;
  linkedReason?: string;
  machine?: { id: number; name: string; code?: string };
  reporter?: { id: number; name: string };
  linkedOccurrence?: {
    id: number;
    title: string;
    status: string;
  };
}

interface FailuresDuplicadosViewProps {
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

export function FailuresDuplicadosView({
  onSelectFailure,
  className,
}: FailuresDuplicadosViewProps) {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [selectedForUnlink, setSelectedForUnlink] = useState<FailureOccurrence | null>(null);

  const { data: duplicates = [], isLoading, error, refetch } = useQuery({
    queryKey: ['failures-duplicados', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const res = await fetch(
        `/api/failure-occurrences?companyId=${currentCompany.id}&isLinkedDuplicate=true&take=200`
      );
      if (!res.ok) throw new Error('Error al cargar duplicados');
      const data = await res.json();
      return data.data || data || [];
    },
    enabled: !!currentCompany?.id,
  });

  const { data: potentialDuplicates = [] } = useQuery({
    queryKey: ['potential-duplicates', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const res = await fetch(
        `/api/failure-occurrences?companyId=${currentCompany.id}&status=OPEN&take=100`
      );
      if (!res.ok) return [];
      const data = await res.json();
      const failures = data.data || data || [];

      const groups = new Map<string, FailureOccurrence[]>();
      failures.forEach((f: FailureOccurrence) => {
        if (!f.machine || f.isLinkedDuplicate) return;
        const date = format(new Date(f.reportedAt), 'yyyy-MM-dd');
        const key = `${f.machine.id}-${date}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(f);
      });

      return Array.from(groups.values()).filter(g => g.length >= 2);
    },
    enabled: !!currentCompany?.id,
  });

  const unlinkMutation = useMutation({
    mutationFn: async (failureId: number) => {
      const res = await fetch(`/api/failure-occurrences/${failureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isLinkedDuplicate: false,
          linkedToOccurrenceId: null,
          linkedReason: null,
        }),
      });
      if (!res.ok) throw new Error('Error al desvincular');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Falla desvinculada');
      queryClient.invalidateQueries({ queryKey: ['failures-duplicados'] });
      setUnlinkDialogOpen(false);
      setSelectedForUnlink(null);
    },
    onError: () => {
      toast.error('Error al desvincular la falla');
    },
  });

  const stats = useMemo(() => ({
    totalDuplicates: duplicates.length,
    potentialGroups: potentialDuplicates.length,
  }), [duplicates, potentialDuplicates]);

  const handleUnlink = (failure: FailureOccurrence) => {
    setSelectedForUnlink(failure);
    setUnlinkDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 100, height: 26, borderRadius: 13, background: '#F0F0F4' }} />
            <div style={{ width: 120, height: 26, borderRadius: 13, background: '#F0F0F4' }} />
          </div>
          <div style={{ width: 34, height: 34, borderRadius: 7, background: '#F0F0F4' }} />
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
        <span style={{ fontSize: 14, color: '#EF4444', fontWeight: 500 }}>Error al cargar duplicados</span>
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
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', fontSize: 11, fontWeight: 500,
            color: '#7C3AED', background: '#7C3AED10', border: '1px solid #7C3AED30',
            borderRadius: 20, whiteSpace: 'nowrap',
          }}>
            <Link2 style={{ width: 12, height: 12 }} />
            {stats.totalDuplicates} confirmados
          </span>
          {stats.potentialGroups > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', fontSize: 11, fontWeight: 500,
              color: '#F59E0B', background: '#F59E0B10', border: '1px solid #F59E0B30',
              borderRadius: 20, whiteSpace: 'nowrap',
            }}>
              <AlertCircle style={{ width: 12, height: 12 }} />
              {stats.potentialGroups} por revisar
            </span>
          )}
        </div>

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

      {/* Potential duplicates */}
      {potentialDuplicates.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 12, fontWeight: 600, color: '#F59E0B',
          }}>
            <AlertCircle style={{ width: 14, height: 14 }} />
            Posibles duplicados por revisar
          </div>

          {potentialDuplicates.map((group: FailureOccurrence[], idx: number) => (
            <div key={idx} style={{
              background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 8,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid #FDE68A',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Wrench style={{ width: 14, height: 14, color: '#92400E' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>
                    {group[0].machine?.name}
                  </span>
                  <span style={{ fontSize: 11, color: '#B45309' }}>
                    {format(new Date(group[0].reportedAt), 'dd/MM/yyyy', { locale: es })}
                  </span>
                </div>
                <span style={{
                  padding: '2px 8px', fontSize: 10, fontWeight: 600,
                  color: '#92400E', background: '#FEF3C7',
                  border: '1px solid #FDE68A', borderRadius: 4,
                }}>
                  {group.length} fallas similares
                </span>
              </div>

              <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {group.map((failure) => (
                  <div
                    key={failure.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px', borderRadius: 6,
                      background: '#FFFFFF', border: '1px solid #FDE68A',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>#{failure.id}</span>
                      <span style={{
                        fontSize: 12, fontWeight: 500, color: '#374151',
                        maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {failure.title || 'Sin título'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {format(new Date(failure.reportedAt), 'HH:mm', { locale: es })}
                      </span>
                      <button
                        onClick={() => onSelectFailure?.(failure.id)}
                        style={{
                          width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'transparent', border: '1px solid #E4E4E8', borderRadius: 5,
                          cursor: 'pointer', color: '#9CA3AF', transition: 'all 150ms',
                        }}
                        title="Ver detalle"
                      >
                        <Eye style={{ width: 13, height: 13 }} />
                      </button>
                    </div>
                  </div>
                ))}
                <div style={{
                  fontSize: 11, color: '#B45309', textAlign: 'center',
                  padding: '6px 0 2px', fontWeight: 500,
                }}>
                  Revisá estas fallas y marcá como duplicado si corresponde
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmed duplicates */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(potentialDuplicates.length > 0 || duplicates.length > 0) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 12, fontWeight: 600, color: '#7C3AED',
          }}>
            <Link2 style={{ width: 14, height: 14 }} />
            Duplicados confirmados
          </div>
        )}

        {duplicates.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            padding: '48px 24px', textAlign: 'center',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Copy style={{ width: 24, height: 24, color: '#9CA3AF' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Sin duplicados
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF', maxWidth: 300 }}>
                Cuando marques una falla como duplicado de otra, aparecerá aquí
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {duplicates.map((failure: FailureOccurrence) => {
              const statusStyle = getStatusStyle(failure.status);
              return (
                <div key={failure.id} style={{
                  background: '#FFFFFF',
                  border: '1.5px solid #E4E4E8',
                  borderLeft: '3px solid #7C3AED',
                  borderRadius: 8,
                  padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Badges row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{
                          padding: '2px 7px', fontSize: 10, fontWeight: 600,
                          color: '#7C3AED', background: '#EDE9FE',
                          border: '1px solid #DDD6FE', borderRadius: 4,
                        }}>
                          Duplicado
                        </span>
                        <span style={{ fontSize: 11, color: '#9CA3AF' }}>#{failure.id}</span>
                        <span style={{
                          padding: '2px 7px', fontSize: 10, fontWeight: 600,
                          color: statusStyle.color, background: statusStyle.bg,
                          border: `1px solid ${statusStyle.border}`, borderRadius: 4,
                        }}>
                          {getStatusLabel(failure.status)}
                        </span>
                      </div>

                      {/* Title */}
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: '#111827',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {failure.title || 'Sin título'}
                      </div>

                      {/* Meta row */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        marginTop: 6, fontSize: 11, color: '#9CA3AF',
                      }}>
                        {failure.machine && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Wrench style={{ width: 11, height: 11 }} />
                            {failure.machine.name}
                          </span>
                        )}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar style={{ width: 11, height: 11 }} />
                          {formatDistanceToNow(new Date(failure.reportedAt), { addSuffix: true, locale: es })}
                        </span>
                        {failure.reporter && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <User style={{ width: 11, height: 11 }} />
                            {failure.reporter.name}
                          </span>
                        )}
                      </div>

                      {/* Linked reference */}
                      {failure.linkedOccurrence && (
                        <div style={{
                          marginTop: 8, padding: '6px 10px', borderRadius: 6,
                          background: '#F8F8FA', border: '1px solid #F0F0F4',
                          fontSize: 11,
                        }}>
                          <span style={{ color: '#9CA3AF' }}>Duplicado de: </span>
                          <span
                            onClick={() => onSelectFailure?.(failure.linkedOccurrence!.id)}
                            style={{
                              fontWeight: 600, color: '#7C3AED', cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => { (e.target as HTMLElement).style.textDecoration = 'underline'; }}
                            onMouseLeave={(e) => { (e.target as HTMLElement).style.textDecoration = 'none'; }}
                          >
                            #{failure.linkedOccurrence.id} - {failure.linkedOccurrence.title}
                          </span>
                        </div>
                      )}

                      {failure.linkedReason && (
                        <div style={{
                          marginTop: 4, fontSize: 11, color: '#9CA3AF', fontStyle: 'italic',
                        }}>
                          Razón: {failure.linkedReason}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 12, flexShrink: 0 }}>
                      <button
                        onClick={() => onSelectFailure?.(failure.id)}
                        title="Ver detalle"
                        style={{
                          width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'transparent', border: '1px solid #E4E4E8', borderRadius: 6,
                          cursor: 'pointer', color: '#9CA3AF', transition: 'all 150ms',
                        }}
                      >
                        <Eye style={{ width: 14, height: 14 }} />
                      </button>
                      <button
                        onClick={() => handleUnlink(failure)}
                        title="Desvincular"
                        style={{
                          width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'transparent', border: '1px solid #FECACA', borderRadius: 6,
                          cursor: 'pointer', color: '#EF4444', transition: 'all 150ms',
                        }}
                      >
                        <Unlink style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Unlink confirmation dialog */}
      <AlertDialog open={unlinkDialogOpen} onOpenChange={setUnlinkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular duplicado</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres desvincular esta falla? Ya no aparecerá como duplicado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedForUnlink && unlinkMutation.mutate(selectedForUnlink.id)}
              disabled={unlinkMutation.isPending}
            >
              {unlinkMutation.isPending ? 'Desvinculando...' : 'Desvincular'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default FailuresDuplicadosView;
