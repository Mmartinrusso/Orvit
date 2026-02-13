'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Percent, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface DiscountConfigProps {
  companyId: number;
}

export function DiscountConfig({ companyId }: DiscountConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>(null);

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

      // Validaciones
      const maxAuto = parseFloat(config.descuentoMaximoAutomatico || 0);
      const maxConAprobacion = parseFloat(config.descuentoMaximoConAprobacion || 0);
      const maxSinAprobacion = parseFloat(config.maxDescuentoSinAprobacion || 0);

      if (maxAuto < 0 || maxAuto > 100) {
        toast.error('El descuento automático debe estar entre 0 y 100%');
        return;
      }

      if (maxConAprobacion < 0 || maxConAprobacion > 100) {
        toast.error('El descuento con aprobación debe estar entre 0 y 100%');
        return;
      }

      if (maxSinAprobacion < 0 || maxSinAprobacion > 100) {
        toast.error('El descuento sin aprobación debe estar entre 0 y 100%');
        return;
      }

      if (maxAuto > maxSinAprobacion) {
        toast.error('El descuento automático no puede ser mayor al descuento sin aprobación');
        return;
      }

      if (maxSinAprobacion > maxConAprobacion) {
        toast.error('El descuento sin aprobación no puede ser mayor al descuento con aprobación');
        return;
      }

      const response = await fetch(`/api/ventas/configuracion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          descuentoMaximoAutomatico: config.descuentoMaximoAutomatico,
          descuentoMaximoConAprobacion: config.descuentoMaximoConAprobacion,
          maxDescuentoSinAprobacion: config.maxDescuentoSinAprobacion,
          requiereAprobacionDescuento: config.requiereAprobacionDescuento,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const maxAuto = parseFloat(config?.descuentoMaximoAutomatico || 5);
  const maxSinAprobacion = parseFloat(config?.maxDescuentoSinAprobacion || 10);
  const maxConAprobacion = parseFloat(config?.descuentoMaximoConAprobacion || 20);

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Configure los límites de descuentos permitidos en cotizaciones y órdenes de venta.
          Los descuentos se validan según estos umbrales.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Descuentos Automáticos</CardTitle>
          <CardDescription>
            Descuentos que se pueden aplicar sin intervención manual
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Descuento Máximo Automático (%)</Label>
              <span className="text-2xl font-bold text-primary">
                {config?.descuentoMaximoAutomatico || 5}%
              </span>
            </div>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={config?.descuentoMaximoAutomatico || 5}
              onChange={(e) =>
                setConfig({ ...config, descuentoMaximoAutomatico: parseFloat(e.target.value) })
              }
            />
            <Progress value={maxAuto} className="h-2" />
            <p className="text-xs text-muted-foreground">
              Descuentos hasta este valor se aplican automáticamente sin restricciones
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Descuentos con Aprobación</CardTitle>
          <CardDescription>
            Configure el sistema de aprobación de descuentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Requerir Aprobación de Descuentos</Label>
              <p className="text-xs text-muted-foreground">
                Activar flujo de aprobación para descuentos altos
              </p>
            </div>
            <Switch
              checked={config?.requiereAprobacionDescuento !== false}
              onCheckedChange={(checked) =>
                setConfig({ ...config, requiereAprobacionDescuento: checked })
              }
            />
          </div>

          {config?.requiereAprobacionDescuento !== false && (
            <>
              <div className="space-y-2 ml-6">
                <div className="flex items-center justify-between">
                  <Label>Descuento Máximo sin Aprobación (%)</Label>
                  <span className="text-2xl font-bold text-orange-500">
                    {config?.maxDescuentoSinAprobacion || 10}%
                  </span>
                </div>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={config?.maxDescuentoSinAprobacion || 10}
                  onChange={(e) =>
                    setConfig({ ...config, maxDescuentoSinAprobacion: parseFloat(e.target.value) })
                  }
                />
                <Progress value={maxSinAprobacion} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Descuentos superiores a este valor requerirán aprobación
                </p>
              </div>

              <div className="space-y-2 ml-6">
                <div className="flex items-center justify-between">
                  <Label>Descuento Máximo con Aprobación (%)</Label>
                  <span className="text-2xl font-bold text-red-500">
                    {config?.descuentoMaximoConAprobacion || 20}%
                  </span>
                </div>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={config?.descuentoMaximoConAprobacion || 20}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      descuentoMaximoConAprobacion: parseFloat(e.target.value),
                    })
                  }
                />
                <Progress value={maxConAprobacion} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Descuento máximo permitido incluso con aprobación
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Escala de Descuentos</CardTitle>
          <CardDescription>
            Visualización de los rangos configurados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Zona Verde (Automático)</span>
                  <span className="text-sm text-muted-foreground">0% - {maxAuto}%</span>
                </div>
                <div className="h-3 bg-green-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${(maxAuto / 100) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {config?.requiereAprobacionDescuento !== false && (
              <>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Zona Amarilla (Requiere Aprobación)</span>
                      <span className="text-sm text-muted-foreground">
                        {maxAuto}% - {maxSinAprobacion}%
                      </span>
                    </div>
                    <div className="h-3 bg-yellow-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-500"
                        style={{
                          width: `${((maxSinAprobacion - maxAuto) / 100) * 100}%`,
                          marginLeft: `${(maxAuto / 100) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Zona Naranja (Con Aprobación)</span>
                      <span className="text-sm text-muted-foreground">
                        {maxSinAprobacion}% - {maxConAprobacion}%
                      </span>
                    </div>
                    <div className="h-3 bg-orange-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500"
                        style={{
                          width: `${((maxConAprobacion - maxSinAprobacion) / 100) * 100}%`,
                          marginLeft: `${(maxSinAprobacion / 100) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Zona Roja (No Permitido)</span>
                      <span className="text-sm text-muted-foreground">
                        +{maxConAprobacion}%
                      </span>
                    </div>
                    <div className="h-3 bg-red-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500"
                        style={{
                          width: `${((100 - maxConAprobacion) / 100) * 100}%`,
                          marginLeft: `${(maxConAprobacion / 100) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
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
