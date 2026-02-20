'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  FileCheck,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QAPanelProps {
  workOrderId: number;
  className?: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  NOT_REQUIRED: { label: 'No requerido', color: 'bg-muted text-foreground', icon: <CheckCircle className="h-4 w-4" /> },
  PENDING: { label: 'Pendiente', color: 'bg-warning-muted text-warning-muted-foreground', icon: <Clock className="h-4 w-4" /> },
  IN_REVIEW: { label: 'En revisión', color: 'bg-info-muted text-info-muted-foreground', icon: <FileCheck className="h-4 w-4" /> },
  APPROVED: { label: 'Aprobado', color: 'bg-success-muted text-success', icon: <CheckCircle className="h-4 w-4" /> },
  REJECTED: { label: 'Rechazado', color: 'bg-destructive/10 text-destructive', icon: <XCircle className="h-4 w-4" /> },
  RETURNED_TO_PRODUCTION: { label: 'Retorno confirmado', color: 'bg-success-muted text-success', icon: <CheckCircle className="h-4 w-4" /> },
};

const evidenceLevelLabels: Record<string, string> = {
  OPTIONAL: 'Opcional',
  BASIC: 'Básica (1 evidencia)',
  STANDARD: 'Estándar (evidencia + checklist)',
  COMPLETE: 'Completa (todo requerido)',
};

const reasonLabels: Record<string, string> = {
  SAFETY: 'Relacionado con seguridad',
  HIGH_PRIORITY: 'Alta prioridad (P1/P2)',
  HIGH_CRITICALITY: 'Activo crítico + parada',
  HIGH_DOWNTIME: 'Downtime excesivo',
  RECURRENCE: 'Falla recurrente',
};

// Checklist por defecto
const defaultChecklist = [
  { id: '1', label: 'Trabajo completado según procedimiento', checked: false },
  { id: '2', label: 'Área de trabajo limpia y ordenada', checked: false },
  { id: '3', label: 'Herramientas y materiales devueltos', checked: false },
  { id: '4', label: 'Máquina probada y funcionando correctamente', checked: false },
  { id: '5', label: 'Sin fugas, ruidos anormales o vibraciones', checked: false },
];

