'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Camera,
  CameraOff,
  Flashlight,
  FlashlightOff,
  X,
  Package,
  ArrowUp,
  ArrowDown,
  Eye,
  Loader2,
  ScanLine,
  Keyboard,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCompany } from '@/contexts/CompanyContext';
import { cn } from '@/lib/utils';

interface Tool {
  id: number;
  name: string;
  code: string | null;
  itemType: string;
  stockQuantity: number;
  minStockLevel: number;
  location: string | null;
  category: string | null;
  status: string;
  isCritical?: boolean;
}

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onToolFound?: (tool: Tool) => void;
  onStockIn?: (tool: Tool) => void;
  onStockOut?: (tool: Tool) => void;
  mode?: 'search' | 'stock-in' | 'stock-out' | 'view';
}

export function QRScanner({
  isOpen,
  onClose,
  onToolFound,
  onStockIn,
  onStockOut,
  mode = 'search',
}: QRScannerProps) {
  const { currentCompany } = useCompany();
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [foundTool, setFoundTool] = useState<Tool | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-scanner-container';

  // Cleanup scanner on unmount or close
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFoundTool(null);
      setQuantity(1);
      setManualCode('');
      setShowManualInput(false);
    } else {
      stopScanner();
    }
  }, [isOpen]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
      } catch (error) {
        console.error('Error stopping scanner:', error);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
    setTorchOn(false);
  }, []);

  const startScanner = useCallback(async () => {
    try {
      // Check camera permissions
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        setHasCamera(false);
        toast.error('No se encontraron cámaras');
        return;
      }

      setHasCamera(true);

      // Create scanner instance
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerContainerId);
      }

      // Start scanning
      await scannerRef.current.start(
        { facingMode: 'environment' }, // Use back camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        handleScanSuccess,
        (errorMessage) => {
          // Ignore scan errors (no QR found)
        }
      );

      setIsScanning(true);
    } catch (error) {
      console.error('Error starting scanner:', error);
      setHasCamera(false);
      toast.error('No se pudo acceder a la cámara');
    }
  }, []);

  const handleScanSuccess = async (decodedText: string) => {
    // Stop scanner while processing
    await stopScanner();

    // Vibrate on successful scan (if supported)
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }

    // Search for tool
    await searchTool(decodedText);
  };

  const searchTool = async (code: string) => {
    if (!currentCompany?.id || !code.trim()) return;

    setIsSearching(true);
    try {
      // Search by code or ID
      const response = await fetch(
        `/api/tools?companyId=${currentCompany.id}&search=${encodeURIComponent(code.trim())}`
      );

      if (!response.ok) throw new Error('Error buscando herramienta');

      const data = await response.json();
      // Ensure data is always an array
      const tools = Array.isArray(data) ? data : (data?.tools || data?.items || []);

      // Find exact match by code or id
      const tool = tools.find((t: Tool) =>
        t.code?.toLowerCase() === code.toLowerCase() ||
        t.id.toString() === code
      );

      if (tool) {
        setFoundTool(tool);
        onToolFound?.(tool);
        toast.success(`Encontrado: ${tool.name}`);
      } else {
        toast.error('No se encontró ningún item con ese código');
        setFoundTool(null);
      }
    } catch (error) {
      console.error('Error searching tool:', error);
      toast.error('Error al buscar');
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualSearch = () => {
    if (manualCode.trim()) {
      searchTool(manualCode.trim());
    }
  };

  const toggleTorch = async () => {
    if (scannerRef.current && isScanning) {
      try {
        const track = scannerRef.current.getRunningTrackCameraCapabilities();
        if (track.torchFeature().isSupported()) {
          await track.torchFeature().apply(!torchOn);
          setTorchOn(!torchOn);
        } else {
          toast.error('Flash no soportado');
        }
      } catch (error) {
        console.error('Error toggling torch:', error);
      }
    }
  };

  const handleStockAction = async (type: 'IN' | 'OUT') => {
    if (!foundTool || !currentCompany?.id) return;

    if (type === 'OUT' && quantity > foundTool.stockQuantity) {
      toast.error('Stock insuficiente');
      return;
    }

    setIsProcessing(true);
    toast.loading('Procesando...', { id: 'stock-action' });

    try {
      const response = await fetch('/api/tools/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: foundTool.id,
          type,
          quantity,
          reason: `Escaneo rápido QR - ${type === 'IN' ? 'Entrada' : 'Salida'}`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al procesar');
      }

      const result = await response.json();

      // Update local tool state
      setFoundTool({
        ...foundTool,
        stockQuantity: type === 'IN'
          ? foundTool.stockQuantity + quantity
          : foundTool.stockQuantity - quantity,
      });

      toast.success(
        `${type === 'IN' ? 'Entrada' : 'Salida'} de ${quantity} unidad(es) registrada`,
        { id: 'stock-action' }
      );

      if (type === 'IN') {
        onStockIn?.(foundTool);
      } else {
        onStockOut?.(foundTool);
      }

      setQuantity(1);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al procesar';
      toast.error(message, { id: 'stock-action' });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetScan = () => {
    setFoundTool(null);
    setQuantity(1);
    setManualCode('');
  };

  const getStockStatus = (tool: Tool) => {
    if (tool.stockQuantity === 0) {
      return { label: 'Sin Stock', color: 'destructive' as const };
    }
    if (tool.stockQuantity <= tool.minStockLevel) {
      return { label: 'Stock Bajo', color: 'secondary' as const };
    }
    return { label: 'OK', color: 'default' as const };
  };

  const getModeTitle = () => {
    switch (mode) {
      case 'stock-in':
        return 'Entrada Rápida';
      case 'stock-out':
        return 'Salida Rápida';
      case 'view':
        return 'Ver Item';
      default:
        return 'Escanear Item';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            {getModeTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scanner Area */}
          {!foundTool && (
            <>
              {/* Camera Scanner */}
              <div className="relative">
                <div
                  id={scannerContainerId}
                  className={cn(
                    'w-full aspect-square bg-black rounded-lg overflow-hidden',
                    !isScanning && 'flex items-center justify-center'
                  )}
                >
                  {!isScanning && (
                    <div className="text-center text-white p-4">
                      {hasCamera ? (
                        <>
                          <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm opacity-70">
                            Presiona iniciar para escanear
                          </p>
                        </>
                      ) : (
                        <>
                          <CameraOff className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm opacity-70">
                            Cámara no disponible
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Scanner Controls */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                  {isScanning ? (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={toggleTorch}
                        className="rounded-full"
                      >
                        {torchOn ? (
                          <FlashlightOff className="h-4 w-4" />
                        ) : (
                          <Flashlight className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={stopScanner}
                        className="rounded-full"
                      >
                        <CameraOff className="h-4 w-4 mr-1" />
                        Detener
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={startScanner}
                      disabled={!hasCamera}
                      className="rounded-full"
                    >
                      <Camera className="h-4 w-4 mr-1" />
                      Iniciar Cámara
                    </Button>
                  )}
                </div>
              </div>

              {/* Manual Input Toggle */}
              <div className="flex items-center justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowManualInput(!showManualInput)}
                  className="text-muted-foreground"
                >
                  <Keyboard className="h-4 w-4 mr-2" />
                  {showManualInput ? 'Ocultar' : 'Ingresar código manual'}
                </Button>
              </div>

              {/* Manual Code Input */}
              {showManualInput && (
                <div className="flex gap-2">
                  <Input
                    placeholder="Código del item..."
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                    autoFocus
                  />
                  <Button
                    onClick={handleManualSearch}
                    disabled={!manualCode.trim() || isSearching}
                  >
                    {isSearching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Buscar'
                    )}
                  </Button>
                </div>
              )}

              {/* Searching indicator */}
              {isSearching && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Buscando...</span>
                </div>
              )}
            </>
          )}

          {/* Found Tool Display */}
          {foundTool && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  {/* Tool Info */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{foundTool.name}</h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        {foundTool.code && <span>Código: {foundTool.code}</span>}
                        {foundTool.location && (
                          <>
                            <span>•</span>
                            <span>{foundTool.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {foundTool.isCritical && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Crítico
                      </Badge>
                    )}
                  </div>

                  {/* Stock Info */}
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Stock Actual</p>
                      <p className="text-3xl font-bold">{foundTool.stockQuantity}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={getStockStatus(foundTool).color}>
                        {getStockStatus(foundTool).label}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        Mín: {foundTool.minStockLevel}
                      </p>
                    </div>
                  </div>

                  {/* Quantity Input */}
                  {(mode === 'search' || mode === 'stock-in' || mode === 'stock-out') && (
                    <div>
                      <Label>Cantidad</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          disabled={quantity <= 1}
                        >
                          -
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                          className="text-center w-20"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setQuantity(quantity + 1)}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {(mode === 'search' || mode === 'stock-in') && (
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => handleStockAction('IN')}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <ArrowUp className="h-4 w-4 mr-2" />
                        )}
                        Entrada
                      </Button>
                    )}
                    {(mode === 'search' || mode === 'stock-out') && (
                      <Button
                        className="flex-1 bg-red-600 hover:bg-red-700"
                        onClick={() => handleStockAction('OUT')}
                        disabled={isProcessing || foundTool.stockQuantity === 0}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <ArrowDown className="h-4 w-4 mr-2" />
                        )}
                        Salida
                      </Button>
                    )}
                  </div>

                  {/* Scan Another */}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={resetScan}
                  >
                    <ScanLine className="h-4 w-4 mr-2" />
                    Escanear Otro
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default QRScanner;
