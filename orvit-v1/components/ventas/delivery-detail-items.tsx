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
import { Package } from 'lucide-react';

interface DeliveryDetailItemsProps {
  items: any[];
}

export function DeliveryDetailItems({ items }: DeliveryDetailItemsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="w-5 h-5" />
          Items de la Entrega
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs font-medium">Producto</TableHead>
              <TableHead className="text-xs font-medium text-center w-[100px]">Cantidad</TableHead>
              <TableHead className="text-xs font-medium text-right w-[120px]">Precio Unit.</TableHead>
              <TableHead className="text-xs font-medium text-right w-[120px]">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items && items.length > 0 ? (
              items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="text-sm">
                    <div>
                      <p className="font-medium">{item.product?.name || item.descripcion || 'Producto sin nombre'}</p>
                      {item.product?.codigo && (
                        <p className="text-xs text-muted-foreground">Código: {item.product.codigo}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-center">
                    <span className="font-medium">{item.cantidad}</span>
                    {item.saleItem?.unidadMedida && (
                      <span className="text-xs text-muted-foreground ml-1">{item.saleItem.unidadMedida}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-right">
                    {item.saleItem?.precioUnitario ? formatCurrency(item.saleItem.precioUnitario) : '-'}
                  </TableCell>
                  <TableCell className="text-sm text-right font-medium">
                    {item.saleItem?.precioUnitario
                      ? formatCurrency(item.saleItem.precioUnitario * item.cantidad)
                      : '-'}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No hay items en esta entrega
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {items && items.length > 0 && (
          <div className="mt-4 flex justify-end">
            <div className="space-y-2 min-w-[200px]">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total items:</span>
                <span className="font-medium">{items.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cantidad total:</span>
                <span className="font-medium">
                  {items.reduce((sum, item) => sum + (item.cantidad || 0), 0)}
                </span>
              </div>
              {items.some(item => item.saleItem?.precioUnitario) && (
                <div className="flex justify-between text-base font-bold pt-2 border-t">
                  <span>Total:</span>
                  <span>
                    {formatCurrency(
                      items.reduce(
                        (sum, item) =>
                          sum + (item.saleItem?.precioUnitario || 0) * (item.cantidad || 0),
                        0
                      )
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
