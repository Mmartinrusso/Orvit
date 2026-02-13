'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Settings,
  Globe,
  Bell,
  Mail,
  Shield,
  Palette,
  Database,
  Save,
  Loader2,
  Moon,
  Sun,
  Monitor,
  Clock,
  Building2,
  Key,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SystemSettings {
  // General
  systemName: string;
  systemLogo: string;
  defaultTimezone: string;
  defaultLanguage: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;

  // Email
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  emailFrom: string;
  emailFromName: string;

  // Security
  sessionTimeout: number;
  maxLoginAttempts: number;
  passwordMinLength: number;
  requireMFA: boolean;
  allowedIPs: string;

  // Notifications
  emailNotifications: boolean;
  systemAlerts: boolean;
  weeklyReports: boolean;
}

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSettings>({
    // General
    systemName: 'ORVIT',
    systemLogo: '/logo.png',
    defaultTimezone: 'America/Argentina/Buenos_Aires',
    defaultLanguage: 'es',
    maintenanceMode: false,
    maintenanceMessage: 'El sistema está en mantenimiento. Por favor, vuelva más tarde.',

    // Email
    smtpHost: 'smtp.example.com',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    emailFrom: 'noreply@orvit.com',
    emailFromName: 'ORVIT Sistema',

    // Security
    sessionTimeout: 480,
    maxLoginAttempts: 5,
    passwordMinLength: 8,
    requireMFA: false,
    allowedIPs: '',

    // Notifications
    emailNotifications: true,
    systemAlerts: true,
    weeklyReports: false,
  });

  const handleSave = async () => {
    setSaving(true);
    setTimeout(() => {
      toast.success('Configuración guardada correctamente');
      setSaving(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuración General</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Administra la configuración global del sistema
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Guardar Cambios
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">
            <Globe className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="h-4 w-4 mr-2" />
            Email
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Seguridad
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notificaciones
          </TabsTrigger>
        </TabsList>

        {/* Tab: General */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Información del Sistema
              </CardTitle>
              <CardDescription>
                Configuración básica del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Nombre del Sistema</Label>
                  <Input
                    value={settings.systemName}
                    onChange={(e) => setSettings({ ...settings, systemName: e.target.value })}
                    placeholder="ORVIT"
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL del Logo</Label>
                  <Input
                    value={settings.systemLogo}
                    onChange={(e) => setSettings({ ...settings, systemLogo: e.target.value })}
                    placeholder="/logo.png"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Zona Horaria por Defecto</Label>
                  <Select
                    value={settings.defaultTimezone}
                    onValueChange={(value) => setSettings({ ...settings, defaultTimezone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Argentina/Buenos_Aires">
                        Buenos Aires (GMT-3)
                      </SelectItem>
                      <SelectItem value="America/Sao_Paulo">
                        São Paulo (GMT-3)
                      </SelectItem>
                      <SelectItem value="America/Santiago">
                        Santiago (GMT-4)
                      </SelectItem>
                      <SelectItem value="America/Mexico_City">
                        Ciudad de México (GMT-6)
                      </SelectItem>
                      <SelectItem value="Europe/Madrid">
                        Madrid (GMT+1)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Idioma por Defecto</Label>
                  <Select
                    value={settings.defaultLanguage}
                    onValueChange={(value) => setSettings({ ...settings, defaultLanguage: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="pt">Português</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Modo Mantenimiento
              </CardTitle>
              <CardDescription>
                Activa el modo mantenimiento para realizar actualizaciones
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Activar Modo Mantenimiento</Label>
                  <p className="text-sm text-muted-foreground">
                    Los usuarios no podrán acceder al sistema mientras esté activo
                  </p>
                </div>
                <Switch
                  checked={settings.maintenanceMode}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, maintenanceMode: checked })
                  }
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Mensaje de Mantenimiento</Label>
                <Textarea
                  value={settings.maintenanceMessage}
                  onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })}
                  placeholder="El sistema está en mantenimiento..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Email */}
        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Configuración SMTP
              </CardTitle>
              <CardDescription>
                Configura el servidor de correo para envío de emails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Servidor SMTP</Label>
                  <Input
                    value={settings.smtpHost}
                    onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                    placeholder="smtp.example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Puerto SMTP</Label>
                  <Input
                    value={settings.smtpPort}
                    onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value })}
                    placeholder="587"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Usuario SMTP</Label>
                  <Input
                    value={settings.smtpUser}
                    onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                    placeholder="usuario@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contraseña SMTP</Label>
                  <Input
                    type="password"
                    value={settings.smtpPassword}
                    onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Email de Origen</Label>
                  <Input
                    value={settings.emailFrom}
                    onChange={(e) => setSettings({ ...settings, emailFrom: e.target.value })}
                    placeholder="noreply@orvit.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nombre de Origen</Label>
                  <Input
                    value={settings.emailFromName}
                    onChange={(e) => setSettings({ ...settings, emailFromName: e.target.value })}
                    placeholder="ORVIT Sistema"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline">
                  Enviar Email de Prueba
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Seguridad */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                Políticas de Acceso
              </CardTitle>
              <CardDescription>
                Configura las políticas de seguridad del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Tiempo de Sesión (minutos)</Label>
                  <Input
                    type="number"
                    value={settings.sessionTimeout}
                    onChange={(e) => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) || 0 })}
                    placeholder="480"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tiempo de inactividad antes de cerrar sesión
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Intentos de Login Máximos</Label>
                  <Input
                    type="number"
                    value={settings.maxLoginAttempts}
                    onChange={(e) => setSettings({ ...settings, maxLoginAttempts: parseInt(e.target.value) || 0 })}
                    placeholder="5"
                  />
                  <p className="text-xs text-muted-foreground">
                    Antes de bloquear la cuenta temporalmente
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Longitud Mínima de Contraseña</Label>
                  <Input
                    type="number"
                    value={settings.passwordMinLength}
                    onChange={(e) => setSettings({ ...settings, passwordMinLength: parseInt(e.target.value) || 0 })}
                    placeholder="8"
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Requerir Autenticación de Dos Factores (MFA)</Label>
                  <p className="text-sm text-muted-foreground">
                    Todos los usuarios deberán configurar MFA para acceder
                  </p>
                </div>
                <Switch
                  checked={settings.requireMFA}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, requireMFA: checked })
                  }
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>IPs Permitidas (Whitelist)</Label>
                <Textarea
                  value={settings.allowedIPs}
                  onChange={(e) => setSettings({ ...settings, allowedIPs: e.target.value })}
                  placeholder="192.168.1.0/24&#10;10.0.0.0/8"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Deja vacío para permitir todas las IPs. Una IP o rango por línea.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Notificaciones */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Configuración de Notificaciones
              </CardTitle>
              <CardDescription>
                Configura cómo y cuándo se envían notificaciones
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notificaciones por Email</Label>
                  <p className="text-sm text-muted-foreground">
                    Enviar notificaciones importantes por email a los usuarios
                  </p>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, emailNotifications: checked })
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Alertas del Sistema</Label>
                  <p className="text-sm text-muted-foreground">
                    Recibir alertas sobre errores y problemas del sistema
                  </p>
                </div>
                <Switch
                  checked={settings.systemAlerts}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, systemAlerts: checked })
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Reportes Semanales</Label>
                  <p className="text-sm text-muted-foreground">
                    Enviar resumen semanal de actividad por email
                  </p>
                </div>
                <Switch
                  checked={settings.weeklyReports}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, weeklyReports: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
