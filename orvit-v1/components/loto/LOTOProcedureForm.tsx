'use client';

import { useState, useEffect } from 'react';
import { LOTOProcedure, Machine } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, X, Zap, Lock, Unlock, CheckCircle, AlertTriangle } from 'lucide-react';

interface LOTOProcedureFormProps {
  procedure?: Partial<LOTOProcedure>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<LOTOProcedure>) => Promise<void>;
  machines?: Machine[];
}

interface EnergySource {
  id: string;
  type: string;
  location: string;
  voltage?: string;
  description?: string;
}

interface LockoutStep {
  id: string;
  description: string;
  location: string;
  lockType: string;
}

const ENERGY_TYPES = [
  'Electrica',
  'Neumatica',
  'Hidraulica',
  'Mecanica',
  'Termica',
  'Quimica',
  'Gravitacional',
  'Otra',
];

const LOCK_TYPES = [
  'PADLOCK',
  'VALVE_LOCKOUT',
  'CIRCUIT_BREAKER',
  'PLUG_LOCKOUT',
  'CABLE_LOCKOUT',
  'GATE_VALVE',
  'BALL_VALVE',
  'SWITCH_COVER',
];

const PPE_OPTIONS = [
  'Guantes dieléctricos',
  'Lentes de seguridad',
  'Casco de seguridad',
  'Botas dieléctricas',
  'Traje ignífugo',
  'Guantes de cuero',
  'Protector facial',
  'Delantal de cuero',
];

