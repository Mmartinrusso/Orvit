'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QrCode, Printer, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Machine {
  id: number;
  name: string;
  assetCode?: string;
}

interface QRPrintSheetProps {
  machines: Machine[];
  open: boolean;
  onClose: () => void;
}

interface QRData {
  machineId: number;
  machineName: string;
  assetCode?: string;
  dataUrl: string;
  code: string;
}

export function QRPrintSheet({ machines, open, onClose }: QRPrintSheetProps) {
  const [selectedMachines, setSelectedMachines] = useState<number[]>([]);
  const [qrData, setQrData] = useState<QRData[]>([]);
  const [loading, setLoading] = useState(false);
  const [layout, setLayout] = useState<'2x2' | '3x3' | '4x4'>('3x3');

  useEffect(() => {
    if (open) {
      setSelectedMachines(machines.slice(0, 9).map(m => m.id));
    }
  }, [open, machines]);

  const toggleMachine = (machineId: number) => {
    setSelectedMachines(prev =>
      prev.includes(machineId)
        ? prev.filter(id => id !== machineId)
        : [...prev, machineId]
    );
  };

  const selectAll = () => {
    const maxItems = layout === '2x2' ? 4 : layout === '3x3' ? 9 : 16;
    setSelectedMachines(machines.slice(0, maxItems).map(m => m.id));
  };

  const deselectAll = () => {
    setSelectedMachines([]);
  };

  const generateQRCodes = async () => {
    setLoading(true);
    const data: QRData[] = [];

    for (const machineId of selectedMachines) {
      try {
        const res = await fetch(`/api/machines/${machineId}/qr?size=150`);
        if (res.ok) {
          const json = await res.json();
          data.push({
            machineId,
            machineName: json.machine.name,
            assetCode: json.machine.assetCode,
            dataUrl: json.qr.dataUrl,
            code: json.qr.code,
          });
        }
      } catch (error) {
        console.error(`Error generating QR for machine ${machineId}:`, error);
      }
    }

    setQrData(data);
    setLoading(false);
  };

  const handlePrint = async () => {
    if (qrData.length === 0) {
      await generateQRCodes();
    }

    const gridCols = layout === '2x2' ? 2 : layout === '3x3' ? 3 : 4;
    const itemSize = layout === '2x2' ? '250px' : layout === '3x3' ? '180px' : '140px';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Códigos QR - Máquinas</title>
          <style>
            @page {
              size: A4;
              margin: 10mm;
            }
            body {
              margin: 0;
              padding: 10px;
              font-family: Arial, sans-serif;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(${gridCols}, 1fr);
              gap: 10px;
            }
            .qr-item {
              text-align: center;
              padding: 10px;
              border: 1px dashed #ccc;
              border-radius: 8px;
              page-break-inside: avoid;
            }
            .qr-item h3 {
              margin: 0 0 4px 0;
              font-size: 12px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .qr-item p {
              margin: 0 0 8px 0;
              font-size: 10px;
              color: #666;
            }
            .qr-item img {
              width: ${itemSize};
              height: ${itemSize};
            }
            .qr-item .code {
              font-family: monospace;
              font-size: 8px;
              color: #888;
              margin-top: 4px;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; }
              .qr-item { border: 1px dashed #ccc !important; }
            }
          </style>
        </head>
        <body>
          <div class="grid">
            ${qrData.map(qr => `
              <div class="qr-item">
                <h3>${qr.machineName}</h3>
                ${qr.assetCode ? `<p>${qr.assetCode}</p>` : ''}
                <img src="${qr.dataUrl}" alt="QR" />
                <p class="code">${qr.code}</p>
              </div>
            `).join('')}
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

  const maxItems = layout === '2x2' ? 4 : layout === '3x3' ? 9 : 16;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Imprimir Códigos QR
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
        <div className="space-y-4">
          {/* Layout Selector */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Diseño:</span>
            <Select value={layout} onValueChange={(v) => setLayout(v as typeof layout)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2x2">2x2 (4 por página)</SelectItem>
                <SelectItem value="3x3">3x3 (9 por página)</SelectItem>
                <SelectItem value="4x4">4x4 (16 por página)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Selection Controls */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Seleccionar todos ({maxItems} máx.)
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll}>
              Deseleccionar todos
            </Button>
          </div>

          {/* Machine List */}
          <Card>
            <CardHeader className="py-2">
              <CardTitle className="text-sm">
                Máquinas seleccionadas: {selectedMachines.length}/{maxItems}
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-64 overflow-y-auto">
              <div className="space-y-2">
                {machines.map((machine) => (
                  <div
                    key={machine.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-muted"
                  >
                    <Checkbox
                      id={`machine-${machine.id}`}
                      checked={selectedMachines.includes(machine.id)}
                      onCheckedChange={() => toggleMachine(machine.id)}
                      disabled={
                        !selectedMachines.includes(machine.id) &&
                        selectedMachines.length >= maxItems
                      }
                    />
                    <label
                      htmlFor={`machine-${machine.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <span className="font-medium">{machine.name}</span>
                      {machine.assetCode && (
                        <span className="text-sm text-muted-foreground ml-2">
                          ({machine.assetCode})
                        </span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Preview hint */}
          <p className="text-sm text-muted-foreground">
            Se generarán {selectedMachines.length} códigos QR en formato {layout}.
            Los códigos incluirán el nombre y código de activo de cada máquina.
          </p>
        </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handlePrint}
            disabled={selectedMachines.length === 0 || loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Printer className="h-4 w-4 mr-2" />
            )}
            Imprimir {selectedMachines.length} QRs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default QRPrintSheet;
