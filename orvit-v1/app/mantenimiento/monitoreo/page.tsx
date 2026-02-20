'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity,
  Plus,
  Search,
  RefreshCw,
  Thermometer,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Bell,
  TrendingUp,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface ConditionMonitor {
  id: number;
  name: string;
  machine_name: string;
  monitorType: string;
  unit: string;
  normalMin: number;
  normalMax: number;
  warningMin: number;
  warningMax: number;
  criticalMin: number;
  criticalMax: number;
  measurementFrequency: string;
  last_value: number | null;
  last_status: string | null;
  last_reading_at: string | null;
  active_alerts: number;
}

interface ConditionAlert {
  id: number;
  monitor_name: string;
  machine_name: string;
  monitorType: string;
  unit: string;
  alertType: string;
  value: number;
  threshold: number;
  message: string;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledged_by_name: string | null;
  resolvedAt: string | null;
  resolved_by_name: string | null;
}

const MONITOR_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  VIBRATION: { label: 'Vibración', icon: <Activity className="h-4 w-4" />, color: 'text-purple-500' },
  TEMPERATURE: { label: 'Temperatura', icon: <Thermometer className="h-4 w-4" />, color: 'text-destructive' },
  PRESSURE: { label: 'Presión', icon: <Gauge className="h-4 w-4" />, color: 'text-info-muted-foreground' },
  OIL_ANALYSIS: { label: 'Análisis de Aceite', icon: <Activity className="h-4 w-4" />, color: 'text-warning-muted-foreground' },
  ULTRASOUND: { label: 'Ultrasonido', icon: <Activity className="h-4 w-4" />, color: 'text-success' },
  THERMOGRAPHY: { label: 'Termografía', icon: <Thermometer className="h-4 w-4" />, color: 'text-warning-muted-foreground' },
  CURRENT: { label: 'Corriente', icon: <Activity className="h-4 w-4" />, color: 'text-warning-muted-foreground' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NORMAL: { label: 'Normal', color: 'bg-success-muted text-success' },
  WARNING: { label: 'Advertencia', color: 'bg-warning-muted text-warning-muted-foreground' },
  CRITICAL: { label: 'Crítico', color: 'bg-destructive/10 text-destructive' },
  ERROR: { label: 'Error', color: 'bg-muted text-foreground' },
};

