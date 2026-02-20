'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Recipe } from '@/hooks/use-recetas';
import {
  Eye, Edit, Trash2, ToggleLeft, ToggleRight, MoreHorizontal,
  Copy, Send, FileText, Package, Scale, Layers, ChevronRight,
  DollarSign, Hash
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecetaCardV2Props {
  recipe: Recipe;
  price?: number;
  userColors: any;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
}

export default function RecetaCardV2({
  recipe,
  price = 0,
  userColors,
  onView,
  onEdit,
  onDelete,
  onToggleStatus,
}: RecetaCardV2Props) {

  // Format base type label
  const getBaseTypeLabel = (baseType: string) => {
    switch (baseType) {
      case 'PER_BATCH': return 'Por Batea';
      case 'PER_BANK': return 'Por Banco';
      case 'PER_M3': return 'Por M³';
      default: return baseType;
    }
  };

  // Get base type color
  const getBaseTypeColor = (baseType: string) => {
    switch (baseType) {
      case 'PER_BATCH': return 'bg-info-muted text-info-muted-foreground border-info-muted';
      case 'PER_BANK': return 'bg-info-muted text-info-muted-foreground border-info-muted';
      case 'PER_M3': return 'bg-info-muted text-info-muted-foreground border-info-muted';
      default: return 'bg-muted text-foreground border-border';
    }
  };

  // Calculate cost per unit
  const getCostPerUnit = () => {
    if (recipe.baseType === 'PER_BANK' && recipe.metrosUtiles) {
      return price / recipe.metrosUtiles;
    }
    if (recipe.outputQuantity) {
      return price / recipe.outputQuantity;
    }
    return price;
  };

  // Get unit label for cost
  const getUnitLabel = () => {
    if (recipe.baseType === 'PER_BANK') {
      return 'metro';
    }
    return 'unidad';
  };

  const costPerUnit = getCostPerUnit();

  return (
    <Card className={cn(
      "group hover:shadow-md transition-all duration-200",
      !recipe.isActive && "opacity-60"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Left side - Main info */}
          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate">{recipe.name}</h3>
                <p className="text-sm text-muted-foreground truncate">
                  {recipe.productName || recipe.subcategoryName || 'Sin producto'}
                  {recipe.version && ` • Versión ${recipe.version}`}
                </p>
              </div>

              {/* Status badge */}
              <Badge
                variant={recipe.isActive ? "default" : "secondary"}
                className={cn(
                  "shrink-0",
                  recipe.isActive && "bg-success hover:bg-success/90"
                )}
              >
                {recipe.isActive ? 'Activa' : 'Inactiva'}
              </Badge>
            </div>

            {/* Tags row */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="outline" className={getBaseTypeColor(recipe.baseType)}>
                <Scale className="h-3 w-3 mr-1" />
                {getBaseTypeLabel(recipe.baseType)}
              </Badge>

              {recipe.ingredientCount !== undefined && (
                <Badge variant="outline">
                  <Package className="h-3 w-3 mr-1" />
                  {recipe.ingredientCount} insumos
                </Badge>
              )}

              {recipe.baseType === 'PER_BANK' && recipe.metrosUtiles && (
                <Badge variant="outline" className="bg-info-muted text-info-muted-foreground border-info-muted">
                  <Layers className="h-3 w-3 mr-1" />
                  {recipe.metrosUtiles}m
                  {recipe.cantidadPastones && ` / ${recipe.cantidadPastones} pastones`}
                </Badge>
              )}

              {recipe.outputQuantity && recipe.baseType !== 'PER_BANK' && (
                <Badge variant="outline">
                  <Hash className="h-3 w-3 mr-1" />
                  {recipe.outputQuantity} {recipe.outputUnitLabel || 'unidades'}
                </Badge>
              )}

              {recipe.notes && (
                <Badge variant="outline" className="bg-warning-muted text-warning-muted-foreground border-warning-muted">
                  <FileText className="h-3 w-3 mr-1" />
                  Con notas
                </Badge>
              )}
            </div>

            {/* Cost row */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Costo por {getUnitLabel()}:</span>
                <span className="font-semibold text-success">
                  ${costPerUnit.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {price > 0 && recipe.baseType === 'PER_BANK' && (
                <div className="text-sm text-muted-foreground">
                  Total banco: ${price.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </div>
              )}
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Quick actions visible on hover */}
            <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={onView}
                className="h-8 px-2"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                className="h-8 px-2"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleStatus}
                className={cn(
                  "h-8 px-2",
                  recipe.isActive
                    ? "text-success hover:text-success hover:bg-success-muted"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {recipe.isActive ? (
                  <ToggleRight className="h-4 w-4" />
                ) : (
                  <ToggleLeft className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* More actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onView}>
                  <Eye className="h-4 w-4 mr-2" />
                  Ver detalles
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleStatus}>
                  {recipe.isActive ? (
                    <>
                      <ToggleLeft className="h-4 w-4 mr-2" />
                      Desactivar
                    </>
                  ) : (
                    <>
                      <ToggleRight className="h-4 w-4 mr-2" />
                      Activar
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
