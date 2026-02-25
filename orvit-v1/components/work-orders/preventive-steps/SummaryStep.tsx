'use client';

import { Priority, ExecutionWindow, TimeUnit } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Info } from 'lucide-react';
import { SectionCard } from '../SectionCard';
import { PreventiveFormData, ToolRequest } from './types';

interface SummaryStepProps {
  formData: PreventiveFormData;
  selectedMachine?: { name: string } | any;
  selectedComponents: { id: any; name: string }[];
  selectedSubcomponents: { id: any; name: string }[];
  users: any[];
  selectedTools: ToolRequest[];
  instructives: any[];
  formatDateForDisplay: (dateStr: string) => string;
  calculateNextExecutionDate: () => string | undefined;
  getPriorityColor: (priority: Priority) => string;
  getPriorityText: (priority: Priority) => string;
  getExecutionWindowText: (window: ExecutionWindow) => string;
  getTimeUnitText: (unit: TimeUnit) => string;
  mode: 'create' | 'edit';
}

export function SummaryStep({
  formData,
  selectedMachine,
  selectedComponents,
  selectedSubcomponents,
  users,
  selectedTools,
  instructives,
  formatDateForDisplay,
  calculateNextExecutionDate,
  getPriorityColor,
  getPriorityText,
  getExecutionWindowText,
  getTimeUnitText,
  mode,
}: SummaryStepProps) {
  return (
    <SectionCard
      title="Resumen del Mantenimiento Preventivo"
      icon={Info}
      description={`Revise la información antes de ${mode === 'edit' ? 'guardar los cambios' : 'crear el mantenimiento preventivo'}`}
    >
      <div className="space-y-6">
        {/* Información General */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Información General</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Título</p>
              <p className="text-sm font-medium">{formData.title || 'Sin título'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Prioridad</p>
              <Badge className={getPriorityColor(formData.priority)}>
                {getPriorityText(formData.priority)}
              </Badge>
            </div>
            {formData.description && (
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground mb-1.5">Descripción</p>
                <p className="text-sm">{formData.description}</p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Equipamiento */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Equipamiento</h4>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Máquina</p>
              <p className="text-sm font-medium">{selectedMachine?.name || 'No seleccionada'}</p>
            </div>
            {selectedComponents.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Componentes ({selectedComponents.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedComponents.map(c => (
                    <Badge key={c.id} variant="outline">{c.name}</Badge>
                  ))}
                </div>
              </div>
            )}
            {selectedSubcomponents.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Subcomponentes ({selectedSubcomponents.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedSubcomponents.map(s => (
                    <Badge key={s.id} variant="outline">{s.name}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Asignación */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Asignación</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Técnico</p>
              <p className="text-sm font-medium">
                {formData.assignedToId === 'none'
                  ? 'Sin asignar'
                  : users.find(u => u.id.toString() === formData.assignedToId)?.name || 'No encontrado'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Estado</p>
              <Badge variant={formData.isActive ? 'default' : 'secondary'}>
                {formData.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            {formData.notes && (
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground mb-1.5">Notas</p>
                <p className="text-sm">{formData.notes}</p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Programación */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Programación</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Fecha de inicio</p>
              <p className="text-sm font-medium">{formatDateForDisplay(formData.startDate) || 'No definida'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Frecuencia</p>
              <p className="text-sm font-medium">Cada {formData.frequencyDays} día{formData.frequencyDays !== 1 ? 's' : ''}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Próxima ejecución</p>
              <p className="text-sm font-medium">{formatDateForDisplay(calculateNextExecutionDate() || '') || 'No calculada'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Ventana de ejecución</p>
              <p className="text-sm font-medium">{getExecutionWindowText(formData.executionWindow)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Tiempo estimado</p>
              <p className="text-sm font-medium">{formData.timeValue} {getTimeUnitText(formData.timeUnit).toLowerCase()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Alertas</p>
              <div className="flex flex-wrap gap-1">
                {Array.isArray(formData.alertDaysBefore) && formData.alertDaysBefore.map(days => (
                  <Badge key={days} variant="outline" className="text-xs">
                    {days === 0 ? 'El mismo día' : `${days} día${days > 1 ? 's' : ''} antes`}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Recursos */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Recursos</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Herramientas seleccionadas</p>
              <p className="text-sm font-medium">{selectedTools.length} herramienta{selectedTools.length !== 1 ? 's' : ''}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Instructivos</p>
              <p className="text-sm font-medium">{instructives.length} archivo{instructives.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
