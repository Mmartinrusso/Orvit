'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar, Clock, Wrench, AlertTriangle } from 'lucide-react';
import type { ReportModalData, Machine, Maintenance } from './types';

interface MaintenanceReportDocumentProps {
  data: ReportModalData;
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'Alta':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'Media':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'Baja':
      return 'bg-green-100 text-green-700 border-green-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function MaintenanceCard({ maintenance, type }: { maintenance: Maintenance; type: 'preventive' | 'corrective' }) {
  const borderColor = type === 'preventive' ? 'border-l-green-500' : 'border-l-amber-500';
  const kindBadgeColor = type === 'preventive' 
    ? 'bg-green-100 text-green-700 border-green-200' 
    : 'bg-amber-100 text-amber-700 border-amber-200';

  return (
    <div className={cn('avoid-break border rounded-lg border-l-4 bg-white print:shadow-none', borderColor)}>
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h5 className="text-sm font-semibold text-gray-900 mb-1">
              ID: {maintenance.id} - {maintenance.title}
            </h5>
            {maintenance.description && (
              <p className="text-xs text-gray-600 mb-2 whitespace-pre-line leading-relaxed">
                {maintenance.description}
              </p>
            )}
            <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>{maintenance.frequencyLabel}</span>
              <Clock className="h-3 w-3 ml-2 flex-shrink-0" />
              <span>Duración: {maintenance.durationMinutes} min</span>
              {maintenance.nextDate && (
                <>
                  <Calendar className="h-3 w-3 ml-2 flex-shrink-0" />
                  <span>Próximo: {maintenance.nextDate}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1 ml-2 flex-shrink-0 print:gap-0.5">
            <Badge className={cn(kindBadgeColor, 'text-xs px-2 py-0.5 print:text-[10px] print:px-1.5')}>
              {maintenance.kind}
            </Badge>
            <Badge className={cn(getPriorityColor(maintenance.priority), 'text-xs px-2 py-0.5 print:text-[10px] print:px-1.5')}>
              {maintenance.priority}
            </Badge>
            {maintenance.mandatory && (
              <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs px-2 py-0.5 print:text-[10px] print:px-1.5">
                Obligatorio
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MachineSection({ machine, index }: { machine: Machine; index: number }) {
  const totalMaintenances = machine.preventives.length + (machine.correctives?.length || 0);
  
  return (
    <div className="avoid-break-before space-y-3">
      {/* Machine Header */}
      <div className="avoid-break bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 print:bg-blue-50 print:border-blue-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center print:bg-blue-600">
              <Wrench className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">{machine.name}</h3>
              <p className="text-xs text-gray-600">
                {totalMaintenances} mantenimiento{totalMaintenances !== 1 ? 's' : ''} total
                {machine.subtitle && ` • ${machine.subtitle}`}
              </p>
            </div>
          </div>
          <div className="text-right">
            {machine.metaRightTop && (
              <div className="text-xs text-gray-500">{machine.metaRightTop}</div>
            )}
            {machine.metaRightBottom && (
              <div className="text-xs text-gray-400">{machine.metaRightBottom}</div>
            )}
          </div>
        </div>
      </div>

      {/* Preventive Maintenances */}
      {machine.preventives.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 avoid-break">
            <Wrench className="h-4 w-4 text-green-600" />
            <h4 className="text-sm font-semibold text-gray-900">
              Mantenimientos Preventivos ({machine.preventives.length})
            </h4>
          </div>
          <div className="space-y-2">
            {machine.preventives.map((maint) => (
              <MaintenanceCard key={maint.id} maintenance={maint} type="preventive" />
            ))}
          </div>
        </div>
      )}

      {/* Corrective Maintenances */}
      {machine.correctives && machine.correctives.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 avoid-break">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h4 className="text-sm font-semibold text-gray-900">
              Mantenimientos Correctivos ({machine.correctives.length})
            </h4>
          </div>
          <div className="space-y-2">
            {machine.correctives.map((maint) => (
              <MaintenanceCard key={maint.id} maintenance={maint} type="corrective" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MaintenanceReportDocument({ data }: MaintenanceReportDocumentProps) {
  return (
    <div className="report-print-root bg-white text-gray-900 print:bg-white">
      {/* Document Header */}
      <div className="avoid-break border-b pb-4 mb-4 print:pb-3 print:mb-3">
        <h1 className="text-xl font-bold text-gray-900 print:text-lg">{data.company}</h1>
        <p className="text-base text-gray-600 mt-0.5 print:text-sm">{data.reportTitle}</p>
        <p className="text-xs text-gray-500 mt-0.5">{data.generatedAtLabel}</p>
      </div>

      {/* Summary Cards */}
      <div className="avoid-break grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 print:grid-cols-4 print:gap-2 print:mb-3">
        <Card className="bg-blue-50 border-blue-200 print:shadow-none">
          <CardContent className="p-3 text-center print:p-2">
            <div className="text-xs text-blue-600 font-medium">Categoría</div>
            <div className="text-sm font-bold text-blue-800 mt-0.5 print:text-xs">{data.category}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-green-50 border-green-200 print:shadow-none">
          <CardContent className="p-3 text-center print:p-2">
            <div className="text-xs text-green-600 font-medium">Frecuencia</div>
            <div className="text-sm font-bold text-green-800 mt-0.5 print:text-xs">{data.frequency}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-purple-50 border-purple-200 print:shadow-none">
          <CardContent className="p-3 text-center print:p-2">
            <div className="text-xs text-purple-600 font-medium">Total Items</div>
            <div className="text-sm font-bold text-purple-800 mt-0.5 print:text-xs">{data.totalItems}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-orange-50 border-orange-200 print:shadow-none">
          <CardContent className="p-3 text-center print:p-2">
            <div className="text-xs text-orange-600 font-medium">Tiempo Estimado</div>
            <div className="text-sm font-bold text-orange-800 mt-0.5 print:text-xs">{data.estimatedTime}</div>
          </CardContent>
        </Card>
      </div>

      {/* Applied Filters */}
      {data.filters.length > 0 && (
        <div className="avoid-break bg-gray-50 rounded-lg p-3 mb-4 print:mb-3 print:bg-gray-100">
          <h4 className="text-sm font-semibold mb-2">Filtros aplicados:</h4>
          <div className="flex flex-wrap gap-2">
            {data.filters.map((filter, index) => (
              <Badge key={index} variant="outline" className="text-xs print:text-[10px]">
                {filter}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Machines Sections */}
      <div className="space-y-6 print:space-y-4">
        {data.machines.map((machine, index) => (
          <MachineSection key={machine.id} machine={machine} index={index} />
        ))}
      </div>

      {/* Document Footer */}
      <div className="avoid-break border-t mt-6 pt-3 print:mt-4 print:pt-2">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Listado generado automáticamente por el sistema de mantenimiento</span>
          <span>{data.generatedAtLabel}</span>
        </div>
      </div>
    </div>
  );
}

export default MaintenanceReportDocument;

