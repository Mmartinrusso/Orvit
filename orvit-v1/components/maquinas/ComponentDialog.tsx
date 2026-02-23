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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Package, Wrench, Search } from 'lucide-react';
import { LogoUpload } from '@/components/ui/LogoUpload';
import { PhotoUpload } from '@/components/ui/PhotoUpload';
import { useState, useEffect, useMemo } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Información del componente padre para contexto jerárquico
interface ParentComponentInfo {
  id: number;
  name: string;
  breadcrumb?: string[]; // Ruta completa desde la raíz
  depth?: number; // Profundidad actual del padre
}

const componentSchema = z.object({
  name: z.string().min(2, { message: 'El nombre es obligatorio' }),
  type: z.string().min(2, { message: 'El tipo es obligatorio' }),
  system: z.string().optional(),
  technicalInfo: z.string().optional(),
  machineId: z.number(),
  logo: z.string().optional(),
  photo: z.string().optional(),
  spareAction: z.enum(['none', 'link', 'create']).default('none'),
  existingSpareId: z.number().optional(),
  initialStock: z.number().min(0).default(0),
  spareMinStock: z.number().min(0).default(0),
  spareCategory: z.string().default('Repuestos'),
  // Campos específicos para el repuesto
  spareName: z.string().optional(),
  spareDescription: z.string().optional(),
  spareImage: z.string().optional(),
}).refine((data) => {
  // Si se selecciona crear repuesto, el nombre es obligatorio
  if (data.spareAction === 'create') {
    return data.spareName && data.spareName.trim().length >= 2;
  }
  return true;
}, {
  message: "El nombre del repuesto es obligatorio cuando se crea un nuevo repuesto",
  path: ["spareName"]
}).refine((data) => {
  // Si se selecciona vincular repuesto existente, el ID es obligatorio
  if (data.spareAction === 'link') {
    return data.existingSpareId && data.existingSpareId > 0;
  }
  return true;
}, {
  message: "Debes seleccionar un repuesto existente para vincular",
  path: ["existingSpareId"]
});

type ComponentFormValues = z.infer<typeof componentSchema>;

type ComponentDialogInitialValues = Partial<ComponentFormValues> & { id?: string | number };

interface ComponentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ComponentFormValues) => void | Promise<void>;
  machineId: number;
  initialValues?: ComponentDialogInitialValues;
  parentComponent?: ParentComponentInfo; // Para mostrar contexto cuando se crea un subcomponente
  machineName?: string; // Nombre de la máquina para el breadcrumb
}

