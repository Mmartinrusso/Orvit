'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogBody,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link2, Search, Package, Loader2, CheckCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

interface Recepcion {
 id: number;
 numero: string;
 fechaRecepcion: string;
 estado: string;
 numeroRemito?: string;
 proveedor?: {
 id: number;
 name: string;
 };
 purchaseOrder?: {
 id: number;
 numero: string;
 };
 factura?: {
 id: number;
 numeroSerie: string;
 numeroFactura: string;
 };
 _count?: {
 items: number;
 };
}

interface Factura {
 id: number;
 numeroSerie: string;
 numeroFactura: string;
 proveedorId: number;
 proveedor?: {
 id: number;
 name: string;
 };
}

interface VincularRecepcionModalProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 factura: Factura;
 onSuccess: () => void;
}

export function VincularRecepcionModal({
 open,
 onOpenChange,
 factura,
 onSuccess,
}: VincularRecepcionModalProps) {
 const [searchTerm, setSearchTerm] = useState('');
 const [recepciones, setRecepciones] = useState<Recepcion[]>([]);
 const [selectedIds, setSelectedIds] = useState<number[]>([]);
 const [isLoading, setIsLoading] = useState(false);
 const [isLinking, setIsLinking] = useState(false);

 // Buscar recepciones del mismo proveedor sin factura vinculada
 useEffect(() => {
 const fetchRecepciones = async () => {
 if (!open) return;

 setIsLoading(true);
 try {
 // Buscar recepciones del mismo proveedor
 const params = new URLSearchParams({
 proveedorId: factura.proveedorId.toString(),
 limit: '50',
 });
 if (searchTerm) {
 params.append('search', searchTerm);
 }

 const response = await fetch(`/api/compras/recepciones?${params}`);
 if (response.ok) {
 const data = await response.json();
 // Filtrar las que no tienen factura o tienen la misma factura
 const disponibles = (data.data || []).filter(
 (r: Recepcion) => !r.factura || r.factura.id === factura.id
 );
 setRecepciones(disponibles);
 }
 } catch (error) {
 console.error('Error fetching recepciones:', error);
 } finally {
 setIsLoading(false);
 }
 };

 const debounce = setTimeout(fetchRecepciones, 300);
 return () => clearTimeout(debounce);
 }, [open, factura.proveedorId, searchTerm, factura.id]);

 // Toggle seleccion
 const toggleSelection = (id: number) => {
 setSelectedIds((prev) =>
 prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
 );
 };

 // Vincular recepciones seleccionadas
 const handleVincular = async () => {
 if (selectedIds.length === 0) {
 toast.error('Seleccione al menos una recepcion para vincular');
 return;
 }

 setIsLinking(true);

 try {
 // Vincular cada recepcion seleccionada
 const results = await Promise.all(
 selectedIds.map(async (recepcionId) => {
 const response = await fetch(`/api/compras/recepciones/${recepcionId}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 facturaId: factura.id,
 tieneFactura: true,
 }),
 });

 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.error || `Error vinculando recepcion ${recepcionId}`);
 }

 return recepcionId;
 })
 );

 toast.success(`${results.length} recepcion(es) vinculada(s) a la factura`);
 onSuccess();
 onOpenChange(false);
 setSelectedIds([]);
 } catch (error: any) {
 toast.error(error.message);
 } finally {
 setIsLinking(false);
 }
 };

 // Ya vinculadas a esta factura
 const yaVinculadas = recepciones.filter((r) => r.factura?.id === factura.id);
 // Disponibles para vincular
 const disponibles = recepciones.filter((r) => !r.factura);

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent size="md">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Link2 className="w-5 h-5 text-info-muted-foreground" />
 Vincular Recepcion Existente
 </DialogTitle>
 <DialogDescription>
 Vincule recepciones existentes a la factura{'}
 <span className="font-medium">
 {factura.numeroSerie}-{factura.numeroFactura}
 </span>
 </DialogDescription>
 </DialogHeader>

 <DialogBody className="space-y-4">
 {/* Busqueda */}
 <div className="relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input
 placeholder="Buscar por numero de recepcion o remito..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="pl-10"
 />
 </div>

 {/* Recepciones ya vinculadas */}
 {yaVinculadas.length > 0 && (
 <div className="space-y-2">
 <Label className="text-sm text-muted-foreground">
 Ya vinculadas a esta factura
 </Label>
 <div className="space-y-1">
 {yaVinculadas.map((rec) => (
 <div
 key={rec.id}
 className="flex items-center gap-2 p-2 bg-success-muted border border-success-muted rounded"
 >
 <CheckCircle className="w-4 h-4 text-success" />
 <span className="font-medium text-sm">{rec.numero}</span>
 <Badge variant="outline" className="text-xs">
 {rec.estado}
 </Badge>
 {rec.numeroRemito && (
 <span className="text-xs text-muted-foreground">
 Remito: {rec.numeroRemito}
 </span>
 )}
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Recepciones disponibles para vincular */}
 <div className="space-y-2">
 <Label className="text-sm">
 Recepciones disponibles ({disponibles.length})
 </Label>

 {isLoading ? (
 <div className="flex items-center justify-center py-8">
 <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
 </div>
 ) : disponibles.length === 0 ? (
 <Alert>
 <Info className="h-4 w-4" />
 <AlertDescription>
 No hay recepciones disponibles para vincular de este proveedor.
 <br />
 Use "Cargar Remito" para crear una nueva recepcion.
 </AlertDescription>
 </Alert>
 ) : (
 <ScrollArea className="h-[300px] border rounded-lg">
 <div className="p-2 space-y-1">
 {disponibles.map((rec) => {
 const isSelected = selectedIds.includes(rec.id);
 return (
 <div
 key={rec.id}
 className={cn('flex items-center gap-3 p-3 rounded cursor-pointer transition-colors',
 isSelected
 ? 'bg-info-muted border border-info-muted'
 : 'hover:bg-muted/50 border border-transparent'
 )}
 onClick={() => toggleSelection(rec.id)}
 >
 <Checkbox
 checked={isSelected}
 onCheckedChange={() => toggleSelection(rec.id)}
 />
 <Package className="w-4 h-4 text-muted-foreground" />
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="font-medium text-sm">{rec.numero}</span>
 <Badge
 variant={rec.estado === 'CONFIRMADA' ? 'default' : 'secondary'}
 className="text-xs"
 >
 {rec.estado}
 </Badge>
 </div>
 <div className="text-xs text-muted-foreground flex items-center gap-2">
 <span>
 {new Date(rec.fechaRecepcion).toLocaleDateString('es-AR')}
 </span>
 {rec.numeroRemito && <span>| Remito: {rec.numeroRemito}</span>}
 {rec._count?.items && <span>| {rec._count.items} items</span>}
 </div>
 {rec.purchaseOrder && (
 <div className="text-xs text-info-muted-foreground">
 OC: {rec.purchaseOrder.numero}
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </ScrollArea>
 )}
 </div>

 {/* Seleccionadas */}
 {selectedIds.length > 0 && (
 <div className="flex items-center justify-between p-2 bg-info-muted rounded">
 <span className="text-sm text-info-muted-foreground">
 {selectedIds.length} recepcion(es) seleccionada(s)
 </span>
 <Button
 variant="ghost"
 size="sm"
 onClick={() => setSelectedIds([])}
 className="text-info-muted-foreground"
 >
 Limpiar seleccion
 </Button>
 </div>
 )}
 </DialogBody>

 <DialogFooter>
 <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLinking}>
 Cancelar
 </Button>
 <Button onClick={handleVincular} disabled={isLinking || selectedIds.length === 0}>
 {isLinking ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Vinculando...
 </>
 ) : (
 `Vincular ${selectedIds.length > 0 ? `(${selectedIds.length})` : ''}`
 )}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
