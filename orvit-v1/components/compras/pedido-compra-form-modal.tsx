'use client';

import { useState, useEffect } from 'react';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
 DialogBody,
 DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ClipboardList, Loader2 } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';

interface PedidoCompraFormModalProps {
 open: boolean;
 onClose: () => void;
 pedidoId?: number;
 onSuccess?: () => void;
}

const PRIORIDADES = [
 { value: 'BAJA', label: 'Baja', description: 'Sin urgencia' },
 { value: 'NORMAL', label: 'Normal', description: 'Plazo estándar' },
 { value: 'ALTA', label: 'Alta', description: 'Priorizar' },
 { value: 'URGENTE', label: 'Urgente', description: 'Lo antes posible' },
];

export function PedidoCompraFormModal({
 open,
 onClose,
 pedidoId,
 onSuccess,
}: PedidoCompraFormModalProps) {
 const [descripcion, setDescripcion] = useState('');
 const [prioridad, setPrioridad] = useState('NORMAL');
 const [fechaNecesidad, setFechaNecesidad] = useState('');
 const [notas, setNotas] = useState('');

 const [submitting, setSubmitting] = useState(false);
 const [loading, setLoading] = useState(false);

 useEffect(() => {
 if (open) {
 if (pedidoId) {
 loadPedido(pedidoId);
 } else {
 resetForm();
 }
 }
 }, [open, pedidoId]);

 const loadPedido = async (id: number) => {
 setLoading(true);
 try {
 const response = await fetch(`/api/compras/pedidos/${id}`);
 if (response.ok) {
 const data = await response.json();
 const fullDescription = data.titulo + (data.descripcion ? `\n${data.descripcion}` : '');
 setDescripcion(fullDescription);
 setPrioridad(data.prioridad || 'NORMAL');
 setFechaNecesidad(data.fechaNecesidad ? data.fechaNecesidad.split('T')[0] : '');
 setNotas(data.notas || '');
 } else {
 toast.error('Error al cargar el pedido');
 }
 } catch (error) {
 console.error('Error loading pedido:', error);
 toast.error('Error al cargar el pedido');
 } finally {
 setLoading(false);
 }
 };

 const resetForm = () => {
 setDescripcion('');
 setPrioridad('NORMAL');
 setFechaNecesidad('');
 setNotas('');
 };

 const validateForm = (): boolean => {
 if (!descripcion.trim()) {
 toast.error('Describe qué necesitas');
 return false;
 }
 if (descripcion.trim().length < 10) {
 toast.error('La descripción es muy corta');
 return false;
 }
 return true;
 };

 const extractTitle = (text: string): { titulo: string; descripcion: string } => {
 const lines = text.trim().split('\n');
 const firstLine = lines[0].trim();

 if (firstLine.length <= 100) {
 return {
 titulo: firstLine,
 descripcion: lines.slice(1).join('\n').trim()
 };
 }

 const words = firstLine.split(' ');
 let titulo = '';
 for (const word of words) {
 if ((titulo + ' ' + word).length > 80) break;
 titulo = titulo ? titulo + ' ' + word : word;
 }

 return {
 titulo: titulo + '...',
 descripcion: text.trim()
 };
 };

 const handleSubmit = async () => {
 if (!validateForm()) return;

 setSubmitting(true);
 try {
 const { titulo, descripcion: desc } = extractTitle(descripcion);

 const payload = {
 titulo,
 descripcion: desc,
 prioridad,
 fechaNecesidad: fechaNecesidad || null,
 notas: notas || null,
 items: [{
 descripcion: titulo,
 cantidad: 1,
 unidad: 'UN',
 especificaciones: desc
 }]
 };

 const url = pedidoId
 ? `/api/compras/pedidos/${pedidoId}`
 : '/api/compras/pedidos';

 const response = await fetch(url, {
 method: pedidoId ? 'PUT' : 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 });

 if (response.ok) {
 const data = await response.json();
 toast.success(
 pedidoId ? 'Pedido actualizado' : `Pedido ${data.numero} creado`
 );
 onClose();
 onSuccess?.();
 } else {
 const error = await response.json();
 toast.error(error.error || 'Error al guardar el pedido');
 }
 } catch (error) {
 console.error('Error saving pedido:', error);
 toast.error('Error al guardar el pedido');
 } finally {
 setSubmitting(false);
 }
 };

 return (
 <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
 <DialogContent size="default">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2 text-base font-semibold">
 <ClipboardList className="h-5 w-5" />
 {pedidoId ? 'Editar Pedido' : 'Nuevo Pedido de Compra'}
 </DialogTitle>
 <DialogDescription className="text-sm">
 Describe qué necesitas y cuándo. El equipo de compras se encargará de cotizar.
 </DialogDescription>
 </DialogHeader>

 <DialogBody>
 {loading ? (
 <div className="flex items-center justify-center py-8">
 <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
 </div>
 ) : (
 <div className="space-y-4">
 <div className="space-y-2">
 <Label className="text-sm font-medium">¿Qué necesitas?</Label>
 <Textarea
 placeholder="Ej: Necesito 10 pallets de cemento Portland para la obra de calle San Martín..."
 value={descripcion}
 onChange={(e) => setDescripcion(e.target.value)}
 rows={3}
 className="resize-none text-sm"
 autoFocus
 />
 <p className="text-xs text-muted-foreground">
 Incluye cantidad, producto y cualquier detalle importante
 </p>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-sm font-medium">Prioridad</Label>
 <Select value={prioridad} onValueChange={setPrioridad}>
 <SelectTrigger className="h-9">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {PRIORIDADES.map((p) => (
 <SelectItem key={p.value} value={p.value}>
 <span className="text-sm">{p.label}</span>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label className="text-sm font-medium">¿Para cuándo?</Label>
 <DatePicker
 value={fechaNecesidad}
 onChange={(date) => setFechaNecesidad(date)}
 placeholder="Seleccionar fecha"
 clearable
 className="h-9"
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label className="text-sm font-medium text-muted-foreground">
 Notas adicionales (opcional)
 </Label>
 <Textarea
 placeholder="Información extra para el equipo de compras..."
 value={notas}
 onChange={(e) => setNotas(e.target.value)}
 rows={2}
 className="resize-none text-sm"
 />
 </div>
 </div>
 )}
 </DialogBody>

 <DialogFooter className="gap-2">
 <Button
 variant="outline"
 onClick={onClose}
 disabled={submitting}
 className="h-8 px-3 text-sm"
 >
 Cancelar
 </Button>
 <Button
 onClick={handleSubmit}
 disabled={submitting || !descripcion.trim()}
 className="h-8 px-3 text-sm"
 >
 {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
 {pedidoId ? 'Guardar Cambios' : 'Crear Pedido'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}

export default PedidoCompraFormModal;
