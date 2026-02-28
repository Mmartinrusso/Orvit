'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Activity, HeartPulse, Cog, Lightbulb } from 'lucide-react';

const TABS = [
  {
    href: '/mantenimiento/confiabilidad/metricas',
    label: 'Métricas MTBF/MTTR',
    labelShort: 'Métricas',
    icon: Activity
  },
  {
    href: '/mantenimiento/confiabilidad/salud',
    label: 'Salud de Activos',
    labelShort: 'Salud',
    icon: HeartPulse
  },
  {
    href: '/mantenimiento/confiabilidad/componentes',
    label: 'Por Componentes',
    labelShort: 'Componentes',
    icon: Cog
  },
  {
    href: '/mantenimiento/confiabilidad/soluciones',
    label: 'Base de Soluciones',
    labelShort: 'Soluciones',
    icon: Lightbulb
  }
];

export default function ConfiabilidadLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="border-b">
        <nav className="-mb-px flex gap-0 overflow-x-auto" aria-label="Confiabilidad">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex items-center gap-2 px-4 pb-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden md:inline">{tab.label}</span>
                <span className="md:hidden">{tab.labelShort}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sub-page content */}
      {children}
    </div>
  );
}
