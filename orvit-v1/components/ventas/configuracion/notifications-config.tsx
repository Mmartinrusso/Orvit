'use client';

/**
 * Notifications Configuration Component
 *
 * Configure email notifications for sales events
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Mail, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NotificationsConfig {
  notificarNuevaCotizacion: boolean;
  notificarOrdenConfirmada: boolean;
  notificarEntregaProgramada: boolean;
  notificarFacturaEmitida: boolean;
  notificarPagoRecibido: boolean;
  emailsNotificaciones?: string;
}

const NOTIFICATION_EVENTS = [
  {
    key: 'notificarNuevaCotizacion' as keyof NotificationsConfig,
    name: 'Nueva Cotización',
    description: 'Se envía cuando se crea una nueva cotización',
  },
  {
    key: 'notificarOrdenConfirmada' as keyof NotificationsConfig,
    name: 'Orden Confirmada',
    description: 'Se envía cuando se confirma una orden de venta',
  },
  {
    key: 'notificarEntregaProgramada' as keyof NotificationsConfig,
    name: 'Entrega Programada',
    description: 'Se envía cuando se programa una entrega',
  },
  {
    key: 'notificarFacturaEmitida' as keyof NotificationsConfig,
    name: 'Factura Emitida',
    description: 'Se envía cuando se emite una factura',
  },
  {
    key: 'notificarPagoRecibido' as keyof NotificationsConfig,
    name: 'Pago Recibido',
    description: 'Se envía cuando se registra un pago de cliente',
  },
];

export function NotificationsConfig() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<NotificationsConfig>({
    notificarNuevaCotizacion: true,
    notificarOrdenConfirmada: true,
    notificarEntregaProgramada: true,
    notificarFacturaEmitida: true,
    notificarPagoRecibido: true,
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
      <Card>
        <CardHeader>
          <CardTitle>Notificaciones por Email</CardTitle>
          <CardDescription>
            Configura las notificaciones automáticas que se enviarán a los destinatarios especificados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email Recipients */}
          <div className="space-y-2">
            <Label htmlFor="emailsNotificaciones">
              <Mail className="w-4 h-4 inline mr-2" />
              Destinatarios de Notificaciones
            </Label>
            <Input
              id="emailsNotificaciones"
              type="text"
              placeholder="ejemplo1@empresa.com, ejemplo2@empresa.com"
              value={config.emailsNotificaciones || ''}
              onChange={(e) => setConfig({ ...config, emailsNotificaciones: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Ingresa los emails separados por comas. Estos emails recibirán todas las notificaciones habilitadas.
            </p>
          </div>

          {/* Event Toggles */}
          <div className="space-y-1">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Eventos a Notificar
            </Label>
            <p className="text-sm text-muted-foreground mb-4">
              Selecciona qué eventos deben generar notificaciones
            </p>

            {NOTIFICATION_EVENTS.map((event) => (
              <div
                key={event.key}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div>
                  <Label htmlFor={event.key} className="cursor-pointer font-medium">
                    {event.name}
                  </Label>
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                </div>
                <Switch
                  id={event.key}
                  checked={config[event.key]}
                  onCheckedChange={(checked) => setConfig({ ...config, [event.key]: checked })}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
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
