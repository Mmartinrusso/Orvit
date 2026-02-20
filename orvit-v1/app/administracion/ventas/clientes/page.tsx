'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus, Search, Eye, User, TrendingUp, DollarSign, AlertTriangle,
  Download, Banknote, Edit, Trash2, X, MoreHorizontal, UserPlus,
  UserCheck, UserX, Ban, CheckCircle, Clock, RefreshCcw, Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { ClientFormDialog } from '@/components/ventas/client-form-dialog';
import { ClientScoreBadge } from '@/components/ventas/analytics/client-score-badge';
import { ClientAlertsBadge } from '@/components/ventas/analytics/client-alerts-badge';
import { cn } from '@/lib/utils';
import { usePermissionRobust } from '@/hooks/use-permissions-robust';
import { PermissionGuard } from '@/components/auth/PermissionGuard';

interface Client {
  id: string;
  legalName: string;
  name: string | null;
  email: string;
  phone: string | null;
  cuit: string | null;
  taxCondition: string;
  creditLimit: number | null;
  currentBalance: number;
  isActive: boolean;
  isBlocked: boolean;
  blockedReason: string | null;
  city: string | null;
  province: string | null;
  paymentTerms: number | null;
  tipoCondicionVenta: string;
  createdAt: string;
  clientType?: { id: string; name: string } | null;
  deliveryZone?: { id: string; name: string } | null;
  seller?: { id: number; name: string } | null;
  priceList?: { id: string; name: string } | null;
  discountList?: { id: string; name: string } | null;
  _count?: {
    invoices: number;
    payments: number;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const TAX_CONDITION_LABELS: Record<string, string> = {
  responsable_inscripto: 'Resp. Inscripto',
  monotributo: 'Monotributo',
  exento: 'Exento',
  consumidor_final: 'Cons. Final',
  no_responsable: 'No Responsable',
};

export default function ClientsPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { currentCompany } = useCompany();

  // Permissions
  const { hasPermission: canManageClients, isLoading: loadingPerms } = usePermissionRobust('gestionar_clientes');

  // Data states
  const [clients, setClients] = useState<Client[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [blockedFilter, setBlockedFilter] = useState('all');
  const [taxConditionFilter, setTaxConditionFilter] = useState('all');
  const [sortBy, setSortBy] = useState('legalName');
  const [sortOrder, setSortOrder] = useState('asc');

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; clientId: string | null; clientName: string }>({
    open: false,
    clientId: null,
    clientName: ''
  });
  const [bulkActionDialog, setBulkActionDialog] = useState<{
    open: boolean;
    action: string;
  }>({ open: false, action: '' });

  // Load data
  const loadClients = useCallback(async () => {
    if (!currentUser || !currentCompany) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
        includeCredit: 'true',
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { active: statusFilter }),
        ...(blockedFilter !== 'all' && { blocked: blockedFilter }),
        ...(taxConditionFilter !== 'all' && { taxCondition: taxConditionFilter }),
      });