export default function ConditionMonitoringPage() {
  const { currentCompany } = useCompany();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('monitors');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: monitorsData, isLoading: loadingMonitors, refetch: refetchMonitors } = useQuery({
    queryKey: ['condition-monitors', currentCompany?.id],
    queryFn: async () => {
      const res = await fetch(`/api/condition-monitoring?companyId=${currentCompany?.id}&view=monitors`);
      if (!res.ok) throw new Error('Error al cargar monitores');
      return res.json();
    },
    enabled: !!currentCompany?.id,
  });

  const { data: alertsData, isLoading: loadingAlerts, refetch: refetchAlerts } = useQuery({
    queryKey: ['condition-alerts', currentCompany?.id],
    queryFn: async () => {
      const res = await fetch(`/api/condition-monitoring?companyId=${currentCompany?.id}&view=alerts`);
      if (!res.ok) throw new Error('Error al cargar alertas');
      return res.json();
    },
    enabled: !!currentCompany?.id && activeTab === 'alerts',
  });

  const monitors: ConditionMonitor[] = monitorsData?.monitors || [];
  const alerts: ConditionAlert[] = alertsData?.alerts || [];

  const filteredMonitors = monitors.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.machine_name?.toLowerCase().includes(search.toLowerCase())
  );

  const activeAlertsCount = monitors.reduce((sum, m) => sum + (m.active_alerts || 0), 0);
  const criticalCount = monitors.filter(m => m.last_status === 'CRITICAL').length;
  const warningCount = monitors.filter(m => m.last_status === 'WARNING').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Monitoreo de Condiciones
          </h1>
          <p className="text-muted-foreground">
            Monitoreo predictivo: vibración, temperatura, presión y más
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { refetchMonitors(); refetchAlerts(); }} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Monitor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Configurar Monitor de Condición</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nombre del Monitor</Label>
                  <Input placeholder="Ej: Vibración - Motor principal" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Monitoreo</Label>
                    <Select defaultValue="VIBRATION">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VIBRATION">Vibración</SelectItem>
                        <SelectItem value="TEMPERATURE">Temperatura</SelectItem>
                        <SelectItem value="PRESSURE">Presión</SelectItem>
                        <SelectItem value="OIL_ANALYSIS">Análisis de Aceite</SelectItem>
                        <SelectItem value="ULTRASOUND">Ultrasonido</SelectItem>
                        <SelectItem value="THERMOGRAPHY">Termografía</SelectItem>
                        <SelectItem value="CURRENT">Corriente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Unidad</Label>
                    <Input placeholder="Ej: mm/s, °C, bar" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rango Normal Min</Label>
                    <Input type="number" placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Rango Normal Max</Label>
                    <Input type="number" placeholder="10" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Advertencia Max</Label>
                    <Input type="number" placeholder="15" />
                  </div>
                  <div className="space-y-2">
                    <Label>Crítico Max</Label>
                    <Input type="number" placeholder="20" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Frecuencia de Medición</Label>
                  <Select defaultValue="WEEKLY">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CONTINUOUS">Continuo</SelectItem>
                      <SelectItem value="HOURLY">Cada hora</SelectItem>
                      <SelectItem value="DAILY">Diario</SelectItem>
                      <SelectItem value="WEEKLY">Semanal</SelectItem>
                      <SelectItem value="MONTHLY">Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={() => setIsDialogOpen(false)}>
                  Crear Monitor
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monitores Activos</p>
                <p className="text-2xl font-bold">{monitors.length}</p>
              </div>
              <Activity className="h-8 w-8 text-info-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alertas Activas</p>
                <p className="text-2xl font-bold text-warning-muted-foreground">{activeAlertsCount}</p>
              </div>
              <Bell className="h-8 w-8 text-warning-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Estado Crítico</p>
                <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Advertencias</p>
                <p className="text-2xl font-bold text-warning-muted-foreground">{warningCount}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-warning-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="monitors">Monitores</TabsTrigger>
            <TabsTrigger value="alerts">
              Alertas
              {activeAlertsCount > 0 && (
                <Badge variant="destructive" className="ml-2">{activeAlertsCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <TabsContent value="monitors" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingMonitors ? (
              Array(6).fill(0).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="pt-6">
                    <div className="h-4 bg-muted rounded w-3/4 mb-4" />
                    <div className="h-8 bg-muted rounded w-1/2" />
                  </CardContent>
                </Card>
              ))
            ) : filteredMonitors.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No se encontraron monitores</p>
              </div>
            ) : (
              filteredMonitors.map((monitor) => {
                const typeConfig = MONITOR_TYPE_CONFIG[monitor.monitorType] || { label: monitor.monitorType, icon: <Activity className="h-4 w-4" />, color: 'text-muted-foreground' };
                const statusConfig = STATUS_CONFIG[monitor.last_status || 'NORMAL'] || STATUS_CONFIG.NORMAL;

                return (
                  <Card key={monitor.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className={typeConfig.color}>{typeConfig.icon}</span>
                          <CardTitle className="text-lg">{monitor.name}</CardTitle>
                        </div>
                        {monitor.active_alerts > 0 && (
                          <Badge variant="destructive">{monitor.active_alerts} alertas</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{monitor.machine_name}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Última lectura:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold">
                              {monitor.last_value !== null ? monitor.last_value : '-'}
                            </span>
                            <span className="text-sm text-muted-foreground">{monitor.unit}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Estado:</span>
                          <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Tipo:</span>
                          <Badge variant="outline">{typeConfig.label}</Badge>
                        </div>

                        {monitor.last_reading_at && (
                          <p className="text-xs text-muted-foreground text-right">
                            Hace {formatDistanceToNow(new Date(monitor.last_reading_at), { locale: es })}
                          </p>
                        )}

                        <div className="pt-2 flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1">
                            Registrar Lectura
                          </Button>
                          <Button variant="outline" size="sm">
                            <TrendingUp className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Monitor</TableHead>
                    <TableHead>Máquina</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Umbral</TableHead>
                    <TableHead>Severidad</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingAlerts ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">Cargando...</TableCell>
                    </TableRow>
                  ) : alerts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No hay alertas registradas
                      </TableCell>
                    </TableRow>
                  ) : (
                    alerts.map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell>
                          {format(new Date(alert.createdAt), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="font-medium">{alert.monitor_name}</TableCell>
                        <TableCell>{alert.machine_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {MONITOR_TYPE_CONFIG[alert.monitorType]?.label || alert.monitorType}
                          </Badge>
                        </TableCell>
                        <TableCell>{alert.value} {alert.unit}</TableCell>
                        <TableCell>{alert.threshold} {alert.unit}</TableCell>
                        <TableCell>
                          <Badge className={alert.alertType === 'CRITICAL' ? 'bg-destructive/10 text-destructive' : 'bg-warning-muted text-warning-muted-foreground'}>
                            {alert.alertType === 'CRITICAL' ? 'Crítico' : 'Advertencia'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {alert.resolvedAt ? (
                            <Badge className="bg-success-muted text-success">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Resuelto
                            </Badge>
                          ) : alert.acknowledgedAt ? (
                            <Badge className="bg-info-muted text-info-muted-foreground">Reconocido</Badge>
                          ) : (
                            <Badge variant="destructive">Activo</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
