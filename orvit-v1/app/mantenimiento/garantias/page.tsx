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
  Shield,
  Plus,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Calendar,
  FileText,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface Warranty {
  id: number;
  entityType: string;
  entityId: number;
  machineName?: string;
  supplierName: string;
  startDate: string;
  endDate: string;
  coverageType: string;
  conditions?: string;
  documentUrl?: string;
  isActive: boolean;
}

const COVERAGE_TYPES: Record<string, { label: string; color: string }> = {
  FULL: { label: 'Completa', color: 'bg-success-muted text-success' },
  PARTS_ONLY: { label: 'Solo Repuestos', color: 'bg-info-muted text-info-muted-foreground' },
  LABOR_ONLY: { label: 'Solo Mano de Obra', color: 'bg-purple-100 text-purple-800' },
};

export default function GarantiasPage() {
  const { currentCompany } = useCompany();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['warranties', currentCompany?.id],
    queryFn: async () => {
      const res = await fetch(`/api/warranties?companyId=${currentCompany?.id}`);
      if (!res.ok) throw new Error('Error fetching warranties');
      return res.json();
    },
    enabled: !!currentCompany?.id,
  });

  const warranties: Warranty[] = data?.warranties || [];
  const summary = data?.summary || {};

  const getWarrantyStatus = (warranty: Warranty) => {
    const now = new Date();
    const endDate = new Date(warranty.endDate);
    const daysRemaining = differenceInDays(endDate, now);

    if (daysRemaining < 0) return { status: 'EXPIRED', color: 'red', icon: XCircle };
    if (daysRemaining <= 30) return { status: 'EXPIRING', color: 'yellow', icon: AlertTriangle };
    return { status: 'ACTIVE', color: 'green', icon: CheckCircle };
  };

  const filteredWarranties = warranties.filter(w => {
    const matchesSearch = w.supplierName.toLowerCase().includes(search.toLowerCase()) ||
      w.machineName?.toLowerCase().includes(search.toLowerCase());

    if (statusFilter === 'all') return matchesSearch;
    const status = getWarrantyStatus(w).status;
    return matchesSearch && status === statusFilter;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Garantías
          </h1>
          <p className="text-muted-foreground">
            Gestión de garantías de equipos y repuestos
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Garantía
          </Button>
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
              <Shield className="h-8 w-8 text-info-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Activas</p>
                <p className="text-2xl font-bold text-success">{summary.active || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Por Vencer</p>
                <p className="text-2xl font-bold text-warning-muted-foreground">{summary.expiringSoon || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-warning-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vencidas</p>
                <p className="text-2xl font-bold text-destructive">{summary.expired || 0}</p>
              </div>
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por proveedor o máquina..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="ACTIVE">Activas</SelectItem>
            <SelectItem value="EXPIRING">Por Vencer</SelectItem>
            <SelectItem value="EXPIRED">Vencidas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activo</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Cobertura</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Cargando garantías...
                  </TableCell>
                </TableRow>
              ) : filteredWarranties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No se encontraron garantías
                  </TableCell>
                </TableRow>
              ) : (
                filteredWarranties.map((warranty) => {
                  const statusInfo = getWarrantyStatus(warranty);
                  const StatusIcon = statusInfo.icon;
                  const coverage = COVERAGE_TYPES[warranty.coverageType] || { label: warranty.coverageType, color: 'bg-muted' };
                  const daysRemaining = differenceInDays(new Date(warranty.endDate), new Date());

                  return (
                    <TableRow key={warranty.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{warranty.machineName || `${warranty.entityType} #${warranty.entityId}`}</p>
                          <p className="text-xs text-muted-foreground">{warranty.entityType}</p>
                        </div>
                      </TableCell>
                      <TableCell>{warranty.supplierName}</TableCell>
                      <TableCell>
                        <Badge className={coverage.color}>{coverage.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(warranty.startDate), 'dd/MM/yyyy', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(warranty.endDate), 'dd/MM/yyyy', { locale: es })}
                          {daysRemaining > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ({daysRemaining}d)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`bg-${statusInfo.color}-100 text-${statusInfo.color}-800 border-${statusInfo.color}-200`}
                        >
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.status === 'ACTIVE' ? 'Activa' :
                           statusInfo.status === 'EXPIRING' ? 'Por Vencer' : 'Vencida'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {warranty.documentUrl && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={warranty.documentUrl} target="_blank" rel="noopener noreferrer">
                                <FileText className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
