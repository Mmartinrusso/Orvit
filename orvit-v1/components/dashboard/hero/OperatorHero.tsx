'use client';

import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Play, ShieldCheck, Calendar } from 'lucide-react';
import { HeroKpiCard } from './HeroKpiCard';

interface OperatorHeroProps {
  companyId: number;
  sectorId?: number | null;
  userId: number;
}

export function OperatorHero({ companyId, sectorId, userId }: OperatorHeroProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['hero-operator', companyId, sectorId, userId],
    queryFn: async () => {
      const params = new URLSearchParams({
        role: 'operator',
        userId: String(userId),
      });
      if (sectorId) params.set('sectorId', String(sectorId));

      const res = await fetch(`/api/maintenance/dashboard/hero?${params}`);
      if (!res.ok) throw new Error('Error fetching hero data');
      return res.json();
    },
    enabled: !!companyId && !!userId,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const cards = [
    {
      title: 'Mis OTs Pendientes',
      value: data?.myPendingCount ?? 0,
      icon: ClipboardList,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      info: 'Órdenes de trabajo asignadas a vos que todavía no fueron iniciadas. Son las tareas que están esperando tu atención.',
    },
    {
      title: 'En Progreso',
      value: data?.myInProgressCount ?? 0,
      icon: Play,
      color: 'text-info',
      bgColor: 'bg-info/10',
      info: 'Órdenes de trabajo que ya iniciaste y están siendo ejecutadas en este momento. Deberías tener pocas simultáneas para mantener el foco.',
    },
    {
      title: 'Controles Pendientes',
      value: data?.myControlsPending ?? 0,
      icon: ShieldCheck,
      color: 'text-warning-muted-foreground',
      bgColor: 'bg-warning-muted',
      info: 'Controles de seguimiento que debés completar para verificar que las soluciones aplicadas a fallas anteriores siguen funcionando correctamente.',
    },
    {
      title: 'Próximos Preventivos',
      value: data?.myUpcomingPreventive ?? 0,
      icon: Calendar,
      color: 'text-success',
      bgColor: 'bg-success-muted',
      subtitle: 'Próximos 7 días',
      info: 'Mantenimientos preventivos programados para los próximos 7 días que están asignados a vos. Planificá tu semana para no dejarlos vencer.',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card) => (
        <HeroKpiCard
          key={card.title}
          title={card.title}
          value={card.value}
          icon={card.icon}
          color={card.color}
          bgColor={card.bgColor}
          subtitle={card.subtitle}
          info={card.info}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}
