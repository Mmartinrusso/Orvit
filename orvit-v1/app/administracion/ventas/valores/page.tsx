'use client';

/**
 * Gestión de Valores (Payment Instruments Management)
 *
 * Complete management of:
 * - Cheques (physical checks)
 * - Echeqs (electronic checks)
 * - Check states and lifecycle
 * - Deposit, endorsement, rejection tracking
 */

import { useState, useEffect } from 'react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, FileText, TrendingUp, Wallet, CheckCircle2, Clock, XCircle, ArrowRightLeft } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';

interface Cheque {
  id: number;
  numero: string;
  banco: string;
  titular: string;
  fechaEmision: Date;
  fechaVencimiento: Date;
  monto: number;
  tipo: 'FISICO' | 'ECHEQ';
  estado: 'CARTERA' | 'DEPOSITADO' | 'COBRADO' | 'RECHAZADO' | 'ENDOSADO';
  clientPaymentId?: number;
}

const ESTADO_CONFIG = {
  CARTERA: { label: 'En Cartera', color: 'bg-info-muted text-info-muted-foreground', icon: Wallet },
  DEPOSITADO: { label: 'Depositado', color: 'bg-purple-100 text-purple-700', icon: TrendingUp },
  COBRADO: { label: 'Cobrado', color: 'bg-success-muted text-success', icon: CheckCircle2 },
  RECHAZADO: { label: 'Rechazado', color: 'bg-destructive/10 text-destructive', icon: XCircle },
  ENDOSADO: { label: 'Endosado', color: 'bg-warning-muted text-warning-muted-foreground', icon: ArrowRightLeft },
};

export default function ValoresPage() {
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [activeTab, setActiveTab] = useState('cartera');

  useEffect(() => {
    loadCheques();
  }, []);

  const loadCheques = async () => {
    try {
      // Use tesoreria API which already handles cheques
      const response = await fetch('/api/tesoreria/cheques?limit=100', { credentials: 'include' });
      if (response.ok) {
        const result = await response.json();
        setCheques(result.data || []);
      }
    } catch (error) {
      console.error('Error loading cheques:', error);
    }
  };

  const filterCheques = (estado: string) => {
    if (estado === 'todos') return cheques;
    return cheques.filter((c) => c.estado === estado.toUpperCase());
  };

  const stats = {
    enCartera: cheques.filter((c) => c.estado === 'CARTERA').length,
    totalCartera: cheques
      .filter((c) => c.estado === 'CARTERA')
      .reduce((sum, c) => sum + Number(c.monto), 0),
    depositados: cheques.filter((c) => c.estado === 'DEPOSITADO').length,
    cobrados: cheques.filter((c) => c.estado === 'COBRADO').length,
  };

  return (
    <PermissionGuard permission="ventas.pagos.view">
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Valores</h1>
          <p className="text-muted-foreground">Cheques y echeqs recibidos</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wallet className="w-4 h-4 text-info-muted-foreground" />
                En Cartera
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enCartera}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(stats.totalCartera)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                Depositados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.depositados}</div>
              <p className="text-xs text-muted-foreground">Esperando cobro</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                Cobrados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.cobrados}</div>
              <p className="text-xs text-muted-foreground">Este mes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-info-muted-foreground" />
                Echeqs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {cheques.filter((c) => c.tipo === 'ECHEQ').length}
              </div>
              <p className="text-xs text-muted-foreground">Cheques electrónicos</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="cartera">En Cartera</TabsTrigger>
            <TabsTrigger value="depositados">Depositados</TabsTrigger>
            <TabsTrigger value="cobrados">Cobrados</TabsTrigger>
            <TabsTrigger value="todos">Todos</TabsTrigger>
          </TabsList>

          {['cartera', 'depositados', 'cobrados', 'todos'].map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-4">
              {filterCheques(tab).length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No hay cheques en esta categoría</p>
                  </CardContent>
                </Card>
              ) : (
                filterCheques(tab).map((cheque) => {
                  const config = ESTADO_CONFIG[cheque.estado];
                  const Icon = config.icon;
                  return (
                    <Card key={cheque.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-lg bg-info-muted flex items-center justify-center">
                                <CreditCard className="w-6 h-6 text-info-muted-foreground" />
                              </div>
                              <div>
                                <div className="font-semibold text-lg">{cheque.numero}</div>
                                <div className="text-sm text-muted-foreground">{cheque.banco}</div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                              <div>
                                <div className="text-xs text-muted-foreground">Titular</div>
                                <div className="font-medium">{cheque.titular}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">Emisión</div>
                                <div className="font-medium">
                                  {format(new Date(cheque.fechaEmision), 'dd/MM/yyyy')}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">Vencimiento</div>
                                <div className="font-medium">
                                  {format(new Date(cheque.fechaVencimiento), 'dd/MM/yyyy')}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">Tipo</div>
                                <Badge variant="outline">
                                  {cheque.tipo === 'ECHEQ' ? 'Echeq' : 'Físico'}
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="text-right space-y-2">
                            <div className="text-2xl font-bold text-success">
                              {formatCurrency(cheque.monto)}
                            </div>
                            <Badge className={config.color}>
                              <Icon className="w-3 h-3 mr-1" />
                              {config.label}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </PermissionGuard>
  );
}
