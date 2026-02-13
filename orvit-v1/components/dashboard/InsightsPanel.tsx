'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
          { label: 'Crear tarea', onClick: () => console.log('Crear tarea de crecimiento') },
          { label: 'Ver facturas', onClick: () => console.log('Ver facturas') },
        ],
      });
    } else if (ventasChangePct < -5) {
      generatedInsights.push({
        type: 'negative',
        title: 'Descenso en Ventas',
        description: `↓ ${formatCurrency(Math.abs(ventasChange))} vs mes anterior en Ventas (${formatPercentage(ventasChangePct)}). Revisar estrategias de venta y clientes principales.`,
        actions: [
          { label: 'Analizar causas', onClick: () => console.log('Analizar causas') },
          { label: 'Plan de acción', onClick: () => console.log('Plan de acción') },
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
          { label: 'Revisar proveedores', onClick: () => console.log('Revisar proveedores') },
          { label: 'Optimizar costos', onClick: () => console.log('Optimizar costos') },
        ],
      });
    } else if (costosChangePct < -5) {
      generatedInsights.push({
        type: 'positive',
        title: 'Optimización de Costos',
        description: `Costos reducidos ${formatPercentage(Math.abs(costosChangePct))} vs mes anterior (-${formatCurrency(Math.abs(costosChange))}). Excelente gestión de eficiencia.`,
        actions: [
          { label: 'Documentar prácticas', onClick: () => console.log('Documentar prácticas') },
          { label: 'Replicar estrategia', onClick: () => console.log('Replicar estrategia') },
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
          { label: 'Revisar nómina', onClick: () => console.log('Revisar nómina') },
          { label: 'Planificar presupuesto', onClick: () => console.log('Planificar presupuesto') },
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
        description: `${topPositiveMover.name} contribuyó +${formatCurrency(topPositiveMover.delta)} (${formatPercentage(topPositiveMover.deltaPct)}) al crecimiento total. Representa ${topPositiveMover.contributionPct.toFixed(1)}% del cambio.`,
        actions: [
          { label: 'Analizar estrategia', onClick: () => console.log('Analizar estrategia') },
          { label: 'Replicar modelo', onClick: () => console.log('Replicar modelo') },
        ],
      });
    }

    if (topNegativeMover) {
      generatedInsights.push({
        type: 'negative',
        title: 'Atención: Mayor Impacto Negativo',
        description: `${topNegativeMover.name} impactó negativamente con ${formatCurrency(topNegativeMover.delta)} (${formatPercentage(topNegativeMover.deltaPct)}). Revisar causas y tomar acciones correctivas.`,
        actions: [
          { label: 'Investigar causas', onClick: () => console.log('Investigar causas') },
          { label: 'Plan de recuperación', onClick: () => console.log('Plan de recuperación') },
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
            { label: 'Sostener estrategia', onClick: () => console.log('Sostener estrategia') },
            { label: 'Escalar operaciones', onClick: () => console.log('Escalar operaciones') },
          ],
        });
      } else if (isDeclining) {
        generatedInsights.push({
          type: 'negative',
          title: 'Tendencia Declinante',
          description: 'Las ventas han mostrado declive en los últimos 3 meses. Revisar estrategias y tomar acciones inmediatas.',
          actions: [
            { label: 'Revisar estrategia', onClick: () => console.log('Revisar estrategia') },
            { label: 'Acción inmediata', onClick: () => console.log('Acción inmediata') },
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
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'negative':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      default:
        return <BarChart3 className="h-5 w-5 text-blue-600" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'positive':
        return 'bg-green-50 border-green-200';
      case 'negative':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getInsightTextColor = (type: string) => {
    switch (type) {
      case 'positive':
        return 'text-green-700';
      case 'negative':
        return 'text-red-700';
      case 'warning':
        return 'text-yellow-700';
      default:
        return 'text-blue-700';
    }
  };

  if (allInsights.length === 0) {
    return (
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            Insights Automáticos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-600">No hay suficientes datos para generar insights</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Insights Automáticos
          </CardTitle>
          <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
            {allInsights.length} insights
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {allInsights.map((insight, index) => (
          <div
            key={index}
            className={`p-4 rounded-xl border ${getInsightColor(insight.type)}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {getInsightIcon(insight.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className={`font-medium ${getInsightTextColor(insight.type)}`}>
                    {insight.title}
                  </h4>
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${
                      insight.type === 'positive' 
                        ? 'bg-green-50 text-green-700 border-green-200' 
                        : insight.type === 'negative' 
                        ? 'bg-red-50 text-red-700 border-red-200' 
                        : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                    }`}
                  >
                    {insight.type === 'positive' ? 'Positivo' : 
                     insight.type === 'negative' ? 'Negativo' : 'Advertencia'}
                  </Badge>
                </div>
                
                <p className="text-sm text-gray-600 mb-3 leading-relaxed">
                  {insight.description}
                </p>
                
                <div className="flex flex-wrap gap-2">
                  {insight.actions.map((action, actionIndex) => (
                    <Button
                      key={actionIndex}
                      variant="outline"
                      size="sm"
                      onClick={action.onClick}
                      className="h-7 px-3 text-xs bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
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
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-gray-600" />
              <span className="text-sm text-gray-600">
                Insights generados automáticamente basados en los datos
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => console.log('Generar reporte')}
                className="h-7 px-3 text-xs bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <FileText className="h-3 w-3 mr-1" />
                Reporte
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => console.log('Configurar alertas')}
                className="h-7 px-3 text-xs bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
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
