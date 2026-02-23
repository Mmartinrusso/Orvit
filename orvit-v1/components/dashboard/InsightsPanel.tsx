'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  FileText,
  BarChart3,
  Target,
  Zap
} from 'lucide-react';
import { Insight, ChartData, Mover } from './types';
import { formatCurrency, formatPercentage } from './utils/metrics';

interface InsightsPanelProps {
  data: ChartData[];
  movers: Mover[];
  insights?: Insight[];
}

export function InsightsPanel({ data, movers, insights = [] }: InsightsPanelProps) {
  // Generar insights automáticos basados en los datos
  const generateInsights = (): Insight[] => {
    const generatedInsights: Insight[] = [];
    
    if (data.length < 2) return generatedInsights;

    const currentMonth = data[data.length - 1];
    const previousMonth = data[data.length - 2];
    
    // Calcular cambios principales
    const ventasChange = currentMonth.ventas - previousMonth.ventas;
    const ventasChangePct = previousMonth.ventas > 0 ? (ventasChange / previousMonth.ventas) * 100 : 0;
    
    const costosChange = currentMonth.costos - previousMonth.costos;
    const costosChangePct = previousMonth.costos > 0 ? (costosChange / previousMonth.costos) * 100 : 0;
    
    const sueldosChange = currentMonth.sueldos - previousMonth.sueldos;
    const sueldosChangePct = previousMonth.sueldos > 0 ? (sueldosChange / previousMonth.sueldos) * 100 : 0;

    // Insight 1: Crecimiento general
    if (ventasChangePct > 5) {
      generatedInsights.push({
        type: 'positive',
        title: 'Crecimiento Sostenido',
        description: `↑ ${formatCurrency(ventasChange)} vs mes anterior por Ventas (+${formatPercentage(ventasChangePct)}). Top contribuyente: ${movers[0]?.name || 'N/A'} (+${formatCurrency(movers[0]?.delta || 0)}).`,
        actions: [
          { label: 'Crear tarea', onClick: () => {} },
          { label: 'Ver facturas', onClick: () => {} },
        ],
      });
    } else if (ventasChangePct < -5) {
      generatedInsights.push({
        type: 'negative',
        title: 'Descenso en Ventas',
        description: `↓ ${formatCurrency(Math.abs(ventasChange))} vs mes anterior en Ventas (${formatPercentage(ventasChangePct)}). Revisar estrategias de venta y clientes principales.`,
        actions: [
          { label: 'Analizar causas', onClick: () => {} },
          { label: 'Plan de acción', onClick: () => {} },
        ],
      });
    }

    // Insight 2: Control de costos
    if (costosChangePct > 10) {
      generatedInsights.push({
        type: 'warning',
        title: 'Atención: Aumento de Costos',
        description: `Costos aumentaron ${formatPercentage(costosChangePct)} vs mes anterior (+${formatCurrency(costosChange)}). Revisar proveedores y negociaciones.`,
        actions: [
          { label: 'Revisar proveedores', onClick: () => {} },
          { label: 'Optimizar costos', onClick: () => {} },
        ],
      });
    } else if (costosChangePct < -5) {
      generatedInsights.push({
        type: 'positive',
        title: 'Optimización de Costos',
        description: `Costos reducidos ${formatPercentage(Math.abs(costosChangePct))} vs mes anterior (-${formatCurrency(Math.abs(costosChange))}). Excelente gestión de eficiencia.`,
        actions: [
          { label: 'Documentar prácticas', onClick: () => {} },
          { label: 'Replicar estrategia', onClick: () => {} },
        ],
      });
    }

    // Insight 3: Gestión de sueldos
    if (sueldosChangePct > 15) {
      generatedInsights.push({
        type: 'warning',
        title: 'Aumento Significativo en Sueldos',
        description: `Sueldos aumentaron ${formatPercentage(sueldosChangePct)} vs mes anterior (+${formatCurrency(sueldosChange)}). Verificar si es por nuevos empleados o aumentos.`,
        actions: [
          { label: 'Revisar nómina', onClick: () => {} },
          { label: 'Planificar presupuesto', onClick: () => {} },
        ],
      });
    }

    // Insight 4: Top movers
    const topPositiveMover = movers.find(m => m.delta > 0);
    const topNegativeMover = movers.find(m => m.delta < 0);
    
    if (topPositiveMover) {
      generatedInsights.push({
        type: 'positive',
        title: 'Top Contribuyente Positivo',
        description: `${topPositiveMover.name} contribuyó +${formatCurrency(topPositiveMover.delta)} (${formatPercentage(topPositiveMover.deltaPct)}) al crecimiento total. Representa ${formatNumber(topPositiveMover.contributionPct, 1)}% del cambio.`,
        actions: [
          { label: 'Analizar estrategia', onClick: () => {} },
          { label: 'Replicar modelo', onClick: () => {} },
        ],
      });
    }

    if (topNegativeMover) {
      generatedInsights.push({
        type: 'negative',
        title: 'Atención: Mayor Impacto Negativo',
        description: `${topNegativeMover.name} impactó negativamente con ${formatCurrency(topNegativeMover.delta)} (${formatPercentage(topNegativeMover.deltaPct)}). Revisar causas y tomar acciones correctivas.`,
        actions: [
          { label: 'Investigar causas', onClick: () => {} },
          { label: 'Plan de recuperación', onClick: () => {} },
        ],
      });
    }

    // Insight 5: Análisis de tendencia
    if (data.length >= 3) {
      const lastThreeMonths = data.slice(-3);
      const trend = lastThreeMonths.map((month, index) => ({
        month: index + 1,
        ventas: month.ventas,
      }));
      
      const isGrowing = trend.every((point, index) => 
        index === 0 || point.ventas >= trend[index - 1].ventas
      );
      
      const isDeclining = trend.every((point, index) => 
        index === 0 || point.ventas <= trend[index - 1].ventas
      );

      if (isGrowing) {
        generatedInsights.push({
          type: 'positive',
          title: 'Tendencia Creciente',
          description: 'Las ventas han mostrado crecimiento consistente en los últimos 3 meses. Mantener estrategias actuales.',
          actions: [
            { label: 'Sostener estrategia', onClick: () => {} },
            { label: 'Escalar operaciones', onClick: () => {} },
          ],
        });
      } else if (isDeclining) {
        generatedInsights.push({
          type: 'negative',
          title: 'Tendencia Declinante',
          description: 'Las ventas han mostrado declive en los últimos 3 meses. Revisar estrategias y tomar acciones inmediatas.',
          actions: [
            { label: 'Revisar estrategia', onClick: () => {} },
            { label: 'Acción inmediata', onClick: () => {} },
          ],
        });
      }
    }

    return generatedInsights;
  };

  const allInsights = [...insights, ...generateInsights()];

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'positive':
        return <CheckCircle className="h-5 w-5 text-success" />;
      case 'negative':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-warning-muted-foreground" />;
      default:
        return <BarChart3 className="h-5 w-5 text-info-muted-foreground" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'positive':
        return 'bg-success-muted border-success-muted';
      case 'negative':
        return 'bg-destructive/10 border-destructive/30';
      case 'warning':
        return 'bg-warning-muted border-warning-muted';
      default:
        return 'bg-info-muted border-info-muted';
    }
  };

  const getInsightTextColor = (type: string) => {
    switch (type) {
      case 'positive':
        return 'text-success';
      case 'negative':
        return 'text-destructive';
      case 'warning':
        return 'text-warning-muted-foreground';
      default:
        return 'text-info-muted-foreground';
    }
  };

  if (allInsights.length === 0) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">
            Insights Automáticos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">No hay suficientes datos para generar insights</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            Insights Automáticos
          </CardTitle>
          <Badge variant="secondary" className="bg-info-muted text-info-muted-foreground border-info-muted">
            {allInsights.length} insights
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {allInsights.map((insight, index) => (
          <div
            key={index}
            className={cn('p-4 rounded-xl border', getInsightColor(insight.type))}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {getInsightIcon(insight.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className={cn('font-medium', getInsightTextColor(insight.type))}>
                    {insight.title}
                  </h4>
                  <Badge 
                    variant="secondary" 
                    className={cn('text-xs', insight.type === 'positive' ? 'bg-success-muted text-success border-success-muted' : insight.type === 'negative' ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-warning-muted text-warning-muted-foreground border-warning-muted')}
                  >
                    {insight.type === 'positive' ? 'Positivo' : 
                     insight.type === 'negative' ? 'Negativo' : 'Advertencia'}
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                  {insight.description}
                </p>
                
                <div className="flex flex-wrap gap-2">
                  {insight.actions.map((action, actionIndex) => (
                    <Button
                      key={actionIndex}
                      variant="outline"
                      size="sm"
                      onClick={action.onClick}
                      className="h-7 px-3 text-xs bg-card border-border text-foreground hover:bg-accent"
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Acciones globales */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Insights generados automáticamente basados en los datos
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {}}
                className="h-7 px-3 text-xs bg-card border-border text-foreground hover:bg-accent"
              >
                <FileText className="h-3 w-3 mr-1" />
                Reporte
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {}}
                className="h-7 px-3 text-xs bg-card border-border text-foreground hover:bg-accent"
              >
                <Target className="h-3 w-3 mr-1" />
                Alertas
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
