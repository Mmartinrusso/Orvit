'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  Check,
  X,
  Calendar,
  User,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

export function FailuresDuplicadosView({
  onSelectFailure,
  className,
}: FailuresDuplicadosViewProps) {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [selectedForUnlink, setSelectedForUnlink] = useState<FailureOccurrence | null>(null);

  // Fetch duplicates
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

  // Fetch potential duplicates (same machine, last 7 days, similar time)
  const { data: potentialDuplicates = [] } = useQuery({
    queryKey: ['potential-duplicates', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      // This would ideally be a dedicated endpoint that uses similarity detection
      // For now, we'll fetch recent failures and group them client-side
      const res = await fetch(
        `/api/failure-occurrences?companyId=${currentCompany.id}&status=OPEN&take=100`
      );
      if (!res.ok) return [];
      const data = await res.json();
      const failures = data.data || data || [];

      // Group by machine + same day
      const groups = new Map<string, FailureOccurrence[]>();
      failures.forEach((f: FailureOccurrence) => {
        if (!f.machine || f.isLinkedDuplicate) return;
        const date = format(new Date(f.reportedAt), 'yyyy-MM-dd');
        const key = `${f.machine.id}-${date}`;

        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(f);
      });

      // Return only groups with 2+ failures
      return Array.from(groups.values()).filter(g => g.length >= 2);
    },
    enabled: !!currentCompany?.id,
  });

  // Unlink mutation
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

  // Stats
  const stats = useMemo(() => ({
    totalDuplicates: duplicates.length,
    potentialGroups: potentialDuplicates.length,
    byMachine: duplicates.reduce((acc: Record<string, number>, d: FailureOccurrence) => {
      const name = d.machine?.name || 'Sin máquina';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {}),
  }), [duplicates, potentialDuplicates]);

  const handleUnlink = (failure: FailureOccurrence) => {
    setSelectedForUnlink(failure);
    setUnlinkDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex justify-between">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-destructive">Error al cargar duplicados</p>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Copy className="h-5 w-5 text-purple-500" />
            Gestión de Duplicados
          </h2>
          <p className="text-sm text-muted-foreground">
            Detecta y gestiona fallas duplicadas para evitar trabajo repetido
          </p>
        </div>

        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1">
          <Link2 className="h-3 w-3" />
          {stats.totalDuplicates} duplicados
        </Badge>
        {stats.potentialGroups > 0 && (
          <Badge variant="outline" className="gap-1 border-warning-muted text-warning-muted-foreground">
            <AlertCircle className="h-3 w-3" />
            {stats.potentialGroups} grupos por revisar
          </Badge>
        )}
      </div>

      {/* Potential duplicates section */}
      {potentialDuplicates.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-warning-muted-foreground flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Posibles duplicados por revisar
          </h3>

          {potentialDuplicates.map((group: FailureOccurrence[], idx: number) => (
            <Card key={idx} className="border-warning-muted bg-warning-muted/50">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  {group[0].machine?.name}
                  <Badge variant="secondary" className="ml-auto">
                    {group.length} fallas similares
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(group[0].reportedAt), 'dd/MM/yyyy', { locale: es })}
                </p>
              </CardHeader>
              <CardContent className="py-2 px-4">
                <div className="space-y-2">
                  {group.map((failure) => (
                    <div
                      key={failure.id}
                      className="flex items-center justify-between p-2 rounded border bg-card"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">#{failure.id}</span>
                        <span className="text-sm truncate max-w-[200px]">
                          {failure.title || 'Sin título'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(failure.reportedAt), 'HH:mm', { locale: es })}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() => onSelectFailure?.(failure.id)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Revisa estas fallas y marca como duplicado si corresponde
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Already linked duplicates */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Link2 className="h-4 w-4 text-purple-500" />
            Duplicados confirmados
          </h3>
          <p className="text-xs text-muted-foreground ml-6">
            Fallas que fueron marcadas como duplicado de otra falla
          </p>
        </div>

        {duplicates.length === 0 ? (
          <Card className="p-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <Copy className="h-12 w-12 text-muted-foreground/50" />
              <div>
                <p className="font-medium">Sin duplicados</p>
                <p className="text-sm text-muted-foreground">
                  Cuando marques una falla como duplicado de otra, aparecerá aquí
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {duplicates.map((failure: FailureOccurrence) => (
              <Card key={failure.id} className="border-l-4 border-l-purple-500">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs border-purple-500 text-purple-600">
                          Duplicado
                        </Badge>
                        <span className="text-xs text-muted-foreground">#{failure.id}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            failure.status === 'OPEN' && 'border-info text-info-muted-foreground',
                            failure.status === 'IN_PROGRESS' && 'border-warning-muted text-warning-muted-foreground',
                            failure.status === 'RESOLVED' && 'border-success text-success'
                          )}
                        >
                          {failure.status}
                        </Badge>
                      </div>

                      <p className="font-medium text-sm truncate">
                        {failure.title || 'Sin título'}
                      </p>

                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        {failure.machine && (
                          <span className="flex items-center gap-1">
                            <Wrench className="h-3 w-3" />
                            {failure.machine.name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(failure.reportedAt), { addSuffix: true, locale: es })}
                        </span>
                        {failure.reporter && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {failure.reporter.name}
                          </span>
                        )}
                      </div>

                      {failure.linkedOccurrence && (
                        <div className="mt-2 p-2 rounded bg-muted/50 text-xs">
                          <span className="text-muted-foreground">Duplicado de: </span>
                          <span
                            className="font-medium text-primary cursor-pointer hover:underline"
                            onClick={() => onSelectFailure?.(failure.linkedOccurrence!.id)}
                          >
                            #{failure.linkedOccurrence.id} - {failure.linkedOccurrence.title}
                          </span>
                        </div>
                      )}

                      {failure.linkedReason && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          Razón: {failure.linkedReason}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => onSelectFailure?.(failure.id)}
                        title="Ver detalle"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive/80"
                        onClick={() => handleUnlink(failure)}
                        title="Desvincular"
                      >
                        <Unlink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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
