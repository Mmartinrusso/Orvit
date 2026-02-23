'use client';

import { useState, useRef, useEffect } from 'react';
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogBody,
 DialogHeader,
 DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
 Mic,
 MicOff,
 Upload,
 Loader2,
 CheckCircle2,
 XCircle,
 FileAudio,
 Trash2,
 Send,
 AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatNumber } from '@/lib/utils';

interface VoicePurchaseModalProps {
 open: boolean;
 onClose: () => void;
 onSuccess?: (pedido: any) => void;
}

type ModalState = 'idle' | 'recording' | 'recorded' | 'uploading' | 'processing' | 'success' | 'error';

export function VoicePurchaseModal({ open, onClose, onSuccess }: VoicePurchaseModalProps) {
 const [state, setState] = useState<ModalState>('idle');
 const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
 const [audioUrl, setAudioUrl] = useState<string | null>(null);
 const [recordingTime, setRecordingTime] = useState(0);
 const [error, setError] = useState<string | null>(null);
 const [result, setResult] = useState<any>(null);

 const mediaRecorderRef = useRef<MediaRecorder | null>(null);
 const audioChunksRef = useRef<Blob[]>([]);
 const timerRef = useRef<NodeJS.Timeout | null>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);

 // Limpiar al cerrar
 useEffect(() => {
 if (!open) {
 resetState();
 }
 }, [open]);

 // Cleanup audio URL
 useEffect(() => {
 return () => {
 if (audioUrl) {
 URL.revokeObjectURL(audioUrl);
 }
 };
 }, [audioUrl]);

 const resetState = () => {
 setState('idle');
 setAudioBlob(null);
 if (audioUrl) {
 URL.revokeObjectURL(audioUrl);
 }
 setAudioUrl(null);
 setRecordingTime(0);
 setError(null);
 setResult(null);
 if (timerRef.current) {
 clearInterval(timerRef.current);
 }
 };

 const startRecording = async () => {
 try {
 const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
 const mediaRecorder = new MediaRecorder(stream, {
 mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
 });

 audioChunksRef.current = [];

 mediaRecorder.ondataavailable = (event) => {
 if (event.data.size > 0) {
 audioChunksRef.current.push(event.data);
 }
 };

 mediaRecorder.onstop = () => {
 const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
 setAudioBlob(blob);
 setAudioUrl(URL.createObjectURL(blob));
 setState('recorded');

 // Detener el stream
 stream.getTracks().forEach((track) => track.stop());
 };

 mediaRecorderRef.current = mediaRecorder;
 mediaRecorder.start(1000); // Chunks cada segundo
 setState('recording');

 // Timer
 setRecordingTime(0);
 timerRef.current = setInterval(() => {
 setRecordingTime((prev) => {
 if (prev >= 120) {
 // Máximo 2 minutos
 stopRecording();
 return prev;
 }
 return prev + 1;
 });
 }, 1000);
 } catch (err: any) {
 console.error('Error accediendo al micrófono:', err);
 setError('No se pudo acceder al micrófono. Verifica los permisos.');
 toast.error('No se pudo acceder al micrófono');
 }
 };

 const stopRecording = () => {
 if (mediaRecorderRef.current && state === 'recording') {
 mediaRecorderRef.current.stop();
 if (timerRef.current) {
 clearInterval(timerRef.current);
 }
 }
 };

 const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
 const file = event.target.files?.[0];
 if (!file) return;

 // Validar tipo
 if (!file.type.startsWith('audio/')) {
 toast.error('Solo se permiten archivos de audio');
 return;
 }

 // Validar tamaño (10MB)
 if (file.size > 10 * 1024 * 1024) {
 toast.error('El archivo es muy grande. Máximo 10MB');
 return;
 }

 setAudioBlob(file);
 setAudioUrl(URL.createObjectURL(file));
 setState('recorded');
 };

 const handleSubmit = async () => {
 if (!audioBlob) return;

 setState('processing');
 setError(null);

 try {
 const formData = new FormData();
 formData.append('audio', audioBlob, 'audio.webm');

 const response = await fetch('/api/compras/pedidos/voice', {
 method: 'POST',
 body: formData,
 });

 const data = await response.json();

 if (data.success) {
 setState('success');
 setResult(data);
 toast.success(`Pedido ${data.pedido.numero} creado exitosamente`);
 onSuccess?.(data.pedido);
 } else {
 setState('error');
 setError(data.error || 'Error procesando el audio');
 toast.error(data.error || 'Error procesando el audio');
 }
 } catch (err: any) {
 console.error('Error enviando audio:', err);
 setState('error');
 setError(err.message || 'Error de conexión');
 toast.error('Error enviando el audio');
 }
 };

 const formatTime = (seconds: number) => {
 const mins = Math.floor(seconds / 60);
 const secs = seconds % 60;
 return `${mins}:${secs.toString().padStart(2, '0')}`;
 };

 const handleClose = () => {
 if (state === 'recording') {
 stopRecording();
 }
 onClose();
 };

 return (
 <Dialog open={open} onOpenChange={handleClose}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Mic className="h-5 w-5" />
 Crear Pedido por Voz
 </DialogTitle>
 <DialogDescription>
 Graba o sube un audio describiendo lo que necesitas comprar
 </DialogDescription>
 </DialogHeader>

 <DialogBody className="space-y-4">
 {/* Estado: Idle - Opciones iniciales */}
 {state === 'idle' && (
 <div className="flex flex-col gap-4">
 {/* Guía de qué decir */}
 <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
 <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
 <AlertCircle className="h-3.5 w-3.5" />
 ¿Qué decir en el audio?
 </p>
 <ul className="text-xs text-muted-foreground space-y-1 ml-5 list-disc">
 <li><strong>Items:</strong> Menciona qué necesitas y la cantidad (ej: &ldquo;50 kilos de tornillos M8&rdquo;)</li>
 <li><strong>Urgencia:</strong> Si es urgente, dilo (ej: &ldquo;es urgente&rdquo;, &ldquo;lo necesito ya&rdquo;)</li>
 <li><strong>Fecha:</strong> Si tiene fecha límite (ej: &ldquo;para el lunes&rdquo;, &ldquo;esta semana&rdquo;)</li>
 </ul>
 <p className="text-xs text-muted-foreground/70 mt-2 italic">
 Ejemplo: &ldquo;Necesito 20 litros de aceite hidráulico y 50 kilos de tornillos M8 para la CNC, es urgente para mañana&rdquo;
 </p>
 </div>

 <Button
 size="lg"
 className="h-24 flex-col gap-2"
 onClick={startRecording}
 >
 <Mic className="h-8 w-8" />
 <span>Grabar Audio</span>
 </Button>

 <div className="relative">
 <div className="absolute inset-0 flex items-center">
 <span className="w-full border-t" />
 </div>
 <div className="relative flex justify-center text-xs uppercase">
 <span className="bg-background px-2 text-muted-foreground">o</span>
 </div>
 </div>

 <Button
 variant="outline"
 size="lg"
 className="h-16"
 onClick={() => fileInputRef.current?.click()}
 >
 <Upload className="h-5 w-5 mr-2" />
 Subir Archivo de Audio
 </Button>
 <input
 ref={fileInputRef}
 type="file"
 accept="audio/*"
 className="hidden"
 onChange={handleFileUpload}
 />

 <p className="text-xs text-muted-foreground text-center">
 Formatos soportados: MP3, WAV, OGG, WebM, M4A (máx 10MB)
 </p>
 </div>
 )}

 {/* Estado: Grabando */}
 {state === 'recording' && (
 <div className="flex flex-col items-center gap-4 py-4">
 <div className="relative">
 <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center animate-pulse">
 <Mic className="h-10 w-10 text-destructive" />
 </div>
 <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
 <Badge variant="destructive" className="animate-pulse">
 REC
 </Badge>
 </div>
 </div>

 <div className="text-3xl font-mono font-bold">{formatTime(recordingTime)}</div>

 <Button size="lg" variant="destructive" onClick={stopRecording}>
 <MicOff className="h-5 w-5 mr-2" />
 Detener Grabación
 </Button>

 {/* Tips mientras grabas */}
 <div className="w-full p-3 bg-muted/30 rounded-lg border border-border/50 mt-2">
 <p className="text-xs font-medium text-center text-muted-foreground mb-2">
 Menciona en tu audio:
 </p>
 <div className="flex flex-wrap justify-center gap-2 text-xs">
 <span className="px-2 py-1 bg-background rounded-full border">📦 Qué necesitas</span>
 <span className="px-2 py-1 bg-background rounded-full border">🔢 Cantidad</span>
 <span className="px-2 py-1 bg-background rounded-full border">⚡ Si es urgente</span>
 <span className="px-2 py-1 bg-background rounded-full border">📅 Fecha límite</span>
 </div>
 </div>
 </div>
 )}

 {/* Estado: Audio grabado/subido */}
 {state === 'recorded' && audioUrl && (
 <div className="space-y-4">
 <Card>
 <CardContent className="p-4">
 <div className="flex items-center gap-3">
 <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
 <FileAudio className="h-6 w-6 text-primary" />
 </div>
 <div className="flex-1">
 <p className="font-medium">Audio listo</p>
 <p className="text-sm text-muted-foreground">
 {audioBlob && `${formatNumber(audioBlob.size / 1024, 1)} KB`}
 </p>
 </div>
 <Button
 variant="ghost"
 size="icon"
 onClick={resetState}
 className="text-destructive hover:text-destructive"
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>

 <audio controls className="w-full mt-3" src={audioUrl}>
 Tu navegador no soporta audio
 </audio>
 </CardContent>
 </Card>

 <div className="flex gap-2">
 <Button variant="outline" className="flex-1" onClick={resetState}>
 Grabar otro
 </Button>
 <Button className="flex-1" onClick={handleSubmit}>
 <Send className="h-4 w-4 mr-2" />
 Crear Pedido
 </Button>
 </div>
 </div>
 )}

 {/* Estado: Procesando */}
 {state === 'processing' && (
 <div className="flex flex-col items-center gap-4 py-8">
 <Loader2 className="h-12 w-12 animate-spin text-primary" />
 <div className="text-center">
 <p className="font-medium">Procesando audio...</p>
 <p className="text-sm text-muted-foreground mt-1">
 Transcribiendo y extrayendo información
 </p>
 </div>
 </div>
 )}

 {/* Estado: Éxito */}
 {state === 'success' && result && (
 <div className="space-y-4">
 <div className="flex flex-col items-center gap-2 py-4">
 <div className="h-16 w-16 rounded-full bg-success-muted flex items-center justify-center">
 <CheckCircle2 className="h-8 w-8 text-success" />
 </div>
 <p className="font-medium text-lg">¡Pedido Creado!</p>
 <Badge variant="outline" className="text-lg px-3 py-1">
 {result.pedido.numero}
 </Badge>
 </div>

 <Card>
 <CardContent className="p-4 space-y-3">
 <div>
 <p className="text-xs text-muted-foreground">Título</p>
 <p className="font-medium">{result.pedido.titulo}</p>
 </div>

 <div className="flex gap-4">
 <div>
 <p className="text-xs text-muted-foreground">Prioridad</p>
 <Badge
 className={cn(
 result.pedido.prioridad === 'URGENTE' && 'bg-destructive/10 text-destructive',
 result.pedido.prioridad === 'ALTA' && 'bg-warning-muted text-warning-muted-foreground',
 result.pedido.prioridad === 'NORMAL' && 'bg-info-muted text-info-muted-foreground',
 result.pedido.prioridad === 'BAJA' && 'bg-muted text-foreground'
 )}
 >
 {result.pedido.prioridad}
 </Badge>
 </div>
 {result.extractedData?.confianza && (
 <div>
 <p className="text-xs text-muted-foreground">Confianza IA</p>
 <Badge variant="outline">{result.extractedData.confianza}%</Badge>
 </div>
 )}
 </div>

 <div>
 <p className="text-xs text-muted-foreground mb-1">
 Items ({result.pedido.items.length})
 </p>
 <ul className="space-y-1">
 {result.pedido.items.map((item: any, i: number) => (
 <li key={i} className="text-sm flex justify-between">
 <span>{item.descripcion}</span>
 <span className="text-muted-foreground">
 {item.cantidad} {item.unidad}
 </span>
 </li>
 ))}
 </ul>
 </div>

 {result.transcript && (
 <div>
 <p className="text-xs text-muted-foreground">Transcripción</p>
 <p className="text-sm italic text-muted-foreground">
 &ldquo;{result.transcript}&rdquo;
 </p>
 </div>
 )}
 </CardContent>
 </Card>

 <Button className="w-full" onClick={handleClose}>
 Cerrar
 </Button>
 </div>
 )}

 {/* Estado: Error */}
 {state === 'error' && (
 <div className="space-y-4">
 <div className="flex flex-col items-center gap-2 py-4">
 <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
 <XCircle className="h-8 w-8 text-destructive" />
 </div>
 <p className="font-medium text-lg">Error</p>
 <p className="text-sm text-muted-foreground text-center">{error}</p>
 </div>

 <div className="flex gap-2">
 <Button variant="outline" className="flex-1" onClick={resetState}>
 Intentar de nuevo
 </Button>
 <Button variant="outline" className="flex-1" onClick={handleClose}>
 Cerrar
 </Button>
 </div>
 </div>
 )}
 </DialogBody>
 </DialogContent>
 </Dialog>
 );
}