export default function ComponentDialog({ isOpen, onClose, onSave, machineId, initialValues, parentComponent, machineName }: ComponentDialogProps) {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [availableSpares, setAvailableSpares] = useState<any[]>([]);
  const [loadingSpares, setLoadingSpares] = useState(false);
  const [machineStatus, setMachineStatus] = useState<string>('');
  const [spareSearchQuery, setSpareSearchQuery] = useState<string>('');

  // Filtrar repuestos basado en búsqueda
  const filteredSpares = useMemo(() => {
    if (!spareSearchQuery.trim()) return availableSpares;
    const query = spareSearchQuery.toLowerCase();
    return availableSpares.filter(spare =>
      spare.name?.toLowerCase().includes(query) ||
      spare.brand?.toLowerCase().includes(query) ||
      spare.model?.toLowerCase().includes(query) ||
      spare.category?.toLowerCase().includes(query)
    );
  }, [availableSpares, spareSearchQuery]);

  // Cargar repuestos disponibles y estado de la máquina cuando se abre el modal
  useEffect(() => {
    if (isOpen && currentCompany) {
      fetchAvailableSpares();
      fetchMachineStatus();
      setSpareSearchQuery(''); // Reset search on open
    }
  }, [isOpen, currentCompany, machineId]);

  const fetchAvailableSpares = async () => {
    if (!currentCompany) return;
    
    setLoadingSpares(true);
    try {
      const response = await fetch(`/api/tools?companyId=${currentCompany.id}&itemType=SUPPLY`);
      if (response.ok) {
        const data = await response.json();
        setAvailableSpares(data.tools || []);
      }
    } catch (error) {
      console.error('Error fetching spares:', error);
    } finally {
      setLoadingSpares(false);
    }
  };

  const fetchMachineStatus = async () => {
    try {
      const response = await fetch(`/api/maquinas/${machineId}`);
      if (response.ok) {
        const machine = await response.json();
        setMachineStatus(machine.status || 'ACTIVE');
      }
    } catch (error) {
      console.error('Error fetching machine status:', error);
      setMachineStatus('ACTIVE');
    }
  };

  const getMachineStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'Activo';
      case 'OUT_OF_SERVICE':
        return 'Fuera de servicio';
      case 'DECOMMISSIONED':
        return 'Baja';
      case 'MAINTENANCE':
        return 'Mantenimiento';
      default:
        return 'Activo';
    }
  };
  
  const form = useForm<ComponentFormValues>({
    resolver: zodResolver(componentSchema),
    defaultValues: {
      name: initialValues?.name || '',
      type: initialValues?.type || 'PART',
      system: initialValues?.system || '',
      technicalInfo: initialValues?.technicalInfo || '',
      machineId: machineId,
      logo: initialValues?.logo || '',
      photo: initialValues?.photo || '',
      spareAction: (initialValues?.existingSpareId || initialValues?.spareName) ? 'link' : 'none',
      existingSpareId: initialValues?.existingSpareId,
      initialStock: initialValues?.initialStock || 0,
      spareMinStock: initialValues?.spareMinStock || 0,
      spareCategory: initialValues?.spareCategory || 'Repuestos',
      spareName: initialValues?.spareName || '',
      spareDescription: initialValues?.spareDescription || '',
      spareImage: initialValues?.spareImage || '',
    },
  });

  // Resetear el formulario cuando cambian los initialValues
  useEffect(() => {
    if (initialValues && isOpen) {
      form.reset({
        name: initialValues?.name || '',
        type: initialValues?.type || 'PART',
        system: initialValues?.system || '',
        technicalInfo: initialValues?.technicalInfo || '',
        machineId: machineId,
        logo: initialValues?.logo || '',
        photo: initialValues?.photo || '',
        spareAction: (initialValues?.existingSpareId || initialValues?.spareName) ? 'link' : 'none',
        existingSpareId: initialValues?.existingSpareId,
        initialStock: initialValues?.initialStock || 0,
        spareMinStock: initialValues?.spareMinStock || 0,
        spareCategory: initialValues?.spareCategory || 'Repuestos',
        spareName: initialValues?.spareName || '',
        spareDescription: initialValues?.spareDescription || '',
        spareImage: initialValues?.spareImage || '',
      });
    }
  }, [initialValues, machineId, isOpen]);



  // Callback para actualizar el logo en el form
  const handleLogoUploaded = (url: string) => {
    form.setValue('logo', url, { shouldDirty: true, shouldValidate: true });
  };
  const handleLogoRemoved = () => {
    form.setValue('logo', '', { shouldDirty: true, shouldValidate: true });
  };

  // Callback para actualizar la foto en el form (si implementas PhotoUpload)
  const handlePhotoUploaded = (url: string) => {
    form.setValue('photo', url, { shouldDirty: true, shouldValidate: true });
  };
  const handlePhotoRemoved = () => {
    form.setValue('photo', '', { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = async (data: ComponentFormValues) => {
    const dataWithCompany = {
      ...data,
      companyId: currentCompany?.id
    };

    try {
      await onSave(dataWithCompany);

      // Mostrar toast con información del repuesto
      const spareAction = data.spareAction;
      let description = 'El componente ha sido guardado correctamente';

      if (spareAction === 'create' && data.spareName) {
        description = `Componente guardado. Repuesto "${data.spareName}" creado y vinculado.`;
      } else if (spareAction === 'link' && data.existingSpareId) {
        const linkedSpare = availableSpares.find(s => s.id === data.existingSpareId);
        description = `Componente guardado. Vinculado con repuesto "${linkedSpare?.name || 'existente'}".`;
      }

      toast({
        title: initialValues ? 'Componente actualizado' : 'Componente creado',
        description,
      });

      form.reset();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'No se pudo guardar el componente',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent size="md" className="p-0">
        <DialogHeader className="p-3 md:p-4 border-b flex-shrink-0">
          <DialogTitle className="text-sm md:text-base">{initialValues ? 'Editar componente' : 'Agregar componente'}</DialogTitle>
          <DialogDescription className="text-xs md:text-sm">
            {initialValues ? 'Modifica los datos y guarda.' : 'Complete los datos del componente.'}
          </DialogDescription>
          {/* Breadcrumb de jerarquía */}
          {parentComponent && (
            <div className="mt-2 p-2 bg-muted/50 rounded-md">
              <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                <span className="font-medium">Ubicación:</span>
                {machineName && (
                  <>
                    <span className="text-primary truncate max-w-[100px] md:max-w-none">{machineName}</span>
                    <ChevronRight className="h-2.5 w-2.5 md:h-3 md:w-3 flex-shrink-0" />
                  </>
                )}
                {parentComponent.breadcrumb && parentComponent.breadcrumb.length > 0 ? (
                  parentComponent.breadcrumb.map((item, index) => (
                    <span key={index} className="flex items-center gap-1">
                      <span className={cn('truncate max-w-[80px] md:max-w-none', index === parentComponent.breadcrumb!.length - 1 && 'text-primary font-medium')}>
                        {item}
                      </span>
                      {index < parentComponent.breadcrumb!.length - 1 && (
                        <ChevronRight className="h-2.5 w-2.5 md:h-3 md:w-3 flex-shrink-0" />
                      )}
                    </span>
                  ))
                ) : (
                  <span className="text-primary font-medium truncate">{parentComponent.name}</span>
                )}
              </div>
              {parentComponent.depth !== undefined && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Nivel {parentComponent.depth + 1} → Nuevo: nivel {parentComponent.depth + 2}
                </div>
              )}
            </div>
          )}
        </DialogHeader>
        <DialogBody className="flex-1 overflow-y-auto p-3 md:p-4">
          {/* Información del componente */}
          {/* Sección eliminada por solicitud del usuario */}

          <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 md:space-y-4" autoComplete="off">
            {/* Logo */}
            <div className="mb-3">
              <LogoUpload
                entityType="component"
                entityId={typeof initialValues?.id === 'string' || typeof initialValues?.id === 'number' ? initialValues.id : 'temp'}
                currentLogo={form.watch('logo')}
                onLogoUploaded={handleLogoUploaded}
                onLogoRemoved={handleLogoRemoved}
                title="Logo"
                description="Logo del componente"
              />
            </div>

            {/* Nombre */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs md:text-sm">Nombre *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ej: Motor principal"
                      autoComplete="off"
                      className="h-9 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                          const currentElement = e.target as HTMLElement;
                          const focusableElements = Array.from(document.querySelectorAll('input, button, select, textarea, [tabindex]:not([tabindex="-1"])'));
                          const currentIndex = focusableElements.indexOf(currentElement);
                          const nextElement = focusableElements[currentIndex + 1] as HTMLElement;
                          if (nextElement) nextElement.focus();
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {/* Tipo y Sistema en grid */}
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              {/* Tipo */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs md:text-sm">Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-9 text-xs md:text-sm">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PART">Parte</SelectItem>
                        <SelectItem value="PIECE">Pieza</SelectItem>
                        <SelectItem value="SUBPIECE">Subpieza</SelectItem>
                        <SelectItem value="MODULE">Módulo</SelectItem>
                        <SelectItem value="OTHER">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              {/* Sistema */}
              <FormField
                control={form.control}
                name="system"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs md:text-sm">Sistema</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-9 text-xs md:text-sm">
                          <SelectValue placeholder="Sistema" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="electrico">Eléctrico</SelectItem>
                        <SelectItem value="hidraulico">Hidráulico</SelectItem>
                        <SelectItem value="neumatico">Neumático</SelectItem>
                        <SelectItem value="automatizacion">Automatización</SelectItem>
                        <SelectItem value="mecanico">Mecánico</SelectItem>
                        <SelectItem value="refrigeracion">Refrigeración</SelectItem>
                        <SelectItem value="lubricacion">Lubricación</SelectItem>
                        <SelectItem value="combustible">Combustible</SelectItem>
                        <SelectItem value="control">Control</SelectItem>
                        <SelectItem value="seguridad">Seguridad</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>

            {/* Descripción detallada */}
            <FormField
              control={form.control}
              name="technicalInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs md:text-sm">Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Especificaciones técnicas..."
                      rows={2}
                      autoComplete="off"
                      className="text-sm resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          const spareActionSelect = document.querySelector('select[name="spareAction"]') as HTMLSelectElement;
                          if (spareActionSelect) {
                            spareActionSelect.focus();
                          }
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {/* Separador visual */}
            <div className="relative my-4 md:my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Vinculación con Pañol</span>
              </div>
            </div>

            {/* Sección de repuesto automático */}
            <div className="border rounded-lg p-3 md:p-4 bg-info-muted">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 md:h-5 md:w-5 text-info" />
                <h3 className="font-medium text-sm text-info-muted-foreground">Repuestos</h3>
                <Badge variant="secondary" className="text-xs">Opcional</Badge>
              </div>
              
              <FormField
                control={form.control}
                name="spareAction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gestión de repuesto</FormLabel>
                    <Select onValueChange={(value) => {
                      field.onChange(value);
                      
                      // Auto-completar nombre del repuesto cuando se selecciona "create"
                      if (value === 'create') {
                        const componentName = form.getValues('name');
                        const currentSpareName = form.getValues('spareName');
                        
                        if (componentName && (!currentSpareName || currentSpareName.trim() === '')) {
                          form.setValue('spareName', componentName, { shouldDirty: true, shouldValidate: true });
                        }
                      }
                    }} value={field.value}>
                      <FormControl>
                        <SelectTrigger
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                              const currentValue = form.watch('spareAction');
                              if (currentValue === 'create') {
                                const spareNameField = document.querySelector('input[name="spareName"]') as HTMLInputElement;
                                if (spareNameField) {
                                  spareNameField.focus();
                                  return;
                                }
                              }
                              const currentElement = e.target as HTMLElement;
                              const focusableElements = Array.from(document.querySelectorAll('input, button, select, textarea, [tabindex]:not([tabindex="-1"])'));
                              const currentIndex = focusableElements.indexOf(currentElement);
                              const nextElement = focusableElements[currentIndex + 1] as HTMLElement;
                              if (nextElement) nextElement.focus();
                            }
                          }}
                        >
                          <SelectValue placeholder="Seleccionar acción" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">
                          <div className="flex flex-col items-start">
                            <span>🚫 No vincular repuesto</span>
                            <span className="text-xs text-muted-foreground">Este componente no requiere repuestos</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="link">
                          <div className="flex flex-col items-start">
                            <span>🔗 Vincular repuesto existente</span>
                            <span className="text-xs text-muted-foreground">Seleccionar un repuesto que ya existe en el pañol</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="create">
                          <div className="flex flex-col items-start">
                            <span>➕ Crear nuevo repuesto</span>
                            <span className="text-xs text-muted-foreground">Crear un repuesto específico para este componente</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Mostrar información del repuesto actualmente vinculado */}
              {initialValues?.existingSpareId && initialValues?.spareName && (
                <div className="mt-4 p-3 bg-success-muted rounded border border-success-muted">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium text-success">
                      Actualmente vinculado a: {initialValues.spareName}
                    </span>
                  </div>
                  {initialValues.spareDescription && (
                    <div className="text-xs text-success mb-2">
                      {initialValues.spareDescription}
                    </div>
                  )}
                  <div className="flex gap-4 text-xs text-success">
                    <span>Stock: {initialValues.initialStock || 0}</span>
                    <span>Stock Mín: {initialValues.spareMinStock || 0}</span>
                  </div>
                  <div className="mt-2 text-xs text-success">
                    💡 Puedes cambiar esta vinculación seleccionando otra opción arriba
                  </div>
                </div>
              )}

              {form.watch('spareAction') === 'link' && (
                <div className="mt-4 space-y-4">
                  <div className="p-3 bg-info-muted rounded border">
                    <p className="text-sm text-info-muted-foreground mb-3">
                      🔗 Selecciona un repuesto existente del pañol para vincular con este componente
                    </p>

                    {/* Búsqueda de repuestos */}
                    {availableSpares.length > 5 && (
                      <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar repuesto por nombre, marca, modelo..."
                          value={spareSearchQuery}
                          onChange={(e) => setSpareSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                        {spareSearchQuery && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            {filteredSpares.length} de {availableSpares.length}
                          </span>
                        )}
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="existingSpareId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Repuesto existente</FormLabel>
                          <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const currentElement = e.target as HTMLElement;
                                    const focusableElements = Array.from(document.querySelectorAll('input, button, select, textarea, [tabindex]:not([tabindex="-1"])'));
                                    const currentIndex = focusableElements.indexOf(currentElement);
                                    const nextElement = focusableElements[currentIndex + 1] as HTMLElement;
                                    if (nextElement) nextElement.focus();
                                  }
                                }}
                              >
                                <SelectValue placeholder={loadingSpares ? "Cargando repuestos..." : "Seleccionar repuesto"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {loadingSpares ? (
                                <SelectItem value="loading" disabled>Cargando repuestos...</SelectItem>
                              ) : availableSpares.length === 0 ? (
                                <SelectItem value="no-spares" disabled>No hay repuestos disponibles en el pañol</SelectItem>
                              ) : filteredSpares.length === 0 ? (
                                <SelectItem value="no-results" disabled>No se encontraron repuestos con "{spareSearchQuery}"</SelectItem>
                              ) : (
                                filteredSpares.map((spare) => (
                                  <SelectItem key={spare.id} value={spare.id.toString()}>
                                    <div className="flex flex-col items-start">
                                      <span className="font-medium">{spare.name}</span>
                                      <div className="flex gap-2 text-xs text-muted-foreground">
                                        <span>Stock: {spare.stockQuantity}</span>
                                        <span>•</span>
                                        <span>{spare.brand} {spare.model}</span>
                                        {spare.category && (
                                          <>
                                            <span>•</span>
                                            <Badge variant="secondary" className="text-xs">{spare.category}</Badge>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            El componente utilizará este repuesto del pañol cuando necesite mantenimiento
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {availableSpares.length === 0 && !loadingSpares && (
                      <div className="mt-3 p-3 bg-warning-muted border border-warning-muted rounded">
                        <p className="text-sm text-warning-muted-foreground">
                          No hay repuestos disponibles.
                          <button
                            type="button"
                            className="text-info hover:underline ml-1"
                            onClick={() => window.open('/panol', '_blank')}
                          >
                            Ir al pañol para crear repuestos
                          </button>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {form.watch('spareAction') === 'create' && (
                <div className="mt-4 space-y-4">
                  <div className="p-3 bg-success-muted rounded border">
                    <p className="text-sm text-success mb-3">
                      ➕ Se creará un nuevo repuesto específico para este componente
                    </p>
                  </div>



                  {/* Campos específicos del repuesto */}
                  <div className="space-y-4">
                    {/* 1. Nombre del repuesto */}
                    <FormField
                      control={form.control}
                      name="spareName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre del repuesto *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Ej: Filtro de aceite, Rodamiento 6205, etc."
                              autoComplete="off"
                              required={form.watch('spareAction') === 'create'}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const categorySelect = document.querySelector('select[name="spareCategory"]')?.closest('[role="combobox"]') as HTMLButtonElement;
                                  if (categorySelect) {
                                    categorySelect.focus();
                                  } else {
                                    const currentElement = e.target as HTMLElement;
                                    const focusableElements = Array.from(document.querySelectorAll('input, button, select, textarea, [tabindex]:not([tabindex="-1"])'));
                                    const currentIndex = focusableElements.indexOf(currentElement);
                                    const nextElement = focusableElements[currentIndex + 1] as HTMLElement;
                                    if (nextElement) nextElement.focus();
                                  }
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            Nombre específico del repuesto (no el nombre del componente)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* 2. Categoría del repuesto */}
                    <FormField
                      control={form.control}
                      name="spareCategory"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoría del repuesto</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const spareDescriptionField = document.querySelector('textarea[name="spareDescription"]') as HTMLTextAreaElement;
                                    if (spareDescriptionField) {
                                      spareDescriptionField.focus();
                                    } else {
                                      const currentElement = e.target as HTMLElement;
                                      const focusableElements = Array.from(document.querySelectorAll('input, button, select, textarea, [tabindex]:not([tabindex="-1"])'));
                                      const currentIndex = focusableElements.indexOf(currentElement);
                                      const nextElement = focusableElements[currentIndex + 1] as HTMLElement;
                                      if (nextElement) nextElement.focus();
                                    }
                                  }
                                }}
                              >
                                <SelectValue placeholder="Seleccionar categoría" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Repuestos">Repuestos</SelectItem>
                              <SelectItem value="Filtros">Filtros</SelectItem>
                              <SelectItem value="Motores">Motores</SelectItem>
                              <SelectItem value="Rodamientos">Rodamientos</SelectItem>
                              <SelectItem value="Correas">Correas</SelectItem>
                              <SelectItem value="Lubricantes">Lubricantes</SelectItem>
                              <SelectItem value="Eléctrico">Eléctrico</SelectItem>
                              <SelectItem value="Hidráulico">Hidráulico</SelectItem>
                              <SelectItem value="Otros">Otros</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* 3. Descripción técnica */}
                    <FormField
                      control={form.control}
                      name="spareDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descripción técnica del repuesto</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="Especificaciones técnicas, medidas, material, etc."
                              rows={3}
                              autoComplete="off"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Enfocar el siguiente campo (stock inicial)
                                  const nextInput = document.querySelector('input[name="initialStock"]') as HTMLInputElement;
                                  if (nextInput) {
                                    nextInput.focus();
                                  }
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            Información técnica específica del repuesto
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* 4. Imagen del repuesto */}
                    <FormField
                      control={form.control}
                      name="spareImage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Imagen del repuesto</FormLabel>
                          <FormControl>
                            <PhotoUpload
                              entityType="component"
                              entityId={initialValues?.id || 'temp'}
                              currentPhoto={field.value}
                              onPhotoUploaded={(url) => field.onChange(url)}
                              onPhotoRemoved={() => field.onChange('')}
                              title="Imagen del repuesto"
                              description="Sube una imagen específica del repuesto"
                              className="w-full"
                            />
                          </FormControl>
                          <FormDescription>
                            Imagen específica del repuesto para identificación
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* 5. Stock inicial */}
                    <FormField
                      control={form.control}
                      name="initialStock"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock inicial</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '') {
                                  field.onChange(0); // Valor por defecto cuando está vacío
                                } else {
                                  field.onChange(Number(value));
                                }
                              }}
                              onBlur={(e) => {
                                if (e.target.value === '') {
                                  field.onChange(0); // Asegurar valor por defecto al perder el foco
                                }
                              }}
                              placeholder="0"
                              autoComplete="off"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const nextInput = document.querySelector('input[name="spareMinStock"]') as HTMLInputElement;
                                  if (nextInput) {
                                    nextInput.focus();
                                  }
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            Cuántos repuestos tienes actualmente
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* 6. Stock mínimo */}
                    <FormField
                      control={form.control}
                      name="spareMinStock"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Stock mínimo</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '') {
                                  field.onChange(0); // Valor por defecto cuando está vacío
                                } else {
                                  field.onChange(Number(value));
                                }
                              }}
                              onBlur={(e) => {
                                if (e.target.value === '') {
                                  field.onChange(0); // Asegurar valor por defecto al perder el foco
                                }
                              }}
                              placeholder="0"
                              autoComplete="off"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Enviar el formulario al presionar Enter en el último campo
                                  form.handleSubmit(onSubmit)();
                                }
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            Alerta cuando quede menos stock
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
            </div>

            <input type="hidden" {...form.register('machineId')} />
          </form>
        </Form>
        </DialogBody>
        <DialogFooter className="p-3 md:p-4 flex-row gap-2">
          <Button type="button" variant="outline" size="sm" className="flex-1 md:flex-none h-9 text-xs md:text-sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" className="flex-1 md:flex-none h-9 text-xs md:text-sm" onClick={form.handleSubmit(onSubmit)}>
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                <span className="hidden sm:inline">Guardando...</span>
                <span className="sm:hidden">...</span>
              </>
            ) : (
              'Guardar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 