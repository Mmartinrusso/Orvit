'use client';

import { useState } from 'react';
import { PermitToWork, PTWStatus, PTWType } from '@/lib/types';
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
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  CheckCircle,
  XCircle,
  PlayCircle,
  PauseCircle,
  StopCircle,
  Trash2,
  FileText,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import PTWStatusBadge from './PTWStatusBadge';
import PTWTypeBadge from './PTWTypeBadge';

interface PTWListProps {
  permits: PermitToWork[];
  isLoading?: boolean;
  onView?: (permit: PermitToWork) => void;
  onEdit?: (permit: PermitToWork) => void;
  onApprove?: (permit: PermitToWork) => void;
  onReject?: (permit: PermitToWork) => void;
  onActivate?: (permit: PermitToWork) => void;
  onSuspend?: (permit: PermitToWork) => void;
  onResume?: (permit: PermitToWork) => void;
  onClose?: (permit: PermitToWork) => void;
  onDelete?: (permit: PermitToWork) => void;
  onCreate?: () => void;
  onRefresh?: () => void;
}

export default function PTWList({
  permits,
  isLoading = false,
  onView,
  onEdit,
  onApprove,
  onReject,
  onActivate,
  onSuspend,
  onResume,
  onClose,
  onDelete,
  onCreate,
  onRefresh,
}: PTWListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredPermits = permits.filter(permit => {
    const matchesSearch =
      permit.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      permit.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      permit.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || permit.status === statusFilter;
    const matchesType = typeFilter === 'all' || permit.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const getAvailableActions = (permit: PermitToWork) => {
    const actions: { label: string; icon: React.ElementType; onClick: () => void; variant?: 'destructive' }[] = [];

    actions.push({ label: 'Ver detalles', icon: Eye, onClick: () => onView?.(permit) });

    switch (permit.status) {
      case PTWStatus.DRAFT:
        actions.push({ label: 'Editar', icon: Edit, onClick: () => onEdit?.(permit) });
        actions.push({ label: 'Eliminar', icon: Trash2, onClick: () => onDelete?.(permit), variant: 'destructive' });
        break;
      case PTWStatus.PENDING_APPROVAL:
        if (onApprove) actions.push({ label: 'Aprobar', icon: CheckCircle, onClick: () => onApprove(permit) });
        if (onReject) actions.push({ label: 'Rechazar', icon: XCircle, onClick: () => onReject(permit), variant: 'destructive' });
        break;
      case PTWStatus.APPROVED:
        if (onActivate) actions.push({ label: 'Activar', icon: PlayCircle, onClick: () => onActivate(permit) });
        break;
      case PTWStatus.ACTIVE:
        if (onSuspend) actions.push({ label: 'Suspender', icon: PauseCircle, onClick: () => onSuspend(permit) });
        if (onClose) actions.push({ label: 'Cerrar', icon: StopCircle, onClick: () => onClose(permit) });
        break;
      case PTWStatus.SUSPENDED:
        if (onResume) actions.push({ label: 'Reanudar', icon: PlayCircle, onClick: () => onResume(permit) });
        if (onClose) actions.push({ label: 'Cerrar', icon: StopCircle, onClick: () => onClose(permit) });
        break;
      case PTWStatus.CANCELLED:
        actions.push({ label: 'Eliminar', icon: Trash2, onClick: () => onDelete?.(permit), variant: 'destructive' });
        break;
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
              placeholder="Buscar por numero, titulo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {Object.values(PTWStatus).map((status) => (
                <SelectItem key={status} value={status}>
                  <PTWStatusBadge status={status} size="sm" showIcon={false} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {Object.values(PTWType).map((type) => (
                <SelectItem key={type} value={type}>
                  <PTWTypeBadge type={type} size="sm" showIcon={false} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {onRefresh && (
            <Button variant="outline" size="icon" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          {onCreate && (
            <Button onClick={onCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo PTW
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Numero</TableHead>
              <TableHead>Titulo</TableHead>
              <TableHead className="w-[180px]">Tipo</TableHead>
              <TableHead className="w-[130px]">Estado</TableHead>
              <TableHead className="w-[150px]">Valido Desde</TableHead>
              <TableHead className="w-[150px]">Valido Hasta</TableHead>
              <TableHead className="w-[150px]">Solicitante</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Cargando permisos...
                </TableCell>
              </TableRow>
            ) : filteredPermits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No se encontraron permisos de trabajo</p>
                    {onCreate && (
                      <Button variant="outline" size="sm" onClick={onCreate}>
                        <Plus className="h-4 w-4 mr-2" />
                        Crear primer PTW
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredPermits.map((permit) => (
                <TableRow
                  key={permit.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onView?.(permit)}
                >
                  <TableCell className="font-mono text-sm">{permit.number}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{permit.title}</span>
                      {permit.workOrder && (
                        <span className="text-xs text-muted-foreground">
                          OT: {permit.workOrder.title}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <PTWTypeBadge type={permit.type} size="sm" />
                  </TableCell>
                  <TableCell>
                    <PTWStatusBadge status={permit.status} size="sm" />
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(permit.validFrom), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(permit.validTo), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {permit.requestedBy?.name || '-'}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {getAvailableActions(permit).map((action, idx) => (
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
