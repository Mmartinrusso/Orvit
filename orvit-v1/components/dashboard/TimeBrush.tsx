'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDashboardStore } from './useDashboardStore';

interface TimeBrushProps {
  data: { month: string; value: number }[];
  onRangeChange?: (start: string, end: string) => void;
}

export function TimeBrush({ data, onRangeChange }: TimeBrushProps) {
  const { filters, updateFilter } = useDashboardStore();
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const brushRef = useRef<HTMLDivElement>(null);

  const sortedData = [...data].sort((a, b) => a.month.localeCompare(b.month));
  const minValue = Math.min(...sortedData.map(d => d.value));
  const maxValue = Math.max(...sortedData.map(d => d.value));
  const range = maxValue - minValue;

  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    setIsDragging(true);
    setDragStart(index);
    setDragEnd(index);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || dragStart === null || !brushRef.current) return;

    const rect = brushRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const dataLength = sortedData.length;
    const index = Math.round((x / width) * (dataLength - 1));
    const clampedIndex = Math.max(0, Math.min(dataLength - 1, index));
    
    setDragEnd(clampedIndex);
  };

  const handleMouseUp = () => {
    if (dragStart !== null && dragEnd !== null && onRangeChange) {
      const startIndex = Math.min(dragStart, dragEnd);
      const endIndex = Math.max(dragStart, dragEnd);
      
      onRangeChange(
        sortedData[startIndex].month,
        sortedData[endIndex].month
      );
    }
    
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  const getBarHeight = (value: number) => {
    if (range === 0) return 20;
    return ((value - minValue) / range) * 40 + 10;
  };

  const getBarColor = (value: number, index: number) => {
    const isSelected = dragStart !== null && dragEnd !== null && 
      index >= Math.min(dragStart, dragEnd) && 
      index <= Math.max(dragStart, dragEnd);
    
    if (isSelected) return 'bg-info';
    if (value > maxValue * 0.8) return 'bg-success';
    if (value > maxValue * 0.6) return 'bg-warning';
    if (value > maxValue * 0.4) return 'bg-warning';
    return 'bg-destructive';
  };

  const formatMonthShort = (month: string) => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
  };

  return (
    <div className="bg-muted border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Selección de Período</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 bg-card border-border text-foreground hover:bg-accent"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 bg-card border-border text-foreground hover:bg-accent"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Mini timeline */}
      <div 
        ref={brushRef}
        className="flex items-end gap-1 h-16 cursor-crosshair select-none"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {sortedData.map((point, index) => (
          <div
            key={point.month}
            className={cn('flex-1 rounded-t transition-all duration-200 hover:opacity-80',
              getBarColor(point.value, index)
            )}
            style={{ height: `${getBarHeight(point.value)}px` }}
            onMouseDown={(e) => handleMouseDown(e, index)}
            title={`${formatMonthShort(point.month)}: ${point.value.toLocaleString()}`}
          />
        ))}
      </div>

      {/* Etiquetas de meses */}
      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        <span>{formatMonthShort(sortedData[0]?.month || '')}</span>
        <span>{formatMonthShort(sortedData[sortedData.length - 1]?.month || '')}</span>
      </div>

      {/* Información de selección */}
      {dragStart !== null && dragEnd !== null && (
        <div className="mt-3 p-2 bg-info-muted rounded-lg border border-info-muted">
          <div className="text-xs text-info-muted-foreground">
            <strong>Período seleccionado:</strong> {formatMonthShort(sortedData[Math.min(dragStart, dragEnd)].month)} - {formatMonthShort(sortedData[Math.max(dragStart, dragEnd)].month)}
          </div>
        </div>
      )}
    </div>
  );
}
