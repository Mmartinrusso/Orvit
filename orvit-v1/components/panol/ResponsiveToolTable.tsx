'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Package,
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  Wrench,
  Box,
  Cog,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Tool {
  id: number;
  name: string;
  code?: string | null;
  itemType: string;
  category?: string | null;
  stockQuantity: number;
  minStockLevel: number;
  location?: string | null;
  status?: string;
  isCritical?: boolean;
  cost?: number | null;
}

export interface ResponsiveToolTableProps {
  tools: Tool[];
  onView?: (tool: Tool) => void;
  onEdit?: (tool: Tool) => void;
  onDelete?: (tool: Tool) => void;
  onStockIn?: (tool: Tool) => void;
  onStockOut?: (tool: Tool) => void;

  // Selection
  selectionMode?: boolean;
  selectedIds?: number[];
  onToggleSelection?: (id: number) => void;
  onSelectAll?: () => void;

  // Display
  showCategory?: boolean;
  showLocation?: boolean;
  showCost?: boolean;
  emptyMessage?: string;

  // Permissions
  canEdit?: boolean;
  canDelete?: boolean;
  canManageStock?: boolean;

  // Colors
  userColors?: {
    kpiPositive: string;
    kpiNegative: string;
    chart4: string;
  };
}

const defaultColors = {
  kpiPositive: '#10b981',
  kpiNegative: '#ef4444',
  chart4: '#f59e0b',
};

const ITEM_TYPE_ICONS: Record<string, React.ElementType> = {
  TOOL: Wrench,
  SUPPLY: Box,
  SPARE_PART: Cog,
  HAND_TOOL: Wrench,
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  TOOL: 'Herramienta',
  SUPPLY: 'Insumo',
  SPARE_PART: 'Repuesto',
  HAND_TOOL: 'Herr. Manual',
};

