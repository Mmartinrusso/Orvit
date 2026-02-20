'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { LOTOProcedure } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  CheckCircle,
  Power,
  PowerOff,
  Trash2,
  Lock,
  RefreshCw,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface LOTOProcedureListProps {
  procedures: LOTOProcedure[];
  isLoading?: boolean;
  onView?: (procedure: LOTOProcedure) => void;
  onEdit?: (procedure: LOTOProcedure) => void;
  onApprove?: (procedure: LOTOProcedure) => void;
  onActivate?: (procedure: LOTOProcedure) => void;
  onDeactivate?: (procedure: LOTOProcedure) => void;
  onDelete?: (procedure: LOTOProcedure) => void;
  onExecute?: (procedure: LOTOProcedure) => void;
  onCreate?: () => void;
  onRefresh?: () => void;
}

export default function LOTOProcedureList({
  procedures,
  isLoading = false,
  onView,
  onEdit,
  onApprove,
  onActivate,
  onDeactivate,
  onDelete,
  onExecute,
  onCreate,
  onRefresh,
}: LOTOProcedureListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [approvalFilter, setApprovalFilter] = useState<string>('all');

  const filteredProcedures = procedures.filter(procedure => {
    const matchesSearch =
      procedure.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      procedure.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      procedure.machine?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && procedure.isActive) ||
      (statusFilter === 'inactive' && !procedure.isActive);

    const matchesApproval =
      approvalFilter === 'all' ||
      (approvalFilter === 'approved' && procedure.isApproved) ||
      (approvalFilter === 'pending' && !procedure.isApproved);

    return matchesSearch && matchesStatus && matchesApproval;
  });

  const getAvailableActions = (procedure: LOTOProcedure) => {
    const actions: { label: string; icon: React.ElementType; onClick: () => void; variant?: 'destructive' }[] = [];

    actions.push({ label: 'Ver detalles', icon: Eye, onClick: () => onView?.(procedure) });

    if (!procedure.isApproved) {
      actions.push({ label: 'Editar', icon: Edit, onClick: () => onEdit?.(procedure) });
      if (onApprove) {
        actions.push({ label: 'Aprobar', icon: CheckCircle, onClick: () => onApprove(procedure) });
      }
    }

    if (procedure.isApproved && procedure.isActive && onExecute) {
      actions.push({ label: 'Ejecutar LOTO', icon: Lock, onClick: () => onExecute(procedure) });
    }

    if (procedure.isActive && onDeactivate) {
      actions.push({ label: 'Desactivar', icon: PowerOff, onClick: () => onDeactivate(procedure) });
    } else if (!procedure.isActive && onActivate) {
      actions.push({ label: 'Activar', icon: Power, onClick: () => onActivate(procedure) });
    }

    if (procedure._count?.executions === 0 && onDelete) {
      actions.push({ label: 'Eliminar', icon: Trash2, onClick: () => onDelete(procedure), variant: 'destructive' });
    }

    return actions;
  };

  return (
    <div className="space-y-4">
      {/* Header & Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, maquina..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={approvalFilter} onValueChange={setApprovalFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Aprobacion" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="approved">Aprobados</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {onRefresh && (
            <Button variant="outline" size="icon" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          )}
          {onCreate && (
            <Button onClick={onCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Procedimiento
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="w-[180px]">Maquina</TableHead>
              <TableHead className="w-[80px]">Version</TableHead>
              <TableHead className="w-[120px]">Estado</TableHead>
              <TableHead className="w-[100px]">Ejecuciones</TableHead>
              <TableHead className="w-[150px]">Creado</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Cargando procedimientos...
                </TableCell>
              </TableRow>
            ) : filteredProcedures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Lock className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No se encontraron procedimientos LOTO</p>
                    {onCreate && (
                      <Button variant="outline" size="sm" onClick={onCreate}>
                        <Plus className="h-4 w-4 mr-2" />
                        Crear primer procedimiento
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredProcedures.map((procedure) => (
                <TableRow
                  key={procedure.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onView?.(procedure)}
                >
                  <TableCell>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{procedure.name}</span>
                        {procedure.energySources && procedure.energySources.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <Zap className="h-3 w-3 mr-1" />
                            {procedure.energySources.length}
                          </Badge>
                        )}
                      </div>
                      {procedure.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                          {procedure.description}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{procedure.machine?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">v{procedure.version}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={procedure.isActive ? 'default' : 'secondary'} className="w-fit">
                        {procedure.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                      <Badge
                        variant={procedure.isApproved ? 'outline' : 'secondary'}
                        className={cn('w-fit text-xs', procedure.isApproved && 'border-success/30 text-success')}
                      >
                        {procedure.isApproved ? 'Aprobado' : 'Pendiente'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {procedure._count?.executions || 0}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(procedure.createdAt), 'dd/MM/yyyy', { locale: es })}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {getAvailableActions(procedure).map((action, idx) => (
                          <div key={action.label}>
                            {idx > 0 && action.variant === 'destructive' && <DropdownMenuSeparator />}
                            <DropdownMenuItem
                              onClick={action.onClick}
                              className={action.variant === 'destructive' ? 'text-destructive' : ''}
                            >
                              <action.icon className="h-4 w-4 mr-2" />
                              {action.label}
                            </DropdownMenuItem>
                          </div>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
