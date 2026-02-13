'use client';

import React from 'react';
import { WidgetStyle } from '@/lib/dashboard/widget-catalog';
import { WidgetWrapper } from './WidgetWrapper';
import { BarChart, BarChartData } from '../charts/BarChart';
import { LineChart, LineChartData } from '../charts/LineChart';
import { AreaChart, AreaChartData } from '../charts/AreaChart';
import { PieChart, PieChartData } from '../charts/PieChart';
import { DonutChart, DonutChartData } from '../charts/DonutChart';
import { GaugeChart } from '../charts/GaugeChart';
import { ProgressBar, CircularProgress } from '../charts/ProgressBar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Tipos para los datos del widget
export interface WidgetDataItem {
  label: string;
  value: number;
  color?: string;
  icon?: React.ReactNode;
  subtitle?: string;
  status?: string;
  date?: string;
}

interface MultiStyleWidgetProps {
  title: string;
  icon?: React.ReactNode;
  data: WidgetDataItem[];
  style: WidgetStyle;
  isLoading?: boolean;
  isError?: boolean;
  onRefresh?: () => void;
  onRemove?: () => void;
  isEditMode?: boolean;
  emptyMessage?: string;
  totalLabel?: string;
  unit?: string;
  max?: number;
  thresholds?: { value: number; color: string }[];
}

export function MultiStyleWidget({
  title,
  icon,
  data,
  style,
  isLoading,
  isError,
  onRefresh,
  onRemove,
  isEditMode,
  emptyMessage = 'Sin datos',
  totalLabel,
  unit,
  max,
  thresholds,
}: MultiStyleWidgetProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  const renderContent = () => {
    if (data.length === 0) {
      return (
        <div className="flex items-center justify-center h-full py-8">
          <p className="text-xs text-muted-foreground">{emptyMessage}</p>
        </div>
      );
    }

    switch (style) {
      case 'list':
        return <ListView data={data} />;
      
      case 'cards':
        return <CardsView data={data} />;
      
      case 'bar-chart':
        return (
          <BarChart 
            data={data.map(d => ({ label: d.label, value: d.value, color: d.color }))} 
            horizontal={true}
            showLabels={true}
            showValues={true}
          />
        );
      
      case 'line-chart':
        return (
          <LineChart 
            data={data.map(d => ({ label: d.label, value: d.value }))}
            height={150}
            showDots={true}
            showArea={false}
          />
        );
      
      case 'area-chart':
        return (
          <AreaChart 
            data={data.map(d => ({ label: d.label, value: d.value }))}
            height={150}
            showLabels={true}
          />
        );
      
      case 'pie-chart':
        return (
          <PieChart 
            data={data.map(d => ({ label: d.label, value: d.value, color: d.color }))}
            size={120}
            showLegend={true}
          />
        );
      
      case 'donut-chart':
        return (
          <DonutChart 
            data={data.map(d => ({ label: d.label, value: d.value, color: d.color }))}
            size={100}
            showTotal={true}
            totalLabel={totalLabel || 'Total'}
          />
        );
      
      case 'gauge':
        // Para gauge, usamos el primer valor o el total
        const gaugeValue = data.length === 1 ? data[0].value : total;
        return (
          <div className="flex justify-center">
            <GaugeChart 
              value={gaugeValue}
              max={max || 100}
              size={120}
              unit={unit || '%'}
              thresholds={thresholds}
            />
          </div>
        );
      
      case 'progress':
        return <ProgressView data={data} max={max} />;
      
      case 'stat-card':
        return <StatCardsView data={data} />;
      
      case 'table':
        return <TableView data={data} />;
      
      case 'timeline':
        return <TimelineView data={data} />;
      
      case 'compact':
        return <CompactView data={data} />;
      
      default:
        return <ListView data={data} />;
    }
  };

  return (
    <WidgetWrapper
      title={title}
      icon={icon}
      isLoading={isLoading}
      isError={isError}
      onRefresh={onRefresh}
      onRemove={onRemove}
      isEditMode={isEditMode}
    >
      {renderContent()}
    </WidgetWrapper>
  );
}

