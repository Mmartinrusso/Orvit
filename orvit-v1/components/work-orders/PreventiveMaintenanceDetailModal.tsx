'use client';

// ✅ OPTIMIZACIÓN: Desactivar logs en producción
const DEBUG = false;
const log = DEBUG ? console.log.bind(console) : () => {};

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  Clock, 
  Settings, 
  Wrench, 
  AlertTriangle, 
  FileText,
  Package,
  User,
  Building,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  History
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface PreventiveMaintenanceDetailModalProps {
  maintenance: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function PreventiveMaintenanceDetailModal({
  maintenance,
  isOpen,
  onClose
}: PreventiveMaintenanceDetailModalProps) {
  const [activeTab, setActiveTab] = useState('details');
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && maintenance?.id) {
      fetchMaintenanceStats();
      fetchMaintenanceHistory();
    }
  }, [isOpen, maintenance?.id]);

  const fetchMaintenanceStats = async () => {
    if (!maintenance?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/maintenance/${maintenance.id}/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching maintenance stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaintenanceHistory = async () => {
    if (!maintenance?.id) return;
    
    try {
      const response = await fetch(`/api/maintenance/history?maintenanceId=${maintenance.id}`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.data?.executions || []);
      }
    } catch (error) {
      console.error('Error fetching maintenance history:', error);
    }
  };

  if (!maintenance) return null;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW':
        return 'bg-gray-100 text-gray-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800';
      case 'URGENT':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'LOW':
        return 'Baja';
      case 'MEDIUM':
        return 'Media';
      case 'HIGH':
        return 'Alta';
      case 'URGENT':
        return 'Urgente';
      default:
        return priority;
    }
  };

  const getStatusColor = (isActive: boolean, nextDate: string) => {
    if (!isActive) return 'bg-gray-100 text-gray-800';
    
    const next = new Date(nextDate);
    const now = new Date();
    const diffDays = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'bg-red-100 text-red-800';
    if (diffDays <= 3) return 'bg-orange-100 text-orange-800';
    return 'bg-green-100 text-green-800';
  };

  const getStatusText = (isActive: boolean, nextDate: string) => {
    if (!isActive) return 'Inactivo';
    
    const next = new Date(nextDate);
    const now = new Date();
    const diffDays = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Vencido';
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Mañana';
    if (diffDays <= 3) return `En ${diffDays} días`;
    return 'Programado';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendText = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return 'Aumentando';
      case 'decreasing':
        return 'Disminuyendo';
      default:
        return 'Estable';
    }
  };

  const getDurationDisplay = (execution: any) => {
    log('🔍 getDurationDisplay - execution:', execution);
    log('🔍 actualDuration:', execution.actualDuration);
    log('🔍 actualDurationUnit:', execution.actualDurationUnit);
    
    if (!execution.actualDuration) return 'N/A';
    
    // Si tiene la unidad de tiempo específica, usarla
    if (execution.actualDurationUnit) {
      if (execution.actualDurationUnit === 'MINUTES') {
        return `${execution.actualDuration} min`;
      } else if (execution.actualDurationUnit === 'HOURS') {
        return `${execution.actualDuration}h`;
      }
    }
    
    // Si no tiene unidad específica, intentar inferir basado en el valor
    const duration = Number(execution.actualDuration);
    if (duration < 1 && duration > 0) {
      // Si es menor a 1, probablemente esté en horas (ej: 0.5h)
      return `${execution.actualDuration}h`;
    } else if (duration >= 1 && duration <= 1440) {
      // Si está entre 1 y 1440 (24h * 60min), probablemente esté en minutos
      return `${execution.actualDuration} min`;
    } else {
      // Por defecto, asumir horas
      return `${execution.actualDuration}h`;
    }
  };

  const getQuantityDisplay = (execution: any) => {
    if (!execution.actualValue) return 'N/A';
    
    const unit = execution.actualUnit;
    if (!unit) return `${execution.actualValue}`;
    
    // Convertir la unidad a texto legible
    switch (unit) {
      case 'CYCLES':
        return `${execution.actualValue} Ciclos`;
      case 'UNITS_PRODUCED':
        return `${execution.actualValue} Unidades`;
      case 'KILOMETERS':
        return `${execution.actualValue} km`;
      case 'HOURS':
        return `${execution.actualValue} h`;
      case 'DAYS':
        return `${execution.actualValue} días`;
      case 'SHIFTS':
        return `${execution.actualValue} turnos`;
      default:
        return `${execution.actualValue} ${unit}`;
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="lg" className="max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] md:max-h-[calc(100vh-4rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-600" />
            {maintenance.title}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="details">Resumen</TabsTrigger>
            <TabsTrigger value="equipment">Equipamiento</TabsTrigger>
            <TabsTrigger value="programming">Programación</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
            <TabsTrigger value="statistics">Estadísticas</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
          {/* Header con título y badges */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">{maintenance.title}</h2>
              <div className="flex items-center gap-2">
                <Badge className={getPriorityColor(maintenance.priority)}>
                  {getPriorityText(maintenance.priority)}
                </Badge>
                <Badge className={getStatusColor(maintenance.isActive, maintenance.nextMaintenanceDate)}>
                  {getStatusText(maintenance.isActive, maintenance.nextMaintenanceDate)}
                </Badge>
              </div>
            </div>
          </div>

          {/* Información general */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Equipamiento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Máquina</p>
                  <p className="font-medium">{maintenance.machineName}</p>
                </div>
                {maintenance.componentName && (
                  <div>
                    <p className="text-sm text-muted-foreground">Componente</p>
                    <p className="font-medium">{maintenance.componentName}</p>
                  </div>
                )}
                {maintenance.subcomponentNames && maintenance.subcomponentNames.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Subcomponentes</p>
                    <p className="font-medium">{maintenance.subcomponentNames.join(', ')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Programación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Frecuencia</p>
                  <p className="font-medium">Cada {maintenance.frequencyDays} días</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Próximo Mantenimiento</p>
                  <p className="font-medium">
                    {new Date(maintenance.nextMaintenanceDate).toLocaleDateString('es-ES', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duración Estimada</p>
                  <p className="font-medium">{maintenance.estimatedHours} horas</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Descripción */}
          {maintenance.description && (
            <Card>
              <CardHeader>
                <CardTitle>Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{maintenance.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Herramientas requeridas */}
          {maintenance.toolsRequired && maintenance.toolsRequired.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Herramientas Requeridas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {maintenance.toolsRequired.map((tool: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{tool.name}</p>
                        <p className="text-sm text-muted-foreground">{tool.category}</p>
                      </div>
                      <Badge variant="outline">
                        Cantidad: {tool.quantity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructivos */}
          {maintenance.instructivesFiles && maintenance.instructivesFiles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Instructivos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {maintenance.instructivesFiles.map((instructive: any, index: number) => (
                    <div 
                      key={index} 
                      className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => window.open(instructive.url, '_blank')}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-red-500" />
                        <div>
                          <p className="font-medium">{instructive.fileName}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(instructive.uploadedAt).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Alertas configuradas */}
          {maintenance.alertDaysBefore && Array.isArray(maintenance.alertDaysBefore) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Alertas Configuradas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {maintenance.alertDaysBefore.map((days: number, index: number) => (
                    <Badge key={index} variant="outline" className="bg-yellow-50 text-yellow-800">
                      {days === 0 ? 'El mismo día' : `${days} día${days > 1 ? 's' : ''} antes`}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          </TabsContent>

          <TabsContent value="equipment" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Equipamiento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Máquina</p>
                  <p className="font-medium">{maintenance.machineName}</p>
                </div>
                {maintenance.componentName && (
                  <div>
                    <p className="text-sm text-muted-foreground">Componente</p>
                    <p className="font-medium">{maintenance.componentName}</p>
                  </div>
                )}
                {maintenance.subcomponentNames && maintenance.subcomponentNames.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Subcomponentes</p>
                    <p className="font-medium">{maintenance.subcomponentNames.join(', ')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Herramientas requeridas */}
            {maintenance.toolsRequired && maintenance.toolsRequired.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Herramientas Requeridas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {maintenance.toolsRequired.map((tool: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{tool.name}</p>
                          <p className="text-sm text-muted-foreground">{tool.category}</p>
                        </div>
                        <Badge variant="outline">
                          Cantidad: {tool.quantity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="programming" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Programación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Frecuencia</p>
                  <p className="font-medium">Cada {maintenance.frequencyDays} días</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Próximo Mantenimiento</p>
                  <p className="font-medium">
                    {new Date(maintenance.nextMaintenanceDate).toLocaleDateString('es-ES', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duración Estimada</p>
                  <p className="font-medium">{maintenance.estimatedHours} horas</p>
                </div>
              </CardContent>
            </Card>

            {/* Alertas configuradas */}
            {maintenance.alertDaysBefore && Array.isArray(maintenance.alertDaysBefore) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Alertas Configuradas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {maintenance.alertDaysBefore.map((days: number, index: number) => (
                      <Badge key={index} variant="outline" className="bg-yellow-50 text-yellow-800">
                        {days === 0 ? 'El mismo día' : `${days} día${days > 1 ? 's' : ''} antes`}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Instructivos */}
            {maintenance.instructivesFiles && maintenance.instructivesFiles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Instructivos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {maintenance.instructivesFiles.map((instructive: any, index: number) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => window.open(instructive.url, '_blank')}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-red-500" />
                          <div>
                            <p className="font-medium">{instructive.fileName}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(instructive.uploadedAt).toLocaleDateString('es-ES')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Historial de Ejecuciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No hay historial de ejecución disponible</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {history.map((execution: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Badge className="bg-green-100 text-green-800">Completado</Badge>
                            <span className="text-sm text-gray-600">
                              {formatDateTime(execution.executedAt)}
                            </span>
                          </div>
                          {execution.qualityScore && (
                            <Badge variant="outline">
                              Calidad: {execution.qualityScore}/10
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                          <div>
                            <p className="text-gray-600">Duración</p>
                            <p className="font-medium">{getDurationDisplay(execution)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Cantidad</p>
                            <p className="font-medium">{getQuantityDisplay(execution)}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Eficiencia</p>
                            <p className="font-medium">{execution.efficiency}%</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Costo</p>
                            <p className="font-medium">${execution.cost}</p>
                          </div>
                        </div>

                        {execution.notes && (
                          <div className="mb-2">
                            <p className="text-sm text-gray-600">Notas:</p>
                            <p className="text-sm">{execution.notes}</p>
                          </div>
                        )}

                        {execution.issues && (
                          <div>
                            <p className="text-sm text-gray-600">Problemas:</p>
                            <p className="text-sm text-red-600">{execution.issues}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="statistics" className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Cargando estadísticas...</p>
              </div>
            ) : stats ? (
              <>
                {/* Estadísticas generales */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">{stats.stats.totalExecutions}</p>
                      <p className="text-sm text-muted-foreground">Ejecuciones</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{stats.stats.averageDuration}h</p>
                      <p className="text-sm text-muted-foreground">Duración Promedio</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-purple-600">{stats.stats.averageEfficiency}%</p>
                      <p className="text-sm text-muted-foreground">Eficiencia Promedio</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-orange-600">${stats.stats.totalCost}</p>
                      <p className="text-sm text-muted-foreground">Costo Total</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Estadísticas detalladas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Análisis de Duración
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Mínima:</span>
                        <span className="font-medium">{stats.stats.minDuration}h</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Máxima:</span>
                        <span className="font-medium">{stats.stats.maxDuration}h</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Tendencia:</span>
                        <div className="flex items-center gap-2">
                          {getTrendIcon(stats.stats.trend)}
                          <span className="font-medium">{getTrendText(stats.stats.trend)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Historial Temporal
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {stats.stats.firstExecution && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Primera ejecución:</span>
                          <span className="font-medium text-sm">
                            {formatDateTime(stats.stats.firstExecution)}
                          </span>
                        </div>
                      )}
                      {stats.stats.lastExecution && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Última ejecución:</span>
                          <span className="font-medium text-sm">
                            {formatDateTime(stats.stats.lastExecution)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Calidad promedio:</span>
                        <span className="font-medium">{stats.stats.averageQuality}/10</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recomendaciones */}
                {stats.recommendations && stats.recommendations.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Recomendaciones
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {stats.recommendations.map((rec: any, index: number) => (
                          <div key={index} className={`p-3 rounded-lg border-l-4 ${
                            rec.type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
                            rec.type === 'alert' ? 'bg-red-50 border-red-400' :
                            'bg-blue-50 border-blue-400'
                          }`}>
                            <p className="text-sm">{rec.message}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No hay estadísticas disponibles</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
} 