'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MyTasksWidgetProps {
  companyId: number;
  sectorId?: number | null;
  userId?: number;
  style?: string;
}

export function MyTasksWidget({ companyId, userId, style = 'list' }: MyTasksWidgetProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['my-tasks', companyId, userId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('companyId', companyId.toString());
      if (userId) params.append('assignedTo', userId.toString());
      params.append('status', 'PENDING,IN_PROGRESS');
      params.append('limit', '5');
      
      const response = await fetch(`/api/tasks?${params.toString()}`);
      if (!response.ok) throw new Error('Error');
      return response.json();
    },
    staleTime: 60 * 1000,
  });

  const tasks = Array.isArray(data) ? data : data?.tasks || [];

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { icon: <Clock className="h-3.5 w-3.5 text-yellow-500" />, color: 'bg-yellow-100 text-yellow-700' };
      case 'IN_PROGRESS':
        return { icon: <AlertCircle className="h-3.5 w-3.5 text-blue-500" />, color: 'bg-blue-100 text-blue-700' };
      default:
        return { icon: <Clock className="h-3.5 w-3.5 text-gray-500" />, color: 'bg-gray-100 text-gray-700' };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center">
        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center mb-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
        </div>
        <p className="text-xs text-muted-foreground">Sin tareas pendientes</p>
      </div>
    );
  }

  if (style === 'cards') {
    return (
      <div className="grid grid-cols-2 gap-2">
        {tasks.slice(0, 4).map((task: any) => {
          const statusConfig = getStatusConfig(task.status);
          return (
            <div key={task.id} className="p-2 rounded-lg bg-accent/30 border-l-2 border-l-blue-500">
              <div className="font-medium text-xs truncate">{task.title || task.name}</div>
              {task.dueDate && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(task.dueDate).toLocaleDateString('es-ES')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.slice(0, 5).map((task: any) => {
        const statusConfig = getStatusConfig(task.status);
        return (
          <div key={task.id} className="flex items-center justify-between p-2 rounded-lg bg-accent/30">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {statusConfig.icon}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs truncate">{task.title || task.name}</div>
                {task.dueDate && (
                  <div className="text-xs text-muted-foreground">
                    Vence: {new Date(task.dueDate).toLocaleDateString('es-ES')}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