export default function LOTOProcedureForm({
  procedure,
  isOpen,
  onClose,
  onSave,
  machines = [],
}: LOTOProcedureFormProps) {
  const isEditing = !!procedure?.id;

  const [formData, setFormData] = useState<Partial<LOTOProcedure>>({
    name: '',
    description: '',
    machineId: undefined,
    energySources: [],
    lockoutSteps: [],
    verificationSteps: [],
    restorationSteps: [],
    verificationMethod: '',
    requiredPPE: [],
    estimatedMinutes: undefined,
    warnings: '',
    specialConsiderations: '',
  });

  const [energySources, setEnergySources] = useState<EnergySource[]>([]);
  const [lockoutSteps, setLockoutSteps] = useState<LockoutStep[]>([]);
  const [verificationSteps, setVerificationSteps] = useState<string[]>([]);
  const [restorationSteps, setRestorationSteps] = useState<string[]>([]);
  const [newEnergySource, setNewEnergySource] = useState<Partial<EnergySource>>({ type: 'Electrica' });
  const [newLockoutStep, setNewLockoutStep] = useState<Partial<LockoutStep>>({ lockType: 'PADLOCK' });
  const [newVerificationStep, setNewVerificationStep] = useState('');
  const [newRestorationStep, setNewRestorationStep] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (procedure) {
      setFormData({
        ...procedure,
        requiredPPE: procedure.requiredPPE || [],
      });
      setEnergySources((procedure.energySources as EnergySource[]) || []);
      setLockoutSteps((procedure.lockoutSteps as LockoutStep[]) || []);
      setVerificationSteps((procedure.verificationSteps as string[]) || []);
      setRestorationSteps((procedure.restorationSteps as string[]) || []);
    } else {
      setFormData({
        name: '',
        description: '',
        machineId: undefined,
        energySources: [],
        lockoutSteps: [],
        verificationSteps: [],
        restorationSteps: [],
        verificationMethod: '',
        requiredPPE: [],
        estimatedMinutes: undefined,
        warnings: '',
        specialConsiderations: '',
      });
      setEnergySources([]);
      setLockoutSteps([]);
      setVerificationSteps([]);
      setRestorationSteps([]);
    }
    setErrors({});
  }, [procedure, isOpen]);

  const handleChange = (field: keyof LOTOProcedure, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const addEnergySource = () => {
    if (newEnergySource.type && newEnergySource.location) {
      setEnergySources(prev => [
        ...prev,
        { ...newEnergySource, id: `es-${Date.now()}` } as EnergySource,
      ]);
      setNewEnergySource({ type: 'Electrica' });
    }
  };

  const removeEnergySource = (id: string) => {
    setEnergySources(prev => prev.filter(s => s.id !== id));
  };

  const addLockoutStep = () => {
    if (newLockoutStep.description && newLockoutStep.location) {
      setLockoutSteps(prev => [
        ...prev,
        { ...newLockoutStep, id: `ls-${Date.now()}` } as LockoutStep,
      ]);
      setNewLockoutStep({ lockType: 'PADLOCK' });
    }
  };

  const removeLockoutStep = (id: string) => {
    setLockoutSteps(prev => prev.filter(s => s.id !== id));
  };

  const addVerificationStep = () => {
    if (newVerificationStep.trim()) {
      setVerificationSteps(prev => [...prev, newVerificationStep.trim()]);
      setNewVerificationStep('');
    }
  };

  const removeVerificationStep = (idx: number) => {
    setVerificationSteps(prev => prev.filter((_, i) => i !== idx));
  };

  const addRestorationStep = () => {
    if (newRestorationStep.trim()) {
      setRestorationSteps(prev => [...prev, newRestorationStep.trim()]);
      setNewRestorationStep('');
    }
  };

  const removeRestorationStep = (idx: number) => {
    setRestorationSteps(prev => prev.filter((_, i) => i !== idx));
  };

  const togglePPE = (ppe: string) => {
    setFormData(prev => ({
      ...prev,
      requiredPPE: prev.requiredPPE?.includes(ppe)
        ? prev.requiredPPE.filter(p => p !== ppe)
        : [...(prev.requiredPPE || []), ppe],
    }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) newErrors.name = 'El nombre es requerido';
    if (!formData.machineId) newErrors.machineId = 'La maquina es requerida';
    if (energySources.length === 0) newErrors.energySources = 'Debe agregar al menos una fuente de energia';
    if (lockoutSteps.length === 0) newErrors.lockoutSteps = 'Debe agregar al menos un paso de bloqueo';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      await onSave({
        ...formData,
        energySources,
        lockoutSteps,
        verificationSteps,
        restorationSteps,
      });
      onClose();
    } catch (error) {
      console.error('Error saving procedure:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent size="md" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar Procedimiento LOTO' : 'Nuevo Procedimiento LOTO'}</SheetTitle>
          <SheetDescription>
            Defina los pasos de bloqueo y las fuentes de energia a aislar.
          </SheetDescription>
        </SheetHeader>

        <div className="py-4 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold">Informacion Basica</h3>

            <div>
              <Label htmlFor="name">Nombre del Procedimiento *</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Ej: LOTO Compresor Principal"
              />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
            </div>

            <div>
              <Label htmlFor="machineId">Maquina/Equipo *</Label>
              <Select
                value={formData.machineId?.toString() || ''}
                onValueChange={(v) => handleChange('machineId', parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar maquina" />
                </SelectTrigger>
                <SelectContent>
                  {machines.map((m) => (
                    <SelectItem key={m.id} value={m.id.toString()}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.machineId && <p className="text-sm text-destructive mt-1">{errors.machineId}</p>}
            </div>

            <div>
              <Label htmlFor="description">Descripcion</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Descripcion detallada del procedimiento"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="estimatedMinutes">Tiempo Estimado (minutos)</Label>
              <Input
                id="estimatedMinutes"
                type="number"
                value={formData.estimatedMinutes || ''}
                onChange={(e) => handleChange('estimatedMinutes', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="30"
              />
            </div>
          </div>

          <Separator />

          {/* Energy Sources */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-warning-muted-foreground" />
              Fuentes de Energia *
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <Select
                value={newEnergySource.type}
                onValueChange={(v) => setNewEnergySource(prev => ({ ...prev, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {ENERGY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={newEnergySource.location || ''}
                onChange={(e) => setNewEnergySource(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Ubicacion"
              />
            </div>
            <div className="flex gap-2">
              <Input
                value={newEnergySource.voltage || ''}
                onChange={(e) => setNewEnergySource(prev => ({ ...prev, voltage: e.target.value }))}
                placeholder="Voltaje (opcional)"
                className="flex-1"
              />
              <Button type="button" onClick={addEnergySource} variant="outline">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {energySources.length > 0 && (
              <div className="space-y-2">
                {energySources.map((source) => (
                  <div key={source.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-warning-muted-foreground" />
                      <span className="font-medium">{source.type}</span>
                      <span className="text-muted-foreground">- {source.location}</span>
                      {source.voltage && <Badge variant="outline">{source.voltage}</Badge>}
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeEnergySource(source.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {errors.energySources && <p className="text-sm text-destructive">{errors.energySources}</p>}
          </div>

          <Separator />

          {/* Lockout Steps */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Lock className="h-4 w-4 text-destructive" />
              Pasos de Bloqueo *
            </h3>

            <div className="space-y-2">
              <Input
                value={newLockoutStep.description || ''}
                onChange={(e) => setNewLockoutStep(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripcion del paso"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={newLockoutStep.location || ''}
                  onChange={(e) => setNewLockoutStep(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Ubicacion"
                />
                <Select
                  value={newLockoutStep.lockType}
                  onValueChange={(v) => setNewLockoutStep(prev => ({ ...prev, lockType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo de bloqueo" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCK_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" onClick={addLockoutStep} variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Paso
              </Button>
            </div>

            {lockoutSteps.length > 0 && (
              <div className="space-y-2">
                {lockoutSteps.map((step, idx) => (
                  <div key={step.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div>
                      <span className="font-medium">{idx + 1}. {step.description}</span>
                      <div className="text-xs text-muted-foreground">
                        {step.location} - <Badge variant="outline" className="text-xs">{step.lockType}</Badge>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeLockoutStep(step.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {errors.lockoutSteps && <p className="text-sm text-destructive">{errors.lockoutSteps}</p>}
          </div>

          <Separator />

          {/* Verification Steps */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              Pasos de Verificacion
            </h3>

            <div className="flex gap-2">
              <Input
                value={newVerificationStep}
                onChange={(e) => setNewVerificationStep(e.target.value)}
                placeholder="Paso de verificacion"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addVerificationStep())}
              />
              <Button type="button" onClick={addVerificationStep} variant="outline" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {verificationSteps.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {verificationSteps.map((step, idx) => (
                  <Badge key={idx} variant="secondary" className="py-1 px-3">
                    {step}
                    <button onClick={() => removeVerificationStep(idx)} className="ml-2 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div>
              <Label htmlFor="verificationMethod">Metodo de Verificacion</Label>
              <Input
                id="verificationMethod"
                value={formData.verificationMethod || ''}
                onChange={(e) => handleChange('verificationMethod', e.target.value)}
                placeholder="Ej: Verificar con multimetro que no hay tension"
              />
            </div>
          </div>

          <Separator />

          {/* Restoration Steps */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Unlock className="h-4 w-4 text-success" />
              Pasos de Restauracion
            </h3>

            <div className="flex gap-2">
              <Input
                value={newRestorationStep}
                onChange={(e) => setNewRestorationStep(e.target.value)}
                placeholder="Paso de restauracion"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRestorationStep())}
              />
              <Button type="button" onClick={addRestorationStep} variant="outline" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {restorationSteps.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {restorationSteps.map((step, idx) => (
                  <Badge key={idx} variant="outline" className="py-1 px-3 border-success/30">
                    {step}
                    <button onClick={() => removeRestorationStep(idx)} className="ml-2 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Required PPE */}
          <div className="space-y-4">
            <h3 className="font-semibold">EPP Requerido</h3>
            <div className="flex flex-wrap gap-2">
              {PPE_OPTIONS.map((ppe) => (
                <Badge
                  key={ppe}
                  variant={formData.requiredPPE?.includes(ppe) ? 'default' : 'outline'}
                  className="cursor-pointer py-1.5 px-3"
                  onClick={() => togglePPE(ppe)}
                >
                  {ppe}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Warnings */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
              Advertencias y Consideraciones
            </h3>

            <div>
              <Label htmlFor="warnings">Advertencias</Label>
              <Textarea
                id="warnings"
                value={formData.warnings || ''}
                onChange={(e) => handleChange('warnings', e.target.value)}
                placeholder="Advertencias importantes de seguridad"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="specialConsiderations">Consideraciones Especiales</Label>
              <Textarea
                id="specialConsiderations"
                value={formData.specialConsiderations || ''}
                onChange={(e) => handleChange('specialConsiderations', e.target.value)}
                placeholder="Condiciones especiales a tener en cuenta"
                rows={2}
              />
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Procedimiento'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
