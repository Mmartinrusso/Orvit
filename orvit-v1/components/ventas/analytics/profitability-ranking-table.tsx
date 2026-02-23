'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';

interface ProductMetrics {
  position: number;
  product: {
    id: string;
    name: string;
    code: string;
    category: {
      id: number;
      name: string;
    } | null;
  };
  metrics: {
    totalSales: number;
    quantitySold: number;
    averageMargin: number;
    contribution: number;
    turnoverRate: number;
    velocity: 'ALTA' | 'MEDIA' | 'BAJA';
  };
  alerts: string[];
}

interface ProfitabilityRankingTableProps {
  products: ProductMetrics[];
  sortBy: string;
  onSortChange?: (field: string) => void;
  onProductSelect?: (productId: string) => void;
}

export function ProfitabilityRankingTable({
  products,
  sortBy,
  onSortChange,
  onProductSelect,
}: ProfitabilityRankingTableProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getVelocityBadge = (velocity: 'ALTA' | 'MEDIA' | 'BAJA') => {
    const config = {
      ALTA: { label: 'Alta', variant: 'default' as const, className: 'bg-success-muted text-success-muted-foreground' },
      MEDIA: { label: 'Media', variant: 'secondary' as const, className: 'bg-info-muted text-info-muted-foreground' },
      BAJA: { label: 'Baja', variant: 'outline' as const, className: 'bg-muted text-foreground' },
    };
    const { label, className } = config[velocity];
    return (
      <Badge variant="outline" className={cn('text-xs', className)}>
        {label}
      </Badge>
    );
  };

  const getMarginIcon = (margin: number) => {
    if (margin >= 40) return <TrendingUp className="w-4 h-4 text-success" />;
    if (margin >= 20) return <Minus className="w-4 h-4 text-primary" />;
    return <TrendingDown className="w-4 h-4 text-destructive" />;
  };

  const getMarginColor = (margin: number) => {
    if (margin >= 40) return 'text-success font-semibold';
    if (margin >= 20) return 'text-primary';
    if (margin >= 0) return 'text-warning-muted-foreground';
    return 'text-destructive font-semibold';
  };

  const SortButton = ({ field, label }: { field: string; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onSortChange?.(field)}
      className="h-8 px-2 lg:px-3"
    >
      {label}
      <ArrowUpDown className="ml-2 h-3 w-3" />
    </Button>
  );

  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No se encontraron productos con los filtros seleccionados</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 text-center">#</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead className="text-center">Categoría</TableHead>
            <TableHead className="text-right">
              <SortButton field="ventas" label="Ventas" />
            </TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead className="text-right">
              <SortButton field="margen" label="Margen" />
            </TableHead>
            <TableHead className="text-right">
              <SortButton field="contribucion" label="Contribución" />
            </TableHead>
            <TableHead className="text-right">
              <SortButton field="rotacion" label="Rotación" />
            </TableHead>
            <TableHead className="text-center">Velocidad</TableHead>
            <TableHead className="text-center">Alertas</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((item) => (
            <TableRow
              key={item.product.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => onProductSelect?.(item.product.id)}
            >
              {/* Posición */}
              <TableCell className="text-center font-medium">
                {item.position <= 3 ? (
                  <Badge variant="default" className="text-xs">
                    {item.position}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">{item.position}</span>
                )}
              </TableCell>

              {/* Producto */}
              <TableCell>
                <div>
                  <p className="font-medium">{item.product.name}</p>
                  <p className="text-xs text-muted-foreground">{item.product.code}</p>
                </div>
              </TableCell>

              {/* Categoría */}
              <TableCell className="text-center">
                {item.product.category ? (
                  <Badge variant="outline" className="text-xs">
                    {item.product.category.name}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">Sin categoría</span>
                )}
              </TableCell>

              {/* Ventas */}
              <TableCell className="text-right font-medium">
                {formatCurrency(item.metrics.totalSales)}
              </TableCell>

              {/* Cantidad */}
              <TableCell className="text-right">
                {formatNumber(item.metrics.quantitySold, 2)}
              </TableCell>

              {/* Margen */}
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {getMarginIcon(item.metrics.averageMargin)}
                  <span className={getMarginColor(item.metrics.averageMargin)}>
                    {formatNumber(item.metrics.averageMargin, 2)}%
                  </span>
                </div>
              </TableCell>

              {/* Contribución */}
              <TableCell className="text-right font-medium text-success">
                {formatCurrency(item.metrics.contribution)}
              </TableCell>

              {/* Rotación */}
              <TableCell className="text-right">
                {formatNumber(item.metrics.turnoverRate, 2)}x
              </TableCell>

              {/* Velocidad */}
              <TableCell className="text-center">
                {getVelocityBadge(item.metrics.velocity)}
              </TableCell>

              {/* Alertas */}
              <TableCell className="text-center">
                {item.alerts.length > 0 ? (
                  <Badge variant="destructive" className="text-xs">
                    {item.alerts.length}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>

              {/* Acción */}
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onProductSelect?.(item.product.id);
                  }}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
