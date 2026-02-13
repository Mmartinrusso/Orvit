'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Save, ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const mocFormSchema = z.object({
  title: z.string().min(5, 'El título debe tener al menos 5 caracteres'),
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres'),
  changeType: z.enum(['EQUIPMENT', 'PROCESS', 'PROCEDURE', 'MATERIAL', 'PERSONNEL']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  justification: z.string().optional(),
  scope: z.string().optional(),
  impactAssessment: z.string().optional(),
  riskAssessment: z.string().optional(),
  machineId: z.number().nullable().optional(),
  componentId: z.number().nullable().optional(),
  areaId: z.number().nullable().optional(),
  sectorId: z.number().nullable().optional(),
  plannedStartDate: z.string().optional(),
  plannedEndDate: z.string().optional(),
  isTemporary: z.boolean().default(false),
  temporaryUntil: z.string().optional(),
  requiresTraining: z.boolean().default(false),
});

type MOCFormValues = z.infer<typeof mocFormSchema>;

interface MOCFormProps {
  companyId: number;
  mocId?: number;
  initialData?: any;
}

const changeTypeLabels: Record<string, string> = {
  EQUIPMENT: 'Equipo',
  PROCESS: 'Proceso',
  PROCEDURE: 'Procedimiento',
  MATERIAL: 'Material',
  PERSONNEL: 'Personal',
};

