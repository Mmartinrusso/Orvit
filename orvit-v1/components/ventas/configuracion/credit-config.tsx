'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, X, Save, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CreditConfigProps {
  companyId: number;
}

export function CreditConfig({ companyId }: CreditConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [agingBuckets, setAgingBuckets] = useState<number[]>([30, 60, 90, 120]);
  const [newBucket, setNewBucket] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ventas/configuracion?companyId=${companyId}`);
      if (!response.ok) throw new Error('Error loading config');

      const data = await response.json();
      setConfig(data);

      if (data.agingBuckets) {
        setAgingBuckets(JSON.parse(data.agingBuckets as string));
      }
    } catch (error) {
      console.error('Error loading config:', error);
      toast.error('Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const response = await fetch(`/api/ventas/configuracion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          validarLimiteCredito: config.validarLimiteCredito,
          bloquearVentaSinCredito: config.bloquearVentaSinCredito,
          enableBlockByOverdue: config.enableBlockByOverdue,
          overdueGraceDays: config.overdueGraceDays,
          enableAging: config.enableAging,
          agingBuckets: JSON.stringify(agingBuckets),
          creditAlertThreshold: config.creditAlertThreshold,
          enableCheckLimit: config.enableCheckLimit,
          defaultCheckLimit: config.defaultCheckLimit,
          nivelEnforcementCredito: config.nivelEnforcementCredito,
        }),
      });

      if (!response.ok) throw new Error('Error saving config');

      toast.success('Configuración guardada correctamente');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleAddBucket = () => {
    const bucket = parseInt(newBucket);
    if (isNaN(bucket) || bucket <= 0) {
      toast.error('Ingrese un número de días válido');
      return;
    }
    if (agingBuckets.includes(bucket)) {
      toast.error('Este período ya existe');
      return;
    }
    setAgingBuckets([...agingBuckets, bucket].sort((a, b) => a - b));
    setNewBucket('');
  };

  const handleRemoveBucket = (bucket: number) => {
    if (agingBuckets.length <= 1) {
      toast.error('Debe haber al menos un período');
      return;
    }
    setAgingBuckets(agingBuckets.filter((b) => b !== bucket));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Configure cómo se valida y gestiona el crédito de los clientes. Estos parámetros afectan
          las validaciones al crear órdenes de venta y facturas.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Validación de Crédito</CardTitle>
          <CardDescription>
            Configure si y cómo se valida el límite de crédito de los clientes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Validar Límite de Crédito</Label>
              <p className="text-xs text-muted-foreground">
                Verificar que el cliente no exceda su límite de crédito
              </p>
            </div>
            <Switch
              checked={config?.validarLimiteCredito !== false}
              onCheckedChange={(checked) =>
                setConfig({ ...config, validarLimiteCredito: checked })
              }
            />
          </div>

          {config?.validarLimiteCredito !== false && (
            <>
              <div className="flex items-center justify-between ml-6">
                <div className="space-y-0.5">
                  <Label>Bloquear Venta Sin Crédito</Label>
                  <p className="text-xs text-muted-foreground">
                    Impedir crear órdenes si no hay crédito disponible
                  </p>
                </div>
                <Switch
                  checked={config?.bloquearVentaSinCredito || false}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, bloquearVentaSinCredito: checked })
                  }
                />
              </div>

              <div className="space-y-2 ml-6">
                <Label>Nivel de Enforcement</Label>
                <select
                  className="w-full p-2 border rounded-md"
                  value={config?.nivelEnforcementCredito || 'WARNING'}
                  onChange={(e) =>
                    setConfig({ ...config, nivelEnforcementCredito: e.target.value })
                  }
                >
                  <option value="STRICT">Estricto - Bloquea operación</option>
                  <option value="WARNING">Advertencia - Permite continuar</option>
                  <option value="DISABLED">Deshabilitado - Solo informativo</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Cómo se maneja cuando un cliente excede su límite de crédito
                </p>
              </div>

              <div className="space-y-2 ml-6">
                <Label>Umbral de Alerta de Crédito (%)</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={config?.creditAlertThreshold || 80}
                  onChange={(e) =>
                    setConfig({ ...config, creditAlertThreshold: parseFloat(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Alertar cuando el cliente alcance este % de su límite de crédito
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Envejecimiento de Deuda (Aging)</CardTitle>
          <CardDescription>
            Configure los períodos para clasificar facturas vencidas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Habilitar Aging</Label>
              <p className="text-xs text-muted-foreground">
                Clasificar deuda por antigüedad
              </p>
            </div>
            <Switch
              checked={config?.enableAging !== false}
              onCheckedChange={(checked) => setConfig({ ...config, enableAging: checked })}
            />
          </div>

          {config?.enableAging !== false && (
            <>
              <div className="space-y-2 ml-6">
                <Label>Períodos de Aging (días)</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {agingBuckets.map((bucket, index) => (
                    <Badge key={bucket} variant="outline" className="flex items-center gap-1 px-3 py-1">
                      {index === 0 ? '0-' : `${agingBuckets[index - 1]}-`}
                      {bucket} días
                      <button
                        onClick={() => handleRemoveBucket(bucket)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <Badge variant="outline" className="px-3 py-1">
                    +{agingBuckets[agingBuckets.length - 1]} días
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Días"
                    value={newBucket}
                    onChange={(e) => setNewBucket(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddBucket()}
                  />
                  <Button onClick={handleAddBucket} variant="outline" size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ejemplo: 30, 60, 90, 120 crea buckets: 0-30, 31-60, 61-90, 91-120, +120
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bloqueo por Mora</CardTitle>
          <CardDescription>
            Configure si se bloquea a clientes con facturas vencidas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Bloquear por Facturas Vencidas</Label>
              <p className="text-xs text-muted-foreground">
                Impedir nuevas ventas a clientes con facturas vencidas
              </p>
            </div>
            <Switch
              checked={config?.enableBlockByOverdue || false}
              onCheckedChange={(checked) =>
                setConfig({ ...config, enableBlockByOverdue: checked })
              }
            />
          </div>

          {config?.enableBlockByOverdue && (
            <div className="space-y-2 ml-6">
              <Label>Días de Gracia</Label>
              <Input
                type="number"
                min="0"
                value={config?.overdueGraceDays || 0}
                onChange={(e) =>
                  setConfig({ ...config, overdueGraceDays: parseInt(e.target.value) })
                }
              />
              <p className="text-xs text-muted-foreground">
                Días de tolerancia después del vencimiento antes de bloquear
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Límites de Cheques</CardTitle>
          <CardDescription>
            Configure límites para pagos con cheques
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Habilitar Límite de Cheques</Label>
              <p className="text-xs text-muted-foreground">
                Validar límite de cheques en cartera
              </p>
            </div>
            <Switch
              checked={config?.enableCheckLimit !== false}
              onCheckedChange={(checked) => setConfig({ ...config, enableCheckLimit: checked })}
            />
          </div>

          {config?.enableCheckLimit !== false && (
            <div className="space-y-2 ml-6">
              <Label>Límite por Defecto ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={config?.defaultCheckLimit || ''}
                onChange={(e) =>
                  setConfig({ ...config, defaultCheckLimit: parseFloat(e.target.value) })
                }
                placeholder="Ejemplo: 500000"
              />
              <p className="text-xs text-muted-foreground">
                Límite máximo de cheques en cartera por cliente (opcional)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Guardar Cambios
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