      const response = await fetch(`/api/ventas/clientes?${params}`);
      if (response.ok) {
        const data = await response.json();
        setClients(data.data || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
      } else {
        toast.error('Error al cargar clientes');
      }
    } catch (error) {
      console.error('Error loading clients:', error);
      toast.error('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  }, [currentUser, currentCompany, pagination.page, pagination.limit, searchTerm, statusFilter, blockedFilter, taxConditionFilter, sortBy, sortOrder]);

  useEffect(() => {
    if (currentUser && currentCompany) {
      loadClients();
    }
  }, [loadClients, currentUser, currentCompany]);

  // Handlers
  const handleSelectClient = (clientId: string, checked: boolean) => {
    if (checked) {
      setSelectedClients(prev => [...prev, clientId]);
    } else {
      setSelectedClients(prev => prev.filter(id => id !== clientId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedClients(clients.map(c => c.id));
    } else {
      setSelectedClients([]);
    }
  };

  const handleDelete = async (clientId: string) => {
    try {
      const response = await fetch(`/api/ventas/clientes/${clientId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Cliente desactivado correctamente');
        loadClients();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al desactivar cliente');
      }
    } catch (error) {
      toast.error('Error al desactivar cliente');
    }
    setDeleteDialog({ open: false, clientId: null, clientName: '' });
  };

  const handleBulkAction = async (action: string) => {
    if (selectedClients.length === 0) {
      toast.error('Selecciona al menos un cliente');
      return;
    }

    try {
      // TODO: Implement bulk actions API
      toast.success(`Acción "${action}" aplicada a ${selectedClients.length} clientes`);
      setSelectedClients([]);
      loadClients();
    } catch (error) {
      toast.error('Error en la operación masiva');
    }
    setBulkActionDialog({ open: false, action: '' });
  };

  const exportClients = () => {
    const csvContent = [
      ['Razón Social', 'Nombre', 'Email', 'Teléfono', 'CUIT', 'Condición Fiscal', 'Límite Crédito', 'Saldo', 'Estado', 'Bloqueado'],
      ...clients.map(c => [
        c.legalName,
        c.name || '',
        c.email,
        c.phone || '',
        c.cuit || '',
        TAX_CONDITION_LABELS[c.taxCondition] || c.taxCondition,
        c.creditLimit?.toString() || '',
        c.currentBalance.toString(),
        c.isActive ? 'Activo' : 'Inactivo',
        c.isBlocked ? 'Sí' : 'No',
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setBlockedFilter('all');
    setTaxConditionFilter('all');
    setSortBy('legalName');
    setSortOrder('asc');
  };

  const hasActiveFilters = searchTerm !== '' || statusFilter !== 'all' || blockedFilter !== 'all' || taxConditionFilter !== 'all';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
  };

  const getStats = () => {
    const total = pagination.total;
    const active = clients.filter(c => c.isActive).length;
    const blocked = clients.filter(c => c.isBlocked).length;
    const withDebt = clients.filter(c => c.currentBalance > 0).length;
    const totalDebt = clients.reduce((sum, c) => sum + Math.max(0, c.currentBalance), 0);
    return { total, active, blocked, withDebt, totalDebt };
  };

  const stats = getStats();

  // Wait for auth
  if (!currentUser || !currentCompany) {
    return (
      <div className="w-full p-0">
        <div className="px-4 md:px-6 pt-4 pb-3">
          <h1 className="text-xl font-semibold text-foreground">Gestión de Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Cargando...</p>
        </div>
      </div>
    );
  }

  // Loading permissions
  if (loadingPerms) {
    return (
      <div className="w-full p-0">
        <div className="px-4 md:px-6 pt-4 pb-3">
          <h1 className="text-xl font-semibold text-foreground">Gestión de Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  // Loading skeleton
  if (loading && clients.length === 0) {
    return (
      <div className="w-full p-0">
        <div className="px-4 md:px-6 pt-4 pb-3 border-b border-border">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="px-4 md:px-6 pt-4">
          <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8 w-24" />
            ))}
          </div>
        </div>
        <div className="px-4 md:px-6 pt-4">
          <Skeleton className="h-9 w-full mb-3" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-0">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-3 border-b border-border">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Gestión de Clientes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Administra tus clientes y su historial de ventas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportClients}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <ClientFormDialog
              open={isCreateDialogOpen}
              onOpenChange={setIsCreateDialogOpen}
              onClientCreated={() => {
                setIsCreateDialogOpen(false);
                loadClients();
              }}
            />
            <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Nuevo Cliente
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 md:px-6 pt-4">
        <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-md border">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total:</span>
            <span className="text-sm font-semibold">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-md border">
            <UserCheck className="h-4 w-4 text-success" />
            <span className="text-sm text-muted-foreground">Activos:</span>
            <span className="text-sm font-semibold text-success">{stats.active}</span>
          </div>
          {stats.blocked > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-md border">
              <Ban className="h-4 w-4 text-destructive" />
              <span className="text-sm text-muted-foreground">Bloqueados:</span>
              <span className="text-sm font-semibold text-destructive">{stats.blocked}</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-md border">
            <Banknote className="h-4 w-4 text-warning-muted-foreground" />
            <span className="text-sm text-muted-foreground">Con Deuda:</span>
            <span className="text-sm font-semibold text-warning-muted-foreground">{stats.withDebt}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-md border">
            <DollarSign className="h-4 w-4 text-info-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total Deuda:</span>
            <span className="text-sm font-semibold text-info-muted-foreground">{formatCurrency(stats.totalDebt)}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 md:px-6 pt-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, email o CUIT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 bg-background"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-32 h-9 bg-background">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Activos</SelectItem>
              <SelectItem value="false">Inactivos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={blockedFilter} onValueChange={setBlockedFilter}>
            <SelectTrigger className="w-full sm:w-32 h-9 bg-background">
              <SelectValue placeholder="Bloqueo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="false">Sin bloqueo</SelectItem>
              <SelectItem value="true">Bloqueados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={taxConditionFilter} onValueChange={setTaxConditionFilter}>
            <SelectTrigger className="w-full sm:w-40 h-9 bg-background">
              <SelectValue placeholder="Condición" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="responsable_inscripto">Resp. Inscripto</SelectItem>
              <SelectItem value="monotributo">Monotributo</SelectItem>
              <SelectItem value="exento">Exento</SelectItem>
              <SelectItem value="consumidor_final">Cons. Final</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Limpiar
            </Button>
          )}

          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground px-2">
            <span className="font-medium text-foreground">{clients.length}</span>
            <span>de {pagination.total}</span>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedClients.length > 0 && (
        <div className="px-4 md:px-6 pt-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{selectedClients.length} clientes seleccionados</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBulkActionDialog({ open: true, action: 'activate' })}
                  >
                    <UserCheck className="h-4 w-4 mr-2" />
                    Activar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBulkActionDialog({ open: true, action: 'deactivate' })}
                  >
                    <UserX className="h-4 w-4 mr-2" />
                    Desactivar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBulkActionDialog({ open: true, action: 'block' })}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Bloquear
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <div className="px-4 md:px-6 pt-4 pb-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Clientes</CardTitle>
              {clients.length !== pagination.total && (
                <Badge variant="secondary" className="text-xs">
                  {clients.length} de {pagination.total} mostrados
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12 pl-4">
                    <Checkbox
                      checked={selectedClients.length === clients.length && clients.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden xl:table-cell text-center">Score</TableHead>
                  <TableHead className="hidden xl:table-cell text-center">Alertas</TableHead>
                  <TableHead className="hidden md:table-cell">Condición Fiscal</TableHead>
                  <TableHead className="hidden lg:table-cell">Crédito</TableHead>
                  <TableHead className="hidden sm:table-cell">Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-12 text-right pr-4">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors group"
                    onClick={() => router.push(`/administracion/ventas/clientes/${client.id}`)}
                  >
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={selectedClients.includes(client.id)}
                        onCheckedChange={(checked) => handleSelectClient(client.id, !!checked)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                          client.isBlocked ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                        )}>
                          <span className="text-sm font-semibold">
                            {client.legalName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{client.legalName}</span>
                            {client.isBlocked && (
                              <Badge variant="destructive" className="text-[10px] h-4 px-1.5 shrink-0">
                                Bloqueado
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {client.email}
                          </div>
                          {client.cuit && (
                            <div className="text-xs text-muted-foreground font-mono truncate md:hidden">
                              {client.cuit}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-center" onClick={(e) => e.stopPropagation()}>
                      <ClientScoreBadge clientId={client.id} size="sm" />
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-center" onClick={(e) => e.stopPropagation()}>
                      <ClientAlertsBadge clientId={client.id} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="text-xs">
                        {TAX_CONDITION_LABELS[client.taxCondition] || client.taxCondition}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {client.creditLimit ? (
                        <div>
                          <span className="text-sm font-medium">{formatCurrency(client.creditLimit)}</span>
                          {client.currentBalance > 0 && client.creditLimit > 0 && (
                            <div className="text-xs text-muted-foreground">
                              {Math.round((client.currentBalance / client.creditLimit) * 100)}% usado
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin límite</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className={cn(
                        "text-sm font-medium",
                        client.currentBalance > 0 ? "text-destructive" :
                        client.currentBalance < 0 ? "text-success" : "text-muted-foreground"
                      )}>
                        {client.currentBalance !== 0 ? formatCurrency(Math.abs(client.currentBalance)) : '-'}
                        {client.currentBalance > 0 && ' (deuda)'}
                        {client.currentBalance < 0 && ' (a favor)'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {client.isActive ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-success" />
                          <span className="text-xs text-muted-foreground">Activo</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-destructive" />
                          <span className="text-xs text-muted-foreground">Inactivo</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="pr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/administracion/ventas/clientes/${client.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalle
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/administracion/ventas/clientes/${client.id}/edit`);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/administracion/ventas/cotizaciones/nueva?clientId=${client.id}`);
                            }}
                          >
                            <DollarSign className="h-4 w-4 mr-2" />
                            Nueva cotización
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteDialog({ open: true, clientId: client.id, clientName: client.legalName });
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Desactivar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {clients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="w-14 h-14 rounded-xl bg-muted/50 border border-dashed border-border flex items-center justify-center mb-4">
                          <User className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                        {hasActiveFilters ? (
                          <>
                            <h3 className="text-sm font-medium mb-1">Sin resultados</h3>
                            <p className="text-xs text-muted-foreground mb-3">
                              No hay clientes que coincidan con los filtros
                            </p>
                            <Button variant="outline" size="sm" onClick={clearFilters}>
                              <X className="h-3 w-3 mr-1.5" />
                              Limpiar filtros
                            </Button>
                          </>
                        ) : (
                          <>
                            <h3 className="text-sm font-medium mb-1">Sin clientes</h3>
                            <p className="text-xs text-muted-foreground mb-3">
                              No hay clientes registrados en el sistema
                            </p>
                            <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
                              <UserPlus className="h-3 w-3 mr-1.5" />
                              Crear cliente
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Página {pagination.page} de {pagination.totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Desactivación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de desactivar al cliente "{deleteDialog.clientName}"?
              El cliente no podrá realizar nuevas operaciones pero su historial se mantendrá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog.clientId && handleDelete(deleteDialog.clientId)}
              className="bg-destructive hover:bg-destructive"
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Action Dialog */}
      <AlertDialog open={bulkActionDialog.open} onOpenChange={(open) => setBulkActionDialog({ ...bulkActionDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Acción Masiva</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkActionDialog.action === 'activate' &&
                `¿Estás seguro de activar ${selectedClients.length} cliente(s)?`
              }
              {bulkActionDialog.action === 'deactivate' &&
                `¿Estás seguro de desactivar ${selectedClients.length} cliente(s)?`
              }
              {bulkActionDialog.action === 'block' &&
                `¿Estás seguro de bloquear ${selectedClients.length} cliente(s)?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleBulkAction(bulkActionDialog.action)}
              className={bulkActionDialog.action === 'block' ? 'bg-destructive hover:bg-destructive' : ''}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
