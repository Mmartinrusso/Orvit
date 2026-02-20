'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Package,
  Wrench,
  Box,
  Cog,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  ArrowUp,
  ArrowDown,
  QrCode,
  MapPin,
  AlertTriangle,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Tool {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  itemType: 'TOOL' | 'SUPPLY' | 'SPARE_PART' | 'HAND_TOOL';
  category: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  stockQuantity: number;
  minStockLevel: number;
  location: string | null;
  status: string;
  cost: number | null;
  isCritical?: boolean;
  updatedAt: string;
}

export type ViewMode = 'grid' | 'list' | 'table';

interface ToolGridProps {
  tools: Tool[];
  isLoading?: boolean;
  viewMode?: ViewMode;
  onView?: (tool: Tool) => void;
  onEdit?: (tool: Tool) => void;
  onDelete?: (tool: Tool) => void;
  onStockIn?: (tool: Tool) => void;
  onStockOut?: (tool: Tool) => void;
  onGenerateQR?: (tool: Tool) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

const ITEM_TYPE_CONFIG = {
  TOOL: { label: 'Herramienta', icon: Wrench, color: 'bg-info', iconBg: 'bg-info-muted', iconColor: 'text-info-muted-foreground' },
  SUPPLY: { label: 'Insumo', icon: Box, color: 'bg-success', iconBg: 'bg-success-muted', iconColor: 'text-success' },
  SPARE_PART: { label: 'Repuesto', icon: Cog, color: 'bg-purple-500', iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
  HAND_TOOL: { label: 'Herramienta Manual', icon: Wrench, color: 'bg-warning', iconBg: 'bg-warning-muted', iconColor: 'text-warning-muted-foreground' },
};

export function ToolGrid({
  tools,
  isLoading = false,
  viewMode = 'grid',
  onView,
  onEdit,
  onDelete,
  onStockIn,
  onStockOut,
  onGenerateQR,
  canEdit = false,
  canDelete = false,
}: ToolGridProps) {

  const getStockStatus = (tool: Tool) => {
    if (tool.stockQuantity === 0) {
      return { label: 'Sin Stock', color: 'bg-destructive', textColor: 'text-destructive', badgeVariant: 'destructive' as const };
    }
    if (tool.stockQuantity <= tool.minStockLevel) {
      return { label: 'Stock Bajo', color: 'bg-warning', textColor: 'text-warning-muted-foreground', badgeVariant: 'secondary' as const };
    }
    return { label: 'OK', color: 'bg-success', textColor: 'text-success', badgeVariant: 'default' as const };
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-12 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-8 flex-1" />
                <Skeleton className="h-8 flex-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Empty state
  if (tools.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg bg-muted/30">
        <Package className="h-12 w-12 text-muted-foreground mb-3" />
        <h3 className="font-medium text-lg mb-1">No hay items</h3>
        <p className="text-muted-foreground text-sm">
          No se encontraron items con los filtros actuales
        </p>
      </div>
    );
  }

  // Table View
  if (viewMode === 'table') {
    return (
      <div className="rounded-lg border overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead className="w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tools.map((tool) => {
              const typeConfig = ITEM_TYPE_CONFIG[tool.itemType] || ITEM_TYPE_CONFIG.TOOL;
              const TypeIcon = typeConfig.icon;
              const stockStatus = getStockStatus(tool);

              return (
                <TableRow
                  key={tool.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onView?.(tool)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', typeConfig.iconBg)}>
                        <TypeIcon className={cn('h-4 w-4', typeConfig.iconColor)} />
                      </div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {tool.name}
                          {tool.isCritical && <AlertTriangle className="h-3 w-3 text-destructive" />}
                        </div>
                        {tool.code && (
                          <div className="text-xs text-muted-foreground font-mono">{tool.code}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{typeConfig.label}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{tool.category || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{tool.location || '—'}</TableCell>
                  <TableCell className="text-center">
                    <span className={cn('font-bold text-lg', stockStatus.textColor)}>
                      {tool.stockQuantity}
                    </span>
                    <span className="text-muted-foreground text-xs ml-1">/ {tool.minStockLevel}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={stockStatus.badgeVariant}>{stockStatus.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {tool.cost ? `$${tool.cost.toLocaleString()}` : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-success hover:text-success hover:bg-success-muted"
                        onClick={(e) => { e.stopPropagation(); onStockIn?.(tool); }}
                        title="Entrada"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => { e.stopPropagation(); onStockOut?.(tool); }}
                        disabled={tool.stockQuantity === 0}
                        title="Salida"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onView?.(tool)}>
                            <Eye className="h-4 w-4 mr-2" /> Ver detalles
                          </DropdownMenuItem>
                          {canEdit && onEdit && (
                            <DropdownMenuItem onClick={() => onEdit(tool)}>
                              <Edit className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                          )}
                          {onGenerateQR && (
                            <DropdownMenuItem onClick={() => onGenerateQR(tool)}>
                              <QrCode className="h-4 w-4 mr-2" /> Código QR
                            </DropdownMenuItem>
                          )}
                          {canDelete && onDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => onDelete(tool)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  // List View
  if (viewMode === 'list') {
    return (
      <div className="space-y-2">
        {tools.map((tool) => {
          const typeConfig = ITEM_TYPE_CONFIG[tool.itemType] || ITEM_TYPE_CONFIG.TOOL;
          const TypeIcon = typeConfig.icon;
          const stockStatus = getStockStatus(tool);

          return (
            <Card
              key={tool.id}
              className="cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => onView?.(tool)}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className={cn('h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0', typeConfig.iconBg)}>
                    <TypeIcon className={cn('h-6 w-6', typeConfig.iconColor)} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{tool.name}</h3>
                      {tool.isCritical && (
                        <Badge variant="destructive" className="text-xs h-5">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Crítico
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <Badge variant="outline" className="text-xs h-5">{typeConfig.label}</Badge>
                      {tool.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {tool.location}
                        </span>
                      )}
                      {tool.code && <span className="font-mono">{tool.code}</span>}
                    </div>
                  </div>

                  {/* Stock */}
                  <div className="text-right flex-shrink-0 px-4">
                    <p className={cn('text-2xl font-bold', stockStatus.textColor)}>
                      {tool.stockQuantity}
                    </p>
                    <p className="text-xs text-muted-foreground">Mín: {tool.minStockLevel}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-success hover:text-success hover:bg-success-muted border-success-muted"
                      onClick={(e) => { e.stopPropagation(); onStockIn?.(tool); }}
                    >
                      <ArrowUp className="h-4 w-4 mr-1" />
                      Entrada
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                      onClick={(e) => { e.stopPropagation(); onStockOut?.(tool); }}
                      disabled={tool.stockQuantity === 0}
                    >
                      <ArrowDown className="h-4 w-4 mr-1" />
                      Salida
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView?.(tool)}>
                          <Eye className="h-4 w-4 mr-2" /> Ver detalles
                        </DropdownMenuItem>
                        {canEdit && onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(tool)}>
                            <Edit className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                        )}
                        {onGenerateQR && (
                          <DropdownMenuItem onClick={() => onGenerateQR(tool)}>
                            <QrCode className="h-4 w-4 mr-2" /> Código QR
                          </DropdownMenuItem>
                        )}
                        {canDelete && onDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(tool)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // Grid View (default)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {tools.map((tool) => {
        const typeConfig = ITEM_TYPE_CONFIG[tool.itemType] || ITEM_TYPE_CONFIG.TOOL;
        const TypeIcon = typeConfig.icon;
        const stockStatus = getStockStatus(tool);

        return (
          <Card
            key={tool.id}
            className="group overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer"
            onClick={() => onView?.(tool)}
          >
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0', typeConfig.iconBg)}>
                    <TypeIcon className={cn('h-5 w-5', typeConfig.iconColor)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate pr-2">{tool.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px] h-5">{typeConfig.label}</Badge>
                      {tool.isCritical && (
                        <Badge variant="destructive" className="text-[10px] h-5">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                          Crítico
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 -mr-2 -mt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView?.(tool)}>
                      <Eye className="h-4 w-4 mr-2" /> Ver detalles
                    </DropdownMenuItem>
                    {canEdit && onEdit && (
                      <DropdownMenuItem onClick={() => onEdit(tool)}>
                        <Edit className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                    )}
                    {onGenerateQR && (
                      <DropdownMenuItem onClick={() => onGenerateQR(tool)}>
                        <QrCode className="h-4 w-4 mr-2" /> Código QR
                      </DropdownMenuItem>
                    )}
                    {canDelete && onDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => onDelete(tool)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Details */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {tool.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {tool.location}
                  </span>
                )}
                {tool.code && (
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{tool.code}</span>
                )}
              </div>

              {/* Stock */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Stock actual</p>
                  <p className={cn('text-3xl font-bold', stockStatus.textColor)}>
                    {tool.stockQuantity}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={stockStatus.badgeVariant} className="mb-1">
                    {stockStatus.label}
                  </Badge>
                  <p className="text-xs text-muted-foreground">Mín: {tool.minStockLevel}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                  onClick={(e) => { e.stopPropagation(); onStockIn?.(tool); }}
                >
                  <ArrowUp className="h-4 w-4 mr-1" />
                  Entrada
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  onClick={(e) => { e.stopPropagation(); onStockOut?.(tool); }}
                  disabled={tool.stockQuantity === 0}
                >
                  <ArrowDown className="h-4 w-4 mr-1" />
                  Salida
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default ToolGrid;
