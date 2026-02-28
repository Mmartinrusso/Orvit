'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  HardHat,
  Plus,
  Search,
  RefreshCw,
  Building2,
  Phone,
  Mail,
  Star,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  Link2,
} from 'lucide-react';

interface Contractor {
  id: number;
  name: string;
  legalName: string;
  taxId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  status: string;
  type: string;
  rating: number;
  service_count: number;
  valid_qualifications: number;
  assignment_count: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ACTIVE: { label: 'Activo', color: 'bg-success-muted text-success', icon: <CheckCircle2 className="h-4 w-4" /> },
  INACTIVE: { label: 'Inactivo', color: 'bg-muted text-foreground', icon: <XCircle className="h-4 w-4" /> },
  SUSPENDED: { label: 'Suspendido', color: 'bg-warning-muted text-warning-muted-foreground', icon: <AlertCircle className="h-4 w-4" /> },
  BLACKLISTED: { label: 'Bloqueado', color: 'bg-destructive/10 text-destructive', icon: <XCircle className="h-4 w-4" /> },
};

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  MAINTENANCE: { label: 'Mantenimiento', color: 'bg-info-muted text-info-muted-foreground' },
  INSPECTION: { label: 'Inspección', color: 'bg-purple-100 text-purple-800' },
  CALIBRATION: { label: 'Calibración', color: 'bg-warning-muted text-warning-muted-foreground' },
  SPECIALIZED: { label: 'Especializado', color: 'bg-indigo-100 text-indigo-800' },
  GENERAL: { label: 'General', color: 'bg-muted text-foreground' },
};

