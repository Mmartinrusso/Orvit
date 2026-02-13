'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ChevronLeft, ChevronRight, Wrench, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MaintenanceCalendarWidgetProps {
  companyId: number;
  sectorId?: number | null;
  style?: string;
}

export function MaintenanceCalendarWidget({ companyId, sectorId, style = 'calendar' }: MaintenanceCalendarWidgetProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Obtener primer y último día del mes
  const { startOfMonth, endOfMonth, daysInMonth, firstDayOfWeek } = useMemo(() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return {
      startOfMonth: start,
      endOfMonth: end,
      daysInMonth: end.getDate(),
      firstDayOfWeek: start.getDay(), // 0 = domingo
    };
  }, [currentDate]);

  const { data, isLoading } = useQuery({
    queryKey: ['calendar-maintenances', companyId, sectorId, currentDate.getMonth(), currentDate.getFullYear()],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('companyId', companyId.toString());
      if (sectorId) params.append('sectorId', sectorId.toString());
      
      // Rango del mes actual
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      params.append('startDate', start.toISOString().split('T')[0]);
      params.append('endDate', end.toISOString().split('T')[0]);
      
      const response = await fetch(`/api/maintenance/all?${params.toString()}`);
      if (!response.ok) throw new Error('Error');
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const maintenances = data?.maintenances || data || [];

  // Agrupar mantenimientos por día
  const maintenancesByDay = useMemo(() => {
    const grouped: Record<number, any[]> = {};
    
    if (!Array.isArray(maintenances)) return grouped;
    
    maintenances.forEach((m: any) => {
      const date = m.scheduledDate || m.createdAt;
      if (!date) return;
      
      const d = new Date(date);
      if (d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear()) {
        const day = d.getDate();
        if (!grouped[day]) grouped[day] = [];
        grouped[day].push(m);
      }
    });
    
    return grouped;
  }, [maintenances, currentDate]);

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const monthName = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const today = new Date();
  const isToday = (day: number) => 
    today.getDate() === day && 
    today.getMonth() === currentDate.getMonth() && 
    today.getFullYear() === currentDate.getFullYear();

  // Generar array de días del calendario
  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    
    // Días vacíos antes del primer día del mes
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    
    // Días del mes
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d);
    }
    
    return days;
  }, [firstDayOfWeek, daysInMonth]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header del calendario */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon-sm" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize">{monthName}</span>
        <Button variant="ghost" size="icon-sm" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, i) => (
          <div key={i} className="text-xs font-medium text-muted-foreground py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Días del mes */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="h-8" />;
          }

          const dayMaintenances = maintenancesByDay[day] || [];
          const hasMaintenances = dayMaintenances.length > 0;
          const completed = dayMaintenances.filter((m: any) => m.status === 'COMPLETED').length;
          const pending = dayMaintenances.length - completed;

          return (
            <div
              key={day}
              className={cn(
                'h-8 flex flex-col items-center justify-center rounded-md text-xs relative transition-colors',
                isToday(day) && 'bg-primary text-primary-foreground font-bold',
                !isToday(day) && hasMaintenances && 'bg-blue-50 hover:bg-blue-100',
                !isToday(day) && !hasMaintenances && 'hover:bg-accent'
              )}
              title={hasMaintenances ? `${dayMaintenances.length} mantenimiento(s)` : undefined}
            >
              {day}
              {hasMaintenances && (
                <div className="absolute -bottom-0.5 flex gap-0.5">
                  {pending > 0 && (
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                  )}
                  {completed > 0 && (
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="flex items-center justify-center gap-4 pt-2 border-t">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="text-xs text-muted-foreground">Pendiente</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-muted-foreground">Completado</span>
        </div>
      </div>

      {/* Lista de próximos del día actual */}
      {style === 'calendar' && (
        <div className="pt-2 border-t">
          <p className="text-xs font-medium mb-2">Hoy:</p>
          {(maintenancesByDay[today.getDate()] || []).length > 0 ? (
            <div className="space-y-1">
              {(maintenancesByDay[today.getDate()] || []).slice(0, 3).map((m: any) => (
                <div key={m.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-accent/50">
                  <Wrench className="h-3 w-3 text-blue-500" />
                  <span className="truncate">{m.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              Sin mantenimientos hoy
            </p>
          )}
        </div>
      )}
    </div>
  );
}

