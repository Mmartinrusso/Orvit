'use client';

import { PermitToWork, PTWStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  Shield,
  Calendar,
  User,
  MapPin,
  Wrench,
  Clock,
  CheckCircle,
  XCircle,
  PlayCircle,
  PauseCircle,
  StopCircle,
  FileText,
  Phone,
  Lock
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import PTWTypeBadge from './PTWTypeBadge';
import PTWStatusBadge from './PTWStatusBadge';

interface PTWDetailDialogProps {
  permit: PermitToWork | null;
  isOpen: boolean;
  onClose: () => void;
  onAction?: (action: string, permit: PermitToWork) => void;
  mode?: 'dialog' | 'sheet';
}

export default function PTWDetailDialog({
  permit,
  isOpen,
  onClose,
  onAction,
  mode = 'sheet',
}: PTWDetailDialogProps) {
  if (!permit) return null;

  const getAvailableActions = () => {
    const actions: { key: string; label: string; icon: React.ElementType; variant?: 'default' | 'destructive' | 'outline' }[] = [];

    switch (permit.status) {
      case PTWStatus.DRAFT:
        actions.push({ key: 'edit', label: 'Editar', icon: FileText, variant: 'outline' });
        actions.push({ key: 'submit', label: 'Enviar a Aprobacion', icon: CheckCircle, variant: 'default' });
        break;
      case PTWStatus.PENDING_APPROVAL:
        actions.push({ key: 'approve', label: 'Aprobar', icon: CheckCircle, variant: 'default' });
        actions.push({ key: 'reject', label: 'Rechazar', icon: XCircle, variant: 'destructive' });
        break;
      case PTWStatus.APPROVED:
        actions.push({ key: 'activate', label: 'Activar', icon: PlayCircle, variant: 'default' });
        break;
      case PTWStatus.ACTIVE:
        actions.push({ key: 'suspend', label: 'Suspender', icon: PauseCircle, variant: 'outline' });
        actions.push({ key: 'close', label: 'Cerrar', icon: StopCircle, variant: 'default' });
        break;
      case PTWStatus.SUSPENDED:
        actions.push({ key: 'resume', label: 'Reanudar', icon: PlayCircle, variant: 'default' });
        actions.push({ key: 'close', label: 'Cerrar', icon: StopCircle, variant: 'outline' });
        break;
    }

    return actions;
  };

  const Timeline = () => {
    const events = [];

    events.push({
      date: permit.createdAt,
      label: 'Creado',
      user: permit.requestedBy?.name,
      icon: FileText,
      color: 'text-gray-500',
    });

    if (permit.approvedAt) {
      events.push({
        date: permit.approvedAt,
        label: 'Aprobado',
        user: permit.approvedBy?.name,
        icon: CheckCircle,
        color: 'text-blue-500',
        notes: permit.approvalNotes,
      });
    }

    if (permit.rejectedAt) {
      events.push({
        date: permit.rejectedAt,
        label: 'Rechazado',
        user: permit.rejectedBy?.name,
        icon: XCircle,
        color: 'text-red-500',
        notes: permit.rejectionReason,
      });
    }

    if (permit.activatedAt) {
      events.push({
        date: permit.activatedAt,
        label: 'Activado',
        user: permit.activatedBy?.name,
        icon: PlayCircle,
        color: 'text-green-500',
      });
    }

    if (permit.suspendedAt) {
      events.push({
        date: permit.suspendedAt,
        label: 'Suspendido',
        user: permit.suspendedBy?.name,
        icon: PauseCircle,
        color: 'text-orange-500',
        notes: permit.suspensionReason,
      });
    }

    if (permit.resumedAt) {
      events.push({
        date: permit.resumedAt,
        label: 'Reanudado',
        user: permit.resumedBy?.name,
        icon: PlayCircle,
        color: 'text-green-500',
      });
    }

    if (permit.closedAt) {
      events.push({
        date: permit.closedAt,
        label: 'Cerrado',
        user: permit.closedBy?.name,
        icon: StopCircle,
        color: 'text-slate-500',
        notes: permit.closeNotes,
      });
    }

    return (
      <div className="space-y-3">
        {events.map((event, idx) => {
          const Icon = event.icon;
          return (
            <div key={idx} className="flex gap-3">
              <div className={`${event.color} mt-0.5`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{event.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(event.date), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </span>
                </div>
                {event.user && (
                  <p className="text-sm text-muted-foreground">por {event.user}</p>
                )}
                {event.notes && (
                  <p className="text-sm mt-1 text-muted-foreground italic">"{event.notes}"</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const content = (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{permit.number}</p>
          <h3 className="text-xl font-semibold mt-1">{permit.title}</h3>
        </div>
        <div className="flex flex-col items-end gap-2">
          <PTWStatusBadge status={permit.status} />
          <PTWTypeBadge type={permit.type} size="sm" />
        </div>
      </div>

      <Separator />

      {/* Basic Details */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Solicitante:</span>
          <span className="font-medium">{permit.requestedBy?.name || '-'}</span>
        </div>
        {permit.workLocation && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Ubicacion:</span>
            <span className="font-medium">{permit.workLocation}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Valido desde:</span>
          <span className="font-medium">
            {format(new Date(permit.validFrom), 'dd/MM/yyyy HH:mm', { locale: es })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Valido hasta:</span>
          <span className="font-medium">
            {format(new Date(permit.validTo), 'dd/MM/yyyy HH:mm', { locale: es })}
          </span>
        </div>
      </div>

      {/* Description */}
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-1">Descripcion del Trabajo</h4>
        <p>{permit.description}</p>
      </div>

      {/* Associated entities */}
      {(permit.workOrder || permit.machine) && (
        <div className="grid grid-cols-2 gap-4">
          {permit.workOrder && (
            <div className="p-3 border rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Wrench className="h-4 w-4" />
                Orden de Trabajo
              </div>
              <p className="font-medium">{permit.workOrder.title}</p>
            </div>
          )}
          {permit.machine && (
            <div className="p-3 border rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Wrench className="h-4 w-4" />
                Maquina/Equipo
              </div>
              <p className="font-medium">{permit.machine.name}</p>
            </div>
          )}
        </div>
      )}

      <Separator />

      {/* Hazards */}
      <div>
        <h4 className="flex items-center gap-2 text-sm font-medium mb-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          Peligros Identificados
        </h4>
        <div className="flex flex-wrap gap-2">
          {permit.hazardsIdentified.map((hazard, idx) => (
            <Badge key={idx} variant="secondary" className="bg-yellow-50 text-yellow-800">
              {hazard}
            </Badge>
          ))}
        </div>
      </div>

      {/* Control Measures */}
      <div>
        <h4 className="flex items-center gap-2 text-sm font-medium mb-2">
          <Shield className="h-4 w-4 text-green-500" />
          Medidas de Control
        </h4>
        <div className="flex flex-wrap gap-2">
          {permit.controlMeasures.map((measure, idx) => (
            <Badge key={idx} variant="outline" className="border-green-300 text-green-700">
              {measure}
            </Badge>
          ))}
        </div>
      </div>

      {/* Required PPE */}
      <div>
        <h4 className="text-sm font-medium mb-2">EPP Requerido</h4>
        <div className="flex flex-wrap gap-2">
          {permit.requiredPPE.map((ppe, idx) => (
            <Badge key={idx} variant="outline">
              {ppe}
            </Badge>
          ))}
        </div>
        {permit.ppeVerifiedAt && (
          <p className="text-xs text-muted-foreground mt-2">
            Verificado por {permit.ppeVerifiedBy?.name} el{' '}
            {format(new Date(permit.ppeVerifiedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
          </p>
        )}
      </div>

      {/* Emergency Procedures */}
      {permit.emergencyProcedures && (
        <div>
          <h4 className="text-sm font-medium mb-1">Procedimientos de Emergencia</h4>
          <p className="text-sm">{permit.emergencyProcedures}</p>
        </div>
      )}

      {/* Emergency Contacts */}
      {permit.emergencyContacts && permit.emergencyContacts.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 text-sm font-medium mb-2">
            <Phone className="h-4 w-4 text-blue-500" />
            Contactos de Emergencia
          </h4>
          <div className="space-y-1">
            {permit.emergencyContacts.map((contact: any, idx: number) => (
              <div key={idx} className="text-sm p-2 bg-muted rounded flex items-center gap-2">
                <span className="font-medium">{contact.name}</span>
                <span className="text-muted-foreground">-</span>
                <span>{contact.phone}</span>
                {contact.role && (
                  <span className="text-muted-foreground">({contact.role})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LOTO Executions */}
      {permit.lotoExecutions && permit.lotoExecutions.length > 0 && (
        <>
          <Separator />
          <div>
            <h4 className="flex items-center gap-2 text-sm font-medium mb-2">
              <Lock className="h-4 w-4 text-red-500" />
              Ejecuciones LOTO Asociadas
            </h4>
            <div className="space-y-2">
              {permit.lotoExecutions.map((loto: any) => (
                <div key={loto.id} className="p-2 border rounded-lg text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{loto.procedure?.name}</span>
                    <Badge variant={loto.status === 'LOCKED' ? 'destructive' : 'secondary'}>
                      {loto.status === 'LOCKED' ? 'Bloqueado' : loto.status === 'UNLOCKED' ? 'Desbloqueado' : 'Parcial'}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {loto.lockedBy?.name} - {format(new Date(loto.lockedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* Timeline */}
      <div>
        <h4 className="text-sm font-medium mb-3">Historial</h4>
        <Timeline />
      </div>
    </div>
  );

  const actions = getAvailableActions();
  const footer = actions.length > 0 && onAction ? (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={onClose}>
        Cerrar
      </Button>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.key}
            variant={action.variant || 'default'}
            onClick={() => onAction(action.key, permit)}
          >
            <Icon className="h-4 w-4 mr-2" />
            {action.label}
          </Button>
        );
      })}
    </div>
  ) : (
    <Button onClick={onClose}>Cerrar</Button>
  );

  if (mode === 'dialog') {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Detalle del Permiso de Trabajo</DialogTitle>
            <DialogDescription>
              Informacion completa del PTW {permit.number}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            {content}
          </ScrollArea>
          <DialogFooter>{footer}</DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalle del Permiso de Trabajo</SheetTitle>
          <SheetDescription>
            Informacion completa del PTW {permit.number}
          </SheetDescription>
        </SheetHeader>
        <div className="py-4">
          {content}
        </div>
        <SheetFooter>{footer}</SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
