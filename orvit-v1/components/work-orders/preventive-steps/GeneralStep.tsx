'use client';

import { Priority } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Info, User } from 'lucide-react';
import { SectionCard } from '../SectionCard';
import { cn } from '@/lib/utils';
import { PreventiveFormData, ValidationErrors } from './types';

interface GeneralStepProps {
  formData: Pick<PreventiveFormData, 'title' | 'description' | 'priority' | 'assignedToId' | 'notes' | 'isActive'>;
  handleInputChange: (field: string, value: any) => void;
  clearFieldError: (field: keyof ValidationErrors) => void;
  validationErrors: Pick<ValidationErrors, 'title'>;
  users: any[];
}

export function GeneralStep({
  formData,
  handleInputChange,
  clearFieldError,
  validationErrors,
  users,
}: GeneralStepProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Información General */}
      <SectionCard
        title="Información General"
        icon={Info}
        description="Datos básicos del mantenimiento preventivo"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-xs font-medium">
              Título <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => {
                handleInputChange('title', e.target.value);
                clearFieldError('title');
              }}
              placeholder="Ej: Lubricación de rodamientos"
              className={cn(
                validationErrors.title ? 'border-destructive ring-destructive/20 ring-2' : '',
                !formData.title.trim() && !validationErrors.title ? 'border-destructive/50' : ''
              )}
            />
            {validationErrors.title ? (
              <p className="text-xs text-destructive font-medium">{validationErrors.title}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nombre descriptivo del mantenimiento
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs font-medium">
              Descripción
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describa el procedimiento de mantenimiento..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Detalles del procedimiento a realizar
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority" className="text-xs font-medium">
              Prioridad <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => handleInputChange('priority', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={Priority.LOW}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-muted-foreground rounded-full"></div>
                    Baja
                  </div>
                </SelectItem>
                <SelectItem value={Priority.MEDIUM}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-warning rounded-full"></div>
                    Media
                  </div>
                </SelectItem>
                <SelectItem value={Priority.HIGH}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-warning rounded-full"></div>
                    Alta
                  </div>
                </SelectItem>
                <SelectItem value={Priority.URGENT}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-destructive rounded-full"></div>
                    Urgente
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Nivel de urgencia del mantenimiento
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Asignación */}
      <SectionCard
        title="Asignación"
        icon={User}
        description="Técnico responsable y configuración"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assignedTo" className="text-xs font-medium">
              Técnico Asignado
            </Label>
            <Select
              value={formData.assignedToId}
              onValueChange={(value) => handleInputChange('assignedToId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar técnico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>

                {/* Usuarios del Sistema */}
                {users.filter(user => user.type === 'USER').length > 0 && (
                  <>
                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50 border-b">
                      Usuarios del Sistema
                    </div>
                    {users.filter(user => user.type === 'USER').map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        <div className="flex items-center justify-between w-full">
                          <span>{user.name}</span>
                          <Badge variant="secondary" className="bg-info-muted text-info-muted-foreground text-xs ml-2">
                            {user.role === 'ADMIN' || user.role === 'SUPERADMIN' ? 'Admin' : 'Usuario'}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}

                {/* Operarios */}
                {users.filter(user => user.type === 'WORKER').length > 0 && (
                  <>
                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50 border-b">
                      Operarios
                    </div>
                    {users.filter(user => user.type === 'WORKER').map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        <div className="flex items-center justify-between w-full">
                          <div className="flex flex-col items-start">
                            <span>{user.name}</span>
                            {user.specialty && (
                              <span className="text-xs text-muted-foreground">
                                {user.specialty}
                              </span>
                            )}
                          </div>
                          <Badge variant="secondary" className="bg-success-muted text-success text-xs ml-2">
                            Operario
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Persona responsable de ejecutar el mantenimiento
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-xs font-medium">
              Notas Adicionales
            </Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Instrucciones especiales, precauciones..."
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Información adicional para el técnico
            </p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="isActive" className="text-xs font-medium">
                Mantenimiento activo
              </Label>
              <p className="text-xs text-muted-foreground">
                El mantenimiento se ejecutará según la programación
              </p>
            </div>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => handleInputChange('isActive', checked)}
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