export default function ContractorsPage() {
  const { currentCompany } = useCompany();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const FORM_DEFAULT = { name: '', legalName: '', taxId: '', contactName: '', contactEmail: '', contactPhone: '', address: '', notes: '', type: 'MAINTENANCE' };
  const [form, setForm] = useState(FORM_DEFAULT);
  const patchForm = (patch: Partial<typeof FORM_DEFAULT>) => setForm(prev => ({ ...prev, ...patch }));

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/contractors?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al eliminar');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Contratista eliminado');
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
    },
    onError: (err: any) => toast.error(err.message || 'Error al eliminar contratista'),
  });

  const rateMutation = useMutation({
    mutationFn: async ({ id, rating }: { id: number; rating: number }) => {
      const res = await fetch('/api/contractors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'rate', rating }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al calificar');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Contratista calificado');
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
    },
    onError: (err: any) => toast.error(err.message || 'Error al calificar contratista'),
  });

  const handleDelete = (id: number) => {
    if (!confirm('¿Eliminar este contratista? Esta acción no se puede deshacer.')) return;
    deleteMutation.mutate(id);
  };

  const handleRate = (id: number) => {
    const ratingStr = prompt('Calificación (1-5):');
    if (!ratingStr) return;
    const rating = parseInt(ratingStr);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      toast.error('La calificación debe ser un número entre 1 y 5');
      return;
    }
    rateMutation.mutate({ id, rating });
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof FORM_DEFAULT) => {
      const res = await fetch('/api/contractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          legalName: data.legalName || undefined,
          taxId: data.taxId || undefined,
          contactName: data.contactName || undefined,
          contactEmail: data.contactEmail || undefined,
          contactPhone: data.contactPhone || undefined,
          address: data.address || undefined,
          notes: data.notes || undefined,
          type: data.type,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error al crear');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Contratista creado correctamente');
      setIsDialogOpen(false);
      setForm(FORM_DEFAULT);
      queryClient.invalidateQueries({ queryKey: ['contractors'] });
    },
    onError: (err: any) => toast.error(err.message || 'Error al crear contratista'),
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['contractors', currentCompany?.id, statusFilter, typeFilter],
    queryFn: async () => {
      const res = await fetch(
        `/api/contractors?companyId=${currentCompany?.id}&status=${statusFilter}&type=${typeFilter}`
      );
      if (!res.ok) throw new Error('Error al cargar contratistas');
      return res.json();
    },
    enabled: !!currentCompany?.id,
  });

  const contractors: Contractor[] = data?.contractors || [];
  const summary = data?.summary || {};

  const filteredContractors = contractors.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.contactName?.toLowerCase().includes(search.toLowerCase()) ||
    c.taxId?.toLowerCase().includes(search.toLowerCase())
  );

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? 'text-warning-muted-foreground fill-yellow-400' : 'text-muted-foreground'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardHat className="h-6 w-6" />
            Gestión de Contratistas
          </h1>
          <p className="text-muted-foreground">
            Administración de proveedores de servicios externos
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          {hasPermission('contractors.create') && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Contratista
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Registrar Contratista</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre Comercial *</Label>
                    <Input
                      placeholder="Ej: Servicios Técnicos S.A."
                      value={form.name}
                      onChange={e => patchForm({ name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Razón Social</Label>
                    <Input
                      placeholder="Ej: Servicios Técnicos S.A. de C.V."
                      value={form.legalName}
                      onChange={e => patchForm({ legalName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CUIT/RFC</Label>
                    <Input
                      placeholder="Ej: 30-12345678-9"
                      value={form.taxId}
                      onChange={e => patchForm({ taxId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Servicio</Label>
                    <Select value={form.type} onValueChange={v => patchForm({ type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MAINTENANCE">Mantenimiento</SelectItem>
                        <SelectItem value="INSPECTION">Inspección</SelectItem>
                        <SelectItem value="CALIBRATION">Calibración</SelectItem>
                        <SelectItem value="SPECIALIZED">Especializado</SelectItem>
                        <SelectItem value="GENERAL">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Contacto Principal</Label>
                  <Input
                    placeholder="Nombre del contacto"
                    value={form.contactName}
                    onChange={e => patchForm({ contactName: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="contacto@empresa.com"
                      value={form.contactEmail}
                      onChange={e => patchForm({ contactEmail: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      placeholder="+54 11 1234-5678"
                      value={form.contactPhone}
                      onChange={e => patchForm({ contactPhone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Dirección</Label>
                  <Textarea
                    placeholder="Dirección completa..."
                    value={form.address}
                    onChange={e => patchForm({ address: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea
                    placeholder="Notas adicionales sobre el contratista..."
                    value={form.notes}
                    onChange={e => patchForm({ notes: e.target.value })}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createMutation.mutate(form)}
                  disabled={!form.name || createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creando...' : 'Crear Contratista'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{summary.total || 0}</p>
              </div>
              <Building2 className="h-8 w-8 text-info-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Activos</p>
                <p className="text-2xl font-bold text-success">{summary.active || 0}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Suspendidos</p>
                <p className="text-2xl font-bold text-warning-muted-foreground">{summary.suspended || 0}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-warning-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inactivos</p>
                <p className="text-2xl font-bold text-muted-foreground">{summary.inactive || 0}</p>
              </div>
              <XCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, contacto o CUIT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ACTIVE">Activos</SelectItem>
            <SelectItem value="INACTIVE">Inactivos</SelectItem>
            <SelectItem value="SUSPENDED">Suspendidos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="MAINTENANCE">Mantenimiento</SelectItem>
            <SelectItem value="INSPECTION">Inspección</SelectItem>
            <SelectItem value="CALIBRATION">Calibración</SelectItem>
            <SelectItem value="SPECIALIZED">Especializado</SelectItem>
            <SelectItem value="GENERAL">General</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contratista</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Calificación</TableHead>
                <TableHead>Servicios</TableHead>
                <TableHead>Certificaciones</TableHead>
                <TableHead>Asignaciones</TableHead>
                {(hasPermission('contractors.edit') || hasPermission('contractors.delete') || hasPermission('contractors.assign') || hasPermission('contractors.rate')) && (
                  <TableHead className="w-[60px]">Acciones</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">Cargando contratistas...</TableCell>
                </TableRow>
              ) : filteredContractors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No se encontraron contratistas
                  </TableCell>
                </TableRow>
              ) : (
                filteredContractors.map((contractor) => (
                  <TableRow key={contractor.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{contractor.name}</p>
                        {contractor.taxId && (
                          <p className="text-xs text-muted-foreground">{contractor.taxId}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {contractor.contactName && (
                          <p className="text-sm">{contractor.contactName}</p>
                        )}
                        {contractor.contactEmail && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {contractor.contactEmail}
                          </div>
                        )}
                        {contractor.contactPhone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {contractor.contactPhone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={TYPE_CONFIG[contractor.type]?.color || 'bg-muted'}>
                        {TYPE_CONFIG[contractor.type]?.label || contractor.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_CONFIG[contractor.status]?.color || 'bg-muted'}>
                        <span className="flex items-center gap-1">
                          {STATUS_CONFIG[contractor.status]?.icon}
                          {STATUS_CONFIG[contractor.status]?.label || contractor.status}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell>{renderStars(contractor.rating || 0)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{contractor.service_count || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={contractor.valid_qualifications > 0 ? 'default' : 'secondary'}>
                        {contractor.valid_qualifications || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{contractor.assignment_count || 0}</Badge>
                    </TableCell>
                    {(hasPermission('contractors.edit') || hasPermission('contractors.delete') || hasPermission('contractors.assign') || hasPermission('contractors.rate')) && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {hasPermission('contractors.edit') && (
                              <DropdownMenuItem onClick={() => toast.info('Edición de contratista próximamente')}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {hasPermission('contractors.assign') && (
                              <DropdownMenuItem onClick={() => toast.info('Asignación de contratista próximamente')}>
                                <Link2 className="h-4 w-4 mr-2" />
                                Asignar a OT
                              </DropdownMenuItem>
                            )}
                            {hasPermission('contractors.rate') && (
                              <DropdownMenuItem onClick={() => handleRate(contractor.id)}>
                                <Star className="h-4 w-4 mr-2" />
                                Calificar
                              </DropdownMenuItem>
                            )}
                            {hasPermission('contractors.delete') && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDelete(contractor.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
