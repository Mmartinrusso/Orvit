'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SimpleSelect, SimpleSelectItem } from '@/components/ui/simple-select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SimpleCheckbox } from '@/components/ui/simple-checkbox';
import { toast } from 'sonner';
import { useCompany } from '@/contexts/CompanyContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import {
  Loader2,
  DollarSign,
  Search,
  Building2,
  FileText,
  Calendar,
  AlertCircle,
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const solicitudSchema = z.object({
  proveedorId: z.string().min(1, 'Selecciona un proveedor'),
  prioridad: z.enum(['baja', 'media', 'alta', 'urgente'], {
    required_error: 'Selecciona una prioridad'
  }),
  diasBajaAMedia: z.any().optional(),
  diasMediaAAlta: z.any().optional(),
  diasAltaAUrgente: z.any().optional(),
  facturasSeleccionadas: z.array(z.string()).min(1, 'Selecciona al menos una factura'),
  observaciones: z.string().optional()
}).transform((data) => {
  // Limpiar campos NaN o no aplicables según la prioridad
  const cleaned: any = { ...data };
  
  // Limpiar NaN o valores inválidos
  const cleanNumber = (val: any): number | undefined => {
    if (val === undefined || val === null || val === '' || isNaN(Number(val))) {
      return undefined;
    }
    const num = Number(val);
    return num >= 0 ? num : undefined;
  };
  
  // Si la prioridad no es 'baja', eliminar diasBajaAMedia
  if (cleaned.prioridad !== 'baja') {
    cleaned.diasBajaAMedia = undefined;
  } else {
    cleaned.diasBajaAMedia = cleanNumber(cleaned.diasBajaAMedia);
  }
  
  // Si la prioridad no es 'baja' o 'media', eliminar diasMediaAAlta
  if (!['baja', 'media'].includes(cleaned.prioridad)) {
    cleaned.diasMediaAAlta = undefined;
  } else {
    cleaned.diasMediaAAlta = cleanNumber(cleaned.diasMediaAAlta);
  }
  
  // Si la prioridad no es 'baja', 'media' o 'alta', eliminar diasAltaAUrgente
  if (!['baja', 'media', 'alta'].includes(cleaned.prioridad)) {
    cleaned.diasAltaAUrgente = undefined;
  } else {
    cleaned.diasAltaAUrgente = cleanNumber(cleaned.diasAltaAUrgente);
  }
  
  return cleaned;
});

type SolicitudFormData = z.infer<typeof solicitudSchema>;

interface Proveedor {
  id: number;
  name: string;
  razon_social?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
}

interface Factura {
  id: number;
  numeroSerie: string;
  numeroFactura: string;
  tipo: string;
  fechaEmision: string;
  fechaVencimiento: string | null;
  total: number;
  estado: string;
  diasVencimiento?: number;
  docType?: string;  // T1 o T2
}

interface SolicitudPagoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSolicitudCreated?: () => void;
}