export function ResponsiveToolTable({
  tools,
  onView,
  onEdit,
  onDelete,
  onStockIn,
  onStockOut,
  selectionMode = false,
  selectedIds = [],
  onToggleSelection,
  onSelectAll,
  showCategory = true,
  showLocation = true,
  showCost = false,
  emptyMessage = 'No hay items para mostrar',
  canEdit = true,
  canDelete = true,
  canManageStock = true,
  userColors = defaultColors,
}: ResponsiveToolTableProps) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  // Update on resize
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      setIsMobile(window.innerWidth < 768);
    });
  }

  const getStockStatus = (tool: Tool) => {
    if (tool.stockQuantity === 0) {
      return { label: 'Sin Stock', color: userColors.kpiNegative, variant: 'destructive' as const };
    }
    if (tool.stockQuantity <= tool.minStockLevel) {
      return { label: 'Stock Bajo', color: userColors.chart4, variant: 'secondary' as const };
    }
    return { label: 'OK', color: userColors.kpiPositive, variant: 'default' as const };
  };

  if (tools.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  // Mobile card view
  if (isMobile) {
    return (
      <div className="space-y-3">
        {tools.map((tool) => {
          const stockStatus = getStockStatus(tool);
          const ItemIcon = ITEM_TYPE_ICONS[tool.itemType] || Package;
          const isSelected = selectedIds.includes(tool.id);

          return (
            <Card
              key={tool.id}
              className={cn(
                'overflow-hidden transition-all',
                selectionMode && isSelected && 'ring-2 ring-primary',
                tool.stockQuantity === 0 && 'opacity-70'
              )}
              onClick={() => {
                if (selectionMode && onToggleSelection) {
                  onToggleSelection(tool.id);
                } else if (onView) {
                  onView(tool);
                }
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {selectionMode && onToggleSelection && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelection(tool.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1"
                    />
                  )}

                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${stockStatus.color}15` }}
                  >
                    <ItemIcon className="h-5 w-5" style={{ color: stockStatus.color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{tool.name}</h3>
                      {tool.isCritical && (
                        <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      {tool.code && <span>{tool.code}</span>}
                      <span>•</span>
                      <span>{ITEM_TYPE_LABELS[tool.itemType] || tool.itemType}</span>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={stockStatus.variant}>
                          Stock: {tool.stockQuantity}
                        </Badge>
                        {tool.minStockLevel > 0 && (
                          <span className="text-xs text-muted-foreground">
                            Mín: {tool.minStockLevel}
                          </span>
                        )}
                      </div>

                      {!selectionMode && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {onView && (
                              <DropdownMenuItem onClick={() => onView(tool)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver detalles
                              </DropdownMenuItem>
                            )}
                            {canEdit && onEdit && (
                              <DropdownMenuItem onClick={() => onEdit(tool)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {canManageStock && (
                              <>
                                <DropdownMenuSeparator />
                                {onStockIn && (
                                  <DropdownMenuItem onClick={() => onStockIn(tool)}>
                                    <ArrowUp className="h-4 w-4 mr-2 text-green-600" />
                                    Entrada de stock
                                  </DropdownMenuItem>
                                )}
                                {onStockOut && tool.stockQuantity > 0 && (
                                  <DropdownMenuItem onClick={() => onStockOut(tool)}>
                                    <ArrowDown className="h-4 w-4 mr-2 text-red-600" />
                                    Salida de stock
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                            {canDelete && onDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => onDelete(tool)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // Desktop table view
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {selectionMode && onSelectAll && (
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.length === tools.length && tools.length > 0}
                  onCheckedChange={onSelectAll}
                />
              </TableHead>
            )}
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            {showCategory && <TableHead>Categoría</TableHead>}
            {showLocation && <TableHead>Ubicación</TableHead>}
            <TableHead className="text-center">Stock</TableHead>
            <TableHead className="text-center">Mínimo</TableHead>
            <TableHead className="text-center">Estado</TableHead>
            {showCost && <TableHead className="text-right">Costo</TableHead>}
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tools.map((tool) => {
            const stockStatus = getStockStatus(tool);
            const ItemIcon = ITEM_TYPE_ICONS[tool.itemType] || Package;
            const isSelected = selectedIds.includes(tool.id);

            return (
              <TableRow
                key={tool.id}
                className={cn(
                  'cursor-pointer hover:bg-muted/50',
                  selectionMode && isSelected && 'bg-primary/5',
                  tool.stockQuantity === 0 && 'opacity-70'
                )}
                onClick={() => {
                  if (selectionMode && onToggleSelection) {
                    onToggleSelection(tool.id);
                  } else if (onView) {
                    onView(tool);
                  }
                }}
              >
                {selectionMode && onToggleSelection && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelection(tool.id)}
                    />
                  </TableCell>
                )}

                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{tool.name}</span>
                    {tool.isCritical && (
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        </TooltipTrigger>
                        <TooltipContent>Item crítico</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  {tool.code && (
                    <span className="text-xs text-muted-foreground">{tool.code}</span>
                  )}
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-2">
                    <ItemIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{ITEM_TYPE_LABELS[tool.itemType] || tool.itemType}</span>
                  </div>
                </TableCell>

                {showCategory && (
                  <TableCell className="text-sm">{tool.category || '-'}</TableCell>
                )}

                {showLocation && (
                  <TableCell className="text-sm">{tool.location || '-'}</TableCell>
                )}

                <TableCell className="text-center font-medium">{tool.stockQuantity}</TableCell>

                <TableCell className="text-center text-muted-foreground">
                  {tool.minStockLevel}
                </TableCell>

                <TableCell className="text-center">
                  <Badge
                    variant={stockStatus.variant}
                    style={{
                      backgroundColor: `${stockStatus.color}20`,
                      color: stockStatus.color,
                    }}
                  >
                    {stockStatus.label}
                  </Badge>
                </TableCell>

                {showCost && (
                  <TableCell className="text-right">
                    {tool.cost ? `$${tool.cost.toLocaleString()}` : '-'}
                  </TableCell>
                )}

                <TableCell onClick={(e) => e.stopPropagation()}>
                  {!selectionMode && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onView && (
                          <DropdownMenuItem onClick={() => onView(tool)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalles
                          </DropdownMenuItem>
                        )}
                        {canEdit && onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(tool)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                        )}
                        {canManageStock && (
                          <>
                            <DropdownMenuSeparator />
                            {onStockIn && (
                              <DropdownMenuItem onClick={() => onStockIn(tool)}>
                                <ArrowUp className="h-4 w-4 mr-2 text-green-600" />
                                Entrada
                              </DropdownMenuItem>
                            )}
                            {onStockOut && tool.stockQuantity > 0 && (
                              <DropdownMenuItem onClick={() => onStockOut(tool)}>
                                <ArrowDown className="h-4 w-4 mr-2 text-red-600" />
                                Salida
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                        {canDelete && onDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onDelete(tool)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default ResponsiveToolTable;
