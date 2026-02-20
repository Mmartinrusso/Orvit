'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Search,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Heart,
} from 'lucide-react';

interface MachineHealth {
  id: number;
  name: string;
  healthScore: number;
  healthScoreUpdatedAt: string;
  status: string;
  lastFailure?: string;
  openWorkOrders: number;
  overdueMaintenances: number;
}

export default function HealthScorePage() {
  const { currentCompany } = useCompany();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['machine-health-scores', currentCompany?.id],
    queryFn: async () => {
      const res = await fetch(`/api/machines?companyId=${currentCompany?.id}&includeHealth=true`);
      if (!res.ok) throw new Error('Error al cargar datos');
      return res.json();
    },
    enabled: !!currentCompany?.id,
  });

  const machines: MachineHealth[] = data?.machines || [];

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-success bg-success-muted';
    if (score >= 60) return 'text-warning-muted-foreground bg-warning-muted';
    if (score >= 40) return 'text-warning-muted-foreground bg-warning-muted';
    return 'text-destructive bg-destructive/10';
  };

  const getHealthIcon = (score: number) => {
    if (score >= 80) return <CheckCircle2 className="h-5 w-5 text-success" />;
    if (score >= 60) return <Minus className="h-5 w-5 text-warning-muted-foreground" />;
    if (score >= 40) return <TrendingDown className="h-5 w-5 text-warning-muted-foreground" />;
    return <AlertTriangle className="h-5 w-5 text-destructive" />;
  };

  const filteredMachines = machines.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase());
    if (filter === 'all') return matchesSearch;
    if (filter === 'critical') return matchesSearch && (m.healthScore || 0) < 40;
    if (filter === 'warning') return matchesSearch && (m.healthScore || 0) >= 40 && (m.healthScore || 0) < 60;
    if (filter === 'good') return matchesSearch && (m.healthScore || 0) >= 60 && (m.healthScore || 0) < 80;
    if (filter === 'excellent') return matchesSearch && (m.healthScore || 0) >= 80;
    return matchesSearch;
  });

  const avgScore = machines.length > 0
    ? Math.round(machines.reduce((acc, m) => acc + (m.healthScore || 0), 0) / machines.length)
    : 0;

  const criticalCount = machines.filter(m => (m.healthScore || 0) < 40).length;
  const warningCount = machines.filter(m => (m.healthScore || 0) >= 40 && (m.healthScore || 0) < 60).length;
  const goodCount = machines.filter(m => (m.healthScore || 0) >= 60).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-destructive" />
            Health Score de Activos
          </h1>
          <p className="text-muted-foreground">
            Monitoreo del estado de salud de máquinas y equipos
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Score Promedio</p>
                <p className="text-3xl font-bold">{avgScore}%</p>
              </div>
              <div className={`p-3 rounded-full ${getHealthColor(avgScore)}`}>
                <Activity className="h-6 w-6" />
              </div>
            </div>
            <Progress value={avgScore} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Estado Crítico</p>
                <p className="text-3xl font-bold text-destructive">{criticalCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Requieren atención inmediata</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Con Advertencia</p>
                <p className="text-3xl font-bold text-warning-muted-foreground">{warningCount}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-warning-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Programar revisión</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En Buen Estado</p>
                <p className="text-3xl font-bold text-success">{goodCount}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Funcionando correctamente</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar máquina..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="critical">Crítico (&lt;40%)</SelectItem>
            <SelectItem value="warning">Advertencia (40-60%)</SelectItem>
            <SelectItem value="good">Bueno (60-80%)</SelectItem>
            <SelectItem value="excellent">Excelente (&gt;80%)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Machine List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-4" />
                <div className="h-8 bg-muted rounded w-1/2 mb-2" />
                <div className="h-2 bg-muted rounded w-full" />
              </CardContent>
            </Card>
          ))
        ) : filteredMachines.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No se encontraron máquinas</p>
          </div>
        ) : (
          filteredMachines.map((machine) => (
            <Card key={machine.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{machine.name}</CardTitle>
                  {getHealthIcon(machine.healthScore || 0)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Health Score</span>
                      <Badge className={getHealthColor(machine.healthScore || 0)}>
                        {machine.healthScore || 0}%
                      </Badge>
                    </div>
                    <Progress value={machine.healthScore || 0} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">OTs Abiertas:</span>
                      <Badge variant="outline">{machine.openWorkOrders || 0}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">MP Vencidos:</span>
                      <Badge variant={machine.overdueMaintenances ? 'destructive' : 'outline'}>
                        {machine.overdueMaintenances || 0}
                      </Badge>
                    </div>
                  </div>

                  {machine.healthScoreUpdatedAt && (
                    <p className="text-xs text-muted-foreground">
                      Actualizado: {new Date(machine.healthScoreUpdatedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
