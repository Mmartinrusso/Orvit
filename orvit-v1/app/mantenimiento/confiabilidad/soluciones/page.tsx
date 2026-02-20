'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lightbulb, CheckCircle2, Construction } from 'lucide-react';

export default function SolucionesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Base de Soluciones</h1>
        <p className="text-muted-foreground">
          Conocimiento acumulado de soluciones aplicadas a fallas
        </p>
      </div>

      {/* KPIs placeholder */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Soluciones Registradas</CardTitle>
            <Lightbulb className="h-4 w-4 text-warning-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">---</div>
            <p className="text-xs text-muted-foreground">Total en base de conocimiento</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Efectivas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">---%</div>
            <p className="text-xs text-muted-foreground">Tasa de éxito</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Más Usada</CardTitle>
            <Lightbulb className="h-4 w-4 text-info-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">---</div>
            <p className="text-xs text-muted-foreground">Solución top</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            En desarrollo
          </CardTitle>
          <CardDescription>
            Base de conocimiento de diagnósticos y soluciones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Construction className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground max-w-md">
              Esta sección centralizará todas las soluciones aplicadas a fallas,
              permitiendo buscar por síntoma, componente o máquina. Incluirá
              diagnósticos, pasos de solución, y efectividad reportada.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
