'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Eye,
  Calendar,
  User,
  FileText,
  X
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
  executionDetails?: {
    completed: Array<{
      id: string;
      title: string;
      status: string;
      completedAt: string;
      maintenanceId?: number;
    }>;
    incomplete: Array<{
      id: string;
      title: string;
      status: string;
      justification: string;
      skippedAt: string;
      maintenanceId?: number;
    }>;
  };
}

interface ChecklistHistoryTabProps {
  companyId: number;
  sectorId: number;
  refreshTrigger?: number; // Para forzar refresco desde el padre
}

export default function ChecklistHistoryTab({
  companyId,
  sectorId,
  refreshTrigger
}: ChecklistHistoryTabProps) {
  const [history, setHistory] = useState<ChecklistExecutionHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<ChecklistExecutionHistory | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'details'>('summary');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 20;
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const fetchChecklistHistory = useCallback(async (pageToLoad: number, replace = false) => {
    if (replace) {
      setLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const sectorQuery =
        typeof sectorId === 'number' ? `&sectorId=${sectorId}` : '';
      console.log(
        '🔍 ChecklistHistoryTab: Fetching history page',
        pageToLoad,
        'for companyId:',
        companyId,
        'sectorId:',
        sectorId
      );
      const response = await fetch(
        `/api/maintenance/checklists/history?companyId=${companyId}${sectorQuery}&page=${pageToLoad}&pageSize=${ITEMS_PER_PAGE}`
      );
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 ChecklistHistoryTab: Received data:', data);
        setHistory(prev =>
          replace ? data.history || [] : [...prev, ...(data.history || [])]
        );
        setHasMore(data.hasMore ?? false);
        setPage(pageToLoad);
      } else {
        console.error('Error fetching checklist history');
      }
    } catch (error) {
      console.error('Error fetching checklist history:', error);
    } finally {
      if (replace) {
        setLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  }, [companyId, sectorId]);

  useEffect(() => {
    setHistory([]);
    setPage(0);
    setHasMore(true);
    fetchChecklistHistory(0, true);
  }, [companyId, sectorId, refreshTrigger, fetchChecklistHistory]);

  const loadMore = useCallback(() => {
    if (!hasMore) return;
    if (loading || isLoadingMore) return;
    fetchChecklistHistory(page + 1);
  }, [fetchChecklistHistory, hasMore, loading, isLoadingMore, page]);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMore();
        }
      },
      { root: null, rootMargin: '200px' }
    );

    observer.observe(element);
    return () => observer.unobserve(element);
  }, [loadMore, hasMore]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Cargando historial...</div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Sin historial disponible</h3>
          <p className="text-gray-600">No hay ejecuciones de checklists registradas</p>
        </CardContent>
      </Card>
    );
  }

  return (
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

                                        <div className="mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedExecution(execution)}
                            className="text-xs"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            {execution.status === 'PARTIALLY_COMPLETED' ? 'Ver Detalles' : 'Ver Ejecución'}
                          </Button>
                        </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <div
        ref={loadMoreRef}
        className="h-10 flex items-center justify-center text-xs text-muted-foreground"
      >
        {loading || isLoadingMore
          ? 'Cargando...'
          : hasMore
            ? 'Desplazá para cargar más...'
            : history.length > 0
              ? 'Fin de la lista'
              : ''}
      </div>

      {/* Modal de justificaciones */}
      {selectedExecution && typeof window !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={() => setSelectedExecution(null)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-full">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Detalles de Ejecución - {selectedExecution.checklistTitle}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {selectedExecution.status === 'PARTIALLY_COMPLETED' 
                      ? 'Items completados y no completados con justificaciones' 
                      : 'Resumen completo de la ejecución del checklist'
                    }
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedExecution(null)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Tabs para mostrar diferentes vistas */}
              <div className="flex space-x-1 mb-6 bg-gray-100 rounded-lg p-1">
                <button
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'summary' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  onClick={() => setActiveTab('summary')}
                >
                  Resumen
                </button>
                <button
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'details' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  onClick={() => setActiveTab('details')}
                >
                  Detalles de Ejecución
                </button>
              </div>

              {/* Tab de Resumen */}
              {activeTab === 'summary' && (
                <div className="space-y-4">
                  {/* Estadísticas generales */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-medium text-green-800">Completados</span>
                      </div>
                      <p className="text-2xl font-bold text-green-900 mt-1">
                        {selectedExecution.completedItems}
                      </p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        <span className="text-sm font-medium text-red-800">No Completados</span>
                      </div>
                      <p className="text-2xl font-bold text-red-900 mt-1">
                        {selectedExecution.totalItems - selectedExecution.completedItems}
                      </p>
                    </div>
                  </div>

                  {/* Justificaciones */}
                  {selectedExecution.justifications && selectedExecution.justifications.length > 0 ? (
                    <div className="space-y-4">
                      <h4 className="font-medium text-gray-900">Items No Completados</h4>
                      {selectedExecution.justifications.map((justification, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h5 className="font-medium text-gray-900 text-sm">
                                {justification.itemTitle}
                              </h5>
                              <Badge variant="destructive" className="text-xs px-2 py-1">
                                No Completado
                              </Badge>
                            </div>
                            
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                                Justificación
                              </label>
                              <div className="bg-white rounded-md border border-gray-300 p-3 min-h-[60px]">
                                <p className="text-sm text-gray-700 leading-relaxed">
                                  {justification.justification || 'Sin justificación proporcionada'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Calendar className="h-3 w-3" />
                              <span>
                                Saltado el: {format(new Date(justification.skippedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-gray-400 mb-2">
                        <CheckCircle className="h-12 w-12 mx-auto" />
                      </div>
                      <p className="text-gray-500">Todos los items fueron completados exitosamente</p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab de Detalles de Ejecución */}
              {activeTab === 'details' && selectedExecution.executionDetails && (
                <div className="space-y-6">
                  {/* Items Completados */}
                  {selectedExecution.executionDetails.completed && selectedExecution.executionDetails.completed.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Items Completados ({selectedExecution.executionDetails.completed.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedExecution.executionDetails.completed.map((item, index) => (
                          <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <h5 className="font-medium text-green-900 text-sm">{item.title}</h5>
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                Completado
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-green-600 mt-1">
                              <Calendar className="h-3 w-3" />
                              <span>
                                Completado el: {format(new Date(item.completedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Items No Completados */}
                  {selectedExecution.executionDetails.incomplete && selectedExecution.executionDetails.incomplete.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        Items No Completados ({selectedExecution.executionDetails.incomplete.length})
                      </h4>
                      <div className="space-y-2">
                        {selectedExecution.executionDetails.incomplete.map((item, index) => (
                          <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <h5 className="font-medium text-red-900 text-sm">{item.title}</h5>
                              <Badge variant="destructive" className="text-xs">
                                No Completado
                              </Badge>
                            </div>
                            <div className="space-y-2 mt-2">
                              <div>
                                <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                                  Justificación
                                </label>
                                <div className="bg-white rounded-md border border-gray-300 p-2 mt-1">
                                  <p className="text-sm text-gray-700">
                                    {item.justification || 'Sin justificación'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-red-600">
                                <Calendar className="h-3 w-3" />
                                <span>
                                  Saltado el: {format(new Date(item.skippedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!selectedExecution.executionDetails || 
                    (!selectedExecution.executionDetails.completed && !selectedExecution.executionDetails.incomplete)) && (
                    <div className="text-center py-8">
                      <div className="text-gray-400 mb-2">
                        <FileText className="h-12 w-12 mx-auto" />
                      </div>
                      <p className="text-gray-500">No hay detalles de ejecución disponibles</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
              <div className="text-xs text-gray-400">
                ID de ejecución: {selectedExecution.id}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="px-4 text-xs"
                  onClick={() => {
                    // Abrir página dedicada de impresión de ejecuciones
                    window.open(`/maintenance/checklist-print/${selectedExecution.id}`, '_blank');
                  }}
                >
                  Imprimir ejecución
                </Button>
                <Button 
                  onClick={() => setSelectedExecution(null)}
                  className="px-6"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
                 </div>,
         document.body
       )}
    </div>
  );
}
