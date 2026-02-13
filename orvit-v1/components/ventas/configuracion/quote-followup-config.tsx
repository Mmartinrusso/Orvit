'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  Save,
  Clock,
  Mail,
  MessageCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

// =====================================================
// TYPES
// =====================================================

interface QuoteFollowupConfig {
  enabled: boolean;
  firstReminderDays: number;
  secondReminderDays: number;
  thirdReminderDays: number;
  autoCloseAfterDays: number;
  notifySellerOnNoResponse: boolean;
  escalateToManagerAfterDays: number;
  notificationChannels: {
    email: boolean;
    whatsapp: boolean;
    inApp: boolean;
  };
  autoActions: {
    markAsLostAfterDays: number;
    reassignAfterDays: number;
    createTaskOnNoResponse: boolean;
  };
}

interface QuoteFollowupConfigProps {
  config: Partial<QuoteFollowupConfig>;
  onSave: (config: QuoteFollowupConfig) => Promise<void>;
}

// =====================================================
// DEFAULT CONFIG
// =====================================================

const DEFAULT_CONFIG: QuoteFollowupConfig = {
  enabled: false,
  firstReminderDays: 3,
  secondReminderDays: 7,
  thirdReminderDays: 14,
  autoCloseAfterDays: 30,
  notifySellerOnNoResponse: true,
  escalateToManagerAfterDays: 14,
  notificationChannels: {
    email: true,
    whatsapp: true,
    inApp: true,
  },
  autoActions: {
    markAsLostAfterDays: 45,
    reassignAfterDays: 0, // 0 = disabled
    createTaskOnNoResponse: true,
  },
};

// =====================================================
// COMPONENT
// =====================================================

