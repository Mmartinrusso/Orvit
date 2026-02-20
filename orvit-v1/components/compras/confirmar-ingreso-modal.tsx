'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogBody,
 DialogFooter,
 DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import {
 Loader2,
 FileText,
 Camera,
 Check,
 X,
 Truck,
 Trash2,
 Warehouse,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Deposito {
 id: number;
 codigo: string;
 nombre: string;
 isDefault: boolean;
}

interface ConfirmarIngresoModalProps {
 open: boolean;
 onClose: () => void;
 comprobanteId: number;
 comprobanteNumero: string;
 proveedorNombre: string;
 onSuccess?: () => void;
}

export function ConfirmarIngresoModal({
 open,
 onClose,
 comprobanteId,
 comprobanteNumero,
 proveedorNombre,
 onSuccess
}: ConfirmarIngresoModalProps) {
 const [submitting, setSubmitting] = useState(false);
 const [firma, setFirma] = useState<string | null>(null);
 const [remitoFile, setRemitoFile] = useState<File | null>(null);
 const [fotoFile, setFotoFile] = useState<File | null>(null);
 const [uploadingRemito, setUploadingRemito] = useState(false);
 const [uploadingFoto, setUploadingFoto] = useState(false);
 const [remitoUrl, setRemitoUrl] = useState<string | null>(null);
 const [fotoUrl, setFotoUrl] = useState<string | null>(null);
 const [isDrawing, setIsDrawing] = useState(false);
 const [depositos, setDepositos] = useState<Deposito[]>([]);
 const [depositoId, setDepositoId] = useState<string>('');
 const [loadingDepositos, setLoadingDepositos] = useState(false);

 const canvasRef = useRef<HTMLCanvasElement>(null);
 const isDrawingRef = useRef(false);
 const lastPosRef = useRef({ x: 0, y: 0 });

 // Cargar depósitos al abrir el modal
 useEffect(() => {
 if (open) {
 fetchDepositos();
 }
 }, [open]);

 const fetchDepositos = async () => {
 setLoadingDepositos(true);
 try {
 const response = await fetch('/api/compras/depositos');
 if (response.ok) {
 const responseData = await response.json();
 // El API puede devolver { data: [...] } o un array directo
 const depositosList = Array.isArray(responseData) ? responseData : (responseData.data || []);
 setDepositos(depositosList);
 // Seleccionar el depósito por defecto
 const defaultDeposito = depositosList.find((d: Deposito) => d.isDefault);
 if (defaultDeposito) {
 setDepositoId(defaultDeposito.id.toString());
 } else if (depositosList.length > 0) {
 setDepositoId(depositosList[0].id.toString());
 }
 }
 } catch (error) {
 console.error('Error fetching depositos:', error);
 } finally {
 setLoadingDepositos(false);
 }
 };

 // Inicializar canvas
 const initCanvas = useCallback(() => {
 const canvas = canvasRef.current;
 if (!canvas) return;

 const ctx = canvas.getContext('2d');
 if (!ctx) return;

 ctx.fillStyle = '#ffffff';
 ctx.fillRect(0, 0, canvas.width, canvas.height);
 ctx.strokeStyle = '#000000';
 ctx.lineWidth = 2;
 ctx.lineCap = 'round';
 ctx.lineJoin = 'round';
 }, []);

 // Inicializar canvas cuando el modal se abre
 useEffect(() => {
 if (open && canvasRef.current) {
 setTimeout(initCanvas, 100);
 }
 }, [open, initCanvas]);

 const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
 isDrawingRef.current = true;
 setIsDrawing(true);

 const canvas = canvasRef.current;
 if (!canvas) return;

 const rect = canvas.getBoundingClientRect();
 const scaleX = canvas.width / rect.width;
 const scaleY = canvas.height / rect.height;

 if ('touches' in e) {
 lastPosRef.current = {
 x: (e.touches[0].clientX - rect.left) * scaleX,
 y: (e.touches[0].clientY - rect.top) * scaleY,
 };
 } else {
 lastPosRef.current = {
 x: (e.clientX - rect.left) * scaleX,
 y: (e.clientY - rect.top) * scaleY,
 };
 }
 }, []);

 const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
 if (!isDrawingRef.current) return;

 const canvas = canvasRef.current;
 const ctx = canvas?.getContext('2d');
 if (!canvas || !ctx) return;

 const rect = canvas.getBoundingClientRect();
 const scaleX = canvas.width / rect.width;
 const scaleY = canvas.height / rect.height;

 let currentX: number, currentY: number;

 if ('touches' in e) {
 e.preventDefault();
 currentX = (e.touches[0].clientX - rect.left) * scaleX;
 currentY = (e.touches[0].clientY - rect.top) * scaleY;
 } else {
 currentX = (e.clientX - rect.left) * scaleX;
 currentY = (e.clientY - rect.top) * scaleY;
 }

 ctx.beginPath();
 ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
 ctx.lineTo(currentX, currentY);
 ctx.stroke();

 lastPosRef.current = { x: currentX, y: currentY };
 }, []);

 const stopDrawing = useCallback(() => {
 isDrawingRef.current = false;
 setIsDrawing(false);
 }, []);

 const clearSignature = () => {
 initCanvas();
 setFirma(null);
 };

 const saveSignature = () => {
 const canvas = canvasRef.current;
 if (!canvas) return;

 const dataUrl = canvas.toDataURL('image/png');
 setFirma(dataUrl);
 toast.success('Firma guardada');
 };

 const handleRemitoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 setRemitoFile(file);
 setUploadingRemito(true);

 try {
 const formData = new FormData();
 formData.append('file', file);
 formData.append('entityType', 'comprobante');
 formData.append('entityId', comprobanteId.toString());
 formData.append('fileType', 'remito');

 const response = await fetch('/api/upload', {
 method: 'POST',
 body: formData
 });

 if (response.ok) {
 const data = await response.json();
 setRemitoUrl(data.url);
 toast.success('Remito subido');
 } else {
 toast.error('Error al subir el remito');
 setRemitoFile(null);
 }
 } catch (error) {
 toast.error('Error al subir el remito');
 setRemitoFile(null);
 } finally {
 setUploadingRemito(false);
 }
 };

 const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 setFotoFile(file);
 setUploadingFoto(true);

 try {
 const formData = new FormData();
 formData.append('file', file);
 formData.append('entityType', 'comprobante');
 formData.append('entityId', comprobanteId.toString());
 formData.append('fileType', 'foto_ingreso');

 const response = await fetch('/api/upload', {
 method: 'POST',
 body: formData
 });

 if (response.ok) {
 const data = await response.json();
 setFotoUrl(data.url);
 toast.success('Foto subida');
 } else {
 toast.error('Error al subir la foto');
 setFotoFile(null);
 }
 } catch (error) {
 toast.error('Error al subir la foto');
 setFotoFile(null);
 } finally {
 setUploadingFoto(false);
 }
 };

 const handleSubmit = async () => {
 if (!firma) {
 toast.error('Debe firmar para confirmar el remito');
 return;
 }

 // Si no hay remito, la foto es obligatoria
 if (!remitoUrl && !fotoUrl) {
 toast.error('Debe adjuntar el remito o una foto del material');
 return;
 }

 setSubmitting(true);
 try {
 // Subir la firma como imagen
 let firmaUrl = null;
 if (firma) {
 // Convertir base64 a blob
 const response = await fetch(firma);
 const blob = await response.blob();
 const firmaFile = new File([blob], 'firma.png', { type: 'image/png' });

 const formData = new FormData();
 formData.append('file', firmaFile);
 formData.append('entityType', 'comprobante');
 formData.append('entityId', comprobanteId.toString());
 formData.append('fileType', 'firma_ingreso');

 const uploadResponse = await fetch('/api/upload', {
 method: 'POST',
 body: formData
 });

 if (uploadResponse.ok) {
 const data = await uploadResponse.json();
 firmaUrl = data.url;
 } else {
 toast.error('Error al subir la firma');
 setSubmitting(false);
 return;
 }
 }

 const apiResponse = await fetch(`/api/compras/comprobantes/${comprobanteId}/confirmar-ingreso`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 firmaIngreso: firmaUrl,
 remitoUrl,
 fotoIngresoUrl: fotoUrl,
 depositoId: depositoId ? parseInt(depositoId) : null,
 }),
 });

 if (apiResponse.ok) {
 toast.success('Remito cargado correctamente');
 onSuccess?.();
 onClose();
 } else {
 const data = await apiResponse.json();
 toast.error(data.error || 'Error al confirmar ingreso');
 }
 } catch (error) {
 toast.error('Error al confirmar ingreso');
 } finally {
 setSubmitting(false);
 }
 };

 const handleClose = () => {
 if (!submitting) {
 setFirma(null);
 setRemitoFile(null);
 setFotoFile(null);
 setRemitoUrl(null);
 setFotoUrl(null);
 setDepositoId('');
 onClose();
 }
 };

 // Determinar si foto es requerida (solo si no hay remito)
 const fotoRequerida = !remitoUrl;

 return (
 <Dialog open={open} onOpenChange={handleClose}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Truck className="h-5 w-5" />
 Cargar Remito
 </DialogTitle>
 <DialogDescription>
 {comprobanteNumero} - {proveedorNombre}
 </DialogDescription>
 </DialogHeader>

 <DialogBody className="space-y-5">
 {/* Depósito */}
 <div className="space-y-2">
 <Label className="text-sm font-medium flex items-center gap-2">
 <Warehouse className="h-4 w-4" />
 Depósito de ingreso
 </Label>
 <Select
 value={depositoId}
 onValueChange={setDepositoId}
 disabled={loadingDepositos}
 >
 <SelectTrigger className="h-10">
 <SelectValue placeholder={loadingDepositos ? 'Cargando...' : 'Seleccione depósito'} />
 </SelectTrigger>
 <SelectContent>
 {depositos.map((dep) => (
 <SelectItem key={dep.id} value={dep.id.toString()}>
 {dep.codigo} - {dep.nombre} {dep.isDefault && '(Principal)'}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {/* Remito */}
 <div className="space-y-2">
 <Label className="text-sm font-medium">Remito (PDF o imagen)</Label>
 <div
 className={cn(
 "border-2 border-dashed rounded-lg p-4 text-center transition-colors",
 remitoUrl ? "border-success bg-success-muted" : "border-muted-foreground/25 hover:border-primary/50"
 )}
 >
 {uploadingRemito ? (
 <div className="flex items-center justify-center gap-2 text-muted-foreground">
 <Loader2 className="h-5 w-5 animate-spin" />
 <span>Subiendo...</span>
 </div>
 ) : remitoUrl ? (
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2 text-success">
 <Check className="h-5 w-5" />
 <span className="text-sm truncate max-w-[200px]">{remitoFile?.name}</span>
 </div>
 <Button
 variant="ghost"
 size="sm"
 className="h-7 w-7 p-0"
 onClick={() => { setRemitoUrl(null); setRemitoFile(null); }}
 >
 <X className="h-4 w-4" />
 </Button>
 </div>
 ) : (
 <label className="cursor-pointer flex flex-col items-center gap-2">
 <FileText className="h-8 w-8 text-muted-foreground" />
 <span className="text-sm text-muted-foreground">
 Click para subir remito
 </span>
 <input
 type="file"
 accept=".pdf,.jpg,.jpeg,.png"
 className="hidden"
 onChange={handleRemitoChange}
 />
 </label>
 )}
 </div>
 </div>

 {/* Foto del material */}
 <div className="space-y-2">
 <Label className="text-sm font-medium">
 Foto del material {remitoUrl ? '(opcional)' : '(requerida si no hay remito)'}
 </Label>
 <div
 className={cn(
 "border-2 border-dashed rounded-lg p-4 text-center transition-colors",
 fotoUrl
 ? "border-success bg-success-muted"
 : fotoRequerida
 ? "border-warning-muted hover:border-warning"
 : "border-muted-foreground/25 hover:border-primary/50"
 )}
 >
 {uploadingFoto ? (
 <div className="flex items-center justify-center gap-2 text-muted-foreground">
 <Loader2 className="h-5 w-5 animate-spin" />
 <span>Subiendo...</span>
 </div>
 ) : fotoUrl ? (
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2 text-success">
 <Check className="h-5 w-5" />
 <span className="text-sm truncate max-w-[200px]">{fotoFile?.name}</span>
 </div>
 <Button
 variant="ghost"
 size="sm"
 className="h-7 w-7 p-0"
 onClick={() => { setFotoUrl(null); setFotoFile(null); }}
 >
 <X className="h-4 w-4" />
 </Button>
 </div>
 ) : (
 <label className="cursor-pointer flex flex-col items-center gap-2">
 <Camera className="h-8 w-8 text-muted-foreground" />
 <span className="text-sm text-muted-foreground">
 Click para subir foto
 </span>
 <input
 type="file"
 accept=".jpg,.jpeg,.png"
 className="hidden"
 onChange={handleFotoChange}
 />
 </label>
 )}
 </div>
 </div>

 {/* Firma Digital */}
 <div className="space-y-2">
 <Label className="text-sm font-medium">Firma de confirmación</Label>
 {firma ? (
 <div className="space-y-2">
 <div className="border rounded-lg p-2 bg-background ">
 <img src={firma} alt="Firma" className="max-h-24 mx-auto" />
 </div>
 <Button
 variant="outline"
 size="sm"
 className="w-full text-xs"
 onClick={clearSignature}
 >
 <Trash2 className="w-3 h-3 mr-1" />
 Borrar firma
 </Button>
 </div>
 ) : (
 <div className="space-y-2">
 <canvas
 ref={canvasRef}
 width={400}
 height={120}
 className="border rounded-lg bg-background w-full touch-none cursor-crosshair"
 style={{ height: '120px' }}
 onMouseDown={startDrawing}
 onMouseMove={draw}
 onMouseUp={stopDrawing}
 onMouseLeave={stopDrawing}
 onTouchStart={startDrawing}
 onTouchMove={draw}
 onTouchEnd={stopDrawing}
 />
 <div className="flex gap-2">
 <Button
 variant="outline"
 size="sm"
 className="flex-1 text-xs"
 onClick={clearSignature}
 >
 Limpiar
 </Button>
 <Button
 variant="default"
 size="sm"
 className="flex-1 text-xs"
 onClick={saveSignature}
 >
 Guardar firma
 </Button>
 </div>
 <p className="text-xs text-muted-foreground text-center">
 Dibuje su firma en el recuadro y presione "Guardar firma"
 </p>
 </div>
 )}
 </div>
 </DialogBody>

 <DialogFooter>
 <Button
 variant="outline"
 onClick={handleClose}
 disabled={submitting}
 className="h-9"
 >
 Cancelar
 </Button>
 <Button
 onClick={handleSubmit}
 disabled={submitting || uploadingRemito || uploadingFoto || !firma || (!remitoUrl && !fotoUrl)}
 className="h-9"
 >
 {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
 <Check className="h-4 w-4 mr-1" />
 Cargar Remito
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}

export default ConfirmarIngresoModal;
