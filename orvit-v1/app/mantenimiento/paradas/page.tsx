'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  PauseCircle,
  Plus,
  Search,
  RefreshCw,
  Calendar,
  Users,
  DollarSign,
  Package,
  Clock,
  CheckCircle2,
  PlayCircle,
  AlertCircle,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface Shutdown {
  id: number;
  name: string;
  code: string;
  plannedStart: string;
  plannedEnd: string;
  actualStart?: string;
  actualEnd?: string;
  status: string;
  managerName: string;
  packageCount: number;
  completedPackages: number;
  budgetLabor?: number;
  budgetParts?: number;
  budgetContractors?: number;
  actualCost?: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PLANNING: { label: 'Planificación', color: 'bg-info-muted text-info-muted-foreground', icon: Clock },
  APPROVED: { label: 'Aprobada', color: 'bg-purple-100 text-purple-800', icon: CheckCircle2 },
  IN_PROGRESS: { label: 'En Curso', color: 'bg-warning-muted text-warning-muted-foreground', icon: PlayCircle },
  COMPLETED: { label: 'Completada', color: 'bg-success-muted text-success', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelada', color: 'bg-destructive/10 text-destructive', icon: AlertCircle },
};

export default function ParadasPage() {
  const { currentCompany } = useCompany();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['shutdowns', currentCompany?.id, yearFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        companyId: String(currentCompany?.id),
      });
      if (yearFilter !== 'all') params.append('year', yearFilter);

      const res = await fetch(`/api/shutdowns?${params}`);
      if (!res.ok) throw new Error('Error fetching shutdowns');
      return res.json();
    },
    enabled: !!currentCompany?.id,
  });

  const shutdowns: Shutdown[] = data?.shutdowns || [];
  const summary = data?.summary || {};

  const filteredShutdowns = shutdowns.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase());

    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && s.status === statusFilter;
  });

  const formatCurrency = (value?: number) => {
    if (!value) return '-';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PauseCircle className="h-6 w-6" />
            Paradas Programadas
          </h1>
          <p className="text-muted-foreground">
            Gestión de paradas mayores y turnarounds
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Parada
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{summary.total || 0}</p>
              </div>
              <PauseCircle className="h-8 w-8 text-info-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Planificación</p>
                <p className="text-2xl font-bold text-info-muted-foreground">{summary.planning || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-info-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aprobadas</p>
                <p className="text-2xl font-bold text-purple-600">{summary.approved || 0}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En Curso</p>
                <p className="text-2xl font-bold text-warning-muted-foreground">{summary.inProgress || 0}</p>
              </div>
              <PlayCircle className="h-8 w-8 text-warning-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completadas</p>
                <p className="text-2xl font-bold text-success">{summary.completed || 0}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o código..."
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
            <SelectItem value="PLANNING">Planificación</SelectItem>
            <SelectItem value="APPROVED">Aprobadas</SelectItem>
            <SelectItem value="IN_PROGRESS">En Curso</SelectItem>
            <SelectItem value="COMPLETED">Completadas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Año" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="2026">2026</SelectItem>
            <SelectItem value="2025">2025</SelectItem>
            <SelectItem value="2024">2024</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Shutdown Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? (
          Array(4).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-32 bg-muted rounded" />
              </CardContent>
            </Card>
          ))
        ) : filteredShutdowns.length === 0 ? (
          <div className="col-span-2 text-center py-12">
            <PauseCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No se encontraron paradas programadas</p>
            <Button variant="outline" className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Programar primera parada
            </Button>
          </div>
        ) : (
          filteredShutdowns.map((shutdown) => {
            const statusConfig = STATUS_CONFIG[shutdown.status] || STATUS_CONFIG.PLANNING;
            const StatusIcon = statusConfig.icon;
            const progress = shutdown.packageCount > 0
              ? (shutdown.completedPackages / shutdown.packageCount) * 100
              : 0;
            const totalBudget = (shutdown.budgetLabor || 0) + (shutdown.budgetParts || 0) + (shutdown.budgetContractors || 0);
            const daysUntilStart = differenceInDays(new Date(shutdown.plannedStart), new Date());

            return (
              <Card key={shutdown.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{shutdown.name}</CardTitle>
                      <p className="text-sm text-muted-foreground font-mono">{shutdown.code}</p>
                    </div>
                    <Badge className={statusConfig.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Dates */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{format(new Date(shutdown.plannedStart), 'dd MMM', { locale: es })}</span>
                        <span>-</span>
                        <span>{format(new Date(shutdown.plannedEnd), 'dd MMM yyyy', { locale: es })}</span>
                      </div>
                      {daysUntilStart > 0 && shutdown.status === 'APPROVED' && (
                        <Badge variant="outline" className="text-xs">
                          En {daysUntilStart} días
                        </Badge>
                      )}
                    </div>

                    {/* Manager */}
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>Responsable: {shutdown.managerName}</span>
                    </div>

                    {/* Progress */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-1">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          Paquetes de trabajo
                        </span>
                        <span>{shutdown.completedPackages}/{shutdown.packageCount}</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    {/* Budget */}
                    {totalBudget > 0 && (
                      <div className="flex items-center justify-between text-sm border-t pt-2">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          Presupuesto
                        </span>
                        <span className="font-medium">{formatCurrency(totalBudget)}</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        Ver Detalle
                      </Button>
                      {shutdown.status === 'PLANNING' && (
                        <Button size="sm" className="flex-1">
                          Enviar a Aprobación
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
