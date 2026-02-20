'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  Share2, 
  Settings, 
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { useDashboardStore } from './useDashboardStore';
import { useTheme } from '@/components/providers/ThemeProvider';
import { cn } from '@/lib/utils';

interface HeaderProps {
  hasAlerts?: boolean;
  showComparativeAnalysis?: boolean;
  onToggleComparativeAnalysis?: () => void;
}

export function Header({ hasAlerts = false, showComparativeAnalysis = false, onToggleComparativeAnalysis }: HeaderProps) {
  const { filters } = useDashboardStore();
  const { theme } = useTheme();

  const handleExport = () => {
    // TODO: Implement export
  };

  const handleShare = () => {
    // TODO: Implement share
  };

  const handleSettings = () => {
    // TODO: Implement settings
  };

  return (
    <header className="border-b border-border w-full">
      <div className="w-full px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Título y badges */}
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {showComparativeAnalysis ? 'Análisis Comparativo Ejecutivo' : 'Dashboard Ejecutivo'}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {showComparativeAnalysis ? 'Rendimiento financiero y operacional' : 'Métricas actuales y análisis del mes'}
              </p>
            </div>
            
            {hasAlerts && (
              <div className="flex items-center gap-3">
                <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/30">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Alertas
                </Badge>
              </div>
            )}
          </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-3">
                      {onToggleComparativeAnalysis && (
                        <Button
                          variant={showComparativeAnalysis ? "default" : "outline"}
                          size="sm"
                          onClick={onToggleComparativeAnalysis}
                        >
                            <TrendingUp className="h-4 w-4 mr-2" />
                            {showComparativeAnalysis ? 'Volver al Dashboard' : 'Análisis Comparativo'}
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExport}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Exportar
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleShare}
                      >
                        <Share2 className="h-4 w-4 mr-2" />
                        Compartir
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSettings}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
        </div>

        {/* Indicadores de configuración */}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-info"></div>
            <span>Modo: {filters.comparisonMode}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success"></div>
            <span>Vista: {filters.viewMode}</span>
          </div>
          
          {filters.nominalVsAdjusted === 'adjusted' && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-warning"></div>
              <span>Ajustado por inflación</span>
            </div>
          )}
          
          {filters.fxNormalized && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-info"></div>
              <span>FX normalizado</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
