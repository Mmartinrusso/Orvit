'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  ArrowLeft,
  Save,
  Loader2,
  Building2,
  FileText,
  Calendar,
  DollarSign,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCompany } from '@/contexts/CompanyContext';
import { DatePicker } from '@/components/ui/date-picker';

const editarSolicitudSchema = z.object({
  prioridad: z.enum(['baja', 'media', 'alta', 'urgente'], {
    required_error: 'Selecciona una prioridad'
  }),
  observaciones: z.string().optional(),
  fechaObjetivo: z.string().optional(),
  comprobantesSeleccionados: z.array(z.number()).min(1, 'Selecciona al menos un comprobante')
});

type EditarSolicitudFormData = z.infer<typeof editarSolicitudSchema>;

interface Comprobante {
  id: number;
  numeroSerie: string;
  numeroFactura: string;
  tipo: string;
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  total: number;
  estado: string;
  enOtraSolicitud?: boolean;
}

interface Solicitud {
  id: number;
  numero: string;
  estado: string;
  prioridad: string;
  fechaObjetivo: string | null;
  motivo: string | null;
  montoTotal: number;
  proveedor: {
    id: number;
    nombre: string;
    razonSocial: string | null;
  };
  comprobantes: Array<{
    id: number;
    receiptId: number;
    montoSolicitado: number;
    receipt: {
      id: number;
      tipo: string;
      numeroSerie: string;
      numeroFactura: string;
      total: number;
      fechaEmision: string | null;
      fechaVencimiento: string | null;
    } | null;
  }>;
  puedeEditar: boolean;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(amount);
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return format(new Date(dateStr), 'dd/MM/yyyy', { locale: es });
};

