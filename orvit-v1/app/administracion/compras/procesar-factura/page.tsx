'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Brain,
  Upload,
  FileImage,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Sparkles,
  Save,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { DatePicker } from '@/components/ui/date-picker';

interface ExtractedData {
  proveedor?: {
    nombre?: string;
    cuit?: string;
    direccion?: string;
  };
  factura?: {
    tipo?: string;
    punto_venta?: string;
    numero?: string;
    fecha?: string;
    cae?: string;
    fecha_vto_cae?: string;
  };
  montos?: {
    subtotal?: number;
    iva_21?: number;
    iva_105?: number;
    iva_27?: number;
    percepciones?: number;
    total?: number;
  };
  items?: Array<{
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }>;
  confianza?: number;
  warnings?: string[];
}

interface ProcessResult {
  success: boolean;
  data: ExtractedData;
  proveedorEncontrado?: { id: number; name: string };
  duplicadoPotencial?: boolean;
}

export default function ProcesarFacturaPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [editedData, setEditedData] = useState<ExtractedData | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!validTypes.includes(selectedFile.type)) {
        toast.error('Solo se permiten imágenes (JPG, PNG, WebP) o PDF');
        return;
      }

      setFile(selectedFile);
      setResult(null);
      setEditedData(null);

      // Preview para imágenes
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(selectedFile);
      } else {
        setPreview(null);
      }
    }
  };

  const handleProcess = async () => {
    if (!file) {
      toast.error('Selecciona un archivo primero');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/compras/facturas/procesar-ia', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar');
      }

      setResult(data);
      setEditedData(data.data);

      if (data.duplicadoPotencial) {
        toast.warning('Posible factura duplicada detectada');
      } else if (data.data.confianza && data.data.confianza < 0.7) {
        toast.warning('Extracción con baja confianza. Verifica los datos.');
      } else {
        toast.success('Factura procesada exitosamente');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editedData) return;

    setSaving(true);
    try {
      // Crear factura con los datos extraídos
      const facturaData = {
        numero_factura: editedData.factura?.numero,
        punto_venta: editedData.factura?.punto_venta,
        tipo_comprobante: editedData.factura?.tipo || 'FACTURA_A',
        fecha: editedData.factura?.fecha,
        monto_total: editedData.montos?.total,
        monto_neto: editedData.montos?.subtotal,
        monto_iva: (editedData.montos?.iva_21 || 0) + (editedData.montos?.iva_105 || 0) + (editedData.montos?.iva_27 || 0),
        cae: editedData.factura?.cae,
        cae_vto: editedData.factura?.fecha_vto_cae,
        supplierId: result?.proveedorEncontrado?.id
      };

      const response = await fetch('/api/compras/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(facturaData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al guardar');
      }

      toast.success('Factura guardada exitosamente');
      resetForm();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setEditedData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return '-';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="m-3 rounded-2xl surface-card dashboard-surface px-6 md:px-8 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="w-8 h-8 text-purple-600" />
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Procesar Factura con IA</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Extrae automáticamente los datos de facturas usando inteligencia artificial
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel izquierdo - Carga de archivo */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Cargar Factura
              </CardTitle>
              <CardDescription>
                Sube una imagen o PDF de la factura
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              {!file ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-all"
                >
                  <FileImage className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">Click para seleccionar archivo</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG, WebP o PDF (máx. 10MB)
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {preview && (
                    <div className="relative rounded-lg overflow-hidden border">
                      <img
                        src={preview}
                        alt="Preview"
                        className="w-full max-h-[400px] object-contain bg-gray-100"
                      />
                    </div>
                  )}
                  {!preview && file.type === 'application/pdf' && (
                    <div className="p-8 bg-gray-100 rounded-lg text-center">
                      <FileImage className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">PDF - Vista previa no disponible</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={resetForm}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Cambiar archivo
                    </Button>
                    <Button
                      className="flex-1 bg-purple-600 hover:bg-purple-700"
                      onClick={handleProcess}
                      disabled={loading}
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      {loading ? 'Procesando...' : 'Procesar con IA'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alertas */}
          {result?.duplicadoPotencial && (
            <Alert className="border-yellow-500 bg-yellow-50">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                Se detectó una posible factura duplicada en el sistema.
                Verifica antes de guardar.
              </AlertDescription>
            </Alert>
          )}

          {result?.data?.warnings && result.data.warnings.length > 0 && (
            <Alert className="border-orange-500 bg-orange-50">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <ul className="list-disc list-inside text-sm">
                  {result.data.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Panel derecho - Datos extraídos */}
        <div className="space-y-4">
          {!result ? (
            <Card className="h-full min-h-[400px] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Brain className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Carga una factura y haz click en</p>
                <p className="font-medium text-purple-600">"Procesar con IA"</p>
              </div>
            </Card>
          ) : (
            <>
              {/* Confianza */}
              {editedData?.confianza && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Nivel de confianza:</span>
                  <Badge className={getConfidenceColor(editedData.confianza)}>
                    {(editedData.confianza * 100).toFixed(0)}%
                  </Badge>
                </div>
              )}

              {/* Proveedor */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Proveedor
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Nombre</Label>
                      <Input
                        value={editedData?.proveedor?.nombre || ''}
                        onChange={(e) => setEditedData({
                          ...editedData!,
                          proveedor: { ...editedData?.proveedor, nombre: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">CUIT</Label>
                      <Input
                        value={editedData?.proveedor?.cuit || ''}
                        onChange={(e) => setEditedData({
                          ...editedData!,
                          proveedor: { ...editedData?.proveedor, cuit: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                  {result.proveedorEncontrado && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-green-700">
                        Proveedor encontrado: {result.proveedorEncontrado.name}
                      </span>
                    </div>
                  )}
                  {!result.proveedorEncontrado && editedData?.proveedor?.cuit && (
                    <div className="flex items-center gap-2 text-sm">
                      <XCircle className="w-4 h-4 text-yellow-600" />
                      <span className="text-yellow-700">
                        Proveedor no encontrado - Se creará uno nuevo
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Datos de factura */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Datos de Factura
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Select
                        value={editedData?.factura?.tipo || 'FACTURA_A'}
                        onValueChange={(v) => setEditedData({
                          ...editedData!,
                          factura: { ...editedData?.factura, tipo: v }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FACTURA_A">Factura A</SelectItem>
                          <SelectItem value="FACTURA_B">Factura B</SelectItem>
                          <SelectItem value="FACTURA_C">Factura C</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Punto Venta</Label>
                      <Input
                        value={editedData?.factura?.punto_venta || ''}
                        onChange={(e) => setEditedData({
                          ...editedData!,
                          factura: { ...editedData?.factura, punto_venta: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Número</Label>
                      <Input
                        value={editedData?.factura?.numero || ''}
                        onChange={(e) => setEditedData({
                          ...editedData!,
                          factura: { ...editedData?.factura, numero: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Fecha</Label>
                      <DatePicker
                        value={editedData?.factura?.fecha || ''}
                        onChange={(date) => setEditedData({
                          ...editedData!,
                          factura: { ...editedData?.factura, fecha: date }
                        })}
                        placeholder="Seleccionar fecha"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">CAE</Label>
                      <Input
                        value={editedData?.factura?.cae || ''}
                        onChange={(e) => setEditedData({
                          ...editedData!,
                          factura: { ...editedData?.factura, cae: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Montos */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Montos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Subtotal</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editedData?.montos?.subtotal || ''}
                        onChange={(e) => setEditedData({
                          ...editedData!,
                          montos: { ...editedData?.montos, subtotal: parseFloat(e.target.value) }
                        })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">IVA 21%</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editedData?.montos?.iva_21 || ''}
                        onChange={(e) => setEditedData({
                          ...editedData!,
                          montos: { ...editedData?.montos, iva_21: parseFloat(e.target.value) }
                        })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">IVA 10.5%</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editedData?.montos?.iva_105 || ''}
                        onChange={(e) => setEditedData({
                          ...editedData!,
                          montos: { ...editedData?.montos, iva_105: parseFloat(e.target.value) }
                        })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Percepciones</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editedData?.montos?.percepciones || ''}
                        onChange={(e) => setEditedData({
                          ...editedData!,
                          montos: { ...editedData?.montos, percepciones: parseFloat(e.target.value) }
                        })}
                      />
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-primary/5 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total</span>
                      <span className="text-xl font-bold">
                        {formatCurrency(editedData?.montos?.total)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Items */}
              {editedData?.items && editedData.items.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Items ({editedData.items.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="text-right">Cant.</TableHead>
                          <TableHead className="text-right">P. Unit.</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editedData.items.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="max-w-[200px] truncate">
                              {item.descripcion}
                            </TableCell>
                            <TableCell className="text-right">{item.cantidad}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.precio_unitario)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.subtotal)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Acciones */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={resetForm}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Guardar Factura
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
