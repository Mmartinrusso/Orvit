'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Phone,
  Mail,
  MessageCircle,
  FileText,
  Calendar,
  Save,
  Loader2,
  AlertCircle,
  User,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// =====================================================
// TYPES
// =====================================================

type CollectionActionType =
  | 'LLAMADA'
  | 'EMAIL'
  | 'WHATSAPP'
  | 'CARTA'
  | 'VISITA'
  | 'ACUERDO_PAGO'
  | 'OTRO';

type CollectionResult =
  | 'CONTACTADO'
  | 'NO_CONTESTO'
  | 'NUMERO_ERRONEO'
  | 'PROMESA_PAGO'
  | 'RECHAZO'
  | 'ACUERDO'
  | 'PENDIENTE';

interface CollectionActionFormData {
  clientId: number;
  invoiceId?: number;
  tipo: CollectionActionType;
  resultado: CollectionResult;
  fecha: string;
  hora: string;
  contacto: string;
  notas: string;
  proximaAccion?: string;
  proximaFecha?: string;
  montoPromesa?: number;
  fechaPromesa?: string;
}

interface CollectionAction {
  id: number;
  clientId: number;
  invoiceId?: number;
  tipo: string;
  resultado: string;
  fecha: string;
  contacto?: string;
  notas?: string;
  proximaAccion?: string;
  proximaFecha?: string;
  montoPromesa?: number;
  fechaPromesa?: string;
}

interface CollectionActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: number;
  clientName?: string;
  invoiceId?: number;
  invoiceNumber?: string;
  overdueAmount?: number;
  action?: CollectionAction | null; // For editing
  onSuccess?: () => void;
}

// =====================================================
// CONSTANTS
// =====================================================

const ACTION_TYPES: { value: CollectionActionType; label: string; icon: React.ElementType }[] = [
  { value: 'LLAMADA', label: 'Llamada telefónica', icon: Phone },
  { value: 'EMAIL', label: 'Email', icon: Mail },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: MessageCircle },
  { value: 'CARTA', label: 'Carta de cobranza', icon: FileText },
  { value: 'VISITA', label: 'Visita presencial', icon: User },
  { value: 'ACUERDO_PAGO', label: 'Acuerdo de pago', icon: FileText },
  { value: 'OTRO', label: 'Otro', icon: AlertCircle },
];

const RESULTS: { value: CollectionResult; label: string; color: string }[] = [
  { value: 'CONTACTADO', label: 'Contactado', color: 'bg-blue-100 text-blue-700' },
  { value: 'NO_CONTESTO', label: 'No contestó', color: 'bg-gray-100 text-gray-700' },
  { value: 'NUMERO_ERRONEO', label: 'Número erróneo', color: 'bg-red-100 text-red-700' },
  { value: 'PROMESA_PAGO', label: 'Promesa de pago', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'RECHAZO', label: 'Rechazó pagar', color: 'bg-red-100 text-red-700' },
  { value: 'ACUERDO', label: 'Acuerdo alcanzado', color: 'bg-green-100 text-green-700' },
  { value: 'PENDIENTE', label: 'Pendiente', color: 'bg-gray-100 text-gray-700' },
];

// =====================================================
// COMPONENT
// =====================================================