// ========== VISTAS ==========

function ListView({ data }: { data: WidgetDataItem[] }) {
  return (
    <div className="space-y-2">
      {data.slice(0, 6).map((item, index) => (
        <div 
          key={index}
          className="flex items-center justify-between p-2 rounded-lg bg-accent/30 border border-border/30"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-xs text-foreground truncate">{item.label}</div>
              {item.subtitle && (
                <div className="text-xs text-muted-foreground">{item.subtitle}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {item.status && (
              <Badge variant="outline" className="text-xs">{item.status}</Badge>
            )}
            <span className="text-sm font-medium text-foreground">{item.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CardsView({ data }: { data: WidgetDataItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {data.slice(0, 4).map((item, index) => (
        <div 
          key={index}
          className="p-3 rounded-lg bg-accent/30 border border-border/30 text-center"
        >
          {item.icon && <div className="flex justify-center mb-2">{item.icon}</div>}
          <div className="text-lg font-semibold text-foreground">{item.value}</div>
          <div className="text-xs text-muted-foreground truncate">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function StatCardsView({ data }: { data: WidgetDataItem[] }) {
  const colors = ['bg-blue-50', 'bg-green-50', 'bg-yellow-50', 'bg-red-50', 'bg-purple-50', 'bg-indigo-50'];
  
  return (
    <div className="grid grid-cols-2 gap-3">
      {data.slice(0, 4).map((item, index) => (
        <div 
          key={index}
          className={cn('p-3 rounded-lg', colors[index % colors.length])}
        >
          <div className="flex items-center gap-2 mb-1">
            {item.icon}
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
          <div className="text-xl font-bold text-foreground">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function ProgressView({ data, max = 100 }: { data: WidgetDataItem[]; max?: number }) {
  return (
    <div className="space-y-3">
      {data.slice(0, 5).map((item, index) => (
        <ProgressBar 
          key={index}
          value={item.value}
          max={max}
          label={item.label}
          color={item.color || 'bg-blue-500'}
        />
      ))}
    </div>
  );
}

function TableView({ data }: { data: WidgetDataItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 font-medium text-muted-foreground">Nombre</th>
            <th className="text-right py-2 font-medium text-muted-foreground">Valor</th>
            {data.some(d => d.status) && (
              <th className="text-right py-2 font-medium text-muted-foreground">Estado</th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 8).map((item, index) => (
            <tr key={index} className="border-b border-border/30">
              <td className="py-2 text-foreground">{item.label}</td>
              <td className="py-2 text-right font-medium text-foreground">{item.value}</td>
              {item.status && (
                <td className="py-2 text-right">
                  <Badge variant="outline" className="text-xs">{item.status}</Badge>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimelineView({ data }: { data: WidgetDataItem[] }) {
  return (
    <div className="relative pl-4">
      <div className="absolute left-1 top-0 bottom-0 w-0.5 bg-border" />
      <div className="space-y-4">
        {data.slice(0, 5).map((item, index) => (
          <div key={index} className="relative flex items-start gap-3">
            <div className="absolute -left-3 w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
            <div className="flex-1">
              <div className="font-medium text-xs text-foreground">{item.label}</div>
              {item.date && (
                <div className="text-xs text-muted-foreground">{item.date}</div>
              )}
              {item.subtitle && (
                <div className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</div>
              )}
            </div>
            <span className="text-sm font-medium text-foreground flex-shrink-0">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactView({ data }: { data: WidgetDataItem[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  
  return (
    <div className="flex items-center justify-between">
      <div className="flex gap-4">
        {data.slice(0, 3).map((item, index) => (
          <div key={index} className="text-center">
            <div className="text-lg font-bold text-foreground">{item.value}</div>
            <div className="text-xs text-muted-foreground">{item.label}</div>
          </div>
        ))}
      </div>
      {data.length > 3 && (
        <div className="text-center border-l border-border pl-4">
          <div className="text-lg font-bold text-foreground">{total}</div>
          <div className="text-xs text-muted-foreground">Total</div>
        </div>
      )}
    </div>
  );
}

