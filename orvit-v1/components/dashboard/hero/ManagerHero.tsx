'use client';

import { useQuery } from '@tanstack/react-query';
import { HeroGaugeCard } from './HeroGaugeCard';

interface ManagerHeroProps {
  companyId: number;
  sectorId?: number | null;
  userId: number;
}

export function ManagerHero({ companyId, sectorId, userId }: ManagerHeroProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['hero-manager', companyId, sectorId],
    queryFn: async () => {
      const params = new URLSearchParams({
        role: 'manager',
        userId: String(userId),
      });
      if (sectorId) params.set('sectorId', String(sectorId));

      const res = await fetch(`/api/maintenance/dashboard/hero?${params}`);
      if (!res.ok) throw new Error('Error fetching hero data');
      return res.json();
    },
    enabled: !!companyId,
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  const gauges = [
    {
      title: 'MTTR',
      value: data?.mttr ?? null,
      unit: 'hs',
      maxValue: 24,
      info: 'Mean Time To Repair — Tiempo promedio que tarda el equipo en reparar una falla desde que se reporta hasta que la máquina vuelve a operar. Menor = mejor. Objetivo: bajo 4hs en equipos críticos.',
    },
    {
      title: 'MTBF',
      value: data?.mtbf ?? null,
      unit: 'hs',
      maxValue: Math.max(data?.mtbf ?? 100, 100),
      info: 'Mean Time Between Failures — Tiempo promedio entre fallas consecutivas de los equipos. Mayor = mejor. Indica la confiabilidad de la maquinaria: más horas entre fallas = operación más estable.',
    },
    {
      title: 'Disponibilidad',
      value: data?.availability ?? null,
      unit: '%',
      maxValue: 100,
      info: 'Porcentaje de tiempo que los equipos estuvieron operativos versus el tiempo total planificado. 95%+ es excelente. Por debajo del 85% impacta directamente la producción.',
    },
    {
      title: 'Completitud',
      value: data?.completionRate ?? null,
      unit: '%',
      maxValue: 100,
      info: 'Porcentaje de órdenes de trabajo completadas sobre el total generado en el período. Refleja la capacidad del equipo de cerrar tareas. 80%+ es el objetivo recomendado.',
    },
    {
      title: 'SLA',
      value: data?.slaCompliance ?? null,
      unit: '%',
      maxValue: 100,
      info: 'Cumplimiento del Acuerdo de Nivel de Servicio — porcentaje de órdenes resueltas dentro del tiempo comprometido según su prioridad. Bajo 70% indica incumplimientos críticos.',
    },
    {
      title: 'Preventivo',
      value: data?.preventiveCompliance ?? null,
      unit: '%',
      maxValue: 100,
      info: 'Porcentaje de mantenimientos preventivos completados a tiempo sobre el total programado. Más del 80% indica buena planificación. Por debajo del 50% señala problemas de gestión.',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {gauges.map((gauge) => (
        <HeroGaugeCard
          key={gauge.title}
          title={gauge.title}
          value={gauge.value}
          unit={gauge.unit}
          maxValue={gauge.maxValue}
          info={gauge.info}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}
