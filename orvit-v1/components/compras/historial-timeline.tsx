'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import {
 type AuditableEntity,
 type AuditAction,
 ENTIDAD_CONFIG,
 ACCION_CONFIG,
} from '@/lib/compras/audit-config';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export interface HistorialEvento {
 id: number;
 eventKey: string;
 entidad: AuditableEntity;
 entidadId: number;
 numeroDocumento: string;
 documentUrl: string;
 entidadLabel: string;
 accion: AuditAction;
 message: string;
 estadoAnterior?: string;
 estadoNuevo?: string;
 metadata?: {
 reason?: string;
 amount?: number;
 relatedIds?: Array<{ entity: AuditableEntity; id: number; numero?: string }>;
 };
 proveedor?: { id: number; nombre: string } | null;
 usuario: { id: number; nombre: string };
 createdAt: string;
 relativeTime: string;
}

interface HistorialTimelineProps {
 eventos: HistorialEvento[];
 isLoading?: boolean;
 hasMore?: boolean;
 onLoadMore?: () => void;
}

// Obtener etiqueta de día relativo
function getRelativeDay(dateStr: string): string {
 const date = parseISO(dateStr);

 if (isToday(date)) {
 return 'Hoy';
 }
 if (isYesterday(date)) {
 return 'Ayer';
 }

 // "Lun 6 Ene", "Mar 7 Ene", etc.
 return format(date, "EEE d MMM", { locale: es });
}

// Componente para un evento individual
function HistorialEventItem({ evento }: { evento: HistorialEvento }) {
 const entidadConfig = ENTIDAD_CONFIG[evento.entidad];
 const Icon = entidadConfig?.icon;

 // Clases para el badge según la acción
 const getBadgeClasses = () => {
 switch (evento.accion) {
 case 'APPROVE':
 case 'COMPLETE':
 return 'bg-success-muted text-success hover:bg-success-muted border-success-muted';
 case 'REJECT':
 case 'CANCEL':
 case 'DELETE':
 return 'bg-destructive/10 text-destructive hover:bg-destructive/10 border-destructive/30';
 case 'CREATE':
 return 'bg-info-muted text-info-muted-foreground hover:bg-info-muted border-info-muted';
 case 'STATUS_CHANGE':
 default:
 return 'bg-muted text-foreground hover:bg-accent border-border';
 }
 };

 return (
 <div className="flex items-start gap-3 py-2.5 px-3 hover:bg-muted/50 rounded-md transition-colors">
 {/* Icono de entidad */}
 <div className="flex-shrink-0 mt-0.5">
 {Icon && (
 <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
 <Icon className="w-3.5 h-3.5 text-muted-foreground" />
 </div>
 )}
 </div>

 {/* Contenido principal */}
 <div className="flex-1 min-w-0">
 {/* Primera línea: número de documento + proveedor */}
 <div className="flex items-center gap-2 flex-wrap">
 <Link
 href={evento.documentUrl}
 className="font-medium text-xs hover:underline text-primary"
 >
 {evento.numeroDocumento}
 </Link>
 <span className="text-[10px] text-muted-foreground">
 {evento.entidadLabel}
 </span>
 {evento.proveedor && (
 <>
 <span className="text-muted-foreground text-[10px]">•</span>
 <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">
 {evento.proveedor.nombre}
 </span>
 </>
 )}
 </div>

 {/* Segunda línea: mensaje de la acción */}
 <div className="flex items-center gap-2 mt-0.5">
 <Badge
 variant="outline"
 className={cn('text-[10px] font-normal px-1.5 py-0 h-5', getBadgeClasses())}
 >
 {evento.message}
 </Badge>
 </div>

 {/* Tercera línea: usuario y tiempo */}
 <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
 <span>{evento.usuario.nombre}</span>
 <span>•</span>
 <span>{evento.relativeTime}</span>
 </div>

 {/* Metadata adicional (razón de rechazo, etc.) */}
 {evento.metadata?.reason && evento.accion !== 'REJECT' && evento.accion !== 'CANCEL' && (
 <p className="mt-1 text-[10px] text-muted-foreground italic">
 {evento.metadata.reason}
 </p>
 )}
 </div>
 </div>
 );
}

// Componente principal del timeline
export function HistorialTimeline({
 eventos,
 isLoading = false,
 hasMore = false,
 onLoadMore,
}: HistorialTimelineProps) {
 // Agrupar eventos por día
 const groupedByDay = useMemo(() => {
 const groups: Record<string, HistorialEvento[]> = {};

 eventos.forEach((evento) => {
 const day = getRelativeDay(evento.createdAt);
 if (!groups[day]) {
 groups[day] = [];
 }
 groups[day].push(evento);
 });

 return groups;
 }, [eventos]);

 // Obtener días ordenados (Hoy primero, luego Ayer, luego por fecha)
 const sortedDays = useMemo(() => {
 return Object.keys(groupedByDay).sort((a, b) => {
 if (a === 'Hoy') return -1;
 if (b === 'Hoy') return 1;
 if (a === 'Ayer') return -1;
 if (b === 'Ayer') return 1;
 return 0; // Mantener orden original para otros días
 });
 }, [groupedByDay]);

 if (eventos.length === 0 && !isLoading) {
 return (
 <div className="text-center py-10 text-muted-foreground">
 <p className="text-sm">No hay eventos en el historial</p>
 <p className="text-xs mt-1">Los cambios de estado aparecerán aquí</p>
 </div>
 );
 }

 return (
 <div className="space-y-1">
 {sortedDays.map((day) => (
 <div key={day}>
 {/* Separador de día */}
 <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-1.5 px-3 border-b">
 <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
 {day}
 </span>
 </div>

 {/* Eventos del día */}
 <div className="divide-y">
 {groupedByDay[day].map((evento) => (
 <HistorialEventItem key={evento.eventKey} evento={evento} />
 ))}
 </div>
 </div>
 ))}

 {/* Cargar más */}
 {(hasMore || isLoading) && (
 <div className="flex justify-center py-3 border-t">
 <Button
 variant="ghost"
 size="sm"
 onClick={onLoadMore}
 disabled={isLoading}
 className="text-xs h-7"
 >
 {isLoading ? (
 <>
 <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
 Cargando...
 </>
 ) : (
 'Cargar más'
 )}
 </Button>
 </div>
 )}
 </div>
 );
}

export default HistorialTimeline;