export function CollectionActionModal({
  open,
  onOpenChange,
  clientId,
  clientName,
  invoiceId,
  invoiceNumber,
  overdueAmount,
  action,
  onSuccess,
}: CollectionActionModalProps) {
  const isEditing = !!action;
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const [formData, setFormData] = useState<CollectionActionFormData>({
    clientId,
    invoiceId,
    tipo: 'LLAMADA',
    resultado: 'PENDIENTE',
    fecha: format(now, 'yyyy-MM-dd'),
    hora: format(now, 'HH:mm'),
    contacto: '',
    notas: '',
    proximaAccion: '',
    proximaFecha: '',
    montoPromesa: undefined,
    fechaPromesa: '',
  });

  // Initialize form when editing
  useEffect(() => {
    if (action) {
      const actionDate = new Date(action.fecha);
      setFormData({
        clientId: action.clientId,
        invoiceId: action.invoiceId,
        tipo: action.tipo as CollectionActionType,
        resultado: action.resultado as CollectionResult,
        fecha: format(actionDate, 'yyyy-MM-dd'),
        hora: format(actionDate, 'HH:mm'),
        contacto: action.contacto || '',
        notas: action.notas || '',
        proximaAccion: action.proximaAccion || '',
        proximaFecha: action.proximaFecha?.split('T')[0] || '',
        montoPromesa: action.montoPromesa,
        fechaPromesa: action.fechaPromesa?.split('T')[0] || '',
      });
    } else {
      // Reset for new action
      setFormData({
        clientId,
        invoiceId,
        tipo: 'LLAMADA',
        resultado: 'PENDIENTE',
        fecha: format(now, 'yyyy-MM-dd'),
        hora: format(now, 'HH:mm'),
        contacto: '',
        notas: '',
        proximaAccion: '',
        proximaFecha: '',
        montoPromesa: undefined,
        fechaPromesa: '',
      });
    }
  }, [action, clientId, invoiceId, open]);

  const handleSubmit = async () => {
    // Validation
    if (!formData.fecha || !formData.hora) {
      toast.error('La fecha y hora son requeridas');
      return;
    }

    if (formData.resultado === 'PROMESA_PAGO' && !formData.montoPromesa) {
      toast.error('El monto de la promesa es requerido');
      return;
    }

    setLoading(true);
    try {
      const fechaCompleta = new Date(`${formData.fecha}T${formData.hora}:00`);

      const body = {
        clientId: formData.clientId,
        invoiceId: formData.invoiceId,
        tipo: formData.tipo,
        resultado: formData.resultado,
        fecha: fechaCompleta.toISOString(),
        contacto: formData.contacto || null,
        notas: formData.notas || null,
        proximaAccion: formData.proximaAccion || null,
        proximaFecha: formData.proximaFecha
          ? new Date(formData.proximaFecha).toISOString()
          : null,
        montoPromesa: formData.montoPromesa || null,
        fechaPromesa: formData.fechaPromesa
          ? new Date(formData.fechaPromesa).toISOString()
          : null,
      };

      const url = isEditing
        ? `/api/ventas/cobranzas/acciones/${action.id}`
        : '/api/ventas/cobranzas/acciones';

      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success(isEditing ? 'Acción actualizada' : 'Acción registrada');
        onOpenChange(false);
        onSuccess?.();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al guardar acción');
    } finally {
      setLoading(false);
    }
  };

  const selectedActionType = ACTION_TYPES.find((t) => t.value === formData.tipo);
  const ActionIcon = selectedActionType?.icon || Phone;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ActionIcon className="w-5 h-5" />
            {isEditing ? 'Editar Acción de Cobranza' : 'Nueva Acción de Cobranza'}
          </DialogTitle>
          <DialogDescription>
            <div className="space-y-1">
              {clientName && <span>Cliente: <strong>{clientName}</strong></span>}
              {invoiceNumber && (
                <span className="block">
                  Factura: <strong>{invoiceNumber}</strong>
                  {overdueAmount && (
                    <Badge variant="destructive" className="ml-2">
                      Vencido: ${overdueAmount.toLocaleString()}
                    </Badge>
                  )}
                </span>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Tipo de Acción */}
          <div className="space-y-2">
            <Label>Tipo de Acción</Label>
            <Select
              value={formData.tipo}
              onValueChange={(v: CollectionActionType) =>
                setFormData((prev) => ({ ...prev, tipo: v }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="w-4 h-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fecha y Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Fecha *
              </Label>
              <Input
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData((prev) => ({ ...prev, fecha: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Hora *
              </Label>
              <Input
                type="time"
                value={formData.hora}
                onChange={(e) => setFormData((prev) => ({ ...prev, hora: e.target.value }))}
              />
            </div>
          </div>

          {/* Contacto */}
          <div className="space-y-2">
            <Label>Persona Contactada</Label>
            <Input
              value={formData.contacto}
              onChange={(e) => setFormData((prev) => ({ ...prev, contacto: e.target.value }))}
              placeholder="Nombre de la persona contactada"
            />
          </div>

          {/* Resultado */}
          <div className="space-y-2">
            <Label>Resultado</Label>
            <Select
              value={formData.resultado}
              onValueChange={(v: CollectionResult) =>
                setFormData((prev) => ({ ...prev, resultado: v }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESULTS.map((result) => (
                  <SelectItem key={result.value} value={result.value}>
                    <Badge className={result.color}>{result.label}</Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Promesa de Pago (condicional) */}
          {formData.resultado === 'PROMESA_PAGO' && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="space-y-2">
                <Label>Monto Prometido ($) *</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.montoPromesa || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      montoPromesa: parseFloat(e.target.value) || undefined,
                    }))
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Fecha Promesa</Label>
                <Input
                  type="date"
                  value={formData.fechaPromesa}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, fechaPromesa: e.target.value }))
                  }
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          )}

          {/* Notas */}
          <div className="space-y-2">
            <Label>Notas / Observaciones</Label>
            <Textarea
              value={formData.notas}
              onChange={(e) => setFormData((prev) => ({ ...prev, notas: e.target.value }))}
              placeholder="Detalles de la conversación, compromisos, etc."
              rows={3}
            />
          </div>

          {/* Próxima Acción */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div className="space-y-2">
              <Label>Próxima Acción</Label>
              <Select
                value={formData.proximaAccion || ''}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, proximaAccion: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin programar</SelectItem>
                  {ACTION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha Próxima Acción</Label>
              <Input
                type="date"
                value={formData.proximaFecha}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, proximaFecha: e.target.value }))
                }
                min={new Date().toISOString().split('T')[0]}
                disabled={!formData.proximaAccion}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isEditing ? 'Guardar Cambios' : 'Registrar Acción'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
