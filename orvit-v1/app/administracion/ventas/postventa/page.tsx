import { Metadata } from 'next';
import { RMASList } from '@/components/ventas/rmas-list';

export const metadata: Metadata = {
  title: 'Postventa - RMAs y Devoluciones | ORVIT',
  description: 'Gestión de RMAs, devoluciones y garantías',
};

export default function PostventaPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Postventa</h2>
          <p className="text-muted-foreground">
            Gestión de RMAs, devoluciones y garantías de productos
          </p>
        </div>
      </div>

      <RMASList />
    </div>
  );
}
