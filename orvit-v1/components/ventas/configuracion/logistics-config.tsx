'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Save, Truck, Calendar, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface LogisticsConfigProps {
  companyId: number;
}

export function LogisticsConfig({ companyId }: LogisticsConfigProps) {
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
      const capacidad = parseInt(config.turnoCapacidadMaximaDefault);
      const maxParadas = parseInt(config.rutaMaxParadas);
      const maxDistancia = parseFloat(config.rutaMaxDistanciaKm);

      if (capacidad < 1) {
        toast.error('La capacidad debe ser al menos 1');
        return;
      }

      if (maxParadas < 1) {
        toast.error('El máximo de paradas debe ser al menos 1');
        return;
      }

      if (maxDistancia <= 0) {
        toast.error('La distancia máxima debe ser mayor a 0');
        return;
      }

      // Validar formato de hora
      const horaInicioRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!horaInicioRegex.test(config.turnoHoraInicioDefault)) {
        toast.error('Formato de hora de inicio inválido (HH:MM)');
        return;
      }

      if (!horaInicioRegex.test(config.turnoHoraFinDefault)) {
        toast.error('Formato de hora de fin inválido (HH:MM)');
        return;
      }

      const response = await fetch(`/api/ventas/configuracion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          turnoCapacidadMaximaDefault: config.turnoCapacidadMaximaDefault,
          turnoHoraInicioDefault: config.turnoHoraInicioDefault,
          turnoHoraFinDefault: config.turnoHoraFinDefault,
          rutaMaxParadas: config.rutaMaxParadas,
          rutaMaxDistanciaKm: config.rutaMaxDistanciaKm,
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Configuración de Turnos
          </CardTitle>
          <CardDescription>
            Configure los valores por defecto para turnos de retiro
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Capacidad Máxima por Defecto</Label>
              <Input
                type="number"
                min="1"
                value={config?.turnoCapacidadMaximaDefault || 1}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    turnoCapacidadMaximaDefault: parseInt(e.target.value),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Número de clientes por turno
              </p>
            </div>

            <div className="space-y-2">
              <Label>Hora de Inicio</Label>
              <Input
                type="time"
                value={config?.turnoHoraInicioDefault || '08:00'}
                onChange={(e) =>
                  setConfig({ ...config, turnoHoraInicioDefault: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Inicio de la jornada
              </p>
            </div>

            <div className="space-y-2">
              <Label>Hora de Fin</Label>
              <Input
                type="time"
                value={config?.turnoHoraFinDefault || '18:00'}
                onChange={(e) =>
                  setConfig({ ...config, turnoHoraFinDefault: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Fin de la jornada
              </p>
            </div>
          </div>

          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">
              📅 Horario configurado:{' '}
              <strong>
                {config?.turnoHoraInicioDefault || '08:00'} -{' '}
                {config?.turnoHoraFinDefault || '18:00'}
              </strong>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Duración: {calculateDuration(
                config?.turnoHoraInicioDefault || '08:00',
                config?.turnoHoraFinDefault || '18:00'
              )} horas
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Optimización de Rutas
          </CardTitle>
          <CardDescription>
            Parámetros para la planificación y optimización de rutas de entrega
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Máximo de Paradas por Ruta</Label>
              <Input
                type="number"
                min="1"
                value={config?.rutaMaxParadas || 15}
                onChange={(e) =>
                  setConfig({ ...config, rutaMaxParadas: parseInt(e.target.value) })
                }
              />
              <p className="text-xs text-muted-foreground">
                Cantidad máxima de entregas por ruta
              </p>
            </div>

            <div className="space-y-2">
              <Label>Distancia Máxima (km)</Label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                value={config?.rutaMaxDistanciaKm || 5}
                onChange={(e) =>
                  setConfig({ ...config, rutaMaxDistanciaKm: parseFloat(e.target.value) })
                }
              />
              <p className="text-xs text-muted-foreground">
                Radio máximo de entrega desde depósito
              </p>
            </div>
          </div>

          <div className="p-3 bg-info-muted border border-info-muted rounded-lg">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-info-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Configuración de Optimización
                </p>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <p>• Máximo {config?.rutaMaxParadas || 15} paradas por ruta</p>
                  <p>• Radio de {config?.rutaMaxDistanciaKm || 5} km desde depósito</p>
                  <p>
                    • Área cubierta aproximada:{' '}
                    {(Math.PI * Math.pow(parseFloat(config?.rutaMaxDistanciaKm || 5), 2)).toFixed(1)} km²
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-2">Uso en el Sistema</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>
                El optimizador de rutas usará estos parámetros para agrupar entregas
              </li>
              <li>
                Rutas que excedan estos límites recibirán una advertencia
              </li>
              <li>
                Puede ajustarlos según su capacidad logística
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumen de Configuración</CardTitle>
          <CardDescription>
            Vista consolidada de los parámetros logísticos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Turnos de Retiro</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Capacidad:</span>
                  <span className="font-medium">
                    {config?.turnoCapacidadMaximaDefault || 1} clientes/turno
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Horario:</span>
                  <span className="font-medium">
                    {config?.turnoHoraInicioDefault || '08:00'} -{' '}
                    {config?.turnoHoraFinDefault || '18:00'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium text-sm">Rutas de Entrega</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paradas máx:</span>
                  <span className="font-medium">{config?.rutaMaxParadas || 15} paradas</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Distancia máx:</span>
                  <span className="font-medium">{config?.rutaMaxDistanciaKm || 5} km</span>
                </div>
              </div>
            </div>
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

// Helper function to calculate duration between two times
function calculateDuration(start: string, end: string): number {
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  return ((endMinutes - startMinutes) / 60).toFixed(1) as any;
}
