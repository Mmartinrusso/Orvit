'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { Stepper, type Step } from '@/components/ui/stepper';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  AlertTriangle,
  Unlink,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  ClipboardList,
  Loader2,
  Search,
  Sparkles,
  Wrench,
  Package,
  Plus,
  X,
  Users,
  Shield,
  Clock,
  Timer,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ComponentTreeSelector } from './ComponentTreeSelector';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ───

type IncidentType = 'FALLA' | 'ROTURA';
type ResolutionPath = 'resolved' | 'requires-ot';
type WizardStep = 'type' | 'path' | 'form';
type FormStep = 'incident' | 'resolution' | 'team' | 'controls';

interface CreateIncidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequiresOT: (type: IncidentType) => void;
}

// ─── Item types for tools/spare parts ───

interface UsedItem {
  id: number;
  name: string;
  quantity: number;
}

interface ControlPlanItem {
  order: number;
  delayMinutes: number;
  description: string;
  type: 'from_resolution' | 'from_previous'; // aislado vs dependiente del anterior
}

// ─── Form stepper steps ───

const formSteps: Step[] = [
  { id: 'incident', label: 'Incidente', description: '¿Qué sucedió?' },
  { id: 'resolution', label: 'Resolución', description: '¿Cómo se resolvió?' },
  { id: 'team', label: 'Equipo', description: '¿Quiénes participaron?' },
  { id: 'controls', label: 'Controles', description: 'Seguimiento' },
];

const formStepIds: FormStep[] = ['incident', 'resolution', 'team', 'controls'];

// ─── Schema ───

const resolvedIncidentSchema = z.object({
  // Datos del incidente
  machineId: z.number({ required_error: 'Seleccione una máquina' }),
  componentIds: z.array(z.number()).optional(),
  subcomponentIds: z.array(z.number()).optional(),
  title: z.string().min(5, 'Mínimo 5 caracteres').max(255),
  causedDowntime: z.boolean().default(false),
  description: z.string().optional(),

  // Resolución
  repairAction: z.enum(['CAMBIO', 'REPARACION']).optional(),
  repairDetail: z.string().optional(),
  diagnosis: z.string().min(5, 'Mínimo 5 caracteres'),
  immediateSolution: z.string().min(5, 'Mínimo 5 caracteres'),
  fixType: z.enum(['DEFINITIVA', 'PARCHE']).default('DEFINITIVA'),
  outcome: z.enum(['FUNCIONÓ', 'PARCIAL', 'NO_FUNCIONÓ']).default('FUNCIONÓ'),
  actualMinutes: z.number().int().positive().optional(),
  notes: z.string().optional(),

  // Personas
  performedByIds: z.array(z.number()).optional(),
  supervisorId: z.number().optional(),
});

type ResolvedIncidentFormData = z.infer<typeof resolvedIncidentSchema>;

// ─── Component ───

