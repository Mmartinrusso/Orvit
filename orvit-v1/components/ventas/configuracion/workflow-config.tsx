'use client';

/**
 * Workflow Configuration Component
 *
 * Allows companies to customize workflow behavior:
 * - Payment approval requirements
 * - Invoice approval requirements
 * - Order confirmation requirements
 * - Enforcement levels for credit and stock
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WorkflowConfig {
  // Payment approval
  requiereAprobacionPagos: boolean;
  requiereAprobacionPagosMontoMinimo?: number;
  aprobacionPagosTiposRequieren?: string; // JSON array

  // Invoice approval
  requiereAprobacionFacturas: boolean;
  requiereAprobacionFacturasMontoMinimo?: number;

  // Order confirmation
  requiereConfirmacionOrden: boolean;
  permitirOrdenSinStock: boolean;
  permitirOrdenSinCredito: boolean;

  // Enforcement levels
  nivelEnforcementCredito: 'STRICT' | 'WARNING' | 'DISABLED';
  nivelEnforcementStock: 'STRICT' | 'WARNING' | 'DISABLED';

  // Credit
  validarLimiteCredito: boolean;
  bloquearVentaSinCredito: boolean;

  // Stock
  validarStockDisponible: boolean;
  permitirVentaSinStock: boolean;
  decrementarStockEnConfirmacion: boolean;
}

const ENFORCEMENT_LEVELS = {
  STRICT: {
    label: 'Estricto',
    description: 'Bloquea la operación',
    color: 'bg-destructive/10 text-destructive border-destructive',
    icon: ShieldAlert,
  },
  WARNING: {
    label: 'Advertencia',
    description: 'Alerta pero permite continuar',
    color: 'bg-warning-muted text-warning-muted-foreground border-warning',
    icon: AlertTriangle,
  },
  DISABLED: {
    label: 'Deshabilitado',
    description: 'Sin control',
    color: 'bg-muted text-foreground border-border',
    icon: CheckCircle2,
  },
};

export function WorkflowConfig() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<WorkflowConfig>({
    requiereAprobacionPagos: false,
    requiereAprobacionFacturas: false,
    requiereConfirmacionOrden: true,
    permitirOrdenSinStock: true,
    permitirOrdenSinCredito: false,
    nivelEnforcementCredito: 'WARNING',
    nivelEnforcementStock: 'WARNING',
    validarLimiteCredito: true,
    bloquearVentaSinCredito: false,
    validarStockDisponible: true,
    permitirVentaSinStock: true,
    decrementarStockEnConfirmacion: true,
  });

  const [pagosTiposRequieren, setPagosTiposRequieren] = useState<string[]>([]);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/ventas/configuracion', { credentials: 'include' });
      if (response.ok) {
        const { data } = await response.json();
        setConfig(data);

        // Parse payment types JSON
        if (data.aprobacionPagosTiposRequieren) {
          try {
            setPagosTiposRequieren(JSON.parse(data.aprobacionPagosTiposRequieren));
          } catch (e) {
            setPagosTiposRequieren([]);
          }
        }
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
        body: JSON.stringify({
          ...config,
          aprobacionPagosTiposRequieren: JSON.stringify(pagosTiposRequieren),
        }),
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

  const togglePaymentType = (tipo: string) => {
    setPagosTiposRequieren((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
    );
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
      {/* Payment Approval */}
      <Card>
        <CardHeader>
          <CardTitle>Aprobación de Pagos</CardTitle>
          <CardDescription>
            Configura si los pagos requieren aprobación antes de impactar la cuenta corriente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="requiereAprobacionPagos">Requiere aprobación manual</Label>
              <p className="text-sm text-muted-foreground">
                Los pagos quedarán en estado PENDIENTE hasta que un administrador los apruebe
              </p>
            </div>
            <Switch
              id="requiereAprobacionPagos"
              checked={config.requiereAprobacionPagos}
              onCheckedChange={(checked) =>
                setConfig({ ...config, requiereAprobacionPagos: checked })
              }
            />
          </div>

          {config.requiereAprobacionPagos && (
            <>
              <div className="space-y-2">
                <Label htmlFor="montoMinimo">Monto mínimo que requiere aprobación (opcional)</Label>
                <Input
                  id="montoMinimo"
                  type="number"
                  step="0.01"
                  placeholder="Ej: 50000"
                  value={config.requiereAprobacionPagosMontoMinimo || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      requiereAprobacionPagosMontoMinimo: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Solo pagos mayores a este monto requerirán aprobación. Dejar vacío para requerir en todos.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Tipos de pago que requieren aprobación</Label>
                <div className="flex flex-wrap gap-2">
                  {['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'ECHEQ', 'TARJETA'].map((tipo) => (
                    <Badge
                      key={tipo}
                      variant={pagosTiposRequieren.includes(tipo) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => togglePaymentType(tipo)}
                    >
                      {tipo}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selecciona qué tipos de pago requieren aprobación. Si no seleccionas ninguno, todos la requerirán.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Invoice Approval */}
      <Card>
        <CardHeader>
          <CardTitle>Aprobación de Facturas</CardTitle>
          <CardDescription>
            Configura si las facturas requieren aprobación antes de ser emitidas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="requiereAprobacionFacturas">Requiere aprobación manual</Label>
              <p className="text-sm text-muted-foreground">
                Las facturas quedarán en borrador hasta que un administrador las apruebe
              </p>
            </div>
            <Switch
              id="requiereAprobacionFacturas"
              checked={config.requiereAprobacionFacturas}
              onCheckedChange={(checked) =>
                setConfig({ ...config, requiereAprobacionFacturas: checked })
              }
            />
          </div>

          {config.requiereAprobacionFacturas && (
            <div className="space-y-2">
              <Label htmlFor="montoMinimoFactura">Monto mínimo que requiere aprobación (opcional)</Label>
              <Input
                id="montoMinimoFactura"
                type="number"
                step="0.01"
                placeholder="Ej: 100000"
                value={config.requiereAprobacionFacturasMontoMinimo || ''}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    requiereAprobacionFacturasMontoMinimo: e.target.value
                      ? parseFloat(e.target.value)
                      : undefined,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Solo facturas mayores a este monto requerirán aprobación.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Confirmation */}
      <Card>
        <CardHeader>
          <CardTitle>Órdenes de Venta</CardTitle>
          <CardDescription>Workflow de confirmación de órdenes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="requiereConfirmacionOrden">Requiere confirmación explícita</Label>
              <p className="text-sm text-muted-foreground">
                Las órdenes no se confirmarán automáticamente
              </p>
            </div>
            <Switch
              id="requiereConfirmacionOrden"
              checked={config.requiereConfirmacionOrden}
              onCheckedChange={(checked) =>
                setConfig({ ...config, requiereConfirmacionOrden: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="permitirOrdenSinStock">Permitir órdenes sin stock</Label>
              <p className="text-sm text-muted-foreground">
                Se pueden crear órdenes aunque no haya stock disponible
              </p>
            </div>
            <Switch
              id="permitirOrdenSinStock"
              checked={config.permitirOrdenSinStock}
              onCheckedChange={(checked) =>
                setConfig({ ...config, permitirOrdenSinStock: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="permitirOrdenSinCredito">Permitir órdenes sin crédito disponible</Label>
              <p className="text-sm text-muted-foreground">
                Se pueden crear órdenes aunque el cliente exceda su límite de crédito
              </p>
            </div>
            <Switch
              id="permitirOrdenSinCredito"
              checked={config.permitirOrdenSinCredito}
              onCheckedChange={(checked) =>
                setConfig({ ...config, permitirOrdenSinCredito: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <div>
              <Label htmlFor="decrementarStockEnConfirmacion" className="font-semibold">
                Decrementar stock al confirmar orden
              </Label>
              <p className="text-sm text-muted-foreground">
                Al confirmar una orden de venta, se descuenta automáticamente el stock físico del producto.
                <span className="block mt-1 font-medium text-warning-muted-foreground">
                  ⚠️ Desactivar solo si gestionas stock manualmente o usas otro sistema.
                </span>
              </p>
            </div>
            <Switch
              id="decrementarStockEnConfirmacion"
              checked={config.decrementarStockEnConfirmacion}
              onCheckedChange={(checked) =>
                setConfig({ ...config, decrementarStockEnConfirmacion: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Enforcement Levels */}
      <Card>
        <CardHeader>
          <CardTitle>Niveles de Control</CardTitle>
          <CardDescription>
            Define qué tan estrictos son los controles de crédito y stock
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Credit Enforcement */}
          <div className="space-y-3">
            <Label>Control de Límite de Crédito</Label>
            <Select
              value={config.nivelEnforcementCredito}
              onValueChange={(value) =>
                setConfig({
                  ...config,
                  nivelEnforcementCredito: value as 'STRICT' | 'WARNING' | 'DISABLED',
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ENFORCEMENT_LEVELS).map(([key, { label, description, color, icon: Icon }]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <div>
                        <div className="font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground">{description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge className={ENFORCEMENT_LEVELS[config.nivelEnforcementCredito].color}>
              {ENFORCEMENT_LEVELS[config.nivelEnforcementCredito].label}
            </Badge>
          </div>

          {/* Stock Enforcement */}
          <div className="space-y-3">
            <Label>Control de Stock Disponible</Label>
            <Select
              value={config.nivelEnforcementStock}
              onValueChange={(value) =>
                setConfig({
                  ...config,
                  nivelEnforcementStock: value as 'STRICT' | 'WARNING' | 'DISABLED',
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ENFORCEMENT_LEVELS).map(([key, { label, description, icon: Icon }]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <div>
                        <div className="font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground">{description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge className={ENFORCEMENT_LEVELS[config.nivelEnforcementStock].color}>
              {ENFORCEMENT_LEVELS[config.nivelEnforcementStock].label}
            </Badge>
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
