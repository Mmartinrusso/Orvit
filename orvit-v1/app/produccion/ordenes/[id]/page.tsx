'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  Package,
  Calendar,
  Factory,
  User,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  BarChart3,
  History,
  Loader2,
  AlertCircle,
  Boxes,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/components/providers/ThemeProvider';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { StockConsumptionPanel } from '@/components/production/stock-consumption-panel';
import { useCompany } from '@/contexts/CompanyContext';

interface ProductionOrder {
  id: number;
  code: string;
  status: string;
  priority: string;
  plannedQuantity: number;
  producedQuantity: number;
  scrapQuantity: number;
  reworkQuantity: number;
  targetUom: string;
  plannedStartDate: string;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  notes: string | null;
  product: {
    id: string;
    name: string;
    code: string;
    unit: string;
  };
  recipe: {
    id: string;
    name: string;
  } | null;
  workCenter: {
    id: number;
    code: string;
    name: string;
    type: string;
  } | null;
  sector: {
    id: number;
    name: string;
  } | null;
  responsible: {
    id: number;
    name: string;
    email: string;
  } | null;
  createdBy: {
    id: number;
    name: string;
  };
  dailyReports: any[];
  downtimes: any[];
  batchLots: any[];
  events: any[];
  metrics: {
    completionPercentage: number;
    scrapPercentage: number;
    totalDowntimeMinutes: number;
    totalGoodQuantity: number;
    totalScrap: number;
    totalRework: number;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Borrador', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  RELEASED: { label: 'Liberada', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  IN_PROGRESS: { label: 'En Progreso', color: 'text-green-600', bgColor: 'bg-green-100' },
  PAUSED: { label: 'Pausada', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  COMPLETED: { label: 'Completada', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  CANCELLED: { label: 'Cancelada', color: 'text-red-600', bgColor: 'bg-red-100' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Baja', color: 'text-muted-foreground' },
  NORMAL: { label: 'Normal', color: 'text-blue-500' },
  HIGH: { label: 'Alta', color: 'text-orange-500' },
  URGENT: { label: 'Urgente', color: 'text-red-500' },
};

export default function ProductionOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const { theme } = useTheme();
  const { currentCompany } = useCompany();

  const orderId = params.id as string;
  const isEditMode = searchParams.get('edit') === 'true';

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusChangeDialog, setStatusChangeDialog] = useState<{ open: boolean; status: string }>({
    open: false,
    status: '',
  });

  const canEdit = hasPermission('produccion.ordenes.edit');
  const canStart = hasPermission('produccion.ordenes.start');
  const canComplete = hasPermission('produccion.ordenes.complete');

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/production/orders/${orderId}`);
      const data = await res.json();

      if (data.success) {
        setOrder(data.order);
      } else {
        toast.error(data.error || 'Error al cargar la orden');
        router.push('/produccion/ordenes');
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      toast.error('Error al cargar la orden');
    } finally {
      setLoading(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/production/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message || 'Estado actualizado');
        setStatusChangeDialog({ open: false, status: '' });
        fetchOrder();
      } else {
        toast.error(data.error || 'Error al actualizar estado');
      }
    } catch (error) {
      console.error('Error changing status:', error);
      toast.error('Error al actualizar estado');
    }
  };

  if (loading) {
    return (
      <div className="px-4 md:px-6 py-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Cargando orden...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="px-4 md:px-6 py-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto text-red-400" />
          <p className="mt-2 text-muted-foreground">Orden no encontrada</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/produccion/ordenes')}
          >
            Volver a órdenes
          </Button>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[order.status];
  const priorityConfig = PRIORITY_CONFIG[order.priority];

  return (
    <div className="px-4 md:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/produccion/ordenes')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">
                {order.code}
              </h1>
              <Badge className={`${statusConfig.bgColor} ${statusConfig.color}`}>
                {statusConfig.label}
              </Badge>
              <Badge variant="outline" className={priorityConfig.color}>
                {priorityConfig.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {order.product.name} ({order.product.code})
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {order.status === 'DRAFT' && canStart && (
            <Button
              variant="outline"
              onClick={() => setStatusChangeDialog({ open: true, status: 'RELEASED' })}
            >
              <CheckCircle2 className="h-4 w-4 mr-2 text-blue-500" />
              Liberar
            </Button>
          )}

          {order.status === 'RELEASED' && canStart && (
            <Button
              onClick={() => setStatusChangeDialog({ open: true, status: 'IN_PROGRESS' })}
            >
              <Play className="h-4 w-4 mr-2" />
              Iniciar Producción
            </Button>
          )}

          {order.status === 'IN_PROGRESS' && (
            <>
              <Button
                variant="outline"
                onClick={() => setStatusChangeDialog({ open: true, status: 'PAUSED' })}
              >
                <Pause className="h-4 w-4 mr-2 text-yellow-500" />
                Pausar
              </Button>
              {canComplete && (
                <Button
                  onClick={() => setStatusChangeDialog({ open: true, status: 'COMPLETED' })}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Completar
                </Button>
              )}
            </>
          )}

          {order.status === 'PAUSED' && canStart && (
            <Button
              onClick={() => setStatusChangeDialog({ open: true, status: 'IN_PROGRESS' })}
            >
              <Play className="h-4 w-4 mr-2" />
              Reanudar
            </Button>
          )}

          {canEdit && ['DRAFT', 'RELEASED'].includes(order.status) && (
            <Button
              variant="outline"
              onClick={() => router.push(`/produccion/ordenes/${order.id}?edit=true`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
        </div>
      </div>

      {/* Progress Card */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">
                Progreso
              </p>
              <div className="mt-2">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">
                    {Number(order.producedQuantity).toLocaleString()} / {Number(order.plannedQuantity).toLocaleString()} {order.targetUom}
                  </span>
                  <span>{order.metrics.completionPercentage.toFixed(1)}%</span>
                </div>
                <Progress value={order.metrics.completionPercentage} className="h-3" />
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Scrap
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-2xl font-bold ${order.metrics.scrapPercentage > 5 ? 'text-red-500' : ''}`}>
                  {order.metrics.scrapPercentage.toFixed(1)}%
                </span>
                <span className="text-sm text-muted-foreground">
                  ({Number(order.scrapQuantity).toLocaleString()} {order.targetUom})
                </span>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Paradas
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold">
                  {order.metrics.totalDowntimeMinutes}
                </span>
                <span className="text-sm text-muted-foreground">minutos</span>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Partes Diarios
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold">
                  {order.dailyReports.length}
                </span>
                <span className="text-sm text-muted-foreground">registrados</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">
            <FileText className="h-4 w-4 mr-2" />
            Detalles
          </TabsTrigger>
          <TabsTrigger value="reports">
            <BarChart3 className="h-4 w-4 mr-2" />
            Partes ({order.dailyReports.length})
          </TabsTrigger>
          <TabsTrigger value="downtimes">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Paradas ({order.downtimes.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            Historial
          </TabsTrigger>
          <TabsTrigger value="stock">
            <Boxes className="h-4 w-4 mr-2" />
            Stock
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-5 w-5" />
                  Producto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Producto</p>
                  <p className="font-medium">{order.product.name}</p>
                  <p className="text-sm text-muted-foreground">{order.product.code}</p>
                </div>
                {order.recipe && (
                  <div>
                    <p className="text-sm text-muted-foreground">Receta</p>
                    <p className="font-medium">{order.recipe.name}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Cantidad Planificada</p>
                  <p className="font-medium">
                    {Number(order.plannedQuantity).toLocaleString()} {order.targetUom}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="h-5 w-5" />
                  Programación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Inicio Planificado</p>
                  <p className="font-medium">
                    {format(new Date(order.plannedStartDate), "dd/MM/yyyy HH:mm", { locale: es })}
                  </p>
                </div>
                {order.plannedEndDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Fin Planificado</p>
                    <p className="font-medium">
                      {format(new Date(order.plannedEndDate), "dd/MM/yyyy HH:mm", { locale: es })}
                    </p>
                  </div>
                )}
                {order.actualStartDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Inicio Real</p>
                    <p className="font-medium text-green-600">
                      {format(new Date(order.actualStartDate), "dd/MM/yyyy HH:mm", { locale: es })}
                    </p>
                  </div>
                )}
                {order.actualEndDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Fin Real</p>
                    <p className="font-medium text-green-600">
                      {format(new Date(order.actualEndDate), "dd/MM/yyyy HH:mm", { locale: es })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Factory className="h-5 w-5" />
                  Asignación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Centro de Trabajo</p>
                  <p className="font-medium">
                    {order.workCenter ? (
                      <>
                        {order.workCenter.name}
                        <span className="text-muted-foreground ml-2">({order.workCenter.type})</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">No asignado</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sector</p>
                  <p className="font-medium">
                    {order.sector?.name || <span className="text-muted-foreground">No asignado</span>}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Responsable</p>
                  <p className="font-medium">
                    {order.responsible?.name || <span className="text-muted-foreground">No asignado</span>}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="h-5 w-5" />
                  Información
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Creado por</p>
                  <p className="font-medium">{order.createdBy.name}</p>
                </div>
                {order.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Notas</p>
                    <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Partes Diarios</CardTitle>
              <CardDescription>
                Registros de producción asociados a esta orden
              </CardDescription>
            </CardHeader>
            <CardContent>
              {order.dailyReports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No hay partes diarios registrados</p>
                  {order.status === 'IN_PROGRESS' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => router.push(`/produccion/parte-diario?orderId=${order.id}`)}
                    >
                      Registrar Parte
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {order.dailyReports.map((report: any) => (
                    <div
                      key={report.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => router.push(`/produccion/parte-diario/${report.id}`)}
                    >
                      <div>
                        <p className="font-medium">
                          {format(new Date(report.date), "dd/MM/yyyy", { locale: es })}
                          {report.shift && ` - ${report.shift.name}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Operador: {report.operator?.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-green-600">
                          +{Number(report.goodQuantity).toLocaleString()} {order.targetUom}
                        </p>
                        {Number(report.scrapQuantity) > 0 && (
                          <p className="text-sm text-red-500">
                            Scrap: {Number(report.scrapQuantity).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Downtimes Tab */}
        <TabsContent value="downtimes">
          <Card>
            <CardHeader>
              <CardTitle>Paradas</CardTitle>
              <CardDescription>
                Registro de paradas de producción
              </CardDescription>
            </CardHeader>
            <CardContent>
              {order.downtimes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No hay paradas registradas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {order.downtimes.map((downtime: any) => (
                    <div
                      key={downtime.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">
                          {downtime.reasonCode?.name || 'Sin código'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(downtime.startTime), "dd/MM HH:mm", { locale: es })}
                          {downtime.endTime && ` - ${format(new Date(downtime.endTime), "HH:mm", { locale: es })}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={downtime.type === 'PLANNED' ? 'secondary' : 'destructive'}>
                          {downtime.type === 'PLANNED' ? 'Planificada' : 'No Planificada'}
                        </Badge>
                        <p className="text-sm font-medium mt-1">
                          {downtime.durationMinutes || '?'} min
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Eventos</CardTitle>
              <CardDescription>
                Registro de cambios y acciones en la orden
              </CardDescription>
            </CardHeader>
            <CardContent>
              {order.events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No hay eventos registrados</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {order.events.map((event: any) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 mt-2 rounded-full bg-blue-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {event.eventType.replace(/_/g, ' ')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {event.performedBy?.name} - {formatDistanceToNow(new Date(event.performedAt), { addSuffix: true, locale: es })}
                        </p>
                        {event.notes && (
                          <p className="text-sm mt-1 text-gray-600">{event.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stock/Materials Tab */}
        <TabsContent value="stock">
          {currentCompany && (
            <StockConsumptionPanel
              productionOrderId={order.id}
              recipeId={order.recipe?.id}
              companyId={currentCompany.id}
              status={order.status}
              quantity={Number(order.plannedQuantity)}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Status Change Dialog */}
      <AlertDialog
        open={statusChangeDialog.open}
        onOpenChange={(open) => setStatusChangeDialog({ ...statusChangeDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cambio de estado</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de cambiar el estado de la orden a "{STATUS_CONFIG[statusChangeDialog.status]?.label}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleStatusChange(statusChangeDialog.status)}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
