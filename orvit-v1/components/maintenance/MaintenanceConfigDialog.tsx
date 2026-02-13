'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  Settings,
  Save,
  Clock,
  AlertTriangle,
  Bell,
  Calendar,
  Target,
  DollarSign,
  Users,
  Wrench,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Zap,
  Shield
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface MaintenanceConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  currentConfig?: any;
  companyId: number;
  sectorId?: number;
}

export default function MaintenanceConfigDialog({
  isOpen,
  onClose,
  onSave,
  currentConfig,
  companyId,
  sectorId
}: MaintenanceConfigDialogProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // Estados de configuración
  const [config, setConfig] = useState({
    // Configuración General
    defaultTimeUnit: 'HOURS',
    defaultExecutionWindow: 'ANY_TIME',
    autoAssignMaintenance: false,
    requireApproval: false,
    enableNotifications: true,
    
    // Notificaciones
    notifyBeforeDays: 3,
    notifyOverdueDays: 1,
    escalateAfterDays: 7,
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    
    // KPIs y Métricas
    targetMTTR: 4, // horas
    targetMTBF: 720, // horas (30 días)
    targetAvailability: 95, // porcentaje
    costTrackingEnabled: true,
    qualityTrackingEnabled: true,
    performanceTrackingEnabled: true,
    
    // Programación
    workingHours: {
      start: '08:00',
      end: '17:00'
    },
    workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    allowWeekendMaintenance: false,
    allowNightMaintenance: false,
    
    // Recursos
    defaultEstimatedDuration: 60, // minutos
    requireSparePartsApproval: false,
    enableResourcePlanning: true,
    maxConcurrentMaintenance: 3,
    
    // Checklist
    requireChecklistCompletion: true,
    allowPartialChecklistCompletion: false,
    requirePhotosForCompletion: false,
    requireSignatureForCompletion: true,
    
    // Alertas y Escalamiento
    criticalPriorityEscalation: 2, // horas
    highPriorityEscalation: 8, // horas
    mediumPriorityEscalation: 24, // horas
    lowPriorityEscalation: 72, // horas
    
    // Integración
    enableMobileApp: true,
    enableBarcodeScan: false,
    enableQRCodeScan: true,
    enableVoiceNotes: false,
    
    // Reportes
    autoGenerateReports: true,
    reportFrequency: 'WEEKLY',
    includePhotosInReports: true,
    includeCostAnalysis: true
  });

  useEffect(() => {
    if (isOpen && currentConfig) {
      setConfig({ ...config, ...currentConfig });
    }
  }, [isOpen, currentConfig]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        ...config,
        companyId,
        sectorId: sectorId || null,
        updatedAt: new Date().toISOString()
      };

      const response = await fetch('/api/maintenance/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Configuración guardada',
          description: 'La configuración de mantenimiento ha sido actualizada exitosamente'
        });
        onSave(result);
        onClose();
      } else {
        throw new Error('Error al guardar la configuración');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const resetToDefaults = () => {
    setConfig({
      defaultTimeUnit: 'HOURS',
      defaultExecutionWindow: 'ANY_TIME',
      autoAssignMaintenance: false,
      requireApproval: false,
      enableNotifications: true,
      notifyBeforeDays: 3,
      notifyOverdueDays: 1,
      escalateAfterDays: 7,
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
      targetMTTR: 4,
      targetMTBF: 720,
      targetAvailability: 95,
      costTrackingEnabled: true,
      qualityTrackingEnabled: true,
      performanceTrackingEnabled: true,
      workingHours: {
        start: '08:00',
        end: '17:00'
      },
      workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      allowWeekendMaintenance: false,
      allowNightMaintenance: false,
      defaultEstimatedDuration: 60,
      requireSparePartsApproval: false,
      enableResourcePlanning: true,
      maxConcurrentMaintenance: 3,
      requireChecklistCompletion: true,
      allowPartialChecklistCompletion: false,
      requirePhotosForCompletion: false,
      requireSignatureForCompletion: true,
      criticalPriorityEscalation: 2,
      highPriorityEscalation: 8,
      mediumPriorityEscalation: 24,
      lowPriorityEscalation: 72,
      enableMobileApp: true,
      enableBarcodeScan: false,
      enableQRCodeScan: true,
      enableVoiceNotes: false,
      autoGenerateReports: true,
      reportFrequency: 'WEEKLY',
      includePhotosInReports: true,
      includeCostAnalysis: true
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="xl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración de Mantenimiento
          </DialogTitle>
          <DialogDescription>
            Configura los parámetros del sistema de mantenimiento para tu {sectorId ? 'sector' : 'empresa'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
            <TabsTrigger value="kpis">KPIs</TabsTrigger>
            <TabsTrigger value="scheduling">Programación</TabsTrigger>
            <TabsTrigger value="workflow">Flujo</TabsTrigger>
            <TabsTrigger value="integration">Integración</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Configuración General
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Unidad de Tiempo por Defecto</Label>
                    <Select value={config.defaultTimeUnit} onValueChange={(value) => setConfig(prev => ({ ...prev, defaultTimeUnit: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HOURS">Horas</SelectItem>
                        <SelectItem value="DAYS">Días</SelectItem>
                        <SelectItem value="WEEKS">Semanas</SelectItem>
                        <SelectItem value="MONTHS">Meses</SelectItem>
                        <SelectItem value="CYCLES">Ciclos</SelectItem>
                        <SelectItem value="KILOMETERS">Kilómetros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Ventana de Ejecución por Defecto</Label>
                    <Select value={config.defaultExecutionWindow} onValueChange={(value) => setConfig(prev => ({ ...prev, defaultExecutionWindow: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ANY_TIME">Cualquier momento</SelectItem>
                        <SelectItem value="BEFORE_SHIFT">Antes del turno</SelectItem>
                        <SelectItem value="MID_SHIFT">Mitad del turno</SelectItem>
                        <SelectItem value="AFTER_SHIFT">Después del turno</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Duración Estimada por Defecto (minutos)</Label>
                    <Input
                      type="number"
                      value={config.defaultEstimatedDuration}
                      onChange={(e) => setConfig(prev => ({ ...prev, defaultEstimatedDuration: parseInt(e.target.value) || 60 }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Máximo de Mantenimientos Concurrentes</Label>
                    <Input
                      type="number"
                      value={config.maxConcurrentMaintenance}
                      onChange={(e) => setConfig(prev => ({ ...prev, maxConcurrentMaintenance: parseInt(e.target.value) || 3 }))}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Asignación Automática de Mantenimientos</Label>
                      <p className="text-sm text-muted-foreground">Asignar automáticamente mantenimientos según disponibilidad</p>
                    </div>
                    <Switch
                      checked={config.autoAssignMaintenance}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, autoAssignMaintenance: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Requiere Aprobación</Label>
                      <p className="text-sm text-muted-foreground">Los mantenimientos requieren aprobación antes de ejecutarse</p>
                    </div>
                    <Switch
                      checked={config.requireApproval}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, requireApproval: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Habilitar Notificaciones</Label>
                      <p className="text-sm text-muted-foreground">Enviar notificaciones del sistema</p>
                    </div>
                    <Switch
                      checked={config.enableNotifications}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enableNotifications: checked }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Configuración de Notificaciones
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Notificar antes de vencer (días)</Label>
                    <Input
                      type="number"
                      value={config.notifyBeforeDays}
                      onChange={(e) => setConfig(prev => ({ ...prev, notifyBeforeDays: parseInt(e.target.value) || 3 }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Notificar vencidos cada (días)</Label>
                    <Input
                      type="number"
                      value={config.notifyOverdueDays}
                      onChange={(e) => setConfig(prev => ({ ...prev, notifyOverdueDays: parseInt(e.target.value) || 1 }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Escalar después de (días)</Label>
                    <Input
                      type="number"
                      value={config.escalateAfterDays}
                      onChange={(e) => setConfig(prev => ({ ...prev, escalateAfterDays: parseInt(e.target.value) || 7 }))}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Notificaciones por Email</Label>
                      <p className="text-sm text-muted-foreground">Enviar notificaciones por correo electrónico</p>
                    </div>
                    <Switch
                      checked={config.emailNotifications}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, emailNotifications: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Notificaciones por SMS</Label>
                      <p className="text-sm text-muted-foreground">Enviar notificaciones por mensaje de texto</p>
                    </div>
                    <Switch
                      checked={config.smsNotifications}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, smsNotifications: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Notificaciones Push</Label>
                      <p className="text-sm text-muted-foreground">Enviar notificaciones push a la aplicación móvil</p>
                    </div>
                    <Switch
                      checked={config.pushNotifications}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, pushNotifications: checked }))}
                    />
                  </div>
                </div>

                <Card className="bg-yellow-50 border-yellow-200">
                  <CardHeader>
                    <CardTitle className="text-sm text-yellow-800">Escalamiento por Prioridad (horas)</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-red-700">Crítica</Label>
                      <Input
                        type="number"
                        value={config.criticalPriorityEscalation}
                        onChange={(e) => setConfig(prev => ({ ...prev, criticalPriorityEscalation: parseInt(e.target.value) || 2 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-orange-700">Alta</Label>
                      <Input
                        type="number"
                        value={config.highPriorityEscalation}
                        onChange={(e) => setConfig(prev => ({ ...prev, highPriorityEscalation: parseInt(e.target.value) || 8 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-yellow-700">Media</Label>
                      <Input
                        type="number"
                        value={config.mediumPriorityEscalation}
                        onChange={(e) => setConfig(prev => ({ ...prev, mediumPriorityEscalation: parseInt(e.target.value) || 24 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-700">Baja</Label>
                      <Input
                        type="number"
                        value={config.lowPriorityEscalation}
                        onChange={(e) => setConfig(prev => ({ ...prev, lowPriorityEscalation: parseInt(e.target.value) || 72 }))}
                      />
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="kpis" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Objetivos de KPIs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>MTTR Objetivo (horas)</Label>
                    <div className="px-3">
                      <Slider
                        value={[config.targetMTTR]}
                        onValueChange={(value) => setConfig(prev => ({ ...prev, targetMTTR: value[0] }))}
                        max={24}
                        min={1}
                        step={0.5}
                        className="w-full"
                      />
                      <div className="flex justify-between text-sm text-muted-foreground mt-1">
                        <span>1h</span>
                        <span className="font-medium">{config.targetMTTR}h</span>
                        <span>24h</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>MTBF Objetivo (horas)</Label>
                    <div className="px-3">
                      <Slider
                        value={[config.targetMTBF]}
                        onValueChange={(value) => setConfig(prev => ({ ...prev, targetMTBF: value[0] }))}
                        max={2000}
                        min={100}
                        step={10}
                        className="w-full"
                      />
                      <div className="flex justify-between text-sm text-muted-foreground mt-1">
                        <span>100h</span>
                        <span className="font-medium">{config.targetMTBF}h</span>
                        <span>2000h</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Disponibilidad Objetivo (%)</Label>
                    <div className="px-3">
                      <Slider
                        value={[config.targetAvailability]}
                        onValueChange={(value) => setConfig(prev => ({ ...prev, targetAvailability: value[0] }))}
                        max={100}
                        min={80}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-sm text-muted-foreground mt-1">
                        <span>80%</span>
                        <span className="font-medium">{config.targetAvailability}%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Seguimiento de Costos</Label>
                      <p className="text-sm text-muted-foreground">Rastrear costos de mantenimiento y repuestos</p>
                    </div>
                    <Switch
                      checked={config.costTrackingEnabled}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, costTrackingEnabled: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Seguimiento de Calidad</Label>
                      <p className="text-sm text-muted-foreground">Medir calidad y efectividad del mantenimiento</p>
                    </div>
                    <Switch
                      checked={config.qualityTrackingEnabled}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, qualityTrackingEnabled: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Seguimiento de Performance</Label>
                      <p className="text-sm text-muted-foreground">Monitorear rendimiento de equipos y técnicos</p>
                    </div>
                    <Switch
                      checked={config.performanceTrackingEnabled}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, performanceTrackingEnabled: checked }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scheduling" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Configuración de Horarios
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hora de Inicio</Label>
                    <Input
                      type="time"
                      value={config.workingHours.start}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        workingHours: { ...prev.workingHours, start: e.target.value }
                      }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Hora de Fin</Label>
                    <Input
                      type="time"
                      value={config.workingHours.end}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        workingHours: { ...prev.workingHours, end: e.target.value }
                      }))}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Permitir Mantenimiento en Fines de Semana</Label>
                      <p className="text-sm text-muted-foreground">Habilitar programación en sábados y domingos</p>
                    </div>
                    <Switch
                      checked={config.allowWeekendMaintenance}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, allowWeekendMaintenance: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Permitir Mantenimiento Nocturno</Label>
                      <p className="text-sm text-muted-foreground">Habilitar programación fuera del horario laboral</p>
                    </div>
                    <Switch
                      checked={config.allowNightMaintenance}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, allowNightMaintenance: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Planificación de Recursos</Label>
                      <p className="text-sm text-muted-foreground">Verificar disponibilidad de recursos antes de programar</p>
                    </div>
                    <Switch
                      checked={config.enableResourcePlanning}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enableResourcePlanning: checked }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workflow" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Flujo de Trabajo y Validaciones
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Requiere Completar Checklist</Label>
                    <p className="text-sm text-muted-foreground">Obligatorio completar checklist para finalizar mantenimiento</p>
                  </div>
                  <Switch
                    checked={config.requireChecklistCompletion}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, requireChecklistCompletion: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Permitir Completado Parcial de Checklist</Label>
                    <p className="text-sm text-muted-foreground">Permitir finalizar con elementos pendientes</p>
                  </div>
                  <Switch
                    checked={config.allowPartialChecklistCompletion}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, allowPartialChecklistCompletion: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Requiere Fotos para Completar</Label>
                    <p className="text-sm text-muted-foreground">Obligatorio adjuntar fotos al completar mantenimiento</p>
                  </div>
                  <Switch
                    checked={config.requirePhotosForCompletion}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, requirePhotosForCompletion: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Requiere Firma para Completar</Label>
                    <p className="text-sm text-muted-foreground">Obligatorio firma digital del técnico</p>
                  </div>
                  <Switch
                    checked={config.requireSignatureForCompletion}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, requireSignatureForCompletion: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Requiere Aprobación de Repuestos</Label>
                    <p className="text-sm text-muted-foreground">Solicitar aprobación para uso de repuestos costosos</p>
                  </div>
                  <Switch
                    checked={config.requireSparePartsApproval}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, requireSparePartsApproval: checked }))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integration" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Integración y Tecnología
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Habilitar Aplicación Móvil</Label>
                    <p className="text-sm text-muted-foreground">Permitir acceso desde dispositivos móviles</p>
                  </div>
                  <Switch
                    checked={config.enableMobileApp}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enableMobileApp: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Escaneo de Códigos de Barras</Label>
                    <p className="text-sm text-muted-foreground">Identificar equipos por código de barras</p>
                  </div>
                  <Switch
                    checked={config.enableBarcodeScan}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enableBarcodeScan: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Escaneo de Códigos QR</Label>
                    <p className="text-sm text-muted-foreground">Identificar equipos por código QR</p>
                  </div>
                  <Switch
                    checked={config.enableQRCodeScan}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enableQRCodeScan: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Notas de Voz</Label>
                    <p className="text-sm text-muted-foreground">Permitir grabación de notas de voz</p>
                  </div>
                  <Switch
                    checked={config.enableVoiceNotes}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enableVoiceNotes: checked }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Reportes Automáticos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Generar Reportes Automáticamente</Label>
                    <p className="text-sm text-muted-foreground">Crear reportes periódicos automáticamente</p>
                  </div>
                  <Switch
                    checked={config.autoGenerateReports}
                    onCheckedChange={(checked) => setConfig(prev => ({ ...prev, autoGenerateReports: checked }))}
                  />
                </div>

                {config.autoGenerateReports && (
                  <>
                    <div className="space-y-2">
                      <Label>Frecuencia de Reportes</Label>
                      <Select value={config.reportFrequency} onValueChange={(value) => setConfig(prev => ({ ...prev, reportFrequency: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DAILY">Diario</SelectItem>
                          <SelectItem value="WEEKLY">Semanal</SelectItem>
                          <SelectItem value="MONTHLY">Mensual</SelectItem>
                          <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Incluir Fotos en Reportes</Label>
                        <p className="text-sm text-muted-foreground">Adjuntar evidencia fotográfica</p>
                      </div>
                      <Switch
                        checked={config.includePhotosInReports}
                        onCheckedChange={(checked) => setConfig(prev => ({ ...prev, includePhotosInReports: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Incluir Análisis de Costos</Label>
                        <p className="text-sm text-muted-foreground">Agregar desglose de costos de mantenimiento</p>
                      </div>
                      <Switch
                        checked={config.includeCostAnalysis}
                        onCheckedChange={(checked) => setConfig(prev => ({ ...prev, includeCostAnalysis: checked }))}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={resetToDefaults}>
            Restablecer Valores por Defecto
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Configuración
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}