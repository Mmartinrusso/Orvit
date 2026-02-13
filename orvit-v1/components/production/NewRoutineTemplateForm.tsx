'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Save,
  Loader2,
  Plus,
  Trash2,
  CheckSquare,
  Hash,
  FileText,
  Camera,
  Users,
  Boxes,
  ListOrdered,
  Copy,
  Circle,
  Square,
  ChevronDown,
  ChevronUp,
  Image,
  Type,
  X,
  Calendar,
  Clock,
  PenTool,
  Star,
  SquareCheck,
  Sparkles,
  Upload,
  MessageSquare,
  MessageCircle,
  Send,
  Bot,
  User as UserIcon,
  Smartphone,
  FileCheck,
  GitBranch,
  Package,
  Bell,
  GripVertical,
  Eye,
  AlertCircle,
  Cog,
  Layers,
  FolderOpen,
  EyeOff,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormField,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ============================================================================
// SCHEMA - Super simple like Google Forms
// ============================================================================

const optionSchema = z.object({
  id: z.string(),
  text: z.string(),
});

const sectionSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
});

const itemSchema = z.object({
  id: z.string(),
  question: z.string().min(1, 'Pregunta requerida'),
  type: z.enum([
    'CHECK', 'VALUE', 'TEXT', 'PHOTO', 'SELECT', 'CHECKBOX',
    'DATE', 'TIME', 'SIGNATURE', 'RATING',
    'EMPLOYEE_SELECT', 'RESOURCE_MULTI_SELECT', 'RESOURCE_SEQUENCE_SELECT',
    'MATERIAL_INPUT', 'MACHINE_SELECT',
  ]),
  required: z.boolean().default(false),
  disabled: z.boolean().default(false), // Para deshabilitar sin eliminar
  sectionId: z.string().optional(), // Para agrupar en secciones
  options: z.array(optionSchema).optional(),
  selectDisplayMode: z.enum(['list', 'dropdown']).optional(), // Para SELECT: lista o desplegable
  unit: z.string().optional(),
  minValue: z.number().optional().nullable(),
  maxValue: z.number().optional().nullable(),
  resourceTypeCode: z.string().optional(),
  ratingMax: z.number().optional(),
  employeeConfig: z.object({
    taskAssignment: z.boolean().default(false),
    taskOptions: z.array(z.object({
      id: z.string(),
      label: z.string(),
    })).optional(),
    workSectorAssignment: z.boolean().default(false),
    attendanceTracking: z.boolean().default(false),
    absenceReasons: z.array(z.object({
      id: z.string(),
      label: z.string(),
      payrollEventType: z.string().optional(),
    })).optional(),
    allowSectorTransfer: z.boolean().default(false),
  }).optional(),
  materialConfig: z.object({
    materials: z.array(z.object({
      id: z.string(),
      name: z.string(),
      unit: z.string(),
      expectedPerBatch: z.number().optional(),
    })),
    trackingMode: z.enum(['PER_SHIFT', 'PER_BATCH', 'PER_MIX']).default('PER_SHIFT'),
    allowAddMaterial: z.boolean().default(false),
  }).optional(),
  machineConfig: z.object({
    allowMultiple: z.boolean().default(false), // Permitir seleccionar varias máquinas
    requireCounterReading: z.boolean().default(false), // Pedir lectura de horómetro/contador
    // Máquinas específicas seleccionadas para mostrar
    selectedMachines: z.array(z.object({
      id: z.number(),
      name: z.string(),
      nickname: z.string().optional().nullable(),
      assetCode: z.string().optional().nullable(),
    })).default([]),
  }).optional(),
  photoTimerConfig: z.object({
    delayMinutes: z.number().min(1),
    reminderMessage: z.string().optional(),
  }).optional(),
  conditionalDisplay: z.object({
    parentItemId: z.string(),
    parentValue: z.string(),
  }).optional(),
  // Multi-input support: additional inputs for the same question
  additionalInputs: z.array(z.object({
    id: z.string(),
    type: z.enum([
      'CHECK', 'VALUE', 'TEXT', 'PHOTO', 'SELECT', 'CHECKBOX',
      'DATE', 'TIME', 'SIGNATURE', 'RATING',
    ]),
    label: z.string().optional(), // Custom label like "Observaciones", "Foto de evidencia"
    required: z.boolean().default(false),
    options: z.array(optionSchema).optional(),
    selectDisplayMode: z.enum(['list', 'dropdown']).optional(),
    unit: z.string().optional(),
    minValue: z.number().optional().nullable(),
    maxValue: z.number().optional().nullable(),
    ratingMax: z.number().optional(),
  })).optional(),
});

const formSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  code: z.string().optional(),
  type: z.string().default('SHIFT_START'),
  frequency: z.string().default('EVERY_SHIFT'),
  workCenterId: z.number().optional().nullable(),
  sectorId: z.number().optional().nullable(), // Sector para filtrar empleados
  isActive: z.boolean().default(true),
  maxCompletionTimeMinutes: z.number().min(1).default(60),
  enableCompletionReminders: z.boolean().default(true),
  sections: z.array(sectionSchema).default([]), // Secciones opcionales
  items: z.array(itemSchema).min(1, 'Debe tener al menos una pregunta'),
});

type FormValues = z.infer<typeof formSchema>;
type ItemType = z.infer<typeof itemSchema>;

// ============================================================================
// CONSTANTS
// ============================================================================

interface RoutineTemplate {
  id: number;
  code: string;
  name: string;
  type: string;
  frequency: string;
  isActive: boolean;
  items: any[];
  groups?: any[];
  sections?: any[];
  workCenter: { id: number; name: string; code: string } | null;
  sector: { id: number; name: string } | null;
}

interface NewRoutineTemplateFormProps {
  template?: RoutineTemplate | null;
  onSuccess: () => void;
  onCancel: () => void;
  defaultSectorId?: number | null; // Auto-assign sector when creating new template
}

// Google Forms style type options
const QUESTION_TYPES = [
  // Básicos
  { value: 'CHECK', label: 'Sí / No', icon: CheckSquare, preview: 'check' },
  { value: 'TEXT', label: 'Respuesta corta', icon: Type, preview: 'short' },
  { value: 'VALUE', label: 'Número', icon: Hash, preview: 'number' },
  { value: 'PHOTO', label: 'Subir foto', icon: Image, preview: 'file' },
  // Opciones
  { value: 'SELECT', label: 'Varias opciones', icon: Circle, preview: 'radio' },
  { value: 'CHECKBOX', label: 'Casillas', icon: SquareCheck, preview: 'checkbox' },
  { value: 'RATING', label: 'Escala', icon: Star, preview: 'rating' },
  // Fecha/Hora
  { value: 'DATE', label: 'Fecha', icon: Calendar, preview: 'date' },
  { value: 'TIME', label: 'Hora', icon: Clock, preview: 'time' },
  // Especiales
  { value: 'SIGNATURE', label: 'Firma', icon: PenTool, preview: 'signature' },
  { value: 'EMPLOYEE_SELECT', label: 'Empleados', icon: Users, preview: 'dropdown' },
  { value: 'RESOURCE_MULTI_SELECT', label: 'Recursos', icon: Boxes, preview: 'checkbox' },
  { value: 'RESOURCE_SEQUENCE_SELECT', label: 'Secuencia', icon: ListOrdered, preview: 'dropdown' },
  { value: 'MATERIAL_INPUT', label: 'Materiales', icon: Package, preview: 'number' },
  { value: 'MACHINE_SELECT', label: 'Máquina/Equipo', icon: Cog, preview: 'dropdown' },
];

