'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw,
  Search,
  Plus,
  MoreVertical,
  Eye,
  Pencil,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { MOCStatusBadge, MOCTypeBadge } from './MOCStatusBadge';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface MOC {
  id: number;
  mocNumber: string;
  title: string;
  description: string;
  changeType: string;
  priority: string;
  status: string;
  requestedDate: string;
  machine?: { id: number; name: string };
  requestedBy: { id: number; name: string };
  approvedBy?: { id: number; name: string };
  _count: {
    tasks: number;
    documents: number;
  };
}

interface MOCListProps {
  companyId: number;
}

export function MOCList({ companyId }: MOCListProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['mocs', companyId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ companyId: String(companyId) });
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const res = await fetch(`/api/moc?${params}`);
      if (!res.ok) throw new Error('Error fetching MOCs');
      return res.json();
    },
  });

  const mocs: MOC[] = data?.mocs || [];
  const summary = data?.summary;

  // Filter by search
  const filteredMocs = mocs.filter((moc) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      moc.mocNumber.toLowerCase().includes(searchLower) ||
      moc.title.toLowerCase().includes(searchLower) ||
      moc.machine?.name.toLowerCase().includes(searchLower) ||
      moc.requestedBy.name.toLowerCase().includes(searchLower)
    );
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Gestión del Cambio (MOC)
            </CardTitle>
            <CardDescription>
              Control de cambios en equipos, procesos y procedimientos
            </CardDescription>
          </div>
          {hasPermission('moc.create') && (
            <Button onClick={() => router.push('/mantenimiento/moc/nuevo')}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo MOC
            </Button>
          )}
        </div>

        {/* Summary */}
        {summary && (
          <div className="grid grid-cols-4 md:grid-cols-7 gap-2 mt-4">
            <div className="p-2 rounded-lg bg-muted text-center">
              <p className="text-lg font-bold">{summary.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="p-2 rounded-lg bg-info-muted text-center">
              <p className="text-lg font-bold text-info-muted-foreground">{summary.pendingReview}</p>
              <p className="text-xs text-muted-foreground">Pendientes</p>
            </div>
            <div className="p-2 rounded-lg bg-muted text-center">
              <p className="text-lg font-bold text-foreground">{summary.underReview}</p>
              <p className="text-xs text-muted-foreground">En Revisión</p>
            </div>
            <div className="p-2 rounded-lg bg-success-muted text-center">
              <p className="text-lg font-bold text-success">{summary.approved}</p>
              <p className="text-xs text-muted-foreground">Aprobados</p>
            </div>
            <div className="p-2 rounded-lg bg-warning-muted text-center">
              <p className="text-lg font-bold text-warning-muted-foreground">{summary.implementing}</p>
              <p className="text-xs text-muted-foreground">Implementando</p>
            </div>
            <div className="p-2 rounded-lg bg-success-muted text-center">
              <p className="text-lg font-bold text-success">{summary.completed}</p>
              <p className="text-xs text-muted-foreground">Completados</p>
            </div>
            <div className="p-2 rounded-lg bg-destructive/10 text-center">
              <p className="text-lg font-bold text-destructive">{summary.rejected}</p>
              <p className="text-xs text-muted-foreground">Rechazados</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-4 mt-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, título, máquina..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="DRAFT">Borrador</SelectItem>
              <SelectItem value="PENDING_REVIEW">Pendiente de Revisión</SelectItem>
              <SelectItem value="UNDER_REVIEW">En Revisión</SelectItem>
              <SelectItem value="APPROVED">Aprobado</SelectItem>
              <SelectItem value="IMPLEMENTING">En Implementación</SelectItem>
              <SelectItem value="COMPLETED">Completado</SelectItem>
              <SelectItem value="REJECTED">Rechazado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {filteredMocs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No hay registros MOC</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Máquina</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMocs.map((moc) => (
                <TableRow key={moc.id}>
                  <TableCell className="font-mono text-sm">{moc.mocNumber}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{moc.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {moc._count.tasks} tareas, {moc._count.documents} docs
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <MOCTypeBadge type={moc.changeType as any} />
                  </TableCell>
                  <TableCell>{moc.machine?.name || '-'}</TableCell>
                  <TableCell>
                    <MOCStatusBadge status={moc.status as any} size="sm" />
                  </TableCell>
                  <TableCell>{moc.requestedBy.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(moc.requestedDate), { addSuffix: true, locale: es })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Opciones">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/mantenimiento/moc/${moc.id}`)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver detalles
                        </DropdownMenuItem>
                        {moc.status === 'DRAFT' && hasPermission('moc.edit') && (
                          <DropdownMenuItem onClick={() => router.push(`/mantenimiento/moc/${moc.id}/editar`)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default MOCList;
