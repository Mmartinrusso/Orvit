'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Upload, X, File, Image, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ConfirmarRecepcionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recepcion: {
    id: number;
    numero: string;
  };
  onConfirmed: () => void;
}

interface FileAttachment {
  name: string;
  url: string;
  type: string;
}

export function ConfirmarRecepcionModal({
  open,
  onOpenChange,
  recepcion,
  onConfirmed,
}: ConfirmarRecepcionModalProps) {
  const [adjuntos, setAdjuntos] = useState<FileAttachment[]>([]);
  const [firma, setFirma] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // File upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newAttachments: FileAttachment[] = [];

    for (const file of Array.from(files)) {
      // Validar tamaño (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} excede 10MB`);
        continue;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('entityType', 'goods_receipt');
        formData.append('entityId', recepcion.id.toString());
        formData.append('fileType', 'evidence');

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Error al subir archivo');
        }

        const data = await response.json();
        newAttachments.push({
          name: file.name,
          url: data.url,
          type: file.type,
        });
      } catch (error) {
        toast.error(`Error subiendo ${file.name}`);
      }
    }

    setAdjuntos(prev => [...prev, ...newAttachments]);
    setIsUploading(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setAdjuntos(prev => prev.filter((_, i) => i !== index));
  };

  // Signature canvas
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

  // Confirm reception
  const handleConfirmar = async () => {
    setIsConfirming(true);

    try {
      const response = await fetch(`/api/compras/recepciones/${recepcion.id}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjuntos: adjuntos.map(a => a.url),
          firma: firma,
          observacionesRecepcion: observaciones || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al confirmar');
      }

      toast.success('Recepcion confirmada y stock actualizado');
      onConfirmed();
      onOpenChange(false);

      // Reset state
      setAdjuntos([]);
      setFirma(null);
      setObservaciones('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Confirmar Recepcion
          </DialogTitle>
          <DialogDescription>
            Confirma la recepcion <span className="font-medium">{recepcion.numero}</span>.
            Puedes adjuntar evidencia (fotos del remito, mercaderia) y firmar digitalmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Adjuntos */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Evidencia (fotos/archivos)</Label>
            <div
              className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">
                {isUploading ? 'Subiendo...' : 'Clic o arrastra archivos (fotos, PDFs)'}
              </p>
            </div>

            {adjuntos.length > 0 && (
              <div className="space-y-1 mt-2">
                {adjuntos.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs">
                    {file.type.startsWith('image/') ? (
                      <Image className="w-4 h-4 text-blue-500" />
                    ) : (
                      <File className="w-4 h-4 text-orange-500" />
                    )}
                    <span className="flex-1 truncate">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeFile(idx)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Firma digital */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Firma digital</Label>
            {firma ? (
              <div className="space-y-2">
                <div className="border rounded-lg p-2 bg-white">
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
                  className="border rounded-lg bg-white w-full touch-none cursor-crosshair"
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
              </div>
            )}
          </div>

          {/* Observaciones */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Observaciones (opcional)</Label>
            <Textarea
              placeholder="Notas sobre el estado de la mercaderia, diferencias, etc."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="text-sm min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isConfirming}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={isConfirming}
            className="bg-green-600 hover:bg-green-700"
          >
            {isConfirming ? 'Confirmando...' : 'Confirmar Recepcion'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
