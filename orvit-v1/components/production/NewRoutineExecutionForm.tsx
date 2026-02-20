'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  useExecutionTemplates,
  useWorkCenters,
  useProductionResources,
  useProductionSectors,
  useWorkSectors,
  useRoutineEmployees,
} from '@/hooks/production/use-production-reference';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Camera,
  Upload,
  X,
  ImageIcon,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Layers,
  Users,
  GripVertical,
  Plus,
  RefreshCw,
  Trash2,
  Settings2,
  Calendar,
  Clock,
  Star,
  Square,
  Briefcase,
  XCircle,
  ArrowRightLeft,
  Package,
  Cog,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { SignatureCanvas } from '@/components/ui/signature-canvas';

const formSchema = z.object({
  templateId: z.number({ required_error: 'Seleccione una rutina' }),
  workCenterId: z.number().optional().nullable(),
  shiftId: z.number().optional().nullable(),
  date: z.string().min(1, 'La fecha es requerida'),
  hasIssues: z.boolean().default(false),
  issueDescription: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

// Resource and Employee types
interface ProductionResource {
  id: number;
  code: string;
  name: string;
  resourceType?: { id: number; code: string; name: string };
  status?: string;
  order?: number;
}

interface Employee {
  id: string; // UUID from database
  name: string;
  email?: string;
  avatar?: string;
  role?: string; // Puesto de trabajo (ej: "Zunchado de Paquetes")
  companyRole?: { id: number; name: string } | null;
}

interface TaskOption {
  id: string;
  label: string;
}

interface WorkSector {
  id: number;
  name: string;
  code?: string;
  sector?: { id: number; name: string } | null;
}

interface AbsenceReason {
  id: string;
  label: string;
  payrollEventType?: string;
}

interface EmployeeWithTasks {
  employeeId: string; // UUID from database
  employee?: Employee;
  tasks: string[];
  workSectorId?: number;
  workSector?: WorkSector;
  assignedRole?: string; // Puesto asignado para esta rutina (por defecto el role del empleado)
  status: 'PRESENT' | 'ABSENT' | 'TRANSFERRED';
  absenceReasonId?: string;
  transferSectorId?: number;
  transferAssignmentType?: 'TASK' | 'POSITION'; // Tipo de asignación en transferencia
  transferTask?: string; // Si es TASK: texto libre
  transferRole?: string; // Si es POSITION: puesto de trabajo en el sector destino
}

// New format: item with multiple inputs
interface RoutineInput {
  id: string;
  type: 'CHECK' | 'VALUE' | 'TEXT' | 'PHOTO' | 'SELECT' | 'CHECKBOX' | 'DATE' | 'TIME' | 'SIGNATURE' | 'RATING' | 'EMPLOYEE_SELECT' | 'RESOURCE_MULTI_SELECT' | 'RESOURCE_SEQUENCE_SELECT' | 'MATERIAL_INPUT';
  label?: string;
  required: boolean;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  allowMultiplePhotos?: boolean;
  placeholder?: string;
  // SELECT/CHECKBOX type
  options?: string[];
  selectDisplayMode?: 'list' | 'dropdown';
  // RATING type
  ratingMax?: number;
  // Resource select config
  resourceSelectConfig?: {
    resourceTypeCode: string;
    minSelection?: number;
    maxSelection?: number;
  };
  // Employee select config
  employeeSelectConfig?: {
    filterByWorkCenter?: boolean;
    taskAssignment?: boolean;
    taskOptions?: TaskOption[];
    workSectorAssignment?: boolean;
    attendanceTracking?: boolean;
    absenceReasons?: AbsenceReason[];
    allowSectorTransfer?: boolean;
  };
  // Photo timer config
  photoTimerConfig?: {
    delayMinutes: number;
    reminderMessage?: string;
  };
  // Material config
  materialConfig?: {
    materials: Array<{
      id: string;
      name: string;
      unit: string;
      expectedPerBatch?: number;
      linkedProductId?: number;
    }>;
    trackingMode: 'PER_SHIFT' | 'PER_BATCH' | 'PER_MIX';
    allowAddMaterial?: boolean;
    sourceMode?: 'MANUAL' | 'PURCHASES' | 'BOTH';
  };
  // Evidence policy
  evidencePolicy?: {
    requiredIf?: { inputId: string; equals: any };
    minPhotos?: number;
    photoTypes?: string[];
  };
  // Outcome config
  outcomeConfig?: {
    createIncidentIf?: { equals: any };
    createWorkOrderIf?: { equals: any };
    linkedResourceField?: string;
  };
  // Conditional display
  conditionalDisplay?: {
    showIf: { inputId: string; equals: any };
  };
}

interface RoutineSection {
  id: string;
  name: string;
  description?: string;
}

interface RoutineItem {
  id: string;
  description: string;
  // Section support
  sectionId?: string;
  disabled?: boolean;
  // New format: array of inputs
  inputs?: RoutineInput[];
  // Legacy format: single type (for backward compatibility)
  type?: 'CHECK' | 'VALUE' | 'TEXT' | 'PHOTO' | 'SELECT' | 'CHECKBOX' | 'DATE' | 'TIME' | 'SIGNATURE' | 'RATING' | 'EMPLOYEE_SELECT' | 'RESOURCE_MULTI_SELECT' | 'RESOURCE_SEQUENCE_SELECT';
  required?: boolean;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  allowMultiplePhotos?: boolean;
  options?: string[];
  ratingMax?: number;
  resourceSelectConfig?: RoutineInput['resourceSelectConfig'];
  employeeSelectConfig?: RoutineInput['employeeSelectConfig'];
}

// Helper to normalize item to always have inputs array
const normalizeItemInputs = (item: RoutineItem): RoutineInput[] => {
  // If item already has inputs array, use it
  if (item.inputs && Array.isArray(item.inputs) && item.inputs.length > 0) {
    return item.inputs;
  }

  // Build main input from item properties
  const mainInput: RoutineInput = {
    id: item.id + '_input',
    type: item.type || 'CHECK',
    label: '',
    required: item.required !== false,
    unit: item.unit,
    minValue: item.minValue,
    maxValue: item.maxValue,
    allowMultiplePhotos: item.allowMultiplePhotos,
    options: item.options,
    selectDisplayMode: (item as any).selectDisplayMode,
    ratingMax: item.ratingMax,
    resourceSelectConfig: item.resourceSelectConfig,
    employeeSelectConfig: item.employeeSelectConfig,
  };

  const inputs = [mainInput];

  // Check for additionalInputs (from template form) and add them
  const additionalInputs = (item as any).additionalInputs;
  if (additionalInputs && Array.isArray(additionalInputs)) {
    additionalInputs.forEach((addInput: any) => {
      inputs.push({
        id: addInput.id,
        type: addInput.type || 'TEXT',
        label: addInput.label || '',
        required: addInput.required || false,
        unit: addInput.unit,
        minValue: addInput.minValue,
        maxValue: addInput.maxValue,
        options: addInput.options?.map((o: any) => typeof o === 'string' ? o : o.text),
        selectDisplayMode: addInput.selectDisplayMode,
        ratingMax: addInput.ratingMax,
        conditionalDisplay: addInput.conditionalDisplay,
      });
    });
  }

  return inputs;
};

// Evalúa si un ítem debe mostrarse según su conditionalDisplay
const isItemVisible = (
  item: RoutineItem,
  allItems: RoutineItem[],
  responses: Record<string, { value: any; photos?: string[] }>
): boolean => {
  const cond = (item as any).conditionalDisplay;
  if (!cond) return true;

  const { parentItemId, parentValue } = cond;
  const parentItem = allItems.find(i => i.id === parentItemId);
  if (!parentItem) return false;

  // Resolver el ID del input principal del padre
  const parentInputId =
    parentItem.inputs && parentItem.inputs.length > 0
      ? parentItem.inputs[0].id
      : parentItem.id + '_input';

  const parentResponse = responses[parentInputId];

  // CHECK almacena boolean, pero parentValue es "Sí"/"No"
  const parentMainType =
    parentItem.inputs && parentItem.inputs.length > 0
      ? parentItem.inputs[0].type
      : (parentItem as any).type;

  if (parentMainType === 'CHECK') {
    return parentResponse?.value === (parentValue === 'Sí' ? true : false);
  }

  // SELECT y otros tipos: comparación directa
  return parentResponse?.value === parentValue;
};

interface RoutineGroup {
  id: string;
  name: string;
  description?: string;
  collapsed?: boolean;
  order: number;
  items: RoutineItem[];
  // Advanced configurations
  isRepeatable?: boolean; // Allow adding instances ad-hoc
  repeatableConfig?: {
    buttonLabel?: string;
    instanceLabel?: string;
  };
  cadence?: {
    every: number;
    startAt?: number;
  };
  linkedSequenceId?: string; // Repeat per resource in pre-execution sequence
}

interface RoutineTemplate {
  id: number;
  code: string;
  name: string;
  type: string;
  items: RoutineItem[];
  groups?: RoutineGroup[];
  sections?: RoutineSection[];
  itemsStructure?: 'flat' | 'hierarchical';
  workCenter: { id: number; name: string; code: string } | null;
  sector: { id: number; name: string } | null;
  preExecutionInputs?: RoutineInput[];
}

interface DraftToResume {
  id: number;
  responses: any[];
  startedAt: string;
  template: RoutineTemplate;
}

interface NewRoutineExecutionFormProps {
  preselectedTemplate?: RoutineTemplate | null;
  draftToResume?: DraftToResume | null;
  onSuccess: () => void;
  onCancel: () => void;
}

// ============================================================================
// INPUT RENDERER COMPONENT (renders individual input within an item)
// ============================================================================

interface InputRendererProps {
  input: RoutineInput;
  inputId: string;
  response: { value: any; photos?: string[] };
  onValueChange: (value: any) => void;
  onPhotoUpload: (file: File) => void;
  onPhotoRemove: (photoIndex: number) => void;
  uploadingPhoto: boolean;
  // Props for resource/employee selection
  availableResources?: ProductionResource[];
  availableEmployees?: Employee[];
  availableWorkSectors?: WorkSector[];
  availableSectors?: { id: number; name: string }[];
  allSectorRoles?: string[]; // Todos los puestos del sector
  allResponses?: Record<string, { value: any; photos?: string[] }>; // For conditional display
  // Employee filter context
  employeeSectorName?: string | null;
  showingAllEmployees?: boolean;
  onShowAllEmployeesClick?: () => void;
}

function InputRenderer({
  input,
  inputId,
  response,
  onValueChange,
  onPhotoUpload,
  onPhotoRemove,
  uploadingPhoto,
  availableResources = [],
  availableEmployees = [],
  availableWorkSectors = [],
  availableSectors = [],
  allSectorRoles = [],
  allResponses = {},
  employeeSectorName,
  showingAllEmployees,
  onShowAllEmployeesClick,
}: InputRendererProps) {
  // Filter resources by type if configured - MUST be before any early returns
  const filteredResources = useMemo(() => {
    if (!input.resourceSelectConfig?.resourceTypeCode) return availableResources;
    return availableResources.filter(
      r => r.resourceType?.code === input.resourceSelectConfig?.resourceTypeCode
    );
  }, [availableResources, input.resourceSelectConfig?.resourceTypeCode]);

  // Check conditional display - AFTER hooks
  if (input.conditionalDisplay?.showIf) {
    const { inputId: condInputId, equals } = input.conditionalDisplay.showIf;
    const condResponse = allResponses[condInputId];
    if (condResponse?.value !== equals) {
      return null; // Don't render if condition not met
    }
  }

  const label = input.label || (
    input.type === 'CHECK' ? 'Verificación' :
    input.type === 'VALUE' ? 'Valor' :
    input.type === 'TEXT' ? 'Observaciones' :
    input.type === 'SELECT' ? 'Selección' :
    input.type === 'EMPLOYEE_SELECT' ? 'Personal' :
    input.type === 'RESOURCE_MULTI_SELECT' ? 'Recursos' :
    input.type === 'RESOURCE_SEQUENCE_SELECT' ? 'Secuencia' :
    'Foto'
  );

  return (
    <div className="space-y-2">
      {/* Label - only show if there's a custom label */}
      {input.label && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          {input.required && (
            <Badge variant="outline" className="text-xs px-1.5 py-0">Req.</Badge>
          )}
        </div>
      )}

      {/* Check type - Large touch-friendly buttons */}
      {input.type === 'CHECK' && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant={response?.value === true ? 'default' : 'outline'}
            size="lg"
            className={cn(
              "flex-1 h-10 text-sm touch-manipulation",
              response?.value === true ? 'bg-success hover:bg-success/90' : ''
            )}
            onClick={() => onValueChange(true)}
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Sí
          </Button>
          <Button
            type="button"
            variant={response?.value === false ? 'destructive' : 'outline'}
            size="sm"
            className="flex-1 h-10 text-sm touch-manipulation"
            onClick={() => onValueChange(false)}
          >
            <AlertTriangle className="h-4 w-4 mr-1.5" />
            No
          </Button>
        </div>
      )}

      {/* Value type - Mobile optimized */}
      {input.type === 'VALUE' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Ingrese valor"
              className="flex-1 h-9 text-sm"
              value={response?.value || ''}
              onChange={(e) => onValueChange(e.target.value)}
            />
            {input.unit && (
              <span className="text-sm font-medium text-muted-foreground px-1">{input.unit}</span>
            )}
          </div>
          {input.minValue !== undefined && input.maxValue !== undefined && (
            <span className="text-sm text-muted-foreground">
              Rango válido: {input.minValue} - {input.maxValue}
            </span>
          )}
        </div>
      )}

      {/* Text type - Mobile optimized */}
      {input.type === 'TEXT' && (
        <Textarea
          placeholder={input.placeholder || 'Escriba aquí...'}
          rows={2}
          className="text-sm min-h-[70px]"
          value={response?.value || ''}
          onChange={(e) => onValueChange(e.target.value)}
        />
      )}

      {/* Photo type - ALWAYS allows multiple photos */}
      {input.type === 'PHOTO' && (
        <div className="space-y-3">
          {response?.photos && response.photos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {response.photos.map((photoUrl, photoIndex) => (
                <div key={photoIndex} className="relative group aspect-square">
                  <img
                    src={photoUrl}
                    alt={`Foto ${photoIndex + 1}`}
                    className="w-full h-full object-cover rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={() => onPhotoRemove(photoIndex)}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 shadow-md"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              id={`photo-camera-${inputId}`}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onPhotoUpload(file);
                e.target.value = '';
              }}
              disabled={uploadingPhoto}
            />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id={`photo-upload-${inputId}`}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onPhotoUpload(file);
                e.target.value = '';
              }}
              disabled={uploadingPhoto}
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => document.getElementById(`photo-camera-${inputId}`)?.click()}
              disabled={uploadingPhoto}
              className="flex-1 h-9 text-xs"
            >
              {uploadingPhoto ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
              Foto
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => document.getElementById(`photo-upload-${inputId}`)?.click()}
              disabled={uploadingPhoto}
              className="flex-1 h-9 text-xs"
            >
              {uploadingPhoto ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Galería
            </Button>
          </div>

          {response?.photos && response.photos.length > 0 ? (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              {response.photos.length} foto{response.photos.length !== 1 ? 's' : ''} subida{response.photos.length !== 1 ? 's' : ''}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
              {input.required ? 'Al menos 1 foto requerida' : 'Fotos opcionales'}
            </div>
          )}
        </div>
      )}

      {/* DATE type */}
      {input.type === 'DATE' && (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            className="flex-1 h-9 text-sm"
            value={response?.value || ''}
            onChange={(e) => onValueChange(e.target.value)}
          />
        </div>
      )}

      {/* TIME type */}
      {input.type === 'TIME' && (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Input
            type="time"
            className="flex-1 h-9 text-sm"
            value={response?.value || ''}
            onChange={(e) => onValueChange(e.target.value)}
          />
        </div>
      )}

      {/* CHECKBOX type - Multiple selection */}
      {input.type === 'CHECKBOX' && input.options && (
        <div className="space-y-1">
          {input.options.map((option, optIdx) => {
            const selectedOptions = Array.isArray(response?.value) ? response.value : [];
            const isChecked = selectedOptions.includes(option);
            return (
              <div
                key={optIdx}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                  isChecked ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                )}
                onClick={() => {
                  const newValue = isChecked
                    ? selectedOptions.filter((v: string) => v !== option)
                    : [...selectedOptions, option];
                  onValueChange(newValue);
                }}
              >
                <div className={cn(
                  "h-4 w-4 rounded border-2 flex items-center justify-center transition-colors",
                  isChecked ? "bg-primary border-primary" : "border-border"
                )}>
                  {isChecked && <CheckSquare className="h-3 w-3 text-white" />}
                </div>
                <span className="text-xs flex-1">{option}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* RATING type - Star rating - Mobile optimized */}
      {input.type === 'RATING' && (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-0.5 sm:gap-1 flex-wrap">
            {Array.from({ length: input.ratingMax || 5 }).map((_, idx) => {
              const starValue = idx + 1;
              const isSelected = (response?.value || 0) >= starValue;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onValueChange(starValue)}
                  className="p-1.5 touch-manipulation active:scale-110 transition-transform"
                >
                  <Star
                    className={cn(
                      "h-7 w-7 sm:h-8 sm:w-8 transition-colors",
                      isSelected ? "fill-warning text-warning" : "text-muted-foreground/50"
                    )}
                  />
                </button>
              );
            })}
          </div>
          {response?.value ? (
            <p className="text-center text-sm font-medium text-primary">
              {response.value} de {input.ratingMax || 5}
            </p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Toque para calificar
            </p>
          )}
        </div>
      )}

      {/* SIGNATURE type - Touch-enabled canvas */}
      {input.type === 'SIGNATURE' && (
        <div className="space-y-2">
          {response?.value ? (
            <div className="space-y-2">
              <div className="border rounded-lg overflow-hidden bg-background">
                <img
                  src={response.value}
                  alt="Firma"
                  className="w-full h-32 object-contain"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-success flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Firma guardada
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onValueChange(null)}
                >
                  Volver a firmar
                </Button>
              </div>
            </div>
          ) : (
            <SignatureCanvas
              onSave={(dataUrl) => onValueChange(dataUrl)}
              onClear={() => onValueChange(null)}
              height={150}
              className="w-full"
            />
          )}
        </div>
      )}

      {/* SELECT type - List or Dropdown based on config */}
      {input.type === 'SELECT' && input.options && (
        input.selectDisplayMode === 'dropdown' ? (
          // Dropdown mode
          <Select
            value={response?.value as string || ''}
            onValueChange={onValueChange}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              {input.options.map((option, optIdx) => (
                <SelectItem key={optIdx} value={option} className="text-sm py-2">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          // List mode (default)
          <div className="space-y-1">
            {input.options.map((option, optIdx) => (
              <div
                key={optIdx}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors touch-manipulation",
                  response?.value === option
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                )}
                onClick={() => onValueChange(option)}
              >
                <div className={cn(
                  "h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors",
                  response?.value === option
                    ? "border-primary"
                    : "border-border"
                )}>
                  {response?.value === option && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
                <span className="text-xs flex-1">{option}</span>
              </div>
            ))}
          </div>
        )
      )}

      {/* EMPLOYEE_SELECT type - Select employees with work sector and task assignment */}
      {input.type === 'EMPLOYEE_SELECT' && (
        <EmployeeSelectRenderer
          input={input}
          employees={availableEmployees}
          workSectors={availableWorkSectors}
          sectors={availableSectors}
          value={response?.value as EmployeeWithTasks[] || []}
          onChange={onValueChange}
          sectorName={employeeSectorName}
          showingAllEmployees={showingAllEmployees}
          onShowAllEmployeesClick={onShowAllEmployeesClick}
          allSectorRoles={allSectorRoles}
        />
      )}

      {/* RESOURCE_MULTI_SELECT type - Checkbox selection of resources */}
      {input.type === 'RESOURCE_MULTI_SELECT' && (
        <ResourceMultiSelectRenderer
          resources={filteredResources}
          value={response?.value as number[] || []}
          onChange={onValueChange}
          maxSelection={input.resourceSelectConfig?.maxSelection}
        />
      )}

      {/* RESOURCE_SEQUENCE_SELECT type - Ordered drag & drop selection */}
      {input.type === 'RESOURCE_SEQUENCE_SELECT' && (
        <ResourceSequenceSelectRenderer
          resources={filteredResources}
          value={response?.value as number[] || []}
          onChange={onValueChange}
          minSelection={input.resourceSelectConfig?.minSelection}
        />
      )}

      {/* MATERIAL_INPUT type - Track material quantities per shift/batch/mix */}
      {input.type === 'MATERIAL_INPUT' && (
        <MaterialInputRenderer
          input={input}
          value={response?.value as MaterialInputValue || { entries: [] }}
          onChange={onValueChange}
        />
      )}

      {/* MACHINE_SELECT type - Select machine/equipment */}
      {input.type === 'MACHINE_SELECT' && (
        <MachineSelectRenderer
          input={input}
          value={response?.value as MachineSelection[] || []}
          onChange={onValueChange}
        />
      )}
    </div>
  );
}

// ============================================================================
// EMPLOYEE SELECT RENDERER - With Attendance, Work Sector & Transfer Support
// ============================================================================

const DEFAULT_ABSENCE_REASONS: AbsenceReason[] = [
  { id: 'carpeta_medica', label: 'Carpeta Médica', payrollEventType: 'SICK_LEAVE' },
  { id: 'accidente_trabajo', label: 'Accidente de Trabajo', payrollEventType: 'ACCIDENT' },
  { id: 'falta_con_permiso', label: 'Falta con Permiso', payrollEventType: 'ABSENCE' },
  { id: 'falta_sin_aviso', label: 'Falta sin Aviso', payrollEventType: 'ABSENCE' },
  { id: 'vacaciones', label: 'Vacaciones', payrollEventType: 'VACATION' },
  { id: 'suspension', label: 'Suspensión', payrollEventType: 'SUSPENSION' },
];

interface EmployeeSelectRendererProps {
  input: RoutineInput;
  employees: Employee[];
  workSectors: WorkSector[];
  sectors: { id: number; name: string }[];
  value: EmployeeWithTasks[];
  onChange: (value: EmployeeWithTasks[]) => void;
  sectorName?: string | null; // For showing in empty state message
  showingAllEmployees?: boolean;
  onShowAllEmployeesClick?: () => void;
  allSectorRoles?: string[]; // Todos los puestos de trabajo del sector (de la API)
}

function EmployeeSelectRenderer({ input, employees, workSectors, sectors, value, onChange, sectorName, showingAllEmployees, onShowAllEmployeesClick, allSectorRoles = [] }: EmployeeSelectRendererProps) {
  const taskOptions = input.employeeSelectConfig?.taskOptions || [];
  const hasTaskAssignment = input.employeeSelectConfig?.taskAssignment && taskOptions.length > 0;
  // Check if config enables work sector assignment
  const workSectorConfigEnabled = input.employeeSelectConfig?.workSectorAssignment ?? false;
  const hasAttendanceTracking = input.employeeSelectConfig?.attendanceTracking ?? false;
  const allowSectorTransfer = input.employeeSelectConfig?.allowSectorTransfer ?? false;
  const absenceReasons = input.employeeSelectConfig?.absenceReasons?.length
    ? input.employeeSelectConfig.absenceReasons
    : DEFAULT_ABSENCE_REASONS;

  // Obtener lista de puestos únicos - usar allSectorRoles de la API si está disponible
  // De lo contrario, extraer de los empleados cargados
  const availableRoles = React.useMemo(() => {
    // Si tenemos allSectorRoles de la API, usarlo (tiene TODOS los puestos del sector)
    if (allSectorRoles.length > 0) {
      return allSectorRoles;
    }
    // Fallback: extraer de los empleados cargados
    const roles = employees
      .map(emp => emp.role)
      .filter((role): role is string => !!role && role.trim() !== '');
    return [...new Set(roles)].sort();
  }, [employees, allSectorRoles]);

  // Cache de puestos de trabajo por sector (para transferencias)
  const [transferSectorRoles, setTransferSectorRoles] = React.useState<Record<number, string[]>>({});
  const [loadingTransferRoles, setLoadingTransferRoles] = React.useState<Record<number, boolean>>({});

  // Función para cargar puestos de trabajo de un sector específico
  const loadRolesForSector = React.useCallback(async (sectorId: number) => {
    // Si ya tenemos los roles o estamos cargando, no hacer nada
    if (transferSectorRoles[sectorId] || loadingTransferRoles[sectorId]) {
      return;
    }

    setLoadingTransferRoles(prev => ({ ...prev, [sectorId]: true }));
    try {
      const response = await fetch(`/api/production/routines/employees?sectorId=${sectorId}`);
      const data = await response.json();
      if (data.success && data.allSectorRoles) {
        setTransferSectorRoles(prev => ({ ...prev, [sectorId]: data.allSectorRoles }));
      }
    } catch (error) {
      console.error('Error loading roles for sector:', sectorId, error);
    } finally {
      setLoadingTransferRoles(prev => ({ ...prev, [sectorId]: false }));
    }
  }, [transferSectorRoles, loadingTransferRoles]);

  // Obtener roles para un sector de transferencia específico
  const getRolesForTransferSector = (sectorId: number | undefined): string[] => {
    if (!sectorId) return [];
    return transferSectorRoles[sectorId] || [];
  };

  // Auto-populate all employees as PRESENT if attendance tracking is on and value is empty
  // Use ref to prevent double-triggers within the same render cycle
  const isPopulatingRef = React.useRef(false);

  React.useEffect(() => {
    // Skip if already populating (prevents double-trigger)
    if (isPopulatingRef.current) {
      return;
    }

    // Conditions to auto-populate:
    // 1. Attendance tracking is enabled for this input
    // 2. We have employees loaded from the API
    // 3. Value is currently empty (either initial state or reset by Fast Refresh)
    const shouldPopulate = hasAttendanceTracking
      && employees.length > 0
      && value.length === 0;

    if (shouldPopulate) {
      isPopulatingRef.current = true;

      // Use setTimeout to:
      // 1. Avoid React state update batching issues
      // 2. Let the current render cycle complete before updating
      setTimeout(() => {
        onChange(employees.map(emp => ({
          employeeId: emp.id,
          employee: emp,
          tasks: [],
          status: 'PRESENT' as const,
          assignedRole: emp.role || undefined,
        })));
        // Reset the flag after a short delay to allow for the state update
        setTimeout(() => {
          isPopulatingRef.current = false;
        }, 100);
      }, 0);
    }
  }, [hasAttendanceTracking, employees, value.length, onChange]);

  const toggleEmployee = (employeeId: string) => {
    const existing = value.find(e => e.employeeId === employeeId);
    if (existing) {
      onChange(value.filter(e => e.employeeId !== employeeId));
    } else {
      // Inicializar con el role del empleado como puesto asignado
      const emp = employees.find(e => e.id === employeeId);
      onChange([...value, {
        employeeId,
        tasks: [],
        status: 'PRESENT',
        assignedRole: emp?.role || undefined, // Puesto por defecto
      }]);
    }
  };

  const setEmployeeStatus = (employeeId: string, status: 'PRESENT' | 'ABSENT' | 'TRANSFERRED') => {
    onChange(value.map(e => {
      if (e.employeeId !== employeeId) return e;
      return {
        ...e,
        status,
        absenceReasonId: status === 'ABSENT' ? e.absenceReasonId : undefined,
        transferSectorId: status === 'TRANSFERRED' ? e.transferSectorId : undefined,
        transferAssignmentType: status === 'TRANSFERRED' ? (e.transferAssignmentType || 'TASK') : undefined,
        transferTask: status === 'TRANSFERRED' ? e.transferTask : undefined,
        transferRole: status === 'TRANSFERRED' ? e.transferRole : undefined,
      };
    }));
  };

  const setAbsenceReason = (employeeId: string, reasonId: string) => {
    onChange(value.map(e => {
      if (e.employeeId !== employeeId) return e;
      return { ...e, absenceReasonId: reasonId };
    }));
  };

  const setTransferSector = (employeeId: string, sectorId: number | undefined) => {
    onChange(value.map(e => {
      if (e.employeeId !== employeeId) return e;
      // Limpiar el puesto anterior cuando cambia el sector
      return { ...e, transferSectorId: sectorId, transferRole: undefined };
    }));
    // Cargar los puestos de trabajo del nuevo sector
    if (sectorId) {
      loadRolesForSector(sectorId);
    }
  };

  const setTransferTask = (employeeId: string, task: string) => {
    onChange(value.map(e => {
      if (e.employeeId !== employeeId) return e;
      return { ...e, transferTask: task };
    }));
  };

  const setTransferAssignmentType = (employeeId: string, assignmentType: 'TASK' | 'POSITION') => {
    onChange(value.map(e => {
      if (e.employeeId !== employeeId) return e;
      return {
        ...e,
        transferAssignmentType: assignmentType,
        // Limpiar el campo opuesto cuando se cambia el tipo
        transferTask: assignmentType === 'TASK' ? e.transferTask : undefined,
        transferRole: assignmentType === 'POSITION' ? e.transferRole : undefined,
      };
    }));
  };

  const setAssignedRole = (employeeId: string, role: string) => {
    onChange(value.map(e => {
      if (e.employeeId !== employeeId) return e;
      return { ...e, assignedRole: role };
    }));
  };

  const setTransferRole = (employeeId: string, role: string) => {
    onChange(value.map(e => {
      if (e.employeeId !== employeeId) return e;
      return { ...e, transferRole: role };
    }));
  };

  const toggleTask = (employeeId: string, taskId: string) => {
    onChange(value.map(e => {
      if (e.employeeId !== employeeId) return e;
      const hasTasks = e.tasks.includes(taskId);
      return {
        ...e,
        tasks: hasTasks
          ? e.tasks.filter(t => t !== taskId)
          : [...e.tasks, taskId],
      };
    }));
  };

  const setWorkSector = (employeeId: string, workSectorId: number | undefined) => {
    onChange(value.map(e => {
      if (e.employeeId !== employeeId) return e;
      return {
        ...e,
        workSectorId,
        workSector: workSectorId ? workSectors.find(ws => ws.id === workSectorId) : undefined,
      };
    }));
  };

  const selectedIds = value.map(e => e.employeeId);
  const presentCount = value.filter(e => e.status === 'PRESENT').length;
  const absentCount = value.filter(e => e.status === 'ABSENT').length;
  const transferredCount = value.filter(e => e.status === 'TRANSFERRED').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT': return 'border-success-muted bg-success-muted';
      case 'ABSENT': return 'border-destructive/30 bg-destructive/10';
      case 'TRANSFERRED': return 'border-warning-muted bg-warning-muted';
      default: return '';
    }
  };

  return (
    <div className="space-y-2">
      {/* Header with sector info */}
      {sectorName && (
        <div className="text-xs text-muted-foreground pb-1 border-b">
          <span>Sector: {sectorName} ({employees.length} empleados)</span>
        </div>
      )}
      {employees.length === 0 ? (
        <div className="text-center py-4">
          <Users className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            {sectorName
              ? `No hay empleados asignados al sector "${sectorName}"`
              : 'No hay empleados disponibles'}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {employees.map((emp) => {
            const isSelected = selectedIds.includes(emp.id);
            const empEntry = value.find(e => e.employeeId === emp.id);
            const empStatus = empEntry?.status || 'PRESENT';

            return (
              <div
                key={emp.id}
                className={cn(
                  'border rounded-lg p-2 transition-colors',
                  hasAttendanceTracking && isSelected ? getStatusColor(empStatus) : '',
                  !hasAttendanceTracking && isSelected ? 'border-primary bg-primary/5' : '',
                  !isSelected ? 'hover:bg-muted/50' : ''
                )}
              >
                <div className="flex items-center gap-2">
                  {/* Checkbox only in non-attendance mode */}
                  {!hasAttendanceTracking && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleEmployee(emp.id)}
                      className="h-4 w-4"
                    />
                  )}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {emp.avatar ? (
                      <img
                        src={emp.avatar}
                        alt={emp.name}
                        className="h-7 w-7 rounded-full flex-shrink-0"
                      />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="text-xs font-medium block truncate">{emp.name}</span>
                      {emp.role && (
                        <span className="text-[10px] text-muted-foreground">{emp.role}</span>
                      )}
                    </div>
                  </div>

                  {/* Status toggle buttons (attendance mode) */}
                  {hasAttendanceTracking && isSelected && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className={cn(
                          'p-1.5 rounded-md transition-colors',
                          empStatus === 'PRESENT' ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground hover:bg-success-muted'
                        )}
                        onClick={() => setEmployeeStatus(emp.id, 'PRESENT')}
                        title="Presente"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className={cn(
                          'p-1.5 rounded-md transition-colors',
                          empStatus === 'ABSENT' ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground hover:bg-destructive/10'
                        )}
                        onClick={() => setEmployeeStatus(emp.id, 'ABSENT')}
                        title="Ausente"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                      {allowSectorTransfer && (
                        <button
                          type="button"
                          className={cn(
                            'p-1.5 rounded-md transition-colors',
                            empStatus === 'TRANSFERRED' ? 'bg-warning text-warning-foreground' : 'bg-muted text-muted-foreground hover:bg-warning-muted'
                          )}
                          onClick={() => setEmployeeStatus(emp.id, 'TRANSFERRED')}
                          title="En otro sector"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Absence reason dropdown */}
                {isSelected && empStatus === 'ABSENT' && (
                  <div className="mt-2 ml-6 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                      <span className="text-[10px] font-medium text-destructive">Motivo de ausencia:</span>
                    </div>
                    <Select
                      value={empEntry?.absenceReasonId || ''}
                      onValueChange={(val) => setAbsenceReason(emp.id, val)}
                    >
                      <SelectTrigger className="h-8 text-xs border-destructive/20">
                        <SelectValue placeholder="Seleccionar motivo..." />
                      </SelectTrigger>
                      <SelectContent>
                        {absenceReasons.map((reason) => (
                          <SelectItem key={reason.id} value={reason.id} className="text-xs">
                            {reason.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Transfer sector + task/position */}
                {isSelected && empStatus === 'TRANSFERRED' && (
                  <div className="mt-2 ml-6 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <ArrowRightLeft className="h-3.5 w-3.5 text-warning" />
                      <span className="text-[10px] font-medium text-warning-muted-foreground">Transferido a:</span>
                    </div>
                    <Select
                      value={empEntry?.transferSectorId?.toString() || ''}
                      onValueChange={(val) => setTransferSector(emp.id, val ? parseInt(val) : undefined)}
                    >
                      <SelectTrigger className="h-8 text-xs border-warning-muted">
                        <SelectValue placeholder="Seleccionar sector destino..." />
                      </SelectTrigger>
                      <SelectContent>
                        {sectors.map((s) => (
                          <SelectItem key={s.id} value={s.id.toString()} className="text-xs">
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Después de seleccionar sector, mostrar opciones de asignación */}
                    {empEntry?.transferSectorId && (
                      <>
                        {/* Toggle entre Tarea y Puesto */}
                        <div className="flex gap-1 mt-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn(
                              'h-6 px-2 text-[10px] flex-1',
                              (!empEntry.transferAssignmentType || empEntry.transferAssignmentType === 'TASK')
                                ? 'bg-warning-muted text-warning-muted-foreground border border-warning-muted'
                                : 'text-muted-foreground hover:bg-warning-muted'
                            )}
                            onClick={() => setTransferAssignmentType(emp.id, 'TASK')}
                          >
                            Tarea libre
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn(
                              'h-6 px-2 text-[10px] flex-1',
                              empEntry.transferAssignmentType === 'POSITION'
                                ? 'bg-warning-muted text-warning-muted-foreground border border-warning-muted'
                                : 'text-muted-foreground hover:bg-warning-muted'
                            )}
                            onClick={() => setTransferAssignmentType(emp.id, 'POSITION')}
                          >
                            Puesto de trabajo
                          </Button>
                        </div>

                        {/* Input de tarea libre */}
                        {(!empEntry.transferAssignmentType || empEntry.transferAssignmentType === 'TASK') && (
                          <Input
                            placeholder="Tarea que realiza en el otro sector..."
                            value={empEntry?.transferTask || ''}
                            onChange={(e) => setTransferTask(emp.id, e.target.value)}
                            className="h-8 text-xs border-warning-muted"
                          />
                        )}

                        {/* Selector de puesto de trabajo del sector destino */}
                        {empEntry.transferAssignmentType === 'POSITION' && (
                          <Select
                            value={empEntry?.transferRole || ''}
                            onValueChange={(val) => setTransferRole(emp.id, val)}
                            disabled={loadingTransferRoles[empEntry.transferSectorId!]}
                          >
                            <SelectTrigger className="h-8 text-xs border-warning-muted bg-warning-muted/50">
                              <SelectValue placeholder={
                                loadingTransferRoles[empEntry.transferSectorId!]
                                  ? "Cargando puestos..."
                                  : "Seleccionar puesto..."
                              } />
                            </SelectTrigger>
                            <SelectContent>
                              {getRolesForTransferSector(empEntry.transferSectorId).length > 0 ? (
                                getRolesForTransferSector(empEntry.transferSectorId).map((role) => (
                                  <SelectItem key={role} value={role} className="text-xs">
                                    {role}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                  No hay puestos definidos para este sector
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Job position assignment - only for PRESENT */}
                {isSelected && empStatus === 'PRESENT' && workSectorConfigEnabled && (
                  <div className="mt-2 ml-6 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-info" />
                      <span className="text-[10px] font-medium text-info-muted-foreground">Puesto de trabajo:</span>
                    </div>
                    <Select
                      value={empEntry?.assignedRole || emp.role || ''}
                      onValueChange={(val) => setAssignedRole(emp.id, val)}
                    >
                      <SelectTrigger className="h-8 text-xs border-info-muted bg-info-muted/50">
                        <SelectValue placeholder="Seleccionar puesto..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRoles.map((role) => (
                          <SelectItem key={role} value={role} className="text-xs">
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {emp.role && empEntry?.assignedRole && emp.role !== empEntry.assignedRole && (
                      <p className="text-[9px] text-muted-foreground">
                        Puesto original: {emp.role}
                      </p>
                    )}
                  </div>
                )}

                {/* Task assignment - only for PRESENT */}
                {isSelected && empStatus === 'PRESENT' && hasTaskAssignment && (
                  <div className="mt-2 ml-6">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[10px] font-medium text-muted-foreground">Tareas asignadas:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {taskOptions.map((task) => (
                        <Badge
                          key={task.id}
                          variant={empEntry?.tasks.includes(task.id) ? 'default' : 'outline'}
                          className="cursor-pointer text-[10px] py-0.5 px-1.5"
                          onClick={() => toggleTask(emp.id, task.id)}
                        >
                          {task.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary footer */}
      {value.length > 0 && (
        <div className="text-xs text-muted-foreground pt-1.5 border-t flex flex-wrap gap-2">
          {hasAttendanceTracking ? (
            <>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-success" />
                <strong>{presentCount}</strong> presente{presentCount !== 1 ? 's' : ''}
              </span>
              {absentCount > 0 && (
                <span className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-destructive" />
                  <strong>{absentCount}</strong> ausente{absentCount !== 1 ? 's' : ''}
                </span>
              )}
              {transferredCount > 0 && (
                <span className="flex items-center gap-1">
                  <ArrowRightLeft className="h-3 w-3 text-warning" />
                  <strong>{transferredCount}</strong> transferido{transferredCount !== 1 ? 's' : ''}
                </span>
              )}
            </>
          ) : (
            <>
              <strong>{selectedIds.length}</strong> empleado{selectedIds.length !== 1 ? 's' : ''} seleccionado{selectedIds.length !== 1 ? 's' : ''}
              {value.filter(e => e.workSectorId).length > 0 && (
                <span>
                  ({value.filter(e => e.workSectorId).length} con puesto asignado)
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MATERIAL INPUT RENDERER - Track quantities per material per shift/batch/mix
// ============================================================================

interface MaterialEntry {
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  batchRef?: string;
}

interface MaterialInputValue {
  entries: MaterialEntry[];
}

interface MaterialInputRendererProps {
  input: RoutineInput;
  value: MaterialInputValue;
  onChange: (value: MaterialInputValue) => void;
}

function MaterialInputRenderer({ input, value, onChange }: MaterialInputRendererProps) {
  const config = input.materialConfig;
  if (!config) return <p className="text-sm text-muted-foreground">Configuración de materiales no encontrada</p>;

  const materials = config.materials || [];
  const trackingMode = config.trackingMode || 'PER_SHIFT';
  const [batches, setBatches] = React.useState<string[]>(
    () => {
      if (trackingMode === 'PER_SHIFT') return ['turno'];
      const existing = [...new Set(value.entries.map(e => e.batchRef).filter(Boolean))] as string[];
      return existing.length > 0 ? existing : ['1'];
    }
  );

  const getQuantity = (materialId: string, batchRef?: string): string => {
    const entry = value.entries.find(e =>
      e.materialId === materialId && (trackingMode === 'PER_SHIFT' || e.batchRef === batchRef)
    );
    return entry ? entry.quantity.toString() : '';
  };

  const setQuantity = (materialId: string, qty: string, batchRef?: string) => {
    const material = materials.find(m => m.id === materialId);
    if (!material) return;

    const numQty = parseFloat(qty) || 0;
    const otherEntries = value.entries.filter(e =>
      !(e.materialId === materialId && (trackingMode === 'PER_SHIFT' || e.batchRef === batchRef))
    );

    if (numQty > 0) {
      onChange({
        entries: [
          ...otherEntries,
          {
            materialId,
            materialName: material.name,
            quantity: numQty,
            unit: material.unit,
            batchRef: trackingMode !== 'PER_SHIFT' ? batchRef : undefined,
          },
        ],
      });
    } else {
      onChange({ entries: otherEntries });
    }
  };

  const addBatch = () => {
    const next = (batches.length + 1).toString();
    setBatches([...batches, next]);
  };

  const removeBatch = (batchRef: string) => {
    setBatches(batches.filter(b => b !== batchRef));
    onChange({
      entries: value.entries.filter(e => e.batchRef !== batchRef),
    });
  };

  const getTotalForMaterial = (materialId: string): number => {
    return value.entries
      .filter(e => e.materialId === materialId)
      .reduce((sum, e) => sum + e.quantity, 0);
  };

  const batchLabel = trackingMode === 'PER_MIX' ? 'Mezcla' : 'Lote';

  if (trackingMode === 'PER_SHIFT') {
    return (
      <div className="space-y-2">
        {materials.map((mat) => (
          <div key={mat.id} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium">{mat.name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                placeholder="0"
                value={getQuantity(mat.id)}
                onChange={(e) => setQuantity(mat.id, e.target.value)}
                className="w-24 h-9 text-sm text-center font-medium"
              />
              <span className="text-xs text-muted-foreground w-10">{mat.unit}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // PER_BATCH or PER_MIX mode
  return (
    <div className="space-y-3">
      {batches.map((batchRef, bIdx) => (
        <div key={batchRef} className="border rounded-lg p-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {batchLabel} #{bIdx + 1}
            </span>
            {batches.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                onClick={() => removeBatch(batchRef)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          {materials.map((mat) => (
            <div key={mat.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <span className="text-xs">{mat.name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder="0"
                  value={getQuantity(mat.id, batchRef)}
                  onChange={(e) => setQuantity(mat.id, e.target.value, batchRef)}
                  className="w-20 h-8 text-xs text-center font-medium"
                />
                <span className="text-[10px] text-muted-foreground w-8">{mat.unit}</span>
              </div>
            </div>
          ))}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-1.5 h-8 text-xs"
        onClick={addBatch}
      >
        <Plus className="h-3.5 w-3.5" />
        Agregar {batchLabel.toLowerCase()}
      </Button>

      {/* Totals */}
      {batches.length > 1 && (
        <div className="border-t pt-2 space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase">Totales</span>
          {materials.map((mat) => {
            const total = getTotalForMaterial(mat.id);
            return total > 0 ? (
              <div key={mat.id} className="flex items-center justify-between text-xs">
                <span>{mat.name}</span>
                <span className="font-medium">{total} {mat.unit}</span>
              </div>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MACHINE SELECT RENDERER - Select machines/equipment with optional counter reading
// ============================================================================

interface MachineOption {
  id: number;
  name: string;
  nickname?: string | null;
  displayName: string;
  type: string;
  brand?: string | null;
  model?: string | null;
  assetCode?: string | null;
  status: string;
  photo?: string | null;
  sector?: { id: number; name: string } | null;
  counters: { id: number; name: string; unit: string; currentValue: number }[];
}

interface MachineSelection {
  machineId: number;
  machine?: MachineOption;
  counterReadings?: { counterId: number; value: number }[];
}

interface MachineSelectRendererProps {
  input: RoutineInput;
  value: MachineSelection[];
  onChange: (value: MachineSelection[]) => void;
}

function MachineSelectRenderer({ input, value, onChange }: MachineSelectRendererProps) {
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const config = input.machineConfig || {};
  const allowMultiple = config.allowMultiple ?? false;
  const requireCounterReading = config.requireCounterReading ?? false;
  const selectedMachineIds = (config.selectedMachines || []).map((m: any) => m.id);
  const selectedMachineIdsKey = JSON.stringify(selectedMachineIds);

  useEffect(() => {
    // If specific machines are configured, fetch their full details
    // Otherwise show empty (no machines configured)
    if (selectedMachineIds.length === 0) {
      setMachines([]);
      setLoading(false);
      return;
    }

    const fetchMachines = async () => {
      try {
        const res = await fetch('/api/production/routines/machines');
        if (res.ok) {
          const data = await res.json();
          // Filter to only show the machines selected in the template
          const filtered = (data.machines || []).filter((m: any) =>
            selectedMachineIds.includes(m.id)
          );
          setMachines(filtered);
        }
      } catch (error) {
        console.error('Error fetching machines:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMachines();
  }, [selectedMachineIdsKey, selectedMachineIds]);

  const filteredMachines = useMemo(() => {
    if (!searchTerm) return machines;
    const lower = searchTerm.toLowerCase();
    return machines.filter(m =>
      m.name.toLowerCase().includes(lower) ||
      m.nickname?.toLowerCase().includes(lower) ||
      m.assetCode?.toLowerCase().includes(lower) ||
      m.brand?.toLowerCase().includes(lower)
    );
  }, [machines, searchTerm]);

  const toggleMachine = (machine: MachineOption) => {
    const existing = value.find(v => v.machineId === machine.id);
    if (existing) {
      onChange(value.filter(v => v.machineId !== machine.id));
    } else {
      if (!allowMultiple && value.length > 0) {
        // Replace selection if not allowing multiple
        onChange([{ machineId: machine.id, machine, counterReadings: [] }]);
      } else {
        onChange([...value, { machineId: machine.id, machine, counterReadings: [] }]);
      }
    }
  };

  const setCounterReading = (machineId: number, counterId: number, readingValue: number) => {
    onChange(value.map(v => {
      if (v.machineId !== machineId) return v;
      const readings = v.counterReadings || [];
      const existingIdx = readings.findIndex(r => r.counterId === counterId);
      if (existingIdx >= 0) {
        readings[existingIdx].value = readingValue;
      } else {
        readings.push({ counterId, value: readingValue });
      }
      return { ...v, counterReadings: [...readings] };
    }));
  };

  const selectedIds = value.map(v => v.machineId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="ml-2 text-xs text-muted-foreground">Cargando máquinas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar máquina..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>

      {/* Machine list */}
      {filteredMachines.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center">
          {machines.length === 0
            ? (selectedMachineIds.length === 0
              ? 'No hay máquinas configuradas para esta pregunta'
              : 'No se encontraron las máquinas')
            : 'Sin resultados'}
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
          {filteredMachines.map((machine) => {
            const isSelected = selectedIds.includes(machine.id);
            const selection = value.find(v => v.machineId === machine.id);

            return (
              <div
                key={machine.id}
                className={cn(
                  'border rounded-lg p-2 transition-colors',
                  isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50 cursor-pointer'
                )}
                onClick={() => !isSelected && toggleMachine(machine)}
              >
                <div className="flex items-center gap-2">
                  {allowMultiple ? (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleMachine(machine)}
                      className="h-4 w-4"
                    />
                  ) : (
                    <div
                      className={cn(
                        'h-4 w-4 rounded-full border-2 flex items-center justify-center',
                        isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMachine(machine);
                      }}
                    >
                      {isSelected && <div className="h-2 w-2 rounded-full bg-background" />}
                    </div>
                  )}

                  {/* Machine photo or icon */}
                  {machine.photo ? (
                    <img
                      src={machine.photo}
                      alt={machine.name}
                      className="h-8 w-8 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <Cog className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{machine.displayName}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      {machine.assetCode && <span className="font-mono">{machine.assetCode}</span>}
                      {machine.brand && <span>{machine.brand}</span>}
                      {machine.model && <span>{machine.model}</span>}
                    </div>
                  </div>

                  {isSelected && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMachine(machine);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {/* Counter readings - show when selected and required */}
                {isSelected && requireCounterReading && machine.counters.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-dashed space-y-1.5">
                    <p className="text-[10px] font-medium text-muted-foreground">Lecturas de contador</p>
                    {machine.counters.map((counter) => {
                      const currentReading = selection?.counterReadings?.find(r => r.counterId === counter.id);
                      return (
                        <div key={counter.id} className="flex items-center gap-1.5">
                          <span className="text-xs min-w-[80px]">{counter.name}</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            placeholder={`Actual: ${counter.currentValue}`}
                            className="h-7 w-24 text-xs"
                            value={currentReading?.value || ''}
                            onChange={(e) => setCounterReading(
                              machine.id,
                              counter.id,
                              parseFloat(e.target.value) || 0
                            )}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-[10px] text-muted-foreground">{counter.unit}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Selection summary */}
      {value.length > 0 && (
        <div className="text-xs text-muted-foreground pt-1">
          {value.length} máquina{value.length !== 1 ? 's' : ''} seleccionada{value.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// RESOURCE MULTI SELECT RENDERER
// ============================================================================

interface ResourceMultiSelectRendererProps {
  resources: ProductionResource[];
  value: number[];
  onChange: (value: number[]) => void;
  maxSelection?: number;
}

function ResourceMultiSelectRenderer({ resources, value, onChange, maxSelection }: ResourceMultiSelectRendererProps) {
  const toggleResource = (resourceId: number) => {
    if (value.includes(resourceId)) {
      onChange(value.filter(id => id !== resourceId));
    } else {
      if (maxSelection && value.length >= maxSelection) {
        toast.error(`Máximo ${maxSelection} recurso${maxSelection !== 1 ? 's' : ''}`);
        return;
      }
      onChange([...value, resourceId]);
    }
  };

  return (
    <div className="space-y-1.5">
      {resources.length === 0 ? (
        <p className="text-xs text-muted-foreground">No hay recursos disponibles</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
          {resources.map((resource) => {
            const isSelected = value.includes(resource.id);
            return (
              <div
                key={resource.id}
                className={cn(
                  'border rounded-lg p-1.5 cursor-pointer transition-colors flex items-center gap-1.5',
                  isSelected ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'
                )}
                onClick={() => toggleResource(resource.id)}
              >
                <Checkbox checked={isSelected} className="h-3.5 w-3.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{resource.name}</p>
                  <p className="text-[10px] text-muted-foreground">{resource.code}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {value.length > 0 && (
        <div className="text-[10px] text-muted-foreground">
          {value.length} recurso{value.length !== 1 ? 's' : ''} seleccionado{value.length !== 1 ? 's' : ''}
          {maxSelection && ` (máx. ${maxSelection})`}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// RESOURCE SEQUENCE SELECT RENDERER (Ordered drag & drop)
// ============================================================================

interface ResourceSequenceSelectRendererProps {
  resources: ProductionResource[];
  value: number[];
  onChange: (value: number[]) => void;
  minSelection?: number;
}

function ResourceSequenceSelectRenderer({ resources, value, onChange, minSelection }: ResourceSequenceSelectRendererProps) {
  // Available resources (not yet selected)
  const availableForSelection = resources.filter(r => !value.includes(r.id));
  // Selected resources in order
  const selectedResources = value.map(id => resources.find(r => r.id === id)).filter(Boolean) as ProductionResource[];

  const addResource = (resourceId: number) => {
    onChange([...value, resourceId]);
  };

  const removeResource = (resourceId: number) => {
    onChange(value.filter(id => id !== resourceId));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newValue = [...value];
    [newValue[index - 1], newValue[index]] = [newValue[index], newValue[index - 1]];
    onChange(newValue);
  };

  const moveDown = (index: number) => {
    if (index === value.length - 1) return;
    const newValue = [...value];
    [newValue[index], newValue[index + 1]] = [newValue[index + 1], newValue[index]];
    onChange(newValue);
  };

  return (
    <div className="space-y-2">
      {/* Selected sequence */}
      {selectedResources.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground">Orden de ejecución:</p>
          <div className="space-y-1">
            {selectedResources.map((resource, index) => (
              <div
                key={resource.id}
                className="flex items-center gap-1.5 p-1.5 border rounded-lg bg-primary/5"
              >
                <div className="flex flex-col gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                  >
                    <ChevronDown className="h-3 w-3 rotate-180" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0"
                    onClick={() => moveDown(index)}
                    disabled={index === selectedResources.length - 1}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
                <Badge variant="secondary" className="text-[10px] w-5 justify-center px-0">
                  {index + 1}
                </Badge>
                <span className="text-xs font-medium flex-1 truncate">{resource.name}</span>
                <span className="text-[10px] text-muted-foreground">{resource.code}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                  onClick={() => removeResource(resource.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available to add */}
      {availableForSelection.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground">Agregar al orden:</p>
          <div className="flex flex-wrap gap-1">
            {availableForSelection.map((resource) => (
              <Badge
                key={resource.id}
                variant="outline"
                className="cursor-pointer hover:bg-primary/10 text-[10px] py-0.5 px-1.5"
                onClick={() => addResource(resource.id)}
              >
                <Plus className="h-2.5 w-2.5 mr-0.5" />
                {resource.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Status */}
      <div className="text-[10px] text-muted-foreground">
        {value.length} de {resources.length} recurso{resources.length !== 1 ? 's' : ''} seleccionado{value.length !== 1 ? 's' : ''}
        {minSelection && value.length < minSelection && (
          <span className="text-warning-muted-foreground ml-1.5">(mínimo {minSelection})</span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ITEM RENDERER COMPONENT (renders item with multiple inputs)
// ============================================================================

interface ItemRendererProps {
  item: RoutineItem;
  index: number;
  responses: Record<string, { value: any; photos?: string[] }>;
  onInputValueChange: (inputId: string, value: any) => void;
  onInputPhotoUpload: (inputId: string, file: File) => void;
  onInputPhotoRemove: (inputId: string, photoIndex: number) => void;
  uploadingPhotoId: string | null;
  itemNotes: string;
  onNotesChange: (notes: string) => void;
  // Props for resource/employee/work sector selection
  availableResources?: ProductionResource[];
  availableEmployees?: Employee[];
  availableWorkSectors?: WorkSector[];
  availableSectors?: { id: number; name: string }[];
  allSectorRoles?: string[]; // Todos los puestos del sector
  // Employee filter context
  employeeSectorName?: string | null;
  showingAllEmployees?: boolean;
  onShowAllEmployeesClick?: () => void;
}

function ItemRenderer({
  item,
  index,
  responses,
  onInputValueChange,
  onInputPhotoUpload,
  onInputPhotoRemove,
  uploadingPhotoId,
  itemNotes,
  onNotesChange,
  availableResources = [],
  availableEmployees = [],
  availableWorkSectors = [],
  availableSectors = [],
  allSectorRoles = [],
  employeeSectorName,
  showingAllEmployees,
  onShowAllEmployeesClick,
}: ItemRendererProps) {
  const inputs = normalizeItemInputs(item);
  const hasMultipleInputs = inputs.length > 1;

  return (
    <div className="bg-background rounded-xl shadow-sm border overflow-hidden">
      {/* Header with number and description */}
      <div className="bg-gradient-to-r from-primary/5 to-transparent px-3 py-2 border-b">
        <div className="flex items-start gap-2">
          <span className="text-xs font-bold text-white bg-primary rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
            {index + 1}
          </span>
          <h3 className="font-medium text-sm leading-tight flex-1">{item.description}</h3>
        </div>
      </div>

      {/* Content area */}
      <div className="p-3 space-y-3">
        {/* Render inputs */}
        <div className="space-y-3">
          {inputs.map((input) => (
            <InputRenderer
              key={input.id}
              input={input}
              inputId={input.id}
              response={responses[input.id] || { value: null }}
              onValueChange={(value) => onInputValueChange(input.id, value)}
              onPhotoUpload={(file) => onInputPhotoUpload(input.id, file)}
              onPhotoRemove={(photoIndex) => onInputPhotoRemove(input.id, photoIndex)}
              uploadingPhoto={uploadingPhotoId === input.id}
              availableResources={availableResources}
              availableEmployees={availableEmployees}
              availableWorkSectors={availableWorkSectors}
              availableSectors={availableSectors}
              allSectorRoles={allSectorRoles}
              allResponses={responses}
              employeeSectorName={employeeSectorName}
              showingAllEmployees={showingAllEmployees}
              onShowAllEmployeesClick={onShowAllEmployeesClick}
            />
          ))}
        </div>

        {/* Item-level notes - Collapsible style */}
        <details className="group">
          <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
            <ChevronRight className="h-3 w-3 group-open:rotate-90 transition-transform" />
            Agregar nota
          </summary>
          <div className="mt-1.5">
            <Input
              placeholder="Escriba una nota..."
              className="text-xs h-8"
              value={itemNotes}
              onChange={(e) => onNotesChange(e.target.value)}
            />
          </div>
        </details>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function NewRoutineExecutionForm({
  preselectedTemplate,
  draftToResume,
  onSuccess,
  onCancel,
}: NewRoutineExecutionFormProps) {
  // === Reference data via TanStack Query hooks ===
  const [selectedTemplate, setSelectedTemplate] = useState<RoutineTemplate | null>(
    draftToResume?.template || preselectedTemplate || null
  );
  const [showingAllEmployees, setShowingAllEmployees] = useState(false);

  const selectedWorkCenterId = selectedTemplate?.workCenter?.id ?? undefined;

  // Build employee filters reactively — TanStack auto-refetches when filters change
  const employeeFilters = useMemo(() => {
    if (showingAllEmployees) return { all: true as const };
    if (selectedTemplate?.sector?.id) return { sectorId: selectedTemplate.sector.id };
    if (selectedWorkCenterId) return { workCenterId: selectedWorkCenterId };
    if (selectedTemplate?.name) return { templateName: selectedTemplate.name };
    return {};
  }, [showingAllEmployees, selectedTemplate?.sector?.id, selectedWorkCenterId, selectedTemplate?.name]);

  const { data: templates = [] } = useExecutionTemplates();
  const { data: workCenters = [] } = useWorkCenters();
  const { data: availableResources = [] } = useProductionResources();
  const { data: availableSectors = [] } = useProductionSectors();
  const { data: availableWorkSectors = [] } = useWorkSectors();
  const { data: employeesData, isLoading: isLoadingEmployees } = useRoutineEmployees(employeeFilters);
  const availableEmployees = employeesData?.employees ?? [];
  const allSectorRoles = employeesData?.allSectorRoles ?? [];

  const loadingData = !templates.length && !workCenters.length && isLoadingEmployees;

  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  // New structure: inputResponses tracks each input's value/photos
  const [inputResponses, setInputResponses] = useState<
    Record<string, { value: any; photos?: string[] }>
  >({});
  // Pre-execution responses (separate from main checklist)
  const [preExecutionResponses, setPreExecutionResponses] = useState<
    Record<string, { value: any; photos?: string[] }>
  >({});
  // Item notes tracked separately by item ID
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  // Repeatable group instances
  const [repeatableInstances, setRepeatableInstances] = useState<
    Record<string, number[]>
  >({});
  // Counters for cadence tracking
  const [cadenceCounters, setCadenceCounters] = useState<Record<string, number>>({});
  // Pre-execution completed flag
  const [preExecutionCompleted, setPreExecutionCompleted] = useState(false);
  // Active section for section navigation
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  // Touch/swipe state for mobile navigation
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  // Auto-save draft functionality
  const [draftId, setDraftId] = useState<number | null>(draftToResume?.id || null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Carousel state for section navigation (like maintenance checklist)
  const [touchDelta, setTouchDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const activeTemplateForDefaults = draftToResume?.template || preselectedTemplate;
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      templateId: activeTemplateForDefaults?.id || undefined,
      workCenterId: activeTemplateForDefaults?.workCenter?.id || null,
      shiftId: null,
      date: format(new Date(), 'yyyy-MM-dd'),
      hasIssues: false,
      issueDescription: '',
    },
  });

  // Inicializar respuestas cuando data está lista (una vez)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (loadingData || initializedRef.current) return;
    initializedRef.current = true;

    const templateToUse = draftToResume?.template || preselectedTemplate;
    if (templateToUse) {
      initializeResponses(templateToUse);

      // Si estamos resumiendo un draft, hidratar las respuestas guardadas
      if (draftToResume?.responses && Array.isArray(draftToResume.responses)) {
        const restoredResponses: Record<string, { value: any; photos?: string[] }> = {};
        const restoredNotes: Record<string, string> = {};

        for (const resp of draftToResume.responses) {
          if (resp.inputs && Array.isArray(resp.inputs)) {
            for (const inp of resp.inputs) {
              if (inp.value !== null && inp.value !== undefined && inp.value !== '') {
                restoredResponses[inp.inputId] = {
                  value: inp.value,
                  photos: inp.photos || [],
                };
              }
            }
          }
          if (resp.notes) {
            restoredNotes[resp.itemId] = resp.notes;
          }
        }

        setInputResponses(prev => ({ ...prev, ...restoredResponses }));
        setItemNotes(prev => ({ ...prev, ...restoredNotes }));
        setPreExecutionCompleted(true);
      }
    }
    // initializedRef guard ensures this effect body only executes once.
    // initializeResponses is a component function (re-created each render) but the
    // ref guard prevents duplicate execution, so including it in deps is safe.
  }, [loadingData, draftToResume, preselectedTemplate, initializeResponses]);

  // Toggle mostrar todos los empleados vs filtrados — TanStack Query maneja el cache
  const handleShowAllEmployeesToggle = () => {
    setShowingAllEmployees(prev => !prev);
  };

  // Filter work sectors by the selected template's sector OR workCenter's sector
  const filteredWorkSectors = useMemo(() => {
    // First, try to use the template's sector directly
    if (selectedTemplate?.sector?.id) {
      const sectorId = selectedTemplate.sector.id;
      const sectorName = selectedTemplate.sector.name;
      const filtered = availableWorkSectors.filter(ws =>
        ws.sector?.id === sectorId ||
        (sectorName && ws.name?.toLowerCase().includes(sectorName.toLowerCase()))
      );
      if (filtered.length > 0) return filtered;
    }
    // Fallback: try using workCenter's machine's sector
    if (selectedWorkCenterId) {
      const wc = workCenters.find(w => w.id === selectedWorkCenterId);
      const sectorId = wc?.machine?.sectorId;
      if (sectorId) {
        const filtered = availableWorkSectors.filter(ws => ws.sector?.id === sectorId);
        if (filtered.length > 0) return filtered;
      }
    }
    return availableWorkSectors;
  }, [selectedTemplate?.sector?.id, selectedTemplate?.sector?.name, selectedWorkCenterId, workCenters, availableWorkSectors]);

  // Auto-save draft function
  const saveDraft = useCallback(async (
    responsesToSave: Record<string, { value: any; photos?: string[] }>,
    notesToSave: Record<string, string>,
    notifyIncomplete?: boolean,
  ) => {
    if (!selectedTemplate) return;

    setIsSaving(true);
    try {
      // Build responses array in the same format as final submit
      const allItems = selectedTemplate.items || [];
      const responseArray = allItems.map((item: any) => {
        const inputs = item.inputs || [{ id: item.id, type: item.type || 'CHECK' }];
        const inputData = inputs.map((input: any) => ({
          inputId: input.id,
          type: input.type,
          value: responsesToSave[input.id]?.value,
          photos: responsesToSave[input.id]?.photos || [],
        }));

        return {
          itemId: item.id,
          notes: notesToSave[item.id] || '',
          inputs: inputData,
        };
      });

      const res = await fetch('/api/production/routines/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          templateId: selectedTemplate.id,
          responses: responseArray,
          notifyIncomplete: notifyIncomplete || false,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (!draftId && data.draft?.id) {
          setDraftId(data.draft.id);
        }
        setLastSaved(new Date());
      }
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setIsSaving(false);
    }
  }, [selectedTemplate, draftId]);

  // Cancelar con notificación de incompleto si hay borrador activo
  const handleCancel = useCallback(async () => {
    if (draftId) {
      const totalInputs = visibleFlatItems.reduce(
        (acc, item) => acc + normalizeItemInputs(item).length, 0
      );
      const answeredInputs = visibleFlatItems.reduce((acc, item) => {
        return acc + normalizeItemInputs(item).filter(inp => {
          const r = inputResponses[inp.id];
          return r?.value !== null && r?.value !== undefined && r?.value !== '';
        }).length;
      }, 0);

      if (answeredInputs < totalInputs) {
        try {
          await saveDraft(inputResponses, itemNotes, true);
        } catch {
          // Si falla el guardado, continuar con el cancel igual
        }
      }
    }
    onCancel();
  }, [draftId, visibleFlatItems, inputResponses, itemNotes, saveDraft, onCancel]);

  // Debounced auto-save
  const triggerAutoSave = useCallback((responses: Record<string, { value: any; photos?: string[] }>, notes: Record<string, string>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveDraft(responses, notes);
    }, 2000); // Save after 2 seconds of inactivity
  }, [saveDraft]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const getInitialValueForInput = (input: RoutineInput): { value: any; photos?: string[] } => {
    switch (input.type) {
      case 'CHECK':
        return { value: null };
      case 'PHOTO':
        return { value: null, photos: [] };
      case 'VALUE':
      case 'TEXT':
      case 'DATE':
      case 'TIME':
        return { value: '' };
      case 'SELECT':
        return { value: '' };
      case 'CHECKBOX':
        return { value: [] }; // Array of selected options
      case 'RATING':
        return { value: 0 };
      case 'SIGNATURE':
        return { value: null }; // Base64 data URL
      case 'EMPLOYEE_SELECT':
        return { value: [] }; // Array of EmployeeWithTasks (auto-populated if attendance tracking)
      case 'RESOURCE_MULTI_SELECT':
      case 'RESOURCE_SEQUENCE_SELECT':
        return { value: [] }; // Array of resource IDs
      case 'MATERIAL_INPUT':
        return { value: { entries: [] } }; // MaterialInputValue
      case 'MACHINE_SELECT':
        return { value: [] }; // Array of MachineSelection
      default:
        return { value: null };
    }
  };

  const initializeResponses = (template: RoutineTemplate) => {
    const allItems = getAllItems(template);
    const initialInputResponses: Record<string, { value: any; photos?: string[] }> = {};
    const initialItemNotes: Record<string, string> = {};
    const initialPreExecResponses: Record<string, { value: any; photos?: string[] }> = {};
    const initialRepeatableInstances: Record<string, number[]> = {};

    // Initialize pre-execution inputs
    if (template.preExecutionInputs?.length) {
      template.preExecutionInputs.forEach((input) => {
        initialPreExecResponses[input.id] = getInitialValueForInput(input);
      });
    }

    // Initialize item inputs
    allItems.forEach((item) => {
      const inputs = normalizeItemInputs(item);
      initialItemNotes[item.id] = '';

      inputs.forEach((input) => {
        initialInputResponses[input.id] = getInitialValueForInput(input);
      });
    });

    // Initialize repeatable groups
    if (template.groups?.length) {
      template.groups.forEach((group) => {
        if (group.isRepeatable) {
          initialRepeatableInstances[group.id] = []; // Start with empty instances
        }
      });
    }

    setInputResponses(initialInputResponses);
    setItemNotes(initialItemNotes);
    setPreExecutionResponses(initialPreExecResponses);
    setRepeatableInstances(initialRepeatableInstances);
    setPreExecutionCompleted(!(template.preExecutionInputs?.length > 0));

    // Initialize expanded groups
    if (template.groups?.length) {
      setExpandedGroups(new Set(template.groups.map((g) => g.id)));
    }
  };

  const getAllItems = (template: RoutineTemplate): RoutineItem[] => {
    let items: RoutineItem[];
    if (template.itemsStructure === 'hierarchical' && template.groups?.length) {
      items = template.groups.flatMap((g) => g.items);
    } else {
      items = template.items || [];
    }
    // Filter out disabled items
    return items.filter(item => !item.disabled);
  };

  const handleTemplateChange = (templateId: number) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      form.setValue('templateId', templateId);
      form.setValue('workCenterId', template.workCenter?.id || null);
      initializeResponses(template);
    }
  };

  const updateInputValue = (inputId: string, value: any) => {
    setInputResponses((prev) => {
      const newResponses = {
        ...prev,
        [inputId]: {
          ...prev[inputId],
          value,
        },
      };
      // Trigger auto-save
      triggerAutoSave(newResponses, itemNotes);
      return newResponses;
    });
  };

  const updateItemNotes = (itemId: string, notes: string) => {
    setItemNotes((prev) => {
      const newNotes = {
        ...prev,
        [itemId]: notes,
      };
      // Trigger auto-save
      triggerAutoSave(inputResponses, newNotes);
      return newNotes;
    });
  };

  const handlePhotoUpload = async (inputId: string, file: File) => {
    setUploadingPhoto(inputId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'production_routines');
      formData.append('fileType', 'photo');
      formData.append('entityId', selectedTemplate?.id?.toString() || 'temp');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.url) {
        setInputResponses((prev) => ({
          ...prev,
          [inputId]: {
            ...prev[inputId],
            photos: [...(prev[inputId]?.photos || []), data.url],
          },
        }));
        toast.success('Foto subida correctamente');
      } else {
        toast.error(data.error || 'Error al subir foto');
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Error al subir foto');
    } finally {
      setUploadingPhoto(null);
    }
  };

  const removePhoto = (inputId: string, photoIndex: number) => {
    setInputResponses((prev) => ({
      ...prev,
      [inputId]: {
        ...prev[inputId],
        photos: (prev[inputId]?.photos || []).filter((_, i) => i !== photoIndex),
      },
    }));
  };

  // Pre-execution response handlers
  const updatePreExecutionValue = (inputId: string, value: any) => {
    setPreExecutionResponses((prev) => ({
      ...prev,
      [inputId]: {
        ...prev[inputId],
        value,
      },
    }));
  };

  const handlePreExecutionPhotoUpload = async (inputId: string, file: File) => {
    setUploadingPhoto(inputId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'production_routines');
      formData.append('fileType', 'photo');
      formData.append('entityId', selectedTemplate?.id?.toString() || 'temp');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.url) {
        setPreExecutionResponses((prev) => ({
          ...prev,
          [inputId]: {
            ...prev[inputId],
            photos: [...(prev[inputId]?.photos || []), data.url],
          },
        }));
        toast.success('Foto subida correctamente');
      } else {
        toast.error(data.error || 'Error al subir foto');
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Error al subir foto');
    } finally {
      setUploadingPhoto(null);
    }
  };

  const removePreExecutionPhoto = (inputId: string, photoIndex: number) => {
    setPreExecutionResponses((prev) => ({
      ...prev,
      [inputId]: {
        ...prev[inputId],
        photos: (prev[inputId]?.photos || []).filter((_, i) => i !== photoIndex),
      },
    }));
  };

  // Repeatable group handlers
  const addRepeatableInstance = (groupId: string) => {
    setRepeatableInstances((prev) => {
      const current = prev[groupId] || [];
      const newInstanceId = current.length > 0 ? Math.max(...current) + 1 : 1;
      return {
        ...prev,
        [groupId]: [...current, newInstanceId],
      };
    });
  };

  const removeRepeatableInstance = (groupId: string, instanceId: number) => {
    setRepeatableInstances((prev) => ({
      ...prev,
      [groupId]: (prev[groupId] || []).filter((id) => id !== instanceId),
    }));
  };

  // Get sequence from pre-execution (for linkedSequenceId)
  const getResourceSequence = (sequenceInputId: string): number[] => {
    const response = preExecutionResponses[sequenceInputId];
    if (!response?.value || !Array.isArray(response.value)) return [];
    return response.value;
  };

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const checkForIssues = (): boolean => {
    if (!selectedTemplate) return false;

    const allItems = getAllItems(selectedTemplate);

    for (const item of allItems) {
      const inputs = normalizeItemInputs(item);

      for (const input of inputs) {
        const response = inputResponses[input.id];
        if (!response) continue;

        if (input.type === 'CHECK' && response.value === false && input.required) {
          return true;
        }

        if (input.type === 'VALUE' && input.minValue !== undefined && input.maxValue !== undefined) {
          const numValue = parseFloat(response.value);
          if (!isNaN(numValue) && (numValue < input.minValue || numValue > input.maxValue)) {
            return true;
          }
        }

        if (
          input.type === 'PHOTO' &&
          input.required &&
          (!response.photos || response.photos.length === 0)
        ) {
          return true;
        }
      }
    }

    return false;
  };

  const isInputComplete = (input: RoutineInput, response: { value: any; photos?: string[] } | undefined): boolean => {
    if (!response) return false;

    switch (input.type) {
      case 'CHECK':
        return response.value === true || response.value === false; // Both Sí and No are valid answers
      case 'VALUE':
        return response.value !== '' && response.value !== null;
      case 'TEXT':
        return !input.required || (response.value && response.value.trim() !== '');
      case 'DATE':
      case 'TIME':
        return !input.required || (response.value && response.value !== '');
      case 'PHOTO':
        return !input.required || (response.photos && response.photos.length > 0);
      case 'SELECT':
        return !input.required || (response.value && response.value !== '');
      case 'CHECKBOX':
        return !input.required || (Array.isArray(response.value) && response.value.length > 0);
      case 'RATING':
        return !input.required || (response.value && response.value > 0);
      case 'SIGNATURE':
        return !input.required || (response.value && response.value !== null);
      case 'EMPLOYEE_SELECT':
        return !input.required || (Array.isArray(response.value) && response.value.length > 0);
      case 'RESOURCE_MULTI_SELECT':
        return !input.required || (Array.isArray(response.value) && response.value.length > 0);
      case 'RESOURCE_SEQUENCE_SELECT':
        const minSelection = input.resourceSelectConfig?.minSelection || 1;
        return Array.isArray(response.value) && response.value.length >= minSelection;
      case 'MACHINE_SELECT':
        return !input.required || (Array.isArray(response.value) && response.value.length > 0);
      default:
        return false;
    }
  };

  const getGroupProgress = (group: RoutineGroup): { completed: number; total: number } => {
    // Count total inputs across all items in the group
    let totalInputs = 0;
    let completedInputs = 0;

    group.items.forEach((item) => {
      const inputs = normalizeItemInputs(item);
      totalInputs += inputs.length;

      inputs.forEach((input) => {
        const response = inputResponses[input.id];
        if (isInputComplete(input, response)) completedInputs++;
      });
    });

    return { completed: completedInputs, total: totalInputs };
  };

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const hasIssuesDetected = checkForIssues() || values.hasIssues;
      const allItems = selectedTemplate ? getAllItems(selectedTemplate) : [];

      // Build response array with item-level structure containing input responses
      const responseArray = allItems.map((item) => {
        const inputs = normalizeItemInputs(item);
        const inputData = inputs.map((input) => ({
          inputId: input.id,
          type: input.type,
          value: inputResponses[input.id]?.value,
          photos: inputResponses[input.id]?.photos || [],
        }));

        return {
          itemId: item.id,
          notes: itemNotes[item.id] || '',
          inputs: inputData,
          // For backward compatibility, also include flattened data
          value: inputData.length === 1 ? inputData[0].value : inputData,
          photos: inputData.flatMap((i) => i.photos),
        };
      });

      // Build pre-execution response data
      const preExecData = selectedTemplate?.preExecutionInputs?.map((input) => ({
        inputId: input.id,
        type: input.type,
        value: preExecutionResponses[input.id]?.value,
        photos: preExecutionResponses[input.id]?.photos || [],
      })) || [];

      const res = await fetch('/api/production/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          draftId, // Include draft ID if exists, to complete the draft
          responses: responseArray,
          preExecutionResponses: preExecData,
          repeatableInstances: repeatableInstances,
          hasIssues: hasIssuesDetected,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Rutina ejecutada correctamente');
        if (data.suggestWorkOrder) {
          toast.info('Se detectaron problemas. Se sugiere crear una orden de trabajo.');
        }
        onSuccess();
      } else {
        toast.error(data.error || 'Error al ejecutar rutina');
      }
    } catch (error) {
      console.error('Error executing routine:', error);
      toast.error('Error al ejecutar rutina');
    } finally {
      setLoading(false);
    }
  };

  // These must be before any conditional returns (Rules of Hooks)
  const isHierarchical =
    selectedTemplate?.itemsStructure === 'hierarchical' && selectedTemplate?.groups?.length;
  const flatItems: RoutineItem[] = selectedTemplate?.items || [];

  // Get sections from template
  const sections = selectedTemplate?.sections || [];
  const hasSections = sections.length > 0;

  // Ítems habilitados y con condición visible
  const visibleFlatItems = useMemo(() => {
    return flatItems.filter(item => !item.disabled && isItemVisible(item, flatItems, inputResponses));
  }, [flatItems, inputResponses]);

  // Filter items: exclude disabled, conditional hidden, and filter by active section
  const activeItems = useMemo(() => {
    if (!hasSections) return visibleFlatItems;

    // If we have sections but no section is selected, show items without section
    if (activeSectionId === null) {
      return visibleFlatItems.filter(item => !item.sectionId);
    }

    // Filter by active section
    return visibleFlatItems.filter(item => item.sectionId === activeSectionId);
  }, [visibleFlatItems, hasSections, activeSectionId]);

  // Count items per section (for badges)
  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = { '_none': 0 };

    visibleFlatItems.forEach(item => {
      if (item.sectionId) {
        counts[item.sectionId] = (counts[item.sectionId] || 0) + 1;
      } else {
        counts['_none']++;
      }
    });
    return counts;
  }, [visibleFlatItems]);

  // Build slides array: [General (if has items), ...sections]
  // IMPORTANT: This must be defined BEFORE useEffects and functions that use it
  const slides = useMemo(() => {
    const result: Array<{ id: string | null; name: string; items: RoutineItem[] }> = [];

    // Add "General" slide if there are items without section
    const generalItems = visibleFlatItems.filter(item => !item.sectionId);
    if (generalItems.length > 0) {
      result.push({ id: null, name: 'General', items: generalItems });
    }

    // Add section slides
    sections.forEach(section => {
      const sectionItems = visibleFlatItems.filter(item => item.sectionId === section.id);
      result.push({ id: section.id, name: section.name, items: sectionItems });
    });

    return result;
  }, [visibleFlatItems, sections]);

  // Current slide index
  const currentSlideIndex = useMemo(() => {
    return slides.findIndex(s => s.id === activeSectionId);
  }, [slides, activeSectionId]);

  // Auto-select first slide if current selection is invalid
  useEffect(() => {
    if (hasSections && slides.length > 0 && currentSlideIndex === -1) {
      // Current activeSectionId not found in slides, select first slide
      setActiveSectionId(slides[0].id);
    }
  }, [hasSections, slides, currentSlideIndex]);

  const goToNextSection = () => {
    if (!hasSections) return;
    const nextIndex = currentSlideIndex + 1;
    if (nextIndex < slides.length) {
      setActiveSectionId(slides[nextIndex].id);
    }
  };

  const goToPrevSection = () => {
    if (!hasSections) return;
    const prevIndex = currentSlideIndex - 1;
    if (prevIndex >= 0) {
      setActiveSectionId(slides[prevIndex].id);
    }
  };

  // Touch handlers for swipe navigation (carousel style)
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchEnd(null);
    setIsDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const currentX = e.targetTouches[0].clientX;
    setTouchEnd(currentX);
    setTouchDelta(currentX - touchStart);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setIsDragging(false);
      setTouchDelta(0);
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentSlideIndex < slides.length - 1) {
      goToNextSection();
    } else if (isRightSwipe && currentSlideIndex > 0) {
      goToPrevSection();
    }

    setTouchStart(null);
    setTouchEnd(null);
    setTouchDelta(0);
    setIsDragging(false);
  };

  // Loading state (after all hooks)
  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
        {/* Template Selection */}
        {!preselectedTemplate && (
          <FormField
            control={form.control}
            name="templateId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rutina a Ejecutar *</FormLabel>
                <Select
                  onValueChange={(val) => handleTemplateChange(parseInt(val))}
                  value={field.value?.toString() || ''}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar rutina" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id.toString()}>
                        [{t.code}] {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Context fields removed - date is set automatically on completion */}

        {/* PRE-EXECUTION SECTION */}
        {selectedTemplate && selectedTemplate.preExecutionInputs && selectedTemplate.preExecutionInputs.length > 0 && (
          <Card className={cn(
            "border-2",
            preExecutionCompleted ? "border-success bg-success-muted/50" : "border-info bg-info-muted/50"
          )}>
            <CardHeader className="pb-2 px-3 pt-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-info-muted-foreground" />
                Configuración Pre-Ejecución
                {preExecutionCompleted && (
                  <Badge className="bg-success ml-2 text-xs">Completado</Badge>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Complete estos campos antes de iniciar la rutina
              </p>
            </CardHeader>
            <CardContent className="space-y-3 px-3 pb-3">
              {selectedTemplate.preExecutionInputs.map((input) => (
                <div key={input.id} className="border rounded-lg p-2 bg-background">
                  <InputRenderer
                    input={input}
                    inputId={input.id}
                    response={preExecutionResponses[input.id] || { value: null }}
                    onValueChange={(value) => updatePreExecutionValue(input.id, value)}
                    onPhotoUpload={(file) => handlePreExecutionPhotoUpload(input.id, file)}
                    onPhotoRemove={(photoIndex) => removePreExecutionPhoto(input.id, photoIndex)}
                    uploadingPhoto={uploadingPhoto === input.id}
                    availableResources={availableResources}
                    availableEmployees={availableEmployees}
                    availableWorkSectors={filteredWorkSectors}
                    availableSectors={availableSectors}
                    allSectorRoles={allSectorRoles}
                    allResponses={preExecutionResponses}
                    employeeSectorName={selectedTemplate?.sector?.name}
                    showingAllEmployees={showingAllEmployees}
                    onShowAllEmployeesClick={handleShowAllEmployeesToggle}
                  />
                </div>
              ))}

              {!preExecutionCompleted && (
                <Button
                  type="button"
                  className="w-full h-9 text-sm"
                  onClick={() => {
                    // Check if all required pre-execution inputs are complete
                    const allComplete = selectedTemplate.preExecutionInputs!.every((input) => {
                      const response = preExecutionResponses[input.id];
                      return isInputComplete(input, response);
                    });
                    if (allComplete) {
                      setPreExecutionCompleted(true);
                      toast.success('Pre-ejecución completada. Puede continuar con la rutina.');
                    } else {
                      toast.error('Complete todos los campos requeridos de pre-ejecución');
                    }
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmar Pre-Ejecución
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* HIERARCHICAL MODE: Groups with items */}
        {selectedTemplate && isHierarchical && (preExecutionCompleted || !selectedTemplate.preExecutionInputs?.length) && (
          <div className="space-y-4">
            {selectedTemplate.groups!.map((group) => {
              const isExpanded = expandedGroups.has(group.id);
              const progress = getGroupProgress(group);
              const isComplete = progress.completed === progress.total;

              return (
                <Card key={group.id} className="overflow-hidden">
                  <Collapsible
                    open={isExpanded}
                    onOpenChange={() => toggleGroupExpanded(group.id)}
                  >
                    <CardHeader
                      className={cn(
                        'py-2 px-3 cursor-pointer transition-colors',
                        isComplete ? 'bg-success-muted' : 'bg-muted/30'
                      )}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" className="p-0.5 h-auto">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>

                          <div className="flex-1">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Layers className="h-4 w-4" />
                              {group.name}
                            </CardTitle>
                            {group.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {group.description}
                              </p>
                            )}
                          </div>

                          <Badge
                            variant={isComplete ? 'default' : 'secondary'}
                            className={cn("text-xs", isComplete ? 'bg-success' : '')}
                          >
                            {progress.completed}/{progress.total}
                          </Badge>
                        </div>
                      </CollapsibleTrigger>
                    </CardHeader>

                    <CollapsibleContent>
                      <CardContent className="pt-3 space-y-3 px-3 pb-3">
                        {/* Repeatable group indicator */}
                        {group.isRepeatable && (
                          <div className="flex items-center justify-between p-2 bg-warning-muted rounded-lg border border-warning-muted">
                            <div className="flex items-center gap-2">
                              <RefreshCw className="h-3.5 w-3.5 text-warning-muted-foreground" />
                              <span className="text-xs text-warning-muted-foreground">
                                Grupo repetible - {repeatableInstances[group.id]?.length || 0} instancias
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => addRepeatableInstance(group.id)}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              {group.repeatableConfig?.buttonLabel || '+ Agregar'}
                            </Button>
                          </div>
                        )}

                        {/* Cadence indicator */}
                        {group.cadence && (
                          <div className="flex items-center gap-2 p-2 bg-info-muted rounded-lg border border-info-muted">
                            <RefreshCw className="h-3.5 w-3.5 text-info-muted-foreground" />
                            <span className="text-xs text-info-muted-foreground">
                              Se ejecuta cada {group.cadence.every} recursos
                            </span>
                          </div>
                        )}

                        {/* LinkedSequence indicator */}
                        {group.linkedSequenceId && (
                          <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg border border-primary/20">
                            <Layers className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs text-primary">
                              Se repite por cada recurso en la secuencia pre-ejecución
                            </span>
                          </div>
                        )}

                        {/* Regular items */}
                        {group.items.map((item, itemIndex) => (
                          <ItemRenderer
                            key={item.id}
                            item={item}
                            index={itemIndex}
                            responses={inputResponses}
                            onInputValueChange={updateInputValue}
                            onInputPhotoUpload={handlePhotoUpload}
                            onInputPhotoRemove={removePhoto}
                            uploadingPhotoId={uploadingPhoto}
                            itemNotes={itemNotes[item.id] || ''}
                            onNotesChange={(notes) => updateItemNotes(item.id, notes)}
                            availableResources={availableResources}
                            availableEmployees={availableEmployees}
                            availableWorkSectors={filteredWorkSectors}
                            availableSectors={availableSectors}
                            allSectorRoles={allSectorRoles}
                            employeeSectorName={selectedTemplate?.sector?.name}
                            showingAllEmployees={showingAllEmployees}
                            onShowAllEmployeesClick={handleShowAllEmployeesToggle}
                          />
                        ))}

                        {/* Repeatable instances */}
                        {group.isRepeatable && repeatableInstances[group.id]?.map((instanceId, instIdx) => (
                          <div key={`instance-${instanceId}`} className="border-2 border-warning-muted rounded-lg p-3 space-y-3 bg-warning-muted/30">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-warning-muted-foreground">
                                {group.repeatableConfig?.instanceLabel || 'Instancia'} #{instIdx + 1}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive h-7 w-7 p-0"
                                onClick={() => removeRepeatableInstance(group.id, instanceId)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            {group.items.map((item, itemIndex) => (
                              <ItemRenderer
                                key={`${item.id}-inst-${instanceId}`}
                                item={item}
                                index={itemIndex}
                                responses={inputResponses}
                                onInputValueChange={(inputId, value) => {
                                  // Store with instance prefix
                                  updateInputValue(`${inputId}_inst_${instanceId}`, value);
                                }}
                                onInputPhotoUpload={(inputId, file) => {
                                  handlePhotoUpload(`${inputId}_inst_${instanceId}`, file);
                                }}
                                onInputPhotoRemove={(inputId, photoIndex) => {
                                  removePhoto(`${inputId}_inst_${instanceId}`, photoIndex);
                                }}
                                uploadingPhotoId={uploadingPhoto}
                                itemNotes={itemNotes[`${item.id}_inst_${instanceId}`] || ''}
                                onNotesChange={(notes) => updateItemNotes(`${item.id}_inst_${instanceId}`, notes)}
                                availableResources={availableResources}
                                availableEmployees={availableEmployees}
                                availableWorkSectors={filteredWorkSectors}
                                availableSectors={availableSectors}
                                allSectorRoles={allSectorRoles}
                                employeeSectorName={selectedTemplate?.sector?.name}
                                showingAllEmployees={showingAllEmployees}
                                onShowAllEmployeesClick={handleShowAllEmployeesToggle}
                              />
                            ))}
                          </div>
                        ))}
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        )}

        {/* FLAT MODE: Simple list of items - Mobile optimized */}
        {selectedTemplate && !isHierarchical && flatItems.length > 0 && (preExecutionCompleted || !selectedTemplate.preExecutionInputs?.length) && (
          <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-hidden">
            {/* Progress header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <CheckSquare className="h-4 w-4 text-primary" />
                <span className="font-medium text-xs">
                  {visibleFlatItems.length} preguntas
                </span>
                {/* Auto-save indicator */}
                {isSaving && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Guardando...
                  </span>
                )}
                {!isSaving && lastSaved && (
                  <span className="text-xs text-success flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Guardado
                  </span>
                )}
              </div>
              <Badge variant="outline" className="text-xs">
                {visibleFlatItems.reduce((acc, item) => {
                  return acc + normalizeItemInputs(item).filter(inp => {
                    const r = inputResponses[inp.id];
                    return r?.value !== null && r?.value !== undefined && r?.value !== '';
                  }).length;
                }, 0)} / {visibleFlatItems.reduce((acc, item) => acc + normalizeItemInputs(item).length, 0)}
              </Badge>
            </div>

            {/* Section Navigator - only show if there are sections */}
            {hasSections && (
              <div
                className="relative"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                {/* Mobile: Swipe indicator + arrows */}
                <div className="flex items-center gap-2">
                  {/* Left arrow */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={goToPrevSection}
                    disabled={currentSlideIndex <= 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {/* Section tabs - scrollable horizontally */}
                  <div className="flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <div className="flex gap-1 min-w-max">
                      {slides.map((slide, idx) => (
                        <button
                          key={slide.id ?? '_general'}
                          type="button"
                          onClick={() => setActiveSectionId(slide.id)}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors",
                            currentSlideIndex === idx
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-muted/80 text-muted-foreground"
                          )}
                        >
                          {slide.name}
                          <span className="ml-1 opacity-70">({slide.items.length})</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right arrow */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={goToNextSection}
                    disabled={currentSlideIndex >= slides.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Swipe hint for mobile */}
                <p className="text-[10px] text-muted-foreground text-center mt-1 sm:hidden">
                  Deslizá para cambiar de sección
                </p>
              </div>
            )}

            {/* Carousel container for sections */}
            {hasSections && slides.length > 0 ? (
              <div
                className="relative flex-1 min-h-0 overflow-hidden"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                <div
                  className="h-full flex"
                  style={{
                    transform: `translateX(calc(-${Math.max(0, currentSlideIndex) * 100}% + ${touchDelta}px))`,
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
                  }}
                >
                  {slides.map((slide, slideIdx) => (
                    <div
                      key={slide.id ?? '_general'}
                      className="w-full h-full flex-shrink-0 overflow-y-auto"
                      style={{ minWidth: '100%' }}
                    >
                      <div className="space-y-2">
                        {slide.items.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground">
                            <Layers className="h-6 w-6 mx-auto mb-2 opacity-50" />
                            <p className="text-xs">No hay preguntas en esta sección</p>
                          </div>
                        ) : (
                          slide.items.map((item, index) => (
                            <ItemRenderer
                              key={item.id}
                              item={item}
                              index={index}
                              responses={inputResponses}
                              onInputValueChange={updateInputValue}
                              onInputPhotoUpload={handlePhotoUpload}
                              onInputPhotoRemove={removePhoto}
                              uploadingPhotoId={uploadingPhoto}
                              itemNotes={itemNotes[item.id] || ''}
                              onNotesChange={(notes) => updateItemNotes(item.id, notes)}
                              availableResources={availableResources}
                              availableEmployees={availableEmployees}
                              availableWorkSectors={filteredWorkSectors}
                              availableSectors={availableSectors}
                              allSectorRoles={allSectorRoles}
                              employeeSectorName={selectedTemplate?.sector?.name}
                              showingAllEmployees={showingAllEmployees}
                              onShowAllEmployeesClick={handleShowAllEmployeesToggle}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* No sections - show all items directly */
              <div className="space-y-2 flex-1 overflow-y-auto">
                {activeItems.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Layers className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No hay preguntas</p>
                  </div>
                ) : (
                  activeItems.map((item, index) => (
                    <ItemRenderer
                      key={item.id}
                      item={item}
                      index={index}
                      responses={inputResponses}
                      onInputValueChange={updateInputValue}
                      onInputPhotoUpload={handlePhotoUpload}
                      onInputPhotoRemove={removePhoto}
                      uploadingPhotoId={uploadingPhoto}
                      itemNotes={itemNotes[item.id] || ''}
                      onNotesChange={(notes) => updateItemNotes(item.id, notes)}
                      availableResources={availableResources}
                      availableEmployees={availableEmployees}
                      availableWorkSectors={filteredWorkSectors}
                      availableSectors={availableSectors}
                      allSectorRoles={allSectorRoles}
                      employeeSectorName={selectedTemplate?.sector?.name}
                      showingAllEmployees={showingAllEmployees}
                      onShowAllEmployeesClick={handleShowAllEmployeesToggle}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-2 flex-shrink-0">
          <Button
            type="submit"
            disabled={loading || !selectedTemplate}
            className="flex-1 sm:flex-none h-9 text-sm font-medium order-1 sm:order-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Completar Rutina
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="flex-1 sm:flex-none h-9 text-sm order-2 sm:order-1"
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  );
}
