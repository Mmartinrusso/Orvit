'use client';

import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatNumber } from '@/lib/utils';
import {
  FileText,
  TrendingUp,
  DollarSign,
  Wallet,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SellerKPIs {
  cotizacionesEmitidas: number;
  tasaConversion: number;
  ventasTotal: number;
  comisionesPendientes: number;
  avanceCuotaPorcentaje: number;
  cuotaMensual: number;
}

interface SellerKpiCardsProps {
  kpis: SellerKPIs;
}

export function SellerKpiCards({ kpis }: SellerKpiCardsProps) {
  const cards = [
    {
      label: 'Cotizaciones Emitidas',
      value: kpis.cotizacionesEmitidas.toString(),
      gradient: '',
      iconBg: 'bg-muted',
      iconColor: 'text-muted-foreground',
      icon: FileText,
    },
    {
      label: 'Tasa Conversión',
      value: `${formatNumber(kpis.tasaConversion, 1)}%`,
      gradient: '',
      iconBg: 'bg-muted',
      iconColor: 'text-muted-foreground',
      icon: TrendingUp,
    },
    {
      label: 'Ventas Totales',
      value: formatCurrency(kpis.ventasTotal),
      gradient: '',
      iconBg: 'bg-muted',
      iconColor: 'text-muted-foreground',
      icon: DollarSign,
    },
    {
      label: 'Comisiones Pendientes',
      value: formatCurrency(kpis.comisionesPendientes),
      gradient: '',
      iconBg: 'bg-muted',
      iconColor: 'text-muted-foreground',
      icon: Wallet,
    },
    {
      label: 'Avance Cuota',
      value: `${Math.minformatNumber(kpis.avanceCuotaPorcentaje, 999, 0)}%`,
      subtitle: kpis.cuotaMensual > 0
        ? `de ${formatCurrency(kpis.cuotaMensual)}`
        : 'Sin cuota definida',
      gradient: '',
      iconBg: 'bg-muted',
      iconColor: 'text-muted-foreground',
      icon: Target,
      showProgress: true,
      progressValue: Math.min(kpis.avanceCuotaPorcentaje, 100),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <Card
          key={card.label}
          className=""
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground truncate">
                  {card.label}
                </p>
                <p className="text-2xl font-bold mt-1 truncate">{card.value}</p>
                {card.subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5">{card.subtitle}</p>
                )}
                {card.showProgress && (
                  <div className="mt-2 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        card.progressValue >= 100 ? 'bg-success' :
                        card.progressValue >= 70 ? 'bg-blue-500' :
                        'bg-amber-500'
                      )}
                      style={{ width: `${Math.min(card.progressValue, 100)}%` }}
                    />
                  </div>
                )}
              </div>
              <div className={cn('p-2 rounded-lg shrink-0', card.iconBg)}>
                <card.icon className={cn('h-4 w-4', card.iconColor)} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
