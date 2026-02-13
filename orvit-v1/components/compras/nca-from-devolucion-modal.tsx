'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Package, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface DevolucionItem {
  id: number;
  supplierItemId: number;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioReferencia?: number;
  supplierItem?: {
    id: number;
    nombre: string;
    unidad: string;
  };
}

interface DevolucionBasic {
  id: number;
  numero: string;
  proveedorId: number;
  proveedor: { id: number; name: string };
  facturaId?: number;
  goodsReceipt?: {
    id: number;
    numero: string;
    receipt?: { id: number; numero: string };
  };
  estado: string;
  tipo: string;
  motivo: string;
  items?: DevolucionItem[];
  docType?: string;
}

interface NcaFromDevolucionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  devolucion: DevolucionBasic;
}

export function NcaFromDevolucionModal({
  open,
  onClose,
  onSuccess,
  devolucion: devolucionBasic,
}: NcaFromDevolucionModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingDevolucion, setLoadingDevolucion] = useState(false);
  const [devolucion, setDevolucion] = useState<DevolucionBasic & { items: DevolucionItem[] } | null>(null);
  const [loadingFactura, setLoadingFactura] = useState(false);
  const [facturaVinculada, setFacturaVinculada] = useState<{
    id: number;
    numero: string;
    total: number;
  } | null>(null);

  const isT2 = devolucionBasic.docType === 'T2';
  const docLabel = isT2 ? 'NC' : 'NCA';
  const tipoNca = isT2 ? 'NC_DEVOLUCION' : 'NCA_DEVOLUCION';

  const [formData, setFormData] = useState({
    numeroSerie: '',
    numeroFactura: '',
    motivo: devolucionBasic.motivo || 'Devolución de mercadería',
  });

  // Cargar detalles completos de la devolución (incluyendo items)
  useEffect(() => {
    const fetchDevolucion = async () => {
      if (!open) return;

      try {
        setLoadingDevolucion(true);
        const response = await fetch(`/api/compras/devoluciones/${devolucionBasic.id}`);
        if (response.ok) {
          const data = await response.json();
          setDevolucion(data);
        } else {
          toast.error('Error al cargar los detalles de la devolución');
        }
      } catch (error) {
        console.error('Error fetching devolucion:', error);
        toast.error('Error al cargar la devolución');
      } finally {
        setLoadingDevolucion(false);
      }
    };

    fetchDevolucion();
  }, [open, devolucionBasic.id]);

  const numeroSerieRef = useRef<HTMLInputElement>(null);
  const numeroFacturaRef = useRef<HTMLInputElement>(null);
  const motivoRef = useRef<HTMLTextAreaElement>(null);

  // Función para mover al siguiente campo con Enter
  const moveToNextField = (nextRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>) => {
    nextRef.current?.focus();
  };

  // Handler para Enter en numero serie
  const handleNumeroSerieKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNumeroSerieBlur();
      moveToNextField(numeroFacturaRef);
    }
  };

  // Handler para Enter en numero factura
  const handleNumeroFacturaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleNumeroFacturaBlur();
      moveToNextField(motivoRef);
    }
  };

  // Calcular total basado en items de la devolución
  const calcularTotal = () => {
    if (!devolucion?.items) return 0;
    return devolucion.items.reduce((sum, item) => {
      const precio = item.precioReferencia || 0;
      return sum + (item.cantidad * precio);
    }, 0);
  };

  const totalNeto = calcularTotal();
  const iva21 = totalNeto * 0.21;
  const totalConIva = totalNeto + iva21;

  // Buscar factura vinculada - primero directa, luego a través del remito
  useEffect(() => {
    const fetchFactura = async () => {
      // 1. Verificar si hay factura directa en la devolución
      if ((devolucion as any)?.factura) {
        const fac = (devolucion as any).factura;
        setFacturaVinculada({
          id: fac.id,
          numero: `${fac.numeroSerie}-${fac.numeroFactura}`,
          total: fac.total || 0
        });
        return;
      }

      // 2. Si no hay factura directa, buscar a través del remito
      if (!devolucion?.goodsReceipt?.id) return;

      try {
        setLoadingFactura(true);
        // La factura puede venir directamente del goodsReceipt
        const gr = devolucion.goodsReceipt as any;
        if (gr.factura) {
          setFacturaVinculada({
            id: gr.factura.id,
            numero: `${gr.factura.numeroSerie}-${gr.factura.numeroFactura}`,
            total: gr.factura.total || 0
          });
        }
      } catch (error) {
        console.error('Error buscando factura:', error);
      } finally {
        setLoadingFactura(false);
      }
    };

    if (open && devolucion) {
      fetchFactura();
    }
  }, [open, devolucion]);

  // Auto-format numero serie
  const handleNumeroSerieBlur = () => {
    const value = formData.numeroSerie.replace(/\D/g, '');
    if (value) {
      const padded = value.padStart(5, '0');
      setFormData({ ...formData, numeroSerie: padded.slice(-5) });
    }
  };

  // Auto-format numero factura
  const handleNumeroFacturaBlur = () => {
    const value = formData.numeroFactura.replace(/\D/g, '');
    if (value) {
      const padded = value.padStart(8, '0');
      setFormData({ ...formData, numeroFactura: padded.slice(-8) });
    }
  };

  const handleSubmit = async () => {
    if (!devolucion) {
      toast.error('Devolución no cargada');
      return;
    }

    if (!formData.numeroSerie || !formData.numeroFactura) {
      toast.error(`El número de ${docLabel} es obligatorio`);
      return;
    }

    if (!formData.motivo) {
      toast.error('El motivo es obligatorio');
      return;
    }

    if (totalNeto <= 0) {
      toast.error('El monto debe ser mayor a cero. Verifique que los items tengan precio de referencia.');
      return;
    }

    try {
      setLoading(true);

      const numeroCompleto = `${formData.numeroSerie}-${formData.numeroFactura}`;

      const payload = {
        tipo: 'NOTA_CREDITO',
        tipoNca,
        numeroSerie: numeroCompleto,
        proveedorId: devolucion.proveedorId,
        purchaseReturnId: devolucion.id,
        facturaId: facturaVinculada?.id || undefined,
        motivo: formData.motivo,
        fechaEmision: new Date().toISOString().split('T')[0],
        neto: totalNeto,
        iva21,
        total: totalConIva,
        docType: devolucion.docType || 'T1',
        items: devolucion.items.map(item => ({
          itemId: item.supplierItemId,
          descripcion: item.descripcion || item.supplierItem?.nombre || '',
          cantidad: item.cantidad,
          unidad: item.unidad || item.supplierItem?.unidad || 'UN',
          precioUnitario: item.precioReferencia || 0,
          subtotal: (item.precioReferencia || 0) * item.cantidad,
        })),
      };

      const response = await fetch('/api/compras/notas-credito-debito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Error al crear ${docLabel}`);
      }

      toast.success(`${docLabel} creada y vinculada a la devolución ${devolucion.numero}`);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || `Error al crear ${docLabel}`);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent size="full" className="overflow-y-auto sm:p-8">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Cargar {docLabel} para Devolución {devolucionBasic.numero}
          </DialogTitle>
        </DialogHeader>

        {loadingDevolucion ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Cargando detalles...</span>
          </div>
        ) : !devolucion ? (
          <div className="text-center py-8 text-red-600">
            Error al cargar la devolución
          </div>
        ) : (
        <div className="space-y-4 py-4">
          {/* Info de la devolución */}
          <div className="p-3 border rounded-lg bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-amber-800 dark:text-amber-200">Devolución</span>
              {isT2 && (
                <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300 ml-auto">
                  T2 - Extendido
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Número: </span>
                <span className="font-medium">{devolucion.numero}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Proveedor: </span>
                <span className="font-medium">{devolucion.proveedor?.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Tipo: </span>
                <span className="font-medium">{devolucion.tipo}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Items: </span>
                <span className="font-medium">{devolucion.items?.length || 0}</span>
              </div>
            </div>
          </div>

          {/* Factura vinculada (si existe) */}
          {loadingFactura ? (
            <div className="p-3 border rounded-lg text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Buscando factura vinculada...
            </div>
          ) : facturaVinculada ? (
            <div className="p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <span className="text-sm">
                  <span className="text-muted-foreground">Factura vinculada: </span>
                  <span className="font-medium">{facturaVinculada.numero}</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 border rounded-lg text-sm text-muted-foreground">
              Sin factura vinculada (la {docLabel} se creará solo con la devolución)
            </div>
          )}

          {/* Número de NCA */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Punto de Venta *</Label>
              <Input
                ref={numeroSerieRef}
                value={formData.numeroSerie}
                onChange={(e) => setFormData({ ...formData, numeroSerie: e.target.value.replace(/\D/g, '') })}
                onBlur={handleNumeroSerieBlur}
                onKeyDown={handleNumeroSerieKeyDown}
                placeholder="00001"
                maxLength={5}
              />
            </div>
            <div className="space-y-2">
              <Label>Número {docLabel} *</Label>
              <Input
                ref={numeroFacturaRef}
                value={formData.numeroFactura}
                onChange={(e) => setFormData({ ...formData, numeroFactura: e.target.value.replace(/\D/g, '') })}
                onBlur={handleNumeroFacturaBlur}
                onKeyDown={handleNumeroFacturaKeyDown}
                placeholder="00001234"
                maxLength={8}
              />
            </div>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label>Motivo *</Label>
            <Textarea
              ref={motivoRef}
              value={formData.motivo}
              onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
              placeholder="Motivo de la nota de crédito..."
              rows={2}
            />
          </div>

          {/* Items de la devolución */}
          <div className="space-y-2">
            <Label>Items incluidos</Label>
            <div className="border rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center w-20">Cant.</TableHead>
                    <TableHead className="text-right w-28">Precio</TableHead>
                    <TableHead className="text-right w-28">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devolucion.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="text-sm font-medium">{item.descripcion || item.supplierItem?.nombre}</p>
                        <p className="text-xs text-muted-foreground">{item.unidad || item.supplierItem?.unidad}</p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{item.cantidad}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {item.precioReferencia ? formatCurrency(item.precioReferencia) : (
                          <span className="text-amber-600 text-xs">Sin precio</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.precioReferencia ? formatCurrency(item.cantidad * item.precioReferencia) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Advertencia si no hay precios */}
          {totalNeto === 0 && (
            <div className="p-3 border border-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-sm text-amber-700 dark:text-amber-300">
              ⚠️ Los items no tienen precio de referencia. Verifique los precios antes de crear la {docLabel}.
            </div>
          )}

          {/* Totales */}
          <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
            <div className="flex justify-between text-sm">
              <span>Neto</span>
              <span>{formatCurrency(totalNeto)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>IVA 21%</span>
              <span>{formatCurrency(iva21)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total {docLabel}</span>
              <span>{formatCurrency(totalConIva)}</span>
            </div>
          </div>

          <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || totalNeto <= 0}
            className={isT2 ? 'bg-purple-600 hover:bg-purple-700' : ''}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crear {docLabel}
          </Button>
          </DialogFooter>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
