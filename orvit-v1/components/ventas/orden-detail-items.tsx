'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';

interface OrdenDetailItemsProps {
  items: any[];
  moneda: string;
}

export function OrdenDetailItems({ items, moneda }: OrdenDetailItemsProps) {
  const formatMoney = (amount: number) => {
    return `${moneda} ${Number(amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Items de la Orden ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right w-[100px]">Cantidad</TableHead>
                <TableHead className="text-right w-[120px]">Precio Unit.</TableHead>
                <TableHead className="text-right w-[100px]">Desc. %</TableHead>
                <TableHead className="text-right w-[120px]">Subtotal</TableHead>
                <TableHead className="text-center w-[120px]">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No hay items en esta orden
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => {
                  const subtotalSinDescuento = Number(item.precioUnitario) * Number(item.cantidad);
                  const descuentoMonto = subtotalSinDescuento * (Number(item.descuento) / 100);
                  const subtotalFinal = subtotalSinDescuento - descuentoMonto;
                  const cantidadPendiente = Number(item.cantidad) - Number(item.cantidadEntregada || 0);
                  const porcentajeEntregado = (Number(item.cantidadEntregada || 0) / Number(item.cantidad)) * 100;

                  return (
                    <TableRow key={item.id || index}>
                      <TableCell className="font-mono text-sm">
                        {item.codigo || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.descripcion}</p>
                          {item.notas && (
                            <p className="text-xs text-muted-foreground mt-1">{item.notas}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <p className="font-semibold">{Number(item.cantidad)} {item.unidad}</p>
                          {Number(item.cantidadEntregada || 0) > 0 && (
                            <p className="text-xs text-green-600">
                              Entregado: {Number(item.cantidadEntregada)}
                            </p>
                          )}
                          {cantidadPendiente > 0 && Number(item.cantidadEntregada || 0) > 0 && (
                            <p className="text-xs text-amber-600">
                              Pendiente: {cantidadPendiente}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(Number(item.precioUnitario))}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(item.descuento) > 0 ? (
                          <span className="text-amber-600 font-semibold">
                            {Number(item.descuento)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold font-mono">
                        {formatMoney(subtotalFinal)}
                      </TableCell>
                      <TableCell className="text-center">
                        {porcentajeEntregado === 0 && (
                          <Badge variant="secondary">Pendiente</Badge>
                        )}
                        {porcentajeEntregado > 0 && porcentajeEntregado < 100 && (
                          <Badge variant="default" className="bg-amber-500">
                            Parcial ({porcentajeEntregado.toFixed(0)}%)
                          </Badge>
                        )}
                        {porcentajeEntregado === 100 && (
                          <Badge variant="default" className="bg-green-500">
                            Completo
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Notas del pedido */}
        {items.some(i => i.notas) && (
          <div className="mt-4 text-xs text-muted-foreground">
            <p className="font-semibold mb-1">Notas en items:</p>
            <ul className="list-disc list-inside space-y-1">
              {items.filter(i => i.notas).map((item, idx) => (
                <li key={idx}>
                  <span className="font-medium">{item.descripcion}:</span> {item.notas}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
