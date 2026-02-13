'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Gauge,
  Plus,
  Loader2,
  TrendingUp,
  Calendar,
  User,
  Fuel,
  Wrench,
  MapPin,
  ClipboardCheck,
  Edit3,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface KilometrajeLog {
  id: number;
  kilometraje: number;
  fecha: string;
  tipo: 'MANUAL' | 'MANTENIMIENTO' | 'COMBUSTIBLE' | 'VIAJE' | 'INSPECCION';
  notas?: string;
  registradoPor?: {
    id: number;
    name: string;
  };
}

interface KilometrajeHistoryProps {
  unidadId: number;
  unidadNombre: string;
  kilometrajeActual: number;
  canEdit?: boolean;
  onKilometrajeUpdated?: (nuevoKm: number) => void;
}

const tipoLabels: Record<string, string> = {
  MANUAL: 'Manual',
  MANTENIMIENTO: 'Mantenimiento',
  COMBUSTIBLE: 'Carga combustible',
  VIAJE: 'Viaje',
  INSPECCION: 'Inspección',
};

const tipoIcons: Record<string, React.ReactNode> = {
  MANUAL: <Edit3 className="h-3 w-3" />,
  MANTENIMIENTO: <Wrench className="h-3 w-3" />,
  COMBUSTIBLE: <Fuel className="h-3 w-3" />,
  VIAJE: <MapPin className="h-3 w-3" />,
  INSPECCION: <ClipboardCheck className="h-3 w-3" />,
};

const tipoColors: Record<string, string> = {
  MANUAL: 'bg-slate-500/10 text-slate-700 dark:text-slate-400',
  MANTENIMIENTO: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  COMBUSTIBLE: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  VIAJE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  INSPECCION: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
};

export function KilometrajeHistory({
  unidadId,
  unidadNombre,
  kilometrajeActual,
  canEdit = false,
  onKilometrajeUpdated,
}: KilometrajeHistoryProps) {
  const [logs, setLogs] = useState<KilometrajeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ kmRecorridos: number; promedioEntreLecturas: number } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    kilometraje: kilometrajeActual,
    tipo: 'MANUAL' as const,
    notas: '',
  });

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/mantenimiento/unidades-moviles/${unidadId}/kilometraje?limit=20`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching kilometraje logs:', error);
    } finally {
      setLoading(false);
    }
  }, [unidadId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSubmit = async () => {
    if (formData.kilometraje < kilometrajeActual) {
      toast({
        title: 'Error',
        description: `El kilometraje no puede ser menor al actual (${kilometrajeActual.toLocaleString()} km)`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`/api/mantenimiento/unidades-moviles/${unidadId}/kilometraje`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kilometraje: formData.kilometraje,
          tipo: formData.tipo,
          notas: formData.notas || undefined,
          actualizarUnidad: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Kilometraje registrado',
          description: `+${data.kmRecorridos.toLocaleString()} km registrados`,
        });
        setIsDialogOpen(false);
        fetchLogs();
        if (onKilometrajeUpdated) {
          onKilometrajeUpdated(data.nuevoKilometraje);
        }
        // Reset form
        setFormData({
          kilometraje: data.nuevoKilometraje,
          tipo: 'MANUAL',
          notas: '',
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Error al registrar kilometraje');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudo registrar el kilometraje',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openDialog = () => {
    setFormData({
      kilometraje: kilometrajeActual,
      tipo: 'MANUAL',
      notas: '',
    });
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="h-6 w-6 text-muted-foreground mx-auto mb-2 animate-spin" />
        <p className="text-xs text-muted-foreground">Cargando historial...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header con botón de agregar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Actual: <span className="font-semibold text-foreground">{kilometrajeActual.toLocaleString()} km</span>
          </span>
        </div>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={openDialog}
            className="h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Registrar
          </Button>
        )}
      </div>

      {/* Stats */}
      {stats && logs.length > 1 && (
        <div className="grid grid-cols-2 gap-2">
          <Card className="p-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              <div>
                <p className="text-[10px] text-muted-foreground">Km recorridos</p>
                <p className="text-xs font-semibold">{stats.kmRecorridos.toLocaleString()} km</p>
              </div>
            </div>
          </Card>
          <Card className="p-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-blue-600" />
              <div>
                <p className="text-[10px] text-muted-foreground">Promedio entre lecturas</p>
                <p className="text-xs font-semibold">{stats.promedioEntreLecturas.toLocaleString()} km</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Lista de registros */}
      {logs.length === 0 ? (
        <div className="py-6 text-center">
          <Gauge className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Sin registros de kilometraje</p>
          {canEdit && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Registra la primera lectura del odómetro
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log, index) => {
            const prevLog = logs[index + 1];
            const kmDiff = prevLog ? log.kilometraje - prevLog.kilometraje : 0;

            return (
              <div
                key={log.id}
                className="flex items-start gap-3 p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className={cn('p-1.5 rounded-full shrink-0', tipoColors[log.tipo])}>
                  {tipoIcons[log.tipo]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold">
                      {log.kilometraje.toLocaleString()} km
                    </span>
                    {kmDiff > 0 && (
                      <span className="text-[10px] text-emerald-600">
                        +{kmDiff.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className={cn('text-[10px] h-4 px-1.5', tipoColors[log.tipo])}>
                      {tipoLabels[log.tipo]}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(log.fecha), { addSuffix: true, locale: es })}
                    </span>
                  </div>
                  {log.notas && (
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                      {log.notas}
                    </p>
                  )}
                  {log.registradoPor && (
                    <div className="flex items-center gap-1 mt-1">
                      <User className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        {log.registradoPor.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog para registrar nuevo kilometraje */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Registrar Kilometraje</DialogTitle>
            <DialogDescription className="text-xs">
              {unidadNombre} • Actual: {kilometrajeActual.toLocaleString()} km
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="kilometraje" className="text-xs">Lectura del odómetro *</Label>
              <Input
                id="kilometraje"
                type="number"
                value={formData.kilometraje}
                onChange={(e) => setFormData({ ...formData, kilometraje: parseInt(e.target.value) || 0 })}
                min={kilometrajeActual}
                className="h-9 text-sm mt-1"
                placeholder={`Mínimo: ${kilometrajeActual.toLocaleString()}`}
              />
              {formData.kilometraje > kilometrajeActual && (
                <p className="text-[10px] text-emerald-600 mt-1">
                  +{(formData.kilometraje - kilometrajeActual).toLocaleString()} km desde última lectura
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="tipo" className="text-xs">Tipo de registro</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value: any) => setFormData({ ...formData, tipo: value })}
              >
                <SelectTrigger className="h-9 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                  <SelectItem value="MANTENIMIENTO">Mantenimiento</SelectItem>
                  <SelectItem value="COMBUSTIBLE">Carga combustible</SelectItem>
                  <SelectItem value="VIAJE">Inicio/fin viaje</SelectItem>
                  <SelectItem value="INSPECCION">Inspección</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notas" className="text-xs">Notas (opcional)</Label>
              <Textarea
                id="notas"
                value={formData.notas}
                onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                placeholder="Observaciones adicionales..."
                rows={2}
                className="text-xs mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={submitting}
              className="h-8 text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || formData.kilometraje < kilometrajeActual}
              className="h-8 text-xs"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Registrar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
