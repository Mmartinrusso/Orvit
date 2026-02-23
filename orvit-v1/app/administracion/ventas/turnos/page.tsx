'use client';

/**
 * Turnos de Retiro (Pickup Slots) Page - O2C Phase 4
 */

import { useState, useEffect } from 'react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { formatDate } from '@/lib/date-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Package, User, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

interface Turno {
  id: number;
  fecha: Date;
  horaInicio: string;
  horaFin: string;
  clientId: string;
  clientName: string;
  orderId: number;
  orderNumero: string;
  estado: 'RESERVADO' | 'CONFIRMADO' | 'COMPLETADO' | 'CANCELADO';
  notas: string;
}

const ESTADO_CONFIG = {
  RESERVADO: { label: 'Reservado', color: 'bg-info-muted text-info-muted-foreground' },
  CONFIRMADO: { label: 'Confirmado', color: 'bg-success-muted text-success' },
  COMPLETADO: { label: 'Completado', color: 'bg-muted text-foreground' },
  CANCELADO: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive' },
};

export default function TurnosPage() {
  const [turnos, setTurnos] = useState<Turno[]>([]);

  useEffect(() => {
    loadTurnos();
  }, []);

  const loadTurnos = async () => {
    try {
      const response = await fetch('/api/ventas/turnos', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setTurnos(data.data || []);
      }
    } catch (error) {
      console.error('Error loading turnos:', error);
    }
  };

  const turnosHoy = turnos.filter(
    (t) => format(new Date(t.fecha), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  );

  return (
    <PermissionGuard permission="ventas.ordenes.view">
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Turnos de Retiro</h1>
          <p className="text-muted-foreground">Gestión de turnos para pickup</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4 text-info-muted-foreground" />
                Turnos Hoy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{turnosHoy.length}</div>
              <p className="text-xs text-muted-foreground">Retiros programados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-success" />
                Confirmados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {turnos.filter((t) => t.estado === 'CONFIRMADO').length}
              </div>
              <p className="text-xs text-muted-foreground">Listos para retiro</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-purple-600" />
                Completados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {turnos.filter((t) => t.estado === 'COMPLETADO').length}
              </div>
              <p className="text-xs text-muted-foreground">Este mes</p>
            </CardContent>
          </Card>
        </div>

        {/* Turnos Timeline */}
        <div className="space-y-4">
          {turnos.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay turnos programados</p>
              </CardContent>
            </Card>
          ) : (
            turnos.map((turno) => {
              const config = ESTADO_CONFIG[turno.estado];
              return (
                <Card key={turno.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-info-muted flex items-center justify-center">
                            <Package className="w-5 h-5 text-info-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-semibold">Orden {turno.orderNumero}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {turno.clientName}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            {formatDate(turno.fecha)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            {turno.horaInicio} - {turno.horaFin}
                          </div>
                        </div>

                        {turno.notas && <p className="text-sm text-muted-foreground">{turno.notas}</p>}
                      </div>

                      <Badge className={config.color}>{config.label}</Badge>
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
