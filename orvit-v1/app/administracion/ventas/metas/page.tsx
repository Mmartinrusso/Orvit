import { Metadata } from 'next';
import { SalesGoalsList } from '@/components/ventas/sales-goals-list';

export const metadata: Metadata = {
  title: 'Metas de Ventas | ORVIT',
  description: 'Gestión de metas y objetivos de ventas',
};

export default function MetasPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Metas de Ventas</h2>
          <p className="text-muted-foreground">
            Gestión de metas, objetivos y seguimiento de desempeño
          </p>
        </div>
      </div>

      <SalesGoalsList />
    </div>
  );
}
