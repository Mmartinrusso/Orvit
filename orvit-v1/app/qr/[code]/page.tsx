'use client';

import { useEffect, useState, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthContext } from '@/contexts/AuthContext';
import {
  Wrench,
  AlertTriangle,
  ClipboardList,
  History,
  Settings,
  Activity,
  ArrowRight,
  QrCode,
  Loader2,
} from 'lucide-react';

interface Machine {
  id: number;
  name: string;
  assetCode?: string;
  status: string;
  healthScore?: number;
  company: { id: number; name: string };
  area?: { id: number; name: string };
  sector?: { id: number; name: string };
}

interface Params {
  params: { code: string };
}

export default function QRLandingPage({ params }: Params) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useContext(AuthContext);
  const [machine, setMachine] = useState<Machine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMachine = async () => {
      try {
        const res = await fetch(`/api/qr/${params.code}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('Máquina no encontrada');
          } else {
            setError('Error al cargar información');
          }
          return;
        }
        const data = await res.json();
        setMachine(data.machine);
      } catch (err) {
        setError('Error de conexión');
      } finally {
        setLoading(false);
      }
    };

    fetchMachine();
  }, [params.code]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p>Cargando información...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <QrCode className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-xl font-bold mb-2">Código QR no válido</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.push('/')}>
              Ir al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!machine) return null;

  const getHealthColor = (score?: number) => {
    if (!score) return 'bg-gray-100 text-gray-800';
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 50) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-800';
  };

  const getHealthLabel = (score?: number) => {
    if (!score) return 'Sin datos';
    if (score >= 80) return 'Bueno';
    if (score >= 50) return 'Regular';
    return 'Crítico';
  };

  const quickActions = [
    {
      label: 'Reportar Falla',
      icon: AlertTriangle,
      href: `/mantenimiento/fallas/nueva?machineId=${machine.id}`,
      variant: 'destructive' as const,
    },
    {
      label: 'Crear OT',
      icon: ClipboardList,
      href: `/mantenimiento/ordenes/nueva?machineId=${machine.id}`,
      variant: 'default' as const,
    },
    {
      label: 'Ver Historial',
      icon: History,
      href: `/mantenimiento/maquinas/${machine.id}/historial`,
      variant: 'outline' as const,
    },
    {
      label: 'Ver Detalles',
      icon: Settings,
      href: `/mantenimiento/maquinas/${machine.id}`,
      variant: 'outline' as const,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Machine Info Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">{machine.name}</CardTitle>
                {machine.assetCode && (
                  <CardDescription>Código: {machine.assetCode}</CardDescription>
                )}
              </div>
              <Badge className={getHealthColor(machine.healthScore)}>
                {getHealthLabel(machine.healthScore)}
                {machine.healthScore !== undefined && ` (${machine.healthScore})`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Empresa:</span>
                <span>{machine.company.name}</span>
              </div>
              {machine.area && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Área:</span>
                  <span>{machine.area.name}</span>
                </div>
              )}
              {machine.sector && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sector:</span>
                  <span>{machine.sector.name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estado:</span>
                <Badge variant={machine.status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {machine.status === 'ACTIVE' ? 'Activo' : machine.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        {user ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Acciones Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant={action.variant}
                  className="h-auto py-3 flex-col"
                  onClick={() => router.push(action.href)}
                >
                  <action.icon className="h-5 w-5 mb-1" />
                  <span className="text-xs">{action.label}</span>
                </Button>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-muted-foreground mb-4">
                Inicie sesión para acceder a acciones rápidas
              </p>
              <Button onClick={() => router.push('/login')}>
                Iniciar Sesión
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Health Score Detail (if available) */}
        {machine.healthScore !== undefined && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Estado de Salud
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold">{machine.healthScore}</div>
                <div className="flex-1">
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        machine.healthScore >= 80
                          ? 'bg-green-500'
                          : machine.healthScore >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${machine.healthScore}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {machine.healthScore >= 80
                      ? 'Equipo en buen estado'
                      : machine.healthScore >= 50
                      ? 'Requiere atención preventiva'
                      : 'Atención urgente requerida'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4">
          <p>Escaneado desde código QR</p>
          <p className="mt-1">ORVIT - Sistema de Gestión de Mantenimiento</p>
        </div>
      </div>
    </div>
  );
}
