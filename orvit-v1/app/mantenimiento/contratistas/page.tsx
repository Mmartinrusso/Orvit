'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
                    <Input placeholder="Ej: Servicios Técnicos S.A." />
                  </div>
                  <div className="space-y-2">
                    <Label>Razón Social</Label>
                    <Input placeholder="Ej: Servicios Técnicos S.A. de C.V." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CUIT/RFC</Label>
                    <Input placeholder="Ej: 30-12345678-9" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Servicio</Label>
                    <Select defaultValue="MAINTENANCE">
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
                  <Input placeholder="Nombre del contacto" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" placeholder="contacto@empresa.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input placeholder="+54 11 1234-5678" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Dirección</Label>
                  <Textarea placeholder="Dirección completa..." />
                </div>
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea placeholder="Notas adicionales sobre el contratista..." />
                </div>
                <Button className="w-full" onClick={() => setIsDialogOpen(false)}>
                  Crear Contratista
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">Cargando...</TableCell>
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
