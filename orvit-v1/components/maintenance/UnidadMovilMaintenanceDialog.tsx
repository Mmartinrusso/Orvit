'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
} from '@/components/ui/dialog';
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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Truck,
  Calendar,
  Wrench,
  FileText,
  Plus,
  X,
  Loader2,
  Wand2,
  AlertCircle,
  Package,
  Gauge,
  Clock,
  User,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface UnidadMovil {
  id: number;
  nombre: string;
  tipo: string;
  marca: string;
  modelo: string;
  año: number;
  patente: string;
  estado: string;
  sectorId?: number;
  sector?: { id: number; name: string };
  kilometraje?: number;
}

interface UserOption {
  id: number;
  name: string;
  email: string;
}

interface UnidadMovilMaintenanceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  companyId: number;
  sectorId?: number;
  selectedUnidad?: UnidadMovil;
  editingMaintenance?: any;
  mode?: 'create' | 'edit';
}

// ─── Plantillas rápidas ───────────────────────────────────────────────────────

const QUICK_TEMPLATES = [
  {
    title: 'Cambio de aceite',
    description: 'Cambio de aceite del motor y filtro de aceite.',
    km: 10000,
    minutes: 120,
  },
  {
    title: 'Cambio de ruedas',
    description: 'Cambio y rotación de neumáticos delanteros y traseros.',
    km: 10000,
    minutes: 180,
  },
  {
    title: 'Revisión de frenos',
    description: 'Revisión completa del sistema de frenos: pastillas, discos y líquido.',
    km: 15000,
    minutes: 240,
  },
  {
    title: 'Mantenimiento mayor',
    description: 'Revisión general completa de todos los sistemas del vehículo.',
    km: 50000,
    minutes: 480,
  },
];

// ─── Helpers de color ─────────────────────────────────────────────────────────

