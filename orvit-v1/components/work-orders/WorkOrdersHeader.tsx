'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  RefreshCw,
  MoreVertical,
  Download,
  Settings,
  Plus,
  Printer,
  FileText,
  Menu,
} from 'lucide-react';
import { WorkOrdersViewSelector } from './WorkOrdersViewSelector';

interface WorkOrdersHeaderProps {
  totalCount: number;
  filteredCount: number;
  onRefresh: () => void;
  onExport?: () => void;
  onPrint?: () => void;
  onCreateOrder?: () => void;
  canCreate?: boolean;
  refreshing?: boolean;
  className?: string;
  showViewSelector?: boolean;
}

export function WorkOrdersHeader({
  totalCount,
  filteredCount,
  onRefresh,
  onExport,
  onPrint,
  onCreateOrder,
  canCreate = false,
  refreshing = false,
  className,
  showViewSelector = true,
}: WorkOrdersHeaderProps) {
  const hasFilters = filteredCount !== totalCount;

  return (
    <div className="sticky top-0 z-20 border-b border-border/60 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-16 items-center justify-between px-4 md:px-6 gap-4">
        {/* Lado izquierdo: Título y contador */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-semibold tracking-tight text-foreground truncate">
              Órdenes de Trabajo
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
              Gestiona y supervisa todas las órdenes
            </p>
          </div>
          <Badge
            variant="secondary"
            className="text-xs font-medium tabular-nums shrink-0"
          >
            {hasFilters ? (
              <span>
                <span className="font-semibold">{filteredCount}</span>
                <span className="text-muted-foreground mx-1">/</span>
                <span>{totalCount}</span>
              </span>
            ) : (
              <span>{totalCount} totales</span>
            )}
          </Badge>
        </div>

        {/* Centro: View selector */}
        {showViewSelector && (
          <div className="hidden md:flex flex-1 justify-center">
            <WorkOrdersViewSelector />
          </div>
        )}

        {/* Lado derecho: Acciones */}
        <div className="flex gap-2 flex-wrap sm:flex-nowrap items-center">
          {/* Botón Nueva Orden de Trabajo */}
          {canCreate && onCreateOrder && (
            <Button
              onClick={onCreateOrder}
              size="lg"
              className="items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 rounded-md px-3 bg-black hover:bg-gray-800 text-white hidden sm:inline-flex text-xs"
            >
              <Plus className="h-3 w-3 mr-2" />
              <span className="hidden lg:inline">Nueva Orden de Trabajo</span>
              <span className="lg:hidden">Nueva OT</span>
            </Button>
          )}

          {/* Menú compacto para móvil */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="lg" className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md px-3 md:hidden">
                <Menu className="h-4 w-4 mr-2" />
                Acciones
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {canCreate && onCreateOrder && (
                <DropdownMenuItem onClick={onCreateOrder}>
                  <Plus className="h-4 w-4 mr-2" /> Nueva Orden de Trabajo
                </DropdownMenuItem>
              )}
              {onExport && (
                <DropdownMenuItem onClick={onExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar datos
                </DropdownMenuItem>
              )}
              {onPrint && (
                <DropdownMenuItem onClick={onPrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir lista
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
