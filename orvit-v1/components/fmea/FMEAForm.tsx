'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertTriangle } from 'lucide-react';
import { RPNBadge, RPNIndicator } from './RPNBadge';

interface Machine {
  id: number;
  name: string;
  components?: Array<{ id: number; name: string }>;
}

interface FMEAFormData {
  componentId?: number;
  machineId?: number;
  failureMode: string;
  failureEffect?: string;
  failureCause?: string;
  severity: number;
  occurrence: number;
  detectability: number;
  currentControls?: string;
  recommendedActions?: string;
}

interface FMEAFormProps {
  machines: Machine[];
  initialData?: Partial<FMEAFormData>;
  onSubmit: (data: FMEAFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function FMEAForm({
  machines,
  initialData,
  onSubmit,
  onCancel,
  isLoading,
}: FMEAFormProps) {
  const [formData, setFormData] = useState<FMEAFormData>({
    machineId: initialData?.machineId,
    componentId: initialData?.componentId,
    failureMode: initialData?.failureMode || '',
    failureEffect: initialData?.failureEffect || '',
    failureCause: initialData?.failureCause || '',
    severity: initialData?.severity || 5,
    occurrence: initialData?.occurrence || 5,
    detectability: initialData?.detectability || 5,
    currentControls: initialData?.currentControls || '',
    recommendedActions: initialData?.recommendedActions || '',
  });

  const selectedMachine = machines.find(m => m.id === formData.machineId);
  const rpn = formData.severity * formData.occurrence * formData.detectability;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Machine/Component Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Máquina</Label>
          <Select
            value={formData.machineId?.toString() || ''}
            onValueChange={(val) => setFormData({
              ...formData,
              machineId: val ? Number(val) : undefined,
              componentId: undefined,
            })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar máquina" />
            </SelectTrigger>
            <SelectContent>
              {machines.map((m) => (
                <SelectItem key={m.id} value={m.id.toString()}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Componente (opcional)</Label>
          <Select
            value={formData.componentId?.toString() || ''}
            onValueChange={(val) => setFormData({
              ...formData,
              componentId: val ? Number(val) : undefined,
            })}
            disabled={!selectedMachine?.components?.length}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar componente" />
            </SelectTrigger>
            <SelectContent>
              {selectedMachine?.components?.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Failure Mode Details */}
      <div className="space-y-2">
        <Label htmlFor="failureMode">Modo de Falla *</Label>
        <Input
          id="failureMode"
          value={formData.failureMode}
          onChange={(e) => setFormData({ ...formData, failureMode: e.target.value })}
          placeholder="Descripción del modo de falla"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="failureEffect">Efecto de la Falla</Label>
          <Textarea
            id="failureEffect"
            value={formData.failureEffect}
            onChange={(e) => setFormData({ ...formData, failureEffect: e.target.value })}
            placeholder="¿Qué sucede cuando ocurre esta falla?"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="failureCause">Causa de la Falla</Label>
          <Textarea
            id="failureCause"
            value={formData.failureCause}
            onChange={(e) => setFormData({ ...formData, failureCause: e.target.value })}
            placeholder="¿Por qué ocurre esta falla?"
            rows={2}
          />
        </div>
      </div>

      {/* RPN Factors */}
      <Card className="bg-gray-50">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Análisis de Riesgo (RPN)</h3>
            <RPNBadge rpn={rpn} />
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Severity */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Severidad</Label>
                <span className="text-sm font-medium">{formData.severity}</span>
              </div>
              <Slider
                value={[formData.severity]}
                onValueChange={(val) => setFormData({ ...formData, severity: val[0] })}
                min={1}
                max={10}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Impacto si ocurre la falla
              </p>
            </div>

            {/* Occurrence */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Ocurrencia</Label>
                <span className="text-sm font-medium">{formData.occurrence}</span>
              </div>
              <Slider
                value={[formData.occurrence]}
                onValueChange={(val) => setFormData({ ...formData, occurrence: val[0] })}
                min={1}
                max={10}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Probabilidad de que ocurra
              </p>
            </div>

            {/* Detectability */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Detectabilidad</Label>
                <span className="text-sm font-medium">{formData.detectability}</span>
              </div>
              <Slider
                value={[formData.detectability]}
                onValueChange={(val) => setFormData({ ...formData, detectability: val[0] })}
                min={1}
                max={10}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Dificultad para detectar (10 = muy difícil)
              </p>
            </div>
          </div>

          {rpn >= 200 && (
            <div className="mt-4 p-2 bg-red-100 border border-red-200 rounded flex items-center gap-2 text-sm text-red-800">
              <AlertTriangle className="h-4 w-4" />
              RPN alto - Se requieren acciones correctivas inmediatas
            </div>
          )}
        </CardContent>
      </Card>

      {/* Controls and Actions */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="currentControls">Controles Actuales</Label>
          <Textarea
            id="currentControls"
            value={formData.currentControls}
            onChange={(e) => setFormData({ ...formData, currentControls: e.target.value })}
            placeholder="Controles existentes para prevenir/detectar"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="recommendedActions">Acciones Recomendadas</Label>
          <Textarea
            id="recommendedActions"
            value={formData.recommendedActions}
            onChange={(e) => setFormData({ ...formData, recommendedActions: e.target.value })}
            placeholder="Acciones para reducir el RPN"
            rows={3}
          />
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading || !formData.failureMode}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialData ? 'Actualizar' : 'Crear'} Análisis
        </Button>
      </div>
    </form>
  );
}

export default FMEAForm;
