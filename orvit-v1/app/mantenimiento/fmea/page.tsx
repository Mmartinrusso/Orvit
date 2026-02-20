'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { FMEAList } from '@/components/fmea';
import {
  AlertTriangle,
  TrendingDown,
  Activity,
  BarChart3,
  Target,
} from 'lucide-react';

export default function FMEAPage() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [activeTab, setActiveTab] = useState('analysis');

  // Fetch machines with components
  const { data: machinesData, isLoading: machinesLoading } = useQuery({
    queryKey: ['machines', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return { machines: [] };
      const res = await fetch(`/api/machines?companyId=${currentCompany.id}&includeComponents=true`);
      if (!res.ok) throw new Error('Error fetching machines');
      return res.json();
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch FMEA summary for dashboard
  const { data: fmeaSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['fmea-summary', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const res = await fetch(`/api/fmea?companyId=${currentCompany.id}`);
      if (!res.ok) throw new Error('Error fetching FMEA summary');
      return res.json();
    },
    enabled: !!currentCompany?.id,
  });

  const machines = useMemo(() => {
    return machinesData?.machines?.map((m: any) => ({
      id: m.id,
      name: m.name,
      components: m.components?.map((c: any) => ({
        id: c.id,
        name: c.name,
      })) || [],
    })) || [];
  }, [machinesData]);

  const summary = fmeaSummary?.summary;

  if (!currentCompany) {
    return (
      <div className="container mx-auto py-6 px-4">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Seleccione una empresa para ver el análisis FMEA
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingDown className="h-6 w-6" />
            Análisis FMEA
          </h1>
          <p className="text-muted-foreground">
            Análisis de Modos de Falla y sus Efectos - Gestión proactiva de riesgos
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Análisis</p>
                  <p className="text-2xl font-bold">{summary.total}</p>
                </div>
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/30 bg-destructive/10">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-destructive">Alto Riesgo</p>
                  <p className="text-2xl font-bold text-destructive">{summary.highRisk}</p>
                  <p className="text-xs text-destructive">RPN ≥ 200</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-warning-muted bg-warning-muted">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-warning-muted-foreground">Riesgo Medio</p>
                  <p className="text-2xl font-bold text-warning-muted-foreground">{summary.mediumRisk}</p>
                  <p className="text-xs text-warning-muted-foreground">RPN 100-199</p>
                </div>
                <BarChart3 className="h-8 w-8 text-warning-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-success-muted bg-success-muted">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-success">Bajo Riesgo</p>
                  <p className="text-2xl font-bold text-success">{summary.lowRisk}</p>
                  <p className="text-xs text-success">RPN &lt; 100</p>
                </div>
                <Target className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="analysis">Análisis de Fallas</TabsTrigger>
          <TabsTrigger value="priorities">Prioridades</TabsTrigger>
          <TabsTrigger value="trends">Tendencias</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="mt-4">
          {machinesLoading ? (
            <Skeleton className="h-96" />
          ) : (
            <FMEAList companyId={currentCompany.id} machines={machines} />
          )}
        </TabsContent>

        <TabsContent value="priorities" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Fallas de Alta Prioridad
              </CardTitle>
              <CardDescription>
                Fallas que requieren atención inmediata (RPN ≥ 200)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {fmeaSummary?.failureModes?.filter((fm: any) => fm.rpn >= 200).length > 0 ? (
                <div className="space-y-3">
                  {fmeaSummary.failureModes
                    .filter((fm: any) => fm.rpn >= 200)
                    .sort((a: any, b: any) => b.rpn - a.rpn)
                    .map((fm: any) => (
                      <div
                        key={fm.id}
                        className="flex items-center justify-between p-3 border border-destructive/30 rounded-lg bg-destructive/10"
                      >
                        <div>
                          <p className="font-medium">{fm.failureMode}</p>
                          <p className="text-sm text-muted-foreground">
                            {fm.machine?.name}
                            {fm.component && ` / ${fm.component.name}`}
                          </p>
                          {fm.recommendedActions && (
                            <p className="text-xs text-destructive mt-1">
                              Acción: {fm.recommendedActions}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge variant="destructive" className="text-lg px-3">
                            RPN: {fm.rpn}
                          </Badge>
                          <div className="text-xs text-muted-foreground mt-1">
                            S:{fm.severity} O:{fm.occurrence} D:{fm.detectability}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-2 text-success" />
                  <p>No hay fallas de alta prioridad</p>
                  <p className="text-sm">Todas las fallas están bajo control</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Tendencias de RPN</CardTitle>
              <CardDescription>
                Evolución del Número de Prioridad de Riesgo en el tiempo
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-12 text-muted-foreground">
              <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>Gráfico de tendencias</p>
              <p className="text-sm">
                Se mostrará cuando haya suficientes datos históricos
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