export function QuoteFollowupConfig({ config, onSave }: QuoteFollowupConfigProps) {
  const [followupConfig, setFollowupConfig] = useState<QuoteFollowupConfig>({
    ...DEFAULT_CONFIG,
    ...config,
    notificationChannels: {
      ...DEFAULT_CONFIG.notificationChannels,
      ...config?.notificationChannels,
    },
    autoActions: {
      ...DEFAULT_CONFIG.autoActions,
      ...config?.autoActions,
    },
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(followupConfig);
      toast.success('Configuración guardada');
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const TimelinePreview = () => {
    const events = [
      {
        day: 0,
        label: 'Cotización enviada',
        icon: CheckCircle,
        color: 'text-green-500',
      },
      {
        day: followupConfig.firstReminderDays,
        label: '1er recordatorio',
        icon: Bell,
        color: 'text-blue-500',
      },
      {
        day: followupConfig.secondReminderDays,
        label: '2do recordatorio',
        icon: Bell,
        color: 'text-yellow-500',
      },
      {
        day: followupConfig.thirdReminderDays,
        label: '3er recordatorio',
        icon: AlertTriangle,
        color: 'text-orange-500',
      },
      {
        day: followupConfig.escalateToManagerAfterDays,
        label: 'Escalar a gerente',
        icon: Users,
        color: 'text-purple-500',
        show: followupConfig.notifySellerOnNoResponse,
      },
      {
        day: followupConfig.autoCloseAfterDays,
        label: 'Cierre automático',
        icon: XCircle,
        color: 'text-red-500',
      },
    ]
      .filter((e) => e.show !== false)
      .sort((a, b) => a.day - b.day);

    return (
      <div className="bg-muted rounded-lg p-4">
        <h4 className="font-medium mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Línea de Tiempo del Seguimiento
        </h4>
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
          <div className="space-y-4">
            {events.map((event, index) => {
              const Icon = event.icon;
              return (
                <div key={index} className="flex items-center gap-4 relative">
                  <div className={`w-8 h-8 rounded-full bg-background border-2 flex items-center justify-center z-10 ${event.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{event.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.day === 0 ? 'Día 0' : `Día ${event.day}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              <CardTitle>Seguimiento Automático de Cotizaciones</CardTitle>
            </div>
            <Switch
              checked={followupConfig.enabled}
              onCheckedChange={(checked) =>
                setFollowupConfig(prev => ({ ...prev, enabled: checked }))
              }
            />
          </div>
          <CardDescription>
            Automatiza el seguimiento de cotizaciones pendientes.
            El sistema enviará recordatorios y notificaciones según la configuración.
          </CardDescription>
        </CardHeader>

        {followupConfig.enabled && (
          <CardContent className="space-y-6">
            {/* Reminder Schedule */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Programación de Recordatorios
              </h4>

              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-3">
                  <Label>1er Recordatorio (días)</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[followupConfig.firstReminderDays]}
                      onValueChange={([v]) =>
                        setFollowupConfig(prev => ({ ...prev, firstReminderDays: v }))
                      }
                      min={1}
                      max={14}
                      step={1}
                      className="flex-1"
                    />
                    <Badge variant="secondary" className="w-12 justify-center">
                      {followupConfig.firstReminderDays}d
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>2do Recordatorio (días)</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[followupConfig.secondReminderDays]}
                      onValueChange={([v]) =>
                        setFollowupConfig(prev => ({ ...prev, secondReminderDays: v }))
                      }
                      min={followupConfig.firstReminderDays + 1}
                      max={21}
                      step={1}
                      className="flex-1"
                    />
                    <Badge variant="secondary" className="w-12 justify-center">
                      {followupConfig.secondReminderDays}d
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>3er Recordatorio (días)</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[followupConfig.thirdReminderDays]}
                      onValueChange={([v]) =>
                        setFollowupConfig(prev => ({ ...prev, thirdReminderDays: v }))
                      }
                      min={followupConfig.secondReminderDays + 1}
                      max={30}
                      step={1}
                      className="flex-1"
                    />
                    <Badge variant="secondary" className="w-12 justify-center">
                      {followupConfig.thirdReminderDays}d
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Notification Channels */}
            <div className="space-y-4">
              <h4 className="font-medium">Canales de Notificación</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span>Email</span>
                  </div>
                  <Switch
                    checked={followupConfig.notificationChannels.email}
                    onCheckedChange={(checked) =>
                      setFollowupConfig(prev => ({
                        ...prev,
                        notificationChannels: { ...prev.notificationChannels, email: checked },
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </div>
                  <Switch
                    checked={followupConfig.notificationChannels.whatsapp}
                    onCheckedChange={(checked) =>
                      setFollowupConfig(prev => ({
                        ...prev,
                        notificationChannels: { ...prev.notificationChannels, whatsapp: checked },
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    <span>En la App</span>
                  </div>
                  <Switch
                    checked={followupConfig.notificationChannels.inApp}
                    onCheckedChange={(checked) =>
                      setFollowupConfig(prev => ({
                        ...prev,
                        notificationChannels: { ...prev.notificationChannels, inApp: checked },
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Escalation */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Escalación
              </h4>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label className="text-base">Notificar al vendedor si no hay respuesta</Label>
                    <p className="text-sm text-muted-foreground">
                      El vendedor recibe una alerta si el cliente no responde
                    </p>
                  </div>
                  <Switch
                    checked={followupConfig.notifySellerOnNoResponse}
                    onCheckedChange={(checked) =>
                      setFollowupConfig(prev => ({ ...prev, notifySellerOnNoResponse: checked }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Escalar a gerente después de (días)</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[followupConfig.escalateToManagerAfterDays]}
                      onValueChange={([v]) =>
                        setFollowupConfig(prev => ({ ...prev, escalateToManagerAfterDays: v }))
                      }
                      min={7}
                      max={30}
                      step={1}
                      className="flex-1"
                    />
                    <Badge variant="secondary" className="w-16 justify-center">
                      {followupConfig.escalateToManagerAfterDays} días
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Auto Actions */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Acciones Automáticas
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cierre automático después de (días)</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="number"
                      min="14"
                      max="90"
                      value={followupConfig.autoCloseAfterDays}
                      onChange={(e) =>
                        setFollowupConfig(prev => ({
                          ...prev,
                          autoCloseAfterDays: parseInt(e.target.value) || 30,
                        }))
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">
                      Se cierra como "Sin respuesta"
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Marcar como perdida después de (días)</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="number"
                      min="30"
                      max="120"
                      value={followupConfig.autoActions.markAsLostAfterDays}
                      onChange={(e) =>
                        setFollowupConfig(prev => ({
                          ...prev,
                          autoActions: {
                            ...prev.autoActions,
                            markAsLostAfterDays: parseInt(e.target.value) || 45,
                          },
                        }))
                      }
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">
                      Estado final: "Perdida"
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base">Crear tarea de seguimiento</Label>
                  <p className="text-sm text-muted-foreground">
                    Crea una tarea automática para el vendedor cuando no hay respuesta
                  </p>
                </div>
                <Switch
                  checked={followupConfig.autoActions.createTaskOnNoResponse}
                  onCheckedChange={(checked) =>
                    setFollowupConfig(prev => ({
                      ...prev,
                      autoActions: { ...prev.autoActions, createTaskOnNoResponse: checked },
                    }))
                  }
                />
              </div>
            </div>

            {/* Timeline Preview */}
            <TimelinePreview />
          </CardContent>
        )}
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </div>
    </div>
  );
}
