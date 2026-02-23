'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Gauge,
  Printer,
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { UnidadMovil } from './UnitCard';

interface KilometrajeMasivoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unidades: UnidadMovil[];
  onKilometrajesGuardados?: () => void;
}

type ResultEntry = {
  id: number;
  nombre: string;
  status: 'ok' | 'error';
  message?: string;
};

function isKmVencida(unidad: UnidadMovil): boolean {
  if (!unidad.kmUpdateFrequencyDays) return false;
  const lastRead = unidad.ultimaLecturaKm ? new Date(unidad.ultimaLecturaKm as string) : null;
  if (!lastRead) return true;
  const daysSince = Math.floor((Date.now() - lastRead.getTime()) / (1000 * 60 * 60 * 24));
  return daysSince >= unidad.kmUpdateFrequencyDays;
}

export function KilometrajeMasivoDialog({
  open,
  onOpenChange,
  unidades,
  onKilometrajesGuardados,
}: KilometrajeMasivoDialogProps) {
  const [kmInputs, setKmInputs] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [soloVencidas, setSoloVencidas] = useState(false);
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const activeUnidades = unidades
    .filter(u => u.estado !== 'DESHABILITADO')
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const unidadesVencidas = activeUnidades.filter(isKmVencida);

  const displayUnidades = soloVencidas ? unidadesVencidas : activeUnidades;

  const countToUpdate = displayUnidades.filter(u => {
    const input = kmInputs[u.id];
    if (!input) return false;
    const newKm = parseInt(input);
    return !isNaN(newKm) && newKm > u.kilometraje;
  }).length;

  const handleKmChange = (unidadId: number, value: string) => {
    setKmInputs(prev => ({ ...prev, [unidadId]: value }));
  };

  const handlePrint = () => {
    const today = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });

    const rows = displayUnidades
      .map(
        (u, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${u.nombre}</strong></td>
        <td>${u.patente}</td>
        <td>${u.tipo}</td>
        <td>${u.sector?.name || '—'}</td>
        <td>${u.kilometraje.toLocaleString()} km</td>
        <td style="min-width:130px;">&nbsp;</td>
        <td>&nbsp;</td>
      </tr>`,
      )
      .join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Planilla Kilometraje — ${today}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; color: #000; }
    h1 { font-size: 16px; margin-bottom: 4px; }
    .subtitle { font-size: 11px; color: #555; margin-bottom: 20px; }
    .instructions { font-size: 10px; color: #666; margin-bottom: 14px; border: 1px solid #ddd; padding: 8px; background: #f9f9f9; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f0f0f0; text-align: left; padding: 6px 8px; border: 1px solid #ccc; font-size: 10px; font-weight: bold; white-space: nowrap; }
    td { padding: 8px 8px; border: 1px solid #ddd; vertical-align: middle; }
    tr:nth-child(even) td { background: #fafafa; }
    td.km-input { border-bottom: 2px solid #333; background: #fff; }
    .footer { margin-top: 32px; font-size: 10px; color: #888; }
    @page { margin: 1.5cm; }
  </style>
</head>
<body>
  <h1>Planilla de Lectura de Kilometraje</h1>
  <p class="subtitle">Fecha: ${today} &nbsp;·&nbsp; Total de unidades: ${displayUnidades.length}</p>
  <p class="instructions">
    <strong>Instrucciones:</strong> Completar la columna "Nuevo Km" con la lectura actual del odómetro de cada unidad.
    Entregar esta planilla al encargado de sistema para su carga.
  </p>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Unidad</th>
        <th>Patente</th>
        <th>Tipo</th>
        <th>Sector</th>
        <th>Km Anterior</th>
        <th>Nuevo Km (Odómetro)</th>
        <th>Firma / Obs.</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="footer">Sistema Orvit &nbsp;·&nbsp; Planilla generada el ${today}</p>
</body>
</html>`;

    const pw = window.open('', '_blank', 'width=950,height=750');
    if (pw) {
      pw.document.write(html);
      pw.document.close();
      pw.focus();
      setTimeout(() => pw.print(), 600);
    }
  };

  const handleSubmit = async () => {
    const toUpdate = displayUnidades.filter(u => {
      const input = kmInputs[u.id];
      if (!input) return false;
      const newKm = parseInt(input);
      return !isNaN(newKm) && newKm > u.kilometraje;
    });

    if (toUpdate.length === 0) {
      toast({
        title: 'Sin cambios',
        description: 'Ingresá al menos un kilometraje mayor al actual',
      });
      return;
    }

    setSubmitting(true);
    const newResults: ResultEntry[] = [];

    for (const unidad of toUpdate) {
      const newKm = parseInt(kmInputs[unidad.id]);
      try {
        const res = await fetch(
          `/api/mantenimiento/unidades-moviles/${unidad.id}/kilometraje`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kilometraje: newKm,
              tipo: 'MANUAL',
              actualizarUnidad: true,
            }),
          },
        );
        if (res.ok) {
          newResults.push({ id: unidad.id, nombre: unidad.nombre, status: 'ok' });
        } else {
          const err = await res.json();
          newResults.push({
            id: unidad.id,
            nombre: unidad.nombre,
            status: 'error',
            message: err.error,
          });
        }
      } catch (e: any) {
        newResults.push({
          id: unidad.id,
          nombre: unidad.nombre,
          status: 'error',
          message: e.message,
        });
      }
    }

    setResults(newResults);
    setSubmitted(true);
    setSubmitting(false);

    const ok = newResults.filter(r => r.status === 'ok').length;
    const err = newResults.filter(r => r.status === 'error').length;

    if (err === 0) {
      toast({
        title: `${ok} km registrado${ok !== 1 ? 's' : ''}`,
        description: 'Todos los kilometrajes se guardaron correctamente',
      });
    } else {
      toast({
        title: `${ok} OK · ${err} error${err > 1 ? 'es' : ''}`,
        description: 'Algunos kilometrajes no se pudieron guardar',
        variant: 'destructive',
      });
    }

    if (ok > 0) onKilometrajesGuardados?.();
  };

  const handleClose = () => {
    setKmInputs({});
    setResults([]);
    setSubmitted(false);
    setSoloVencidas(false);
    onOpenChange(false);
  };

  const handleReset = () => {
    setKmInputs({});
    setResults([]);
    setSubmitted(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            Carga Masiva de Kilometraje
          </DialogTitle>
          <DialogDescription className="text-xs">
            Ingresá la lectura del odómetro para cada unidad. Solo se guardarán los valores mayores al actual.
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-2.5 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Button
              variant={soloVencidas ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSoloVencidas(!soloVencidas)}
              className="h-7 text-xs"
              disabled={submitted}
            >
              <AlertTriangle className="h-3 w-3 mr-1.5" />
              Solo vencidas
              {unidadesVencidas.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 text-xs px-1 min-w-[16px]">
                  {unidadesVencidas.length}
                </Badge>
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {!submitted && countToUpdate > 0 && (
              <span className="text-xs text-muted-foreground">
                {countToUpdate} para guardar
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-7 text-xs"
            >
              <Printer className="h-3 w-3 mr-1.5" />
              Imprimir planilla
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {submitted ? (
            /* Resultado */
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                Resultado de la carga
              </p>
              {results.map(r => (
                <div
                  key={r.id}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-lg border text-xs',
                    r.status === 'ok'
                      ? 'border-success/30 bg-success-muted'
                      : 'border-destructive/30 bg-destructive/5',
                  )}
                >
                  {r.status === 'ok' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-destructive shrink-0" />
                  )}
                  <span className="font-medium">{r.nombre}</span>
                  {r.message && (
                    <span className="text-muted-foreground ml-1">— {r.message}</span>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="h-8 text-xs mt-4"
              >
                Cargar nuevamente
              </Button>
            </div>
          ) : displayUnidades.length === 0 ? (
            <div className="py-16 text-center">
              <Gauge className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                {soloVencidas
                  ? 'No hay unidades con lecturas vencidas'
                  : 'No hay unidades activas'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Header columns */}
              <div className="grid grid-cols-[3fr_1fr_1fr_1fr_1.5fr] gap-3 px-3 pb-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Unidad
                </span>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Patente
                </span>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Tipo
                </span>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Km Actual
                </span>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Nuevo Km
                </span>
              </div>

              {/* Rows */}
              {displayUnidades.map(unidad => {
                const input = kmInputs[unidad.id] || '';
                const newKm = parseInt(input);
                const isValid = !isNaN(newKm) && newKm > unidad.kilometraje;
                const isLower = input !== '' && !isNaN(newKm) && newKm < unidad.kilometraje;
                const kmDiff = isValid ? newKm - unidad.kilometraje : 0;
                const vencida = isKmVencida(unidad);

                return (
                  <div
                    key={unidad.id}
                    className={cn(
                      'grid grid-cols-[3fr_1fr_1fr_1fr_1.5fr] gap-3 items-center px-3 py-2.5 rounded-lg border transition-colors',
                      isValid
                        ? 'border-success/30 bg-success-muted/20'
                        : vencida
                          ? 'border-warning-muted-foreground/30 bg-warning-muted/20'
                          : 'border-transparent hover:bg-muted/40',
                    )}
                  >
                    {/* Nombre + sector */}
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{unidad.nombre}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">
                          {unidad.sector?.name || 'Sin sector'}
                        </p>
                        {vencida && (
                          <Badge
                            variant="outline"
                            className="h-4 text-xs px-1 bg-warning-muted text-warning-muted-foreground border-warning-muted-foreground/30"
                          >
                            Vencida
                          </Badge>
                        )}
                      </div>
                    </div>

                    <span className="text-xs font-mono text-foreground">
                      {unidad.patente}
                    </span>

                    <span className="text-xs text-muted-foreground">{unidad.tipo}</span>

                    <span className="text-xs font-medium tabular-nums">
                      {unidad.kilometraje.toLocaleString()}
                    </span>

                    {/* Input */}
                    <div>
                      <Input
                        type="number"
                        value={input}
                        onChange={e => handleKmChange(unidad.id, e.target.value)}
                        placeholder={`≥ ${unidad.kilometraje.toLocaleString()}`}
                        min={unidad.kilometraje}
                        className={cn(
                          'h-8 text-xs',
                          isLower && 'border-destructive focus-visible:ring-destructive',
                          isValid && 'border-success focus-visible:ring-success',
                        )}
                      />
                      {isValid && (
                        <p className="text-xs text-success mt-0.5">
                          +{kmDiff.toLocaleString()} km
                        </p>
                      )}
                      {isLower && (
                        <p className="text-xs text-destructive mt-0.5">
                          Menor al actual
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={submitting}
            className="h-8 text-xs"
          >
            {submitted ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!submitted && (
            <Button
              onClick={handleSubmit}
              disabled={submitting || countToUpdate === 0}
              className="h-8 text-xs"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-3 w-3 mr-1.5" />
                  Guardar{countToUpdate > 0 ? ` (${countToUpdate})` : ''}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