export function CreateIncidentDialog({
  open,
  onOpenChange,
  onRequiresOT,
}: CreateIncidentDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [step, setStep] = useState<WizardStep>('type');
  const [formStep, setFormStep] = useState<FormStep>('incident');
  const [incidentType, setIncidentType] = useState<IncidentType>('FALLA');
  const [isImproving, setIsImproving] = useState(false);

  // State for items not managed by react-hook-form
  const [toolsUsed, setToolsUsed] = useState<UsedItem[]>([]);
  const [sparePartsUsed, setSparePartsUsed] = useState<UsedItem[]>([]);
  const [controlPlan, setControlPlan] = useState<ControlPlanItem[]>([]);

  // Popover open state for comboboxes
  const [toolComboOpen, setToolComboOpen] = useState(false);
  const [sparePartComboOpen, setSparePartComboOpen] = useState(false);


  // Inline add state for controls
  const [newControlDesc, setNewControlDesc] = useState('');
  const [newControlDelay, setNewControlDelay] = useState('');
  const [newControlType, setNewControlType] = useState<'from_resolution' | 'from_previous'>('from_resolution');

  const form = useForm<ResolvedIncidentFormData>({
    resolver: zodResolver(resolvedIncidentSchema),
    defaultValues: {
      causedDowntime: false,
      outcome: 'FUNCIONÓ',
      fixType: 'DEFINITIVA',
      diagnosis: '',
      immediateSolution: '',
      title: '',
      notes: '',
      description: '',
      repairDetail: '',
    },
  });

  // ─── Queries ───

  const { data: employees } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['users-for-selector'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      if (!res.ok) return [];
      const json = await res.json();
      return (Array.isArray(json) ? json : []).filter((u: any) => u.isActive !== false);
    },
    staleTime: 5 * 60 * 1000,
    enabled: step === 'form',
  });

  // Cargar todas las herramientas del pañol (HAND_TOOL + TOOL legacy)
  const { data: allTools } = useQuery<{ id: number; name: string; code?: string; category?: string }[]>({
    queryKey: ['panol-tools-all'],
    queryFn: async () => {
      const [r1, r2] = await Promise.all([
        fetch('/api/tools/search?itemType=HAND_TOOL&limit=50'),
        fetch('/api/tools/search?itemType=TOOL&limit=50'),
      ]);
      const t1 = r1.ok ? await r1.json() : [];
      const t2 = r2.ok ? await r2.json() : [];
      // Merge y dedup por id
      const map = new Map<number, any>();
      [...t1, ...t2].forEach((t: any) => map.set(t.id, t));
      return Array.from(map.values()).sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
    staleTime: 5 * 60 * 1000,
    enabled: step === 'form',
  });

  // Cargar todos los repuestos del pañol (SPARE_PART + CONSUMABLE)
  const { data: allSpareParts } = useQuery<{ id: number; name: string; code?: string; category?: string }[]>({
    queryKey: ['panol-spare-parts-all'],
    queryFn: async () => {
      const [r1, r2] = await Promise.all([
        fetch('/api/tools/search?itemType=SPARE_PART&limit=50'),
        fetch('/api/tools/search?itemType=CONSUMABLE&limit=50'),
      ]);
      const t1 = r1.ok ? await r1.json() : [];
      const t2 = r2.ok ? await r2.json() : [];
      const map = new Map<number, any>();
      [...t1, ...t2].forEach((t: any) => map.set(t.id, t));
      return Array.from(map.values()).sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
    staleTime: 5 * 60 * 1000,
    enabled: step === 'form',
  });

  // ─── Handlers ───

  const resetDialog = useCallback(() => {
    setStep('type');
    setFormStep('incident');
    setIncidentType('FALLA');
    setIsImproving(false);
    setToolsUsed([]);
    setSparePartsUsed([]);
    setControlPlan([]);
    setToolComboOpen(false);
    setSparePartComboOpen(false);
    setNewControlDesc('');
    setNewControlDelay('');
    setNewControlType('from_resolution');
    form.reset();
  }, [form]);

  const handleClose = useCallback((open: boolean) => {
    if (!open) resetDialog();
    onOpenChange(open);
  }, [onOpenChange, resetDialog]);

  // ─── Step 1: Elegir tipo ───
  const handleSelectType = (type: IncidentType) => {
    setIncidentType(type);
    setStep('path');
  };

  // ─── Step 2: Elegir camino ───
  const handleSelectPath = (path: ResolutionPath) => {
    if (path === 'requires-ot') {
      onRequiresOT(incidentType);
      resetDialog();
    } else {
      setStep('form');
    }
  };

  // ─── Form step navigation ───

  const currentFormStepIndex = formStepIds.indexOf(formStep);
  const isFirstFormStep = currentFormStepIndex === 0;
  const isLastFormStep = currentFormStepIndex === formStepIds.length - 1;

  const handleNextFormStep = () => {
    if (!isLastFormStep) {
      setFormStep(formStepIds[currentFormStepIndex + 1]);
    }
  };

  const handlePrevFormStep = () => {
    if (isFirstFormStep) {
      setStep('path');
    } else {
      setFormStep(formStepIds[currentFormStepIndex - 1]);
    }
  };

  const handleStepClick = (stepId: string) => {
    setFormStep(stepId as FormStep);
  };

  // ─── Items management ───

  const addItem = (list: UsedItem[], setList: (items: UsedItem[]) => void, item: { id: number; name: string }) => {
    const existing = list.find(i => i.id === item.id);
    if (existing) {
      setList(list.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setList([...list, { id: item.id, name: item.name, quantity: 1 }]);
    }
  };

  const removeItem = (list: UsedItem[], setList: (items: UsedItem[]) => void, id: number) => {
    setList(list.filter(i => i.id !== id));
  };

  const updateItemQty = (list: UsedItem[], setList: (items: UsedItem[]) => void, id: number, qty: number) => {
    setList(list.map(i => i.id === id ? { ...i, quantity: Math.max(1, qty) } : i));
  };

  const addControl = () => {
    if (!newControlDesc.trim()) return;
    const delay = parseInt(newControlDelay) || 60;
    setControlPlan(prev => [
      ...prev,
      { order: prev.length + 1, delayMinutes: delay, description: newControlDesc.trim(), type: newControlType },
    ]);
    setNewControlDesc('');
    setNewControlDelay('');
    setNewControlType('from_resolution');
  };

  const removeControl = (order: number) => {
    setControlPlan(prev =>
      prev.filter(c => c.order !== order).map((c, i) => ({ ...c, order: i + 1 }))
    );
  };

  // ─── Submit ───
  const createMutation = useMutation({
    mutationFn: async (data: ResolvedIncidentFormData) => {
      const res = await fetch('/api/failure-occurrences/quick-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machineId: data.machineId,
          componentIds: data.componentIds,
          subcomponentIds: data.subcomponentIds,
          title: data.title,
          description: data.description || undefined,
          causedDowntime: data.causedDowntime,
          incidentType,
          resolveImmediately: true,
          immediateSolution: data.immediateSolution,
          diagnosis: data.diagnosis,
          outcome: data.outcome,
          actualMinutes: data.actualMinutes || undefined,
          repairAction: data.repairAction || undefined,
          repairDetail: data.repairDetail || undefined,
          fixType: data.fixType,
          performedByIds: data.performedByIds?.length ? data.performedByIds : undefined,
          supervisorId: data.supervisorId || undefined,
          toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
          sparePartsUsed: sparePartsUsed.length > 0 ? sparePartsUsed : undefined,
          controlPlan: controlPlan.length > 0 ? controlPlan : undefined,
          forceCreate: true,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al crear incidencia');
      }

      return res.json();
    },
    onSuccess: () => {
      const label = incidentType === 'ROTURA' ? 'Rotura' : 'Falla';
      toast.success(`${label} registrada y resuelta exitosamente`);
      queryClient.invalidateQueries({ queryKey: ['failures-grid'] });
      queryClient.invalidateQueries({ queryKey: ['failure-stats'] });
      handleClose(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (data: ResolvedIncidentFormData) => {
    createMutation.mutate(data);
  };

  // Validate and submit — validates on the last step
  const handleValidateAndSubmit = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      // Find first step with errors and navigate there
      const errors = form.formState.errors;
      if (errors.machineId || errors.title || errors.description) {
        setFormStep('incident');
        toast.error('Completá los campos del paso 1 — Incidente');
      } else if (errors.diagnosis || errors.immediateSolution || errors.repairAction || errors.repairDetail || errors.fixType || errors.outcome || errors.actualMinutes) {
        setFormStep('resolution');
        toast.error('Completá los campos del paso 2 — Resolución');
      } else {
        toast.error('Revisá los campos obligatorios');
      }
      return;
    }
    form.handleSubmit(handleSubmit)();
  };

  // ─── Mejorar con IA ───
  const handleImproveWithAI = async () => {
    const diagnosis = form.getValues('diagnosis');
    const solution = form.getValues('immediateSolution');

    if (!diagnosis && !solution) {
      toast.error('Escribí algo en diagnóstico o solución primero');
      return;
    }

    setIsImproving(true);
    try {
      const res = await fetch('/api/ai/improve-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnosis,
          solution,
          context: `Incidente de mantenimiento tipo ${incidentType.toLowerCase()}`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.diagnosis) form.setValue('diagnosis', data.diagnosis);
        if (data.solution) form.setValue('immediateSolution', data.solution);
        toast.success('Texto mejorado con IA');
      } else {
        toast.error('No se pudo mejorar el texto');
      }
    } catch {
      toast.error('Error de conexión con IA');
    } finally {
      setIsImproving(false);
    }
  };

  // ─── Render helpers ───

  const typeLabel = incidentType === 'ROTURA' ? 'Rotura' : 'Falla';
  const watchRepairAction = form.watch('repairAction');

  const employeeOptions = (employees || []).map(e => ({
    value: e.id.toString(),
    label: e.name,
  }));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        size={step === 'form' ? 'xl' : 'md'}
        className={step === 'form' ? 'p-0 flex flex-col max-h-[90vh]' : undefined}
        hideCloseButton={step === 'form'}
      >
        {/* ═══════════════════════════════════════════════ */}
        {/* ═══ PRE-WIZARD: Type & Path selection ═══════ */}
        {/* ═══════════════════════════════════════════════ */}

        {step !== 'form' && (
          <>
            <DialogHeader>
              <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                {step !== 'type' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    style={{ height: '28px', width: '28px', borderRadius: '6px' }}
                    className="-ml-1"
                    onClick={() => setStep('type')}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                {step === 'type' && 'Crear Incidencia'}
                {step === 'path' && `Nueva ${typeLabel}`}
              </DialogTitle>
              <DialogDescription style={{ fontSize: '13px', color: '#6B7280' }}>
                {step === 'type' && '¿Qué tipo de incidente ocurrió?'}
                {step === 'path' && '¿Cómo se va a resolver?'}
              </DialogDescription>
            </DialogHeader>

            {/* ── PASO 1: Elegir tipo ── */}
            {step === 'type' && (
              <DialogBody>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px', borderRadius: '8px', border: '1.5px solid #E4E4E8', background: '#FFFFFF', cursor: 'pointer', transition: 'all 0.15s ease' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#D97706'; e.currentTarget.style.background = '#FEF3C7'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E4E4E8'; e.currentTarget.style.background = '#FFFFFF'; }}
                    onClick={() => handleSelectType('FALLA')}
                  >
                    <div style={{ height: '48px', width: '48px', borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AlertTriangle style={{ height: '24px', width: '24px', color: '#D97706' }} />
                    </div>
                    <div className="text-center">
                      <p style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>Falla</p>
                      <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                        Mal funcionamiento o desperfecto
                      </p>
                    </div>
                  </button>

                  <button
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px', borderRadius: '8px', border: '1.5px solid #E4E4E8', background: '#FFFFFF', cursor: 'pointer', transition: 'all 0.15s ease' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#DC2626'; e.currentTarget.style.background = '#FEE2E2'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E4E4E8'; e.currentTarget.style.background = '#FFFFFF'; }}
                    onClick={() => handleSelectType('ROTURA')}
                  >
                    <div style={{ height: '48px', width: '48px', borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Unlink style={{ height: '24px', width: '24px', color: '#DC2626' }} />
                    </div>
                    <div className="text-center">
                      <p style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>Rotura</p>
                      <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                        Rotura física de componente o pieza
                      </p>
                    </div>
                  </button>
                </div>
              </DialogBody>
            )}

            {/* ── PASO 2: Elegir camino ── */}
            {step === 'path' && (
              <DialogBody>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderRadius: '8px', border: '1.5px solid #E4E4E8', background: '#FFFFFF', cursor: 'pointer', transition: 'all 0.15s ease', textAlign: 'left' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.background = '#ECFDF5'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E4E4E8'; e.currentTarget.style.background = '#FFFFFF'; }}
                    onClick={() => handleSelectPath('resolved')}
                  >
                    <div style={{ height: '40px', width: '40px', borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CheckCircle2 style={{ height: '20px', width: '20px', color: '#059669' }} />
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>Ya fue resuelta</p>
                      <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                        Se solucionó en el momento — registrar lo que se hizo
                      </p>
                    </div>
                  </button>

                  <button
                    style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderRadius: '8px', border: '1.5px solid #E4E4E8', background: '#FFFFFF', cursor: 'pointer', transition: 'all 0.15s ease', textAlign: 'left' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.background = '#EFF6FF'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E4E4E8'; e.currentTarget.style.background = '#FFFFFF'; }}
                    onClick={() => handleSelectPath('requires-ot')}
                  >
                    <div style={{ height: '40px', width: '40px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ClipboardList style={{ height: '20px', width: '20px', color: '#2563EB' }} />
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '14px', color: '#111827' }}>Requiere OT</p>
                      <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                        Necesita orden de trabajo para resolverse
                      </p>
                    </div>
                  </button>
                </div>
              </DialogBody>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* ═══ WIZARD FORM: 4 pasos con Stepper ════════════ */}
        {/* ═══════════════════════════════════════════════════ */}

        {step === 'form' && (
          <Form {...form}>
            <form
              onSubmit={(e) => { e.preventDefault(); handleValidateAndSubmit(); }}
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              {/* ── Sticky header: título + stepper ── */}
              <div style={{ flexShrink: 0, background: '#FFFFFF', borderBottom: '1px solid #E4E4E8' }}>
                <div className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      style={{ height: '28px', width: '28px', borderRadius: '6px' }}
                      className="-ml-1"
                      onClick={handlePrevFormStep}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {typeLabel} — Ya resuelta
                        <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: incidentType === 'ROTURA' ? '#FEE2E2' : '#FEF3C7', color: incidentType === 'ROTURA' ? '#DC2626' : '#D97706' }}>
                          {typeLabel}
                        </span>
                      </h2>
                      <p style={{ fontSize: '12px', color: '#9CA3AF' }}>
                        Paso {currentFormStepIndex + 1} de {formStepIds.length}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    style={{ height: '28px', width: '28px', borderRadius: '6px' }}
                    onClick={() => handleClose(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex justify-center px-4 pb-3 sm:px-6 sm:pb-4">
                  <Stepper
                    steps={formSteps}
                    currentStep={formStep}
                    onStepClick={handleStepClick}
                    className="w-full max-w-lg"
                  />
                </div>
              </div>

              {/* ── Scrollable content area ── */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
                <div className="px-4 py-5 sm:px-6 sm:py-6 space-y-4">

                  {/* ════════════════════════════════════════════ */}
                  {/* ── PASO 1: ¿Qué sucedió y por qué? ─────── */}
                  {/* ════════════════════════════════════════════ */}
                  {formStep === 'incident' && (
                    <div className="space-y-5">
                      <div className="flex items-center gap-2.5 pb-1">
                        <div style={{ height: '32px', width: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: incidentType === 'ROTURA' ? '#FEE2E2' : '#FEF3C7' }}>
                          {incidentType === 'ROTURA'
                            ? <Unlink style={{ height: '16px', width: '16px', color: '#DC2626' }} />
                            : <AlertTriangle style={{ height: '16px', width: '16px', color: '#D97706' }} />
                          }
                        </div>
                        <div>
                          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                            {incidentType === 'ROTURA' ? '¿Qué se rompió y por qué?' : '¿Qué sucedió y por qué?'}
                          </h3>
                          <p style={{ fontSize: '12px', color: '#6B7280' }}>Describí el incidente con certeza — ya sabés qué pasó</p>
                        </div>
                      </div>

                      {/* Máquina */}
                      <FormField
                        control={form.control}
                        name="machineId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>Máquina *</FormLabel>
                            <FormControl>
                              <div style={{ border: '1px solid #E4E4E8', borderRadius: '8px', padding: '8px 12px' }}>
                                <ComponentTreeSelector
                                  value={{
                                    machineId: field.value,
                                    componentIds: form.watch('componentIds'),
                                    subcomponentIds: form.watch('subcomponentIds'),
                                  }}
                                  onChange={(selection) => {
                                    field.onChange(selection.machineId);
                                    form.setValue('componentIds', selection.componentIds);
                                    form.setValue('subcomponentIds', selection.subcomponentIds);
                                  }}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Título */}
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>¿Qué sucedió? *</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={incidentType === 'ROTURA'
                                  ? 'Ej: Se rompió la correa de la bomba hidráulica'
                                  : 'Ej: Motor no arranca correctamente'
                                }
                                className="text-sm"
                                style={{ border: '1px solid #E4E4E8', borderRadius: '8px' }}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Descripción / Por qué */}
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>¿Por qué sucedió?</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Causa confirmada, condiciones del equipo, contexto..."
                                rows={3}
                                className="text-sm resize-none"
                                style={{ border: '1px solid #E4E4E8', borderRadius: '8px' }}
                                {...field}
                              />
                            </FormControl>
                            <p style={{ fontSize: '11px', color: '#9CA3AF' }}>
                              Ya se resolvió — contá lo que efectivamente pasó, no lo que creés
                            </p>
                          </FormItem>
                        )}
                      />

                      {/* Causó parada */}
                      <FormField
                        control={form.control}
                        name="causedDowntime"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between" style={{ border: '1px solid #E4E4E8', borderRadius: '8px', padding: '12px' }}>
                            <div>
                              <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151', cursor: 'pointer' }}>
                                ¿Causó parada de producción?
                              </FormLabel>
                              <p style={{ fontSize: '11px', color: '#9CA3AF' }}>Se detuvo la línea o máquina</p>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* ════════════════════════════════════════════ */}
                  {/* ── PASO 2: ¿Cómo se resolvió? ────────────── */}
                  {/* ════════════════════════════════════════════ */}
                  {formStep === 'resolution' && (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between pb-1">
                        <div className="flex items-center gap-2.5">
                          <div style={{ height: '32px', width: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ECFDF5' }}>
                            <Wrench style={{ height: '16px', width: '16px', color: '#059669' }} />
                          </div>
                          <div>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>¿Cómo se resolvió?</h3>
                            <p style={{ fontSize: '12px', color: '#6B7280' }}>Detallá la intervención y el resultado</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleImproveWithAI}
                          disabled={isImproving}
                          style={{ fontSize: '12px', borderRadius: '6px', border: '1px solid #E4E4E8' }}
                        >
                          {isImproving ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3 mr-1" />
                          )}
                          Mejorar con IA
                        </Button>
                      </div>

                      {/* Acción de reparación (solo ROTURA) */}
                      {incidentType === 'ROTURA' && (
                        <>
                          <FormField
                            control={form.control}
                            name="repairAction"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>Tipo de intervención *</FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value || ''}
                                >
                                  <FormControl>
                                    <SelectTrigger className="h-10" style={{ border: '1px solid #E4E4E8', borderRadius: '8px' }}>
                                      <SelectValue placeholder="¿Se cambió o se reparó?" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="CAMBIO">
                                      <span className="flex items-center gap-2">
                                        <Package className="h-4 w-4 text-blue-500" />
                                        Se cambió la pieza
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="REPARACION">
                                      <span className="flex items-center gap-2">
                                        <Wrench className="h-4 w-4 text-green-500" />
                                        Se reparó / arregló
                                      </span>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {watchRepairAction && (
                            <FormField
                              control={form.control}
                              name="repairDetail"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>
                                    {watchRepairAction === 'CAMBIO'
                                      ? '¿Qué pieza se cambió?'
                                      : '¿Cómo se reparó? Explicá el procedimiento'
                                    }
                                  </FormLabel>
                                  <FormControl>
                                    {watchRepairAction === 'REPARACION' ? (
                                      <Textarea
                                        placeholder="Describí paso a paso cómo se reparó..."
                                        rows={3}
                                        className="text-sm resize-none"
                                        style={{ border: '1px solid #E4E4E8', borderRadius: '8px' }}
                                        {...field}
                                      />
                                    ) : (
                                      <Input
                                        placeholder="Ej: Correa de distribución modelo X-200"
                                        className="text-sm"
                                        style={{ border: '1px solid #E4E4E8', borderRadius: '8px' }}
                                        {...field}
                                      />
                                    )}
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          )}
                        </>
                      )}

                      {/* Diagnóstico */}
                      <FormField
                        control={form.control}
                        name="diagnosis"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>Diagnóstico — ¿Qué encontraste? *</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describí lo que encontraste al revisar..."
                                rows={2}
                                className="text-sm resize-none"
                                style={{ border: '1px solid #E4E4E8', borderRadius: '8px' }}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Solución */}
                      <FormField
                        control={form.control}
                        name="immediateSolution"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>Solución aplicada — ¿Qué hiciste? *</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Describí la solución que aplicaste..."
                                rows={2}
                                className="text-sm resize-none"
                                style={{ border: '1px solid #E4E4E8', borderRadius: '8px' }}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Tipo de fix + Resultado + Tiempo */}
                      <div className="grid grid-cols-3 gap-3">
                        <FormField
                          control={form.control}
                          name="fixType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>Tipo de fix</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-9 text-xs" style={{ border: '1px solid #E4E4E8', borderRadius: '8px' }}>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="DEFINITIVA">Definitiva</SelectItem>
                                  <SelectItem value="PARCHE">Parche</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="outcome"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>Resultado *</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="h-9 text-xs" style={{ border: '1px solid #E4E4E8', borderRadius: '8px' }}>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="FUNCIONÓ">Funcionó</SelectItem>
                                  <SelectItem value="PARCIAL">Parcial</SelectItem>
                                  <SelectItem value="NO_FUNCIONÓ">No funcionó</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="actualMinutes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>Tiempo (min)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="Ej: 30"
                                  min={1}
                                  className="h-9 text-xs"
                                  style={{ border: '1px solid #E4E4E8', borderRadius: '8px' }}
                                  {...field}
                                  onChange={(e) =>
                                    field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                                  }
                                  value={field.value || ''}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* ── Herramientas y Repuestos ── */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Herramientas — Multi-select combobox con cant inline */}
                        <div className="space-y-2">
                          <p className="text-sm font-medium flex items-center gap-1.5">
                            <Wrench className="h-3.5 w-3.5 text-muted-foreground" /> Herramientas
                            {toolsUsed.length > 0 && (
                              <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '6px', background: '#F3F4F6', color: '#374151' }}>{toolsUsed.length}</span>
                            )}
                          </p>

                          <Popover open={toolComboOpen} onOpenChange={setToolComboOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                aria-expanded={toolComboOpen}
                                className="w-full justify-between h-9 text-xs font-normal"
                                style={{ border: '1px solid #E4E4E8', borderRadius: '8px' }}
                              >
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                  <Search className="h-3 w-3" />
                                  {toolsUsed.length > 0
                                    ? `${toolsUsed.length} seleccionada${toolsUsed.length > 1 ? 's' : ''}`
                                    : 'Seleccionar herramientas...'}
                                </span>
                                <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Filtrar por nombre o código..." className="text-xs h-8" />
                                <CommandList>
                                  <CommandEmpty className="text-xs py-4 text-center">No se encontraron herramientas</CommandEmpty>
                                  <CommandGroup>
                                    {(allTools || []).map((t) => {
                                      const isSelected = toolsUsed.some(u => u.id === t.id);
                                      const selectedItem = toolsUsed.find(u => u.id === t.id);
                                      return (
                                        <CommandItem
                                          key={t.id}
                                          value={`${t.name} ${t.code || ''}`}
                                          onSelect={() => {
                                            if (isSelected) {
                                              removeItem(toolsUsed, setToolsUsed, t.id);
                                            } else {
                                              addItem(toolsUsed, setToolsUsed, t);
                                            }
                                          }}
                                          className="text-xs"
                                        >
                                          <div className={cn(
                                            'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border shrink-0',
                                            isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'
                                          )}>
                                            {isSelected && <Check className="h-3 w-3" />}
                                          </div>
                                          <Wrench className="h-3 w-3 text-muted-foreground mr-1.5 shrink-0" />
                                          <span className="flex-1 truncate">{t.name}</span>
                                          {t.code && <span className="text-muted-foreground text-[10px] ml-1 shrink-0">{t.code}</span>}
                                          {isSelected && (
                                            <div className="flex items-center gap-1 ml-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                              <span className="text-[10px] text-muted-foreground">×</span>
                                              <input
                                                type="number"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                min={1}
                                                value={selectedItem?.quantity ?? 1}
                                                onChange={(e) => {
                                                  e.stopPropagation();
                                                  updateItemQty(toolsUsed, setToolsUsed, t.id, parseInt(e.target.value) || 1);
                                                }}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                onKeyDown={(e) => e.stopPropagation()}
                                                className="h-5 w-10 text-[10px] text-center rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                                              />
                                            </div>
                                          )}
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>

                          {/* Resumen de herramientas seleccionadas */}
                          {toolsUsed.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {toolsUsed.map((item) => (
                                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', background: '#F3F4F6', borderRadius: '6px', padding: '3px 8px', border: '1px solid #E4E4E8' }}>
                                  <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{item.name}</span>
                                  <span style={{ color: '#9CA3AF' }}>×</span>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    min={1}
                                    value={item.quantity}
                                    onChange={(e) => updateItemQty(toolsUsed, setToolsUsed, item.id, parseInt(e.target.value) || 1)}
                                    style={{ height: '20px', width: '32px', fontSize: '10px', textAlign: 'center' as const, borderRadius: '4px', border: '1px solid #E4E4E8', background: '#FFFFFF', outline: 'none' }}
                                  />
                                  <button type="button" style={{ color: '#9CA3AF', marginLeft: '2px' }} onClick={() => removeItem(toolsUsed, setToolsUsed, item.id)}>
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Repuestos — Multi-select combobox con cant inline */}
                        <div className="space-y-2">
                          <p className="text-sm font-medium flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5 text-muted-foreground" /> Repuestos
                            {sparePartsUsed.length > 0 && (
                              <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '6px', background: '#F3F4F6', color: '#374151' }}>{sparePartsUsed.length}</span>
                            )}
                          </p>

                          <Popover open={sparePartComboOpen} onOpenChange={setSparePartComboOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                aria-expanded={sparePartComboOpen}
                                className="w-full justify-between h-9 text-xs font-normal"
                                style={{ border: '1px solid #E4E4E8', borderRadius: '8px' }}
                              >
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                  <Search className="h-3 w-3" />
                                  {sparePartsUsed.length > 0
                                    ? `${sparePartsUsed.length} seleccionado${sparePartsUsed.length > 1 ? 's' : ''}`
                                    : 'Seleccionar repuestos...'}
                                </span>
                                <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Filtrar por nombre o código..." className="text-xs h-8" />
                                <CommandList>
                                  <CommandEmpty className="text-xs py-4 text-center">No se encontraron repuestos</CommandEmpty>
                                  <CommandGroup>
                                    {(allSpareParts || []).map((sp) => {
                                      const isSelected = sparePartsUsed.some(u => u.id === sp.id);
                                      const selectedItem = sparePartsUsed.find(u => u.id === sp.id);
                                      return (
                                        <CommandItem
                                          key={sp.id}
                                          value={`${sp.name} ${sp.code || ''}`}
                                          onSelect={() => {
                                            if (isSelected) {
                                              removeItem(sparePartsUsed, setSparePartsUsed, sp.id);
                                            } else {
                                              addItem(sparePartsUsed, setSparePartsUsed, sp);
                                            }
                                          }}
                                          className="text-xs"
                                        >
                                          <div className={cn(
                                            'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border shrink-0',
                                            isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30'
                                          )}>
                                            {isSelected && <Check className="h-3 w-3" />}
                                          </div>
                                          <Package className="h-3 w-3 text-muted-foreground mr-1.5 shrink-0" />
                                          <span className="flex-1 truncate">{sp.name}</span>
                                          {sp.code && <span className="text-muted-foreground text-[10px] ml-1 shrink-0">{sp.code}</span>}
                                          {isSelected && (
                                            <div className="flex items-center gap-1 ml-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                              <span className="text-[10px] text-muted-foreground">×</span>
                                              <input
                                                type="number"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                min={1}
                                                value={selectedItem?.quantity ?? 1}
                                                onChange={(e) => {
                                                  e.stopPropagation();
                                                  updateItemQty(sparePartsUsed, setSparePartsUsed, sp.id, parseInt(e.target.value) || 1);
                                                }}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                onKeyDown={(e) => e.stopPropagation()}
                                                className="h-5 w-10 text-[10px] text-center rounded border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                                              />
                                            </div>
                                          )}
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>

                          {/* Resumen de repuestos seleccionados */}
                          {sparePartsUsed.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {sparePartsUsed.map((item) => (
                                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', background: '#F3F4F6', borderRadius: '6px', padding: '3px 8px', border: '1px solid #E4E4E8' }}>
                                  <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{item.name}</span>
                                  <span style={{ color: '#9CA3AF' }}>×</span>
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    min={1}
                                    value={item.quantity}
                                    onChange={(e) => updateItemQty(sparePartsUsed, setSparePartsUsed, item.id, parseInt(e.target.value) || 1)}
                                    style={{ height: '20px', width: '32px', fontSize: '10px', textAlign: 'center' as const, borderRadius: '4px', border: '1px solid #E4E4E8', background: '#FFFFFF', outline: 'none' }}
                                  />
                                  <button type="button" style={{ color: '#9CA3AF', marginLeft: '2px' }} onClick={() => removeItem(sparePartsUsed, setSparePartsUsed, item.id)}>
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ════════════════════════════════════════════ */}
                  {/* ── PASO 3: ¿Quiénes participaron? ──────── */}
                  {/* ════════════════════════════════════════════ */}
                  {formStep === 'team' && (
                    <div className="space-y-5">
                      <div className="flex items-center gap-2.5 pb-1">
                        <div style={{ height: '32px', width: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EFF6FF' }}>
                          <Users style={{ height: '16px', width: '16px', color: '#2563EB' }} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>¿Quiénes participaron?</h3>
                          <p style={{ fontSize: '12px', color: '#6B7280' }}>Indicá los operadores y el supervisor a cargo</p>
                        </div>
                      </div>

                      {/* Supervisor (primero) */}
                      <FormField
                        control={form.control}
                        name="supervisorId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>Supervisor a cargo</FormLabel>
                            <Select
                              onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)}
                              value={field.value?.toString() || ''}
                            >
                              <FormControl>
                                <SelectTrigger className="h-10" style={{ border: '1px solid #E4E4E8', borderRadius: '8px' }}>
                                  <SelectValue placeholder="Seleccionar supervisor..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(employees || []).map((emp) => (
                                  <SelectItem key={emp.id} value={emp.id.toString()}>
                                    {emp.name}
                                    {emp.id.toString() === user?.id?.toString() && ' (yo)'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p style={{ fontSize: '11px', color: '#9CA3AF' }}>
                              Quien supervisó o autorizó la intervención
                            </p>
                          </FormItem>
                        )}
                      />

                      {/* Operadores */}
                      <FormField
                        control={form.control}
                        name="performedByIds"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>Operadores que trabajaron</FormLabel>
                            <FormControl>
                              <MultiSelect
                                options={employeeOptions}
                                selected={(field.value || []).map(id => id.toString())}
                                onChange={(selected) => field.onChange(selected.map(s => parseInt(s)))}
                                placeholder="Seleccionar operadores..."
                                searchPlaceholder="Buscar por nombre..."
                                maxCount={5}
                              />
                            </FormControl>
                            <p style={{ fontSize: '11px', color: '#9CA3AF' }}>
                              Todos los que participaron en la resolución
                            </p>
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* ════════════════════════════════════════════ */}
                  {/* ── PASO 4: Controles de seguimiento ─────── */}
                  {/* ════════════════════════════════════════════ */}
                  {formStep === 'controls' && (
                    <div className="space-y-5">
                      <div className="flex items-center gap-2.5 pb-1">
                        <div style={{ height: '32px', width: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F3FF' }}>
                          <Shield style={{ height: '16px', width: '16px', color: '#7C3AED' }} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Controles de seguimiento</h3>
                          <p style={{ fontSize: '12px', color: '#6B7280' }}>Verificaciones programadas después de la resolución</p>
                        </div>
                      </div>

                      {/* Lista de controles */}
                      {controlPlan.length > 0 && (
                        <div className="space-y-2">
                          {controlPlan.map((ctrl) => (
                            <div key={ctrl.order} className="flex items-center gap-2" style={{ fontSize: '13px', background: '#FAFAFA', borderRadius: '8px', padding: '10px 12px', border: '1px solid #E4E4E8' }}>
                              <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '6px', background: '#F3F4F6', color: '#374151' }}>
                                #{ctrl.order}
                              </span>
                              <span className="flex-1 text-xs">{ctrl.description}</span>
                              <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', fontSize: '10px', fontWeight: 500, padding: '2px 8px', borderRadius: '6px', border: ctrl.type === 'from_previous' ? '1px solid #93C5FD' : '1px solid #E4E4E8', background: ctrl.type === 'from_previous' ? '#EFF6FF' : '#FFFFFF', color: ctrl.type === 'from_previous' ? '#1D4ED8' : '#374151' }}>
                                {ctrl.type === 'from_previous' ? (
                                  <>
                                    <Clock className="h-2.5 w-2.5 mr-0.5" />
                                    +{ctrl.delayMinutes >= 60
                                      ? `${Math.floor(ctrl.delayMinutes / 60)}h${ctrl.delayMinutes % 60 > 0 ? ` ${ctrl.delayMinutes % 60}m` : ''}`
                                      : `${ctrl.delayMinutes}m`
                                    } del anterior
                                  </>
                                ) : (
                                  <>
                                    <Timer className="h-2.5 w-2.5 mr-0.5" />
                                    {ctrl.delayMinutes >= 60
                                      ? `${Math.floor(ctrl.delayMinutes / 60)}h${ctrl.delayMinutes % 60 > 0 ? ` ${ctrl.delayMinutes % 60}m` : ''}`
                                      : `${ctrl.delayMinutes}m`
                                    } desde resolución
                                  </>
                                )}
                              </span>
                              <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => removeControl(ctrl.order)}>
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {controlPlan.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '24px', border: '1.5px dashed #E4E4E8', borderRadius: '8px', color: '#9CA3AF' }}>
                          <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No hay controles programados</p>
                          <p className="text-xs">Agregá verificaciones para asegurar que la solución funciona</p>
                        </div>
                      )}

                      {/* Agregar control */}
                      <div className="space-y-3" style={{ borderRadius: '8px', border: '1px solid #E4E4E8', padding: '12px', background: '#FAFAFA' }}>
                        <p className="text-xs font-medium">Agregar control</p>

                        {/* Descripción */}
                        <Input
                          placeholder="Ej: Verificar que no pierda presión"
                          value={newControlDesc}
                          onChange={(e) => setNewControlDesc(e.target.value)}
                          className="text-xs h-9"
                          style={{ border: '1px solid #E4E4E8', borderRadius: '8px' }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addControl();
                            }
                          }}
                        />

                        {/* Tipo + Tiempo + Botón */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Tipo de control */}
                          <Select
                            value={newControlType}
                            onValueChange={(v) => setNewControlType(v as 'from_resolution' | 'from_previous')}
                          >
                            <SelectTrigger className="h-9 text-xs w-auto min-w-[180px]" style={{ border: '1px solid #E4E4E8', borderRadius: '8px' }}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="from_resolution">
                                <span className="flex items-center gap-1.5">
                                  <Timer className="h-3 w-3" />
                                  Desde la resolución
                                </span>
                              </SelectItem>
                              <SelectItem value="from_previous">
                                <span className="flex items-center gap-1.5">
                                  <Clock className="h-3 w-3" />
                                  Desde el control anterior
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>

                          {/* Tiempo */}
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-muted-foreground">después de</span>
                            <Input
                              type="number"
                              placeholder="60"
                              value={newControlDelay}
                              onChange={(e) => setNewControlDelay(e.target.value)}
                              className="text-xs h-9 w-16"
                              style={{ border: '1px solid #E4E4E8', borderRadius: '8px' }}
                              min={1}
                            />
                            <span className="text-[11px] text-muted-foreground">min</span>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 px-3"
                            onClick={addControl}
                            disabled={!newControlDesc.trim()}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Agregar
                          </Button>
                        </div>

                        <p style={{ fontSize: '11px', color: '#9CA3AF' }}>
                          <strong>Desde la resolución:</strong> se cuenta desde que se cerró el incidente.{' '}
                          <strong>Desde el control anterior:</strong> se cuenta desde que se completó el control previo.
                        </p>
                      </div>

                      {/* Notas adicionales */}
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>Notas adicionales</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Algo más que quieras registrar sobre este incidente..."
                                rows={3}
                                className="text-sm resize-none"
                                style={{ border: '1px solid #E4E4E8', borderRadius: '8px' }}
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* ── Sticky footer: navigation ── */}
              <div style={{ flexShrink: 0, background: '#FAFAFA', borderTop: '1px solid #E4E4E8', padding: '10px 24px' }}>
                <div className="flex items-center justify-between">
                  <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                    Paso {currentFormStepIndex + 1} de {formStepIds.length}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      style={{ borderRadius: '7px', border: '1px solid #E4E4E8', background: '#FFFFFF', fontSize: '13px' }}
                      onClick={handlePrevFormStep}
                    >
                      <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                      {isFirstFormStep ? 'Volver' : 'Anterior'}
                    </Button>

                    {!isLastFormStep ? (
                      <Button
                        type="button"
                        size="sm"
                        style={{ borderRadius: '7px', background: '#111827', color: '#FFFFFF', fontSize: '13px' }}
                        onClick={handleNextFormStep}
                      >
                        Siguiente
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        size="sm"
                        disabled={createMutation.isPending}
                        style={{ borderRadius: '7px', background: '#059669', color: '#FFFFFF', fontSize: '13px' }}
                      >
                        {createMutation.isPending && (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        )}
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Guardar Incidencia
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
