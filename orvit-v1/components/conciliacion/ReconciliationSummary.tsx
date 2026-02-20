'use client';

import { useUserColors } from '@/hooks/use-user-colors';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  BarChart3,
  ArrowRightLeft,
  Target,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';



interface ReconciliationSummaryProps {
  saldoContable: number;
  saldoBancario: number;
  totalItems: number;
  itemsConciliados: number;
  itemsPendientes: number;
  itemsSuspense: number;
  matchBreakdown?: Record<string, number>;
}

export default function ReconciliationSummary({
  saldoContable,
  saldoBancario,
  totalItems,
  itemsConciliados,
  itemsPendientes,
  itemsSuspense,
  matchBreakdown,
}: ReconciliationSummaryProps) {
  const userColors = useUserColors();
  const diferencia = saldoBancario - saldoContable;
  const porcentajeConciliado = totalItems > 0 ? (itemsConciliados / totalItems) * 100 : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {/* Saldo Contable */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Saldo Contable
              </p>
              <p className="text-lg font-bold mt-1">{formatCurrency(saldoContable)}</p>
              <p className="text-xs text-muted-foreground mt-1">Según sistema</p>
            </div>
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${userColors.chart1}15` }}
            >
              <BarChart3 className="h-5 w-5" style={{ color: userColors.chart1 }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Saldo Bancario */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Saldo Bancario
              </p>
              <p className="text-lg font-bold mt-1">{formatCurrency(saldoBancario)}</p>
              <p className="text-xs text-muted-foreground mt-1">Según extracto</p>
            </div>
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${userColors.chart6}15` }}
            >
              <ArrowRightLeft className="h-5 w-5" style={{ color: userColors.chart6 }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diferencia */}
      <Card style={diferencia !== 0 ? {
        borderColor: `${userColors.chart4}50`,
        backgroundColor: `${userColors.chart4}08`,
      } : {}}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Diferencia
              </p>
              <p
                className="text-lg font-bold mt-1"
                style={{
                  color: diferencia === 0
                    ? userColors.kpiPositive
                    : userColors.kpiNegative,
                }}
              >
                {formatCurrency(diferencia)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {diferencia === 0 ? 'Sin diferencia' : 'Por ajustar'}
              </p>
            </div>
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: diferencia === 0
                  ? `${userColors.kpiPositive}15`
                  : `${userColors.kpiNegative}15`,
              }}
            >
              {diferencia === 0 ? (
                <Target className="h-5 w-5" style={{ color: userColors.kpiPositive }} />
              ) : (
                <AlertCircle className="h-5 w-5" style={{ color: userColors.kpiNegative }} />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conciliados */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Conciliados
              </p>
              <p className="text-lg font-bold mt-1" style={{ color: userColors.kpiPositive }}>
                {itemsConciliados}
                <span className="text-sm text-muted-foreground font-normal">/{totalItems}</span>
              </p>
              <div className="mt-2">
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      backgroundColor: userColors.kpiPositive,
                      width: `${porcentajeConciliado}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {porcentajeConciliado.toFixed(0)}%
                </p>
              </div>
            </div>
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${userColors.kpiPositive}15` }}
            >
              <CheckCircle2 className="h-5 w-5" style={{ color: userColors.kpiPositive }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pendientes */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Pendientes
              </p>
              <p className="text-lg font-bold mt-1" style={{ color: userColors.chart1 }}>
                {itemsPendientes}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Sin conciliar</p>
            </div>
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${userColors.chart1}15` }}
            >
              <Clock className="h-5 w-5" style={{ color: userColors.chart1 }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suspense */}
      <Card style={itemsSuspense > 0 ? {
        borderColor: `${userColors.chart4}50`,
        backgroundColor: `${userColors.chart4}08`,
      } : {}}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Suspense
              </p>
              <p className="text-lg font-bold mt-1" style={{ color: userColors.chart4 }}>
                {itemsSuspense}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Requieren revisión</p>
            </div>
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${userColors.chart4}15` }}
            >
              <AlertCircle className="h-5 w-5" style={{ color: userColors.chart4 }} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