const priorityLabels: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export function MOCForm({ companyId, mocId, initialData }: MOCFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditing = !!mocId;

  const form = useForm<MOCFormValues>({
    resolver: zodResolver(mocFormSchema),
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      changeType: initialData?.changeType || 'EQUIPMENT',
      priority: initialData?.priority || 'MEDIUM',
      justification: initialData?.justification || '',
      scope: initialData?.scope || '',
      impactAssessment: initialData?.impactAssessment || '',
      riskAssessment: initialData?.riskAssessment || '',
      machineId: initialData?.machineId || null,
      componentId: initialData?.componentId || null,
      areaId: initialData?.areaId || null,
      sectorId: initialData?.sectorId || null,
      plannedStartDate: initialData?.plannedStartDate?.split('T')[0] || '',
      plannedEndDate: initialData?.plannedEndDate?.split('T')[0] || '',
      isTemporary: initialData?.isTemporary || false,
      temporaryUntil: initialData?.temporaryUntil?.split('T')[0] || '',
      requiresTraining: initialData?.requiresTraining || false,
    },
  });

  // Fetch machines
  const { data: machinesData } = useQuery({
    queryKey: ['machines', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/machines?companyId=${companyId}`);
      if (!res.ok) throw new Error('Error fetching machines');
      return res.json();
    },
  });

  // Fetch areas
  const { data: areasData } = useQuery({
    queryKey: ['areas', companyId],
    queryFn: async () => {
      const res = await fetch(`/api/areas?companyId=${companyId}`);
      if (!res.ok) throw new Error('Error fetching areas');
      return res.json();
    },
  });

  // Fetch sectors based on selected area
  const selectedAreaId = form.watch('areaId');
  const { data: sectorsData } = useQuery({
    queryKey: ['sectors', selectedAreaId],
    queryFn: async () => {
      if (!selectedAreaId) return { sectors: [] };
      const res = await fetch(`/api/sectors?areaId=${selectedAreaId}`);
      if (!res.ok) throw new Error('Error fetching sectors');
      return res.json();
    },
    enabled: !!selectedAreaId,
  });

  // Fetch components based on selected machine
  const selectedMachineId = form.watch('machineId');
  const { data: componentsData } = useQuery({
    queryKey: ['components', selectedMachineId],
    queryFn: async () => {
      if (!selectedMachineId) return { components: [] };
      const res = await fetch(`/api/machines/${selectedMachineId}/components`);
      if (!res.ok) throw new Error('Error fetching components');
      return res.json();
    },
    enabled: !!selectedMachineId,
  });

  const machines = machinesData?.machines || [];
  const areas = areasData?.areas || [];
  const sectors = sectorsData?.sectors || [];
  const components = componentsData?.components || [];

  const createMutation = useMutation({
    mutationFn: async (data: MOCFormValues) => {
      const res = await fetch('/api/moc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, companyId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error creating MOC');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success('MOC creado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['mocs'] });
      router.push(`/mantenimiento/moc/${data.moc.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: MOCFormValues) => {
      const res = await fetch(`/api/moc/${mocId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error updating MOC');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('MOC actualizado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['mocs'] });
      queryClient.invalidateQueries({ queryKey: ['moc', mocId] });
      router.push(`/mantenimiento/moc/${mocId}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (data: MOCFormValues) => {
    // Convert empty strings to null for optional fields
    const cleanedData = {
      ...data,
      machineId: data.machineId || null,
      componentId: data.componentId || null,
      areaId: data.areaId || null,
      sectorId: data.sectorId || null,
      plannedStartDate: data.plannedStartDate || null,
      plannedEndDate: data.plannedEndDate || null,
      temporaryUntil: data.isTemporary && data.temporaryUntil ? data.temporaryUntil : null,
    };

    if (isEditing) {
      updateMutation.mutate(cleanedData);
    } else {
      createMutation.mutate(cleanedData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isTemporary = form.watch('isTemporary');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  {isEditing ? 'Editar MOC' : 'Nuevo MOC'}
                </CardTitle>
                <CardDescription>
                  {isEditing
                    ? 'Modifica los datos del cambio'
                    : 'Registra una solicitud de gestión del cambio'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Información Básica</h3>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título *</FormLabel>
                    <FormControl>
                      <Input placeholder="Descripción breve del cambio" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descripción detallada del cambio propuesto"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="changeType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Cambio *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(changeTypeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridad *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar prioridad" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(priorityLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Location/Asset */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Ubicación / Activo</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="areaId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Área</FormLabel>
                      <Select
                        onValueChange={(val) => {
                          field.onChange(val ? parseInt(val) : null);
                          form.setValue('sectorId', null);
                        }}
                        value={field.value?.toString() || ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar área" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Sin área</SelectItem>
                          {areas.map((area: any) => (
                            <SelectItem key={area.id} value={area.id.toString()}>
                              {area.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sectorId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sector</FormLabel>
                      <Select
                        onValueChange={(val) => field.onChange(val ? parseInt(val) : null)}
                        value={field.value?.toString() || ''}
                        disabled={!selectedAreaId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar sector" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Sin sector</SelectItem>
                          {sectors.map((sector: any) => (
                            <SelectItem key={sector.id} value={sector.id.toString()}>
                              {sector.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="machineId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Máquina</FormLabel>
                      <Select
                        onValueChange={(val) => {
                          field.onChange(val ? parseInt(val) : null);
                          form.setValue('componentId', null);
                        }}
                        value={field.value?.toString() || ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar máquina" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Sin máquina</SelectItem>
                          {machines.map((machine: any) => (
                            <SelectItem key={machine.id} value={machine.id.toString()}>
                              {machine.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="componentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Componente</FormLabel>
                      <Select
                        onValueChange={(val) => field.onChange(val ? parseInt(val) : null)}
                        value={field.value?.toString() || ''}
                        disabled={!selectedMachineId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar componente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Sin componente</SelectItem>
                          {components.map((component: any) => (
                            <SelectItem key={component.id} value={component.id.toString()}>
                              {component.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Justification & Assessment */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Justificación y Evaluación</h3>

              <FormField
                control={form.control}
                name="justification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Justificación del Cambio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="¿Por qué es necesario este cambio?"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scope"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alcance</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="¿Qué áreas, equipos o procesos serán afectados?"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="impactAssessment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Evaluación de Impacto</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="¿Cuál será el impacto del cambio en la operación?"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="riskAssessment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Evaluación de Riesgos</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="¿Cuáles son los riesgos asociados y cómo se mitigarán?"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Planning */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Planificación</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="plannedStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Inicio Planificada</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="plannedEndDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Fin Planificada</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="isTemporary"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Cambio Temporal</FormLabel>
                        <FormDescription>
                          Marcar si el cambio es temporal y debe revertirse
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {isTemporary && (
                  <FormField
                    control={form.control}
                    name="temporaryUntil"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vigente Hasta</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormDescription>
                          Fecha hasta la cual el cambio temporal estará vigente
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="requiresTraining"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Requiere Capacitación</FormLabel>
                        <FormDescription>
                          Marcar si el personal necesita capacitación para implementar el cambio
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isEditing ? 'Actualizar' : 'Crear MOC'}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default MOCForm;
