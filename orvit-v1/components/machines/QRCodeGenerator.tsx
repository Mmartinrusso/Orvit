'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QrCode, Download, Printer, Copy, Check, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface QRCodeGeneratorProps {
  machineId: number;
  machineName: string;
  assetCode?: string;
}

export function QRCodeGenerator({ machineId, machineName, assetCode }: QRCodeGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [size, setSize] = useState('200');
  const [copied, setCopied] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['machine-qr', machineId, size],
    queryFn: async () => {
      const res = await fetch(`/api/machines/${machineId}/qr?size=${size}`);
      if (!res.ok) throw new Error('Error generating QR');
      return res.json();
    },
    enabled: isOpen,
  });

  const handleDownload = async (format: 'png' | 'svg') => {
    try {
      const res = await fetch(`/api/machines/${machineId}/qr?format=${format}&size=${size}`);
      if (!res.ok) throw new Error('Error downloading QR');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-${machineName.toLowerCase().replace(/\s+/g, '-')}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(`QR descargado como ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Error al descargar QR');
    }
  };

  const handleCopyUrl = () => {
    if (data?.qr?.url) {
      navigator.clipboard.writeText(data.qr.url);
      setCopied(true);
      toast.success('URL copiada al portapapeles');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR - ${machineName}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: Arial, sans-serif;
            }
            .container {
              text-align: center;
              padding: 20px;
              border: 2px solid #000;
              border-radius: 8px;
            }
            h1 {
              margin: 0 0 8px 0;
              font-size: 24px;
            }
            p {
              margin: 0 0 16px 0;
              color: #666;
            }
            img {
              margin-bottom: 16px;
            }
            .code {
              font-family: monospace;
              font-size: 12px;
              color: #888;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${machineName}</h1>
            ${assetCode ? `<p>Código: ${assetCode}</p>` : ''}
            <img src="${data?.qr?.dataUrl}" alt="QR Code" width="${size}" height="${size}" />
            <p class="code">${data?.qr?.code}</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <QrCode className="h-4 w-4 mr-2" />
        Código QR
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Código QR - {machineName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* QR Preview */}
            <div className="flex justify-center p-4 bg-white border rounded-lg">
              {isLoading || isFetching ? (
                <Skeleton className="w-[200px] h-[200px]" />
              ) : data?.qr?.dataUrl ? (
                <img
                  src={data.qr.dataUrl}
                  alt="QR Code"
                  className="w-[200px] h-[200px]"
                />
              ) : (
                <div className="w-[200px] h-[200px] flex items-center justify-center text-muted-foreground">
                  Error al generar QR
                </div>
              )}
            </div>

            {/* Machine Info */}
            {data?.machine && (
              <div className="text-center text-sm">
                <p className="font-medium">{data.machine.name}</p>
                {data.machine.assetCode && (
                  <p className="text-muted-foreground">Código: {data.machine.assetCode}</p>
                )}
              </div>
            )}

            {/* URL */}
            {data?.qr?.url && (
              <div className="flex gap-2">
                <Input
                  value={data.qr.url}
                  readOnly
                  className="text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyUrl}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}

            {/* Size Selector */}
            <div className="space-y-2">
              <Label>Tamaño</Label>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">Pequeño (100px)</SelectItem>
                  <SelectItem value="200">Mediano (200px)</SelectItem>
                  <SelectItem value="300">Grande (300px)</SelectItem>
                  <SelectItem value="500">Extra Grande (500px)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerar
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button variant="outline" onClick={() => handleDownload('svg')}>
              <Download className="h-4 w-4 mr-2" />
              SVG
            </Button>
            <Button onClick={() => handleDownload('png')}>
              <Download className="h-4 w-4 mr-2" />
              PNG
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default QRCodeGenerator;
