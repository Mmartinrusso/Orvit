'use client';

import { useState, useEffect } from 'react';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogDescription,
 DialogBody,
 DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import {
 Repeat,
 Plus,
 Trash2,
 Loader2,
 Calendar,
 Clock,
 Play,
 Pause,
 History,
 CheckCircle2,
 XCircle,
 AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface RecurringItem {
 id?: number;
 descripcion: string;
 cantidad: number;
 unidad: string;
 especificaciones?: string;
}

interface RecurringOrder {
 id: number;
 nombre: string;
 descripcion?: string;
 frecuencia: string;
 diaSemana?: number;
 diaMes?: number;
 horaEjecucion: number;
 isActive: boolean;
 proximaEjecucion?: string;
 ultimaEjecucion?: string;
 totalEjecuciones: number;
 tituloPedido: string;
 prioridad: string;
 departamento?: string;
 diasParaNecesidad: number;
 notas?: string;
 items: RecurringItem[];
 creador: { id: number; name: string };
 _count?: { historial: number };
 historial?: Array<{
 id: number;
 fechaEjecucion: string;
 estado: string;
 errorMessage?: string;
 }>;
}

interface RecurringOrdersModalProps {
 open: boolean;
 onClose: () => void;
 onSuccess?: () => void;
}

const FRECUENCIAS = [
 { value: 'DIARIO', label: 'Diario' },
 { value: 'SEMANAL', label: 'Semanal' },
 { value: 'QUINCENAL', label: 'Quincenal' },
 { value: 'MENSUAL', label: 'Mensual' },
];

const DIAS_SEMANA = [
 { value: 0, label: 'Domingo' },
 { value: 1, label: 'Lunes' },
 { value: 2, label: 'Martes' },
 { value: 3, label: 'Miércoles' },
 { value: 4, label: 'Jueves' },
 { value: 5, label: 'Viernes' },
 { value: 6, label: 'Sábado' },
];

const PRIORIDADES = [
 { value: 'BAJA', label: 'Baja' },
 { value: 'NORMAL', label: 'Normal' },
 { value: 'ALTA', label: 'Alta' },
 { value: 'URGENTE', label: 'Urgente' },
];

export function RecurringOrdersModal({ open, onClose, onSuccess }: RecurringOrdersModalProps) {
 const confirm = useConfirm();
 const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
 const [orders, setOrders] = useState<RecurringOrder[]>([]);
 const [loading, setLoading] = useState(false);
 const [saving, setSaving] = useState(false);
 const [editingOrder, setEditingOrder] = useState<RecurringOrder | null>(null);

 // Form state
 const [nombre, setNombre] = useState('');
 const [descripcion, setDescripcion] = useState('');
 const [frecuencia, setFrecuencia] = useState('MENSUAL');
 const [diaSemana, setDiaSemana] = useState<number>(1);
 const [diaMes, setDiaMes] = useState<number>(1);
 const [horaEjecucion, setHoraEjecucion] = useState(8);
 const [tituloPedido, setTituloPedido] = useState('');
 const [prioridad, setPrioridad] = useState('NORMAL');
 const [diasParaNecesidad, setDiasParaNecesidad] = useState(7);
 const [notas, setNotas] = useState('');
 const [items, setItems] = useState<RecurringItem[]>([
 { descripcion: '', cantidad: 1, unidad: 'UN' }
 ]);

 useEffect(() => {
 if (open) {
 loadOrders();
 }
 }, [open]);

 const loadOrders = async () => {
 setLoading(true);
 try {
 const response = await fetch('/api/compras/pedidos/recurrentes?includeInactive=true');
 if (response.ok) {
 const data = await response.json();
 setOrders(data.data || []);
 }
 } catch (error) {
 toast.error('Error al cargar pedidos recurrentes');
 } finally {
 setLoading(false);
 }
 };

 const resetForm = () => {
 setNombre('');
 setDescripcion('');
 setFrecuencia('MENSUAL');
 setDiaSemana(1);
 setDiaMes(1);
 setHoraEjecucion(8);
 setTituloPedido('');
 setPrioridad('NORMAL');
 setDiasParaNecesidad(7);
 setNotas('');
 setItems([{ descripcion: '', cantidad: 1, unidad: 'UN' }]);
 setEditingOrder(null);
 };

 const handleCreate = () => {
 resetForm();
 setView('create');
 };

 const handleEdit = (order: RecurringOrder) => {
 setEditingOrder(order);
 setNombre(order.nombre);
 setDescripcion(order.descripcion || '');
 setFrecuencia(order.frecuencia);
 setDiaSemana(order.diaSemana || 1);
 setDiaMes(order.diaMes || 1);
 setHoraEjecucion(order.horaEjecucion);
 setTituloPedido(order.tituloPedido);
 setPrioridad(order.prioridad);
 setDiasParaNecesidad(order.diasParaNecesidad);
 setNotas(order.notas || '');
 setItems(order.items.length > 0 ? order.items : [{ descripcion: '', cantidad: 1, unidad: 'UN' }]);
 setView('edit');
 };

 const handleSave = async () => {
 // Validar
 if (!nombre.trim() || !tituloPedido.trim()) {
 toast.error('Nombre y título del pedido son requeridos');
 return;
 }

 const validItems = items.filter(i => i.descripcion.trim());
 if (validItems.length === 0) {
 toast.error('Agrega al menos un item');
 return;
 }

 setSaving(true);
 try {
 const payload = {
 nombre,
 descripcion,
 frecuencia,
 diaSemana: frecuencia === 'SEMANAL' ? diaSemana : null,
 diaMes: frecuencia === 'MENSUAL' ? diaMes : null,
 horaEjecucion,
 tituloPedido,
 prioridad,
 diasParaNecesidad,
 notas,
 items: validItems.map(i => ({
 descripcion: i.descripcion,
 cantidad: i.cantidad,
 unidad: i.unidad,
 especificaciones: i.especificaciones
 }))
 };

 const url = editingOrder
 ? `/api/compras/pedidos/recurrentes/${editingOrder.id}`
 : '/api/compras/pedidos/recurrentes';

 const response = await fetch(url, {
 method: editingOrder ? 'PUT' : 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload)
 });

 if (response.ok) {
 toast.success(editingOrder ? 'Pedido recurrente actualizado' : 'Pedido recurrente creado');
 loadOrders();
 setView('list');
 resetForm();
 } else {
 const data = await response.json();
 toast.error(data.error || 'Error al guardar');
 }
 } catch {
 toast.error('Error al guardar pedido recurrente');
 } finally {
 setSaving(false);
 }
 };

 const handleToggleActive = async (order: RecurringOrder) => {
 try {
 const response = await fetch(`/api/compras/pedidos/recurrentes/${order.id}`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ isActive: !order.isActive })
 });

 if (response.ok) {
 toast.success(order.isActive ? 'Pedido desactivado' : 'Pedido activado');
 loadOrders();
 }
 } catch {
 toast.error('Error al actualizar estado');
 }
 };

 const handleExecute = async (order: RecurringOrder) => {
 try {
 toast.loading('Generando pedido...', { id: 'execute' });
 const response = await fetch(`/api/compras/pedidos/recurrentes/${order.id}/ejecutar`, {
 method: 'POST'
 });

 if (response.ok) {
 const data = await response.json();
 toast.success(`Pedido ${data.pedido.numero} generado`, { id: 'execute' });
 loadOrders();
 onSuccess?.();
 } else {
 const data = await response.json();
 toast.error(data.error || 'Error al ejecutar', { id: 'execute' });
 }
 } catch {
 toast.error('Error al ejecutar pedido', { id: 'execute' });
 }
 };

 const handleDelete = async (order: RecurringOrder) => {
 const ok = await confirm({
 title: 'Eliminar pedido recurrente',
 description: `¿Eliminar "${order.nombre}"? Esta acción no se puede deshacer.`,
 confirmText: 'Eliminar',
 variant: 'destructive',
 });
 if (!ok) return;

 try {
 const response = await fetch(`/api/compras/pedidos/recurrentes/${order.id}`, {
 method: 'DELETE'
 });

 if (response.ok) {
 toast.success('Pedido recurrente eliminado');
 loadOrders();
 }
 } catch {
 toast.error('Error al eliminar');
 }
 };

 const addItem = () => {
 setItems([...items, { descripcion: '', cantidad: 1, unidad: 'UN' }]);
 };

 const removeItem = (index: number) => {
 if (items.length > 1) {
 setItems(items.filter((_, i) => i !== index));
 }
 };

 const updateItem = (index: number, field: keyof RecurringItem, value: any) => {
 const newItems = [...items];
 newItems[index] = { ...newItems[index], [field]: value };
 setItems(newItems);
 };

 return (
 <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
 <DialogContent size="md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Repeat className="h-5 w-5" />
 {view === 'list' && 'Pedidos Recurrentes'}
 {view === 'create' && 'Nuevo Pedido Recurrente'}
 {view === 'edit' && 'Editar Pedido Recurrente'}
 </DialogTitle>
 <DialogDescription>
 {view === 'list' && 'Gestiona pedidos que se generan automáticamente'}
 {view === 'create' && 'Configura un nuevo pedido que se generará periódicamente'}
 {view === 'edit' && `Editando: ${editingOrder?.nombre}`}
 </DialogDescription>
 </DialogHeader>

 <DialogBody>
 {/* Lista de pedidos recurrentes */}
 {view === 'list' && (
 <div className="space-y-3 py-4">
 {loading ? (
 <div className="flex items-center justify-center py-8">
 <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
 </div>
 ) : orders.length === 0 ? (
 <div className="text-center py-8">
 <Repeat className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
 <p className="text-sm text-muted-foreground mb-4">
 No hay pedidos recurrentes configurados
 </p>
 <Button onClick={handleCreate}>
 <Plus className="h-4 w-4 mr-2" />
 Crear primero
 </Button>
 </div>
 ) : (
 <>
 <Button onClick={handleCreate} className="w-full">
 <Plus className="h-4 w-4 mr-2" />
 Nuevo Pedido Recurrente
 </Button>

 {orders.map((order) => (
 <Card key={order.id} className={cn(!order.isActive && 'opacity-60')}>
 <CardContent className="p-4">
 <div className="flex items-start justify-between gap-3">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <h4 className="font-medium text-sm truncate">{order.nombre}</h4>
 <Badge variant={order.isActive ? 'default' : 'secondary'} className="text-xs">
 {order.isActive ? 'Activo' : 'Inactivo'}
 </Badge>
 <Badge variant="outline" className="text-xs">
 {FRECUENCIAS.find(f => f.value === order.frecuencia)?.label}
 </Badge>
 </div>
 <p className="text-xs text-muted-foreground mb-2">
 Genera: <strong>{order.tituloPedido}</strong>
 </p>
 <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
 <span className="flex items-center gap-1">
 <Calendar className="h-3 w-3" />
 Próxima: {order.proximaEjecucion
 ? format(new Date(order.proximaEjecucion), 'dd/MM/yy HH:mm', { locale: es })
 : 'No programada'}
 </span>
 <span className="flex items-center gap-1">
 <History className="h-3 w-3" />
 {order.totalEjecuciones} ejecuciones
 </span>
 </div>
 </div>
 <div className="flex items-center gap-1">
 {order.isActive && (
 <Button
 size="sm"
 variant="outline"
 className="h-7 text-xs"
 onClick={() => handleExecute(order)}
 >
 <Play className="h-3 w-3 mr-1" />
 Ejecutar
 </Button>
 )}
 <Button
 size="sm"
 variant="ghost"
 className="h-7 w-7 p-0"
 onClick={() => handleToggleActive(order)}
 >
 {order.isActive ? (
 <Pause className="h-4 w-4 text-warning-muted-foreground" />
 ) : (
 <Play className="h-4 w-4 text-success" />
 )}
 </Button>
 <Button
 size="sm"
 variant="ghost"
 className="h-7 w-7 p-0"
 onClick={() => handleEdit(order)}
 >
 <AlertCircle className="h-4 w-4" />
 </Button>
 <Button
 size="sm"
 variant="ghost"
 className="h-7 w-7 p-0 text-destructive"
 onClick={() => handleDelete(order)}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 </div>
 </CardContent>
 </Card>
 ))}
 </>
 )}
 </div>
 )}

 {/* Formulario crear/editar */}
 {(view === 'create' || view === 'edit') && (
 <div className="space-y-4 py-4">
 <div className="grid grid-cols-2 gap-4">
 <div className="col-span-2">
 <Label className="text-xs">Nombre del pedido recurrente</Label>
 <Input
 value={nombre}
 onChange={(e) => setNombre(e.target.value)}
 placeholder="Ej: Insumos de limpieza mensual"
 className="mt-1"
 />
 </div>

 <div>
 <Label className="text-xs">Frecuencia</Label>
 <Select value={frecuencia} onValueChange={setFrecuencia}>
 <SelectTrigger className="mt-1">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {FRECUENCIAS.map(f => (
 <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {frecuencia === 'SEMANAL' && (
 <div>
 <Label className="text-xs">Día de la semana</Label>
 <Select value={String(diaSemana)} onValueChange={(v) => setDiaSemana(parseInt(v))}>
 <SelectTrigger className="mt-1">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {DIAS_SEMANA.map(d => (
 <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}

 {frecuencia === 'MENSUAL' && (
 <div>
 <Label className="text-xs">Día del mes</Label>
 <Input
 type="number"
 min={1}
 max={28}
 value={diaMes}
 onChange={(e) => setDiaMes(parseInt(e.target.value) || 1)}
 className="mt-1"
 />
 </div>
 )}

 <div>
 <Label className="text-xs">Hora de ejecución</Label>
 <Input
 type="number"
 min={0}
 max={23}
 value={horaEjecucion}
 onChange={(e) => setHoraEjecucion(parseInt(e.target.value) || 8)}
 className="mt-1"
 />
 </div>
 </div>

 <div className="border-t pt-4">
 <h4 className="text-sm font-medium mb-3">Configuración del pedido generado</h4>

 <div className="grid grid-cols-2 gap-4">
 <div className="col-span-2">
 <Label className="text-xs">Título del pedido</Label>
 <Input
 value={tituloPedido}
 onChange={(e) => setTituloPedido(e.target.value)}
 placeholder="Ej: Compra de insumos de limpieza"
 className="mt-1"
 />
 </div>

 <div>
 <Label className="text-xs">Prioridad</Label>
 <Select value={prioridad} onValueChange={setPrioridad}>
 <SelectTrigger className="mt-1">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {PRIORIDADES.map(p => (
 <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div>
 <Label className="text-xs">Días para necesidad</Label>
 <Input
 type="number"
 min={1}
 value={diasParaNecesidad}
 onChange={(e) => setDiasParaNecesidad(parseInt(e.target.value) || 7)}
 className="mt-1"
 />
 <p className="text-xs text-muted-foreground mt-1">
 Fecha necesidad = ejecución + N días
 </p>
 </div>

 <div className="col-span-2">
 <Label className="text-xs">Notas (opcional)</Label>
 <Textarea
 value={notas}
 onChange={(e) => setNotas(e.target.value)}
 placeholder="Notas adicionales..."
 rows={2}
 className="mt-1"
 />
 </div>
 </div>
 </div>

 <div className="border-t pt-4">
 <div className="flex items-center justify-between mb-3">
 <h4 className="text-sm font-medium">Items del pedido</h4>
 <Button size="sm" variant="outline" onClick={addItem}>
 <Plus className="h-3 w-3 mr-1" />
 Agregar
 </Button>
 </div>

 <div className="space-y-2">
 {items.map((item, index) => (
 <div key={index} className="flex gap-2 items-start">
 <Input
 value={item.descripcion}
 onChange={(e) => updateItem(index, 'descripcion', e.target.value)}
 placeholder="Descripción del item"
 className="flex-1"
 />
 <Input
 type="number"
 value={item.cantidad}
 onChange={(e) => updateItem(index, 'cantidad', parseFloat(e.target.value) || 1)}
 className="w-20"
 min={0.01}
 step={0.01}
 />
 <Input
 value={item.unidad}
 onChange={(e) => updateItem(index, 'unidad', e.target.value.toUpperCase())}
 placeholder="UN"
 className="w-20"
 />
 {items.length > 1 && (
 <Button
 size="sm"
 variant="ghost"
 className="h-9 w-9 p-0 text-destructive"
 onClick={() => removeItem(index)}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 )}
 </div>
 ))}
 </div>
 </div>
 </div>
 )}
 </DialogBody>

 <DialogFooter>
 {view === 'list' ? (
 <Button variant="outline" onClick={onClose}>
 Cerrar
 </Button>
 ) : (
 <>
 <Button variant="outline" onClick={() => { setView('list'); resetForm(); }}>
 Cancelar
 </Button>
 <Button onClick={handleSave} disabled={saving}>
 {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
 {editingOrder ? 'Guardar Cambios' : 'Crear Pedido Recurrente'}
 </Button>
 </>
 )}
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