export function SolicitudPagoModal({
  open,
  onOpenChange,
  onSolicitudCreated
}: SolicitudPagoModalProps) {
  const { currentCompany } = useCompany();
  const { mode: viewMode } = useViewMode();
  const [isLoading, setIsLoading] = useState(false);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [proveedorSearch, setProveedorSearch] = useState('');
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loadingFacturas, setLoadingFacturas] = useState(false);
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);
  const proveedoresCacheRef = useRef<{ data: Proveedor[]; companyId: string; timestamp: number } | null>(null);
  const facturasCacheRef = useRef<Map<string, { data: Factura[]; timestamp: number }>>(new Map());
  const preloadDoneRef = useRef(false);
  const isMountedRef = useRef(false);
  
  // Handler estable para onOpenChange
  const handleOpenChange = useCallback((newOpen: boolean) => {
    onOpenChange(newOpen);
  }, [onOpenChange]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors }
  } = useForm<SolicitudFormData>({
    resolver: zodResolver(solicitudSchema),
    defaultValues: {
      proveedorId: '',
      prioridad: 'baja',
      diasBajaAMedia: undefined,
      diasMediaAAlta: undefined,
      diasAltaAUrgente: undefined,
      facturasSeleccionadas: [],
      observaciones: ''
    }
  });

  const selectedFacturasIds = watch('facturasSeleccionadas') || [];
  const prioridad = watch('prioridad');
  const diasBajaAMedia = watch('diasBajaAMedia');
  const diasMediaAAlta = watch('diasMediaAAlta');
  const diasAltaAUrgente = watch('diasAltaAUrgente');
  const proveedorIdValue = watch('proveedorId');

  const loadProveedores = useCallback(async (silent = false) => {
    if (!currentCompany?.id) {
      if (!silent) setLoadingProveedores(false);
      return;
    }

    const companyId = currentCompany.id.toString();
    if (!silent) setLoadingProveedores(true);
    const startTime = performance.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 segundos timeout

      // Usar fetch con prioridad alta
      const response = await fetch(`/api/insumos/proveedores?companyId=${companyId}`, {
        signal: controller.signal,
        cache: 'force-cache',
        priority: 'high' as any // Prioridad alta
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Error al cargar proveedores');
      }
      const data = await response.json();
      const suppliers = Array.isArray(data) ? data : (data.suppliers || []);
      
      // Guardar en caché
      proveedoresCacheRef.current = {
        data: suppliers,
        companyId,
        timestamp: Date.now()
      };
      
      setProveedores(suppliers);
      
      const loadTime = performance.now() - startTime;
      if (loadTime > 1000 && !silent) {
        console.warn(`⚠️ Proveedores tardaron ${loadTime.toFixed(0)}ms en cargar`);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Timeout: usar cache si existe
        if (proveedoresCacheRef.current && proveedoresCacheRef.current.companyId === companyId) {
          setProveedores(proveedoresCacheRef.current.data);
          if (!silent) setLoadingProveedores(false);
          return;
        }
      }
      // Si hay error pero hay caché, usar el caché
      if (proveedoresCacheRef.current && proveedoresCacheRef.current.companyId === companyId) {
        setProveedores(proveedoresCacheRef.current.data);
      }
    } finally {
      if (!silent) setLoadingProveedores(false);
    }
  }, [currentCompany?.id]);

  const loadFacturasSinPagar = useCallback(async (proveedorId: string) => {
    if (!currentCompany?.id) {
      return;
    }

    const companyId = currentCompany.id.toString();
    setLoadingFacturas(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos timeout

      const response = await fetch(
        `/api/compras/facturas-sin-pagar?proveedorId=${proveedorId}&companyId=${companyId}`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al cargar facturas');
      }
      const data = await response.json();
      setFacturas(data.facturas || []);
      
      // Guardar el proveedor seleccionado (buscar en caché directamente para evitar dependencia)
      const allProveedores = proveedoresCacheRef.current?.data || [];
      const proveedor = allProveedores.find(p => p.id.toString() === proveedorId) || null;
      setSelectedProveedor(proveedor);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast.error('Tiempo de espera agotado al cargar facturas');
      } else {
        console.error('Error cargando facturas:', error);
        toast.error(error.message || 'Error al cargar facturas sin pagar');
      }
      setFacturas([]);
    } finally {
      setLoadingFacturas(false);
    }
  }, [currentCompany?.id]);

  // Cargar proveedores cuando se abre el modal (solo una vez)
  useEffect(() => {
    if (!open || !currentCompany?.id) return;
    if (isMountedRef.current) return;
    
    isMountedRef.current = true;
    const companyId = currentCompany.id.toString();
    const CACHE_TTL = 5 * 60 * 1000;
    const cache = proveedoresCacheRef.current;
    
    if (cache && cache.companyId === companyId && Date.now() - cache.timestamp < CACHE_TTL && cache.data.length > 0) {
      setProveedores(cache.data);
      return;
    }
    
    loadProveedores(false);
  }, [open, currentCompany?.id, loadProveedores]);

  // Limpiar caché de facturas cuando cambia el ViewMode
  // Esto asegura que al activar/desactivar juego de tecla se recarguen las facturas
  useEffect(() => {
    // Limpiar todo el caché de facturas cuando cambia el modo
    facturasCacheRef.current.clear();

    // Si hay un proveedor seleccionado y el modal está abierto, recargar facturas
    if (open && proveedorIdValue && currentCompany?.id) {
      setFacturas([]); // Limpiar facturas actuales para forzar recarga
    }
  }, [viewMode, open, proveedorIdValue, currentCompany?.id]);

  // Cargar facturas cuando se selecciona un proveedor (con debounce y caché)
  // Incluye viewMode en el cache key para separar datos por modo
  useEffect(() => {
    if (!open || !proveedorIdValue || !currentCompany?.id) {
      if (!open || !proveedorIdValue) {
        setFacturas([]);
        setSelectedProveedor(null);
      }
      return;
    }

    // Verificar caché primero - incluye viewMode en la key
    const cacheKey = `${proveedorIdValue}-${currentCompany.id}-${viewMode}`;
    const cached = facturasCacheRef.current.get(cacheKey);
    const CACHE_TTL = 2 * 60 * 1000; // 2 minutos en cliente

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setFacturas(cached.data);
      const allProveedores = proveedoresCacheRef.current?.data || [];
      const proveedor = allProveedores.find(p => p.id.toString() === proveedorIdValue);
      setSelectedProveedor(proveedor || null);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      const companyId = currentCompany.id.toString();
      setLoadingFacturas(true);

      // No usar cache del navegador para que el middleware inyecte el header X-VM correcto
      fetch(`/api/compras/facturas-sin-pagar?proveedorId=${proveedorIdValue}&companyId=${companyId}&_vm=${viewMode}`, {
        cache: 'no-store'
      })
        .then(res => {
          if (cancelled) return;
          if (!res.ok) throw new Error('Error al cargar facturas');
          return res.json();
        })
        .then(data => {
          if (cancelled) return;
          const facturasData = data.facturas || [];
          setFacturas(facturasData);

          // Guardar en caché del cliente (con viewMode en la key)
          facturasCacheRef.current.set(cacheKey, {
            data: facturasData,
            timestamp: Date.now()
          });

          // Limpiar caché antiguo (más de 5 minutos)
          if (facturasCacheRef.current.size > 50) {
            const now = Date.now();
            for (const [key, entry] of facturasCacheRef.current.entries()) {
              if (now - entry.timestamp > 5 * 60 * 1000) {
                facturasCacheRef.current.delete(key);
              }
            }
          }

          // Buscar proveedor solo desde el cache para evitar dependencias
          const allProveedores = proveedoresCacheRef.current?.data || [];
          const proveedor = allProveedores.find(p => p.id.toString() === proveedorIdValue);
          setSelectedProveedor(proveedor || null);
        })
        .catch(error => {
          if (cancelled) return;
          console.error('Error cargando facturas:', error);
          toast.error('Error al cargar facturas sin pagar');
          setFacturas([]);
        })
        .finally(() => {
          if (!cancelled) {
            setLoadingFacturas(false);
          }
        });
    }, 150); // Reducido de 300ms a 150ms

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proveedorIdValue, open, currentCompany?.id, viewMode]);

  const proveedoresFiltrados = useMemo(() => {
    const proveedoresList = proveedores.length > 0 ? proveedores : (proveedoresCacheRef.current?.data || []);
    if (!proveedorSearch.trim()) return proveedoresList;
    
    const search = proveedorSearch.toLowerCase().trim();
    return proveedoresList.filter(p => 
      p.id.toString().includes(search) ||
      p.name.toLowerCase().includes(search) ||
      p.razon_social?.toLowerCase().includes(search) ||
      p.contactPerson?.toLowerCase().includes(search)
    );
  }, [proveedores, proveedorSearch]);

  const handleToggleFactura = useCallback((facturaId: number) => {
    const facturaIdStr = facturaId.toString();
    const current = getValues('facturasSeleccionadas') || [];
    const newSelection = current.includes(facturaIdStr)
      ? current.filter(id => id !== facturaIdStr)
      : [...current, facturaIdStr];
    setValue('facturasSeleccionadas', newSelection, { shouldValidate: true, shouldDirty: true });
  }, [getValues, setValue]);

  const handleSelectAll = useCallback(() => {
    if (facturas.length === 0) return;
    const current = getValues('facturasSeleccionadas') || [];
    const newSelection = current.length === facturas.length 
      ? [] 
      : facturas.map(f => f.id.toString());
    setValue('facturasSeleccionadas', newSelection, { shouldValidate: true, shouldDirty: true });
  }, [facturas, getValues, setValue]);

  const totalSeleccionado = useMemo(() => {
    return facturas
      .filter(f => selectedFacturasIds.includes(f.id.toString()))
      .reduce((sum, f) => sum + parseFloat(f.total.toString()), 0);
  }, [facturas, selectedFacturasIds]);

  const onSubmit = async (data: SolicitudFormData) => {
    console.log('🔵 onSubmit llamado con data:', data);
    
    if (!currentCompany?.id) {
      toast.error('No hay empresa seleccionada');
      console.error('❌ No hay empresa seleccionada');
      return;
    }

    if (!data.facturasSeleccionadas || data.facturasSeleccionadas.length === 0) {
      toast.error('Debes seleccionar al menos una factura');
      console.error('❌ No hay facturas seleccionadas');
      return;
    }

    if (!data.proveedorId) {
      toast.error('Debes seleccionar un proveedor');
      console.error('❌ No hay proveedor seleccionado');
      return;
    }

    setIsLoading(true);
    try {
      const facturasSeleccionadas = facturas.filter(f => 
        data.facturasSeleccionadas.includes(f.id.toString())
      );

      console.log('📋 Facturas seleccionadas:', facturasSeleccionadas);
      console.log('💾 Total seleccionado:', totalSeleccionado);

      if (facturasSeleccionadas.length === 0) {
        toast.error('No se encontraron las facturas seleccionadas');
        setIsLoading(false);
        return;
      }

      // Preparar body sin campos undefined
      const requestBody: any = {
        companyId: currentCompany.id,
        proveedorId: parseInt(data.proveedorId),
        prioridad: data.prioridad,
        facturas: facturasSeleccionadas.map(f => ({
          id: f.id,
          numeroSerie: f.numeroSerie,
          numeroFactura: f.numeroFactura,
          total: parseFloat(String(f.total)) || 0
        })),
        total: totalSeleccionado || 0
      };

      // Agregar campos opcionales solo si tienen valor
      if (data.diasBajaAMedia !== undefined && data.diasBajaAMedia !== null) {
        requestBody.diasBajaAMedia = data.diasBajaAMedia;
      }
      if (data.diasMediaAAlta !== undefined && data.diasMediaAAlta !== null) {
        requestBody.diasMediaAAlta = data.diasMediaAAlta;
      }
      if (data.diasAltaAUrgente !== undefined && data.diasAltaAUrgente !== null) {
        requestBody.diasAltaAUrgente = data.diasAltaAUrgente;
      }
      if (data.observaciones && data.observaciones.trim()) {
        requestBody.observaciones = data.observaciones.trim();
      }

      console.log('📤 Enviando request body:', requestBody);

      const response = await fetch('/api/compras/solicitudes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.message || `Error ${response.status}: ${response.statusText}`;
        console.error('Error al crear solicitud:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Respuesta exitosa:', result);
      
      toast.success(result.message || 'Solicitud de pago creada exitosamente');
      
      // Limpiar formulario
      reset();
      setProveedorSearch('');
      setFacturas([]);
      setSelectedProveedor(null);
      
      // Invalidar caché de proveedores y facturas
      proveedoresCacheRef.current = null;
      facturasCacheRef.current.clear();
      isMountedRef.current = false;
      
      // Cerrar modal y recargar lista
      handleOpenChange(false);
      if (onSolicitudCreated) {
        onSolicitudCreated();
      }
    } catch (error) {
      console.error('Error al crear solicitud:', error);
      toast.error(error instanceof Error ? error.message : 'Error al crear solicitud');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(numAmount);
  };

  const getDiasVencimientoColor = (dias?: number) => {
    if (!dias) return '';
    if (dias < 0) return 'text-red-600 font-semibold';
    if (dias <= 7) return 'text-orange-600';
    return 'text-muted-foreground';
  };

  // No renderizar nada si no está abierto (aunque el componente solo se monta cuando está abierto)
  if (!open) {
    return null;
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleOpenChange(false);
        }
      }}
    >
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/80 animate-in fade-in-0" />
      
      {/* Modal Content */}
      <div
        className={cn(
          "relative z-[151] w-[90vw] max-w-4xl max-h-[90vh]",
          "bg-background border rounded-lg shadow-lg",
          "flex flex-col animate-in fade-in-0 zoom-in-95 duration-200"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <DollarSign className="h-5 w-5" />
              Nueva Solicitud de Pago
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Selecciona un proveedor y las facturas que deseas incluir en la solicitud de pago
            </p>
          </div>
          <button
            onClick={() => handleOpenChange(false)}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

        <form 
          onSubmit={handleSubmit(
            (data) => {
              console.log('✅ Validación exitosa, llamando onSubmit');
              onSubmit(data);
            },
            (errors) => {
              console.error('❌ Errores de validación:', errors);
              toast.error('Por favor corrige los errores del formulario');
            }
          )} 
          className="space-y-6"
        >
          {/* Selección de Proveedor */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Proveedor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="proveedorSearch">Buscar por ID o Razón Social</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por ID, nombre o razón social... (Enter para ID)"
                    value={proveedorSearch}
                    onChange={(e) => setProveedorSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const searchValue = proveedorSearch.trim();
                        
                        // Si es un número, buscar por ID
                        if (/^\d+$/.test(searchValue)) {
                          const proveedorId = parseInt(searchValue);
                          const proveedor = proveedores.find(p => p.id === proveedorId) ||
                                           proveedoresCacheRef.current?.data.find(p => p.id === proveedorId);
                          
                          if (proveedor) {
                            setValue('proveedorId', proveedor.id.toString());
                            setValue('facturasSeleccionadas', []);
                            setProveedorSearch(proveedor.name);
                          } else {
                            toast.error(`No se encontró un proveedor con ID ${searchValue}`);
                          }
                        }
                      }
                    }}
                    className="pl-9 mb-2"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Escribe un ID y presiona Enter para seleccionarlo automáticamente
                </p>
              </div>

              <div>
                <Label htmlFor="proveedorId">Proveedor *</Label>
                <SimpleSelect 
                  value={watch('proveedorId')} 
                  onValueChange={(value) => {
                    setValue('proveedorId', value);
                    setValue('facturasSeleccionadas', []);
                    // Actualizar búsqueda con el nombre del proveedor seleccionado
                    const selected = proveedores.find(p => p.id.toString() === value) ||
                                   proveedoresCacheRef.current?.data.find(p => p.id.toString() === value);
                    if (selected) {
                      setProveedorSearch(selected.name);
                    }
                  }}
                  placeholder={loadingProveedores ? "Cargando..." : "Selecciona un proveedor"}
                  className="max-h-[300px]"
                >
                  {proveedorSearch.trim() ? (
                    proveedoresFiltrados.length > 0 ? (
                      proveedoresFiltrados.map((proveedor) => (
                        <SimpleSelectItem key={proveedor.id} value={proveedor.id.toString()}>
                          <div className="flex flex-col">
                            <span className="font-medium">{proveedor.name}</span>
                            {proveedor.razon_social && proveedor.razon_social !== proveedor.name && (
                              <span className="text-xs text-muted-foreground">{proveedor.razon_social}</span>
                            )}
                            <span className="text-xs text-muted-foreground">ID: {proveedor.id}</span>
                          </div>
                        </SimpleSelectItem>
                      ))
                    ) : (
                      <SimpleSelectItem value="" disabled>
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          No se encontraron proveedores
                        </div>
                      </SimpleSelectItem>
                    )
                  ) : (
                    proveedores.slice(0, 50).map((proveedor) => (
                      <SimpleSelectItem key={proveedor.id} value={proveedor.id.toString()}>
                        <div className="flex flex-col">
                          <span className="font-medium">{proveedor.name}</span>
                          {proveedor.razon_social && proveedor.razon_social !== proveedor.name && (
                            <span className="text-xs text-muted-foreground">{proveedor.razon_social}</span>
                          )}
                          <span className="text-xs text-muted-foreground">ID: {proveedor.id}</span>
                        </div>
                      </SimpleSelectItem>
                    ))
                  )}
                </SimpleSelect>
                {errors.proveedorId && (
                  <p className="text-sm text-red-500 mt-1">{errors.proveedorId.message}</p>
                )}
              </div>

              {selectedProveedor && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">{selectedProveedor.name}</p>
                  {selectedProveedor.razon_social && (
                    <p className="text-xs text-muted-foreground">{selectedProveedor.razon_social}</p>
                  )}
                  {selectedProveedor.contactPerson && (
                    <p className="text-xs text-muted-foreground">Contacto: {selectedProveedor.contactPerson}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Facturas Sin Pagar */}
          {watch('proveedorId') && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Facturas Sin Pagar
                  </CardTitle>
                  {facturas.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                    >
                      {selectedFacturasIds.length === facturas.length ? 'Deseleccionar Todas' : 'Seleccionar Todas'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingFacturas ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Cargando facturas...</span>
                  </div>
                ) : facturas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No hay facturas sin pagar para este proveedor</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {facturas.map((factura) => {
                      const isSelected = selectedFacturasIds.includes(factura.id.toString());
                      const isT2 = factura.docType === 'T2';
                      return (
                        <div
                          key={factura.id}
                          className={cn(
                            "flex items-center gap-4 p-3 border rounded-lg cursor-pointer hover:bg-muted",
                            isSelected && "bg-muted border-primary",
                            isT2 && viewMode === 'E' && "border-amber-400/50"
                          )}
                          onClick={() => handleToggleFactura(factura.id)}
                        >
                          <SimpleCheckbox
                            checked={isSelected}
                            readOnly
                          />
                          <div className="flex-1 grid grid-cols-5 gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className={cn(
                                  "font-medium text-sm",
                                  isT2 && viewMode === 'E' && "text-amber-600 dark:text-amber-400"
                                )}>
                                  {factura.tipo} {factura.numeroSerie}-{factura.numeroFactura}
                                </p>
                                {isT2 && viewMode === 'E' && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300">
                                    T2
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Emisión: {format(new Date(factura.fechaEmision), 'dd/MM/yyyy', { locale: es })}
                              </p>
                            </div>
                            <div>
                              {factura.fechaVencimiento && (
                                <>
                                  <p className="text-xs text-muted-foreground">Vencimiento:</p>
                                  <p className={`text-sm ${getDiasVencimientoColor(factura.diasVencimiento)}`}>
                                    {format(new Date(factura.fechaVencimiento), 'dd/MM/yyyy', { locale: es })}
                                  </p>
                                  {factura.diasVencimiento !== undefined && (
                                    <p className={`text-xs ${getDiasVencimientoColor(factura.diasVencimiento)}`}>
                                      {factura.diasVencimiento < 0 
                                        ? `Vencida hace ${Math.abs(factura.diasVencimiento)} días`
                                        : factura.diasVencimiento === 0
                                        ? 'Vence hoy'
                                        : `Vence en ${factura.diasVencimiento} días`
                                      }
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{formatCurrency(factura.total)}</p>
                              <p className="text-xs text-muted-foreground capitalize">{factura.estado}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {errors.facturasSeleccionadas && (
                  <p className="text-sm text-red-500 mt-2">{errors.facturasSeleccionadas.message}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Configuración de Urgencia */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Configuración de Prioridad y Auto-elevación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="prioridad">Prioridad Inicial *</Label>
                <SimpleSelect 
                  value={prioridad} 
                  onValueChange={(value) => setValue('prioridad', value as any)}
                  placeholder="Selecciona prioridad inicial"
                >
                  <SimpleSelectItem value="baja">Baja</SimpleSelectItem>
                  <SimpleSelectItem value="media">Media</SimpleSelectItem>
                  <SimpleSelectItem value="alta">Alta</SimpleSelectItem>
                  <SimpleSelectItem value="urgente">Urgente</SimpleSelectItem>
                </SimpleSelect>
                {errors.prioridad && (
                  <p className="text-sm text-red-500 mt-1">{errors.prioridad.message}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  La prioridad se elevará progresivamente según los días configurados (todos se cuentan desde la fecha de creación)
                </p>
              </div>

              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  Configuración de Auto-elevación Progresiva
                </div>

                {prioridad === 'baja' && (
                  <>
                    <div>
                      <Label htmlFor="diasBajaAMedia">
                        Días para elevar de Baja → Media
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="ej. 3 días"
                        {...register('diasBajaAMedia', { valueAsNumber: true })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Después de estos días sin aprobar, se elevará a "Media"
                      </p>
                    </div>
                    {diasBajaAMedia && (
                      <div>
                        <Label htmlFor="diasMediaAAlta">
                          Días para elevar a Alta (desde la creación)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="ej. 5 días"
                          {...register('diasMediaAAlta', { valueAsNumber: true })}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Después de estos días desde la creación: Baja → Media → Alta
                        </p>
                      </div>
                    )}
                    {diasMediaAAlta && (
                      <div>
                        <Label htmlFor="diasAltaAUrgente">
                          Días para elevar a Urgente (desde la creación)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="ej. 7 días"
                          {...register('diasAltaAUrgente', { valueAsNumber: true })}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Después de estos días desde la creación: Alta → Urgente
                        </p>
                      </div>
                    )}
                  </>
                )}

                {prioridad === 'media' && (
                  <>
                    <div>
                      <Label htmlFor="diasMediaAAlta">
                        Días para elevar de Media → Alta
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="ej. 4 días"
                        {...register('diasMediaAAlta', { valueAsNumber: true })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Después de estos días sin aprobar, se elevará a "Alta"
                      </p>
                    </div>
                    {diasMediaAAlta && (
                      <div>
                        <Label htmlFor="diasAltaAUrgente">
                          Días para elevar a Urgente (desde la creación)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="ej. 7 días"
                          {...register('diasAltaAUrgente', { valueAsNumber: true })}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Después de estos días desde la creación: Media → Alta → Urgente
                        </p>
                      </div>
                    )}
                  </>
                )}

                {prioridad === 'alta' && (
                  <div>
                    <Label htmlFor="diasAltaAUrgente">
                      Días para elevar de Alta → Urgente
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="ej. 5 días"
                      {...register('diasAltaAUrgente', { valueAsNumber: true })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Después de estos días sin aprobar, se elevará a "Urgente"
                    </p>
                  </div>
                )}

                {prioridad === 'urgente' && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Prioridad máxima seleccionada. No se aplicará auto-elevación.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Observaciones */}
          <Card>
            <CardHeader>
              <CardTitle>Observaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                {...register('observaciones')}
                placeholder="Observaciones adicionales..."
                className="min-h-[80px]"
              />
            </CardContent>
          </Card>

          {/* Resumen */}
          {selectedFacturasIds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Resumen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Facturas seleccionadas:</span>
                    <span className="font-medium">{selectedFacturasIds.length}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total a Pagar:</span>
                    <span>{formatCurrency(totalSeleccionado)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Acciones */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                  setProveedorSearch('');
                  setFacturas([]);
                  setSelectedProveedor(null);
                  isMountedRef.current = false;
                  handleOpenChange(false);
              }}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || selectedFacturasIds.length === 0}
              onClick={() => {
                console.log('🔘 Botón Crear Solicitud clickeado', {
                  isLoading,
                  selectedFacturasIds: selectedFacturasIds.length,
                  proveedorId: watch('proveedorId'),
                  prioridad: watch('prioridad')
                });
              }}
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear Solicitud
            </Button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );

  // Renderizar en portal para evitar problemas de z-index
  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  
  return null;
}

