'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ClipboardList,
  PackageCheck,
  RotateCcw,
  Package,
  History,
  Bookmark,
  Search,
  Plus,
  AlertTriangle,
  Inbox,
  type LucideIcon,
} from 'lucide-react';

type EmptyStateType =
  | 'solicitudes'
  | 'despachos'
  | 'devoluciones'
  | 'inventario'
  | 'kardex'
  | 'reservas'
  | 'search'
  | 'error'
  | 'generic';

interface EmptyStateProps {
  type: EmptyStateType;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

const defaultContent: Record<
  EmptyStateType,
  { icon: LucideIcon; title: string; description: string }
> = {
  solicitudes: {
    icon: ClipboardList,
    title: 'No hay solicitudes',
    description: 'No se encontraron solicitudes de material. Crea una nueva solicitud para comenzar.',
  },
  despachos: {
    icon: PackageCheck,
    title: 'No hay despachos',
    description: 'No se encontraron despachos. Los despachos se crean a partir de solicitudes aprobadas.',
  },
  devoluciones: {
    icon: RotateCcw,
    title: 'No hay devoluciones',
    description: 'No se encontraron devoluciones registradas.',
  },
  inventario: {
    icon: Package,
    title: 'Inventario vacío',
    description: 'No hay items en el inventario para los filtros seleccionados.',
  },
  kardex: {
    icon: History,
    title: 'Sin movimientos',
    description: 'No se encontraron movimientos de stock para los filtros seleccionados.',
  },
  reservas: {
    icon: Bookmark,
    title: 'Sin reservas',
    description: 'No hay reservas de stock activas.',
  },
  search: {
    icon: Search,
    title: 'Sin resultados',
    description: 'No se encontraron resultados para tu búsqueda. Intenta con otros términos.',
  },
  error: {
    icon: AlertTriangle,
    title: 'Error al cargar',
    description: 'Ocurrió un error al cargar los datos. Por favor, intenta nuevamente.',
  },
  generic: {
    icon: Inbox,
    title: 'Sin datos',
    description: 'No hay datos disponibles.',
  },
};

/**
 * Componente de estado vacío reutilizable
 */
export function EmptyState({
  type,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const defaults = defaultContent[type];
  const Icon = defaults.icon;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>

      <h3 className="text-lg font-medium text-foreground mb-1">
        {title || defaults.title}
      </h3>

      <p className="text-sm text-muted-foreground max-w-md mb-6">
        {description || defaults.description}
      </p>

      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.icon ? (
            <action.icon className="h-4 w-4 mr-2" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          {action.label}
        </Button>
      )}
    </div>
  );
}

/**
 * Estado vacío para errores
 */
export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      type="error"
      description={message}
      action={
        onRetry
          ? {
              label: 'Reintentar',
              onClick: onRetry,
            }
          : undefined
      }
      className={className}
    />
  );
}

/**
 * Estado vacío para búsquedas sin resultados
 */
export function NoResultsState({
  searchTerm,
  onClear,
  className,
}: {
  searchTerm?: string;
  onClear?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      type="search"
      description={
        searchTerm
          ? `No se encontraron resultados para "${searchTerm}"`
          : 'No se encontraron resultados para tu búsqueda'
      }
      action={
        onClear
          ? {
              label: 'Limpiar búsqueda',
              onClick: onClear,
            }
          : undefined
      }
      className={className}
    />
  );
}
