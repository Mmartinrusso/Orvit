'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, CheckCircle2, AlertTriangle, XCircle, Construction } from 'lucide-react';

export default function SaludActivosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Salud de Activos</h1>
        <p className="text-muted-foreground">
          Estado de salud y condición de máquinas y equipos
        </p>
      </div>

      {/* KPIs placeholder */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Óptimo</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">---</div>
            <p className="text-xs text-muted-foreground">Activos en buen estado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atención</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning-muted-foreground">---</div>
            <p className="text-xs text-muted-foreground">Requieren monitoreo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crítico</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">---</div>
            <p className="text-xs text-muted-foreground">Acción inmediata</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Score Promedio</CardTitle>
            <Activity className="h-4 w-4 text-info-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">---%</div>
            <p className="text-xs text-muted-foreground">Salud general</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            En desarrollo
          </CardTitle>
          <CardDescription>
            Dashboard de salud y condición de activos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Construction className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground max-w-md">
              Esta sección mostrará el estado de salud de cada activo basado en:
              frecuencia de fallas, cumplimiento de preventivos, antigüedad,
              y criticidad operativa.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