function getEstadoColor(estado: string) {
  switch (estado?.toUpperCase()) {
    case 'ACTIVO':        return 'bg-success-muted text-success-muted-foreground';
    case 'INACTIVO':      return 'bg-destructive/10 text-destructive';
    case 'MANTENIMIENTO': return 'bg-warning-muted text-warning-muted-foreground';
    default:              return 'bg-muted text-foreground';
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'LOW':    return 'bg-muted text-foreground';
    case 'MEDIUM': return 'bg-warning-muted text-warning-muted-foreground';
    case 'HIGH':   return 'bg-warning-muted text-warning-muted-foreground';
    case 'URGENT': return 'bg-destructive/10 text-destructive';
    default:       return 'bg-muted text-foreground';
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case 'PREVENTIVE': return 'bg-success-muted text-success-muted-foreground';
    case 'CORRECTIVE': return 'bg-warning-muted text-warning-muted-foreground';
    case 'PREDICTIVE': return 'bg-info-muted text-info-muted-foreground';
    case 'EMERGENCY':  return 'bg-destructive/10 text-destructive';
    default:           return 'bg-muted text-foreground';
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function UnidadMovilMaintenanceDialog({
  isOpen,
  onClose,
  onSave,
  companyId,
  sectorId,
  selectedUnidad,
  editingMaintenance,
  mode = 'create',
}: UnidadMovilMaintenanceDialogProps) {
  // Estados
  const [loading, setLoading]   = useState(false);
  const [unidades, setUnidades] = useState<UnidadMovil[]>([]);
  const [users, setUsers]       = useState<UserOption[]>([]);
  const [activeTab, setActiveTab] = useState('general');

  const [formData, setFormData] = useState({
    title:                  '',
    description:            '',
    type:                   'PREVENTIVE',
    priority:               'MEDIUM',
    unidadMovilId:          selectedUnidad?.id?.toString() || '',
    assignedToId:           '',
    scheduledDate:          format(new Date(), 'dd/MM/yyyy'),
    estimatedHours:         2,
    estimatedMinutes:       0,
    estimatedTimeType:      'MINUTES',
    maintenanceInterval:    0,
    maintenanceIntervalType: 'DAYS',
    frequency:              'MONTHLY',
    notes:                  '',
    tools:       [] as Array<{ name: string; description: string }>,
    spareParts:  [] as Array<{ name: string; quantity: number; cost: number }>,
    instructives: [] as Array<{ title: string; description: string; file: any }>,
    maintenanceTrigger:          'KILOMETERS',
    triggerValue:                10000,
    currentKilometers:           selectedUnidad?.kilometraje || 0,
    nextMaintenanceKilometers:   (selectedUnidad?.kilometraje || 0) + 10000,
  });

  const [toolInput,        setToolInput]        = useState({ name: '', description: '' });
  const [sparePartInput,   setSparePartInput]   = useState({ name: '', quantity: 1, cost: 0 });
  const [instructiveInput, setInstructiveInput] = useState({ title: '', description: '', file: null });
  const [uploadedFiles,    setUploadedFiles]    = useState<Array<{ name: string; file: File; size: number }>>([]);

  // ─── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      loadUnidades();
      loadUsers();
      if (editingMaintenance) {
        loadMaintenanceData();
      } else {
        setFormData({
          title: '', description: '', type: 'PREVENTIVE', priority: 'MEDIUM',
          unidadMovilId:    selectedUnidad?.id?.toString() || '',
          assignedToId:     '',
          scheduledDate:    format(new Date(), 'dd/MM/yyyy'),
          estimatedHours:   2,
          estimatedMinutes: 0,
          estimatedTimeType: 'MINUTES',
          maintenanceInterval: 0,
          maintenanceIntervalType: 'DAYS',
          frequency: 'MONTHLY',
          notes: '',
          tools: [], spareParts: [], instructives: [],
          maintenanceTrigger:        'KILOMETERS',
          triggerValue:              10000,
          currentKilometers:         selectedUnidad?.kilometraje || 0,
          nextMaintenanceKilometers: (selectedUnidad?.kilometraje || 0) + 10000,
        });
        setUploadedFiles([]);
        setActiveTab('general');
      }
    }
  }, [isOpen]);

  // ─── Loaders ────────────────────────────────────────────────────────────────

  const loadMaintenanceData = () => {
    if (!editingMaintenance) return;
    let timeType = 'MINUTES';
    if (editingMaintenance.estimatedMinutes >= 60) {
      const hours = editingMaintenance.estimatedMinutes / 60;
      if (hours % 1 === 0 || hours >= 2) timeType = 'HOURS';
    }
    setFormData({
      title:       editingMaintenance.title || '',
      description: editingMaintenance.description || '',
      type:        editingMaintenance.type || 'PREVENTIVE',
      priority:    editingMaintenance.priority || 'MEDIUM',
      unidadMovilId:  editingMaintenance.unidadMovilId?.toString() || '',
      assignedToId:   editingMaintenance.assignedToId?.toString() || '',
      scheduledDate:  editingMaintenance.scheduledDate
        ? formatDateToDDMMYYYY(editingMaintenance.scheduledDate)
        : format(new Date(), 'dd/MM/yyyy'),
      estimatedHours:       editingMaintenance.estimatedHours || 2,
      estimatedMinutes:     editingMaintenance.estimatedMinutes || 0,
      estimatedTimeType:    editingMaintenance.estimatedTimeType || timeType,
      maintenanceInterval:  editingMaintenance.maintenanceInterval || 0,
      maintenanceIntervalType: editingMaintenance.maintenanceIntervalType || 'DAYS',
      frequency:    editingMaintenance.frequency || 'MONTHLY',
      notes:        editingMaintenance.notes || '',
      tools:        editingMaintenance.tools || [],
      spareParts:   editingMaintenance.spareParts || [],
      instructives: editingMaintenance.instructives || [],
      maintenanceTrigger:        editingMaintenance.maintenanceTrigger || 'KILOMETERS',
      triggerValue:              editingMaintenance.triggerValue || 10000,
      currentKilometers:         editingMaintenance.currentKilometers || 0,
      nextMaintenanceKilometers: editingMaintenance.nextMaintenanceKilometers || 0,
    });
    if (editingMaintenance.uploadedFiles?.length > 0) {
      setUploadedFiles(editingMaintenance.uploadedFiles.map((f: any) => ({
        name: f.name,
        file: new File([], f.name, { type: f.type }),
        size: f.size,
      })));
    }
  };

  const loadUnidades = async () => {
    try {
      const res = await fetch(`/api/mantenimiento/unidades-moviles?companyId=${companyId}`);
      if (res.ok) {
        const data = await res.json();
        const arr = data.unidades || data;
        setUnidades(Array.isArray(arr) ? arr : []);
      }
    } catch { setUnidades([]); }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch(`/api/users?companyId=${companyId}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch { setUsers([]); }
  };

  // ─── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!formData.title || !formData.unidadMovilId) {
      toast({ title: 'Campos obligatorios', description: 'Completá el título y seleccioná una unidad móvil.', variant: 'destructive' });
      return;
    }
    if (!isCompleteAndValidDate(formData.scheduledDate)) {
      toast({ title: 'Fecha inválida', description: 'Ingresá una fecha válida en formato dd/mm/yyyy.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...formData,
        companyId,
        sectorId,
        unidadMovilId:  parseInt(formData.unidadMovilId),
        assignedToId:   formData.assignedToId ? parseInt(formData.assignedToId) : null,
        estimatedHours: parseFloat(formData.estimatedHours.toString()),
        estimatedMinutes: parseInt(formData.estimatedMinutes.toString()),
        scheduledDate:  convertDateToISO(formData.scheduledDate),
        ...(mode === 'edit' && editingMaintenance && { id: editingMaintenance.id }),
        frequency:    formData.maintenanceTrigger === 'DAYS' ? formData.frequency : 'YEARLY',
        frequencyDays: formData.maintenanceTrigger === 'DAYS' ? getFrequencyDays(formData.frequency) : 365,
        uploadedFiles: uploadedFiles.map(f => ({
          name: f.name, size: f.size, type: f.file.type, uploadedAt: new Date().toISOString(),
        })),
        isRecurring: true,
        isActive: true,
      };
      const res = await fetch('/api/maintenance/unidad-movil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: mode === 'edit' ? 'Mantenimiento actualizado' : 'Mantenimiento creado', description: result.message });
        onSave({ success: true });
        onClose();
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'No se pudo guardar el mantenimiento.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Handlers recursos ───────────────────────────────────────────────────────

  const addTool = () => {
    if (!toolInput.name.trim()) return;
    setFormData(p => ({ ...p, tools: [...p.tools, { ...toolInput }] }));
    setToolInput({ name: '', description: '' });
  };
  const removeTool = (i: number) =>
    setFormData(p => ({ ...p, tools: p.tools.filter((_, idx) => idx !== i) }));

  const addSparePart = () => {
    if (!sparePartInput.name.trim()) return;
    setFormData(p => ({ ...p, spareParts: [...p.spareParts, { ...sparePartInput }] }));
    setSparePartInput({ name: '', quantity: 1, cost: 0 });
  };
  const removeSparePart = (i: number) =>
    setFormData(p => ({ ...p, spareParts: p.spareParts.filter((_, idx) => idx !== i) }));

  const addInstructive = () => {
    if (!instructiveInput.title.trim()) return;
    setFormData(p => ({ ...p, instructives: [...p.instructives, { ...instructiveInput }] }));
    setInstructiveInput({ title: '', description: '', file: null });
  };
  const removeInstructive = (i: number) =>
    setFormData(p => ({ ...p, instructives: p.instructives.filter((_, idx) => idx !== i) }));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files).map(f => ({ name: f.name, file: f, size: f.size }));
    setUploadedFiles(p => [...p, ...newFiles]);
  };
  const removeFile = (i: number) => setUploadedFiles(p => p.filter((_, idx) => idx !== i));

  // ─── Handlers form ───────────────────────────────────────────────────────────

  const handleUnidadChange = (unidadId: string) => {
    const u = unidades.find(x => x.id.toString() === unidadId);
    if (u) {
      setFormData(p => ({
        ...p,
        unidadMovilId:           unidadId,
        currentKilometers:       u.kilometraje || 0,
        nextMaintenanceKilometers: (u.kilometraje || 0) + p.triggerValue,
      }));
    }
  };

  const handleTriggerValueChange = (value: number) =>
    setFormData(p => ({ ...p, triggerValue: value, nextMaintenanceKilometers: p.currentKilometers + value }));

  const generateTitle = () => {
    if (formData.title || !formData.maintenanceIntervalType || !formData.maintenanceInterval) return;
    const unit = formData.maintenanceIntervalType === 'HOURS' ? 'horas'
               : formData.maintenanceIntervalType === 'KILOMETERS' ? 'km' : 'días';
    setFormData(p => ({ ...p, title: `Mantenimiento preventivo cada ${p.maintenanceInterval.toLocaleString()} ${unit}` }));
  };

  // ─── Utils fecha ─────────────────────────────────────────────────────────────

  const convertDateToISO = (s: string) => {
    if (!s) return new Date().toISOString();
    if (s.includes('T') || s.includes('-')) return new Date(s).toISOString();
    const [d, m, y] = s.split('/');
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).toISOString();
  };

  const formatDateToDDMMYYYY = (date: Date | string) => {
    try {
      return format(typeof date === 'string' ? new Date(date) : date, 'dd/MM/yyyy');
    } catch { return format(new Date(), 'dd/MM/yyyy'); }
  };

  const isValidDate = (s: string) => {
    if (!s || s.length !== 10) return true;
    const [d, m, y] = s.split('/').map(Number);
    if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return false;
    const date = new Date(y, m - 1, d);
    return date.getDate() === d && date.getMonth() === m - 1 && date.getFullYear() === y;
  };

  const isCompleteAndValidDate = (s: string) => s.length === 10 && isValidDate(s);

  // ─── Utils frecuencia ────────────────────────────────────────────────────────

  const getFrequencyText = (f: string) =>
    ({ DAILY: 'Diario', WEEKLY: 'Semanal', BIWEEKLY: 'Quincenal', MONTHLY: 'Mensual', QUARTERLY: 'Trimestral', YEARLY: 'Anual' }[f] ?? f);

  const getFrequencyDays = (f: string) =>
    ({ DAILY: 1, WEEKLY: 7, BIWEEKLY: 15, MONTHLY: 30, QUARTERLY: 90, YEARLY: 365 }[f] ?? 30);

  const getNextMaintenanceDate = () => {
    if (!formData.frequency || !formData.scheduledDate) return null;
    try {
      const [d, m, y] = formData.scheduledDate.split('/');
      const base = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      const next = new Date(base);
      if (formData.frequency === 'DAILY')     next.setDate(next.getDate() + 1);
      if (formData.frequency === 'WEEKLY')    next.setDate(next.getDate() + 7);
      if (formData.frequency === 'BIWEEKLY')  next.setDate(next.getDate() + 15);
      if (formData.frequency === 'MONTHLY')   next.setMonth(next.getMonth() + 1);
      if (formData.frequency === 'QUARTERLY') next.setMonth(next.getMonth() + 3);
      if (formData.frequency === 'YEARLY')    next.setFullYear(next.getFullYear() + 1);
      return next;
    } catch { return null; }
  };

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const unidadesForSelect = unidades.length > 0
    ? unidades
    : selectedUnidad ? [selectedUnidad] : [];

  const selectedUnidadData = unidadesForSelect.find(u => u.id.toString() === formData.unidadMovilId) ?? null;

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${['B','KB','MB','GB'][i]}`;
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="lg">

        {/* ── Header ── */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-info-muted flex items-center justify-center shrink-0">
              <Truck className="h-4 w-4 text-info-muted-foreground" />
            </div>
            <span>
              {mode === 'edit' ? 'Editar Mantenimiento' : 'Nuevo Mantenimiento'}
              <span className="text-muted-foreground font-normal"> — Unidad Móvil</span>
            </span>
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? 'Modificá los datos del mantenimiento preventivo.'
              : 'Configurá el mantenimiento preventivo para la unidad seleccionada.'}
          </DialogDescription>
        </DialogHeader>

        {/* ── Body ── */}
        <DialogBody>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="general"   className="flex items-center gap-1.5"><Truck    className="h-3.5 w-3.5" />General</TabsTrigger>
              <TabsTrigger value="schedule"  className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Programación</TabsTrigger>
              <TabsTrigger value="resources" className="flex items-center gap-1.5"><Wrench   className="h-3.5 w-3.5" />Recursos</TabsTrigger>
              <TabsTrigger value="details"   className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />Detalles</TabsTrigger>
            </TabsList>

            {/* ════════════════════ TAB: GENERAL ════════════════════ */}
            <TabsContent value="general" className="space-y-5 pt-4">

              {/* Unidad Móvil */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  Unidad Móvil *
                </Label>
                <Select value={formData.unidadMovilId} onValueChange={handleUnidadChange}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Seleccionar unidad móvil…" />
                  </SelectTrigger>
                  <SelectContent>
                    {unidadesForSelect.map(u => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.nombre} — {u.patente} · {u.tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Info de unidad seleccionada */}
              {selectedUnidadData && (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/50 border">
                  <div className="h-8 w-8 rounded-full bg-info-muted flex items-center justify-center shrink-0">
                    <Truck className="h-3.5 w-3.5 text-info-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">{selectedUnidadData.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedUnidadData.marca} {selectedUnidadData.modelo} · {selectedUnidadData.año} · {selectedUnidadData.patente}
                      {selectedUnidadData.kilometraje != null && ` · ${selectedUnidadData.kilometraje.toLocaleString()} km`}
                    </p>
                  </div>
                  <Badge className={cn('shrink-0 text-xs', getEstadoColor(selectedUnidadData.estado))}>
                    {selectedUnidadData.estado}
                  </Badge>
                </div>
              )}

              {/* Título */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  Título *
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.title}
                    onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                    placeholder="Ej: Cambio de aceite cada 10.000 km"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generateTitle}
                    disabled={!formData.maintenanceInterval}
                    title="Generar título automáticamente"
                    className="shrink-0 px-2.5"
                  >
                    <Wand2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Tipo + Prioridad */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Tipo</Label>
                  <Select value={formData.type} onValueChange={v => setFormData(p => ({ ...p, type: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PREVENTIVE">Preventivo</SelectItem>
                      <SelectItem value="CORRECTIVE">Correctivo</SelectItem>
                      <SelectItem value="PREDICTIVE">Predictivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Prioridad</Label>
                  <Select value={formData.priority} onValueChange={v => setFormData(p => ({ ...p, priority: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Baja</SelectItem>
                      <SelectItem value="MEDIUM">Media</SelectItem>
                      <SelectItem value="HIGH">Alta</SelectItem>
                      <SelectItem value="URGENT">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Descripción */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Descripción</Label>
                <Textarea
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe las tareas a realizar en este mantenimiento…"
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Plantillas rápidas */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Plantillas rápidas</p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_TEMPLATES.map(t => (
                    <button
                      key={t.title}
                      type="button"
                      onClick={() => setFormData(p => ({
                        ...p,
                        title:                     t.title,
                        description:               t.description,
                        maintenanceTrigger:        'KILOMETERS',
                        triggerValue:              t.km,
                        nextMaintenanceKilometers: p.currentKilometers + t.km,
                        estimatedMinutes:          t.minutes,
                        estimatedTimeType:         'MINUTES',
                        maintenanceInterval:       t.km,
                        maintenanceIntervalType:   'KILOMETERS',
                      }))}
                      className="flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-md border bg-background hover:bg-muted/50 hover:border-primary/30 transition-all duration-150 text-left"
                    >
                      <span className="text-sm font-medium">{t.title}</span>
                      <span className="text-xs text-muted-foreground">cada {t.km.toLocaleString()} km</span>
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ════════════════════ TAB: PROGRAMACIÓN ════════════════════ */}
            <TabsContent value="schedule" className="space-y-5 pt-4">

              {/* Fecha + Asignado */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                    Fecha de inicio
                  </Label>
                  <DatePicker
                    value={formData.scheduledDate ? convertDateToISO(formData.scheduledDate).split('T')[0] : ''}
                    onChange={date => {
                      if (date) {
                        setFormData(p => ({ ...p, scheduledDate: formatDateToDDMMYYYY(new Date(date + 'T00:00:00')) }));
                      } else {
                        setFormData(p => ({ ...p, scheduledDate: '' }));
                      }
                    }}
                    placeholder="Seleccionar fecha…"
                    clearable
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                    <User className="h-3 w-3 inline mr-1" />Asignar a
                  </Label>
                  <Select value={formData.assignedToId} onValueChange={v => setFormData(p => ({ ...p, assignedToId: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                    <SelectContent>
                      {users.map(u => (
                        <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Duración estimada */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                    <Clock className="h-3 w-3 inline mr-1" />Unidad de tiempo
                  </Label>
                  <Select value={formData.estimatedTimeType} onValueChange={v => setFormData(p => ({ ...p, estimatedTimeType: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MINUTES">Minutos</SelectItem>
                      <SelectItem value="HOURS">Horas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                    Duración estimada
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    step={formData.estimatedTimeType === 'HOURS' ? '0.5' : '1'}
                    value={
                      formData.estimatedMinutes === 0 ? '' :
                      formData.estimatedTimeType === 'HOURS'
                        ? (formData.estimatedMinutes / 60).toFixed(1)
                        : formData.estimatedMinutes
                    }
                    onChange={e => {
                      const v = parseFloat(e.target.value) || 0;
                      const mins = formData.estimatedTimeType === 'HOURS' ? v * 60 : v;
                      setFormData(p => ({ ...p, estimatedMinutes: Math.round(mins) }));
                    }}
                    onFocus={e => { if (formData.estimatedMinutes === 0) e.target.select(); }}
                    placeholder={formData.estimatedTimeType === 'HOURS' ? '2' : '120'}
                  />
                </div>
              </div>

              {/* Separador */}
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  <Gauge className="h-3 w-3 inline mr-1" />Programación del trigger
                </span>
                <div className="flex-1 border-t" />
              </div>

              {/* Trigger */}
              {formData.unidadMovilId ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                        Tipo de programación
                      </Label>
                      <Select value={formData.maintenanceTrigger} onValueChange={v => setFormData(p => ({ ...p, maintenanceTrigger: v }))}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="KILOMETERS">Por kilómetros</SelectItem>
                          <SelectItem value="HOURS">Por horas de uso</SelectItem>
                          <SelectItem value="DAYS">Por días / calendario</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                        {formData.maintenanceTrigger === 'KILOMETERS' ? 'Cada cuántos km'
                         : formData.maintenanceTrigger === 'HOURS' ? 'Cada cuántas horas'
                         : 'Cada cuántos días'}
                      </Label>
                      <Input
                        type="number"
                        value={formData.triggerValue || ''}
                        onChange={e => handleTriggerValueChange(parseInt(e.target.value) || 0)}
                        placeholder={
                          formData.maintenanceTrigger === 'KILOMETERS' ? '10000'
                          : formData.maintenanceTrigger === 'HOURS' ? '500' : '30'
                        }
                      />
                    </div>
                  </div>

                  {/* KM: contador actual → próximo */}
                  {formData.maintenanceTrigger === 'KILOMETERS' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="px-4 py-3 rounded-lg bg-muted/50 border text-center">
                        <p className="text-xs text-muted-foreground mb-1">Kilometraje actual</p>
                        <p className="text-xl font-bold tabular-nums">
                          {formData.currentKilometers.toLocaleString()}
                          <span className="text-sm font-normal text-muted-foreground"> km</span>
                        </p>
                      </div>
                      <div className="px-4 py-3 rounded-lg bg-info-muted border text-center">
                        <p className="text-xs text-info-muted-foreground mb-1">Próximo mantenimiento</p>
                        <p className="text-xl font-bold tabular-nums text-info-muted-foreground">
                          {formData.nextMaintenanceKilometers.toLocaleString()}
                          <span className="text-sm font-normal"> km</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* DAYS: frecuencia + próxima fecha */}
                  {formData.maintenanceTrigger === 'DAYS' && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Frecuencia</Label>
                        <Select value={formData.frequency} onValueChange={v => setFormData(p => ({ ...p, frequency: v }))}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DAILY">Diario</SelectItem>
                            <SelectItem value="WEEKLY">Semanal</SelectItem>
                            <SelectItem value="BIWEEKLY">Quincenal</SelectItem>
                            <SelectItem value="MONTHLY">Mensual</SelectItem>
                            <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                            <SelectItem value="YEARLY">Anual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {formData.scheduledDate && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="px-4 py-3 rounded-lg bg-muted/50 border">
                            <p className="text-xs text-muted-foreground mb-1">Frecuencia</p>
                            <p className="text-sm font-semibold">{getFrequencyText(formData.frequency)}</p>
                          </div>
                          <div className="px-4 py-3 rounded-lg bg-success-muted border">
                            <p className="text-xs text-success-muted-foreground mb-1">Próxima ejecución</p>
                            <p className="text-sm font-semibold text-success-muted-foreground">
                              {getNextMaintenanceDate() ? formatDateToDDMMYYYY(getNextMaintenanceDate()!) : '—'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-muted/50 border border-dashed text-muted-foreground">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <p className="text-sm">Seleccioná una unidad móvil en el tab General para configurar la programación.</p>
                </div>
              )}
            </TabsContent>

            {/* ════════════════════ TAB: RECURSOS ════════════════════ */}
            <TabsContent value="resources" className="space-y-6 pt-4">

              {/* Herramientas */}
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <Wrench className="h-3.5 w-3.5" />Herramientas requeridas
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nombre de la herramienta"
                    value={toolInput.name}
                    onChange={e => setToolInput(p => ({ ...p, name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addTool()}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Descripción (opcional)"
                    value={toolInput.description}
                    onChange={e => setToolInput(p => ({ ...p, description: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addTool()}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addTool} className="shrink-0 px-2.5">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formData.tools.length > 0 ? (
                  <div className="space-y-1.5">
                    {formData.tools.map((tool, i) => (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-muted/50 border">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium flex-1">{tool.name}</span>
                        {tool.description && (
                          <span className="text-xs text-muted-foreground">{tool.description}</span>
                        )}
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => removeTool(i)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4 border rounded-md border-dashed">
                    Sin herramientas agregadas
                  </p>
                )}
              </div>

              <div className="border-t" />

              {/* Repuestos */}
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" />Repuestos necesarios
                </p>
                <div className="grid grid-cols-[1fr_80px_80px_36px] gap-2">
                  <Input
                    placeholder="Nombre del repuesto"
                    value={sparePartInput.name}
                    onChange={e => setSparePartInput(p => ({ ...p, name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addSparePart()}
                  />
                  <Input
                    type="number" placeholder="Cant."
                    value={sparePartInput.quantity}
                    onChange={e => setSparePartInput(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                    className="text-center"
                  />
                  <Input
                    type="number" placeholder="Costo"
                    value={sparePartInput.cost || ''}
                    onChange={e => setSparePartInput(p => ({ ...p, cost: parseFloat(e.target.value) || 0 }))}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addSparePart} className="px-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formData.spareParts.length > 0 ? (
                  <div className="space-y-1.5">
                    {formData.spareParts.map((part, i) => (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-muted/50 border">
                        <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium flex-1">{part.name}</span>
                        <Badge variant="outline" className="text-xs tabular-nums">×{part.quantity}</Badge>
                        {part.cost > 0 && (
                          <span className="text-xs text-muted-foreground tabular-nums">${part.cost.toLocaleString()}</span>
                        )}
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => removeSparePart(i)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4 border rounded-md border-dashed">
                    Sin repuestos agregados
                  </p>
                )}
              </div>
            </TabsContent>

            {/* ════════════════════ TAB: DETALLES ════════════════════ */}
            <TabsContent value="details" className="space-y-6 pt-4">

              {/* Notas */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Notas adicionales</Label>
                <Textarea
                  value={formData.notes}
                  onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Observaciones, instrucciones especiales, advertencias…"
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Instructivos */}
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />Instructivos
                </p>
                <div className="space-y-2">
                  <Input
                    placeholder="Título del instructivo"
                    value={instructiveInput.title}
                    onChange={e => setInstructiveInput(p => ({ ...p, title: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Pasos o descripción del procedimiento…"
                      value={instructiveInput.description}
                      onChange={e => setInstructiveInput(p => ({ ...p, description: e.target.value }))}
                      rows={2}
                      className="resize-none flex-1"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={addInstructive} className="self-end shrink-0 px-2.5">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {formData.instructives.length > 0 && (
                  <div className="space-y-1.5">
                    {formData.instructives.map((inst, i) => (
                      <div key={i} className="flex gap-2.5 px-3 py-2.5 rounded-md bg-muted/50 border">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{inst.title}</p>
                          {inst.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{inst.description}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => removeInstructive(i)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Archivos */}
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />Archivos adjuntos
                </p>
                <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed hover:bg-muted/50 transition-colors cursor-pointer">
                  <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">Adjuntar archivos (PDF, DOC, XLS, imágenes…)</span>
                  <input
                    type="file" multiple className="sr-only"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
                    onChange={handleFileUpload}
                  />
                </label>
                {uploadedFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {uploadedFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-muted/50 border">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm flex-1 truncate">{f.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">{formatFileSize(f.size)}</span>
                        <Button
                          type="button" variant="ghost" size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => removeFile(i)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogBody>

        {/* ── Footer ── */}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {mode === 'edit' ? 'Actualizando…' : 'Creando…'}
              </>
            ) : (
              mode === 'edit' ? 'Actualizar Mantenimiento' : 'Crear Mantenimiento'
            )}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
