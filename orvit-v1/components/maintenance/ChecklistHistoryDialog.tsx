'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Eye,
  Calendar,
  User,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ChecklistExecutionHistory {
  id: number;
  checklistId: number;
  checklistTitle: string;
  executedAt: string;
  executedBy: string;
  status: 'COMPLETED' | 'PARTIALLY_COMPLETED';
  completedItems: number;
  totalItems: number;
  executionTime: number;
  justifications?: Array<{
    itemTitle: string;
    justification: string;
    skippedAt: string;
  }>;
}

interface ChecklistHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: number;
  sectorId: number;
}

export default function ChecklistHistoryDialog({
  isOpen,
  onClose,
  companyId,
  sectorId
}: ChecklistHistoryDialogProps) {
  const [history, setHistory] = useState<ChecklistExecutionHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<ChecklistExecutionHistory | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchChecklistHistory();
    }
  }, [isOpen, companyId, sectorId]);

  const fetchChecklistHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/maintenance/checklists/history?companyId=${companyId}&sectorId=${sectorId}`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
      } else {
        console.error('Error fetching checklist history');
      }
    } catch (error) {
      console.error('Error fetching checklist history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatExecutionTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'PARTIALLY_COMPLETED':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge className="bg-green-100 text-green-800">Completado</Badge>;
      case 'PARTIALLY_COMPLETED':
        return <Badge className="bg-orange-100 text-orange-800">Completado Parcialmente</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Historial de Checklists
            </DialogTitle>
            <DialogDescription>
              Revisa el historial de ejecuciones de checklists y sus justificaciones
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">Cargando historial...</div>
              </div>
            ) : history.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-gray-500">No hay historial de checklists disponible</div>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((execution) => (
                  <Card key={execution.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusIcon(execution.status)}
                            <h3 className="font-medium text-gray-900">{execution.checklistTitle}</h3>
                            {getStatusBadge(execution.status)}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{format(new Date(execution.executedAt), 'dd/MM/yyyy HH:mm', { locale: es })}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              <span>{execution.executedBy}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <CheckCircle className="h-4 w-4" />
                              <span>{execution.completedItems}/{execution.totalItems} items</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{formatExecutionTime(execution.executionTime)}</span>
                            </div>
                          </div>

                          {execution.status === 'PARTIALLY_COMPLETED' && execution.justifications && (
                            <div className="mt-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedExecution(execution)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Ver Justificaciones
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Dialogo de detalles de justificaciones */}
      <Dialog open={!!selectedExecution} onOpenChange={() => setSelectedExecution(null)}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Justificaciones - {selectedExecution?.checklistTitle}
            </DialogTitle>
            <DialogDescription>
              Items no completados y sus justificaciones
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            {selectedExecution?.justifications && (
              <div className="space-y-4">
                {selectedExecution.justifications.map((justification, index) => (
                  <Card key={index} className="border-orange-200 bg-orange-50">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">{justification.itemTitle}</h4>
                          <Badge variant="destructive" className="text-xs">
                            No Completado
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">
                            Justificacion:
                          </label>
                          <p className="text-sm text-gray-600 bg-white p-3 rounded border">
                            {justification.justification}
                          </p>
                        </div>

                        <div className="text-xs text-gray-500">
                          Saltado el: {format(new Date(justification.skippedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button size="sm" onClick={() => setSelectedExecution(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
