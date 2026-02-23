'use client';

/**
 * Disputas/Reclamos (Disputes) Page - O2C Phase 5
 *
 * Customer dispute management for invoices
 */

import { useState, useEffect } from 'react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { formatDate } from '@/lib/date-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, FileText, Clock, CheckCircle2, XCircle, MessageSquare } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Disputa {
  id: number;
  invoiceId: number;
  invoiceNumero: string;
  clientId: string;
  clientName: string;
  motivo: string;
  descripcion: string;
  monto: number;
  estado: 'ABIERTA' | 'EN_REVISION' | 'RESUELTA' | 'RECHAZADA';
  prioridad: 'ALTA' | 'MEDIA' | 'BAJA';
  fechaCreacion: Date;
}

const ESTADO_CONFIG = {
  ABIERTA: { label: 'Abierta', color: 'bg-destructive/10 text-destructive', icon: AlertTriangle },
  EN_REVISION: { label: 'En Revisión', color: 'bg-warning-muted text-warning-muted-foreground', icon: Clock },
  RESUELTA: { label: 'Resuelta', color: 'bg-success-muted text-success', icon: CheckCircle2 },
  RECHAZADA: { label: 'Rechazada', color: 'bg-muted text-foreground', icon: XCircle },
};

export default function DisputasPage() {
  const [disputas, setDisputas] = useState<Disputa[]>([]);

  useEffect(() => {
    loadDisputas();
  }, []);

  const loadDisputas = async () => {
    try {
      const response = await fetch('/api/ventas/disputas', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setDisputas(data.data || []);
      }
    } catch (error) {
      console.error('Error loading disputas:', error);
    }
  };

  const stats = {
    abiertas: disputas.filter((d) => d.estado === 'ABIERTA').length,
    enRevision: disputas.filter((d) => d.estado === 'EN_REVISION').length,
    resueltas: disputas.filter((d) => d.estado === 'RESUELTA').length,
    montoTotal: disputas
      .filter((d) => d.estado !== 'RESUELTA')
      .reduce((sum, d) => sum + Number(d.monto), 0),
  };

  return (
    <PermissionGuard permission="ventas.facturas.view">
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Disputas y Reclamos</h1>
          <p className="text-muted-foreground">Gestión de reclamos de clientes</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                Abiertas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.abiertas}</div>
              <p className="text-xs text-muted-foreground">Requieren atención</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-warning-muted-foreground" />
                En Revisión
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enRevision}</div>
              <p className="text-xs text-muted-foreground">En proceso</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                Resueltas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.resueltas}</div>
              <p className="text-xs text-muted-foreground">Este mes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-info-muted-foreground" />
                Monto Disputado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{formatCurrency(stats.montoTotal)}</div>
              <p className="text-xs text-muted-foreground">Pendiente resolución</p>
            </CardContent>
          </Card>
        </div>

        {/* Disputas List */}
        <div className="space-y-4">
          {disputas.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay disputas activas</p>
              </CardContent>
            </Card>
          ) : (
            disputas.map((disputa) => {
              const config = ESTADO_CONFIG[disputa.estado];
              const Icon = config.icon;
              return (
                <Card key={disputa.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-destructive" />
                          </div>
                          <div>
                            <div className="font-semibold">{disputa.motivo}</div>
                            <div className="text-sm text-muted-foreground">
                              Factura {disputa.invoiceNumero} - {disputa.clientName}
                            </div>
                          </div>
                        </div>

                        <p className="text-sm">{disputa.descripcion}</p>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>
                            Creada: {formatDate(disputa.fechaCreacion)}
                          </span>
                          <Badge variant={disputa.prioridad === 'ALTA' ? 'destructive' : 'outline'}>
                            {disputa.prioridad}
                          </Badge>
                        </div>
                      </div>

                      <div className="text-right space-y-2">
                        <div className="text-xl font-bold">{formatCurrency(disputa.monto)}</div>
                        <Badge className={config.color}>
                          <Icon className="w-3 h-3 mr-1" />
                          {config.label}
                        </Badge>
                        <div>
                          <Button variant="outline" size="sm">
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Ver Detalles
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
