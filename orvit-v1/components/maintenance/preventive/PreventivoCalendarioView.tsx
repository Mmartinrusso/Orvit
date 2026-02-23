'use client';

import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, AlertTriangle, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/contexts/CompanyContext';
import { useMaintenancePending } from '@/hooks/mantenimiento';
import MaintenanceCalendar from '../MaintenanceCalendar';

interface PreventivoCalendarioViewProps {
 className?: string;
 onEventClick?: (maintenance: any) => void;
 onEdit?: (maintenance: any) => void;
}

/**
 * Vista "Calendario" del Preventivo
 * Muestra calendario mensual/semanal con instancias programadas
 * Integra el MaintenanceCalendar existente filtrado por preventivos
 */
export function PreventivoCalendarioView({
 className,
 onEventClick,
 onEdit,
}: PreventivoCalendarioViewProps) {
 const { currentCompany, currentSector } = useCompany();

 const companyId = currentCompany?.id ? parseInt(currentCompany.id.toString()) : null;
 const sectorId = currentSector?.id ? parseInt(currentSector.id.toString()) : null;

 // Fetch de mantenimientos pendientes
 const { data, isLoading, error } = useMaintenancePending({
 companyId,
 sectorId,
 type: 'PREVENTIVE',
 enabled: !!companyId,
 });

 // Filtrar solo preventivos
 const preventiveMaintenances = useMemo(() => {
 const allMaintenances = data?.maintenances || [];
 return allMaintenances.filter(
 (m: any) => m.type === 'PREVENTIVE' || m.isPreventive
 );
 }, [data]);

 // Loading state
 if (isLoading) {
 return (
 <div className={cn('space-y-4', className)}>
 <Skeleton className="h-[600px]" />
 </div>
 );
 }

 // Error state
 if (error) {
 return (
 <div className={cn('space-y-4', className)}>
 <Card>
 <CardContent className="p-8 text-center">
 <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
 <h3 className="text-lg font-semibold mb-2">Error al cargar datos</h3>
 <p className="text-sm text-muted-foreground">
 No se pudieron cargar los mantenimientos preventivos
 </p>
 </CardContent>
 </Card>
 </div>
 );
 }

 // No company selected
 if (!companyId) {
 return (
 <div className={cn('space-y-4', className)}>
 <Card>
 <CardContent className="p-8 text-center">
 <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
 <h3 className="text-lg font-semibold mb-2">Sin empresa seleccionada</h3>
 <p className="text-sm text-muted-foreground">
 Selecciona una empresa para ver el calendario de preventivos
 </p>
 </CardContent>
 </Card>
 </div>
 );
 }

 // Empty state
 if (preventiveMaintenances.length === 0) {
 return (
 <div className={cn('space-y-4', className)}>
 <Card className="p-12">
 <CardContent className="flex flex-col items-center justify-center text-center">
 <div className="rounded-full bg-muted p-4 mb-4">
 <Calendar className="h-12 w-12 text-muted-foreground" />
 </div>
 <h3 className="text-lg font-semibold mb-2">Sin eventos programados</h3>
 <p className="text-sm text-muted-foreground max-w-md">
 No hay mantenimientos preventivos programados. Crea un nuevo plan para verlo en el calendario.
 </p>
 </CardContent>
 </Card>
 </div>
 );
 }

 return (
 <div className={cn('space-y-4', className)}>
 <MaintenanceCalendar
 maintenances={preventiveMaintenances}
 onEventClick={onEventClick}
 companyId={companyId || undefined}
 canEdit={!!onEdit}
 onEdit={onEdit}
 filters={{
 selectedMachines: [],
 selectedUnidadesMoviles: [],
 maintenanceTypes: ['PREVENTIVE'],
 }}
 />
 </div>
 );
}

export default PreventivoCalendarioView;
