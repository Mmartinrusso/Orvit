'use client';

import { useState } from 'react';
import { PermitToWork } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, AlertTriangle, Shield, Calendar, User, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import PTWTypeBadge from './PTWTypeBadge';
import PTWStatusBadge from './PTWStatusBadge';

interface PTWApprovalDialogProps {
  permit: PermitToWork | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (permit: PermitToWork, notes?: string) => Promise<void>;
  onReject: (permit: PermitToWork, reason: string) => Promise<void>;
}

export default function PTWApprovalDialog({
  permit,
  isOpen,
  onClose,
  onApprove,
  onReject,
}: PTWApprovalDialogProps) {
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const handleApprove = async () => {
    if (!permit) return;
    setIsApproving(true);
    try {
      await onApprove(permit, approvalNotes || undefined);
      onClose();
    } catch (error) {
      console.error('Error approving PTW:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!permit || !rejectionReason.trim()) return;
    setIsRejecting(true);
    try {
      await onReject(permit, rejectionReason);
      setShowRejectDialog(false);
      onClose();
    } catch (error) {
      console.error('Error rejecting PTW:', error);
    } finally {
      setIsRejecting(false);
    }
  };

  if (!permit) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Revision de Permiso de Trabajo
              <PTWStatusBadge status={permit.status} size="sm" />
            </DialogTitle>
            <DialogDescription>
              Revise los detalles del PTW antes de aprobar o rechazar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Header Info */}
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-sm text-muted-foreground">{permit.number}</p>
                <h3 className="text-xl font-semibold">{permit.title}</h3>
              </div>
              <PTWTypeBadge type={permit.type} />
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
                <span className="text-muted-foreground">Desde:</span>
                <span className="font-medium">
                  {format(new Date(permit.validFrom), 'dd/MM/yyyy HH:mm', { locale: es })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Hasta:</span>
                <span className="font-medium">
                  {format(new Date(permit.validTo), 'dd/MM/yyyy HH:mm', { locale: es })}
                </span>
              </div>
            </div>

            <Separator />

            {/* Description */}
            <div>
              <Label className="text-muted-foreground">Descripcion del Trabajo</Label>
              <p className="mt-1">{permit.description}</p>
            </div>

            {/* Associated entities */}
            {(permit.workOrder || permit.machine) && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {permit.workOrder && (
                    <div>
                      <Label className="text-muted-foreground">Orden de Trabajo</Label>
                      <p className="font-medium">{permit.workOrder.title}</p>
                    </div>
                  )}
                  {permit.machine && (
                    <div>
                      <Label className="text-muted-foreground">Maquina/Equipo</Label>
                      <p className="font-medium">{permit.machine.name}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            <Separator />

            {/* Hazards */}
            <div>
              <Label className="flex items-center gap-2 text-muted-foreground mb-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Peligros Identificados
              </Label>
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
              <Label className="flex items-center gap-2 text-muted-foreground mb-2">
                <Shield className="h-4 w-4 text-green-500" />
                Medidas de Control
              </Label>
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
              <Label className="text-muted-foreground mb-2 block">EPP Requerido</Label>
              <div className="flex flex-wrap gap-2">
                {permit.requiredPPE.map((ppe, idx) => (
                  <Badge key={idx} variant="outline">
                    {ppe}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Emergency Procedures */}
            {permit.emergencyProcedures && (
              <div>
                <Label className="text-muted-foreground">Procedimientos de Emergencia</Label>
                <p className="mt-1 text-sm">{permit.emergencyProcedures}</p>
              </div>
            )}

            {/* Emergency Contacts */}
            {permit.emergencyContacts && permit.emergencyContacts.length > 0 && (
              <div>
                <Label className="text-muted-foreground mb-2 block">Contactos de Emergencia</Label>
                <div className="space-y-1">
                  {permit.emergencyContacts.map((contact: any, idx: number) => (
                    <div key={idx} className="text-sm p-2 bg-muted rounded">
                      <span className="font-medium">{contact.name}</span>
                      <span className="mx-2">-</span>
                      <span>{contact.phone}</span>
                      {contact.role && <span className="text-muted-foreground ml-2">({contact.role})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Approval Notes */}
            <div>
              <Label htmlFor="approvalNotes">Notas de Aprobacion (opcional)</Label>
              <Textarea
                id="approvalNotes"
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Agregar notas o condiciones de aprobación..."
                rows={2}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isApproving || isRejecting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowRejectDialog(true)}
              disabled={isApproving || isRejecting}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Rechazar
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isApproving || isRejecting}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {isApproving ? 'Aprobando...' : 'Aprobar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Confirmation Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar Permiso de Trabajo</AlertDialogTitle>
            <AlertDialogDescription>
              Indique el motivo del rechazo. Esta accion cancelara el PTW.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="rejectionReason">Motivo del Rechazo *</Label>
            <Textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explique el motivo del rechazo..."
              rows={3}
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRejecting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={!rejectionReason.trim() || isRejecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRejecting ? 'Rechazando...' : 'Confirmar Rechazo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