export default function EditarSolicitudPage() {
  const params = useParams();
  const router = useRouter();
  const { currentCompany } = useCompany();
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [comprobantesDisponibles, setComprobantesDisponibles] = useState<Comprobante[]>([]);
  const [loadingComprobantes, setLoadingComprobantes] = useState(false);

  const solicitudId = params.id as string;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<EditarSolicitudFormData>({
    resolver: zodResolver(editarSolicitudSchema),
    defaultValues: {
      prioridad: 'media',
      observaciones: '',
      fechaObjetivo: '',
      comprobantesSeleccionados: []
    }
  });

  const comprobantesSeleccionados = watch('comprobantesSeleccionados') || [];
  const prioridad = watch('prioridad');

  // Cargar solicitud existente
  useEffect(() => {
    if (solicitudId) {
      loadSolicitud();
    }
  }, [solicitudId]);

  // Cargar comprobantes del proveedor cuando tengamos la solicitud
  useEffect(() => {
    if (solicitud?.proveedor?.id && currentCompany?.id) {
      loadComprobantesProveedor(solicitud.proveedor.id);
    }
  }, [solicitud?.proveedor?.id, currentCompany?.id]);

  const loadSolicitud = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/compras/solicitudes/${solicitudId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Solicitud no encontrada');
          router.push('/administracion/compras/solicitudes');
          return;
        }
        throw new Error('Error al cargar solicitud');
      }
      const data = await response.json();
      const sol = data.solicitud;

      if (!sol.puedeEditar) {
        toast.error('Esta solicitud no puede ser editada');
        router.push(`/administracion/compras/solicitudes/${solicitudId}`);
        return;
      }

      setSolicitud(sol);

      // Pre-llenar el formulario
      setValue('prioridad', sol.prioridad as any);
      setValue('observaciones', sol.motivo || '');
      setValue('fechaObjetivo', sol.fechaObjetivo ? sol.fechaObjetivo.split('T')[0] : '');

      // Pre-seleccionar los comprobantes actuales
      const receiptIds = sol.comprobantes
        .map((c: any) => c.receipt?.id || c.receiptId)
        .filter(Boolean);
      setValue('comprobantesSeleccionados', receiptIds);

    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  const loadComprobantesProveedor = async (proveedorId: number) => {
    if (!currentCompany?.id) return;

    setLoadingComprobantes(true);
    try {
      const response = await fetch(
        `/api/compras/comprobantes?companyId=${currentCompany.id}&proveedorId=${proveedorId}&estado=pendiente`
      );
      if (!response.ok) throw new Error('Error al cargar comprobantes');

      const data = await response.json();
      const comprobantes = (data.comprobantes || data || []).map((c: any) => ({
        id: c.id,
        numeroSerie: c.numero_serie || c.numeroSerie || '',
        numeroFactura: c.numero_factura || c.numeroFactura || '',
        tipo: c.tipo || '',
        fechaEmision: c.fecha_emision || c.fechaEmision || null,
        fechaVencimiento: c.fecha_vencimiento || c.fechaVencimiento || null,
        total: Number(c.total) || 0,
        estado: c.estado || 'pendiente'
      }));

      // Agregar los comprobantes que ya están en la solicitud (por si tienen otro estado)
      if (solicitud) {
        const currentReceiptIds = comprobantes.map((c: Comprobante) => c.id);
        solicitud.comprobantes.forEach(sc => {
          if (sc.receipt && !currentReceiptIds.includes(sc.receipt.id)) {
            comprobantes.push({
              id: sc.receipt.id,
              numeroSerie: sc.receipt.numeroSerie,
              numeroFactura: sc.receipt.numeroFactura,
              tipo: sc.receipt.tipo,
              fechaEmision: sc.receipt.fechaEmision,
              fechaVencimiento: sc.receipt.fechaVencimiento,
              total: sc.montoSolicitado,
              estado: 'en_solicitud'
            });
          }
        });
      }

      setComprobantesDisponibles(comprobantes);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al cargar comprobantes');
    } finally {
      setLoadingComprobantes(false);
    }
  };

  const handleToggleComprobante = (comprobanteId: number) => {
    const current = [...comprobantesSeleccionados];
    const index = current.indexOf(comprobanteId);

    if (index === -1) {
      current.push(comprobanteId);
    } else {
      current.splice(index, 1);
    }

    setValue('comprobantesSeleccionados', current, { shouldValidate: true });
  };

  const montoTotal = useMemo(() => {
    return comprobantesDisponibles
      .filter(c => comprobantesSeleccionados.includes(c.id))
      .reduce((sum, c) => sum + c.total, 0);
  }, [comprobantesDisponibles, comprobantesSeleccionados]);

  const onSubmit = async (data: EditarSolicitudFormData) => {
    if (!solicitud) return;

    setSaving(true);
    try {
      const comprobantes = comprobantesDisponibles
        .filter(c => data.comprobantesSeleccionados.includes(c.id))
        .map(c => ({ id: c.id, total: c.total }));

      const response = await fetch(`/api/compras/solicitudes/${solicitud.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prioridad: data.prioridad,
          observaciones: data.observaciones,
          fechaObjetivo: data.fechaObjetivo || null,
          comprobantes
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar');
      }

      toast.success('Solicitud actualizada exitosamente');
      router.push(`/administracion/compras/solicitudes/${solicitud.id}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full p-6 overflow-y-auto" style={{ height: 'calc(100vh - 48px)' }}>
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!solicitud) {
    return (
      <div className="w-full p-6 text-center">
        <p className="text-muted-foreground">Solicitud no encontrada</p>
        <Button variant="outline" onClick={() => router.push('/administracion/compras/solicitudes')} className="mt-4">
          Volver al listado
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full p-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/administracion/compras/solicitudes/${solicitud.id}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Editar Solicitud</h1>
            <p className="text-xs text-muted-foreground">{solicitud.numero}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push(`/administracion/compras/solicitudes/${solicitud.id}`)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Guardar Cambios
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <form className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Proveedor (solo lectura) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  Proveedor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                  <div>
                    <p className="font-medium">{solicitud.proveedor.nombre}</p>
                    {solicitud.proveedor.razonSocial && solicitud.proveedor.razonSocial !== solicitud.proveedor.nombre && (
                      <p className="text-xs text-muted-foreground">{solicitud.proveedor.razonSocial}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    No editable
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Comprobantes */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  Comprobantes
                  {comprobantesSeleccionados.length > 0 && (
                    <Badge variant="secondary" className="text-xs ml-2">
                      {comprobantesSeleccionados.length} seleccionado(s)
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingComprobantes ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    Cargando comprobantes...
                  </div>
                ) : comprobantesDisponibles.length === 0 ? (
                  <div className="p-8 text-center">
                    <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      No hay comprobantes disponibles para este proveedor
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead className="text-xs font-medium">Tipo</TableHead>
                        <TableHead className="text-xs font-medium">Número</TableHead>
                        <TableHead className="text-xs font-medium">Vencimiento</TableHead>
                        <TableHead className="text-xs font-medium text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comprobantesDisponibles.map((comp) => {
                        const isSelected = comprobantesSeleccionados.includes(comp.id);
                        return (
                          <TableRow
                            key={comp.id}
                            className={`cursor-pointer hover:bg-muted/30 ${isSelected ? 'bg-primary/5' : ''}`}
                            onClick={() => handleToggleComprobante(comp.id)}
                          >
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleToggleComprobante(comp.id)}
                              />
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className="text-xs px-1.5">
                                {comp.tipo}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {comp.numeroSerie}-{comp.numeroFactura}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDate(comp.fechaVencimiento)}
                            </TableCell>
                            <TableCell className="text-xs font-medium text-right">
                              {formatCurrency(comp.total)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
                {errors.comprobantesSeleccionados && (
                  <div className="px-4 py-2 text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {errors.comprobantesSeleccionados.message}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Observaciones */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Observaciones</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Agregar observaciones o notas adicionales..."
                  {...register('observaciones')}
                  rows={4}
                  className="text-sm"
                />
              </CardContent>
            </Card>
          </div>

          {/* Columna lateral */}
          <div className="space-y-6">
            {/* Configuración */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Configuración</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Prioridad */}
                <div className="space-y-2">
                  <Label className="text-xs">Prioridad</Label>
                  <Select
                    value={prioridad}
                    onValueChange={(value) => setValue('prioridad', value as any)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Seleccionar prioridad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baja" className="text-sm">Baja</SelectItem>
                      <SelectItem value="media" className="text-sm">Media</SelectItem>
                      <SelectItem value="alta" className="text-sm">Alta</SelectItem>
                      <SelectItem value="urgente" className="text-sm">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.prioridad && (
                    <p className="text-xs text-destructive">{errors.prioridad.message}</p>
                  )}
                </div>

                {/* Fecha objetivo */}
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Fecha Objetivo
                  </Label>
                  <DatePicker
                    value={watch('fechaObjetivo') || ''}
                    onChange={(date) => setValue('fechaObjetivo', date)}
                    placeholder="Seleccionar fecha"
                    className="h-9 text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Resumen */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  Resumen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Comprobantes</span>
                  <span className="font-medium">{comprobantesSeleccionados.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm border-t pt-3">
                  <span className="font-medium">Monto Total</span>
                  <span className="font-semibold text-lg">{formatCurrency(montoTotal)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
