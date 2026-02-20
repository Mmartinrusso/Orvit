'use client';

/**
 * Modules Configuration Component
 *
 * Allows companies to enable/disable sales modules based on their operations
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2, Save, FileText, ShoppingCart, Truck, Receipt, CreditCard, Package, AlertCircle, Calendar, MessageSquareWarning, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ModulesConfig {
  moduloCotizacionesHabilitado: boolean;
  moduloOrdenesHabilitado: boolean;
  moduloEntregasHabilitado: boolean;
  moduloFacturasHabilitado: boolean;
  moduloCobranzasHabilitado: boolean;
  moduloRemitosHabilitado: boolean;
  moduloNotasCreditoHabilitado: boolean;
  moduloTurnosHabilitado: boolean;
  moduloDisputasHabilitado: boolean;
  moduloValoresHabilitado: boolean;
}

const MODULES = [
  {
    key: 'moduloCotizacionesHabilitado' as keyof ModulesConfig,
    name: 'Cotizaciones',
    description: 'Presupuestos y cotizaciones a clientes',
    icon: FileText,
    core: true,
  },
  {
    key: 'moduloOrdenesHabilitado' as keyof ModulesConfig,
    name: 'Órdenes de Venta',
    description: 'Pedidos y órdenes de venta confirmadas',
    icon: ShoppingCart,
    core: true,
  },
  {
    key: 'moduloFacturasHabilitado' as keyof ModulesConfig,
    name: 'Facturación',
    description: 'Facturas de venta y notas de débito',
    icon: Receipt,
    core: true,
  },
  {
    key: 'moduloCobranzasHabilitado' as keyof ModulesConfig,
    name: 'Cobranzas',
    description: 'Gestión de pagos y cobranzas',
    icon: CreditCard,
    core: true,
  },
  {
    key: 'moduloEntregasHabilitado' as keyof ModulesConfig,
    name: 'Entregas',
    description: 'Gestión de entregas y despachos',
    icon: Truck,
    core: false,
  },
  {
    key: 'moduloRemitosHabilitado' as keyof ModulesConfig,
    name: 'Remitos',
    description: 'Remitos de entrega',
    icon: Package,
    core: false,
  },
  {
    key: 'moduloNotasCreditoHabilitado' as keyof ModulesConfig,
    name: 'Notas de Crédito',
    description: 'Anulaciones y devoluciones',
    icon: Receipt,
    core: false,
  },
  {
    key: 'moduloValoresHabilitado' as keyof ModulesConfig,
    name: 'Gestión de Valores',
    description: 'Cheques y echeqs',
    icon: Wallet,
    core: false,
  },
  {
    key: 'moduloTurnosHabilitado' as keyof ModulesConfig,
    name: 'Turnos de Retiro',
    description: 'Programación de retiros (pickup)',
    icon: Calendar,
    core: false,
  },
  {
    key: 'moduloDisputasHabilitado' as keyof ModulesConfig,
    name: 'Disputas/Reclamos',
    description: 'Gestión de reclamos de clientes',
    icon: MessageSquareWarning,
    core: false,
  },
];

export function ModulesConfig() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ModulesConfig>({
    moduloCotizacionesHabilitado: true,
    moduloOrdenesHabilitado: true,
    moduloEntregasHabilitado: true,
    moduloFacturasHabilitado: true,
    moduloCobranzasHabilitado: true,
    moduloRemitosHabilitado: true,
    moduloNotasCreditoHabilitado: true,
    moduloTurnosHabilitado: false,
    moduloDisputasHabilitado: false,
    moduloValoresHabilitado: true,
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
          <CardTitle>Módulos Habilitados</CardTitle>
          <CardDescription>
            Selecciona qué módulos de ventas están activos para tu empresa.
            Los módulos deshabilitados no aparecerán en el sidebar ni estarán accesibles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {/* Core Modules */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Módulos Principales</h3>
            <div className="space-y-3">
              {MODULES.filter((m) => m.core).map((module) => {
                const Icon = module.icon;
                return (
                  <div
                    key={module.key}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <Label htmlFor={module.key} className="cursor-pointer font-medium">
                          {module.name}
                        </Label>
                        <p className="text-sm text-muted-foreground">{module.description}</p>
                      </div>
                    </div>
                    <Switch
                      id={module.key}
                      checked={config[module.key]}
                      onCheckedChange={(checked) => setConfig({ ...config, [module.key]: checked })}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Optional Modules */}
          <div>
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Módulos Opcionales</h3>
            <div className="space-y-3">
              {MODULES.filter((m) => !m.core).map((module) => {
                const Icon = module.icon;
                return (
                  <div
                    key={module.key}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <Label htmlFor={module.key} className="cursor-pointer font-medium">
                          {module.name}
                        </Label>
                        <p className="text-sm text-muted-foreground">{module.description}</p>
                      </div>
                    </div>
                    <Switch
                      id={module.key}
                      checked={config[module.key]}
                      onCheckedChange={(checked) => setConfig({ ...config, [module.key]: checked })}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning */}
      <Card className="border-warning-muted bg-warning-muted">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-warning-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="text-sm text-foreground">
              <p className="font-medium mb-1">Importante</p>
              <p>
                Los módulos deshabilitados no estarán disponibles en el sistema. Asegúrate de que tu
                empresa no los necesite antes de deshabilitarlos. Los usuarios no podrán acceder a las
                funcionalidades de módulos deshabilitados.
              </p>
            </div>
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
