'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { MachineStatus, MachineType } from '@/lib/types';
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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Building2, Info, Settings, FileText, Shield, ChevronDown, ChevronUp, AlertTriangle, Copy, Check, MessageCircle } from 'lucide-react';
import { AliasInput } from '@/components/ui/AliasInput';
import { LogoUpload } from '@/components/ui/LogoUpload';
import { useState, useEffect, useCallback } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { useCompany } from '@/contexts/CompanyContext';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface PlantZoneOption {
  id: number;
  name: string;
  color?: string;
  depth?: number;
  breadcrumb?: string[];
}

interface MachineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (machine: any) => void;
  machine?: any;
  preselectedZoneId?: number; // Para preseleccionar una zona al crear
}

const machineSchema = z.object({
  id: z.number().optional().or(z.literal('')),
  name: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres' }),
  nickname: z.string().optional(),
  type: z.string(),
  brand: z.string().min(2, { message: 'La marca debe tener al menos 2 caracteres' }),
  model: z.string().optional().or(z.literal('')),
  serialNumber: z.string().optional().or(z.literal('')),
  status: z.string(),
  acquisitionDate: z.string(),
  companyId: z.string(),
  sectorId: z.string(),
  plantZoneId: z.string().optional().or(z.literal('')),
  logo: z.string().optional(),
  // Nuevos campos
  assetCode: z.string().optional().or(z.literal('')),
  sapCode: z.string().optional().or(z.literal('')),
  productionLine: z.string().optional().or(z.literal('')),
  installationDate: z.string().optional().or(z.literal('')),
  manufacturingYear: z.string().optional().or(z.literal('')),
  supplier: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  // Especificaciones técnicas
  voltage: z.string().optional().or(z.literal('')),
  power: z.string().optional().or(z.literal('')),
  weight: z.string().optional().or(z.literal('')),
  dimensions: z.string().optional().or(z.literal('')),
  // Garantía
  warrantyExpiration: z.string().optional().or(z.literal('')),
  warrantySupplier: z.string().optional().or(z.literal('')),
  warrantyCoverage: z.string().optional().or(z.literal('')),
}).refine((data) => {
  // Validar que la fecha de instalación no sea anterior a la fecha de adquisición
  if (data.installationDate && data.acquisitionDate) {
    const installation = new Date(data.installationDate);
    const acquisition = new Date(data.acquisitionDate);
    return installation >= acquisition;
  }
  return true;
}, {
  message: 'La fecha de instalación no puede ser anterior a la fecha de adquisición',
  path: ['installationDate'],
}).refine((data) => {
  // Validar que el año de fabricación no sea futuro
  if (data.manufacturingYear) {
    const year = parseInt(data.manufacturingYear);
    const currentYear = new Date().getFullYear();
    return year <= currentYear;
  }
  return true;
}, {
  message: 'El año de fabricación no puede ser futuro',
  path: ['manufacturingYear'],
}).refine((data) => {
  // Validar que la garantía no expire antes de la adquisición
  if (data.warrantyExpiration && data.acquisitionDate) {
    const warranty = new Date(data.warrantyExpiration);
    const acquisition = new Date(data.acquisitionDate);
    return warranty >= acquisition;
  }
  return true;
}, {
  message: 'El vencimiento de garantía no puede ser anterior a la fecha de adquisición',
  path: ['warrantyExpiration'],
});

type MachineFormValues = z.infer<typeof machineSchema>;

