'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface CotizacionToOrdenButtonProps {
  cotizacionId: number;
  cotizacion: any;
  variant?: 'default' | 'outline';
  size?: 'default' | 'sm' | 'lg';
}

export function CotizacionToOrdenButton({
  cotizacionId,
  cotizacion,
  variant = 'default',
  size = 'default',
}: CotizacionToOrdenButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [converting, setConverting] = useState(false);
  const [copiarPrecios, setCopiarPrecios] = useState(true);
  const [copiarDescuentos, setCopiarDescuentos] = useState(true);
  const [copiarNotas, setCopiarNotas] = useState(true);

  const handleConvert = async () => {
    setConverting(true);
    try {
      const response = await fetch(`/api/ventas/cotizaciones/${cotizacionId}/convertir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          copiarPrecios,
          copiarDescuentos,
          copiarNotas,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al convertir');
      }

      const data = await response.json();

      toast({
        title: 'Cotización convertida',
        description: `Orden de venta ${data.orden.numero} creada exitosamente`,
      });

      // Redirigir a la nueva orden
      router.push(`/administracion/ventas/ordenes/${data.orden.id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al convertir la cotización',
        variant: 'destructive',
      });
    } finally {
      setConverting(false);
      setShowDialog(false);
    }
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setShowDialog(true)}>
        <ArrowRight className="h-4 w-4 mr-2" />
        Convertir a Orden
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convertir a Orden de Venta</DialogTitle>
            <DialogDescription>
              Se creará una orden de venta basada en la cotización <strong>{cotizacion.numero}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Resumen */}
            <div className="p-4 border rounded-lg bg-muted/50">
              <p className="text-sm font-semibold mb-2">Resumen de la Cotización</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Cliente:</span>
                  <p className="font-medium">{cotizacion.client?.name || cotizacion.client?.legalName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total:</span>
                  <p className="font-medium text-lg">
                    {cotizacion.moneda} ${Number(cotizacion.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Items:</span>
                  <p className="font-medium">{cotizacion.items?.length || 0}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Validez:</span>
                  <p className="font-medium">
                    {cotizacion.fechaValidez
                      ? new Date(cotizacion.fechaValidez).toLocaleDateString('es-AR')
                      : 'No especificada'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Opciones de conversión */}
            <div className="space-y-3">
              <p className="text-sm font-semibold">Opciones de Conversión</p>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="copiar-precios"
                  checked={copiarPrecios}
                  onCheckedChange={(checked) => setCopiarPrecios(checked as boolean)}
                />
                <Label htmlFor="copiar-precios" className="text-sm">
                  Copiar precios de la cotización
                  <span className="text-xs text-muted-foreground block">
                    Si no, se usarán los precios actuales de las listas
                  </span>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="copiar-descuentos"
                  checked={copiarDescuentos}
                  onCheckedChange={(checked) => setCopiarDescuentos(checked as boolean)}
                />
                <Label htmlFor="copiar-descuentos" className="text-sm">
                  Copiar descuentos aplicados
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="copiar-notas"
                  checked={copiarNotas}
                  onCheckedChange={(checked) => setCopiarNotas(checked as boolean)}
                />
                <Label htmlFor="copiar-notas" className="text-sm">
                  Copiar notas y observaciones
                </Label>
              </div>
            </div>

            {/* Información adicional */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
              <p className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                La cotización se marcará como CONVERTIDA automáticamente
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={converting}>
              Cancelar
            </Button>
            <Button onClick={handleConvert} disabled={converting}>
              {converting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear Orden de Venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
