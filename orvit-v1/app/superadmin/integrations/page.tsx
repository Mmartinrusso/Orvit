'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Globe,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Settings,
  Key,
  RefreshCw,
  ExternalLink,
  Webhook,
  Cloud,
  CreditCard,
  Mail,
  MessageSquare,
  FileSpreadsheet,
  Smartphone,
  Zap,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'error';
  enabled: boolean;
  lastSync: string | null;
  config: Record<string, any>;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive';
  lastTriggered: string | null;
  successRate: number;
}

const iconMap: Record<string, any> = {
  cloud: Cloud,
  creditcard: CreditCard,
  mail: Mail,
  message: MessageSquare,
  spreadsheet: FileSpreadsheet,
  phone: Smartphone,
  zap: Zap,
  webhook: Webhook,
};

const statusConfig = {
  connected: { label: 'Conectado', color: 'bg-success/10 text-success border-success-muted/20', icon: CheckCircle },
  disconnected: { label: 'Desconectado', color: 'bg-muted text-muted-foreground border-border', icon: XCircle },
  error: { label: 'Error', color: 'bg-destructive/10 text-destructive border-destructive/30/20', icon: AlertCircle },
};

// Datos de ejemplo
const mockIntegrations: Integration[] = [
  {
    id: '1',
    name: 'AFIP - Facturación Electrónica',
    description: 'Integración con AFIP para emisión de comprobantes fiscales',
    category: 'fiscal',
    icon: 'creditcard',
    status: 'connected',
    enabled: true,
    lastSync: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    config: { cuit: '30-12345678-9', environment: 'production' },
  },
  {
    id: '2',
    name: 'AWS S3 - Almacenamiento',
    description: 'Almacenamiento de archivos y backups en la nube',
    category: 'storage',
    icon: 'cloud',
    status: 'connected',
    enabled: true,
    lastSync: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    config: { bucket: 'orvit-files', region: 'sa-east-1' },
  },
  {
    id: '3',
    name: 'SendGrid - Email',
    description: 'Servicio de envío de emails transaccionales',
    category: 'communication',
    icon: 'mail',
    status: 'connected',
    enabled: true,
    lastSync: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    config: {},
  },
  {
    id: '4',
    name: 'WhatsApp Business',
    description: 'Notificaciones y comunicación por WhatsApp',
    category: 'communication',
    icon: 'message',
    status: 'disconnected',
    enabled: false,
    lastSync: null,
    config: {},
  },
  {
    id: '5',
    name: 'Google Sheets',
    description: 'Exportación automática de datos a hojas de cálculo',
    category: 'export',
    icon: 'spreadsheet',
    status: 'disconnected',
    enabled: false,
    lastSync: null,
    config: {},
  },
  {
    id: '6',
    name: 'Twilio SMS',
    description: 'Envío de SMS para alertas críticas',
    category: 'communication',
    icon: 'phone',
    status: 'error',
    enabled: true,
    lastSync: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    config: {},
  },
  {
    id: '7',
    name: 'MercadoPago',
    description: 'Procesamiento de pagos online',
    category: 'payment',
    icon: 'creditcard',
    status: 'disconnected',
    enabled: false,
    lastSync: null,
    config: {},
  },
  {
    id: '8',
    name: 'Zapier',
    description: 'Automatizaciones con aplicaciones externas',
    category: 'automation',
    icon: 'zap',
    status: 'connected',
    enabled: true,
    lastSync: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    config: {},
  },
];

