'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Eye,
  FileText,
  CheckCircle,
  Link as LinkIcon,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Pencil,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { FailureFilters } from './FailureFiltersBar';
import { cn } from '@/lib/utils';

// Pagination defaults
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface FailureOccurrence {
  id: number;
  title: string;
  description?: string;
  priority: string;
  status: string;
  causedDowntime: boolean;
  isIntermittent: boolean;
  isSafetyRelated?: boolean;
  reportedAt: string;
  symptoms?: number[];
  affectedComponents?: number[] | { componentIds?: number[]; subcomponentIds?: number[] };
  // Nuevos campos expandidos desde la API
  affectedComponentsList?: Array<{ id: number; name: string }>;
  affectedSubcomponentsList?: Array<{ id: number; name: string }>;
  // Síntomas expandidos
  symptomsList?: Array<{ id: number; label: string }>;
  machine?: {
    id: number;
    name: string;
  };
  component?: {
    id: number;
    name: string;
  };
  workOrder?: {
    id: number;
    status: string;
    component?: {
      id: number;
      name: string;
    };
  };
  workOrders?: Array<{
    id: number;
    status: string;
  }>;
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface FailureListResponse {
  data: FailureOccurrence[];
  pagination: PaginationInfo;
}

interface FailureListTableProps {
  filters?: FailureFilters;
  onSelectFailure?: (id: number) => void;
  onCreateWorkOrder?: (failureId: number) => void;
  onResolveFailure?: (failureId: number) => void;
  onLinkDuplicate?: (failureId: number) => void;
  onEditFailure?: (failureId: number) => void;
  onDeleteFailure?: (failureId: number) => void;
  // Permisos opcionales
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

const priorityColors: Record<string, string> = {
  P1: 'bg-red-500',
  P2: 'bg-orange-500',
  P3: 'bg-yellow-500',
  P4: 'bg-blue-500',
  URGENT: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-blue-500',
};

const statusColors: Record<string, string> = {
  REPORTED: 'bg-blue-100 text-blue-800',
  OPEN: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<string, string> = {
  REPORTED: 'Reportada',
  OPEN: 'Abierta',
  IN_PROGRESS: 'En Proceso',
  RESOLVED: 'Resuelta',
  CANCELLED: 'Cancelada',
};

// Build query string from filters with pagination
function buildQueryString(
  filters?: FailureFilters,
  pagination?: { offset: number; limit: number }
): string {
  const params = new URLSearchParams();

  // Pagination params
  if (pagination) {
    params.append('offset', pagination.offset.toString());
    params.append('limit', pagination.limit.toString());
  }

  if (!filters) {
    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
  }

  if (filters.search) params.append('search', filters.search);
  if (filters.status?.length) params.append('status', filters.status.join(','));
  if (filters.machineId) params.append('machineId', filters.machineId.toString());
  if (filters.priority?.length) params.append('priority', filters.priority.join(','));
  if (filters.causedDowntime) params.append('causedDowntime', 'true');
  if (filters.isIntermittent) params.append('isIntermittent', 'true');
  if (filters.isObservation) params.append('isObservation', 'true');
  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.append('dateTo', filters.dateTo);
  if (filters.componentId) params.append('componentId', filters.componentId.toString());
  if (filters.subcomponentId) params.append('subcomponentId', filters.subcomponentId.toString());
  if (filters.reportedById) params.append('reportedById', filters.reportedById.toString());
  if (filters.hasWorkOrder !== undefined) params.append('hasWorkOrder', filters.hasWorkOrder.toString());
  if (filters.hasDuplicates !== undefined) params.append('hasDuplicates', filters.hasDuplicates.toString());

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Tabla de fallas del sistema correctivo
 * Filtra isLinkedDuplicate=false (solo casos principales)
 */
export function FailureListTable({
  filters,
  onSelectFailure,
  onCreateWorkOrder,
  onResolveFailure,
  onLinkDuplicate,
  onEditFailure,
  onDeleteFailure,
  canCreate = true, // Por defecto true para compatibilidad
  canEdit = true,   // Por defecto true para compatibilidad
  canDelete = false, // Por defecto false para seguridad
}: FailureListTableProps) {
  const router = useRouter();

  // Pagination state
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Calculate offset from current page
  const offset = (currentPage - 1) * pageSize;

  // Build query key that includes filters and pagination for cache separation
  const queryKey = ['failure-occurrences', filters, { offset, limit: pageSize }];

  const { data: response, isLoading } = useQuery<FailureListResponse>({
    queryKey,
    queryFn: async () => {
      const queryString = buildQueryString(filters, { offset, limit: pageSize });
      const res = await fetch(`/api/failure-occurrences${queryString}`);
      if (!res.ok) throw new Error('Error al cargar fallas');
      const json = await res.json();
      // Handle both old format (array) and new format (with pagination)
      if (Array.isArray(json)) {
        return {
          data: json,
          pagination: { total: json.length, limit: pageSize, offset: 0, hasMore: false },
        };
      }
      return {
        data: json.data || [],
        pagination: json.pagination || { total: json.data?.length || 0, limit: pageSize, offset: 0, hasMore: false },
      };
    },
  });

  // Extract data and pagination
  const data = response?.data || [];
  const pagination = response?.pagination;
  const totalCount = pagination?.total || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Pagination handlers
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToFirstPage = () => goToPage(1);
  const goToLastPage = () => goToPage(totalPages);
  const goToPrevPage = () => goToPage(currentPage - 1);
  const goToNextPage = () => goToPage(currentPage + 1);

  const handlePageSizeChange = (newSize: string) => {
    setPageSize(parseInt(newSize));
    setCurrentPage(1); // Reset to first page
  };

  // Handler para crear OT
  const handleCreateWorkOrder = (failureId: number) => {
    if (onCreateWorkOrder) {
      onCreateWorkOrder(failureId);
    } else {
      // Navegación por defecto
      router.push(`/mantenimiento/ordenes-trabajo/nueva?failureId=${failureId}`);
    }
  };

  // Handler para resolver
  const handleResolve = (failureId: number) => {
    if (onResolveFailure) {
      onResolveFailure(failureId);
    } else {
      // Por defecto, abrir el detalle
      onSelectFailure?.(failureId);
    }
  };

  // Handler para vincular duplicado
  const handleLinkDuplicate = (failureId: number) => {
    if (onLinkDuplicate) {
      onLinkDuplicate(failureId);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {filters && Object.keys(filters).length > 0
            ? 'No se encontraron fallas con los filtros aplicados'
            : 'No hay fallas registradas'}
        </p>
      </div>
    );
  }

  // Helper para formatear prioridad
  const formatPriority = (priority: string) => {
    if (priority?.startsWith('P')) return priority;
    const map: Record<string, string> = {
      URGENT: 'P1',
      HIGH: 'P2',
      MEDIUM: 'P3',
      LOW: 'P4',
    };
    return map[priority] || priority;
  };

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px] text-xs">P</TableHead>
              <TableHead className="text-xs">Título</TableHead>
              <TableHead className="text-xs">Máquina</TableHead>
              <TableHead className="text-xs">Componente</TableHead>
              <TableHead className="text-xs">Estado</TableHead>
              <TableHead className="text-xs">Reportada</TableHead>
              <TableHead className="text-right text-xs">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((failure) => {
              const displayPriority = formatPriority(failure.priority);
              // Componente principal puede venir directo o del workOrder
              const primaryComponent = failure.component ||
                                       failure.workOrder?.component ||
                                       (failure.affectedComponentsList?.[0]) ||
                                       null;
              const componentName = primaryComponent?.name || null;

              // Lista completa de componentes y subcomponentes afectados
              const allComponents = failure.affectedComponentsList || [];
              const allSubcomponents = failure.affectedSubcomponentsList || [];
              const hasMultipleAffected = allComponents.length > 1 || allSubcomponents.length > 0;

              const hasWorkOrder = (failure.workOrders?.length ?? 0) > 0 || !!failure.workOrder;
              const isResolved = failure.status === 'RESOLVED' || failure.status === 'CANCELLED';

              return (
                <TableRow
                  key={failure.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onSelectFailure?.(failure.id)}
                >
                  {/* Prioridad */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          priorityColors[failure.priority] || priorityColors[displayPriority] || 'bg-gray-400'
                        }`}
                      />
                      <span className="text-xs font-medium">
                        {displayPriority}
                      </span>
                    </div>
                  </TableCell>

                  {/* Título con badges */}
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">{failure.title}</span>
                      <div className="flex flex-wrap gap-1">
                        {failure.causedDowntime && (
                          <Badge variant="destructive" className="h-5 text-xs">
                            <Clock className="mr-1 h-3 w-3" />
                            Downtime
                          </Badge>
                        )}
                        {failure.isIntermittent && (
                          <Badge variant="outline" className="h-5 text-xs">
                            Intermitente
                          </Badge>
                        )}
                        {failure.isSafetyRelated && (
                          <Badge variant="destructive" className="h-5 text-xs">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Seguridad
                          </Badge>
                        )}
                      </div>
                      {/* Síntomas */}
                      {failure.symptomsList && failure.symptomsList.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {failure.symptomsList.slice(0, 3).map((symptom) => (
                            <Badge
                              key={symptom.id}
                              variant="secondary"
                              className="h-5 text-xs bg-blue-100 text-blue-800 hover:bg-blue-100"
                            >
                              {symptom.label}
                            </Badge>
                          ))}
                          {failure.symptomsList.length > 3 && (
                            <Badge
                              variant="secondary"
                              className="h-5 text-xs bg-gray-100 text-gray-600"
                            >
                              +{failure.symptomsList.length - 3} más
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Máquina */}
                  <TableCell>
                    <span className="text-xs">{failure.machine?.name || '-'}</span>
                  </TableCell>

                  {/* Componente */}
                  <TableCell>
                    {componentName ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs cursor-help">
                              {componentName}
                              {hasMultipleAffected && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  (+{allComponents.length + allSubcomponents.length - 1})
                                </span>
                              )}
                            </span>
                            {allSubcomponents.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                → {allSubcomponents.map(s => s.name).join(', ')}
                              </span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          {allComponents.length > 0 && (
                            <div className="mb-1">
                              <p className="font-medium text-xs">Componentes:</p>
                              <p className="text-xs">{allComponents.map(c => c.name).join(', ')}</p>
                            </div>
                          )}
                          {allSubcomponents.length > 0 && (
                            <div>
                              <p className="font-medium text-xs">Subcomponentes:</p>
                              <p className="text-xs">{allSubcomponents.map(s => s.name).join(', ')}</p>
                            </div>
                          )}
                          {!allComponents.length && !allSubcomponents.length && (
                            <p className="text-xs">Componente: {componentName}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>

                  {/* Estado */}
                  <TableCell>
                    <Badge className={cn(statusColors[failure.status] || 'bg-gray-100', 'text-xs')}>
                      {statusLabels[failure.status] || failure.status}
                    </Badge>
                  </TableCell>

                  {/* Reportada hace */}
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(failure.reportedAt), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </span>
                  </TableCell>

                  {/* Acciones */}
                  <TableCell className="text-right">
                    <div
                      className="flex justify-end gap-1"
                      onClick={(e) => e.stopPropagation()} // Prevent row click
                    >
                      {/* Ver detalle - siempre visible */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onSelectFailure?.(failure.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ver detalle</TooltipContent>
                      </Tooltip>

                      {/* Menú con todas las opciones */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* Editar */}
                          {onEditFailure && (
                            <DropdownMenuItem
                              onClick={() => onEditFailure(failure.id)}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          )}

                          {/* Crear OT */}
                          {canCreate && !hasWorkOrder && !isResolved && (
                            <DropdownMenuItem
                              onClick={() => handleCreateWorkOrder(failure.id)}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Crear OT
                            </DropdownMenuItem>
                          )}

                          {/* Resolver */}
                          {canEdit && !isResolved && (
                            <DropdownMenuItem
                              onClick={() => handleResolve(failure.id)}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Resolver
                            </DropdownMenuItem>
                          )}

                          {/* Vincular duplicado */}
                          {canEdit && !isResolved && (
                            <DropdownMenuItem
                              onClick={() => handleLinkDuplicate(failure.id)}
                            >
                              <LinkIcon className="h-4 w-4 mr-2" />
                              Vincular duplicado
                            </DropdownMenuItem>
                          )}

                          {/* Separador antes de eliminar */}
                          {onDeleteFailure && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => onDeleteFailure(failure.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
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

      {/* Pagination Controls */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between px-2 py-4">
          {/* Results summary */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Mostrando {offset + 1}-{Math.min(offset + pageSize, totalCount)} de{' '}
              {totalCount} fallas
            </span>
            <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-8 w-[100px]">
                <SelectValue placeholder={pageSize.toString()} />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size} por página
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Page navigation */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages || 1}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={goToFirstPage}
                disabled={currentPage <= 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={goToPrevPage}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={goToNextPage}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={goToLastPage}
                disabled={currentPage >= totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}
