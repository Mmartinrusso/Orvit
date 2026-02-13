'use client';

import { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { DatePicker } from '@/components/ui/date-picker';
import { Loader2, Plus, X, Bell } from 'lucide-react';
import { searchAssignees, type AssigneeOption } from '@/lib/agenda/api';
import type { AgendaTask, Priority, CreateAgendaTaskInput } from '@/lib/agenda/types';

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: AgendaTask | null;
  onSave: (data: CreateAgendaTaskInput) => Promise<void>;
  isSaving: boolean;
}

export function TaskDialog({ open, onOpenChange, task, onSave, isSaving }: TaskDialogProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const isEditing = !!task;

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<string>('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [category, setCategory] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState<number | null>(null);
  const [assignedToContactId, setAssignedToContactId] = useState<number | null>(null);
  const [assignedToName, setAssignedToName] = useState('');

  // Assignees search
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [assigneeOptions, setAssigneeOptions] = useState<AssigneeOption[]>([]);
  const [loadingAssignees, setLoadingAssignees] = useState(false);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);

  // Reminders
  const [reminders, setReminders] = useState<{ remindAt: string }[]>([]);

  // Reset form when dialog opens/closes or task changes
  useEffect(() => {
    if (open) {
      if (task) {
        setTitle(task.title);
        setDescription(task.description || '');
        setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
        setPriority(task.priority);
        setCategory(task.category || '');
        setAssignedToUserId(task.assignedToUserId);
        setAssignedToContactId(task.assignedToContactId);
        setAssignedToName(task.assignedToName || '');
        setReminders(
          task.reminders?.map((r) => ({ remindAt: r.remindAt.split('T')[0] })) || []
        );
      } else {
        setTitle('');
        setDescription('');
        setDueDate('');
        setPriority('MEDIUM');
        setCategory('');
        setAssignedToUserId(null);
        setAssignedToContactId(null);
        setAssignedToName('');
        setReminders([]);
      }
      setAssigneeSearch('');
      setShowAssigneeDropdown(false);
    }
  }, [open, task]);

  // Search assignees
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (!currentCompany?.id || !user?.id) return;

      setLoadingAssignees(true);
      try {
        const results = await searchAssignees(currentCompany.id, user.id, assigneeSearch);
        setAssigneeOptions(results);
      } catch (error) {
        console.error('Error searching assignees:', error);
      } finally {
        setLoadingAssignees(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [assigneeSearch, currentCompany?.id, user?.id]);

  const handleAssigneeSelect = (assignee: AssigneeOption) => {
    setAssignedToName(assignee.name);
    if (assignee.type === 'user') {
      setAssignedToUserId(assignee.id);
      setAssignedToContactId(null);
    } else {
      setAssignedToContactId(assignee.id);
      setAssignedToUserId(null);
    }
    setAssigneeSearch('');
    setShowAssigneeDropdown(false);
  };

  const clearAssignee = () => {
    setAssignedToName('');
    setAssignedToUserId(null);
    setAssignedToContactId(null);
  };

  const addReminder = () => {
    if (dueDate) {
      // Por defecto, recordar el día anterior a las 9:00
      const reminderDate = new Date(dueDate);
      reminderDate.setDate(reminderDate.getDate() - 1);
      setReminders([...reminders, { remindAt: reminderDate.toISOString().split('T')[0] }]);
    } else {
      setReminders([...reminders, { remindAt: '' }]);
    }
  };

  const removeReminder = (index: number) => {
    setReminders(reminders.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    const data: CreateAgendaTaskInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      priority,
      category: category.trim() || undefined,
      assignedToUserId: assignedToUserId || undefined,
      assignedToContactId: assignedToContactId || undefined,
      assignedToName: assignedToName || undefined,
      reminders: reminders
        .filter((r) => r.remindAt)
        .map((r) => ({
          remindAt: new Date(`${r.remindAt}T09:00:00`).toISOString(),
          notifyVia: ['DISCORD'],
        })),
    };

    await onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Tarea' : 'Nueva Tarea'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Modifica los datos de la tarea'
                : 'Crea una nueva tarea para asignar a alguien'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="¿Qué necesitas que hagan?"
                required
              />
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalles adicionales..."
                rows={3}
              />
            </div>

            {/* Asignar a */}
            <div className="space-y-2">
              <Label>Asignar a</Label>
              <div className="relative">
                {assignedToName ? (
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                    <span className="flex-1">{assignedToName}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={clearAssignee}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      value={assigneeSearch}
                      onChange={(e) => {
                        setAssigneeSearch(e.target.value);
                        setShowAssigneeDropdown(true);
                      }}
                      onFocus={() => setShowAssigneeDropdown(true)}
                      placeholder="Buscar usuario o contacto..."
                    />
                    {showAssigneeDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {loadingAssignees ? (
                          <div className="p-2 text-center text-sm text-muted-foreground">
                            Buscando...
                          </div>
                        ) : assigneeOptions.length === 0 ? (
                          <div className="p-2 text-center text-sm text-muted-foreground">
                            {assigneeSearch ? 'Sin resultados' : 'Escribe para buscar'}
                          </div>
                        ) : (
                          assigneeOptions.map((option) => (
                            <button
                              key={`${option.type}-${option.id}`}
                              type="button"
                              className="w-full p-2 text-left hover:bg-muted flex items-center justify-between"
                              onClick={() => handleAssigneeSelect(option)}
                            >
                              <span>{option.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {option.type === 'user' ? 'Usuario' : 'Contacto'}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Fecha y Prioridad */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha de vencimiento</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Baja</SelectItem>
                    <SelectItem value="MEDIUM">Media</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                    <SelectItem value="URGENT">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Categoría */}
            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ej: Compras, Administrativo, Técnico..."
              />
            </div>

            {/* Recordatorios */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Recordatorios por Discord
                </Label>
                <Button type="button" variant="outline" size="sm" onClick={addReminder}>
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar
                </Button>
              </div>
              {reminders.length > 0 && (
                <div className="space-y-2">
                  {reminders.map((reminder, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={reminder.remindAt}
                        onChange={(e) => {
                          const newReminders = [...reminders];
                          newReminders[index].remindAt = e.target.value;
                          setReminders(newReminders);
                        }}
                        className="flex-1"
                      />
                      <span className="text-xs text-muted-foreground">a las 9:00</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => removeReminder(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || !title.trim()}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Guardar cambios' : 'Crear tarea'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
