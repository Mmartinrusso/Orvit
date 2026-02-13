'use client';

import { useState, useEffect, useRef } from 'react';
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
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PackageCheck, AlertTriangle, Loader2, Upload, Camera, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface FacturaItem {
  id: number;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  itemId?: number; // supplierItemId
  codigoProveedor?: string;
  supplierItem?: {
    id: number;
    nombre: string;
    codigoProveedor?: string;
  };
}

interface Factura {
  id: number;
  numeroSerie: string;
  numeroFactura: string;
  proveedorId: number;
  proveedor?: {
    id: number;
    name: string;
  };
  items: FacturaItem[];
  docType?: 'T1' | 'T2';
  purchaseOrderId?: number;
}

interface Warehouse {
  id: number;
  codigo: string;
  nombre: string;
}

interface ItemRecepcion {
  facturaItemId: number;
  supplierItemId?: number;
  codigoProveedor?: string;
  descripcion: string;
  unidad: string;
  precioUnitario: number;
  qtyExpected: number;
  qtyReceived: string;
  qtyAccepted: string;
  motivoRechazo: string;
}

interface CargarRemitoDesdeFacturaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  factura: Factura;
  onSuccess: () => void;
}

export function CargarRemitoDesdeFacturaModal({
  open,
  onOpenChange,
  factura,
  onSuccess,
}: CargarRemitoDesdeFacturaModalProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  // Número de remito separado en serie y número
  const [remitoSerie, setRemitoSerie] = useState('');
  const [remitoNumero, setRemitoNumero] = useState('');
  const remitoNumeroRef = useRef<HTMLInputElement>(null);
  const observacionesRef = useRef<HTMLInputElement>(null);
  const [observaciones, setObservaciones] = useState('');
  const [items, setItems] = useState<ItemRecepcion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Campos de evidencia para confirmar
  const [adjuntos, setAdjuntos] = useState<string[]>([]);
  const [nombreRecibe, setNombreRecibe] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Formatear número de remito con ceros
  const formatRemitoSerie = (value: string) => {
    const num = value.replace(/\D/g, '').slice(0, 4);
    return num.padStart(4, '0');
  };

  const formatRemitoNumero = (value: string) => {
    const num = value.replace(/\D/g, '').slice(0, 8);
    return num.padStart(8, '0');
  };

  // Manejar Enter en serie para pasar a número
  const handleSerieKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setRemitoSerie(formatRemitoSerie(remitoSerie));
      remitoNumeroRef.current?.focus();
    }
  };

  const handleSerieBlur = () => {
    if (remitoSerie) {
      setRemitoSerie(formatRemitoSerie(remitoSerie));
    }
  };

  const handleNumeroBlur = () => {
    if (remitoNumero) {
      setRemitoNumero(formatRemitoNumero(remitoNumero));
    }
  };

  const handleNumeroKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setRemitoNumero(formatRemitoNumero(remitoNumero));
      observacionesRef.current?.focus();
    }
  };

  // Combinar serie y número para el remito completo
  const getNumeroRemitoCompleto = () => {
    if (!remitoSerie && !remitoNumero) return undefined;
    const serie = remitoSerie ? formatRemitoSerie(remitoSerie) : '0000';
    const numero = remitoNumero ? formatRemitoNumero(remitoNumero) : '00000000';
    return `${serie}-${numero}`;
  };

  // Cargar depósitos disponibles
  useEffect(() => {
    const fetchData = async () => {
      if (!open) return;

      setIsLoading(true);
      try {
        const response = await fetch('/api/compras/depositos');
        if (response.ok) {
          const data = await response.json();
          setWarehouses(data.data || []);
          const defaultWh = data.data?.find((w: Warehouse & { isDefault?: boolean }) => w.isDefault);
          if (defaultWh) {
            setSelectedWarehouse(defaultWh.id.toString());
          }
        }
      } catch (error) {
        console.error('Error fetching warehouses:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [open]);

  // Inicializar items desde la factura
  useEffect(() => {
    if (open && factura.items) {
      setItems(
        factura.items.map((item) => ({
          facturaItemId: item.id,
          supplierItemId: item.itemId || item.supplierItem?.id,
          codigoProveedor: item.codigoProveedor || item.supplierItem?.codigoProveedor,
          descripcion: item.descripcion,
          unidad: item.unidad,
          precioUnitario: item.precioUnitario,
          qtyExpected: item.cantidad,
          qtyReceived: '',
          qtyAccepted: '',
          motivoRechazo: '',
        }))
      );
    }
  }, [open, factura.items]);

  // Actualizar un item
  const updateItem = (index: number, field: keyof ItemRecepcion, value: string) => {
    setItems((prev) => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };

      // Si se actualiza qtyReceived y qtyAccepted está vacío, copiar el valor
      if (field === 'qtyReceived' && !newItems[index].qtyAccepted) {
        newItems[index].qtyAccepted = value;
      }

      return newItems;
    });
  };

  // Manejar subida de fotos
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        toast.error('Solo se permiten imágenes');
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setAdjuntos((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Eliminar adjunto
  const removeAdjunto = (index: number) => {
    setAdjuntos((prev) => prev.filter((_, i) => i !== index));
  };

  // Validar antes de crear
  const validateForm = (): string | null => {
    if (!selectedWarehouse) {
      return 'Debe seleccionar un depósito';
    }

    for (const item of items) {
      if (!item.qtyReceived || parseFloat(item.qtyReceived) < 0) {
        return `Item "${item.descripcion}": debe indicar cantidad recibida`;
      }
      if (!item.qtyAccepted || parseFloat(item.qtyAccepted) < 0) {
        return `Item "${item.descripcion}": debe indicar cantidad aceptada`;
      }
      const received = parseFloat(item.qtyReceived);
      const accepted = parseFloat(item.qtyAccepted);
      if (accepted > received) {
        return `Item "${item.descripcion}": cantidad aceptada no puede ser mayor a recibida`;
      }
      if (accepted < received && !item.motivoRechazo.trim()) {
        return `Item "${item.descripcion}": debe indicar motivo del rechazo parcial`;
      }
    }

    // Validar evidencia obligatoria
    if (!nombreRecibe.trim()) {
      return 'Debe indicar quién recibe la mercadería';
    }

    if (adjuntos.length === 0) {
      return 'Debe adjuntar al menos una foto del remito o mercadería';
    }

    return null;
  };

  // Crear y confirmar la recepción
  const handleCreate = async () => {
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }

    setIsCreating(true);
    try {
      // Combinar nombre de quien recibe con observaciones
      const observacionesCompletas = `Recibido por: ${nombreRecibe}${observaciones ? `. ${observaciones}` : ''}`;

      // Paso 1: Crear la recepción con evidencia
      const response = await fetch('/api/compras/recepciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proveedorId: factura.proveedorId,
          purchaseOrderId: factura.purchaseOrderId || undefined,
          warehouseId: parseInt(selectedWarehouse),
          facturaId: factura.id,
          numeroRemito: getNumeroRemitoCompleto(),
          observacionesRecepcion: observacionesCompletas,
          docType: factura.docType || 'T1',
          adjuntos: adjuntos,
          items: items
            .filter((item) => parseFloat(item.qtyReceived) > 0)
            .map((item) => ({
              supplierItemId: item.supplierItemId,
              codigoProveedor: item.codigoProveedor,
              descripcion: item.descripcion,
              unidad: item.unidad,
              precioUnitario: item.precioUnitario,
              cantidadEsperada: item.qtyExpected,
              cantidadRecibida: parseFloat(item.qtyReceived),
              cantidadAceptada: parseFloat(item.qtyAccepted),
              cantidadRechazada: parseFloat(item.qtyReceived) - parseFloat(item.qtyAccepted),
              motivoRechazo: item.motivoRechazo || undefined,
            })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al crear la recepción');
      }

      const recepcion = await response.json();

      // Paso 2: Confirmar la recepción automáticamente
      const confirmResponse = await fetch(`/api/compras/recepciones/${recepcion.id}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjuntos: adjuntos,
          observacionesRecepcion: observacionesCompletas,
        }),
      });

      if (!confirmResponse.ok) {
        const data = await confirmResponse.json();
        toast.warning(`Recepción ${recepcion.numero} creada como borrador. Error al confirmar: ${data.error}`);
      } else {
        toast.success(`Recepción ${recepcion.numero} creada y confirmada correctamente`);
      }

      onSuccess();
      onOpenChange(false);

      // Reset form
      setRemitoSerie('');
      setRemitoNumero('');
      setObservaciones('');
      setItems([]);
      setAdjuntos([]);
      setNombreRecibe('');
    } catch (error: any) {
      console.error('Error creating receipt:', error);
      toast.error(error.message || 'Error al crear la recepción');
    } finally {
      setIsCreating(false);
    }
  };

  // Calcular totales
  const totalEsperado = items.reduce((sum, item) => sum + item.qtyExpected, 0);
  const totalRecibido = items.reduce((sum, item) => sum + (parseFloat(item.qtyReceived) || 0), 0);
  const totalAceptado = items.reduce((sum, item) => sum + (parseFloat(item.qtyAccepted) || 0), 0);
  const hayDiferencias = items.some(
    (item) => parseFloat(item.qtyAccepted || '0') < parseFloat(item.qtyReceived || '0')
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] !max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            Cargar Remito desde Factura {factura.numeroSerie}-{factura.numeroFactura}
          </DialogTitle>
          <DialogDescription>
            Proveedor: {factura.proveedor?.name || 'Proveedor'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Cargando datos...</span>
          </div>
        ) : (
        <div className="space-y-6 px-2">
          {/* Información del encabezado */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Depósito *</Label>
              <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar depósito" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id.toString()}>
                      {wh.codigo} - {wh.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>N° Remito del Proveedor</Label>
              <div className="flex gap-1 items-center">
                <Input
                  value={remitoSerie}
                  onChange={(e) => setRemitoSerie(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  onKeyDown={handleSerieKeyDown}
                  onBlur={handleSerieBlur}
                  placeholder="0000"
                  className="w-20 text-center"
                  maxLength={4}
                />
                <span className="text-muted-foreground font-bold">-</span>
                <Input
                  ref={remitoNumeroRef}
                  value={remitoNumero}
                  onChange={(e) => setRemitoNumero(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  onKeyDown={handleNumeroKeyDown}
                  onBlur={handleNumeroBlur}
                  placeholder="00000000"
                  className="flex-1 text-center"
                  maxLength={8}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Input
                ref={observacionesRef}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>

          {/* Alerta informativa */}
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Recepción con confirmación:</strong> Complete los datos, suba una foto del remito y la recepción quedará <Badge className="bg-green-600">CONFIRMADA</Badge> automáticamente.
            </AlertDescription>
          </Alert>

          {/* Tabla de items */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[12%]">Cód. Proveedor</TableHead>
                  <TableHead className="w-[28%]">Item</TableHead>
                  <TableHead className="text-center w-[10%]">Esperado</TableHead>
                  <TableHead className="text-center w-[12%]">Recibido *</TableHead>
                  <TableHead className="text-center w-[12%]">Aceptado *</TableHead>
                  <TableHead className="w-[26%]">Motivo Rechazo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => {
                  const received = parseFloat(item.qtyReceived) || 0;
                  const accepted = parseFloat(item.qtyAccepted) || 0;
                  const needsMotivo = accepted < received;
                  const hasDiff = item.qtyExpected !== received;

                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <span className="text-blue-600 font-medium text-sm">
                          {item.codigoProveedor || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{item.descripcion}</p>
                          <span className="text-xs text-muted-foreground">{item.unidad}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{item.qtyExpected}</span>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.qtyReceived}
                          onChange={(e) => updateItem(index, 'qtyReceived', e.target.value)}
                          className={cn(
                            'text-center',
                            hasDiff && item.qtyReceived && 'border-yellow-500'
                          )}
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.qtyAccepted}
                          onChange={(e) => updateItem(index, 'qtyAccepted', e.target.value)}
                          className={cn(
                            'text-center',
                            needsMotivo && 'border-orange-500'
                          )}
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.motivoRechazo}
                          onChange={(e) => updateItem(index, 'motivoRechazo', e.target.value)}
                          placeholder={needsMotivo ? 'Requerido...' : 'Opcional'}
                          className={cn(needsMotivo && !item.motivoRechazo && 'border-red-500')}
                          disabled={!needsMotivo}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Sección de Evidencia */}
          <div className="border rounded-lg p-4 bg-blue-50/50">
            <h4 className="font-medium mb-4 flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Evidencia de Recepción (Obligatorio)
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {/* Quien recibe */}
              <div className="space-y-2">
                <Label>Nombre de quien recibe *</Label>
                <Input
                  value={nombreRecibe}
                  onChange={(e) => setNombreRecibe(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="bg-white"
                />
              </div>

              {/* Subir foto */}
              <div className="space-y-2">
                <Label>Foto del remito/mercadería *</Label>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 bg-white"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Subir foto
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.setAttribute('capture', 'environment');
                        fileInputRef.current.click();
                        fileInputRef.current.removeAttribute('capture');
                      }
                    }}
                    className="bg-white"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Preview de fotos */}
            {adjuntos.length > 0 && (
              <div className="mt-4 flex gap-2 flex-wrap">
                {adjuntos.map((adjunto, index) => (
                  <div key={index} className="relative">
                    <img
                      src={adjunto}
                      alt={`Adjunto ${index + 1}`}
                      className="w-20 h-20 object-cover rounded border"
                    />
                    <button
                      type="button"
                      onClick={() => removeAdjunto(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resumen */}
          <div className="flex justify-between items-center p-4 bg-muted/30 rounded-lg">
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Esperado:</span>{' '}
                <span className="font-medium">{totalEsperado}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Recibido:</span>{' '}
                <span className={cn('font-medium', totalRecibido !== totalEsperado && 'text-yellow-600')}>
                  {totalRecibido}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Aceptado:</span>{' '}
                <span className={cn('font-medium', totalAceptado !== totalRecibido && 'text-orange-600')}>
                  {totalAceptado}
                </span>
              </div>
            </div>
            {hayDiferencias && (
              <Badge variant="outline" className="text-orange-600 border-orange-600">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Hay rechazos parciales
              </Badge>
            )}
          </div>
        </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating || isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || isLoading || items.length === 0} className="bg-green-600 hover:bg-green-700">
            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Crear y Confirmar Recepción
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
