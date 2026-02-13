'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Users,
  FileText,
  ShoppingCart
} from 'lucide-react';
import { toast } from 'sonner';

interface ImportRow {
  rowNumber: number;
  data: Record<string, any>;
  errors: string[];
  warnings: string[];
  valid: boolean;
}

interface ImportResult {
  success: boolean;
  preview: boolean;
  tipo: string;
  archivo: string;
  totalFilas: number;
  imported: number;
  errors: number;
  warnings: number;
  details: ImportRow[];
}

const tipoOptions = [
  { value: 'proveedores', label: 'Proveedores', icon: Users, description: 'Importar lista de proveedores' },
  { value: 'facturas', label: 'Facturas', icon: FileText, description: 'Importar facturas de compra' },
  { value: 'ordenes', label: 'Órdenes de Compra', icon: ShoppingCart, description: 'Importar órdenes (próximamente)' },
];

export default function ImportarPage() {
  const [selectedTipo, setSelectedTipo] = useState('proveedores');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<ImportResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Solo se permiten archivos CSV');
        return;
      }
      setFile(selectedFile);
      setPreviewResult(null);
      setImportResult(null);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`/api/compras/import?tipo=${selectedTipo}`);
      if (!response.ok) throw new Error('Error al descargar');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plantilla_${selectedTipo}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error('Error al descargar plantilla');
    }
  };

  const handlePreview = async () => {
    if (!file) {
      toast.error('Selecciona un archivo primero');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tipo', selectedTipo);
      formData.append('preview', 'true');

      const response = await fetch('/api/compras/import', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error en la vista previa');
      }

      setPreviewResult(result);
      setImportResult(null);

      if (result.errors > 0) {
        toast.warning(`Vista previa: ${result.errors} errores encontrados`);
      } else {
        toast.success('Vista previa lista. Revisa los datos antes de importar.');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Selecciona un archivo primero');
      return;
    }

    if (!previewResult) {
      toast.error('Primero realiza una vista previa');
      return;
    }

    if (previewResult.errors > 0) {
      if (!confirm('Hay errores en los datos. ¿Deseas importar solo las filas válidas?')) {
        return;
      }
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tipo', selectedTipo);
      formData.append('preview', 'false');

      const response = await fetch('/api/compras/import', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error en la importación');
      }

      setImportResult(result);
      toast.success(`Importación completada: ${result.imported} registros importados`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreviewResult(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const currentResult = importResult || previewResult;

  return (
    <div className="m-3 rounded-2xl surface-card dashboard-surface px-6 md:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Importar Datos</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Importa proveedores, facturas y órdenes desde archivos CSV
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel izquierdo - Configuración */}
        <div className="space-y-6">
          {/* Selección de tipo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tipo de Importación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tipoOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <div
                    key={option.value}
                    onClick={() => {
                      setSelectedTipo(option.value);
                      resetForm();
                    }}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedTipo === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent bg-muted/50 hover:bg-muted'
                    } ${option.value === 'ordenes' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${selectedTipo === option.value ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div>
                        <p className="font-medium">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Descargar plantilla */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Plantilla</CardTitle>
              <CardDescription>
                Descarga la plantilla CSV con el formato correcto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleDownloadTemplate}
                disabled={selectedTipo === 'ordenes'}
              >
                <Download className="w-4 h-4 mr-2" />
                Descargar Plantilla
              </Button>
            </CardContent>
          </Card>

          {/* Subir archivo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Archivo CSV</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              {!file ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                >
                  <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">Click para seleccionar archivo</p>
                  <p className="text-xs text-muted-foreground mt-1">Solo archivos CSV</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <FileSpreadsheet className="w-8 h-8 text-green-600" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={resetForm}>
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={handlePreview}
                  disabled={!file || loading || selectedTipo === 'ordenes'}
                >
                  {loading && !previewResult ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Vista Previa
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleImport}
                  disabled={!previewResult || loading || importResult !== null}
                >
                  {loading && previewResult ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Importar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Panel derecho - Resultados */}
        <div className="lg:col-span-2 space-y-4">
          {importResult && (
            <Alert className={importResult.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
              <AlertDescription className="flex items-center gap-2">
                {importResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <span className={importResult.success ? 'text-green-800' : 'text-red-800'}>
                  Importación completada: {importResult.imported} registros importados
                  {importResult.errors > 0 && `, ${importResult.errors} errores`}
                </span>
              </AlertDescription>
            </Alert>
          )}

          {currentResult && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {importResult ? 'Resultado de Importación' : 'Vista Previa'}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="default">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {currentResult.totalFilas - currentResult.errors} válidos
                    </Badge>
                    {currentResult.errors > 0 && (
                      <Badge variant="destructive">
                        <XCircle className="w-3 h-3 mr-1" />
                        {currentResult.errors} errores
                      </Badge>
                    )}
                    {currentResult.warnings > 0 && (
                      <Badge variant="secondary">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {currentResult.warnings} advertencias
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Fila</TableHead>
                        <TableHead>Datos</TableHead>
                        <TableHead className="w-24">Estado</TableHead>
                        <TableHead>Mensajes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentResult.details.map((row) => (
                        <TableRow key={row.rowNumber} className={!row.valid ? 'bg-red-50' : ''}>
                          <TableCell>{row.rowNumber}</TableCell>
                          <TableCell>
                            <div className="text-xs space-y-1 max-w-[300px]">
                              {Object.entries(row.data).slice(0, 4).map(([key, value]) => (
                                <div key={key} className="truncate">
                                  <span className="text-muted-foreground">{key}:</span>{' '}
                                  <span>{String(value) || '-'}</span>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            {row.valid ? (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                OK
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <XCircle className="w-3 h-3 mr-1" />
                                Error
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-xs">
                              {row.errors.map((err, i) => (
                                <p key={i} className="text-red-600">
                                  <XCircle className="w-3 h-3 inline mr-1" />
                                  {err}
                                </p>
                              ))}
                              {row.warnings.map((warn, i) => (
                                <p key={i} className="text-yellow-600">
                                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                                  {warn}
                                </p>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {!currentResult && (
            <Card className="h-[400px] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Selecciona un archivo CSV y haz click en "Vista Previa"</p>
                <p className="text-sm mt-2">para ver los datos antes de importar</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
