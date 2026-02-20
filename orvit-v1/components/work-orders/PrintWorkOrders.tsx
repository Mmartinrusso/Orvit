'use client';

import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Printer, Download, User, Calendar, MapPin, Wrench, Clock, FileText } from 'lucide-react';
import { WorkOrder, WorkOrderStatus, Priority } from '@/lib/types';

interface PrintWorkOrdersProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  workOrders: WorkOrder[];
  availableUsers: Array<{id: number, name: string, type: 'user' | 'worker'}>;
}

export default function PrintWorkOrders({ 
  isOpen, 
  onOpenChange, 
  workOrders, 
  availableUsers 
}: PrintWorkOrdersProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'pending' | 'week' | 'month'>('pending');
  const printRef = useRef<HTMLDivElement>(null);

  const getFilteredOrders = () => {
    let filtered = [...workOrders];

    // Filtrar por usuario asignado
    if (selectedUserId !== 'all') {
      const [type, id] = selectedUserId.split('-');
      filtered = filtered.filter(order => {
        if (type === 'user') {
          return order.assignedToId === parseInt(id);
        } else if (type === 'worker') {
          return order.assignedWorkerId === parseInt(id);
        }
        return false;
      });
    }

    // Filtrar por fecha
    const now = new Date();
    if (dateFilter === 'pending') {
      filtered = filtered.filter(order => 
        order.status === WorkOrderStatus.PENDING || 
        order.status === WorkOrderStatus.IN_PROGRESS ||
        order.status === WorkOrderStatus.ON_HOLD
      );
    } else if (dateFilter === 'week') {
      const weekFromNow = new Date();
      weekFromNow.setDate(now.getDate() + 7);
      filtered = filtered.filter(order => 
        order.scheduledDate && 
        new Date(order.scheduledDate) <= weekFromNow &&
        new Date(order.scheduledDate) >= now
      );
    } else if (dateFilter === 'month') {
      const monthFromNow = new Date();
      monthFromNow.setMonth(now.getMonth() + 1);
      filtered = filtered.filter(order => 
        order.scheduledDate && 
        new Date(order.scheduledDate) <= monthFromNow &&
        new Date(order.scheduledDate) >= now
      );
    }

    // Ordenar por fecha programada
    return filtered.sort((a, b) => {
      if (!a.scheduledDate) return 1;
      if (!b.scheduledDate) return -1;
      return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
    });
  };

  const getSelectedUserName = () => {
    if (selectedUserId === 'all') return 'Todos los usuarios';
    
    const [type, id] = selectedUserId.split('-');
    const user = availableUsers.find(u => u.id === parseInt(id) && u.type === type);
    return user ? `${user.name} (${user.type === 'user' ? 'Usuario' : 'Operario'})` : 'Usuario no encontrado';
  };

  const getStatusBadge = (status: WorkOrderStatus) => {
    const statusConfig = {
      [WorkOrderStatus.PENDING]: { label: 'Pendiente', color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted' },
      [WorkOrderStatus.IN_PROGRESS]: { label: 'En Proceso', color: 'bg-info-muted text-info-muted-foreground border-info-muted' },
      [WorkOrderStatus.COMPLETED]: { label: 'Completada', color: 'bg-success-muted text-success border-success-muted' },
      [WorkOrderStatus.CANCELLED]: { label: 'Cancelada', color: 'bg-destructive/10 text-destructive border-destructive/20' },
      [WorkOrderStatus.ON_HOLD]: { label: 'En Espera', color: 'bg-muted text-muted-foreground border-border' },
    };
    
    return statusConfig[status] || statusConfig[WorkOrderStatus.PENDING];
  };

  const getPriorityBadge = (priority: Priority) => {
    const priorityConfig = {
      [Priority.LOW]: { label: 'Baja', color: 'bg-success-muted text-success border-success-muted' },
      [Priority.MEDIUM]: { label: 'Media', color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted' },
      [Priority.HIGH]: { label: 'Alta', color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted' },
      [Priority.URGENT]: { label: 'Urgente', color: 'bg-destructive/10 text-destructive border-destructive/20' },
    };
    
    return priorityConfig[priority] || priorityConfig[Priority.MEDIUM];
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printContent = printRef.current.innerHTML;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    doc.open();
    doc.write(`<html>
      <head>
        <title>Órdenes de Trabajo</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.4; color: #333; }
          .print-container { padding: 20px; max-width: 800px; margin: 0 auto; }
          .header { border-bottom: 2px solid #333; margin-bottom: 20px; padding-bottom: 15px; }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header .subtitle { font-size: 14px; color: #666; margin-bottom: 10px; }
          .summary { display: flex; justify-content: space-between; margin-bottom: 20px; padding: 10px; background: #f5f5f5; border-radius: 4px; }
          .work-order { border: 1px solid #ddd; margin-bottom: 15px; padding: 15px; border-radius: 4px; page-break-inside: avoid; }
          .work-order-header { display: flex; justify-content: between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
          .work-order-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 5px; }
          .work-order-id { font-size: 12px; color: #666; }
          .badges { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: bold; border: 1px solid; }
          .work-order-details { margin-bottom: 10px; }
          .detail-row { display: flex; margin-bottom: 5px; }
          .detail-label { width: 120px; font-weight: bold; color: #555; }
          .detail-value { flex: 1; }
          .description { margin-top: 10px; padding: 8px; background: #f9f9f9; border-radius: 3px; }
          .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #666; }
          @media print {
            body { print-color-adjust: exact; margin: 0; padding: 20px; }
            .work-order { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>${printContent}</body>
    </html>`);
    doc.close();

    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };

  const handleDownloadPDF = () => {
    // TODO: Implementar descarga PDF con jsPDF o puppeteer
  };

  const filteredOrders = getFilteredOrders();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Imprimir Órdenes de Trabajo
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
        {/* Controles de filtrado */}
        <div className="space-y-4 p-4 bg-muted rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Usuario Asignado</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los usuarios</SelectItem>
                  {availableUsers.map((user) => (
                    <SelectItem key={`${user.type}-${user.id}`} value={`${user.type}-${user.id}`}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{user.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({user.type === 'user' ? 'Usuario' : 'Operario'})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Período</label>
              <Select value={dateFilter} onValueChange={(value: 'all' | 'pending' | 'week' | 'month') => setDateFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las órdenes</SelectItem>
                  <SelectItem value="pending">Solo pendientes</SelectItem>
                  <SelectItem value="week">Próxima semana</SelectItem>
                  <SelectItem value="month">Próximo mes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handlePrint} disabled={filteredOrders.length === 0}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir ({filteredOrders.length} órdenes)
            </Button>
            <Button variant="outline" onClick={handleDownloadPDF} disabled={filteredOrders.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
          </div>
        </div>

        {/* Vista previa para impresión */}
        <div ref={printRef} className="print-container">
          <div className="header">
            <h1>Órdenes de Trabajo</h1>
            <div className="subtitle">
              Asignado a: {getSelectedUserName()}
            </div>
            <div className="subtitle">
              Período: {dateFilter === 'all' ? 'Todas' : 
                        dateFilter === 'pending' ? 'Solo pendientes' :
                        dateFilter === 'week' ? 'Próxima semana' : 'Próximo mes'}
            </div>
            <div className="subtitle">
              Generado el: {new Date().toLocaleDateString('es-ES', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>

          <div className="summary">
            <div><strong>Total de órdenes:</strong> {filteredOrders.length}</div>
            <div><strong>Pendientes:</strong> {filteredOrders.filter(o => o.status === WorkOrderStatus.PENDING).length}</div>
            <div><strong>En proceso:</strong> {filteredOrders.filter(o => o.status === WorkOrderStatus.IN_PROGRESS).length}</div>
            <div><strong>Vencidas:</strong> {filteredOrders.filter(o => o.scheduledDate && new Date(o.scheduledDate) < new Date() && o.status !== WorkOrderStatus.COMPLETED).length}</div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No hay órdenes de trabajo que coincidan con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <div key={order.id} className="work-order">
                  <div className="work-order-header">
                    <div>
                      <div className="work-order-title">{order.title}</div>
                      <div className="work-order-id">OT-{order.id}</div>
                    </div>
                  </div>

                  <div className="badges">
                    <span className={cn('badge', getStatusBadge(order.status).color)}>
                      {getStatusBadge(order.status).label}
                    </span>
                    <span className={cn('badge', getPriorityBadge(order.priority).color)}>
                      {getPriorityBadge(order.priority).label}
                    </span>
                    {order.scheduledDate && new Date(order.scheduledDate) < new Date() && order.status !== WorkOrderStatus.COMPLETED && (
                      <span className="badge bg-destructive/10 text-destructive border-destructive/20">
                        VENCIDA
                      </span>
                    )}
                  </div>

                  <div className="work-order-details">
                    <div className="detail-row">
                      <span className="detail-label">Máquina:</span>
                      <span className="detail-value">{order.machine?.name || 'Sin máquina'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Ubicación:</span>
                      <span className="detail-value">
                        {order.sector ? `${order.sector.area?.name} - ${order.sector.name}` : 'Sin ubicación'}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Tipo:</span>
                      <span className="detail-value">{order.type}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Fecha programada:</span>
                      <span className="detail-value">
                        {order.scheduledDate 
                          ? new Date(order.scheduledDate).toLocaleDateString('es-ES')
                          : 'Sin fecha'
                        }
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Solicitado por:</span>
                      <span className="detail-value">{order.createdBy?.name || 'Usuario desconocido'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Creado:</span>
                      <span className="detail-value">
                        {new Date(order.createdAt).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                  </div>

                  {order.description && (
                    <div className="description">
                      <strong>Descripción:</strong><br />
                      {order.description}
                    </div>
                  )}

                  {order.notes && (
                    <div className="description">
                      <strong>Notas:</strong><br />
                      {order.notes}
                    </div>
                  )}

                  <div style={{ marginTop: '15px', padding: '10px', border: '1px dashed #ccc', backgroundColor: '#fafafa' }}>
                    <strong>Observaciones del técnico:</strong>
                    <div style={{ height: '40px', borderBottom: '1px solid #ddd', marginTop: '5px' }}></div>
                    <div style={{ fontSize: '10px', marginTop: '5px', color: '#666' }}>
                      Firma: _________________ Fecha: _________________ Hora: _________
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="footer">
            <p>ORVIT - Documento generado automáticamente</p>
            <p>Página impresa el {new Date().toLocaleString('es-ES')}</p>
          </div>
        </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
} 