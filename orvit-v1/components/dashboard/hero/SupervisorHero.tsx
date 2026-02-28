'use client';

import { useQuery } from '@tanstack/react-query';
import { ClipboardList, AlertTriangle, OctagonX, ShieldCheck, Zap } from 'lucide-react';
import { HeroKpiCard } from './HeroKpiCard';

interface SupervisorHeroProps {
  companyId: number;
  sectorId?: number | null;
  userId: number;
}

export function SupervisorHero({ companyId, sectorId, userId }: SupervisorHeroProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['hero-supervisor', companyId, sectorId],
    queryFn: async () => {
      const params = new URLSearchParams({
        role: 'supervisor',
        userId: String(userId),
      });
      if (sectorId) params.set('sectorId', String(sectorId));

      const res = await fetch(`/api/maintenance/dashboard/hero?${params}`);
      if (!res.ok) throw new Error('Error fetching hero data');
      return res.json();
    },
    enabled: !!companyId,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const cards = [
    {
      title: 'OTs Activas',
      value: data?.totalActiveOTs ?? 0,
      icon: ClipboardList,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      info: 'Total de órdenes de trabajo pendientes o en ejecución en el sector. Refleja la carga operativa actual del equipo bajo tu supervisión.',
    },
    {
      title: 'OTs Vencidas',
      value: data?.overdueOTs ?? 0,
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      info: 'Órdenes de trabajo que superaron su fecha límite sin ser completadas. Cada una representa un riesgo operativo o incumplimiento de SLA. Requieren atención inmediata.',
    },
    {
      title: 'Máquinas Paradas',
      value: data?.machinesStopped ?? 0,
      icon: OctagonX,
      color: 'text-warning-muted-foreground',
      bgColor: 'bg-warning-muted',
      info: 'Equipos fuera de servicio por mantenimiento o falla en este momento. Impactan directamente la capacidad productiva del sector.',
    },
    {
      title: 'Controles Pendientes',
      value: data?.pendingControls ?? 0,
      icon: ShieldCheck,
      color: 'text-info',
      bgColor: 'bg-info/10',
      info: 'Controles de seguimiento programados que el equipo debe completar para verificar soluciones aplicadas. Si vencen sin registrarse, la solución queda sin validar.',
    },
    {
      title: 'Fallas Abiertas',
      value: data?.openFailures ?? 0,
      icon: Zap,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      info: 'Fallas reportadas que todavía no tienen solución aplicada o verificada. Un número alto indica acumulación de problemas no resueltos en el sector.',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
      {cards.map((card) => (
        <HeroKpiCard
          key={card.title}
          title={card.title}
          value={card.value}
          icon={card.icon}
          color={card.color}
          bgColor={card.bgColor}
          info={card.info}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}
