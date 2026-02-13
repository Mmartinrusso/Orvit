'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  PiggyBank,
  Clock,
  Calendar,
  PackageX,
  PieChart,
  ChevronRight,
  RefreshCcw,
  Lightbulb,
  Info,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Insight {
  id: string;
  type: 'warning' | 'opportunity' | 'info' | 'success';
  icon: string;
  title: string;
  description: string;
  metric?: string;
  action?: {
    label: string;
    path: string;
  };
  priority: number;
}

const iconMap: Record<string, React.ReactNode> = {
  'trending-up': <TrendingUp className="h-4 w-4" />,
  'alert-triangle': <AlertTriangle className="h-4 w-4" />,
  'piggy-bank': <PiggyBank className="h-4 w-4" />,
  'clock': <Clock className="h-4 w-4" />,
  'calendar': <Calendar className="h-4 w-4" />,
  'package-x': <PackageX className="h-4 w-4" />,
  'pie-chart': <PieChart className="h-4 w-4" />,
};

const typeColors: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-600',
    icon: <AlertTriangle className="h-4 w-4 text-amber-500" />
  },
  opportunity: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-600',
    icon: <Lightbulb className="h-4 w-4 text-green-500" />
  },
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-600',
    icon: <Info className="h-4 w-4 text-blue-500" />
  },
  success: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-600',
    icon: <CheckCircle className="h-4 w-4 text-emerald-500" />
  }
};

export function AIInsightsSection() {
  const router = useRouter();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/compras/dashboard/ai-insights');
      if (!res.ok) throw new Error('Error al cargar insights');
      const data = await res.json();
      setInsights(data.insights || []);
    } catch (e) {
      setError('No se pudieron cargar los insights');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const displayedInsights = expanded ? insights : insights.slice(0, 3);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="ghost" size="sm" onClick={fetchInsights} className="mt-2">
            <RefreshCcw className="h-3 w-3 mr-1" />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Insights IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
            <p className="text-sm text-muted-foreground">Todo en orden. No hay alertas o sugerencias.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Insights IA
            <Badge variant="secondary" className="text-[10px]">{insights.length}</Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchInsights} className="h-7 px-2">
            <RefreshCcw className="h-3 w-3" />
          </Button>
        </div>
        <CardDescription className="text-xs">Analisis automatico de tus datos de compras</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayedInsights.map((insight) => {
          const colors = typeColors[insight.type] || typeColors.info;
          return (
            <div
              key={insight.id}
              className={cn(
                "p-3 rounded-lg border transition-colors",
                colors.bg,
                colors.border,
                insight.action && "cursor-pointer hover:shadow-sm"
              )}
              onClick={() => insight.action && router.push(insight.action.path)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {iconMap[insight.icon] || colors.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={cn("text-sm font-medium", colors.text)}>
                      {insight.title}
                    </h4>
                    {insight.metric && (
                      <Badge variant="outline" className={cn("text-[10px]", colors.text)}>
                        {insight.metric}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {insight.description}
                  </p>
                  {insight.action && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-primary">
                      <span>{insight.action.label}</span>
                      <ChevronRight className="h-3 w-3" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {insights.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Ver menos' : `Ver ${insights.length - 3} mas`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default AIInsightsSection;
