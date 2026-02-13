'use client';

/**
 * Delivery Configuration Component
 *
 * Configure delivery and logistics requirements
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Truck, Camera, User, Car, Clock, Bell, FileText, CheckSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DeliveryConfig {
  // Basic requirements
  requiereConductorEnDespacho: boolean;
  requiereVehiculoEnDespacho: boolean;
  requiereEvidenciaEntrega: boolean;

  // SLA Configuration
  deliverySlaPreparacionMaxHoras: number;
  deliverySlaTransitoMaxHoras: number;
  deliverySlaAlertaRetrasoHoras: number;

  // Evidence Requirements
  requiereFirmaCliente: boolean;
  requiereFotoEntrega: boolean;
  requiereDniReceptor: boolean;

  // Notification Templates
  deliveryNotificationTemplates: {
    dispatched: string;
    delivered: string;
    failed: string;
    retry: string;
  };

  // Workflow
  deliveryTipoDefault: string;
  permitirEntregaSinOrden: boolean;

  // Cost
  costoFleteDefault: number;
  calcularFleteAutomatico: boolean;
}

export function DeliveryConfig() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<DeliveryConfig>({
    requiereConductorEnDespacho: false,
    requiereVehiculoEnDespacho: false,
    requiereEvidenciaEntrega: false,
    deliverySlaPreparacionMaxHoras: 24,
    deliverySlaTransitoMaxHoras: 48,
    deliverySlaAlertaRetrasoHoras: 2,
    requiereFirmaCliente: false,
    requiereFotoEntrega: false,
    requiereDniReceptor: false,
    deliveryNotificationTemplates: {
      dispatched: '¡Tu pedido #{deliveryNumber} está en camino! 🚚\nConductor: {driverName}\nTracking: {trackingLink}',
      delivered: '✅ Tu pedido #{deliveryNumber} ha sido entregado.\n¡Gracias por tu compra!',
      failed: '⚠️ No pudimos entregar tu pedido #{deliveryNumber}.\nMotivo: {reason}\nNos contactaremos pronto.',
      retry: '🔄 Reintentaremos la entrega de tu pedido #{deliveryNumber}.\nNueva fecha: {newDate}',
    },
    deliveryTipoDefault: 'ENVIO',
    permitirEntregaSinOrden: false,
    costoFleteDefault: 0,
    calcularFleteAutomatico: false,
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/ventas/configuracion', { credentials: 'include' });
      if (response.ok) {
        const { data } = await response.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Error loading config:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la configuración',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/ventas/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      });

      if (response.ok) {
        toast({
          title: 'Configuración guardada',
          description: 'Los cambios se aplicaron correctamente',
        });
      } else {
        const { error } = await response.json();
        toast({
          title: 'Error',
          description: error || 'No se pudo guardar la configuración',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="requirements" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="requirements">
            <CheckSquare className="w-4 h-4 mr-2" />
            Requisitos
          </TabsTrigger>
          <TabsTrigger value="sla">
            <Clock className="w-4 h-4 mr-2" />
            SLA
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Bell className="w-4 h-4 mr-2" />
            Notificaciones
          </TabsTrigger>
          <TabsTrigger value="workflow">
            <FileText className="w-4 h-4 mr-2" />
            Workflow
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Requirements */}
        <TabsContent value="requirements">
          <Card>
            <CardHeader>
              <CardTitle>Requisitos de Entrega</CardTitle>
              <CardDescription>
                Configura qué información es obligatoria al gestionar entregas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <Label htmlFor="requiereConductorEnDespacho" className="cursor-pointer font-medium">
                  Conductor Obligatorio
                </Label>
                <p className="text-sm text-muted-foreground">
                  Se debe especificar el nombre y DNI del conductor al despachar
                </p>
              </div>
            </div>
            <Switch
              id="requiereConductorEnDespacho"
              checked={config.requiereConductorEnDespacho}
              onCheckedChange={(checked) =>
                setConfig({ ...config, requiereConductorEnDespacho: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Car className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <Label htmlFor="requiereVehiculoEnDespacho" className="cursor-pointer font-medium">
                  Vehículo Obligatorio
                </Label>
                <p className="text-sm text-muted-foreground">
                  Se debe especificar el vehículo/patente al despachar
                </p>
              </div>
            </div>
            <Switch
              id="requiereVehiculoEnDespacho"
              checked={config.requiereVehiculoEnDespacho}
              onCheckedChange={(checked) =>
                setConfig({ ...config, requiereVehiculoEnDespacho: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <Camera className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <Label htmlFor="requiereEvidenciaEntrega" className="cursor-pointer font-medium">
                  Evidencia de Entrega Obligatoria
                </Label>
                <p className="text-sm text-muted-foreground">
                  Se debe cargar foto o firma al completar una entrega
                </p>
              </div>
            </div>
            <Switch
              id="requiereEvidenciaEntrega"
              checked={config.requiereEvidenciaEntrega}
              onCheckedChange={(checked) =>
                setConfig({ ...config, requiereEvidenciaEntrega: checked })
              }
            />
          </div>

          {/* NEW: Evidence Requirements */}
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-4">Evidencias Específicas</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="requiereFirmaCliente">Firma del Cliente</Label>
                <Switch
                  id="requiereFirmaCliente"
                  checked={config.requiereFirmaCliente}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, requiereFirmaCliente: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="requiereFotoEntrega">Foto de la Entrega</Label>
                <Switch
                  id="requiereFotoEntrega"
                  checked={config.requiereFotoEntrega}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, requiereFotoEntrega: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="requiereDniReceptor">DNI del Receptor</Label>
                <Switch
                  id="requiereDniReceptor"
                  checked={config.requiereDniReceptor}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, requiereDniReceptor: checked })
                  }
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>

    {/* TAB 2: SLA Configuration */}
    <TabsContent value="sla">
      <Card>
        <CardHeader>
          <CardTitle>SLA - Tiempos Máximos</CardTitle>
          <CardDescription>
            Define los tiempos máximos permitidos en cada etapa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="slaPreparacion">Tiempo Máximo en Preparación (horas)</Label>
            <Input
              id="slaPreparacion"
              type="number"
              min="1"
              value={config.deliverySlaPreparacionMaxHoras}
              onChange={(e) =>
                setConfig({
                  ...config,
                  deliverySlaPreparacionMaxHoras: parseInt(e.target.value) || 24,
                })
              }
            />
            <p className="text-sm text-muted-foreground">
              Se alertará si una entrega permanece más de este tiempo en preparación
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slaTransito">Tiempo Máximo en Tránsito (horas)</Label>
            <Input
              id="slaTransito"
              type="number"
              min="1"
              value={config.deliverySlaTransitoMaxHoras}
              onChange={(e) =>
                setConfig({
                  ...config,
                  deliverySlaTransitoMaxHoras: parseInt(e.target.value) || 48,
                })
              }
            />
            <p className="text-sm text-muted-foreground">
              Se alertará si una entrega permanece más de este tiempo en tránsito
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slaAlerta">Horas de Antelación para Alerta</Label>
            <Input
              id="slaAlerta"
              type="number"
              min="0"
              value={config.deliverySlaAlertaRetrasoHoras}
              onChange={(e) =>
                setConfig({
                  ...config,
                  deliverySlaAlertaRetrasoHoras: parseInt(e.target.value) || 2,
                })
              }
            />
            <p className="text-sm text-muted-foreground">
              Enviar alerta preventiva X horas antes de cumplir el SLA
            </p>
          </div>
        </CardContent>
      </Card>
    </TabsContent>

    {/* TAB 3: Notification Templates */}
    <TabsContent value="templates">
      <Card>
        <CardHeader>
          <CardTitle>Templates de Notificaciones</CardTitle>
          <CardDescription>
            Personaliza los mensajes enviados a los clientes. Variables disponibles: {'{'}deliveryNumber{'}'}, {'{'}driverName{'}'}, {'{'}trackingLink{'}'}, {'{'}reason{'}'}, {'{'}newDate{'}'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="templateDispatched">Entrega Despachada 🚚</Label>
            <Textarea
              id="templateDispatched"
              rows={4}
              value={config.deliveryNotificationTemplates.dispatched}
              onChange={(e) =>
                setConfig({
                  ...config,
                  deliveryNotificationTemplates: {
                    ...config.deliveryNotificationTemplates,
                    dispatched: e.target.value,
                  },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="templateDelivered">Entrega Completada ✅</Label>
            <Textarea
              id="templateDelivered"
              rows={3}
              value={config.deliveryNotificationTemplates.delivered}
              onChange={(e) =>
                setConfig({
                  ...config,
                  deliveryNotificationTemplates: {
                    ...config.deliveryNotificationTemplates,
                    delivered: e.target.value,
                  },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="templateFailed">Entrega Fallida ⚠️</Label>
            <Textarea
              id="templateFailed"
              rows={3}
              value={config.deliveryNotificationTemplates.failed}
              onChange={(e) =>
                setConfig({
                  ...config,
                  deliveryNotificationTemplates: {
                    ...config.deliveryNotificationTemplates,
                    failed: e.target.value,
                  },
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="templateRetry">Reintento de Entrega 🔄</Label>
            <Textarea
              id="templateRetry"
              rows={3}
              value={config.deliveryNotificationTemplates.retry}
              onChange={(e) =>
                setConfig({
                  ...config,
                  deliveryNotificationTemplates: {
                    ...config.deliveryNotificationTemplates,
                    retry: e.target.value,
                  },
                })
              }
            />
          </div>
        </CardContent>
      </Card>
    </TabsContent>

    {/* TAB 4: Workflow Configuration */}
    <TabsContent value="workflow">
      <Card>
        <CardHeader>
          <CardTitle>Configuración de Workflow</CardTitle>
          <CardDescription>
            Personaliza el flujo de trabajo de entregas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="tipoDefault">Tipo de Entrega por Defecto</Label>
            <select
              id="tipoDefault"
              className="w-full px-3 py-2 border rounded-md"
              value={config.deliveryTipoDefault}
              onChange={(e) =>
                setConfig({ ...config, deliveryTipoDefault: e.target.value })
              }
            >
              <option value="ENVIO">Envío a Domicilio</option>
              <option value="RETIRO">Retiro en Sucursal</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label htmlFor="permitirSinOrden" className="cursor-pointer font-medium">
                Permitir Entregas sin Orden
              </Label>
              <p className="text-sm text-muted-foreground">
                Permite crear entregas directas sin orden de venta previa
              </p>
            </div>
            <Switch
              id="permitirSinOrden"
              checked={config.permitirEntregaSinOrden}
              onCheckedChange={(checked) =>
                setConfig({ ...config, permitirEntregaSinOrden: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="costoFlete">Costo de Flete por Defecto</Label>
            <Input
              id="costoFlete"
              type="number"
              min="0"
              step="0.01"
              value={config.costoFleteDefault}
              onChange={(e) =>
                setConfig({
                  ...config,
                  costoFleteDefault: parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label htmlFor="calcularAuto" className="cursor-pointer font-medium">
                Calcular Flete Automáticamente
              </Label>
              <p className="text-sm text-muted-foreground">
                Calcula costo basado en distancia/zona (requiere configuración adicional)
              </p>
            </div>
            <Switch
              id="calcularAuto"
              checked={config.calcularFleteAutomatico}
              onCheckedChange={(checked) =>
                setConfig({ ...config, calcularFleteAutomatico: checked })
              }
            />
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Guardar Configuración
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
