'use client';

import { ExecutionWindow, TimeUnit } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Calendar, Clock } from 'lucide-react';
import { SectionCard } from '../SectionCard';
import { EmptyState } from '../EmptyState';
import { cn } from '@/lib/utils';
import { PreventiveFormData, ValidationErrors } from './types';

interface ScheduleStepProps {
  formData: Pick<PreventiveFormData, 'startDate' | 'frequencyDays' | 'alertDaysBefore' | 'executionWindow' | 'timeUnit' | 'timeValue'>;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  handleInputChange: (field: string, value: any) => void;
  clearFieldError: (field: keyof ValidationErrors) => void;
  validationErrors: Pick<ValidationErrors, 'startDate' | 'frequencyDays' | 'alertDaysBefore'>;
  mode: 'create' | 'edit';
  getExecutionWindowText: (window: ExecutionWindow) => string;
  getTimeUnitText: (unit: TimeUnit) => string;
}

export function ScheduleStep({
  formData,
  setFormData,
  handleInputChange,
  clearFieldError,
  validationErrors,
  mode,
  getExecutionWindowText,
  getTimeUnitText,
}: ScheduleStepProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Configuración */}
      <SectionCard
        title="Configuración"
        icon={Calendar}
        description="Fecha, frecuencia y alertas del mantenimiento"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="startDate" className="text-xs font-medium">
              Fecha de inicio <span className="text-destructive">*</span>
            </Label>
            <DatePicker
              value={formData.startDate}
              onChange={(date) => {
                handleInputChange('startDate', date);
                clearFieldError('startDate');
              }}
              placeholder="Seleccionar fecha"
              className={cn(
                validationErrors.startDate ? 'border-destructive ring-destructive/20 ring-2' : ''
              )}
            />
            {validationErrors.startDate ? (
              <p className="text-xs text-destructive font-medium">{validationErrors.startDate}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Primera ejecución {mode === 'create' ? '(puede ser una fecha pasada si el mantenimiento ya fue realizado)' : '(puede ser fecha pasada al editar)'}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequencyDays" className="text-xs font-medium">
              Frecuencia <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="frequencyDays"
                type="number"
                min="1"
                max="365"
                value={formData.frequencyDays}
                onChange={(e) => {
                  handleInputChange('frequencyDays', Number(e.target.value));
                  clearFieldError('frequencyDays');
                }}
                className={cn(
                  "flex-1",
                  validationErrors.frequencyDays ? 'border-destructive ring-destructive/20 ring-2' : ''
                )}
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">días</span>
            </div>
            {validationErrors.frequencyDays ? (
              <p className="text-xs text-destructive font-medium">{validationErrors.frequencyDays}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                El mantenimiento se repetirá cada {formData.frequencyDays} días
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">
              Días de alerta <span className="text-destructive">*</span>
            </Label>
            <div className={cn(
              "flex flex-wrap gap-2 p-2 rounded-md",
              validationErrors.alertDaysBefore ? 'bg-destructive/10 ring-2 ring-destructive/20' : ''
            )}>
              {[
                { value: 0, label: 'El mismo día', icon: '🔔' },
                { value: 1, label: '1 día antes', icon: '📅' },
                { value: 2, label: '2 días antes', icon: '📅' },
                { value: 3, label: '3 días antes', icon: '📅' }
              ].map(option => {
                const alertDays = Array.isArray(formData.alertDaysBefore) ? formData.alertDaysBefore : [3, 2, 1, 0];
                const isSelected = alertDays.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setFormData((prev: any) => ({
                          ...prev,
                          alertDaysBefore: alertDays.filter((day: number) => day !== option.value)
                        }));
                      } else {
                        setFormData((prev: any) => ({
                          ...prev,
                          alertDaysBefore: [...alertDays, option.value].sort((a: number, b: number) => a - b)
                        }));
                      }
                      clearFieldError('alertDaysBefore');
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                      "border-2 cursor-pointer",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    {isSelected && <span className="text-xs">✓</span>}
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
            {validationErrors.alertDaysBefore ? (
              <p className="text-xs text-destructive font-medium">{validationErrors.alertDaysBefore}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Se enviarán alertas en los días seleccionados
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="executionWindow" className="text-xs font-medium">
              Ventana de ejecución
            </Label>
            <Select
              value={formData.executionWindow}
              onValueChange={(value) => handleInputChange('executionWindow', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar ventana" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Sin especificar</SelectItem>
                <SelectItem value="ANY_TIME">Cualquier momento</SelectItem>
                <SelectItem value="BEFORE_START">Antes del inicio</SelectItem>
                <SelectItem value="MID_SHIFT">Mitad de turno</SelectItem>
                <SelectItem value="END_SHIFT">Fin de turno</SelectItem>
                <SelectItem value="WEEKEND">Fin de semana</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Cuándo se debe ejecutar el mantenimiento
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeValue" className="text-xs font-medium">
              Tiempo estimado
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                value={formData.timeValue}
                onChange={(e) => handleInputChange('timeValue', Number(e.target.value))}
                className="flex-1"
                placeholder="1"
              />
              <Select
                value={formData.timeUnit}
                onValueChange={(value) => handleInputChange('timeUnit', value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOURS">Horas</SelectItem>
                  <SelectItem value="MINUTES">Minutos</SelectItem>
                  <SelectItem value="DAYS">Días</SelectItem>
                  <SelectItem value="CYCLES">Ciclos</SelectItem>
                  <SelectItem value="KILOMETERS">Kilómetros</SelectItem>
                  <SelectItem value="SHIFTS">Turnos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Duración estimada del mantenimiento
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Próximas Fechas */}
      <SectionCard
        title="Próximas fechas"
        icon={Clock}
        description="Previsualización de las próximas ejecuciones programadas"
      >
        {formData.startDate && formData.frequencyDays && formData.frequencyDays > 0 ? (
          <div className="space-y-3">
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                {Array.from({ length: 5 }, (_, i) => {
                  const date = new Date(formData.startDate);
                  date.setDate(date.getDate() + (i * formData.frequencyDays));

                  const adjustToWeekday = (dateToAdjust: Date) => {
                    const dayOfWeek = dateToAdjust.getDay();
                    if (dayOfWeek === 0) dateToAdjust.setDate(dateToAdjust.getDate() + 1);
                    else if (dayOfWeek === 6) dateToAdjust.setDate(dateToAdjust.getDate() + 2);
                    return dateToAdjust;
                  };

                  adjustToWeekday(date);
                  const alertDays = Array.isArray(formData.alertDaysBefore) ? formData.alertDaysBefore : [3, 2, 1, 0];

                  const isToday = date.toDateString() === new Date().toDateString();
                  const isPast = date < new Date() && !isToday;

                  return (
                    <div
                      key={i}
                      className={cn('flex items-center justify-between p-3 rounded-md border',
                        isToday ? 'bg-info-muted border-info-muted' :
                        isPast ? 'bg-muted border-border' : 'bg-success-muted border-success-muted'
                      )}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                          <span className={cn('text-xs font-semibold',
                            isToday ? 'text-info-muted-foreground' :
                            isPast ? 'text-muted-foreground' : 'text-success'
                          )}>
                            {date.toLocaleDateString('es-ES', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                          {isToday && (
                            <Badge variant="outline" className="text-xs bg-info-muted text-info-muted-foreground border-info-muted">
                              HOY
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Alertas: {alertDays.map((d: number) => d === 0 ? 'el mismo día' : `${d} día${d > 1 ? 's' : ''} antes`).join(', ')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Resumen Automático */}
            <div className="mt-4 p-4 bg-muted/50 border rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold">
                  Reglas activas
                </p>
              </div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li>• Se repetirá automáticamente cada <strong className="text-foreground">{formData.frequencyDays} días</strong></li>
                <li>• Alertas: <strong className="text-foreground">
                  {Array.isArray(formData.alertDaysBefore) ?
                    formData.alertDaysBefore.map((days: number) =>
                      days === 0 ? 'el mismo día' : `${days} día${days > 1 ? 's' : ''} antes`
                    ).join(', ') :
                    '3, 2, 1 días antes y el mismo día'
                  }
                </strong></li>
                <li>• <strong className="text-foreground">Solo días laborables</strong> (lunes a viernes)</li>
                <li>• Ventana: <strong className="text-foreground">{getExecutionWindowText(formData.executionWindow)}</strong></li>
                <li>• Duración: <strong className="text-foreground">{formData.timeValue} {getTimeUnitText(formData.timeUnit).toLowerCase()}</strong></li>
              </ul>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Calendar}
            title="Configure fecha y frecuencia"
            subtitle="Para ver las próximas fechas programadas"
          />
        )}
      </SectionCard>
    </div>
  );
}
