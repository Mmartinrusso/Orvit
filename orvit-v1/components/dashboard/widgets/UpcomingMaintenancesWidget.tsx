'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Clock, CalendarDays, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface UpcomingMaintenancesWidgetProps {
  companyId: number;
  sectorId?: number | null;
  style?: string;
}

export function UpcomingMaintenancesWidget({ companyId, sectorId, style = 'list' }: UpcomingMaintenancesWidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['upcoming-maintenances', companyId, sectorId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('companyId', companyId.toString());
      if (sectorId) params.append('sectorId', sectorId.toString());
      params.append('status', 'PENDING');
      params.append('limit', '5');
      
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      params.append('startDate', today.toISOString().split('T')[0]);
      params.append('endDate', nextWeek.toISOString().split('T')[0]);
      
      const response = await fetch(`/api/maintenance/all?${params.toString()}`);
      if (!response.ok) throw new Error('Error');
      return response.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const maintenances = data?.maintenances || data || [];

  const getDaysUntil = (date: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diff === 0) return { text: 'Hoy', color: 'bg-yellow-100 text-yellow-700' };
    if (diff === 1) return { text: 'Mañana', color: 'bg-blue-100 text-blue-700' };
    if (diff < 0) return { text: 'Vencido', color: 'bg-red-100 text-red-700' };
    return { text: `En ${diff} días`, color: 'bg-gray-100 text-gray-700' };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!Array.isArray(maintenances) || maintenances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center">
        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mb-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
        </div>
        <p className="text-xs text-muted-foreground">Sin mantenimientos próximos</p>
      </div>
    );
  }

  if (style === 'cards') {
    return (
      <div className="grid grid-cols-2 gap-2">
        {maintenances.slice(0, 4).map((m: any) => {
          const daysInfo = m.scheduledDate ? getDaysUntil(m.scheduledDate) : { text: '-', color: 'bg-gray-100 text-gray-700' };
          return (
            <div key={m.id} className="p-2 rounded-lg bg-accent/30 border-l-2 border-l-blue-500">
              <div className="font-medium text-xs truncate">{m.title}</div>
              <Badge variant="outline" className={`text-xs mt-1 ${daysInfo.color}`}>
                {daysInfo.text}
              </Badge>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {maintenances.slice(0, 5).map((m: any) => {
        const daysInfo = m.scheduledDate ? getDaysUntil(m.scheduledDate) : { text: '-', color: 'bg-gray-100 text-gray-700' };
        return (
          <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-accent/30">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Clock className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs truncate">{m.title}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {m.machine?.name || m.unidadMovil?.nombre || '-'}
                </div>
              </div>
            </div>
            <Badge variant="outline" className={`text-xs flex-shrink-0 ml-2 ${daysInfo.color}`}>
              {daysInfo.text}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
