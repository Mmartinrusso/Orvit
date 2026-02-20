'use client';

import { useForm } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, FolderOpen, ChevronRight, Layers } from 'lucide-react';
import { LogoUpload } from '@/components/ui/LogoUpload';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';

// Colores predefinidos para zonas
const ZONE_COLORS = [
  { value: '#3B82F6', label: 'Azul' },
  { value: '#10B981', label: 'Verde' },
  { value: '#F59E0B', label: 'Amarillo' },
  { value: '#EF4444', label: 'Rojo' },
  { value: '#8B5CF6', label: 'Violeta' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#06B6D4', label: 'Cyan' },
  { value: '#F97316', label: 'Naranja' },
];

// Información del componente padre para contexto jerárquico
interface ParentZoneInfo {
  id: number;
  name: string;
  breadcrumb?: string[];
  depth?: number;
}

interface PlantZoneDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (zone: any) => Promise<void>;
  zone?: any; // Para edición
  sectorId: number;
  companyId: number;
  sectorName?: string;
  parentZone?: ParentZoneInfo; // Para crear sub-zonas
}

const zoneSchema = z.object({
  name: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres' }),
  description: z.string().optional(),
  color: z.string().optional(),
  logo: z.string().optional(),
});

type ZoneFormValues = z.infer<typeof zoneSchema>;

export default function PlantZoneDialog({
  isOpen,
  onClose,
  onSave,
  zone,
  sectorId,
  companyId,
  sectorName,
  parentZone
}: PlantZoneDialogProps) {
  const isEditing = !!zone;
  const [logoUrl, setLogoUrl] = useState(zone?.logo || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ZoneFormValues>({
    resolver: zodResolver(zoneSchema),
    defaultValues: {
      name: zone?.name || '',
      description: zone?.description || '',
      color: zone?.color || '#3B82F6',
      logo: zone?.logo || '',
    },
  });

  // Reset form cuando cambia la zona o se abre el dialog
  useEffect(() => {
    if (isOpen) {
      form.reset({
        name: zone?.name || '',
        description: zone?.description || '',
        color: zone?.color || '#3B82F6',
        logo: zone?.logo || '',
      });
      setLogoUrl(zone?.logo || '');
    }
  }, [isOpen, zone, form]);

  const handleLogoUploaded = (url: string) => {
    setLogoUrl(url);
    form.setValue('logo', url);
  };

  const handleLogoRemoved = () => {
    setLogoUrl('');
    form.setValue('logo', '');
  };

  const onSubmit = async (data: ZoneFormValues) => {
    setIsSubmitting(true);
    try {
      const zoneData = {
        ...data,
        logo: logoUrl,
        sectorId,
        companyId,
        parentId: parentZone?.id || zone?.parentId || null,
      };

      if (isEditing && zone?.id) {
        // Actualizar zona existente
        const response = await fetch(`/api/plant-zones/${zone.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(zoneData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Error al actualizar zona');
        }

        await onSave(await response.json());
      } else {
        // Crear nueva zona
        const response = await fetch('/api/plant-zones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(zoneData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Error al crear zona');
        }

        await onSave(await response.json());
      }

      onClose();
    } catch (error) {
      console.error('Error guardando zona:', error);
      // TODO: Mostrar toast de error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            {isEditing ? 'Editar zona' : 'Nueva zona de planta'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los datos de la zona y haz clic en guardar.'
              : 'Las zonas te permiten organizar tus máquinas en grupos lógicos.'}
          </DialogDescription>

          {/* Breadcrumb de ubicación */}
          {(parentZone || sectorName) && (
            <div className="mt-2 p-2 bg-muted/50 rounded-md">
              <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                <Layers className="h-3 w-3" />
                <span className="font-medium">Ubicación:</span>
                {sectorName && (
                  <>
                    <span className="text-primary">{sectorName}</span>
                    {parentZone && <ChevronRight className="h-3 w-3" />}
                  </>
                )}
                {parentZone?.breadcrumb?.map((item, index) => (
                  <span key={index} className="flex items-center gap-1">
                    <span className={index === parentZone.breadcrumb!.length - 1 ? "text-primary font-medium" : ""}>
                      {item}
                    </span>
                    {index < parentZone.breadcrumb!.length - 1 && (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </span>
                )) || (parentZone && <span className="text-primary font-medium">{parentZone.name}</span>)}
              </div>
              {parentZone?.depth !== undefined && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Nivel actual: {parentZone.depth + 1} → Nueva zona será nivel {parentZone.depth + 2}
                </div>
              )}
            </div>
          )}
        </DialogHeader>

        <DialogBody>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Logo */}
              <div className="mb-4">
                <LogoUpload
                  entityType="plantzone"
                  entityId={zone?.id || 'temp'}
                  currentLogo={logoUrl}
                  onLogoUploaded={handleLogoUploaded}
                  onLogoRemoved={handleLogoRemoved}
                  title="Logo de la Zona"
                  description="Imagen para identificar esta zona"
                />
              </div>

              {/* Nombre */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ej: Planta Dosificadora, Zona de Mezcla" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Descripción */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Descripción de la zona (opcional)"
                        rows={2}
                      />
                    </FormControl>
                    <FormDescription>
                      Puedes agregar detalles sobre qué contiene esta zona
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Color */}
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color identificador</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {ZONE_COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          className={cn('w-8 h-8 rounded-full border-2 transition-transform',
                            field.value === color.value
                              ? 'border-foreground scale-110'
                              : 'border-transparent hover:scale-105'
                          )}
                          style={{ backgroundColor: color.value }}
                          onClick={() => field.onChange(color.value)}
                          title={color.label}
                        />
                      ))}
                    </div>
                    <FormDescription>
                      El color ayuda a identificar visualmente la zona
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            size="sm"
            onClick={form.handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              isEditing ? 'Guardar cambios' : 'Crear zona'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
