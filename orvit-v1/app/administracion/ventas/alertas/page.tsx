'use client';

/**
 * Alertas de Riesgo (Risk Alerts) Page
 *
 * Credit and financial risk alerts
 */

import { useState, useEffect } from 'react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { formatDate } from '@/lib/date-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, AlertCircle, XCircle, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Alert {
  id: number;
  clientId: string;
  clientName: string;
  tipo: 'LIMITE_CREDITO' | 'MORA' | 'CHEQUE_RECHAZADO' | 'PAGO_ATRASADO';
  severidad: 'ALTA' | 'MEDIA' | 'BAJA';
  descripcion: string;
  monto: number;
  fecha: Date;
  isActive: boolean;
}

const TIPO_CONFIG = {
  LIMITE_CREDITO: {
    label: 'Límite de Crédito',
    icon: DollarSign,
    color: 'bg-destructive/10 text-destructive border-destructive/30',
  },
  MORA: {
    label: 'Mora',
    icon: Calendar,
    color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted',
  },
  CHEQUE_RECHAZADO: {
    label: 'Cheque Rechazado',
    icon: XCircle,
    color: 'bg-destructive/10 text-destructive border-destructive/30',
  },
  PAGO_ATRASADO: {
    label: 'Pago Atrasado',
    icon: AlertCircle,
    color: 'bg-warning-muted text-warning-muted-foreground border-warning-muted',
  },
};

const SEVERIDAD_CONFIG = {
  ALTA: { label: 'Alta', color: 'bg-destructive/10 text-destructive' },
  MEDIA: { label: 'Media', color: 'bg-warning-muted text-warning-muted-foreground' },
  BAJA: { label: 'Baja', color: 'bg-info-muted text-info-muted-foreground' },
};

export default function AlertasPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const response = await fetch('/api/ventas/risk-alerts', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const activeAlerts = alerts.filter((a) => a.isActive);
  const stats = {
    alta: activeAlerts.filter((a) => a.severidad === 'ALTA').length,
    media: activeAlerts.filter((a) => a.severidad === 'MEDIA').length,
    baja: activeAlerts.filter((a) => a.severidad === 'BAJA').length,
  };

  return (
    <PermissionGuard permission="ventas.clientes.view">
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Alertas de Riesgo</h1>
          <p className="text-muted-foreground">Alertas crediticias y de cobranza</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                Alertas Activas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeAlerts.length}</div>
              <p className="text-xs text-muted-foreground">Requieren atención</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <XCircle className="w-4 h-4 text-destructive" />
                Alta Prioridad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.alta}</div>
              <p className="text-xs text-muted-foreground">Acción inmediata</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-warning-muted-foreground" />
                Media Prioridad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.media}</div>
              <p className="text-xs text-muted-foreground">Revisión necesaria</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-info-muted-foreground" />
                Baja Prioridad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.baja}</div>
              <p className="text-xs text-muted-foreground">Monitoreo</p>
            </CardContent>
          </Card>
        </div>

        {/* Alerts List */}
        <div className="space-y-4">
          {activeAlerts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay alertas activas</p>
              </CardContent>
            </Card>
          ) : (
            activeAlerts.map((alert) => {
              const tipoConfig = TIPO_CONFIG[alert.tipo];
              const sevConfig = SEVERIDAD_CONFIG[alert.severidad];
              const TipoIcon = tipoConfig.icon;
              return (
                <Card
                  key={alert.id}
                  className={`border-l-4 ${
                    alert.severidad === 'ALTA'
                      ? 'border-l-red-500'
                      : alert.severidad === 'MEDIA'
                      ? 'border-l-yellow-500'
                      : 'border-l-blue-500'
                  }`}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg ${
                              alert.severidad === 'ALTA'
                                ? 'bg-destructive/10'
                                : alert.severidad === 'MEDIA'
                                ? 'bg-warning-muted'
                                : 'bg-info-muted'
                            } flex items-center justify-center`}
                          >
                            <TipoIcon
                              className={`w-5 h-5 ${
                                alert.severidad === 'ALTA'
                                  ? 'text-destructive'
                                  : alert.severidad === 'MEDIA'
                                  ? 'text-warning-muted-foreground'
                                  : 'text-info-muted-foreground'
                              }`}
                            />
                          </div>
                          <div>
                            <div className="font-semibold">{tipoConfig.label}</div>
                            <div className="text-sm text-muted-foreground">{alert.clientName}</div>
                          </div>
                        </div>

                        <p className="text-sm">{alert.descripcion}</p>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{formatDate(alert.fecha)}</span>
                          <span>•</span>
                          <span>{formatCurrency(alert.monto)}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Badge className={sevConfig.color}>{sevConfig.label}</Badge>
                        <div>
                          <Button variant="outline" size="sm">
                            Resolver
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </PermissionGuard>
  );
}