export function QAPanel({ workOrderId, className }: QAPanelProps) {
  const [notes, setNotes] = useState('');
  const [checklist, setChecklist] = useState(defaultChecklist);
  const [confirmReturn, setConfirmReturn] = useState(false);

  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['work-order-qa', workOrderId],
    queryFn: async () => {
      const res = await fetch(`/api/work-orders/${workOrderId}/qa`);
      if (!res.ok) throw new Error('Error al cargar QA');
      return res.json();
    },
  });

  const createQAMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/work-orders/${workOrderId}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear QA');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-order-qa', workOrderId] });
      toast.success(data.message);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateQAMutation = useMutation({
    mutationFn: async (updateData: any) => {
      const res = await fetch(`/api/work-orders/${workOrderId}/qa`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al actualizar QA');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['work-order-qa', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
      toast.success(data.message);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleApprove = () => {
    const allChecked = checklist.every(item => item.checked);
    if (!allChecked) {
      toast.error('Debe completar todos los items del checklist');
      return;
    }

    updateQAMutation.mutate({
      status: 'APPROVED',
      checklist,
      notes,
      confirmReturnToProduction: confirmReturn,
    });
  };

  const handleReject = () => {
    if (!notes.trim()) {
      toast.error('Debe indicar el motivo del rechazo');
      return;
    }

    updateQAMutation.mutate({
      status: 'REJECTED',
      notes,
      checklist,
    });
  };

  const handleChecklistChange = (id: string, checked: boolean) => {
    setChecklist(prev => prev.map(item =>
      item.id === id ? { ...item, checked } : item
    ));
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn('p-4', className)}>
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>Error al cargar QA</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
          <RefreshCw className="h-4 w-4 mr-1" />
          Reintentar
        </Button>
      </Card>
    );
  }

  const { qualityAssurance, qaRequirement } = data?.data || {};

  // Si no existe QA aún
  if (!qualityAssurance) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Control de Calidad
          </CardTitle>
        </CardHeader>
        <CardContent>
          {qaRequirement ? (
            <div className="space-y-4">
              <div className={cn(
                'p-3 rounded-lg',
                qaRequirement.required ? 'bg-warning-muted border border-warning-muted' : 'bg-muted'
              )}>
                {qaRequirement.required ? (
                  <>
                    <div className="flex items-center gap-2 font-medium text-warning-muted-foreground">
                      <AlertTriangle className="h-4 w-4" />
                      QA Requerido
                    </div>
                    <p className="text-sm text-warning-muted-foreground mt-1">
                      {reasonLabels[qaRequirement.reason] || qaRequirement.reason}
                    </p>
                    <p className="text-xs text-warning-muted-foreground mt-2">
                      Nivel de evidencia: {evidenceLevelLabels[qaRequirement.evidenceLevel]}
                    </p>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle className="h-4 w-4" />
                    QA no requerido para esta orden
                  </div>
                )}
              </div>

              <Button
                onClick={() => createQAMutation.mutate()}
                disabled={createQAMutation.isPending}
              >
                {createQAMutation.isPending ? 'Iniciando...' : 'Iniciar QA'}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Cargando información de QA...
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // QA existe
  const statusInfo = statusConfig[qualityAssurance.status] || statusConfig.PENDING;
  const isEditable = ['PENDING', 'IN_REVIEW'].includes(qualityAssurance.status);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Control de Calidad
          </CardTitle>
          <Badge className={statusInfo.color}>
            {statusInfo.icon}
            <span className="ml-1">{statusInfo.label}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info de requerimiento */}
        {qualityAssurance.isRequired && qualityAssurance.requiredReason && (
          <div className="p-2 bg-warning-muted rounded text-sm">
            <span className="font-medium">Motivo: </span>
            {reasonLabels[qualityAssurance.requiredReason] || qualityAssurance.requiredReason}
          </div>
        )}

        {/* Nivel de evidencia */}
        <div className="text-sm">
          <span className="font-medium">Evidencia requerida: </span>
          {evidenceLevelLabels[qualityAssurance.evidenceRequired] || 'Opcional'}
        </div>

        {/* Checklist */}
        {isEditable && (
          <div className="space-y-3">
            <Label>Checklist de Verificación</Label>
            {checklist.map(item => (
              <div key={item.id} className="flex items-center gap-3">
                <Checkbox
                  id={item.id}
                  checked={item.checked}
                  onCheckedChange={(checked) => handleChecklistChange(item.id, checked as boolean)}
                />
                <label htmlFor={item.id} className="text-sm cursor-pointer">
                  {item.label}
                </label>
              </div>
            ))}
          </div>
        )}

        {/* Notas */}
        {isEditable && (
          <div className="space-y-2">
            <Label>Notas del Revisor</Label>
            <Textarea
              placeholder="Observaciones o motivo de rechazo..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        )}

        {/* Confirmar retorno a producción */}
        {isEditable && (
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Checkbox
              id="confirmReturn"
              checked={confirmReturn}
              onCheckedChange={(checked) => setConfirmReturn(checked as boolean)}
            />
            <label htmlFor="confirmReturn" className="text-sm cursor-pointer">
              Confirmar Retorno a Producción
            </label>
          </div>
        )}

        {/* Verificador (si ya fue aprobado) */}
        {qualityAssurance.verifiedBy && (
          <div className="p-2 bg-success-muted rounded text-sm">
            <span className="font-medium">Verificado por: </span>
            {qualityAssurance.verifiedBy.name}
            {qualityAssurance.verifiedAt && (
              <span className="text-muted-foreground ml-2">
                ({new Date(qualityAssurance.verifiedAt).toLocaleDateString()})
              </span>
            )}
          </div>
        )}

        {/* Botones de acción */}
        {isEditable && (
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleReject}
              disabled={updateQAMutation.isPending}
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Rechazar
            </Button>
            <Button
              onClick={handleApprove}
              disabled={updateQAMutation.isPending}
              className="flex-1"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Aprobar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default QAPanel;
