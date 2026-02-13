'use client';

import { useCompany } from '@/contexts/CompanyContext';
import { useSearchParams } from 'next/navigation';
import { Settings } from 'lucide-react';
import EnhancedMaintenancePanel from '@/components/maintenance/EnhancedMaintenancePanel';

export default function MantenimientosPage() {
  const { currentCompany, currentSector } = useCompany();
  const searchParams = useSearchParams();

  // Leer correctiveId de la URL para abrir un mantenimiento específico
  const correctiveIdParam = searchParams.get('correctiveId');
  const initialMaintenanceId = correctiveIdParam ? parseInt(correctiveIdParam) : undefined;

  // Usar el nuevo panel mejorado
  if (currentCompany) {
    return (
      <div className="h-screen sidebar-shell">
        <div className="px-4 md:px-6 py-4 space-y-4">
          <EnhancedMaintenancePanel
            companyId={parseInt(currentCompany.id.toString())}
            sectorId={currentSector?.id ? parseInt(currentSector.id.toString()) : undefined}
            sectorName={currentSector?.name}
            initialMaintenanceId={initialMaintenanceId}
          />
        </div>
      </div>
    );
  }

    return (
      <div className="h-screen sidebar-shell">
        <div className="px-4 md:px-6 py-4">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <Settings className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h2 className="text-sm font-medium mb-2">No hay empresa seleccionada</h2>
              <p className="text-sm text-muted-foreground">Selecciona una empresa para ver los mantenimientos</p>
            </div>
          </div>
        </div>
      </div>
    );
}