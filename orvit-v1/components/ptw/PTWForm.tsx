'use client';

import { useState, useEffect } from 'react';
import { PermitToWork, PTWType, PTWStatus, Machine, Sector } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
// Using native datetime-local inputs instead of DateTimePicker
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, X, AlertTriangle, Shield, Phone, MapPin } from 'lucide-react';
import PTWTypeBadge from './PTWTypeBadge';

interface PTWFormProps {
  permit?: Partial<PermitToWork>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<PermitToWork>) => Promise<void>;
  machines?: Machine[];
  sectors?: Sector[];
  workOrders?: { id: number; title: string }[];
  mode?: 'dialog' | 'sheet';
}

const PPE_OPTIONS = [
  'Casco de seguridad',
  'Lentes de seguridad',
  'Guantes de trabajo',
  'Guantes dieléctricos',
  'Botas de seguridad',
  'Arnes de seguridad',
  'Protección auditiva',
  'Mascarilla',
  'Traje ignifugo',
  'Chaleco reflectante',
  'Protección facial',
  'Delantal de cuero',
];

export default function PTWForm({
  permit,
  isOpen,
  onClose,
  onSave,
  machines = [],
  sectors = [],
  workOrders = [],
  mode = 'sheet',
}: PTWFormProps) {
  const isEditing = !!permit?.id;

  const [formData, setFormData] = useState<Partial<PermitToWork>>({
    type: PTWType.HOT_WORK,
    title: '',
    description: '',
    workLocation: '',
    hazardsIdentified: [],
    controlMeasures: [],
    requiredPPE: [],
    emergencyProcedures: '',
    emergencyContacts: [],
    validFrom: new Date(),
    validTo: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours later
  });

  const [newHazard, setNewHazard] = useState('');
  const [newMeasure, setNewMeasure] = useState('');
  const [newContact, setNewContact] = useState({ name: '', phone: '', role: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (permit) {
      setFormData({
        ...permit,
        validFrom: permit.validFrom ? new Date(permit.validFrom) : new Date(),
        validTo: permit.validTo ? new Date(permit.validTo) : new Date(Date.now() + 8 * 60 * 60 * 1000),
        hazardsIdentified: permit.hazardsIdentified || [],
        controlMeasures: permit.controlMeasures || [],
        requiredPPE: permit.requiredPPE || [],
        emergencyContacts: permit.emergencyContacts || [],
      });
    } else {
      setFormData({
        type: PTWType.HOT_WORK,
        title: '',
        description: '',
        workLocation: '',
        hazardsIdentified: [],
        controlMeasures: [],
        requiredPPE: [],
        emergencyProcedures: '',
        emergencyContacts: [],
        validFrom: new Date(),
        validTo: new Date(Date.now() + 8 * 60 * 60 * 1000),
      });
    }
    setErrors({});
  }, [permit, isOpen]);

  const handleChange = (field: keyof PermitToWork, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const addHazard = () => {
    if (newHazard.trim()) {
      setFormData(prev => ({
        ...prev,
        hazardsIdentified: [...(prev.hazardsIdentified || []), newHazard.trim()],
      }));
      setNewHazard('');
    }
  };

  const removeHazard = (index: number) => {
    setFormData(prev => ({
      ...prev,
      hazardsIdentified: prev.hazardsIdentified?.filter((_, i) => i !== index),
    }));
  };

  const addMeasure = () => {
    if (newMeasure.trim()) {
      setFormData(prev => ({
        ...prev,
        controlMeasures: [...(prev.controlMeasures || []), newMeasure.trim()],
      }));
      setNewMeasure('');
    }
  };

  const removeMeasure = (index: number) => {
    setFormData(prev => ({
      ...prev,
      controlMeasures: prev.controlMeasures?.filter((_, i) => i !== index),
    }));
  };

  const togglePPE = (ppe: string) => {
    setFormData(prev => ({
      ...prev,
      requiredPPE: prev.requiredPPE?.includes(ppe)
        ? prev.requiredPPE.filter(p => p !== ppe)
        : [...(prev.requiredPPE || []), ppe],
    }));
  };

  const addContact = () => {
    if (newContact.name && newContact.phone) {
      setFormData(prev => ({
        ...prev,
        emergencyContacts: [...(prev.emergencyContacts || []), { ...newContact }],
      }));
      setNewContact({ name: '', phone: '', role: '' });
    }
  };

  const removeContact = (index: number) => {
    setFormData(prev => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts?.filter((_, i) => i !== index),
    }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title?.trim()) newErrors.title = 'El titulo es requerido';
    if (!formData.description?.trim()) newErrors.description = 'La descripcion es requerida';
    if (!formData.type) newErrors.type = 'El tipo es requerido';
    if (!formData.validFrom) newErrors.validFrom = 'La fecha de inicio es requerida';
    if (!formData.validTo) newErrors.validTo = 'La fecha de fin es requerida';
    if (formData.validFrom && formData.validTo && formData.validFrom >= formData.validTo) {
      newErrors.validTo = 'La fecha de fin debe ser posterior a la de inicio';
    }
    if (!formData.hazardsIdentified?.length) {
      newErrors.hazardsIdentified = 'Debe identificar al menos un peligro';
    }
    if (!formData.controlMeasures?.length) {
      newErrors.controlMeasures = 'Debe definir al menos una medida de control';
    }
    if (!formData.requiredPPE?.length) {
      newErrors.requiredPPE = 'Debe seleccionar al menos un EPP';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving PTW:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const content = (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Informacion Basica</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 md:col-span-1">
            <Label htmlFor="type">Tipo de Permiso *</Label>
            <Select
              value={formData.type}
              onValueChange={(v) => handleChange('type', v as PTWType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(PTWType).map((type) => (
                  <SelectItem key={type} value={type}>
                    <PTWTypeBadge type={type} size="sm" />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && <p className="text-sm text-destructive mt-1">{errors.type}</p>}
          </div>

          <div className="col-span-2 md:col-span-1">
            <Label htmlFor="workOrderId">Orden de Trabajo</Label>
            <Select
              value={formData.workOrderId?.toString() || ''}
              onValueChange={(v) => handleChange('workOrderId', v ? parseInt(v) : undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar OT (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {workOrders.map((wo) => (
                  <SelectItem key={wo.id} value={wo.id.toString()}>
                    {wo.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="title">Titulo *</Label>
          <Input
            id="title"
            value={formData.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder="Descripción breve del trabajo"
          />
          {errors.title && <p className="text-sm text-destructive mt-1">{errors.title}</p>}
        </div>

        <div>
          <Label htmlFor="description">Descripcion del Trabajo *</Label>
          <Textarea
            id="description"
            value={formData.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Descripción detallada del trabajo a realizar"
            rows={3}
          />
          {errors.description && <p className="text-sm text-destructive mt-1">{errors.description}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="machineId">Maquina/Equipo</Label>
            <Select
              value={formData.machineId?.toString() || ''}
              onValueChange={(v) => handleChange('machineId', v ? parseInt(v) : undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar (opcional)" />
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

          <div>
            <Label htmlFor="workLocation">
              <MapPin className="h-4 w-4 inline mr-1" />
              Ubicacion del Trabajo
            </Label>
            <Input
              id="workLocation"
              value={formData.workLocation || ''}
              onChange={(e) => handleChange('workLocation', e.target.value)}
              placeholder="Ej: Sector A, Línea 1"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Validity Period */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Periodo de Validez</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Valido Desde *</Label>
            <Input
              type="datetime-local"
              value={formData.validFrom ? new Date(formData.validFrom).toISOString().slice(0, 16) : ''}
              onChange={(e) => handleChange('validFrom', e.target.value ? new Date(e.target.value) : undefined)}
            />
            {errors.validFrom && <p className="text-sm text-destructive mt-1">{errors.validFrom}</p>}
          </div>
          <div>
            <Label>Valido Hasta *</Label>
            <Input
              type="datetime-local"
              value={formData.validTo ? new Date(formData.validTo).toISOString().slice(0, 16) : ''}
              onChange={(e) => handleChange('validTo', e.target.value ? new Date(e.target.value) : undefined)}
            />
            {errors.validTo && <p className="text-sm text-destructive mt-1">{errors.validTo}</p>}
          </div>
        </div>
      </div>

      <Separator />

      {/* Hazards */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          Peligros Identificados *
        </h3>
        <div className="flex gap-2">
          <Input
            value={newHazard}
            onChange={(e) => setNewHazard(e.target.value)}
            placeholder="Agregar peligro identificado"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addHazard())}
          />
          <Button type="button" onClick={addHazard} variant="outline" size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.hazardsIdentified?.map((hazard, idx) => (
            <Badge key={idx} variant="secondary" className="py-1 px-3">
              {hazard}
              <button onClick={() => removeHazard(idx)} className="ml-2 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        {errors.hazardsIdentified && <p className="text-sm text-destructive">{errors.hazardsIdentified}</p>}
      </div>

      <Separator />

      {/* Control Measures */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Shield className="h-5 w-5 text-green-500" />
          Medidas de Control *
        </h3>
        <div className="flex gap-2">
          <Input
            value={newMeasure}
            onChange={(e) => setNewMeasure(e.target.value)}
            placeholder="Agregar medida de control"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMeasure())}
          />
          <Button type="button" onClick={addMeasure} variant="outline" size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {formData.controlMeasures?.map((measure, idx) => (
            <Badge key={idx} variant="outline" className="py-1 px-3 border-green-300 text-green-700">
              {measure}
              <button onClick={() => removeMeasure(idx)} className="ml-2 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        {errors.controlMeasures && <p className="text-sm text-destructive">{errors.controlMeasures}</p>}
      </div>

      <Separator />

      {/* PPE */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">EPP Requerido *</h3>
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
        {errors.requiredPPE && <p className="text-sm text-destructive">{errors.requiredPPE}</p>}
      </div>

      <Separator />

      {/* Emergency Procedures */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Procedimientos de Emergencia</h3>
        <Textarea
          value={formData.emergencyProcedures || ''}
          onChange={(e) => handleChange('emergencyProcedures', e.target.value)}
          placeholder="Describir procedimientos en caso de emergencia"
          rows={3}
        />
      </div>

      <Separator />

      {/* Emergency Contacts */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Phone className="h-5 w-5 text-blue-500" />
          Contactos de Emergencia
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <Input
            value={newContact.name}
            onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Nombre"
          />
          <Input
            value={newContact.phone}
            onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="Telefono"
          />
          <div className="flex gap-2">
            <Input
              value={newContact.role}
              onChange={(e) => setNewContact(prev => ({ ...prev, role: e.target.value }))}
              placeholder="Rol"
            />
            <Button type="button" onClick={addContact} variant="outline" size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {formData.emergencyContacts && formData.emergencyContacts.length > 0 && (
          <div className="space-y-2">
            {formData.emergencyContacts.map((contact: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                <div>
                  <span className="font-medium">{contact.name}</span>
                  <span className="text-muted-foreground mx-2">|</span>
                  <span>{contact.phone}</span>
                  {contact.role && (
                    <>
                      <span className="text-muted-foreground mx-2">|</span>
                      <span className="text-sm text-muted-foreground">{contact.role}</span>
                    </>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeContact(idx)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={onClose} disabled={isSaving}>
        Cancelar
      </Button>
      <Button onClick={handleSubmit} disabled={isSaving}>
        {isSaving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear PTW'}
      </Button>
    </div>
  );

  if (mode === 'dialog') {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Permiso de Trabajo' : 'Nuevo Permiso de Trabajo'}</DialogTitle>
            <DialogDescription>
              Complete los campos requeridos para {isEditing ? 'actualizar' : 'crear'} el permiso de trabajo.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            {content}
          </ScrollArea>
          <DialogFooter>{footer}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar Permiso de Trabajo' : 'Nuevo Permiso de Trabajo'}</SheetTitle>
          <SheetDescription>
            Complete los campos requeridos para {isEditing ? 'actualizar' : 'crear'} el permiso de trabajo.
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          {content}
        </div>
        <SheetFooter>{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
