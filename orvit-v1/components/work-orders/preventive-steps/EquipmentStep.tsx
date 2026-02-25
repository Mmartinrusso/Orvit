'use client';

import { Machine, MachineComponent } from '@/lib/types';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { Loader2, Wrench, Cog } from 'lucide-react';
import { SectionCard } from '../SectionCard';
import { EmptyState } from '../EmptyState';
import { SelectionSummaryChips } from '../SelectionSummaryChips';
import { cn } from '@/lib/utils';
import { PreventiveFormData, ValidationErrors } from './types';

interface EquipmentStepProps {
  formData: Pick<PreventiveFormData, 'machineId' | 'componentIds' | 'subcomponentIds'>;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  validationErrors: Pick<ValidationErrors, 'machineId'>;
  clearFieldError: (field: keyof ValidationErrors) => void;
  handleInputChange: (field: string, value: any) => void;
  machines: Machine[];
  components: MachineComponent[];
  subcomponents: MachineComponent[];
  loadingComponents: boolean;
  loadingSubcomponents: boolean;
  selectedMachine?: Machine | any;
  selectedComponents: MachineComponent[];
  selectedSubcomponents: MachineComponent[];
  handleCreateComponent: (name: string) => void;
  handleCreateSubcomponent: (name: string) => void;
}

export function EquipmentStep({
  formData,
  setFormData,
  validationErrors,
  clearFieldError,
  handleInputChange,
  machines,
  components,
  subcomponents,
  loadingComponents,
  loadingSubcomponents,
  selectedMachine,
  selectedComponents,
  selectedSubcomponents,
  handleCreateComponent,
  handleCreateSubcomponent,
}: EquipmentStepProps) {
  return (
    <SectionCard
      title="Selección de Equipamiento"
      icon={Wrench}
      description="Seleccione la máquina, componente y subcomponente específico"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Máquina */}
        <div className="space-y-2">
          <Label htmlFor="machine" className="text-xs font-medium">
            Máquina <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.machineId}
            onValueChange={(value) => {
              handleInputChange('machineId', value);
              clearFieldError('machineId');
            }}
          >
            <SelectTrigger className={cn(
              validationErrors.machineId ? 'border-destructive ring-destructive/20 ring-2' : ''
            )}>
              <SelectValue placeholder="Seleccionar máquina" />
            </SelectTrigger>
            <SelectContent>
              {machines.length === 0 ? (
                <SelectItem value="no-machines" disabled>No hay máquinas disponibles</SelectItem>
              ) : (
                machines.map((machine) => (
                  <SelectItem key={machine.id} value={machine.id.toString()}>
                    {machine.name} {machine.nickname && `(${machine.nickname})`}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {validationErrors.machineId && (
            <p className="text-xs text-destructive font-medium">{validationErrors.machineId}</p>
          )}
        </div>

        {/* Componentes */}
        <div className="space-y-2">
          <Label htmlFor="components" className="text-xs font-medium">
            Componentes (selección múltiple)
          </Label>
          {!formData.machineId ? (
            <EmptyState
              icon={Wrench}
              title="Selecciona una máquina primero"
              subtitle="Para cargar los componentes disponibles"
            />
          ) : loadingComponents ? (
            <div className="flex items-center justify-center py-8 border rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando componentes...</span>
            </div>
          ) : (
            <MultiSelect
              options={components.map(c => ({ value: c.id.toString(), label: c.name }))}
              selected={formData.componentIds}
              onChange={(selected) => setFormData((prev: any) => ({ ...prev, componentIds: selected }))}
              placeholder="Seleccionar o crear componente..."
              emptyMessage="No hay componentes. Escribí un nombre para crear uno."
              searchPlaceholder="Buscar componentes..."
              onCreateNew={handleCreateComponent}
            />
          )}
        </div>

        {/* Subcomponentes */}
        <div className="space-y-2">
          <Label htmlFor="subcomponents" className="text-xs font-medium">
            Subcomponentes (selección múltiple)
          </Label>
          {formData.componentIds.length === 0 ? (
            <EmptyState
              icon={Cog}
              title="Selecciona componentes primero"
              subtitle="Para cargar los subcomponentes disponibles"
            />
          ) : loadingSubcomponents ? (
            <div className="flex items-center justify-center py-8 border rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando subcomponentes...</span>
            </div>
          ) : (
            <MultiSelect
              options={subcomponents.map(s => ({ value: s.id.toString(), label: s.name }))}
              selected={formData.subcomponentIds}
              onChange={(selected) => setFormData((prev: any) => ({ ...prev, subcomponentIds: selected }))}
              placeholder="Seleccionar o crear subcomponente..."
              emptyMessage="No hay subcomponentes. Escribí un nombre para crear uno."
              searchPlaceholder="Buscar subcomponentes..."
              disabled={formData.componentIds.length === 0}
              onCreateNew={handleCreateSubcomponent}
            />
          )}
        </div>
      </div>

      {/* Resumen de selección */}
      <SelectionSummaryChips
        machineName={selectedMachine?.name}
        componentNames={selectedComponents.map(c => c.name)}
        subcomponentNames={selectedSubcomponents.map(s => s.name)}
        onClear={() => {
          setFormData((prev: any) => ({ ...prev, componentIds: [], subcomponentIds: [] }));
        }}
        className="mt-6"
      />
    </SectionCard>
  );
}
