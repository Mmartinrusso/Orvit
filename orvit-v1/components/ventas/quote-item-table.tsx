'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { QuoteItem } from '@/lib/types/sales';

interface QuoteItemTableProps {
  items: QuoteItem[];
  onUpdateItem: (itemId: string, updates: Partial<QuoteItem>) => void;
  onRemoveItem: (itemId: string) => void;
}

export function QuoteItemTable({ items, onUpdateItem, onRemoveItem }: QuoteItemTableProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const hasInsufficientStock = (item: QuoteItem) => {
    return item.quantity > item.product.currentStock;
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No hay productos en la cotización
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Producto</TableHead>
          <TableHead>Cantidad</TableHead>
          <TableHead>Precio Unit.</TableHead>
          <TableHead>Descuento %</TableHead>
          <TableHead>Subtotal</TableHead>
          <TableHead>Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <div>
                  <p className="font-medium">{item.product.name}</p>
                  <p className="text-sm text-muted-foreground">{item.product.code}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Stock: {item.product.currentStock} {item.product.unit}</span>
                    {item.product.category === 'bloques' && item.product.blocksPerM2 && (
                      <>
                        <span>•</span>
                        <span className="text-info-muted-foreground">{item.product.blocksPerM2} /m²</span>
                      </>
                    )}
                    <span>•</span>
                    <span>Costo: {formatCurrency(item.product.costPrice)}</span>
                    <span>•</span>
                    <span className="text-success">Margen: {(((item.unitPrice - item.product.costPrice) / item.product.costPrice) * 100).toFixed(1)}%</span>
                  </div>
                </div>
                {hasInsufficientStock(item) && (
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <Badge variant="destructive" className="text-xs">
                      Sin stock
                    </Badge>
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Input
                type="number"
                value={item.quantity}
                onChange={(e) => {
                  const value = e.target.value;
                  // Evitar ceros adelante y valores menores a 1
                  if (value === '' || (value !== '0' && !value.startsWith('0') && Number(value) >= 1)) {
                    onUpdateItem(item.id, { quantity: Number(value) || 1 });
                  }
                }}
                className={cn('w-20', hasInsufficientStock(item) && 'border-destructive')}
                min="1"
              />
            </TableCell>
            <TableCell>
              <Input
                type="number"
                value={item.unitPrice}
                onChange={(e) => {
                  const value = e.target.value;
                  // Evitar ceros adelante
                  if (value === '' || (value !== '0' && !value.startsWith('0'))) {
                    onUpdateItem(item.id, { unitPrice: Number(value) || 0 });
                  }
                }}
                className="w-28"
                min="0"
                step="0.01"
              />
            </TableCell>
            <TableCell>
              <Input
                type="number"
                value={item.discount}
                onChange={(e) => {
                  const value = e.target.value;
                  // Evitar ceros adelante y valores mayores a 100
                  if (value === '' || (value !== '0' && !value.startsWith('0') && Number(value) <= 100)) {
                    onUpdateItem(item.id, { discount: Number(value) || 0 });
                  }
                }}
                className="w-20"
                min="0"
                max="100"
              />
            </TableCell>
            <TableCell className="font-medium">
              {formatCurrency(item.subtotal)}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveItem(item.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
} 