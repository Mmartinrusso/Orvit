'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
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
import { CalendarIcon, Clock, User, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDateTimeFull } from '@/lib/date-utils';
import { DateTimeInput } from '@/components/ui/DateTimeInput';
import { Contact, Reminder } from "@/types/agenda";

interface ReminderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reminder: Partial<Reminder>) => void;
  reminder?: Reminder | null;
  contacts: Contact[];
  isLoading?: boolean;
  preSelectedContact?: Contact | null;
}

const PRIORITY_OPTIONS = [
  { value: 'baja', label: 'Baja', color: 'text-blue-600' },
  { value: 'media', label: 'Media', color: 'text-yellow-600' },
  { value: 'alta', label: 'Alta', color: 'text-red-600' },
];

const TYPE_OPTIONS = [
  { value: 'GENERAL', label: 'General' },
  { value: 'CALL', label: 'Llamar' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'MEETING', label: 'Reunión' },
  { value: 'FOLLOW_UP', label: 'Seguimiento' },
  { value: 'TASK', label: 'Tarea' },
];

export function ReminderDialog({
  isOpen,
  onClose,
  onSubmit,
  reminder,
  contacts,
  isLoading = false,
  preSelectedContact = null,
}: ReminderDialogProps) {
  const [formData, setFormData] = useState<Partial<Reminder>>({
    title: '',
    description: '',
    dueDate: '',
    priority: 'media',
    type: 'GENERAL',
    contactId: 'none',
    isCompleted: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when dialog opens/closes or reminder changes
  useEffect(() => {
    if (isOpen) {
      if (reminder) {
        // Editar recordatorio existente
        setFormData({
          title: reminder.title,
          description: reminder.description,
          dueDate: reminder.dueDate || '',
          priority: reminder.priority,
          type: reminder.type,
          contactId: reminder.contactId || 'none',
          isCompleted: reminder.isCompleted,
        });
      } else {
        // Nuevo recordatorio
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        
        setFormData({
          title: '',
          description: '',
          dueDate: tomorrow.toISOString(),
          priority: 'media',
          type: 'GENERAL',
          contactId: preSelectedContact?.id || 'none',
          isCompleted: false,
        });
      }
      setErrors({});
    }
  }, [isOpen, reminder, preSelectedContact]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title?.trim()) {
      newErrors.title = 'El título es requerido';
    }

    if (!formData.dueDate) {
      newErrors.dueDate = 'La fecha es requerida';
    } else {
      const selectedDate = new Date(formData.dueDate);
      const now = new Date();
      
      if (selectedDate < now) {
        newErrors.dueDate = 'La fecha no puede ser en el pasado';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Limpiar contactId si está vacío o es "none"
    const submitData = {
      ...formData,
      contactId: formData.contactId === '' || formData.contactId === 'none' ? undefined : formData.contactId,
    };

    onSubmit(submitData);
  };

  const handleInputChange = (field: keyof Reminder, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const selectedContact = formData.contactId !== 'none' ? contacts.find(c => c.id === formData.contactId) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent size="default">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            {reminder ? 'Editar Recordatorio' : 'Nuevo Recordatorio'}
            {preSelectedContact && (
              <span className="text-sm font-normal text-gray-500">
                para {preSelectedContact.name}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Título *
            </Label>
            <Input
              id="title"
              value={formData.title || ''}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder={preSelectedContact 
                ? `ej. Llamar a ${preSelectedContact.name} sobre...`
                : "ej. Llamar a cliente sobre propuesta"
              }
              className={errors.title ? 'border-red-500' : ''}
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title}</p>
            )}
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Descripción
            </Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Detalles adicionales del recordatorio..."
              rows={3}
            />
          </div>

          {/* Fecha y Hora */}
          <div className="space-y-2">
            <Label htmlFor="dueDate" className="text-sm font-medium">
              Fecha y Hora *
            </Label>
            <DateTimeInput
              value={formData.dueDate || ''}
              onChange={(value) => handleInputChange('dueDate', value)}
              placeholder="dd/mm/yyyy HH:mm"
              error={!!errors.dueDate}
            />
            {errors.dueDate && (
              <p className="text-sm text-red-500">{errors.dueDate}</p>
            )}
          </div>

          {/* Prioridad y Tipo */}
          <div className="grid grid-cols-2 gap-4">
            {/* Prioridad */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Prioridad</Label>
              <Select
                value={formData.priority || 'media'}
                onValueChange={(value) => handleInputChange('priority', value as 'baja' | 'media' | 'alta')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          option.value === 'alta' ? 'bg-red-500' :
                          option.value === 'media' ? 'bg-yellow-500' : 'bg-blue-500'
                        }`} />
                        <span className={option.color}>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipo</Label>
              <Select
                value={formData.type || 'GENERAL'}
                onValueChange={(value) => handleInputChange('type', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <Tag className="h-3 w-3" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contacto */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Contacto relacionado</Label>
            <Select
              value={formData.contactId || 'none'}
              onValueChange={(value) => handleInputChange('contactId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar contacto (opcional)">
                  {selectedContact && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{selectedContact.name}</span>
                      {selectedContact.company && (
                        <span className="text-gray-500">({selectedContact.company})</span>
                      )}
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin contacto específico</SelectItem>
                {contacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <div className="flex flex-col">
                        <span>{contact.name}</span>
                        {contact.company && (
                          <span className="text-xs text-gray-500">{contact.company}</span>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vista previa de fecha */}
          {formData.dueDate && (
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <CalendarIcon className="inline h-4 w-4 mr-1" />
                Recordatorio programado para: {' '}
                <strong>
                  {formatDateTimeFull(formData.dueDate)}
                </strong>
              </p>
            </div>
          )}

        </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            size="default"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            variant="default"
            size="default"
            onClick={handleSubmit}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Guardando...
              </div>
            ) : (
              reminder ? 'Actualizar' : 'Crear Recordatorio'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 