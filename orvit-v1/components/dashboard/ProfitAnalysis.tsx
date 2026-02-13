'use client';

import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign, Target } from 'lucide-react';
import { formatCurrency, formatNumber } from './utils/metrics';
import { InfoTooltip } from './InfoTooltip';

interface Product {
  name: string;
  units: number;
  revenue: number;
  cost?: number;
  price?: number;
  profit?: number;
  margin?: number;
}

interface ProfitAnalysisProps {
  products: Product[];
  totalRevenue: number;
  totalCosts: number;
}

export const ProfitAnalysis = memo(function ProfitAnalysis({ products, totalRevenue, totalCosts }: ProfitAnalysisProps) {
  // Calcular ganancia total
  const totalProfit = totalRevenue - totalCosts;

  // Filtrar productos con datos de ganancia válidos
  const productsWithProfit = products.filter(p =>
    p.profit !== undefined && p.units > 0
  );

  // Top 3 productos que más contribuyen a la ganancia total
  const topProfitContributors = [...productsWithProfit]
    .map(p => ({
      ...p,
      totalProfit: (p.profit || 0) * p.units
    }))
    .sort((a, b) => b.totalProfit - a.totalProfit)
    .slice(0, 3);

  // Productos con pérdida (margen negativo)
  const losingProducts = productsWithProfit.filter(p => (p.margin || 0) < 0);

  // Análisis por categoría
  const categoryAnalysis = () => {
    const categories: { [key: string]: { revenue: number; cost: number; profit: number } } = {};

    productsWithProfit.forEach(p => {
      const category = p.name.includes('Vigueta') ? 'Viguetas' :
                      p.name.includes('Bloque') ? 'Bloques' :
                      (p.name.includes('Adoquin') || p.name.includes('Adoquín')) ? 'Adoquines' : 'Otros';

      if (!categories[category]) {
        categories[category] = { revenue: 0, cost: 0, profit: 0 };
      }

      categories[category].revenue += p.revenue;
      categories[category].profit += (p.profit || 0) * p.units;
    });

    return Object.entries(categories)
      .map(([name, data]) => ({
        name,
        ...data,
        margin: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0
      }))
      .sort((a, b) => b.profit - a.profit);
  };

  const categories = categoryAnalysis();
  const totalCategoryProfit = categories.reduce((sum, c) => sum + c.profit, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-medium text-foreground">
              Análisis de Ganancias
            </CardTitle>
          </div>
          <InfoTooltip
            title="Análisis de Ganancias"
            description="Muestra la ganancia neta del mes, los productos que más contribuyen a las ganancias totales, y el desglose por categoría de productos."
            formula="Ganancia = Ingresos - Costos | Contribución = Ganancia unitaria × Unidades"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Resumen de ganancia total */}
          <div className={cn(
            "p-3 rounded-lg",
            totalProfit >= 0
              ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50"
              : "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Ganancia Neta del Mes</span>
              <span className={cn(
                "text-lg font-bold",
                totalProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              )}>
                {formatCurrency(totalProfit)}
              </span>
            </div>
          </div>

          {/* Top contribuyentes a la ganancia */}
          {topProfitContributors.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Top Contribuyentes
              </p>
              <div className="space-y-2">
                {topProfitContributors.map((product, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold",
                        index === 0 ? "bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900" : "bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                      )}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(product.units)} u × ${formatNumber(Math.round(product.profit || 0))}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="text-xs font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(product.totalProfit)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ganancia por categoría */}
          {categories.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Por Categoría
              </p>
              <div className="space-y-1.5">
                {categories.map((category, index) => {
                  const percentage = totalCategoryProfit > 0
                    ? (category.profit / totalCategoryProfit) * 100
                    : 0;

                  return (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="text-foreground font-medium">{category.name}</span>
                          <span className={cn(
                            "font-semibold",
                            category.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                          )}>
                            {formatCurrency(category.profit)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              category.profit >= 0 ? "bg-gray-600 dark:bg-gray-400" : "bg-red-500"
                            )}
                            style={{ width: `${Math.min(Math.abs(percentage), 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Alerta de productos con pérdida */}
          {losingProducts.length > 0 && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
                <p className="text-xs font-bold text-red-700 dark:text-red-400">
                  {losingProducts.length} producto{losingProducts.length > 1 ? 's' : ''} con pérdida
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {losingProducts.slice(0, 2).map(p => p.name).join(', ')}
                {losingProducts.length > 2 && ` y ${losingProducts.length - 2} más`}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
