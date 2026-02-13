'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package, MapPin, Scale, Box } from 'lucide-react';

interface LoadOrderDetailItemsProps {
  items: any[];
  estado: string;
}

export function LoadOrderDetailItems({ items, estado }: LoadOrderDetailItemsProps) {
  const isConfirmed = ['CARGADA', 'DESPACHADA'].includes(estado);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="w-5 h-5" />
          Items de la Orden de Carga
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs font-medium w-[60px]">Sec.</TableHead>
              <TableHead className="text-xs font-medium">Producto</TableHead>
              <TableHead className="text-xs font-medium text-center w-[100px]">Cantidad</TableHead>
              {isConfirmed && (
                <TableHead className="text-xs font-medium text-center w-[100px]">Cargada</TableHead>
              )}
              <TableHead className="text-xs font-medium text-center w-[100px]">Peso/Un</TableHead>
              <TableHead className="text-xs font-medium text-center w-[100px]">Vol/Un</TableHead>
              <TableHead className="text-xs font-medium w-[120px]">Posición</TableHead>
              {isConfirmed && (
                <TableHead className="text-xs font-medium">Diferencia</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items && items.length > 0 ? (
              items.map((item) => {
                const hasDifference = isConfirmed && item.cantidadCargada !== item.cantidad;
                return (
                  <TableRow key={item.id} className={hasDifference ? 'bg-yellow-50' : ''}>
                    <TableCell className="text-sm font-mono text-center">
                      {item.secuencia || '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>
                        <p className="font-medium">{item.product?.name || 'Producto sin nombre'}</p>
                        {item.product?.codigo && (
                          <p className="text-xs text-muted-foreground">Código: {item.product.codigo}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      <span className="font-medium">{item.cantidad}</span>
                      {item.saleItem?.unidadMedida && (
                        <span className="text-xs text-muted-foreground ml-1">
                          {item.saleItem.unidadMedida}
                        </span>
                      )}
                    </TableCell>
                    {isConfirmed && (
                      <TableCell className="text-sm text-center">
                        {item.cantidadCargada !== null ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className={`font-medium ${hasDifference ? 'text-orange-600' : ''}`}>
                              {item.cantidadCargada}
                            </span>
                            {hasDifference && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-orange-100 text-orange-700 border-orange-200">
                                ±
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-sm text-center">
                      {item.pesoUnitario ? (
                        <div className="flex items-center justify-center gap-1 text-muted-foreground">
                          <Scale className="w-3 h-3" />
                          <span>{item.pesoUnitario} kg</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      {item.volumenUnitario ? (
                        <div className="flex items-center justify-center gap-1 text-muted-foreground">
                          <Box className="w-3 h-3" />
                          <span>{item.volumenUnitario} m³</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.posicion ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          <span className="font-mono text-xs">{item.posicion}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    {isConfirmed && (
                      <TableCell className="text-xs">
                        {item.motivoDiferencia && (
                          <div className="text-orange-700 bg-orange-50 p-1 rounded">
                            {item.motivoDiferencia}
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={isConfirmed ? 8 : 6} className="text-center py-8 text-muted-foreground">
                  No hay items en esta orden de carga
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {items && items.length > 0 && (
          <div className="mt-4 flex justify-end">
            <div className="space-y-2 min-w-[250px]">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total items:</span>
                <span className="font-medium">{items.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cantidad total solicitada:</span>
                <span className="font-medium">
                  {items.reduce((sum, item) => sum + (item.cantidad || 0), 0)}
                </span>
              </div>
              {isConfirmed && (
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-muted-foreground">Cantidad total cargada:</span>
                  <span className="font-bold">
                    {items.reduce((sum, item) => sum + (item.cantidadCargada || 0), 0)}
                  </span>
                </div>
              )}
              {items.some(item => item.pesoUnitario) && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Peso estimado total:</span>
                  <span>
                    {items.reduce(
                      (sum, item) =>
                        sum + (item.pesoUnitario || 0) * (isConfirmed ? (item.cantidadCargada || 0) : (item.cantidad || 0)),
                      0
                    ).toFixed(2)} kg
                  </span>
                </div>
              )}
              {items.some(item => item.volumenUnitario) && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Volumen estimado total:</span>
                  <span>
                    {items.reduce(
                      (sum, item) =>
                        sum + (item.volumenUnitario || 0) * (isConfirmed ? (item.cantidadCargada || 0) : (item.cantidad || 0)),
                      0
                    ).toFixed(3)} m³
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
