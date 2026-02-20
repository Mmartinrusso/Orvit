'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { formatCurrency, formatPercentage } from './utils/metrics';
import { Package, DollarSign, Calculator, TrendingUp, Percent } from 'lucide-react';

interface QuickInsightsRowProps {
  data: {
    totalSales: number;
    totalCosts: number;
    netMargin: number;
    marginPercentage: number;
    totalUnitsSold: number;
    costsSummary: {
      total: number;
      components: Array<{
        label: string;
        amount: number;
        percentage: number;
      }>;
    };
    production: {
      totalUnits: number;
      totalValue: number;
    };
  };
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--chart-1))', 'hsl(var(--info))'];

export function QuickInsightsRow({ data }: QuickInsightsRowProps) {
  // Preparar datos para el pie chart de costos
  const pieData = data.costsSummary.components.map((c, i) => ({
    name: c.label,
    value: c.amount,
    percentage: c.percentage,
    color: COLORS[i % COLORS.length]
  }));

  // Calcular métricas promedio por unidad
  const costPerUnit = data.totalUnitsSold > 0 ? data.totalCosts / data.totalUnitsSold : 0;
  const revenuePerUnit = data.totalUnitsSold > 0 ? data.totalSales / data.totalUnitsSold : 0;
  const profitPerUnit = revenuePerUnit - costPerUnit;
  const marginPerUnit = revenuePerUnit > 0 ? (profitPerUnit / revenuePerUnit) * 100 : 0;

  // Métricas de eficiencia
  const costToSalesRatio = data.totalSales > 0 ? (data.totalCosts / data.totalSales) * 100 : 0;
  const profitMargin = data.totalSales > 0 ? (data.netMargin / data.totalSales) * 100 : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Pie Chart de Costos */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Distribución de Costos</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={40}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              {pieData.slice(0, 4).map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground truncate">{item.name}</span>
                  </div>
                  <span className="font-medium text-foreground ml-2">{item.percentage.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Promedio por Unidad Vendida */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="text-sm font-medium text-foreground">Promedio por Unidad</span>
              <p className="text-xs text-muted-foreground">(Sobre {data.totalUnitsSold.toLocaleString()} unidades vendidas)</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground mb-0.5">Precio Prom.</p>
              <p className="text-sm font-semibold text-foreground">{formatCurrency(revenuePerUnit)}</p>
            </div>
            <div className="text-center p-2 rounded-md bg-muted/50">
              <p className="text-xs text-muted-foreground mb-0.5">Costo Prom.</p>
              <p className="text-sm font-semibold text-foreground">{formatCurrency(costPerUnit)}</p>
            </div>
            <div className="text-center p-2 rounded-md bg-success-muted">
              <p className="text-xs text-muted-foreground mb-0.5">Ganancia</p>
              <p className="text-sm font-semibold text-success">{formatCurrency(profitPerUnit)}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Margen promedio por unidad</span>
            <span className={cn(
              "font-semibold",
              marginPerUnit >= 25 ? "text-success" :
              marginPerUnit >= 15 ? "text-warning-muted-foreground" :
              "text-destructive"
            )}>
              {marginPerUnit.toFixed(1)}%
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Indicadores de Eficiencia */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Eficiencia Operativa</span>
          </div>
          <div className="space-y-3">
            {/* Costo sobre Ventas */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Costos / Ventas</span>
                <span className={cn(
                  "font-semibold",
                  costToSalesRatio <= 60 ? "text-success" :
                  costToSalesRatio <= 75 ? "text-warning-muted-foreground" :
                  "text-destructive"
                )}>
                  {costToSalesRatio.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    costToSalesRatio <= 60 ? "bg-success" :
                    costToSalesRatio <= 75 ? "bg-warning" :
                    "bg-destructive"
                  )}
                  style={{ width: `${Math.min(costToSalesRatio, 100)}%` }}
                />
              </div>
            </div>

            {/* Margen de Ganancia */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Margen de Ganancia</span>
                <span className={cn(
                  "font-semibold",
                  profitMargin >= 25 ? "text-success" :
                  profitMargin >= 15 ? "text-warning-muted-foreground" :
                  "text-destructive"
                )}>
                  {profitMargin.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    profitMargin >= 25 ? "bg-success" :
                    profitMargin >= 15 ? "bg-warning" :
                    "bg-destructive"
                  )}
                  style={{ width: `${Math.min(Math.max(profitMargin, 0), 100)}%` }}
                />
              </div>
            </div>

            {/* Ganancia Neta */}
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Ganancia Neta Total</span>
                <span className={cn(
                  "text-sm font-bold",
                  data.netMargin >= 0 ? "text-success" : "text-destructive"
                )}>
                  {formatCurrency(data.netMargin)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