const mockWebhooks: Webhook[] = [
  {
    id: '1',
    name: 'Nuevo pedido',
    url: 'https://api.example.com/webhooks/orders',
    events: ['order.created', 'order.updated'],
    status: 'active',
    lastTriggered: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    successRate: 98.5,
  },
  {
    id: '2',
    name: 'Stock bajo',
    url: 'https://api.example.com/webhooks/stock',
    events: ['stock.low'],
    status: 'active',
    lastTriggered: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    successRate: 100,
  },
  {
    id: '3',
    name: 'Alertas de mantenimiento',
    url: 'https://api.example.com/webhooks/maintenance',
    events: ['maintenance.scheduled', 'maintenance.completed'],
    status: 'inactive',
    lastTriggered: null,
    successRate: 0,
  },
];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  useEffect(() => {
    setTimeout(() => {
      setIntegrations(mockIntegrations);
      setWebhooks(mockWebhooks);
      setLoading(false);
    }, 500);
  }, []);

  const handleToggleIntegration = (integration: Integration) => {
    setIntegrations(integrations.map(i =>
      i.id === integration.id ? { ...i, enabled: !i.enabled } : i
    ));
    toast.success(integration.enabled ? 'Integración desactivada' : 'Integración activada');
  };

  const handleConfigure = (integration: Integration) => {
    setSelectedIntegration(integration);
    setConfigDialogOpen(true);
  };

  const handleTestConnection = (integration: Integration) => {
    toast.success('Conexión probada exitosamente');
  };

  const stats = {
    total: integrations.length,
    connected: integrations.filter(i => i.status === 'connected').length,
    enabled: integrations.filter(i => i.enabled).length,
    webhooksActive: webhooks.filter(w => w.status === 'active').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Integraciones</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestiona las conexiones con servicios externos
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center">
                <Globe className="h-6 w-6 text-info-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Integraciones</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.connected}</p>
                <p className="text-sm text-muted-foreground">Conectadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-accent-purple/10 flex items-center justify-center">
                <Zap className="h-6 w-6 text-accent-purple" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.enabled}</p>
                <p className="text-sm text-muted-foreground">Activas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <Webhook className="h-6 w-6 text-warning-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.webhooksActive}</p>
                <p className="text-sm text-muted-foreground">Webhooks Activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="integrations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="integrations">
            <Globe className="h-4 w-4 mr-2" />
            Integraciones
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <Webhook className="h-4 w-4 mr-2" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="api">
            <Key className="h-4 w-4 mr-2" />
            API Keys
          </TabsTrigger>
        </TabsList>

        {/* Tab: Integraciones */}
        <TabsContent value="integrations" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integrations.map((integration) => {
              const Icon = iconMap[integration.icon] || Globe;
              const status = statusConfig[integration.status];
              const StatusIcon = status.icon;

              return (
                <Card key={integration.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          integration.enabled ? "bg-primary/10" : "bg-muted"
                        )}>
                          <Icon className={cn(
                            "h-5 w-5",
                            integration.enabled ? "text-primary" : "text-muted-foreground"
                          )} />
                        </div>
                        <div>
                          <h3 className="font-medium text-sm">{integration.name}</h3>
                          <Badge className={cn("text-xs mt-1", status.color)}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status.label}
                          </Badge>
                        </div>
                      </div>
                      <Switch
                        checked={integration.enabled}
                        onCheckedChange={() => handleToggleIntegration(integration)}
                      />
                    </div>

                    <p className="text-sm text-muted-foreground mb-4">
                      {integration.description}
                    </p>

                    {integration.lastSync && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
                        <Clock className="h-3 w-3" />
                        Última sincronización: {formatDistanceToNow(new Date(integration.lastSync), { addSuffix: true, locale: es })}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConfigure(integration)}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Configurar
                      </Button>
                      {integration.status === 'connected' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTestConnection(integration)}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Probar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab: Webhooks */}
        <TabsContent value="webhooks" className="space-y-4">
          <div className="flex justify-end">
            <Button>
              <Webhook className="h-4 w-4 mr-2" />
              Nuevo Webhook
            </Button>
          </div>

          <div className="space-y-4">
            {webhooks.map((webhook) => (
              <Card key={webhook.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{webhook.name}</h3>
                        <Badge
                          className={cn(
                            "text-xs",
                            webhook.status === 'active'
                              ? "bg-success/10 text-success border-success-muted/20"
                              : "bg-muted text-muted-foreground border-border"
                          )}
                        >
                          {webhook.status === 'active' ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground font-mono mt-1">
                        {webhook.url}
                      </p>
                    </div>
                    <Switch checked={webhook.status === 'active'} />
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {webhook.events.map((event) => (
                      <Badge key={event} variant="outline" className="text-xs">
                        {event}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4 text-muted-foreground">
                      {webhook.lastTriggered && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(webhook.lastTriggered), { addSuffix: true, locale: es })}
                        </span>
                      )}
                      {webhook.successRate > 0 && (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          {webhook.successRate}% éxito
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab: API Keys */}
        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                Claves de API
              </CardTitle>
              <CardDescription>
                Gestiona las claves de acceso a la API del sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-sm">API Key Principal</h4>
                    <p className="text-xs text-muted-foreground">Creada el 01/01/2025</p>
                  </div>
                  <Badge className="text-xs bg-success/10 text-success border-success-muted/20">
                    Activa
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value="sk_live_••••••••••••••••••••••••"
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" size="sm">
                    Copiar
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-medium text-sm">API Key de Prueba</h4>
                    <p className="text-xs text-muted-foreground">Solo para desarrollo</p>
                  </div>
                  <Badge className="text-xs bg-warning/10 text-warning-muted-foreground border-warning-muted/20">
                    Test
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value="sk_test_••••••••••••••••••••••••"
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" size="sm">
                    Copiar
                  </Button>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <p className="text-sm text-muted-foreground">
                  Nunca compartas tus claves de API. Regeneralas si sospechas que han sido comprometidas.
                </p>
                <Button variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerar Claves
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documentación de la API</CardTitle>
              <CardDescription>
                Recursos para integrar con nuestra API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border bg-muted/30 hover:border-primary/50 transition-colors cursor-pointer">
                  <h4 className="font-medium text-sm mb-1">Referencia de API</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Documentación completa de todos los endpoints
                  </p>
                  <span className="text-xs text-primary flex items-center gap-1">
                    Ver documentación <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
                <div className="p-4 rounded-lg border bg-muted/30 hover:border-primary/50 transition-colors cursor-pointer">
                  <h4 className="font-medium text-sm mb-1">Guía de Inicio</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Aprende a usar la API paso a paso
                  </p>
                  <span className="text-xs text-primary flex items-center gap-1">
                    Comenzar <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
                <div className="p-4 rounded-lg border bg-muted/30 hover:border-primary/50 transition-colors cursor-pointer">
                  <h4 className="font-medium text-sm mb-1">SDKs</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Librerías oficiales para diferentes lenguajes
                  </p>
                  <span className="text-xs text-primary flex items-center gap-1">
                    Descargar <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Config Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Configurar {selectedIntegration?.name}
            </DialogTitle>
            <DialogDescription>
              Configura los parámetros de la integración
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input type="password" placeholder="••••••••••••••••" />
            </div>
            <div className="space-y-2">
              <Label>Secret Key</Label>
              <Input type="password" placeholder="••••••••••••••••" />
            </div>
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="env" defaultChecked className="text-primary" />
                  <span className="text-sm">Producción</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="env" className="text-primary" />
                  <span className="text-sm">Sandbox</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfigDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => {
              toast.success('Configuración guardada');
              setConfigDialogOpen(false);
            }}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
