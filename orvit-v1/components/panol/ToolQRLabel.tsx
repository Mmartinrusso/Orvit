'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { QrCode, Printer, Download } from 'lucide-react';

interface ToolQRLabelProps {
  toolId: number;
  toolName: string;
  trigger?: React.ReactNode;
}

interface QRResponse {
  success: boolean;
  tool: {
    id: number;
    name: string;
    category: string;
    serialNumber: string | null;
    location: string | null;
  };
  qr: {
    data: string;
    size: number;
    format: string;
  };
}

async function fetchToolQR(toolId: number): Promise<QRResponse> {
  const res = await fetch(`/api/tools/${toolId}/qr?size=200`);
  if (!res.ok) throw new Error('Error al generar QR');
  return res.json();
}

export function ToolQRLabel({ toolId, toolName, trigger }: ToolQRLabelProps) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['tool-qr', toolId],
    queryFn: () => fetchToolQR(toolId),
    enabled: open
  });

  const handlePrint = () => {
    if (!data) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR - ${data.tool.name}</title>
          <style>
            @page {
              size: 62mm 100mm;
              margin: 2mm;
            }
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 4mm;
              margin: 0;
            }
            .label {
              border: 1px solid #ccc;
              padding: 4mm;
              border-radius: 2mm;
            }
            .qr-image {
              width: 40mm;
              height: 40mm;
            }
            .tool-name {
              font-size: 12pt;
              font-weight: bold;
              margin: 2mm 0;
              word-break: break-word;
            }
            .tool-info {
              font-size: 9pt;
              color: #666;
              margin: 1mm 0;
            }
            .tool-id {
              font-size: 10pt;
              font-weight: bold;
              margin-top: 2mm;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <img src="${data.qr.data}" class="qr-image" />
            <div class="tool-name">${data.tool.name}</div>
            <div class="tool-info">${data.tool.category}</div>
            ${data.tool.serialNumber ? `<div class="tool-info">S/N: ${data.tool.serialNumber}</div>` : ''}
            ${data.tool.location ? `<div class="tool-info">${data.tool.location}</div>` : ''}
            <div class="tool-id">ID: ${data.tool.id}</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownload = () => {
    if (!data) return;

    const link = document.createElement('a');
    link.href = data.qr.data;
    link.download = `qr-${data.tool.id}-${data.tool.name.replace(/\s+/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <QrCode className="h-4 w-4 mr-2" />
            Ver QR
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Código QR</DialogTitle>
          <DialogDescription>{toolName}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center py-4">
          {isLoading ? (
            <Skeleton className="w-[200px] h-[200px]" />
          ) : error ? (
            <p className="text-destructive">Error al generar QR</p>
          ) : data ? (
            <>
              <div className="border rounded-lg p-4 bg-white">
                <img
                  src={data.qr.data}
                  alt={`QR de ${data.tool.name}`}
                  width={200}
                  height={200}
                />
              </div>
              <div className="mt-4 text-center">
                <p className="font-medium">{data.tool.name}</p>
                <p className="text-sm text-muted-foreground">{data.tool.category}</p>
                {data.tool.serialNumber && (
                  <p className="text-xs text-muted-foreground">S/N: {data.tool.serialNumber}</p>
                )}
                {data.tool.location && (
                  <p className="text-xs text-muted-foreground">{data.tool.location}</p>
                )}
              </div>
            </>
          ) : null}
        </div>

        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={!data}>
            <Download className="h-4 w-4 mr-2" />
            Descargar
          </Button>
          <Button onClick={handlePrint} disabled={!data}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir etiqueta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Componente para impresión masiva de etiquetas QR
 */
interface BatchQRPrintProps {
  tools: Array<{
    id: number;
    name: string;
    category: string;
    serialNumber?: string | null;
    location?: string | null;
    qrBase64?: string;
  }>;
}

export function BatchQRPrint({ tools }: BatchQRPrintProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [qrData, setQrData] = useState<typeof tools>([]);

  const generateQRs = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/tools/qr-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolIds: tools.map(t => t.id),
          size: 150
        })
      });

      if (!response.ok) throw new Error('Error generando QRs');

      const data = await response.json();
      setQrData(data.tools);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintAll = () => {
    if (qrData.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const labelsHtml = qrData.map(tool => `
      <div class="label">
        <img src="${tool.qrBase64}" class="qr-image" />
        <div class="tool-name">${tool.name}</div>
        <div class="tool-info">${tool.category}</div>
        ${tool.serialNumber ? `<div class="tool-info">S/N: ${tool.serialNumber}</div>` : ''}
        ${tool.location ? `<div class="tool-info">${tool.location}</div>` : ''}
        <div class="tool-id">ID: ${tool.id}</div>
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiquetas QR - Pañol</title>
          <style>
            @page {
              size: A4;
              margin: 10mm;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
            }
            .container {
              display: flex;
              flex-wrap: wrap;
              gap: 5mm;
              justify-content: flex-start;
            }
            .label {
              width: 60mm;
              height: 80mm;
              border: 1px solid #ccc;
              padding: 3mm;
              border-radius: 2mm;
              text-align: center;
              page-break-inside: avoid;
              box-sizing: border-box;
            }
            .qr-image {
              width: 35mm;
              height: 35mm;
            }
            .tool-name {
              font-size: 10pt;
              font-weight: bold;
              margin: 2mm 0;
              word-break: break-word;
              line-height: 1.2;
              max-height: 15mm;
              overflow: hidden;
            }
            .tool-info {
              font-size: 8pt;
              color: #666;
              margin: 1mm 0;
            }
            .tool-id {
              font-size: 9pt;
              font-weight: bold;
              margin-top: 2mm;
            }
          </style>
        </head>
        <body>
          <div class="container">
            ${labelsHtml}
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          onClick={generateQRs}
          disabled={isGenerating || tools.length === 0}
        >
          <QrCode className="h-4 w-4 mr-2" />
          {isGenerating ? 'Generando...' : `Generar ${tools.length} QRs`}
        </Button>
        {qrData.length > 0 && (
          <Button onClick={handlePrintAll} variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir {qrData.length} etiquetas
          </Button>
        )}
      </div>

      {qrData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {qrData.map(tool => (
            <div key={tool.id} className="border rounded-lg p-2 text-center">
              <img
                src={tool.qrBase64}
                alt={tool.name}
                className="w-full max-w-[100px] mx-auto"
              />
              <p className="text-xs font-medium mt-1 truncate">{tool.name}</p>
              <p className="text-xs text-muted-foreground">ID: {tool.id}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