export default function MachineDialog({ isOpen, onClose, onSave, machine, preselectedZoneId }: MachineDialogProps) {
  const isEditing = !!machine;
  const [logoUrl, setLogoUrl] = useState(machine?.logo || '');
  const [aliases, setAliases] = useState<string[]>(
    Array.isArray(machine?.aliases) ? machine.aliases : []
  );
  const [availableZones, setAvailableZones] = useState<PlantZoneOption[]>([]);
  const [isLoadingZones, setIsLoadingZones] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const { currentCompany, currentSector } = useCompany();
  const { toast } = useToast();

  // Verificar duplicados al cambiar serial number o SAP code
  const checkDuplicates = useCallback(async (serialNumber?: string, sapCode?: string, currentId?: number) => {
    if (!serialNumber && !sapCode) {
      setDuplicateWarning(null);
      return;
    }

    if (!currentCompany?.id) return;

    setIsCheckingDuplicate(true);
    try {
      const params = new URLSearchParams({
        companyId: String(currentCompany.id),
        ...(serialNumber && { serialNumber }),
        ...(sapCode && { sapCode }),
        ...(currentId && { excludeId: String(currentId) }),
      });

      const response = await fetch(`/api/machines/check-duplicate?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (data.duplicate) {
          setDuplicateWarning(`Ya existe una máquina con ${data.field === 'serialNumber' ? 'este número de serie' : 'este código SAP'}: "${data.machineName}"`);
        } else {
          setDuplicateWarning(null);
        }
      }
    } catch (error) {
      // Silently fail - not critical
    } finally {
      setIsCheckingDuplicate(false);
    }
  }, [currentCompany?.id]);
  
  const handleLogoUploaded = (url: string) => {
    setLogoUrl(url);
  };
  
  const handleLogoRemoved = () => {
    setLogoUrl('');
  };

  // Resetear aliases cuando cambia la máquina
  useEffect(() => {
    setAliases(Array.isArray(machine?.aliases) ? machine.aliases : []);
  }, [machine]);

  // Cargar zonas disponibles cuando se abre el diálogo
  useEffect(() => {
    const loadZones = async () => {
      if (!isOpen || !currentCompany?.id || !currentSector?.id) return;

      setIsLoadingZones(true);
      try {
        const response = await fetch(
          `/api/plant-zones?companyId=${currentCompany.id}&sectorId=${currentSector.id}`
        );
        if (response.ok) {
          const zones = await response.json();
          // Aplanar la jerarquía para el selector
          const flatZones: PlantZoneOption[] = [];
          const flatten = (zone: any, depth = 0) => {
            flatZones.push({
              id: zone.id,
              name: zone.name,
              color: zone.color,
              depth,
              breadcrumb: zone.breadcrumb || [zone.name]
            });
            if (zone.children) {
              zone.children.forEach((child: any) => flatten(child, depth + 1));
            }
          };
          zones.forEach((zone: any) => flatten(zone));
          setAvailableZones(flatZones);
        }
      } catch (error) {
        console.error('Error cargando zonas:', error);
      } finally {
        setIsLoadingZones(false);
      }
    };

    loadZones();
  }, [isOpen, currentCompany?.id, currentSector?.id]);

  const [showTechnicalSpecs, setShowTechnicalSpecs] = useState(false);
  const [showWarranty, setShowWarranty] = useState(false);

  const form = useForm<MachineFormValues>({
    resolver: zodResolver(machineSchema),
    defaultValues: {
      id: machine?.id || '',
      name: machine?.name || '',
      nickname: machine?.nickname || '',
      type: machine?.type || MachineType.PRODUCTION,
      brand: machine?.brand || '',
      model: machine?.model || '',
      serialNumber: machine?.serialNumber || '',
      status: machine?.status || MachineStatus.ACTIVE,
      acquisitionDate: (() => {
        if (!machine?.acquisitionDate) return new Date().toISOString().slice(0, 10);
        if (typeof machine.acquisitionDate === 'string') return machine.acquisitionDate.slice(0, 10);
        if (machine.acquisitionDate instanceof Date) return machine.acquisitionDate.toISOString().slice(0, 10);
        return new Date(machine.acquisitionDate).toISOString().slice(0, 10);
      })(),
      companyId: machine?.companyId ? String(machine.companyId) : '1',
      sectorId: machine?.sectorId ? String(machine.sectorId) : '1',
      plantZoneId: machine?.plantZoneId ? String(machine.plantZoneId) : (preselectedZoneId ? String(preselectedZoneId) : ''),
      logo: machine?.logo || '',
      // Nuevos campos
      assetCode: machine?.assetCode || '',
      sapCode: machine?.sapCode || '',
      productionLine: machine?.productionLine || '',
      installationDate: machine?.installationDate ? (typeof machine.installationDate === 'string' ? machine.installationDate.slice(0, 10) : new Date(machine.installationDate).toISOString().slice(0, 10)) : '',
      manufacturingYear: machine?.manufacturingYear ? String(machine.manufacturingYear) : '',
      supplier: machine?.supplier || '',
      description: machine?.description || '',
      // Especificaciones técnicas
      voltage: machine?.voltage || '',
      power: machine?.power || '',
      weight: machine?.weight || '',
      dimensions: machine?.dimensions || '',
      // Garantía
      warrantyExpiration: machine?.warrantyExpiration ? (typeof machine.warrantyExpiration === 'string' ? machine.warrantyExpiration.slice(0, 10) : new Date(machine.warrantyExpiration).toISOString().slice(0, 10)) : '',
      warrantySupplier: machine?.warrantySupplier || '',
      warrantyCoverage: machine?.warrantyCoverage || '',
    },
  });
  
  const onSubmit = (data: MachineFormValues) => {
    // Normalizar los datos antes de enviar
    const normalized = {
      ...data,
      companyId: Number(data.companyId),
      sectorId: Number(data.sectorId),
      plantZoneId: data.plantZoneId ? Number(data.plantZoneId) : null,
      acquisitionDate: data.acquisitionDate ? data.acquisitionDate.slice(0, 10) : '',
      serialNumber: data.serialNumber || '',
      logo: logoUrl,
      // Nuevos campos
      assetCode: data.assetCode || null,
      sapCode: data.sapCode || null,
      productionLine: data.productionLine || null,
      installationDate: data.installationDate ? data.installationDate.slice(0, 10) : null,
      manufacturingYear: data.manufacturingYear ? Number(data.manufacturingYear) : null,
      supplier: data.supplier || null,
      description: data.description || null,
      // Especificaciones técnicas
      voltage: data.voltage || null,
      power: data.power || null,
      weight: data.weight || null,
      dimensions: data.dimensions || null,
      // Garantía
      warrantyExpiration: data.warrantyExpiration ? data.warrantyExpiration.slice(0, 10) : null,
      warrantySupplier: data.warrantySupplier || null,
      warrantyCoverage: data.warrantyCoverage || null,
      // Aliases para Discord/voz
      aliases: aliases.length > 0 ? aliases : null,
    };
    onSave(normalized);
    form.reset();
  };

  const handleSubmit = form.handleSubmit(onSubmit);
  
  // Log del estado del formulario - removido para evitar spam
  // console.log('MachineDialog - estado del formulario:', {
  //   isSubmitting: form.formState.isSubmitting,
  //   isValid: form.formState.isValid,
  //   errors: form.formState.errors,
  //   values: form.getValues()
  // });
  
  // Log detallado de errores - removido para evitar spam
  // if (Object.keys(form.formState.errors).length > 0) {
  //   console.log('MachineDialog - errores detallados:', JSON.stringify(form.formState.errors, null, 2));
  // }
  
  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar máquina' : 'Agregar nueva máquina'}</DialogTitle>
          <DialogDescription>
            Complete los datos de la máquina y haga clic en guardar cuando termine.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <DialogBody>
            <input type="hidden" {...form.register('id')} />

            {/* Alerta de duplicados */}
            {duplicateWarning && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{duplicateWarning}</AlertDescription>
              </Alert>
            )}

            {/* Logo Upload */}
            <LogoUpload
              entityType="machine"
              entityId={machine?.id || 'temp'}
              currentLogo={logoUrl}
              onLogoUploaded={handleLogoUploaded}
              onLogoRemoved={handleLogoRemoved}
              title="Logo de la Máquina"
              description="Sube un logo específico para esta máquina"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Ej: Torno CNC"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            const nicknameInput = document.querySelector('input[name="nickname"]') as HTMLInputElement;
                            if (nicknameInput) {
                              nicknameInput.focus();
                            }
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="nickname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apodo</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ej: Torno 1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            // Usar setTimeout para asegurar que el DOM esté listo
                            setTimeout(() => {
                              // Buscar todos los selects y enfocar el primero (tipo)
                              const selects = document.querySelectorAll('[role="combobox"]');
                              if (selects.length > 0) {
                                const firstSelect = selects[0] as HTMLButtonElement;
                                firstSelect.focus();
                                firstSelect.click();
                              }
                            }, 10);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Aliases para reconocimiento por voz */}
              <FormItem className="md:col-span-2">
                <FormLabel className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Aliases (para Discord/voz)
                </FormLabel>
                <AliasInput
                  value={aliases}
                  onChange={setAliases}
                  placeholder="Ej: caldera, la caldera, caldera de vapor..."
                  maxAliases={10}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Nombres alternativos para identificar esta máquina por voz o texto
                </p>
              </FormItem>

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                              // Buscar específicamente el select de estado
                              const statusSelect = document.querySelector('select[name="status"]')?.closest('[role="combobox"]') as HTMLButtonElement;
                              if (statusSelect) {
                                statusSelect.focus();
                              } else {
                                // Fallback: buscar el siguiente elemento focusable
                                const currentElement = e.target as HTMLElement;
                                const focusableElements = Array.from(document.querySelectorAll('input, button, select, textarea, [tabindex]:not([tabindex="-1"])'));
                                const currentIndex = focusableElements.indexOf(currentElement);
                                const nextElement = focusableElements[currentIndex + 1] as HTMLElement;
                                
                                if (nextElement) {
                                  nextElement.focus();
                                }
                              }
                            }
                          }}
                        >
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={MachineType.PRODUCTION}>Producción</SelectItem>
                        <SelectItem value={MachineType.MAINTENANCE}>Mantenimiento</SelectItem>
                        <SelectItem value={MachineType.UTILITY}>Utilidad</SelectItem>
                        <SelectItem value={MachineType.PACKAGING}>Empaque</SelectItem>
                        <SelectItem value={MachineType.TRANSPORTATION}>Transporte</SelectItem>
                        <SelectItem value={MachineType.OTHER}>Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                              // Buscar específicamente el campo de marca
                              const brandField = document.querySelector('input[name="brand"]') as HTMLInputElement;
                              if (brandField) {
                                brandField.focus();
                              } else {
                                // Fallback: buscar el siguiente elemento focusable
                                const currentElement = e.target as HTMLElement;
                                const focusableElements = Array.from(document.querySelectorAll('input, button, select, textarea, [tabindex]:not([tabindex="-1"])'));
                                const currentIndex = focusableElements.indexOf(currentElement);
                                const nextElement = focusableElements[currentIndex + 1] as HTMLElement;
                                
                                if (nextElement) {
                                  nextElement.focus();
                                }
                              }
                            }
                          }}
                        >
                          <SelectValue placeholder="Seleccionar estado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={MachineStatus.ACTIVE}>Activo</SelectItem>
                        <SelectItem value={MachineStatus.OUT_OF_SERVICE}>Fuera de servicio</SelectItem>
                        <SelectItem value={MachineStatus.DECOMMISSIONED}>Baja</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Ej: Haas"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            const modelInput = document.querySelector('input[name="model"]') as HTMLInputElement;
                            if (modelInput) {
                              modelInput.focus();
                            }
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Ej: VF-2 (opcional)"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            const serialInput = document.querySelector('input[name="serialNumber"]') as HTMLInputElement;
                            if (serialInput) {
                              serialInput.focus();
                            }
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de serie</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ej: 123456789 (opcional)"
                        onBlur={(e) => {
                          field.onBlur();
                          if (e.target.value) {
                            checkDuplicates(e.target.value, form.getValues('sapCode'), machine?.id);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            form.handleSubmit(onSubmit)();
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="acquisitionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de alta *</FormLabel>
                    <FormControl>
                      <DatePicker
                        value={field.value ? field.value.slice(0, 10) : ''}
                        onChange={(date) => field.onChange(date)}
                        placeholder="Seleccionar fecha..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Selector de zona de planta */}
              <FormField
                control={form.control}
                name="plantZoneId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Zona de planta
                    </FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                      value={field.value || 'none'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingZones ? "Cargando zonas..." : "Sin zona asignada"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sin zona asignada</SelectItem>
                        {availableZones.map((zone) => (
                          <SelectItem key={zone.id} value={String(zone.id)}>
                            <div className="flex items-center gap-2">
                              {zone.color && (
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: zone.color }}
                                />
                              )}
                              <span style={{ paddingLeft: `${(zone.depth || 0) * 12}px` }}>
                                {zone.breadcrumb ? zone.breadcrumb.join(' › ') : zone.name}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Códigos e Identificación */}
              <FormField
                control={form.control}
                name="assetCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código de activo</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ej: ACT-001" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sapCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código SAP/ERP</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ej: 10001234"
                        onBlur={(e) => {
                          field.onBlur();
                          if (e.target.value) {
                            checkDuplicates(form.getValues('serialNumber'), e.target.value, machine?.id);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="productionLine"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Línea de producción</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ej: Línea 1" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proveedor/Fabricante</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ej: Siemens Argentina" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="manufacturingYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Año de fabricación</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="1900" max="2100" placeholder="Ej: 2020" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="installationDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de instalación</FormLabel>
                    <FormControl>
                      <DatePicker
                        value={field.value ? field.value.slice(0, 10) : ''}
                        onChange={(date) => field.onChange(date)}
                        placeholder="Seleccionar fecha..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Descripción */}
            <div className="mt-4">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción / Notas</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Información adicional sobre la máquina..."
                        className="min-h-[80px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Especificaciones Técnicas - Colapsable */}
            <Collapsible open={showTechnicalSpecs} onOpenChange={setShowTechnicalSpecs} className="mt-4">
              <CollapsibleTrigger asChild>
                <Button variant="outline" type="button" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Especificaciones Técnicas
                  </span>
                  {showTechnicalSpecs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                  <FormField
                    control={form.control}
                    name="voltage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Voltaje</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej: 380V / 220V" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="power"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Potencia</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej: 15 kW / 20 HP" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Peso</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej: 2500 kg" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dimensions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dimensiones</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej: 2m x 1.5m x 1.8m" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Garantía - Colapsable */}
            <Collapsible open={showWarranty} onOpenChange={setShowWarranty} className="mt-4">
              <CollapsibleTrigger asChild>
                <Button variant="outline" type="button" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Información de Garantía
                  </span>
                  {showWarranty ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/30">
                  <FormField
                    control={form.control}
                    name="warrantySupplier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proveedor de garantía</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej: Siemens" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="warrantyExpiration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vencimiento de garantía</FormLabel>
                        <FormControl>
                          <DatePicker
                            value={field.value ? field.value.slice(0, 10) : ''}
                            onChange={(date) => field.onChange(date)}
                            placeholder="Seleccionar fecha..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="warrantyCoverage"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Tipo de cobertura</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej: Completa / Solo partes / Mano de obra incluida" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="hidden">
              {/* Campos ocultos para empresa y sector - no se muestran en la UI */}
              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input {...field} type="hidden" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sectorId"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input {...field} type="hidden" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" size="sm">
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar máquina'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}