const generateId = () => `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
const generateOptionId = () => `opt_${Math.random().toString(36).substr(2, 6)}`;

const createEmptyItem = (type: ItemType['type'] = 'CHECK'): ItemType => ({
  id: generateId(),
  question: '',
  type,
  required: false,
  options: (type === 'SELECT' || type === 'CHECKBOX')
    ? [{ id: generateOptionId(), text: 'Opción 1' }]
    : undefined,
  ratingMax: type === 'RATING' ? 5 : undefined,
  materialConfig: type === 'MATERIAL_INPUT' ? {
    materials: [{ id: `mat_${Date.now()}`, name: '', unit: 'kg' }],
    trackingMode: 'PER_SHIFT',
    allowAddMaterial: false,
  } : undefined,
  machineConfig: type === 'MACHINE_SELECT' ? {
    allowMultiple: false,
    requireCounterReading: false,
    selectedMachines: [],
  } : undefined,
});

const TRACKING_MODES = [
  { value: 'PER_SHIFT', label: 'Por turno' },
  { value: 'PER_BATCH', label: 'Por lote' },
  { value: 'PER_MIX', label: 'Por mezcla' },
];

function MaterialConfigEditor({ index, form }: { index: number; form: any }) {
  const config = form.watch(`items.${index}.materialConfig`);
  if (!config) return null;

  const materials = config.materials || [];

  const updateConfig = (updates: any) => {
    form.setValue(`items.${index}.materialConfig`, { ...config, ...updates });
  };

  const updateMaterial = (matIdx: number, updates: any) => {
    const updated = [...materials];
    updated[matIdx] = { ...updated[matIdx], ...updates };
    updateConfig({ materials: updated });
  };

  const addMaterial = () => {
    updateConfig({
      materials: [...materials, { id: `mat_${Date.now()}`, name: '', unit: 'kg' }],
    });
  };

  const removeMaterial = (matIdx: number) => {
    if (materials.length <= 1) return;
    updateConfig({ materials: materials.filter((_: any, i: number) => i !== matIdx) });
  };

  return (
    <div className="space-y-3 pt-2 border-t border-gray-100">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Package className="h-4 w-4" />
        <span className="font-medium">Configuración de materiales</span>
      </div>

      {/* Tracking mode */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-gray-500 w-28">Modo de registro:</Label>
        <select
          className="text-sm border rounded px-2 py-1.5 bg-white flex-1"
          value={config.trackingMode || 'PER_SHIFT'}
          onChange={(e) => updateConfig({ trackingMode: e.target.value })}
        >
          {TRACKING_MODES.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Materials list */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500">Materiales a registrar:</p>
        {materials.map((mat: any, matIdx: number) => (
          <div key={mat.id} className="flex items-center gap-2 group">
            <span className="text-xs text-gray-400 w-4 text-center">{matIdx + 1}</span>
            <Input
              value={mat.name}
              onChange={(e) => updateMaterial(matIdx, { name: e.target.value })}
              placeholder="Nombre del material"
              className="flex-1 h-8 text-sm"
            />
            <Input
              value={mat.unit}
              onChange={(e) => updateMaterial(matIdx, { unit: e.target.value })}
              placeholder="Unidad"
              className="w-20 h-8 text-sm text-center"
            />
            {materials.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeMaterial(matIdx)}
              >
                <X className="h-3 w-3 text-gray-400" />
              </Button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addMaterial}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600"
        >
          <Plus className="h-4 w-4" />
          Agregar material
        </button>
      </div>

      {/* Allow adding materials at execution */}
      <div className="flex items-center justify-between">
        <Label className="text-xs text-gray-500">Permitir agregar materiales al ejecutar</Label>
        <Switch
          checked={config.allowAddMaterial || false}
          onCheckedChange={(checked) => updateConfig({ allowAddMaterial: checked })}
        />
      </div>
    </div>
  );
}

// Machine config editor for MACHINE_SELECT type
function MachineConfigEditor({ index, form }: { index: number; form: any }) {
  const config = form.watch(`items.${index}.machineConfig`);
  const workCenterId = form.watch('workCenterId');
  const [allMachines, setAllMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSelector, setShowSelector] = useState(false);

  useEffect(() => {
    const fetchMachines = async () => {
      setLoading(true);
      try {
        // Build URL with workCenterId filter if available
        const params = new URLSearchParams();
        if (workCenterId) {
          params.set('workCenterId', workCenterId.toString());
        }
        const url = `/api/production/routines/machines${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setAllMachines(data.machines || []);
        }
      } catch (error) {
        console.error('Error fetching machines:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMachines();
  }, [workCenterId]); // Re-fetch when workCenterId changes

  if (!config) return null;

  const selectedMachines = config.selectedMachines || [];

  const updateConfig = (updates: any) => {
    form.setValue(`items.${index}.machineConfig`, { ...config, ...updates });
  };

  const addMachine = (machine: any) => {
    if (selectedMachines.some((m: any) => m.id === machine.id)) return;
    updateConfig({
      selectedMachines: [...selectedMachines, {
        id: machine.id,
        name: machine.name,
        nickname: machine.nickname,
        assetCode: machine.assetCode,
      }],
    });
    setSearchTerm('');
  };

  const removeMachine = (machineId: number) => {
    updateConfig({
      selectedMachines: selectedMachines.filter((m: any) => m.id !== machineId),
    });
  };

  const filteredMachines = allMachines.filter(m => {
    if (selectedMachines.some((sm: any) => sm.id === m.id)) return false;
    if (!searchTerm) return true;
    const lower = searchTerm.toLowerCase();
    return m.name?.toLowerCase().includes(lower) ||
           m.nickname?.toLowerCase().includes(lower) ||
           m.assetCode?.toLowerCase().includes(lower);
  });

  return (
    <div className="space-y-3 pt-2 border-t border-gray-100">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Cog className="h-4 w-4" />
        <span className="font-medium">Configuración de máquinas</span>
        {workCenterId && (
          <span className="text-xs text-gray-400">(filtrado por centro de trabajo)</span>
        )}
      </div>

      {/* Warning if no work center selected */}
      {!workCenterId && (
        <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded flex items-center gap-2">
          <AlertCircle className="h-3 w-3" />
          Seleccioná un centro de trabajo arriba para filtrar las máquinas del sector.
        </p>
      )}

      {/* Selected machines */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500">Máquinas disponibles para seleccionar:</p>
        {selectedMachines.length === 0 ? (
          <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
            No hay máquinas seleccionadas. Agregá al menos una.
          </p>
        ) : (
          <div className="space-y-1">
            {selectedMachines.map((machine: any) => (
              <div
                key={machine.id}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg group"
              >
                <div className="flex items-center gap-2">
                  <Cog className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium">{machine.nickname || machine.name}</span>
                  {machine.assetCode && (
                    <span className="text-xs text-gray-400 font-mono">{machine.assetCode}</span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={() => removeMachine(machine.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add machine selector */}
        <div className="relative">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar máquina para agregar..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSelector(true);
              }}
              onFocus={() => setShowSelector(true)}
              className="h-8 text-sm flex-1"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          </div>

          {/* Dropdown with available machines */}
          {showSelector && !loading && filteredMachines.length > 0 && (
            <div className="absolute z-20 left-0 right-0 top-9 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredMachines.slice(0, 10).map((machine) => (
                <button
                  key={machine.id}
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                  onClick={() => {
                    addMachine(machine);
                    setShowSelector(false);
                  }}
                >
                  <Cog className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">{machine.displayName || machine.name}</span>
                  {machine.assetCode && (
                    <span className="text-xs text-gray-400 font-mono ml-auto">{machine.assetCode}</span>
                  )}
                </button>
              ))}
              {filteredMachines.length > 10 && (
                <p className="px-3 py-2 text-xs text-gray-400">
                  +{filteredMachines.length - 10} más...
                </p>
              )}
            </div>
          )}
        </div>

        {/* Click outside to close */}
        {showSelector && (
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowSelector(false)}
          />
        )}
      </div>

      {/* Options */}
      <div className="space-y-2 pt-2 border-t border-dashed">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-gray-500">Permitir selección múltiple</Label>
          <Switch
            checked={config.allowMultiple || false}
            onCheckedChange={(checked) => updateConfig({ allowMultiple: checked })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs text-gray-500">Pedir lectura de horómetro</Label>
          <Switch
            checked={config.requireCounterReading || false}
            onCheckedChange={(checked) => updateConfig({ requireCounterReading: checked })}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SECTION NAVIGATOR - Tabs/swipe navigation for sections
// ============================================================================

interface SectionNavigatorProps {
  form: any;
  activeSectionId: string | null;
  onSectionChange: (sectionId: string | null) => void;
  onAddSection: () => void;
  onEditSection: (section: { id: string; name: string; description?: string }) => void;
}

function SectionNavigator({ form, activeSectionId, onSectionChange, onAddSection, onEditSection }: SectionNavigatorProps) {
  const sections = form.watch('sections') || [];
  const items = form.watch('items') || [];

  // Count items per section
  const getItemCount = (sectionId: string | null) => {
    if (sectionId === null) {
      return items.filter((item: any) => !item.sectionId).length;
    }
    return items.filter((item: any) => item.sectionId === sectionId).length;
  };

  const handleDeleteSection = (sectionId: string) => {
    if (!confirm('¿Eliminar esta sección? Las preguntas quedarán sin sección.')) return;
    // Remove sectionId from items in this section
    const currentItems = form.getValues('items') || [];
    currentItems.forEach((item: any, idx: number) => {
      if (item.sectionId === sectionId) {
        form.setValue(`items.${idx}.sectionId`, undefined);
      }
    });
    // Remove section
    const newSections = sections.filter((s: any) => s.id !== sectionId);
    form.setValue('sections', newSections);
    if (activeSectionId === sectionId) {
      onSectionChange(null);
    }
  };

  if (sections.length === 0) {
    return (
      <div className="flex items-center gap-2 mb-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 text-gray-500"
          onClick={onAddSection}
        >
          <Layers className="h-4 w-4" />
          Agregar sección
        </Button>
        <span className="text-xs text-gray-400">
          Organiza las preguntas en secciones para mejor navegación
        </span>
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-2">
      {/* Section tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {/* "All" / "Sin sección" tab */}
        <button
          type="button"
          onClick={() => onSectionChange(null)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
            activeSectionId === null
              ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
          )}
        >
          <FolderOpen className="h-4 w-4" />
          Sin sección
          <span className="text-xs bg-white/50 px-1.5 py-0.5 rounded">
            {getItemCount(null)}
          </span>
        </button>

        {/* Section tabs */}
        {sections.map((section: any) => (
          <div
            key={section.id}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors group relative',
              activeSectionId === section.id
                ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
            )}
          >
            <button
              type="button"
              onClick={() => onSectionChange(section.id)}
              className="flex items-center gap-2"
            >
              <Layers className="h-4 w-4" />
              {section.name}
              <span className="text-xs bg-white/50 px-1.5 py-0.5 rounded">
                {getItemCount(section.id)}
              </span>
            </button>
            {/* Edit/Delete buttons on hover */}
            <div className="hidden group-hover:flex items-center gap-1 ml-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditSection(section);
                }}
              >
                <span className="text-xs">✏️</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSection(section.id);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}

        {/* Add section button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 text-gray-400 hover:text-gray-600"
          onClick={onAddSection}
        >
          <Plus className="h-4 w-4" />
          Nueva
        </Button>
      </div>

      {/* Navigation arrows for mobile */}
      <div className="flex items-center justify-between md:hidden">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={activeSectionId === null}
          onClick={() => {
            const currentIdx = sections.findIndex((s: any) => s.id === activeSectionId);
            if (currentIdx <= 0) {
              onSectionChange(null);
            } else {
              onSectionChange(sections[currentIdx - 1].id);
            }
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Anterior
        </Button>
        <span className="text-sm text-gray-500">
          {activeSectionId === null
            ? 'Sin sección'
            : sections.find((s: any) => s.id === activeSectionId)?.name || ''}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={activeSectionId === sections[sections.length - 1]?.id}
          onClick={() => {
            if (activeSectionId === null && sections.length > 0) {
              onSectionChange(sections[0].id);
            } else {
              const currentIdx = sections.findIndex((s: any) => s.id === activeSectionId);
              if (currentIdx < sections.length - 1) {
                onSectionChange(sections[currentIdx + 1].id);
              }
            }
          }}
        >
          Siguiente
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// VALIDATION HELPER
// ============================================================================

interface ValidationResult {
  isValid: boolean;
  warnings: string[];
}

function validateQuestionItem(item: {
  question?: string;
  type?: string;
  options?: { id: string; text: string }[];
  unit?: string;
  resourceTypeCode?: string;
  materialConfig?: { materials?: { name: string }[] };
}): ValidationResult {
  const warnings: string[] = [];

  // Empty question
  if (!item.question || item.question.trim() === '') {
    warnings.push('Falta la pregunta');
  }

  // SELECT/CHECKBOX without options or empty options
  if (item.type === 'SELECT' || item.type === 'CHECKBOX') {
    if (!item.options || item.options.length === 0) {
      warnings.push('Faltan opciones');
    } else if (item.options.some(o => !o.text || o.text.trim() === '')) {
      warnings.push('Hay opciones vacías');
    }
  }

  // VALUE without unit
  if (item.type === 'VALUE' && (!item.unit || item.unit.trim() === '')) {
    warnings.push('Falta la unidad');
  }

  // RESOURCE types without resource type code
  if ((item.type === 'RESOURCE_MULTI_SELECT' || item.type === 'RESOURCE_SEQUENCE_SELECT') && !item.resourceTypeCode) {
    warnings.push('Falta tipo de recurso');
  }

  // MATERIAL_INPUT without materials defined
  if (item.type === 'MATERIAL_INPUT') {
    if (!item.materialConfig?.materials || item.materialConfig.materials.length === 0) {
      warnings.push('Faltan materiales');
    } else if (item.materialConfig.materials.some(m => !m.name || m.name.trim() === '')) {
      warnings.push('Hay materiales sin nombre');
    }
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}

// ============================================================================
// SORTABLE QUESTION CARD WRAPPER
// ============================================================================

interface SortableQuestionCardWrapperProps {
  id: string;
  children: React.ReactNode;
}

function SortableQuestionCardWrapper({ id, children }: SortableQuestionCardWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group/sortable">
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover/sortable:opacity-100 transition-opacity z-10"
      >
        <GripVertical className="h-5 w-5 text-gray-400" />
      </div>
      <div className="pl-6">
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// GOOGLE FORMS STYLE QUESTION CARD
// ============================================================================

// ============================================================================
// REUSABLE BLOCKS - Save and insert question templates
// ============================================================================

const BLOCKS_STORAGE_KEY = 'routine_template_blocks';

interface SavedBlock {
  id: string;
  name: string;
  description?: string;
  item: ItemType;
  createdAt: string;
}

function getSavedBlocks(): SavedBlock[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(BLOCKS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveBlock(block: SavedBlock) {
  const blocks = getSavedBlocks();
  blocks.unshift(block);
  localStorage.setItem(BLOCKS_STORAGE_KEY, JSON.stringify(blocks.slice(0, 50))); // Max 50 blocks
}

function deleteBlock(blockId: string) {
  const blocks = getSavedBlocks().filter(b => b.id !== blockId);
  localStorage.setItem(BLOCKS_STORAGE_KEY, JSON.stringify(blocks));
}

// ============================================================================
// ADDITIONAL INPUTS SECTION - Multi-input support
// ============================================================================

const QUICK_ADD_INPUTS = [
  { type: 'PHOTO', label: 'Foto', icon: Camera, defaultLabel: 'Foto de evidencia' },
  { type: 'TEXT', label: 'Texto', icon: FileText, defaultLabel: 'Observaciones' },
  { type: 'VALUE', label: 'Valor', icon: Hash, defaultLabel: 'Medición' },
  { type: 'CHECK', label: 'Sí/No', icon: CheckSquare, defaultLabel: 'Verificación' },
  { type: 'SELECT', label: 'Opciones', icon: Circle, defaultLabel: 'Selección' },
  { type: 'SIGNATURE', label: 'Firma', icon: PenTool, defaultLabel: 'Firma' },
] as const;

function AdditionalInputsSection({ index, form }: { index: number; form: any }) {
  const additionalInputs = form.watch(`items.${index}.additionalInputs`) || [];
  const [showAddMenu, setShowAddMenu] = useState(false);

  const addInput = (type: string, defaultLabel: string) => {
    const newInput = {
      id: `input_${Math.random().toString(36).substr(2, 9)}`,
      type,
      label: defaultLabel,
      required: false,
      options: (type === 'SELECT' || type === 'CHECKBOX')
        ? [{ id: `opt_${Math.random().toString(36).substr(2, 6)}`, text: 'Opción 1' }]
        : undefined,
      unit: type === 'VALUE' ? '' : undefined,
      ratingMax: type === 'RATING' ? 5 : undefined,
    };
    form.setValue(`items.${index}.additionalInputs`, [...additionalInputs, newInput]);
    setShowAddMenu(false);
  };

  const removeInput = (inputIndex: number) => {
    const updated = additionalInputs.filter((_: any, i: number) => i !== inputIndex);
    form.setValue(`items.${index}.additionalInputs`, updated);
  };

  const updateInput = (inputIndex: number, field: string, value: any) => {
    const updated = [...additionalInputs];
    updated[inputIndex] = { ...updated[inputIndex], [field]: value };
    form.setValue(`items.${index}.additionalInputs`, updated);
  };

  const addOption = (inputIndex: number) => {
    const input = additionalInputs[inputIndex];
    const newOptions = [...(input.options || []), {
      id: `opt_${Math.random().toString(36).substr(2, 6)}`,
      text: `Opción ${(input.options?.length || 0) + 1}`
    }];
    updateInput(inputIndex, 'options', newOptions);
  };

  const updateOption = (inputIndex: number, optIndex: number, text: string) => {
    const input = additionalInputs[inputIndex];
    const newOptions = [...(input.options || [])];
    newOptions[optIndex] = { ...newOptions[optIndex], text };
    updateInput(inputIndex, 'options', newOptions);
  };

  const removeOption = (inputIndex: number, optIndex: number) => {
    const input = additionalInputs[inputIndex];
    if ((input.options?.length || 0) > 1) {
      const newOptions = input.options.filter((_: any, i: number) => i !== optIndex);
      updateInput(inputIndex, 'options', newOptions);
    }
  };

  const moveInput = (inputIndex: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? inputIndex - 1 : inputIndex + 1;
    if (newIndex < 0 || newIndex >= additionalInputs.length) return;
    const updated = [...additionalInputs];
    [updated[inputIndex], updated[newIndex]] = [updated[newIndex], updated[inputIndex]];
    form.setValue(`items.${index}.additionalInputs`, updated);
  };

  return (
    <div className="mx-6 mt-2 mb-2">
      {/* Existing additional inputs */}
      {additionalInputs.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Respuestas adicionales
          </p>
          {additionalInputs.map((input: any, inputIndex: number) => {
            const typeInfo = QUICK_ADD_INPUTS.find(t => t.type === input.type);
            const TypeIcon = typeInfo?.icon || CheckSquare;
            return (
              <div
                key={input.id}
                className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100 group"
              >
                <div className="h-7 w-7 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <TypeIcon className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <Input
                    value={input.label || ''}
                    onChange={(e) => updateInput(inputIndex, 'label', e.target.value)}
                    placeholder="Etiqueta..."
                    className="h-7 text-sm border-blue-200 bg-white"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {/* Type-specific config */}
                  {input.type === 'VALUE' && (
                    <div className="flex gap-2 items-center">
                      <Input
                        value={input.unit || ''}
                        onChange={(e) => updateInput(inputIndex, 'unit', e.target.value)}
                        placeholder="Unidad (°C, kg, %)"
                        className="h-6 text-xs w-24"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Input
                        type="number"
                        value={input.minValue ?? ''}
                        onChange={(e) => updateInput(inputIndex, 'minValue', e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="Mín"
                        className="h-6 text-xs w-16"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-gray-400 text-xs">-</span>
                      <Input
                        type="number"
                        value={input.maxValue ?? ''}
                        onChange={(e) => updateInput(inputIndex, 'maxValue', e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="Máx"
                        className="h-6 text-xs w-16"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                  {(input.type === 'SELECT' || input.type === 'CHECKBOX') && (
                    <div className="space-y-1">
                      {(input.options || []).map((opt: any, optIndex: number) => (
                        <div key={opt.id} className="flex items-center gap-1 group/opt">
                          {input.type === 'SELECT' ? (
                            <Circle className="h-3 w-3 text-gray-400" />
                          ) : (
                            <Square className="h-3 w-3 text-gray-400" />
                          )}
                          <Input
                            value={opt.text}
                            onChange={(e) => updateOption(inputIndex, optIndex, e.target.value)}
                            className="h-6 text-xs flex-1"
                            onClick={(e) => e.stopPropagation()}
                          />
                          {(input.options?.length || 0) > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover/opt:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeOption(inputIndex, optIndex);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:text-blue-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          addOption(inputIndex);
                        }}
                      >
                        + Agregar opción
                      </button>
                    </div>
                  )}
                  {/* Required toggle and display mode for SELECT */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={input.required || false}
                        onCheckedChange={(checked) => updateInput(inputIndex, 'required', checked)}
                        className="scale-75"
                      />
                      <span className="text-xs text-gray-500">Obligatorio</span>
                    </div>
                    {input.type === 'SELECT' && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">Mostrar:</span>
                        <select
                          value={input.selectDisplayMode || 'list'}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateInput(inputIndex, 'selectDisplayMode', e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs border rounded px-1 py-0.5 bg-white"
                        >
                          <option value="list">Lista</option>
                          <option value="dropdown">Desplegable</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
                {/* Move and delete buttons */}
                <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-gray-400 hover:text-blue-600 disabled:opacity-30"
                    disabled={inputIndex === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveInput(inputIndex, 'up');
                    }}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-gray-400 hover:text-blue-600 disabled:opacity-30"
                    disabled={inputIndex === additionalInputs.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveInput(inputIndex, 'down');
                    }}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeInput(inputIndex);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add input button */}
      <div className="relative">
        <button
          type="button"
          className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
          onClick={(e) => {
            e.stopPropagation();
            setShowAddMenu(!showAddMenu);
          }}
        >
          <Plus className="h-3 w-3" />
          Agregar respuesta adicional
        </button>

        {showAddMenu && (
          <div
            className="absolute left-0 top-6 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[180px]"
            onClick={(e) => e.stopPropagation()}
          >
            {QUICK_ADD_INPUTS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.type}
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => addInput(item.type, item.defaultLabel)}
                >
                  <Icon className="h-4 w-4 text-gray-500" />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface QuestionCardProps {
  index: number;
  form: any;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  canRemove: boolean;
  resourceTypes: { id: number; code: string; name: string }[];
  allItems: { id: string; question: string; type: string; options?: { id: string; text: string }[] }[];
  validation: ValidationResult;
  sections: { id: string; name: string }[];
  onMoveToSection: (sectionId: string | undefined) => void;
}

function QuestionCard({
  index,
  form,
  isSelected,
  onSelect,
  onRemove,
  onDuplicate,
  canRemove,
  resourceTypes,
  allItems,
  validation,
  sections,
  onMoveToSection,
}: QuestionCardProps) {
  const type = form.watch(`items.${index}.type`) as ItemType['type'];
  const options = form.watch(`items.${index}.options`) || [];
  const conditionalDisplay = form.watch(`items.${index}.conditionalDisplay`);
  const employeeConfig = form.watch(`items.${index}.employeeConfig`);
  const isDisabled = form.watch(`items.${index}.disabled`) || false;
  const currentSectionId = form.watch(`items.${index}.sectionId`);
  const typeInfo = QUESTION_TYPES.find(t => t.value === type) || QUESTION_TYPES[0];
  const TypeIcon = typeInfo.icon;
  const hasWarnings = !validation.isValid;

  const toggleDisabled = () => {
    form.setValue(`items.${index}.disabled`, !isDisabled);
  };

  // Items that can be parents (only previous items that are CHECK or SELECT)
  const possibleParents = allItems
    .slice(0, index)
    .filter(item => item.type === 'CHECK' || item.type === 'SELECT');

  // Get possible values for the selected parent
  const getParentValues = (parentId: string): string[] => {
    const parent = allItems.find(item => item.id === parentId);
    if (!parent) return [];
    if (parent.type === 'CHECK') return ['Sí', 'No'];
    if (parent.type === 'SELECT' && parent.options) return parent.options.map(o => o.text);
    return [];
  };

  const handleToggleConditional = () => {
    if (conditionalDisplay) {
      form.setValue(`items.${index}.conditionalDisplay`, undefined);
    } else if (possibleParents.length > 0) {
      const firstParent = possibleParents[0];
      const values = getParentValues(firstParent.id);
      form.setValue(`items.${index}.conditionalDisplay`, {
        parentItemId: firstParent.id,
        parentValue: values[0] || 'Sí',
      });
    }
  };

  const addOption = () => {
    const newOptions = [...options, { id: generateOptionId(), text: `Opción ${options.length + 1}` }];
    form.setValue(`items.${index}.options`, newOptions);
  };

  const removeOption = (optionIndex: number) => {
    if (options.length > 1) {
      const newOptions = options.filter((_: any, i: number) => i !== optionIndex);
      form.setValue(`items.${index}.options`, newOptions);
    }
  };

  const updateOption = (optionIndex: number, text: string) => {
    const newOptions = [...options];
    newOptions[optionIndex] = { ...newOptions[optionIndex], text };
    form.setValue(`items.${index}.options`, newOptions);
  };

  // When type changes, ensure type-specific configs exist
  const handleTypeChange = (newType: string) => {
    form.setValue(`items.${index}.type`, newType);
    if ((newType === 'SELECT' || newType === 'CHECKBOX') && (!options || options.length === 0)) {
      form.setValue(`items.${index}.options`, [{ id: generateOptionId(), text: 'Opción 1' }]);
    }
    if (newType === 'RATING') {
      form.setValue(`items.${index}.ratingMax`, 5);
    }
    if (newType === 'MACHINE_SELECT') {
      const currentConfig = form.getValues(`items.${index}.machineConfig`);
      if (!currentConfig) {
        form.setValue(`items.${index}.machineConfig`, {
          allowMultiple: false,
          requireCounterReading: false,
          selectedMachines: [],
        });
      }
    }
    if (newType === 'MATERIAL_INPUT') {
      const currentConfig = form.getValues(`items.${index}.materialConfig`);
      if (!currentConfig) {
        form.setValue(`items.${index}.materialConfig`, {
          materials: [],
          trackingMode: 'PER_SHIFT',
          allowAddMaterial: false,
          sourceMode: 'MANUAL',
        });
      }
    }
  };

  return (
    <div
      onClick={onSelect}
      className={cn(
        "bg-white rounded-lg border shadow-sm transition-all cursor-pointer relative",
        isSelected
          ? "border-l-4 border-l-blue-500 border-t-gray-200 border-r-gray-200 border-b-gray-200 shadow-md"
          : hasWarnings
            ? "border-l-4 border-l-amber-400 border-t-gray-200 border-r-gray-200 border-b-gray-200"
            : "border-gray-200 hover:shadow-md",
        isDisabled && "opacity-50 bg-gray-50"
      )}
    >
      {/* Disabled indicator */}
      {isDisabled && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-gray-200 text-gray-500 rounded-full px-2 py-0.5 text-xs">
          <EyeOff className="h-3 w-3" />
          Deshabilitada
        </div>
      )}
      {/* Validation warning indicator */}
      {hasWarnings && !isDisabled && (
        <div className="absolute -top-2 -right-2 z-10">
          <div className="relative group">
            <div className="h-6 w-6 rounded-full bg-amber-400 flex items-center justify-center shadow-sm">
              <AlertCircle className="h-4 w-4 text-white" />
            </div>
            <div className="absolute right-0 top-8 hidden group-hover:block z-20">
              <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 min-w-[150px] shadow-lg">
                <p className="font-semibold mb-1">Completar:</p>
                <ul className="space-y-0.5">
                  {validation.warnings.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="p-6 space-y-4">
        {/* Header: Question + Type dropdown */}
        <div className="flex items-start gap-4">
          {/* Question input - Google Forms style */}
          <FormField
            control={form.control}
            name={`items.${index}.question`}
            render={({ field }) => (
              <Input
                {...field}
                placeholder="Pregunta"
                className={cn(
                  "flex-1 text-base border-0 border-b rounded-none px-0 h-auto py-2 bg-transparent",
                  "focus-visible:ring-0 focus-visible:border-b-2 focus-visible:border-blue-500",
                  "placeholder:text-gray-400",
                  isSelected ? "border-b-gray-300" : "border-b-transparent"
                )}
              />
            )}
          />

          {/* Type dropdown - Google Forms style */}
          <Select value={type} onValueChange={handleTypeChange}>
            <SelectTrigger className="w-[200px] h-12 border-gray-200 bg-transparent hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <TypeIcon className="h-5 w-5 text-gray-600" />
                <span className="text-sm">{typeInfo.label}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {QUESTION_TYPES.map(t => {
                const Icon = t.icon;
                return (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-gray-600" />
                      <span>{t.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Type-specific content - Google Forms style */}
        <div className="mt-4">
          {/* CHECK type - shows Sí/No preview */}
          {type === 'CHECK' && (
            <div className="space-y-2 text-gray-400 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                <span>Sí</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                <span>No</span>
              </div>
            </div>
          )}

          {/* TEXT type - shows short answer placeholder */}
          {type === 'TEXT' && (
            <div className="border-b border-gray-300 border-dotted pb-2 text-gray-400 text-sm">
              Texto de respuesta corta
            </div>
          )}

          {/* DATE type */}
          {type === 'DATE' && (
            <div className="flex items-center gap-3 text-gray-400 text-sm border-b border-gray-300 border-dotted pb-2">
              <Calendar className="h-5 w-5" />
              <span>Día / Mes / Año</span>
            </div>
          )}

          {/* TIME type */}
          {type === 'TIME' && (
            <div className="flex items-center gap-3 text-gray-400 text-sm border-b border-gray-300 border-dotted pb-2">
              <Clock className="h-5 w-5" />
              <span>Hora : Minutos</span>
            </div>
          )}

          {/* SIGNATURE type */}
          {type === 'SIGNATURE' && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-400">
              <PenTool className="h-8 w-8 mx-auto mb-2" />
              <span className="text-sm">Firmar aquí</span>
            </div>
          )}

          {/* RATING type */}
          {type === 'RATING' && (
            <div className="space-y-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star key={star} className="h-6 w-6 text-gray-300" />
                ))}
              </div>
              {isSelected && (
                <div className="flex items-center gap-3 pt-2">
                  <span className="text-sm text-gray-500">Escala del 1 al</span>
                  <FormField
                    control={form.control}
                    name={`items.${index}.ratingMax`}
                    render={({ field }) => (
                      <Select
                        value={String(field.value || 5)}
                        onValueChange={val => field.onChange(parseInt(val))}
                      >
                        <SelectTrigger className="w-20 h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3</SelectItem>
                          <SelectItem value="5">5</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )}
            </div>
          )}

          {/* VALUE type - shows number input preview */}
          {type === 'VALUE' && (
            <div className="space-y-3">
              <div className="border-b border-gray-300 border-dotted pb-2 text-gray-400 text-sm">
                Valor numérico
              </div>
              {isSelected && (
                <div className="flex items-center gap-3 pt-2">
                  <FormField
                    control={form.control}
                    name={`items.${index}.unit`}
                    render={({ field }) => (
                      <Input
                        {...field}
                        value={field.value || ''}
                        placeholder="Unidad (ej: °C, kg, %)"
                        className="w-32 h-8 text-sm"
                      />
                    )}
                  />
                  <span className="text-sm text-gray-500">Rango:</span>
                  <FormField
                    control={form.control}
                    name={`items.${index}.minValue`}
                    render={({ field }) => (
                      <Input
                        type="number"
                        placeholder="Mín"
                        className="w-20 h-8 text-sm"
                        value={field.value ?? ''}
                        onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                      />
                    )}
                  />
                  <span className="text-gray-400">-</span>
                  <FormField
                    control={form.control}
                    name={`items.${index}.maxValue`}
                    render={({ field }) => (
                      <Input
                        type="number"
                        placeholder="Máx"
                        className="w-20 h-8 text-sm"
                        value={field.value ?? ''}
                        onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                      />
                    )}
                  />
                </div>
              )}
            </div>
          )}

          {/* PHOTO type - shows file upload preview */}
          {type === 'PHOTO' && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-400">
              <Camera className="h-8 w-8 mx-auto mb-2" />
              <span className="text-sm">Subir foto</span>
            </div>
          )}

          {/* SELECT type - Google Forms radio options style */}
          {type === 'SELECT' && (
            <div className="space-y-2">
              {options.map((option: any, optionIndex: number) => (
                <div key={option.id} className="flex items-center gap-3 group">
                  <Circle className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <Input
                    value={option.text}
                    onChange={(e) => updateOption(optionIndex, e.target.value)}
                    placeholder={`Opción ${optionIndex + 1}`}
                    className="flex-1 border-0 border-b border-transparent focus-visible:border-gray-300 rounded-none px-0 h-8 focus-visible:ring-0"
                  />
                  {options.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeOption(optionIndex)}
                    >
                      <X className="h-4 w-4 text-gray-400" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-3 text-gray-400">
                <Circle className="h-5 w-5" />
                <button
                  type="button"
                  onClick={addOption}
                  className="text-sm hover:text-gray-600 border-b border-transparent hover:border-gray-300 pb-1"
                >
                  Agregar opción
                </button>
              </div>
            </div>
          )}

          {/* CHECKBOX type - Google Forms checkbox style */}
          {type === 'CHECKBOX' && (
            <div className="space-y-2">
              {options.map((option: any, optionIndex: number) => (
                <div key={option.id} className="flex items-center gap-3 group">
                  <Square className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <Input
                    value={option.text}
                    onChange={(e) => updateOption(optionIndex, e.target.value)}
                    placeholder={`Opción ${optionIndex + 1}`}
                    className="flex-1 border-0 border-b border-transparent focus-visible:border-gray-300 rounded-none px-0 h-8 focus-visible:ring-0"
                  />
                  {options.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeOption(optionIndex)}
                    >
                      <X className="h-4 w-4 text-gray-400" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-3 text-gray-400">
                <Square className="h-5 w-5" />
                <button
                  type="button"
                  onClick={addOption}
                  className="text-sm hover:text-gray-600 border-b border-transparent hover:border-gray-300 pb-1"
                >
                  Agregar opción
                </button>
              </div>
            </div>
          )}

          {/* Resource types - dropdown style preview */}
          {(type === 'RESOURCE_MULTI_SELECT' || type === 'RESOURCE_SEQUENCE_SELECT') && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <ChevronDown className="h-4 w-4" />
                <span>Seleccionar recursos...</span>
              </div>
              {isSelected && (
                <FormField
                  control={form.control}
                  name={`items.${index}.resourceTypeCode`}
                  render={({ field }) => (
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <SelectTrigger className="w-[250px] h-9 text-sm">
                        <SelectValue placeholder="Seleccionar tipo de recurso" />
                      </SelectTrigger>
                      <SelectContent>
                        {resourceTypes.map(rt => (
                          <SelectItem key={rt.code} value={rt.code}>{rt.name}</SelectItem>
                        ))}
                        {resourceTypes.length === 0 && (
                          <SelectItem value="_none" disabled>No hay tipos configurados</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </div>
          )}

          {/* Employee select - config */}
          {type === 'EMPLOYEE_SELECT' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Users className="h-5 w-5" />
                <span>Seleccionar empleados...</span>
              </div>
              {isSelected && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  {/* Work sector assignment toggle */}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-gray-600">Asignar puesto de trabajo</Label>
                    <Switch
                      checked={employeeConfig?.workSectorAssignment || false}
                      onCheckedChange={(checked) => {
                        form.setValue(`items.${index}.employeeConfig`, {
                          ...employeeConfig,
                          workSectorAssignment: checked,
                          taskAssignment: employeeConfig?.taskAssignment || false,
                          taskOptions: employeeConfig?.taskOptions || [],
                        });
                      }}
                    />
                  </div>

                  {/* Task assignment toggle + options */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-gray-600">Asignar tareas/roles</Label>
                      <Switch
                        checked={employeeConfig?.taskAssignment || false}
                        onCheckedChange={(checked) => {
                          form.setValue(`items.${index}.employeeConfig`, {
                            ...employeeConfig,
                            taskAssignment: checked,
                            workSectorAssignment: employeeConfig?.workSectorAssignment || false,
                            taskOptions: checked && (!employeeConfig?.taskOptions || employeeConfig.taskOptions.length === 0)
                              ? [{ id: `task_${Date.now()}`, label: 'Tarea 1' }]
                              : employeeConfig?.taskOptions || [],
                          });
                        }}
                      />
                    </div>
                    {employeeConfig?.taskAssignment && (
                      <div className="ml-2 space-y-2">
                        <p className="text-xs text-gray-500">Opciones que el operador puede asignar a cada empleado:</p>
                        {(employeeConfig.taskOptions || []).map((task: any, taskIdx: number) => (
                          <div key={task.id} className="flex items-center gap-2 group">
                            <Square className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            <Input
                              value={task.label}
                              onChange={(e) => {
                                const updated = [...(employeeConfig.taskOptions || [])];
                                updated[taskIdx] = { ...updated[taskIdx], label: e.target.value };
                                form.setValue(`items.${index}.employeeConfig`, {
                                  ...employeeConfig,
                                  taskOptions: updated,
                                });
                              }}
                              placeholder={`Opción ${taskIdx + 1}`}
                              className="flex-1 h-8 text-sm border-0 border-b border-transparent focus-visible:border-gray-300 rounded-none px-0 focus-visible:ring-0"
                            />
                            {(employeeConfig.taskOptions || []).length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  const updated = (employeeConfig.taskOptions || []).filter((_: any, i: number) => i !== taskIdx);
                                  form.setValue(`items.${index}.employeeConfig`, {
                                    ...employeeConfig,
                                    taskOptions: updated,
                                  });
                                }}
                              >
                                <X className="h-3 w-3 text-gray-400" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...(employeeConfig.taskOptions || []), { id: `task_${Date.now()}`, label: `Opción ${(employeeConfig.taskOptions || []).length + 1}` }];
                            form.setValue(`items.${index}.employeeConfig`, {
                              ...employeeConfig,
                              taskOptions: updated,
                            });
                          }}
                          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600"
                        >
                          <Square className="h-4 w-4" />
                          Agregar opción
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Attendance tracking toggle */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-gray-600">Seguimiento de asistencia</Label>
                      <Switch
                        checked={employeeConfig?.attendanceTracking || false}
                        onCheckedChange={(checked) => {
                          form.setValue(`items.${index}.employeeConfig`, {
                            ...employeeConfig,
                            attendanceTracking: checked,
                            taskAssignment: employeeConfig?.taskAssignment || false,
                            taskOptions: employeeConfig?.taskOptions || [],
                            workSectorAssignment: employeeConfig?.workSectorAssignment || false,
                            allowSectorTransfer: checked ? (employeeConfig?.allowSectorTransfer || false) : false,
                            absenceReasons: checked ? (employeeConfig?.absenceReasons || [
                              { id: 'carpeta_medica', label: 'Carpeta Médica', payrollEventType: 'SICK_LEAVE' },
                              { id: 'accidente_trabajo', label: 'Accidente de Trabajo', payrollEventType: 'ACCIDENT' },
                              { id: 'falta_con_permiso', label: 'Falta con Permiso', payrollEventType: 'ABSENCE' },
                              { id: 'falta_sin_aviso', label: 'Falta sin Aviso', payrollEventType: 'ABSENCE' },
                              { id: 'vacaciones', label: 'Vacaciones', payrollEventType: 'VACATION' },
                              { id: 'suspension', label: 'Suspensión', payrollEventType: 'SUSPENSION' },
                            ]) : undefined,
                          });
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-400">Todos los empleados aparecen pre-cargados. El supervisor marca ausencias y transferencias.</p>
                    {employeeConfig?.attendanceTracking && (
                      <div className="ml-2 space-y-2">
                        <p className="text-xs text-gray-500">Motivos de ausencia:</p>
                        {(employeeConfig.absenceReasons || []).map((reason: any, rIdx: number) => (
                          <div key={reason.id} className="flex items-center gap-2 group">
                            <span className="text-xs text-red-400 w-4 text-center">{rIdx + 1}</span>
                            <Input
                              value={reason.label}
                              onChange={(e) => {
                                const updated = [...(employeeConfig.absenceReasons || [])];
                                updated[rIdx] = { ...updated[rIdx], label: e.target.value };
                                form.setValue(`items.${index}.employeeConfig`, {
                                  ...employeeConfig,
                                  absenceReasons: updated,
                                });
                              }}
                              placeholder={`Motivo ${rIdx + 1}`}
                              className="flex-1 h-8 text-sm border-0 border-b border-transparent focus-visible:border-gray-300 rounded-none px-0 focus-visible:ring-0"
                            />
                            {(employeeConfig.absenceReasons || []).length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  const updated = (employeeConfig.absenceReasons || []).filter((_: any, i: number) => i !== rIdx);
                                  form.setValue(`items.${index}.employeeConfig`, {
                                    ...employeeConfig,
                                    absenceReasons: updated,
                                  });
                                }}
                              >
                                <X className="h-3 w-3 text-gray-400" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...(employeeConfig.absenceReasons || []), { id: `reason_${Date.now()}`, label: '', payrollEventType: 'ABSENCE' }];
                            form.setValue(`items.${index}.employeeConfig`, {
                              ...employeeConfig,
                              absenceReasons: updated,
                            });
                          }}
                          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600"
                        >
                          <Plus className="h-4 w-4" />
                          Agregar motivo
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Sector transfer toggle */}
                  {employeeConfig?.attendanceTracking && (
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-gray-600">Permitir transferencia a otro sector</Label>
                      <Switch
                        checked={employeeConfig?.allowSectorTransfer || false}
                        onCheckedChange={(checked) => {
                          form.setValue(`items.${index}.employeeConfig`, {
                            ...employeeConfig,
                            allowSectorTransfer: checked,
                          });
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MATERIAL_INPUT type configuration */}
          {type === 'MATERIAL_INPUT' && (
            <MaterialConfigEditor
              index={index}
              form={form}
            />
          )}

          {/* MACHINE_SELECT type - machine selection config */}
          {type === 'MACHINE_SELECT' && (
            <MachineConfigEditor index={index} form={form} />
          )}

          {/* PHOTO type - timer config */}
          {type === 'PHOTO' && isSelected && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-gray-600 flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Recordatorio después de foto
                </Label>
                <Switch
                  checked={!!form.watch(`items.${index}.photoTimerConfig`)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      form.setValue(`items.${index}.photoTimerConfig`, {
                        delayMinutes: 30,
                        reminderMessage: '',
                      });
                    } else {
                      form.setValue(`items.${index}.photoTimerConfig`, undefined as any);
                    }
                  }}
                />
              </div>
              {form.watch(`items.${index}.photoTimerConfig`) && (
                <div className="ml-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Notificar en</span>
                    <Input
                      type="number"
                      min={1}
                      value={form.watch(`items.${index}.photoTimerConfig.delayMinutes`) || 30}
                      onChange={(e) => {
                        form.setValue(`items.${index}.photoTimerConfig.delayMinutes`, parseInt(e.target.value) || 30);
                      }}
                      className="w-20 h-8 text-sm text-center"
                    />
                    <span className="text-xs text-gray-500">minutos</span>
                  </div>
                  <Input
                    placeholder="Mensaje personalizado (opcional)"
                    value={form.watch(`items.${index}.photoTimerConfig.reminderMessage`) || ''}
                    onChange={(e) => {
                      form.setValue(`items.${index}.photoTimerConfig.reminderMessage`, e.target.value);
                    }}
                    className="h-8 text-sm"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Additional inputs section - Multi-input support */}
      {isSelected && (
        <AdditionalInputsSection index={index} form={form} />
      )}

      {/* Conditional display banner */}
      {conditionalDisplay && (
        <div className="mx-6 mt-0 mb-0 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 flex-wrap">
            <GitBranch className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-xs font-medium text-amber-800">Mostrar solo si</span>
            <select
              className="text-xs border border-amber-300 rounded px-2 py-1 bg-white text-amber-900 max-w-[200px]"
              value={conditionalDisplay.parentItemId}
              onChange={(e) => {
                const newParentId = e.target.value;
                const values = getParentValues(newParentId);
                form.setValue(`items.${index}.conditionalDisplay`, {
                  parentItemId: newParentId,
                  parentValue: values[0] || 'Sí',
                });
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {possibleParents.map(p => (
                <option key={p.id} value={p.id}>
                  {p.question || '(sin pregunta)'}
                </option>
              ))}
            </select>
            <span className="text-xs text-amber-700">=</span>
            <select
              className="text-xs border border-amber-300 rounded px-2 py-1 bg-white text-amber-900"
              value={conditionalDisplay.parentValue}
              onChange={(e) => {
                form.setValue(`items.${index}.conditionalDisplay`, {
                  ...conditionalDisplay,
                  parentValue: e.target.value,
                });
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {getParentValues(conditionalDisplay.parentItemId).map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 ml-auto text-amber-600 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                form.setValue(`items.${index}.conditionalDisplay`, undefined);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Footer - Google Forms style */}
      <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-gray-500 hover:text-gray-700"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
        >
          <Copy className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-gray-500 hover:text-red-600"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          disabled={!canRemove}
        >
          <Trash2 className="h-5 w-5" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-2" />

        {/* Conditional toggle */}
        {possibleParents.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 gap-1.5 text-xs",
              conditionalDisplay ? "text-amber-600 bg-amber-50" : "text-gray-500"
            )}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleConditional();
            }}
          >
            <GitBranch className="h-4 w-4" />
            Condicional
          </Button>
        )}

        {/* Section selector */}
        {sections.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 gap-1.5 text-xs",
                  currentSectionId ? "text-purple-600 bg-purple-50" : "text-gray-500"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <Layers className="h-4 w-4" />
                {currentSectionId
                  ? sections.find(s => s.id === currentSectionId)?.name || 'Sección'
                  : 'Sección'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onMoveToSection(undefined)}>
                <FolderOpen className="h-4 w-4 mr-2 text-gray-400" />
                Sin sección
              </DropdownMenuItem>
              {sections.map((section) => (
                <DropdownMenuItem
                  key={section.id}
                  onClick={() => onMoveToSection(section.id)}
                >
                  <Layers className="h-4 w-4 mr-2 text-purple-500" />
                  {section.name}
                  {currentSectionId === section.id && (
                    <span className="ml-auto text-purple-600">✓</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Disable toggle */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 gap-1.5 text-xs",
            isDisabled ? "text-gray-400 bg-gray-100" : "text-gray-500"
          )}
          onClick={(e) => {
            e.stopPropagation();
            toggleDisabled();
          }}
          title={isDisabled ? "Habilitar pregunta" : "Deshabilitar pregunta"}
        >
          <EyeOff className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6 mx-2" />

        {/* Required toggle - Google Forms style */}
        <FormField
          control={form.control}
          name={`items.${index}.required`}
          render={({ field }) => (
            <div className="flex items-center gap-2">
              <Label className="text-sm text-gray-600">Obligatorio</Label>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </div>
          )}
        />

        {/* SELECT display mode toggle */}
        {type === 'SELECT' && (
          <>
            <Separator orientation="vertical" className="h-6 mx-2" />
            <div className="flex items-center gap-2">
              <Label className="text-sm text-gray-600">Mostrar:</Label>
              <Select
                value={form.watch(`items.${index}.selectDisplayMode`) || 'list'}
                onValueChange={(value) => form.setValue(`items.${index}.selectDisplayMode`, value)}
              >
                <SelectTrigger className="h-8 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="list">Lista</SelectItem>
                  <SelectItem value="dropdown">Desplegable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PREVIEW DIALOG - Shows how the form will look during execution
// ============================================================================

interface PreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ItemType[];
  formName: string;
}

function PreviewDialog({ open, onOpenChange, items, formName }: PreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-600" />
            Vista previa: {formName || 'Rutina sin nombre'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {items.map((item, index) => (
            <div key={item.id} className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-xs font-bold text-gray-400 bg-gray-200 rounded-full h-6 w-6 flex items-center justify-center">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {item.question || <span className="text-gray-400 italic">Sin pregunta</span>}
                    {item.required && <span className="text-red-500 ml-1">*</span>}
                  </p>
                </div>
              </div>

              {/* Preview based on type */}
              <div className="ml-9">
                {item.type === 'CHECK' && (
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                      <span className="text-sm text-gray-600">Sí</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                      <span className="text-sm text-gray-600">No</span>
                    </label>
                  </div>
                )}

                {item.type === 'SELECT' && (
                  <div className="space-y-2">
                    {(item.options || []).map((opt, i) => (
                      <label key={i} className="flex items-center gap-2 cursor-pointer">
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                        <span className="text-sm text-gray-600">{opt.text || `Opción ${i + 1}`}</span>
                      </label>
                    ))}
                    {(!item.options || item.options.length === 0) && (
                      <span className="text-sm text-amber-600 italic">Sin opciones definidas</span>
                    )}
                  </div>
                )}

                {item.type === 'CHECKBOX' && (
                  <div className="space-y-2">
                    {(item.options || []).map((opt, i) => (
                      <label key={i} className="flex items-center gap-2 cursor-pointer">
                        <div className="w-4 h-4 rounded border-2 border-gray-300" />
                        <span className="text-sm text-gray-600">{opt.text || `Opción ${i + 1}`}</span>
                      </label>
                    ))}
                  </div>
                )}

                {item.type === 'TEXT' && (
                  <div className="border-b border-gray-300 pb-2 text-gray-400 text-sm">
                    Texto de respuesta...
                  </div>
                )}

                {item.type === 'VALUE' && (
                  <div className="flex items-center gap-2">
                    <div className="border rounded px-3 py-2 bg-white w-32 text-gray-400 text-sm">
                      0.00
                    </div>
                    <span className="text-sm font-medium text-gray-600">
                      {item.unit || <span className="text-amber-600 italic">sin unidad</span>}
                    </span>
                    {(item.minValue != null || item.maxValue != null) && (
                      <span className="text-xs text-gray-400">
                        (rango: {item.minValue ?? '?'} - {item.maxValue ?? '?'})
                      </span>
                    )}
                  </div>
                )}

                {item.type === 'PHOTO' && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-white">
                    <Camera className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <span className="text-sm text-gray-500">Tomar o subir foto</span>
                  </div>
                )}

                {item.type === 'DATE' && (
                  <div className="flex items-center gap-2 border rounded px-3 py-2 bg-white w-48 text-gray-400 text-sm">
                    <Calendar className="h-4 w-4" />
                    <span>DD / MM / AAAA</span>
                  </div>
                )}

                {item.type === 'TIME' && (
                  <div className="flex items-center gap-2 border rounded px-3 py-2 bg-white w-32 text-gray-400 text-sm">
                    <Clock className="h-4 w-4" />
                    <span>HH : MM</span>
                  </div>
                )}

                {item.type === 'SIGNATURE' && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-white">
                    <PenTool className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <span className="text-sm text-gray-500">Firmar aquí</span>
                  </div>
                )}

                {item.type === 'RATING' && (
                  <div className="flex gap-1">
                    {Array.from({ length: item.ratingMax || 5 }).map((_, i) => (
                      <Star key={i} className="h-6 w-6 text-gray-300 cursor-pointer hover:text-amber-400" />
                    ))}
                  </div>
                )}

                {item.type === 'EMPLOYEE_SELECT' && (
                  <div className="border rounded-lg p-3 bg-white">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <Users className="h-4 w-4" />
                      <span className="text-sm font-medium">Empleados del sector</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      Se cargarán automáticamente los empleados asignados al centro de trabajo
                    </div>
                  </div>
                )}

                {item.type === 'MATERIAL_INPUT' && (
                  <div className="border rounded-lg p-3 bg-white">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <Package className="h-4 w-4" />
                      <span className="text-sm font-medium">Materiales</span>
                    </div>
                    <div className="space-y-1 text-xs text-gray-500">
                      {item.materialConfig?.materials?.map((m, i) => (
                        <div key={i}>• {m.name || 'Material sin nombre'} ({m.unit})</div>
                      ))}
                    </div>
                  </div>
                )}

                {(item.type === 'RESOURCE_MULTI_SELECT' || item.type === 'RESOURCE_SEQUENCE_SELECT') && (
                  <div className="border rounded-lg p-3 bg-white">
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <Boxes className="h-4 w-4" />
                      <span className="text-sm font-medium">Recursos</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {item.resourceTypeCode ? `Tipo: ${item.resourceTypeCode}` : 'Sin tipo configurado'}
                    </div>
                  </div>
                )}

                {/* Additional inputs preview */}
                {item.additionalInputs && item.additionalInputs.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    {item.additionalInputs.map((input: any, inputIdx: number) => (
                      <div key={input.id || inputIdx} className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                        <p className="text-xs font-medium text-blue-800 mb-1">
                          {input.label || 'Respuesta adicional'}
                          {input.required && <span className="text-red-500 ml-1">*</span>}
                        </p>
                        {input.type === 'TEXT' && (
                          <div className="bg-white border rounded px-2 py-1 text-xs text-gray-400">Escribir...</div>
                        )}
                        {input.type === 'PHOTO' && (
                          <div className="bg-white border border-dashed rounded p-2 text-center">
                            <Camera className="h-4 w-4 mx-auto text-gray-300" />
                          </div>
                        )}
                        {input.type === 'VALUE' && (
                          <div className="flex items-center gap-1">
                            <div className="bg-white border rounded px-2 py-0.5 text-xs text-gray-400 w-16">0.00</div>
                            <span className="text-xs text-gray-500">{input.unit || '?'}</span>
                          </div>
                        )}
                        {input.type === 'CHECK' && (
                          <div className="flex gap-2">
                            <span className="text-xs bg-white border rounded px-1.5 py-0.5 text-gray-500">Sí</span>
                            <span className="text-xs bg-white border rounded px-1.5 py-0.5 text-gray-500">No</span>
                          </div>
                        )}
                        {input.type === 'SELECT' && (
                          <div className="space-y-0.5">
                            {(input.options || []).map((opt: any, i: number) => (
                              <div key={i} className="flex items-center gap-1 text-xs text-gray-500">
                                <div className="w-2 h-2 rounded-full border border-gray-300" />
                                <span>{opt.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {input.type === 'SIGNATURE' && (
                          <div className="bg-white border border-dashed rounded p-2 text-center">
                            <PenTool className="h-4 w-4 mx-auto text-gray-300" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No hay preguntas para mostrar</p>
            </div>
          )}
        </div>
        <div className="border-t pt-4 flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MOBILE PREVIEW DIALOG - Shows form in phone frame
// ============================================================================

interface MobilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ItemType[];
  formName: string;
}

function MobilePreviewDialog({ open, onOpenChange, items, formName }: MobilePreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="bg-gray-900 p-4">
          <DialogTitle className="text-white text-sm flex items-center gap-2 mb-4">
            <Smartphone className="h-4 w-4" />
            Vista móvil
          </DialogTitle>
          {/* Phone frame */}
          <div className="mx-auto w-[280px] h-[560px] bg-white rounded-[32px] border-4 border-gray-800 overflow-hidden shadow-2xl relative">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-gray-800 rounded-b-xl z-10" />
            {/* Screen content */}
            <div className="h-full overflow-y-auto pt-8 pb-4 px-3">
              <div className="mb-4">
                <h1 className="text-sm font-semibold text-gray-900 truncate">
                  {formName || 'Rutina'}
                </h1>
                <p className="text-[10px] text-gray-500">{items.length} preguntas</p>
              </div>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-2.5 border border-gray-200">
                    <p className="text-[11px] font-medium text-gray-800 mb-1.5 leading-tight">
                      {index + 1}. {item.question || 'Sin pregunta'}
                      {item.required && <span className="text-red-500 ml-0.5">*</span>}
                    </p>
                    {/* Mini preview based on type */}
                    {item.type === 'CHECK' && (
                      <div className="flex gap-2">
                        <span className="text-[9px] bg-gray-200 rounded px-1.5 py-0.5">Sí</span>
                        <span className="text-[9px] bg-gray-200 rounded px-1.5 py-0.5">No</span>
                      </div>
                    )}
                    {item.type === 'SELECT' && (
                      <div className="space-y-0.5">
                        {(item.options || []).slice(0, 3).map((opt, i) => (
                          <div key={i} className="flex items-center gap-1 text-[9px] text-gray-500">
                            <div className="w-2 h-2 rounded-full border border-gray-300" />
                            <span className="truncate">{opt.text}</span>
                          </div>
                        ))}
                        {(item.options?.length || 0) > 3 && (
                          <span className="text-[8px] text-gray-400">+{item.options!.length - 3} más</span>
                        )}
                      </div>
                    )}
                    {item.type === 'VALUE' && (
                      <div className="flex items-center gap-1">
                        <div className="bg-white border rounded px-2 py-0.5 text-[9px] text-gray-400 w-16">0.00</div>
                        <span className="text-[9px] text-gray-500">{item.unit || '?'}</span>
                      </div>
                    )}
                    {item.type === 'TEXT' && (
                      <div className="bg-white border rounded px-2 py-1 text-[9px] text-gray-400">
                        Escribir...
                      </div>
                    )}
                    {item.type === 'PHOTO' && (
                      <div className="bg-white border border-dashed rounded p-2 text-center">
                        <Camera className="h-4 w-4 mx-auto text-gray-300" />
                      </div>
                    )}
                    {item.type === 'SIGNATURE' && (
                      <div className="bg-white border border-dashed rounded p-2 text-center">
                        <PenTool className="h-4 w-4 mx-auto text-gray-300" />
                      </div>
                    )}
                    {item.type === 'RATING' && (
                      <div className="flex gap-0.5">
                        {Array.from({ length: item.ratingMax || 5 }).map((_, i) => (
                          <Star key={i} className="h-3 w-3 text-gray-300" />
                        ))}
                      </div>
                    )}
                    {(item.type === 'DATE' || item.type === 'TIME') && (
                      <div className="bg-white border rounded px-2 py-0.5 text-[9px] text-gray-400 w-20">
                        {item.type === 'DATE' ? 'DD/MM/AA' : 'HH:MM'}
                      </div>
                    )}
                    {item.type === 'CHECKBOX' && (
                      <div className="space-y-0.5">
                        {(item.options || []).slice(0, 3).map((opt, i) => (
                          <div key={i} className="flex items-center gap-1 text-[9px] text-gray-500">
                            <div className="w-2 h-2 rounded-sm border border-gray-300" />
                            <span className="truncate">{opt.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {item.type === 'EMPLOYEE_SELECT' && (
                      <div className="flex items-center gap-1 text-[9px] text-gray-500">
                        <Users className="h-3 w-3" />
                        <span>Empleados...</span>
                      </div>
                    )}
                    {item.type === 'MATERIAL_INPUT' && (
                      <div className="flex items-center gap-1 text-[9px] text-gray-500">
                        <Package className="h-3 w-3" />
                        <span>Materiales...</span>
                      </div>
                    )}
                    {/* Additional inputs in mobile */}
                    {item.additionalInputs && item.additionalInputs.length > 0 && (
                      <div className="mt-1.5 pt-1.5 border-t border-gray-200 space-y-1">
                        {item.additionalInputs.map((input: any, i: number) => (
                          <div key={i} className="flex items-center gap-1 text-[9px] text-blue-600">
                            <Plus className="h-2 w-2" />
                            <span>{input.label || input.type}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* Submit button mock */}
              <div className="mt-4 bg-blue-600 text-white text-center py-2 rounded-lg text-xs font-medium">
                Enviar
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// AI CHAT PANEL - Conversational routine building
// ============================================================================

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: any[];
  timestamp: Date;
}

interface AIChatPanelProps {
  open: boolean;
  onClose: () => void;
  items: ItemType[];
  onApplyActions: (actions: any[]) => void;
}

function AIChatPanel({ open, onClose, items, onApplyActions }: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '¡Hola! Soy tu asistente para crear rutinas. Decime qué preguntas querés agregar y yo las creo. Por ejemplo:\n\n• "Agregame una pregunta sobre temperatura"\n• "Que tenga opciones Bueno, Regular y Malo"\n• "Si es Malo, que pida foto"',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/production/routines/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          currentItems: items,
          conversationHistory: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: data.message,
          actions: data.actions,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Apply actions if any (except message-only actions)
        const actionableActions = data.actions?.filter((a: any) => a.action !== 'message') || [];
        if (actionableActions.length > 0) {
          onApplyActions(actionableActions);
        }
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: 'Hubo un error, intentá de nuevo.',
            timestamp: new Date(),
          },
        ]);
      }
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: 'Error de conexión. Verificá tu internet.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed right-24 top-1/2 -translate-y-1/2 w-80 h-[500px] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Bot className="h-5 w-5" />
          <span className="font-medium text-sm">Asistente IA</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-white hover:bg-white/20"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-2",
              msg.role === 'user' ? "justify-end" : "justify-start"
            )}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-purple-600" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                msg.role === 'user'
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-700"
              )}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.actions && msg.actions.filter(a => a.action !== 'message').length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Acciones aplicadas:</p>
                  {msg.actions.filter(a => a.action !== 'message').map((action, i) => (
                    <div key={i} className="text-[11px] text-green-600 flex items-center gap-1">
                      <CheckSquare className="h-3 w-3" />
                      {action.action === 'add_item' && `Agregada: "${action.item?.question || 'pregunta'}"`}
                      {action.action === 'modify_item' && `Modificada pregunta #${action.index + 1}`}
                      {action.action === 'remove_item' && `Eliminada pregunta #${action.index + 1}`}
                      {action.action === 'add_option' && `Opción agregada`}
                      {action.action === 'set_conditional' && `Condicional configurado`}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <UserIcon className="h-4 w-4 text-blue-600" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
              <Bot className="h-4 w-4 text-purple-600" />
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t bg-white">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribí qué querés agregar..."
            className="flex-1 min-h-[40px] max-h-[80px] text-sm resize-none"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            size="icon"
            className="h-10 w-10 bg-blue-600 hover:bg-blue-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5">
          Tip: "Agregame una pregunta de temperatura con rango 180-220°C"
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// BLOCKS DIALOG - Manage saved question templates
// ============================================================================

interface BlocksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsertBlock: (item: ItemType) => void;
  onSaveCurrentItem?: (item: ItemType) => void;
  currentItem?: ItemType;
}

function BlocksDialog({ open, onOpenChange, onInsertBlock, currentItem }: BlocksDialogProps) {
  const [blocks, setBlocks] = useState<SavedBlock[]>([]);
  const [saveName, setSaveName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  useEffect(() => {
    if (open) {
      setBlocks(getSavedBlocks());
    }
  }, [open]);

  const handleSaveBlock = () => {
    if (!currentItem || !saveName.trim()) return;

    const block: SavedBlock = {
      id: `block_${Date.now()}`,
      name: saveName.trim(),
      description: currentItem.question,
      item: {
        ...currentItem,
        id: `q_${Math.random().toString(36).substr(2, 9)}`, // New ID for when inserted
      },
      createdAt: new Date().toISOString(),
    };

    saveBlock(block);
    setBlocks(getSavedBlocks());
    setSaveName('');
    setShowSaveForm(false);
    toast.success('Bloque guardado');
  };

  const handleDeleteBlock = (blockId: string) => {
    if (!confirm('¿Eliminar este bloque?')) return;
    deleteBlock(blockId);
    setBlocks(getSavedBlocks());
    toast.success('Bloque eliminado');
  };

  const handleInsert = (block: SavedBlock) => {
    const newItem: ItemType = {
      ...block.item,
      id: `q_${Math.random().toString(36).substr(2, 9)}`,
      options: block.item.options?.map(opt => ({
        ...opt,
        id: `opt_${Math.random().toString(36).substr(2, 6)}`,
      })),
      additionalInputs: block.item.additionalInputs?.map(input => ({
        ...input,
        id: `input_${Math.random().toString(36).substr(2, 9)}`,
        options: input.options?.map((opt: any) => ({
          ...opt,
          id: `opt_${Math.random().toString(36).substr(2, 6)}`,
        })),
      })),
    };
    onInsertBlock(newItem);
    onOpenChange(false);
    toast.success('Bloque insertado');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CHECK': return CheckSquare;
      case 'VALUE': return Hash;
      case 'TEXT': return FileText;
      case 'PHOTO': return Camera;
      case 'SELECT': return Circle;
      case 'CHECKBOX': return Square;
      case 'SIGNATURE': return PenTool;
      case 'RATING': return Star;
      case 'DATE': return Calendar;
      case 'TIME': return Clock;
      case 'EMPLOYEE_SELECT': return Users;
      case 'MATERIAL_INPUT': return Package;
      default: return CheckSquare;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-amber-600" />
            Bloques Guardados
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Save current item as block */}
          {currentItem && currentItem.question && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              {!showSaveForm ? (
                <button
                  className="w-full text-sm text-blue-600 font-medium flex items-center justify-center gap-2 hover:text-blue-800"
                  onClick={() => setShowSaveForm(true)}
                >
                  <Plus className="h-4 w-4" />
                  Guardar pregunta actual como bloque
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-blue-800 font-medium">Guardar como bloque:</p>
                  <p className="text-xs text-blue-600 truncate">"{currentItem.question}"</p>
                  <Input
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Nombre del bloque..."
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveBlock} disabled={!saveName.trim()}>
                      Guardar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      setShowSaveForm(false);
                      setSaveName('');
                    }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* List of saved blocks */}
          {blocks.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Boxes className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No hay bloques guardados</p>
              <p className="text-xs mt-1">Seleccioná una pregunta y guardala como bloque</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blocks.map((block) => {
                const TypeIcon = getTypeIcon(block.item.type);
                return (
                  <div
                    key={block.id}
                    className="group flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-amber-300 hover:bg-amber-50 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                      <TypeIcon className="h-5 w-5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{block.name}</p>
                      <p className="text-xs text-gray-500 truncate">{block.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] bg-gray-200 text-gray-600 rounded px-1.5 py-0.5">
                          {block.item.type}
                        </span>
                        {block.item.additionalInputs && block.item.additionalInputs.length > 0 && (
                          <span className="text-[10px] bg-blue-100 text-blue-600 rounded px-1.5 py-0.5">
                            +{block.item.additionalInputs.length} inputs
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleInsert(block)}
                      >
                        Insertar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100"
                        onClick={() => handleDeleteBlock(block.id)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t pt-4 flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// FLOATING ADD TOOLBAR - Google Forms style
// ============================================================================

interface FloatingToolbarProps {
  onAddQuestion: (type?: ItemType['type']) => void;
  onOpenAI: () => void;
  onPreview: () => void;
  onMobilePreview: () => void;
  onToggleChat: () => void;
  onOpenBlocks: () => void;
  hasValidationWarnings: boolean;
  chatOpen: boolean;
  blocksCount: number;
}

function FloatingToolbar({ onAddQuestion, onOpenAI, onPreview, onMobilePreview, onToggleChat, onOpenBlocks, hasValidationWarnings, chatOpen, blocksCount }: FloatingToolbarProps) {
  return (
    <div className="fixed right-8 top-1/2 -translate-y-1/2 flex flex-col gap-1 bg-white rounded-lg shadow-lg border border-gray-200 p-1">
      {/* AI Chat toggle */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-10 w-10",
          chatOpen ? "bg-purple-100 text-purple-600" : "hover:bg-purple-50 hover:text-purple-600"
        )}
        onClick={onToggleChat}
        title="Chat con IA"
      >
        <MessageCircle className="h-5 w-5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 hover:bg-purple-50 hover:text-purple-600"
        onClick={onOpenAI}
        title="Generar desde archivo"
      >
        <Sparkles className="h-5 w-5" />
      </Button>
      {/* Reusable blocks */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 hover:bg-amber-50 hover:text-amber-600 relative"
        onClick={onOpenBlocks}
        title="Bloques guardados"
      >
        <Boxes className="h-5 w-5" />
        {blocksCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-amber-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
            {blocksCount > 9 ? '9+' : blocksCount}
          </span>
        )}
      </Button>
      <Separator />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-10 w-10 relative",
          hasValidationWarnings ? "hover:bg-amber-50 hover:text-amber-600" : "hover:bg-green-50 hover:text-green-600"
        )}
        onClick={onPreview}
        title="Vista previa"
      >
        <Eye className="h-5 w-5" />
        {hasValidationWarnings && (
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-amber-400 rounded-full" />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 hover:bg-gray-100"
        onClick={onMobilePreview}
        title="Vista móvil"
      >
        <Smartphone className="h-5 w-5" />
      </Button>
      <Separator />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 hover:bg-gray-100"
        onClick={() => onAddQuestion('CHECK')}
        title="Agregar pregunta"
      >
        <Plus className="h-5 w-5" />
      </Button>
      <Separator />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 hover:bg-gray-100"
        onClick={() => onAddQuestion('CHECK')}
        title="Sí / No"
      >
        <CheckSquare className="h-5 w-5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 hover:bg-gray-100"
        onClick={() => onAddQuestion('SELECT')}
        title="Varias opciones"
      >
        <Circle className="h-5 w-5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 hover:bg-gray-100"
        onClick={() => onAddQuestion('PHOTO')}
        title="Subir foto"
      >
        <Image className="h-5 w-5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 hover:bg-gray-100"
        onClick={() => onAddQuestion('VALUE')}
        title="Número"
      >
        <Hash className="h-5 w-5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-10 w-10 hover:bg-gray-100"
        onClick={() => onAddQuestion('SIGNATURE')}
        title="Firma"
      >
        <PenTool className="h-5 w-5" />
      </Button>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function NewRoutineTemplateForm({
  template,
  onSuccess,
  onCancel,
  defaultSectorId,
}: NewRoutineTemplateFormProps) {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [workCenters, setWorkCenters] = useState<{ id: number; name: string }[]>([]);
  const [sectors, setSectors] = useState<{ id: number; name: string }[]>([]);
  const [resourceTypes, setResourceTypes] = useState<{ id: number; code: string; name: string }[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiLoading, setAILoading] = useState(false);
  const [aiDescription, setAIDescription] = useState('');
  const [aiFiles, setAIFiles] = useState<File[]>([]);
  const [aiGrouped, setAIGrouped] = useState(false);
  // AI group metadata for hierarchical save
  const [aiGroups, setAIGroups] = useState<{ name: string; description?: string; isRepeatable?: boolean }[] | null>(null);
  const [aiItemGroupMap, setAIItemGroupMap] = useState<Record<string, number>>({});
  // AI generation summary (shows which files were processed)
  const [aiSummary, setAISummary] = useState<{ files: string[]; groups: string[]; totalItems: number } | null>(null);
  // Sections navigation
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [showSectionDialog, setShowSectionDialog] = useState(false);
  const [editingSection, setEditingSection] = useState<{ id: string; name: string; description?: string } | null>(null);
  // Preview dialogs
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  // AI Chat panel
  const [showChatPanel, setShowChatPanel] = useState(false);
  // Blocks dialog
  const [showBlocksDialog, setShowBlocksDialog] = useState(false);
  const [blocksCount, setBlocksCount] = useState(0);

  // Load blocks count on mount
  useEffect(() => {
    setBlocksCount(getSavedBlocks().length);
  }, []);

  const isEditing = !!template;

  // Convert old format to new simplified format
  const convertItem = (item: any): ItemType => {
    if (item.inputs && Array.isArray(item.inputs) && item.inputs.length > 0) {
      const firstInput = item.inputs[0];
      // Convert additional inputs (all inputs after the first one)
      const additionalInputs = item.inputs.slice(1).map((inp: any) => ({
        id: inp.id || `input_${Math.random().toString(36).substr(2, 9)}`,
        type: inp.type || 'TEXT',
        label: inp.label || '',
        required: inp.required || false,
        unit: inp.unit,
        minValue: inp.minValue,
        maxValue: inp.maxValue,
        ratingMax: inp.ratingMax,
        selectDisplayMode: inp.selectDisplayMode, // Para SELECT: 'list' o 'dropdown'
        options: inp.options?.map((opt: string) => ({
          id: generateOptionId(),
          text: opt,
        })),
      }));

      return {
        id: item.id || generateId(),
        question: item.description || firstInput.label || '',
        type: firstInput.type || 'CHECK',
        required: firstInput.required !== false,
        disabled: item.disabled || false,
        sectionId: item.sectionId || undefined,
        unit: firstInput.unit,
        minValue: firstInput.minValue,
        maxValue: firstInput.maxValue,
        options: firstInput.options?.map((opt: string, i: number) => ({
          id: generateOptionId(),
          text: opt,
        })),
        resourceTypeCode: firstInput.resourceSelectConfig?.resourceTypeCode,
        employeeConfig: firstInput.employeeSelectConfig ? {
          taskAssignment: firstInput.employeeSelectConfig.taskAssignment || false,
          taskOptions: firstInput.employeeSelectConfig.taskOptions || [],
          workSectorAssignment: firstInput.employeeSelectConfig.workSectorAssignment || false,
          attendanceTracking: firstInput.employeeSelectConfig.attendanceTracking || false,
          absenceReasons: firstInput.employeeSelectConfig.absenceReasons || [],
          allowSectorTransfer: firstInput.employeeSelectConfig.allowSectorTransfer || false,
        } : undefined,
        materialConfig: firstInput.materialConfig ? {
          materials: firstInput.materialConfig.materials || [],
          trackingMode: firstInput.materialConfig.trackingMode || 'PER_SHIFT',
          allowAddMaterial: firstInput.materialConfig.allowAddMaterial || false,
        } : undefined,
        machineConfig: firstInput.machineConfig ? {
          allowMultiple: firstInput.machineConfig.allowMultiple || false,
          requireCounterReading: firstInput.machineConfig.requireCounterReading || false,
          selectedMachines: firstInput.machineConfig.selectedMachines || [],
        } : undefined,
        photoTimerConfig: firstInput.photoTimerConfig || undefined,
        selectDisplayMode: firstInput.selectDisplayMode, // Para SELECT: 'list' o 'dropdown'
        additionalInputs: additionalInputs.length > 0 ? additionalInputs : undefined,
      };
    }

    return {
      id: item.id || generateId(),
      question: item.description || '',
      type: item.type || 'CHECK',
      required: item.required !== false,
      disabled: item.disabled || false,
      sectionId: item.sectionId || undefined,
      unit: item.unit,
      minValue: item.minValue,
      maxValue: item.maxValue,
      options: item.options?.map((opt: string, i: number) => ({
        id: generateOptionId(),
        text: opt,
      })),
    };
  };

  const getTemplateItems = (): ItemType[] => {
    if (!template) return [createEmptyItem()];

    if (template.groups && template.groups.length > 0) {
      return template.groups.flatMap(g => g.items?.map(convertItem) || []);
    }

    if (template.items && template.items.length > 0) {
      return template.items.map(convertItem);
    }

    return [createEmptyItem()];
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: template?.name || '',
      code: template?.code || '',
      type: template?.type || 'SHIFT_START',
      frequency: template?.frequency || 'EVERY_SHIFT',
      workCenterId: template?.workCenter?.id || null,
      // Use template's sector if editing, otherwise use defaultSectorId from context
      sectorId: template?.sector?.id ?? defaultSectorId ?? null,
      isActive: template?.isActive !== false,
      maxCompletionTimeMinutes: (template as any)?.maxCompletionTimeMinutes || 60,
      enableCompletionReminders: (template as any)?.enableCompletionReminders !== false,
      sections: template?.sections || [],
      items: getTemplateItems(),
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex(f => f.id === active.id);
      const newIndex = fields.findIndex(f => f.id === over.id);
      move(oldIndex, newIndex);
    }
  };

  // Compute validation for all items
  const watchedItems = form.watch('items') || [];
  const itemValidations = useMemo(() => {
    return watchedItems.map((item: any) => validateQuestionItem(item));
  }, [watchedItems]);

  const hasValidationWarnings = useMemo(() => {
    return itemValidations.some((v: ValidationResult) => !v.isValid);
  }, [itemValidations]);

  const fetchMasterData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [wcRes, rtRes, sectorsRes] = await Promise.all([
        fetch('/api/production/work-centers?status=ACTIVE'),
        fetch('/api/production/resource-types'),
        fetch('/api/production/sectors'),
      ]);

      const wcData = await wcRes.json();
      if (wcData.success) setWorkCenters(wcData.workCenters);

      const rtData = await rtRes.json();
      if (rtData.success) setResourceTypes(rtData.resourceTypes);

      const sectorsData = await sectorsRes.json();
      if (sectorsData.success) setSectors(sectorsData.sectors);
    } catch (error) {
      console.error('Error fetching master data:', error);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  const convertItemToBackend = (item: FormValues['items'][0]) => {
    // Primary input
    const primaryInput = {
      id: `${item.id}_input`,
      type: item.type,
      label: item.question,
      required: item.required,
      unit: item.unit,
      minValue: item.minValue,
      maxValue: item.maxValue,
      ratingMax: item.ratingMax,
      options: item.options?.map(opt => opt.text),
      selectDisplayMode: item.selectDisplayMode, // Para SELECT: 'list' o 'dropdown'
      resourceSelectConfig: item.resourceTypeCode ? {
        resourceTypeCode: item.resourceTypeCode,
        minSelection: 1,
      } : undefined,
      employeeSelectConfig: item.employeeConfig ? {
        taskAssignment: item.employeeConfig.taskAssignment || false,
        taskOptions: item.employeeConfig.taskOptions || [],
        workSectorAssignment: item.employeeConfig.workSectorAssignment || false,
        attendanceTracking: item.employeeConfig.attendanceTracking || false,
        absenceReasons: item.employeeConfig.absenceReasons || [],
        allowSectorTransfer: item.employeeConfig.allowSectorTransfer || false,
      } : undefined,
      materialConfig: item.materialConfig ? {
        materials: item.materialConfig.materials || [],
        trackingMode: item.materialConfig.trackingMode || 'PER_SHIFT',
        allowAddMaterial: item.materialConfig.allowAddMaterial || false,
      } : undefined,
      machineConfig: item.machineConfig ? {
        allowMultiple: item.machineConfig.allowMultiple || false,
        requireCounterReading: item.machineConfig.requireCounterReading || false,
        selectedMachines: item.machineConfig.selectedMachines || [],
      } : undefined,
      photoTimerConfig: item.photoTimerConfig ? {
        delayMinutes: item.photoTimerConfig.delayMinutes,
        reminderMessage: item.photoTimerConfig.reminderMessage || undefined,
      } : undefined,
      conditionalDisplay: item.conditionalDisplay ? {
        showIf: {
          inputId: `${item.conditionalDisplay.parentItemId}_input`,
          equals: item.conditionalDisplay.parentValue,
        },
      } : undefined,
    };

    // Additional inputs
    const additionalBackendInputs = (item.additionalInputs || []).map((input: any, idx: number) => ({
      id: input.id || `${item.id}_input_${idx + 1}`,
      type: input.type,
      label: input.label || '',
      required: input.required || false,
      unit: input.unit,
      minValue: input.minValue,
      maxValue: input.maxValue,
      ratingMax: input.ratingMax,
      options: input.options?.map((opt: any) => opt.text),
      selectDisplayMode: input.selectDisplayMode, // Para SELECT: 'list' o 'dropdown'
    }));

    return {
      id: item.id,
      description: item.question,
      sectionId: item.sectionId || undefined,
      disabled: item.disabled || false,
      inputs: [primaryInput, ...additionalBackendInputs],
    };
  };

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const url = isEditing
        ? `/api/production/routines/templates/${template!.id}`
        : '/api/production/routines/templates';

      let dataToSend: any;

      // If AI generated groups, save as hierarchical
      if (aiGroups && aiGroups.length > 0 && Object.keys(aiItemGroupMap).length > 0) {
        // Group items by their group index
        const groupedItems: Record<number, FormValues['items']> = {};
        for (const item of values.items) {
          const gIdx = aiItemGroupMap[item.id] ?? 0;
          if (!groupedItems[gIdx]) groupedItems[gIdx] = [];
          groupedItems[gIdx].push(item);
        }

        const backendGroups = aiGroups.map((group, gIdx) => ({
          id: `group_${Date.now()}_${gIdx}`,
          name: group.name,
          description: group.description || '',
          order: gIdx + 1,
          collapsed: false,
          isRepeatable: group.isRepeatable || false,
          items: (groupedItems[gIdx] || []).map(convertItemToBackend),
        }));

        dataToSend = {
          ...values,
          code: values.code || values.name.toUpperCase().replace(/\s+/g, '_').slice(0, 20),
          itemsStructure: 'hierarchical',
          items: [],
          groups: backendGroups,
        };
      } else {
        // Flat save
        dataToSend = {
          ...values,
          code: values.code || values.name.toUpperCase().replace(/\s+/g, '_').slice(0, 20),
          itemsStructure: 'flat',
          items: values.items.map(convertItemToBackend),
          groups: null,
        };
      }

      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(isEditing ? 'Plantilla actualizada' : 'Plantilla creada');
        onSuccess();
      } else {
        toast.error(data.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = (index: number) => {
    const item = form.getValues(`items.${index}`);
    const newItem = {
      ...item,
      id: generateId(),
      options: item.options?.map(opt => ({ ...opt, id: generateOptionId() })),
    };
    append(newItem);
    setSelectedIndex(fields.length);
  };

  // Handle actions from AI chat
  const handleApplyChatActions = useCallback((actions: any[]) => {
    const currentItems = form.getValues('items') || [];

    for (const action of actions) {
      switch (action.action) {
        case 'add_item': {
          const newItem: ItemType = {
            id: action.item.id || generateId(),
            question: action.item.question || '',
            type: action.item.type || 'CHECK',
            required: action.item.required !== false,
            options: action.item.options,
            unit: action.item.unit,
            minValue: action.item.minValue,
            maxValue: action.item.maxValue,
            ratingMax: action.item.ratingMax,
          };

          // Handle conditional from AI
          if (action.conditional) {
            let parentIndex = action.conditional.parentIndex;
            if (parentIndex === -1) parentIndex = currentItems.length - 1;
            if (parentIndex >= 0 && parentIndex < currentItems.length) {
              const parentItem = currentItems[parentIndex];
              newItem.conditionalDisplay = {
                parentItemId: parentItem.id,
                parentValue: action.conditional.parentValue || 'Sí',
              };
            }
          }

          append(newItem);
          setSelectedIndex(fields.length);
          break;
        }

        case 'modify_item': {
          const index = action.index;
          if (index >= 0 && index < currentItems.length) {
            const changes = action.changes || {};
            Object.keys(changes).forEach(key => {
              form.setValue(`items.${index}.${key}`, changes[key]);
            });
            setSelectedIndex(index);
          }
          break;
        }

        case 'remove_item': {
          const index = action.index;
          if (index >= 0 && index < currentItems.length) {
            remove(index);
          }
          break;
        }

        case 'add_option': {
          const itemIndex = action.itemIndex;
          if (itemIndex >= 0 && itemIndex < currentItems.length) {
            const currentOptions = form.getValues(`items.${itemIndex}.options`) || [];
            form.setValue(`items.${itemIndex}.options`, [
              ...currentOptions,
              { id: generateOptionId(), text: action.optionText },
            ]);
          }
          break;
        }

        case 'set_conditional': {
          const { itemIndex, parentIndex, parentValue } = action;
          if (
            itemIndex >= 0 &&
            itemIndex < currentItems.length &&
            parentIndex >= 0 &&
            parentIndex < currentItems.length
          ) {
            const parentItem = currentItems[parentIndex];
            form.setValue(`items.${itemIndex}.conditionalDisplay`, {
              parentItemId: parentItem.id,
              parentValue: parentValue || 'Sí',
            });
          }
          break;
        }

        case 'remove_conditional': {
          const itemIndex = action.itemIndex;
          if (itemIndex >= 0 && itemIndex < currentItems.length) {
            form.setValue(`items.${itemIndex}.conditionalDisplay`, undefined);
          }
          break;
        }

        case 'reorder': {
          const { fromIndex, toIndex } = action;
          if (
            fromIndex >= 0 &&
            fromIndex < currentItems.length &&
            toIndex >= 0 &&
            toIndex < currentItems.length
          ) {
            move(fromIndex, toIndex);
          }
          break;
        }
      }
    }
  }, [form, fields.length, append, remove, move]);

  const addQuestion = (type: ItemType['type'] = 'CHECK') => {
    append(createEmptyItem(type));
    setSelectedIndex(fields.length);
  };

  // Insert a block from the blocks library
  const insertBlock = (item: ItemType) => {
    append(item);
    setSelectedIndex(fields.length);
    setBlocksCount(getSavedBlocks().length); // Refresh count
  };

  const handleAIGenerate = async () => {
    if (aiFiles.length === 0 && aiDescription.trim().length < 10) {
      toast.error('Escribí al menos 10 caracteres o subí un archivo');
      return;
    }

    setAILoading(true);
    try {
      // Always generate grouped/sectioned routines
      const isGrouped = true;
      let res: Response;

      if (aiFiles.length > 0) {
        const formData = new FormData();
        for (const file of aiFiles) {
          formData.append('files', file);
        }
        if (aiDescription.trim()) {
          formData.append('description', aiDescription.trim());
        }
        if (isGrouped) {
          formData.append('grouped', 'true');
        }
        const currentName = form.getValues('name');
        if (currentName) {
          formData.append('templateName', currentName);
        }
        res = await fetch('/api/production/routines/generate', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch('/api/production/routines/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: aiDescription.trim(),
            grouped: isGrouped,
          }),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al generar');
      }

      const result = await res.json();

      // Check that we actually got content
      const hasGroups = result.groups && result.groups.length > 0 &&
        result.groups.some((g: any) => g.items && g.items.length > 0);
      const hasItems = result.items && result.items.length > 0;

      if (!hasGroups && !hasItems) {
        toast.error('La IA no pudo generar contenido. Intentá con más detalle o un archivo diferente.');
        return;
      }

      // Fill form metadata
      if (result.name) form.setValue('name', result.name);
      if (result.type) form.setValue('type', result.type);
      if (result.frequency) form.setValue('frequency', result.frequency);

      // Clear empty default item
      const currentItems = form.getValues('items');
      if (currentItems.length === 1 && !currentItems[0].question) {
        remove(0);
      }

      // Build items and group mapping
      const newItemGroupMap: Record<string, number> = {};
      let totalItems = 0;

      // Remember file names for summary
      const processedFileNames = aiFiles.map(f => f.name);

      if (hasGroups) {
        // Store group definitions
        const groupDefs = result.groups.map((g: any) => ({
          name: g.name,
          description: g.description,
          isRepeatable: g.isRepeatable || false,
        }));
        setAIGroups(groupDefs);

        // Flatten all group items into the form, resolving conditional indexes to IDs
        for (let gIdx = 0; gIdx < result.groups.length; gIdx++) {
          const group = result.groups[gIdx];
          const groupItemIds: string[] = [];

          // First pass: generate IDs for all items in this group
          for (const _item of (group.items || [])) {
            groupItemIds.push(generateId());
          }

          // Second pass: build and append items with resolved conditionals
          let itemIdx = 0;
          for (const item of (group.items || [])) {
            const itemId = groupItemIds[itemIdx];
            let conditionalDisplay: { parentItemId: string; parentValue: string } | undefined;
            if (item.conditionalDisplay) {
              const parentIdx = item.conditionalDisplay.afterQuestionIndex;
              if (parentIdx >= 0 && parentIdx < groupItemIds.length) {
                conditionalDisplay = {
                  parentItemId: groupItemIds[parentIdx],
                  parentValue: item.conditionalDisplay.ifEquals || 'Sí',
                };
              }
            }
            newItemGroupMap[itemId] = gIdx;
            const itemType = item.type || 'CHECK';
            append({
              id: itemId,
              question: item.question,
              type: itemType,
              required: item.required !== false,
              unit: item.unit,
              minValue: item.minValue ?? undefined,
              maxValue: item.maxValue ?? undefined,
              ratingMax: item.ratingMax,
              options: item.options?.map((opt: string) => ({
                id: generateOptionId(),
                text: opt,
              })),
              conditionalDisplay,
              ...(itemType === 'EMPLOYEE_SELECT' ? {
                employeeConfig: {
                  taskAssignment: false,
                  workSectorAssignment: true,
                  attendanceTracking: true,
                  absenceReasons: [
                    { id: 'carpeta_medica', label: 'Carpeta Médica', payrollEventType: 'SICK_LEAVE' },
                    { id: 'accidente_trabajo', label: 'Accidente de Trabajo', payrollEventType: 'WORK_ACCIDENT' },
                    { id: 'falta_con_permiso', label: 'Falta con Permiso', payrollEventType: 'AUTHORIZED_ABSENCE' },
                    { id: 'falta_sin_aviso', label: 'Falta sin Aviso', payrollEventType: 'UNAUTHORIZED_ABSENCE' },
                    { id: 'vacaciones', label: 'Vacaciones', payrollEventType: 'VACATION' },
                    { id: 'suspension', label: 'Suspensión', payrollEventType: 'SUSPENSION' },
                  ],
                  allowSectorTransfer: true,
                },
              } : {}),
              ...(itemType === 'MATERIAL_INPUT' ? {
                materialConfig: {
                  materials: [{ id: `mat_${Date.now()}`, name: '', unit: 'kg' }],
                  trackingMode: 'PER_SHIFT' as const,
                  allowAddMaterial: true,
                },
              } : {}),
            });
            totalItems++;
            itemIdx++;
          }
        }
        setAIItemGroupMap(newItemGroupMap);

        // Store summary
        setAISummary({
          files: processedFileNames,
          groups: result.groups.map((g: any) => `${g.name} (${g.items?.length || 0} preguntas)`),
          totalItems,
        });

        toast.success(
          `Se cargaron ${result.groups.length} secciones con ${totalItems} preguntas. Editá y guardá cuando estés listo.`
        );
      } else {
        // Flat items - generate all IDs first for conditional resolution
        setAIGroups(null);
        setAIItemGroupMap({});
        const flatItemIds: string[] = result.items.map(() => generateId());

        let itemIdx = 0;
        for (const item of result.items) {
          const itemId = flatItemIds[itemIdx];
          let conditionalDisplay: { parentItemId: string; parentValue: string } | undefined;
          if (item.conditionalDisplay) {
            const parentIdx = item.conditionalDisplay.afterQuestionIndex;
            if (parentIdx >= 0 && parentIdx < flatItemIds.length) {
              conditionalDisplay = {
                parentItemId: flatItemIds[parentIdx],
                parentValue: item.conditionalDisplay.ifEquals || 'Sí',
              };
            }
          }
          const itemType = item.type || 'CHECK';
          append({
            id: itemId,
            question: item.question,
            type: itemType,
            required: item.required !== false,
            unit: item.unit,
            minValue: item.minValue ?? undefined,
            maxValue: item.maxValue ?? undefined,
            ratingMax: item.ratingMax,
            options: item.options?.map((opt: string) => ({
              id: generateOptionId(),
              text: opt,
            })),
            conditionalDisplay,
            ...(itemType === 'EMPLOYEE_SELECT' ? {
              employeeConfig: {
                taskAssignment: false,
                workSectorAssignment: true,
                attendanceTracking: true,
                absenceReasons: [
                  { id: 'carpeta_medica', label: 'Carpeta Médica', payrollEventType: 'SICK_LEAVE' },
                  { id: 'accidente_trabajo', label: 'Accidente de Trabajo', payrollEventType: 'WORK_ACCIDENT' },
                  { id: 'falta_con_permiso', label: 'Falta con Permiso', payrollEventType: 'AUTHORIZED_ABSENCE' },
                  { id: 'falta_sin_aviso', label: 'Falta sin Aviso', payrollEventType: 'UNAUTHORIZED_ABSENCE' },
                  { id: 'vacaciones', label: 'Vacaciones', payrollEventType: 'VACATION' },
                  { id: 'suspension', label: 'Suspensión', payrollEventType: 'SUSPENSION' },
                ],
                allowSectorTransfer: true,
              },
            } : {}),
            ...(itemType === 'MATERIAL_INPUT' ? {
              materialConfig: {
                materials: [{ id: `mat_${Date.now()}`, name: '', unit: 'kg' }],
                trackingMode: 'PER_SHIFT' as const,
                allowAddMaterial: true,
              },
            } : {}),
          });
          totalItems++;
          itemIdx++;
        }

        setAISummary({
          files: processedFileNames,
          groups: [],
          totalItems,
        });

        toast.success(`Se cargaron ${totalItems} preguntas. Editá y guardá cuando estés listo.`);
      }

      // Close dialog and reset input state
      setShowAIDialog(false);
      setAIDescription('');
      setAIFiles([]);
      setAIGrouped(false);
    } catch (error) {
      console.error('Error generating with AI:', error);
      toast.error(error instanceof Error ? error.message : 'Error al generar con IA');
    } finally {
      setAILoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="relative">
        {/* Google Forms style background */}
        <div className="bg-gray-100 min-h-screen -m-6 p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Form Title Card - Google Forms style */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm border-t-8 border-t-blue-600">
              <div className="p-6 space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder="Formulario sin título"
                      className="text-3xl font-normal border-0 border-b border-transparent focus-visible:border-gray-300 rounded-none px-0 h-auto py-2 focus-visible:ring-0 bg-transparent"
                    />
                  )}
                />
                <Input
                  placeholder="Descripción del formulario (opcional)"
                  className="text-sm border-0 border-b border-transparent focus-visible:border-gray-300 rounded-none px-0 h-auto py-2 focus-visible:ring-0 bg-transparent text-gray-600"
                />

                {/* Sector selection - IMPORTANT: defines which employees will be shown */}
                <div className="flex items-center gap-3 pt-4 mt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Sector:</span>
                    <Select
                      value={form.watch('sectorId')?.toString() || 'none'}
                      onValueChange={(value) => {
                        form.setValue('sectorId', value === 'none' ? null : parseInt(value));
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm w-[180px] bg-white border-blue-300">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Todos los sectores</SelectItem>
                        {sectors.map((sector) => (
                          <SelectItem key={sector.id} value={sector.id.toString()}>
                            {sector.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-gray-500">
                    Solo empleados de este sector aparecerán al ejecutar
                  </p>
                </div>
              </div>
            </div>

            {/* AI Generation Summary */}
            {aiSummary && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileCheck className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-green-900">
                      IA procesó {aiSummary.files.length} archivo{aiSummary.files.length !== 1 ? 's' : ''} → {aiSummary.totalItems} preguntas generadas
                    </p>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium text-green-800">Archivos leídos:</p>
                      {aiSummary.files.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-green-700">
                          <span className="text-green-500">✓</span>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                    {aiSummary.groups.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium text-green-800">Secciones creadas:</p>
                        {aiSummary.groups.map((g, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-green-700">
                            <span className="bg-green-600 text-white rounded px-1.5 py-0 text-[10px] font-bold">{i + 1}</span>
                            <span>{g}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      className="text-xs text-green-600 hover:text-green-800 mt-2 underline"
                      onClick={() => setAISummary(null)}
                    >
                      Cerrar resumen
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Section navigation bar */}
            <SectionNavigator
              form={form}
              activeSectionId={activeSectionId}
              onSectionChange={setActiveSectionId}
              onAddSection={() => {
                setEditingSection({ id: `section_${Date.now()}`, name: '', description: '' });
                setShowSectionDialog(true);
              }}
              onEditSection={(section) => {
                setEditingSection(section);
                setShowSectionDialog(true);
              }}
            />

            {/* Questions with drag & drop */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={fields.map(f => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {fields.map((field, index) => {
                    // Filter by active section
                    const itemSectionId = form.getValues(`items.${index}.sectionId`);
                    const sections = form.getValues('sections') || [];
                    const hasSections = sections.length > 0;

                    // If sections exist, filter items by active section
                    if (hasSections) {
                      if (activeSectionId === null && itemSectionId) {
                        return null; // Hide items with sections when viewing "Sin sección"
                      }
                      if (activeSectionId !== null && itemSectionId !== activeSectionId) {
                        return null; // Hide items not in active section
                      }
                    }

                    // Check if this item starts a new AI group
                    // Use our schema item ID (q_xxx), NOT field.id which is RHF's internal ID
                    const itemId = form.getValues(`items.${index}.id`);
                    const prevItemId = index > 0 ? form.getValues(`items.${index - 1}.id`) : null;
                    const groupIdx = aiItemGroupMap[itemId];
                    const prevGroupIdx = prevItemId ? aiItemGroupMap[prevItemId] : -1;
                    const isNewGroup = aiGroups && groupIdx !== undefined && groupIdx !== prevGroupIdx;
                    const groupDef = isNewGroup && aiGroups ? aiGroups[groupIdx] : null;

                    // Check if item is disabled
                    const isDisabled = form.getValues(`items.${index}.disabled`);

                    return (
                      <React.Fragment key={field.id}>
                        {groupDef && (
                          <div className="relative mt-6 mb-2">
                            {/* Separator line */}
                            {groupIdx > 0 && (
                              <div className="absolute -top-4 left-0 right-0 border-t-2 border-purple-300" />
                            )}
                            <div className="bg-purple-100 border-2 border-purple-300 rounded-xl p-5 shadow-sm">
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                                  <span className="text-sm font-bold text-white">{groupIdx + 1}</span>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-base text-purple-900">{groupDef.name}</h3>
                                    {groupDef.isRepeatable && (
                                      <span className="text-[10px] font-semibold bg-purple-200 text-purple-700 rounded-full px-2 py-0.5">
                                        Repetible
                                      </span>
                                    )}
                                  </div>
                                  {groupDef.description && (
                                    <p className="text-sm text-purple-700 mt-0.5">{groupDef.description}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        <SortableQuestionCardWrapper id={field.id}>
                          <QuestionCard
                            index={index}
                            form={form}
                            isSelected={selectedIndex === index}
                            onSelect={() => setSelectedIndex(index)}
                            onRemove={() => {
                              remove(index);
                              if (selectedIndex >= fields.length - 1) {
                                setSelectedIndex(Math.max(0, fields.length - 2));
                              }
                            }}
                            onDuplicate={() => handleDuplicate(index)}
                            canRemove={fields.length > 1}
                            resourceTypes={resourceTypes}
                            allItems={fields.map((f, i) => ({
                              id: f.id,
                              question: form.watch(`items.${i}.question`) || '',
                              type: form.watch(`items.${i}.type`) || 'CHECK',
                              options: form.watch(`items.${i}.options`),
                            }))}
                            validation={itemValidations[index] || { isValid: true, warnings: [] }}
                            sections={form.watch('sections') || []}
                            onMoveToSection={(sectionId) => {
                              form.setValue(`items.${index}.sectionId`, sectionId);
                            }}
                          />
                        </SortableQuestionCardWrapper>
                      </React.Fragment>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>

            {/* Add question button - Google Forms style */}
            <button
              type="button"
              onClick={() => addQuestion()}
              className="w-full bg-white rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors p-6 text-center text-gray-500 hover:text-blue-600"
            >
              <Plus className="h-8 w-8 mx-auto mb-2" />
              <span className="text-sm font-medium">Agregar pregunta</span>
            </button>

            {/* Configuracion de completado y recordatorios */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Configuracion de completado
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <FormField
                  control={form.control}
                  name="maxCompletionTimeMinutes"
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-gray-600 whitespace-nowrap">Tiempo maximo:</Label>
                      <Input
                        type="number"
                        min={1}
                        className="w-20 h-8 text-sm"
                        value={field.value || 60}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 60)}
                      />
                      <span className="text-xs text-gray-500">min</span>
                    </div>
                  )}
                />
                <FormField
                  control={form.control}
                  name="enableCompletionReminders"
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                      <Label className="text-xs text-gray-600">Recordatorios Discord si excede</Label>
                    </div>
                  )}
                />
              </div>
            </div>

            {/* Action bar - at the end of the form */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center justify-between sticky bottom-4 z-10">
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                    <Label className="text-sm">{field.value ? 'Activa' : 'Inactiva'}</Label>
                  </div>
                )}
              />

              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  {fields.length} pregunta{fields.length !== 1 ? 's' : ''}
                </span>
                <Button type="button" variant="ghost" onClick={onCancel}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {isEditing ? 'Guardar' : 'Crear'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Floating toolbar */}
        <FloatingToolbar
          onAddQuestion={addQuestion}
          onOpenAI={() => setShowAIDialog(true)}
          onPreview={() => setShowPreviewDialog(true)}
          onMobilePreview={() => setShowMobilePreview(true)}
          onToggleChat={() => setShowChatPanel(!showChatPanel)}
          onOpenBlocks={() => setShowBlocksDialog(true)}
          hasValidationWarnings={hasValidationWarnings}
          chatOpen={showChatPanel}
          blocksCount={blocksCount}
        />

        {/* AI Chat Panel */}
        <AIChatPanel
          open={showChatPanel}
          onClose={() => setShowChatPanel(false)}
          items={watchedItems}
          onApplyActions={handleApplyChatActions}
        />
      </form>

      {/* Preview Dialog */}
      <PreviewDialog
        open={showPreviewDialog}
        onOpenChange={setShowPreviewDialog}
        items={watchedItems}
        formName={form.watch('name') || ''}
      />

      {/* Mobile Preview Dialog */}
      <MobilePreviewDialog
        open={showMobilePreview}
        onOpenChange={setShowMobilePreview}
        items={watchedItems}
        formName={form.watch('name') || ''}
      />

      {/* Blocks Library Dialog */}
      <BlocksDialog
        open={showBlocksDialog}
        onOpenChange={(open) => {
          setShowBlocksDialog(open);
          if (!open) setBlocksCount(getSavedBlocks().length);
        }}
        onInsertBlock={insertBlock}
        currentItem={watchedItems[selectedIndex]}
      />

      {/* Section Dialog */}
      <Dialog open={showSectionDialog} onOpenChange={(open) => {
        setShowSectionDialog(open);
        if (!open) setEditingSection(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-purple-600" />
              {editingSection?.name ? 'Editar sección' : 'Nueva sección'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre de la sección</Label>
              <Input
                placeholder="Ej: Verificaciones iniciales"
                value={editingSection?.name || ''}
                onChange={(e) => setEditingSection(prev => prev ? { ...prev, name: e.target.value } : null)}
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Input
                placeholder="Descripción breve..."
                value={editingSection?.description || ''}
                onChange={(e) => setEditingSection(prev => prev ? { ...prev, description: e.target.value } : null)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSectionDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!editingSection?.name?.trim()) {
                  toast.error('El nombre es requerido');
                  return;
                }
                const currentSections = form.getValues('sections') || [];
                const existingIdx = currentSections.findIndex((s: any) => s.id === editingSection.id);
                if (existingIdx >= 0) {
                  // Update existing
                  currentSections[existingIdx] = editingSection;
                } else {
                  // Add new
                  currentSections.push(editingSection);
                }
                form.setValue('sections', [...currentSections]);
                setShowSectionDialog(false);
                setEditingSection(null);
                toast.success(existingIdx >= 0 ? 'Sección actualizada' : 'Sección creada');
              }}
            >
              {editingSection?.name ? 'Guardar' : 'Crear sección'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Generation Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Generar con IA
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="text" className="mt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Describir
              </TabsTrigger>
              <TabsTrigger value="file" className="gap-2">
                <Upload className="h-4 w-4" />
                Subir archivos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Describí qué querés controlar y la IA generará las preguntas automáticamente.
              </p>
              <Textarea
                placeholder="Ej: Quiero una rutina diaria de viguetas con secciones de inicio del día, control de áridos, control por banco y cierre de jornada..."
                value={aiDescription}
                onChange={(e) => setAIDescription(e.target.value)}
                rows={5}
                className="resize-none"
              />
              {/* Grouped toggle for text mode */}
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  checked={aiGrouped}
                  onCheckedChange={setAIGrouped}
                  id="ai-grouped-text"
                />
                <Label htmlFor="ai-grouped-text" className="text-sm">
                  Agrupar en secciones
                </Label>
                <span className="text-xs text-muted-foreground">
                  (ej: &quot;Inicio del Día&quot;, &quot;Control Áridos&quot;, etc.)
                </span>
              </div>
            </TabsContent>

            <TabsContent value="file" className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Subí uno o varios PDFs/fotos de checklists. Si subís varios archivos, cada uno se convierte en una sección.
              </p>

              {/* File list */}
              {aiFiles.length > 0 && (
                <div className="space-y-2">
                  {aiFiles.map((file, idx) => (
                    <div key={`${file.name}-${idx}`} className="flex items-center gap-3 p-2 bg-purple-50 rounded-lg border border-purple-200">
                      <FileText className="h-5 w-5 text-purple-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => setAIFiles(prev => prev.filter((_, i) => i !== idx))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload area */}
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer border-gray-300 hover:border-purple-400 hover:bg-purple-50/50"
                onClick={() => document.getElementById('ai-file-input')?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500">
                  {aiFiles.length > 0 ? 'Agregar más archivos' : 'Click para seleccionar archivos'}
                </p>
                <p className="text-xs text-gray-400 mt-1">PDF, Word, JPG, PNG, TXT (max 10MB cada uno)</p>
                <input
                  id="ai-file-input"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.txt"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const newFiles = Array.from(e.target.files || []);
                    const valid: File[] = [];
                    for (const file of newFiles) {
                      if (file.size > 10 * 1024 * 1024) {
                        toast.error(`"${file.name}" supera 10MB`);
                        continue;
                      }
                      valid.push(file);
                    }
                    if (valid.length > 0) {
                      setAIFiles(prev => [...prev, ...valid]);
                    }
                    // Reset input to allow re-selecting same files
                    e.target.value = '';
                  }}
                />
              </div>

              <Textarea
                placeholder="(Opcional) Agregá contexto adicional sobre la rutina..."
                value={aiDescription}
                onChange={(e) => setAIDescription(e.target.value)}
                rows={2}
                className="resize-none"
              />

              {aiFiles.length > 1 && (
                <p className="text-xs text-purple-600 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {aiFiles.length} archivos = se generará una rutina agrupada con secciones automáticas
                </p>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowAIDialog(false);
                setAIDescription('');
                setAIFiles([]);
                setAIGrouped(false);
              }}
              disabled={aiLoading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleAIGenerate}
              disabled={aiLoading || (aiFiles.length === 0 && aiDescription.trim().length < 10)}
              className="bg-purple-600 hover:bg-purple-700 gap-2"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Form>
  );
}
