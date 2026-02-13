'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  RefreshCw,
  Info,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Category } from '@/lib/types/sales';

interface ProductImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onImportComplete?: () => void;
}

interface ImportRow {
  rowIndex: number;
  name: string;
  code: string;
  description?: string;
  category?: string;
  unit?: string;
  costPrice?: number;
  currentStock?: number;
  minStock?: number;
  weight?: number;
  volume?: number;
  packagingType?: string;
  unitsPerPackage?: number;
  areaUnit?: string;
  unitsPerArea?: number;
  location?: string;
  isActive?: boolean;
  // Validation status
  isValid: boolean;
  errors: string[];
  categoryId?: number;
}

// Template columns definition
const TEMPLATE_COLUMNS = [
  { key: 'name', label: 'Nombre *', required: true, example: 'Bloque Hormigón 20x20x40' },
  { key: 'code', label: 'Código *', required: true, example: 'BLO-0001' },
  { key: 'description', label: 'Descripción', required: false, example: 'Bloque de hormigón para construcción' },
  { key: 'category', label: 'Categoría', required: false, example: 'Bloques' },
  { key: 'unit', label: 'Unidad', required: false, example: 'unidad' },
  { key: 'costPrice', label: 'Precio Costo', required: false, example: '150.50' },
  { key: 'currentStock', label: 'Stock Actual', required: false, example: '100' },
  { key: 'minStock', label: 'Stock Mínimo', required: false, example: '20' },
  { key: 'weight', label: 'Peso (kg)', required: false, example: '15.5' },
  { key: 'volume', label: 'Volumen (m³)', required: false, example: '0.016' },
  { key: 'packagingType', label: 'Tipo Envase', required: false, example: 'Pallet' },
  { key: 'unitsPerPackage', label: 'Unidades/Envase', required: false, example: '80' },
  { key: 'areaUnit', label: 'Unidad Área', required: false, example: 'metro2' },
  { key: 'unitsPerArea', label: 'Unidades/Área', required: false, example: '29' },
  { key: 'location', label: 'Ubicación', required: false, example: 'Depósito A-1' },
  { key: 'isActive', label: 'Activo (S/N)', required: false, example: 'S' },
];

const VALID_UNITS = ['unidad', 'metro', 'metro2', 'metro3', 'kilogramo', 'tonelada', 'litro', 'bolsa', 'pallet', 'caja'];
const VALID_AREA_UNITS = ['metro2', 'metro3', 'metro_lineal'];

export function ProductImportDialog({
  open,
  onOpenChange,
  categories,
  onImportComplete,
}: ProductImportDialogProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [importData, setImportData] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: string[] }>({
    success: 0,
    failed: 0,
    errors: [],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate and download template
  const downloadTemplate = useCallback(() => {
    const wb = XLSX.utils.book_new();

    // Create header row
    const headers = TEMPLATE_COLUMNS.map(col => col.label);

    // Create example row
    const example = TEMPLATE_COLUMNS.map(col => col.example);

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);

    // Set column widths
    ws['!cols'] = TEMPLATE_COLUMNS.map(() => ({ wch: 20 }));

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');

    // Add instructions sheet
    const instructions = [
      ['Instrucciones de Importación de Productos'],
      [''],
      ['Campos Obligatorios:'],
      ['- Nombre: Nombre del producto'],
      ['- Código: Código único del producto (SKU)'],
      [''],
      ['Campos Opcionales:'],
      ['- Descripción: Descripción del producto'],
      ['- Categoría: Nombre de la categoría (debe existir en el sistema)'],
      ['- Unidad: unidad, metro, metro2, metro3, kilogramo, tonelada, litro, bolsa, pallet, caja'],
      ['- Precio Costo: Número decimal (ej: 150.50)'],
      ['- Stock Actual: Número entero'],
      ['- Stock Mínimo: Número entero'],
      ['- Peso (kg): Número decimal'],
      ['- Volumen (m³): Número decimal'],
      ['- Tipo Envase: Texto libre'],
      ['- Unidades/Envase: Número entero'],
      ['- Unidad Área: metro2, metro3, metro_lineal'],
      ['- Unidades/Área: Número decimal'],
      ['- Ubicación: Texto libre'],
      ['- Activo: S o N (por defecto S)'],
      [''],
      ['Notas:'],
      ['- La primera fila debe contener los encabezados'],
      ['- Los productos con código duplicado serán rechazados'],
      ['- Si la categoría no existe, se creará automáticamente'],
    ];
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
    wsInstructions['!cols'] = [{ wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instrucciones');

    // Download
    XLSX.writeFile(wb, 'plantilla_productos.xlsx');
    toast.success('Plantilla descargada');
  }, []);

  // Validate a single row
  const validateRow = useCallback((row: any, rowIndex: number): ImportRow => {
    const errors: string[] = [];

    // Required fields
    const name = row['Nombre *']?.toString().trim() || row['name']?.toString().trim();
    const code = row['Código *']?.toString().trim() || row['code']?.toString().trim();

    if (!name) errors.push('Nombre es requerido');
    if (!code) errors.push('Código es requerido');

    // Optional fields with validation
    const unit = row['Unidad']?.toString().toLowerCase().trim() || row['unit']?.toString().toLowerCase().trim() || 'unidad';
    if (!VALID_UNITS.includes(unit)) {
      errors.push(`Unidad "${unit}" no válida`);
    }

    const areaUnit = row['Unidad Área']?.toString().toLowerCase().trim() || row['areaUnit']?.toString().toLowerCase().trim();
    if (areaUnit && !VALID_AREA_UNITS.includes(areaUnit)) {
      errors.push(`Unidad de área "${areaUnit}" no válida`);
    }

    // Parse numbers
    const costPrice = parseFloat(row['Precio Costo'] || row['costPrice'] || '0') || 0;
    const currentStock = parseInt(row['Stock Actual'] || row['currentStock'] || '0') || 0;
    const minStock = parseInt(row['Stock Mínimo'] || row['minStock'] || '0') || 0;
    const weight = parseFloat(row['Peso (kg)'] || row['weight'] || '0') || 0;
    const volume = parseFloat(row['Volumen (m³)'] || row['volume'] || '0') || 0;
    const unitsPerPackage = parseInt(row['Unidades/Envase'] || row['unitsPerPackage'] || '0') || 0;
    const unitsPerArea = parseFloat(row['Unidades/Área'] || row['unitsPerArea'] || '0') || 0;

    // Validate numbers
    if (costPrice < 0) errors.push('Precio de costo no puede ser negativo');
    if (currentStock < 0) errors.push('Stock actual no puede ser negativo');
    if (minStock < 0) errors.push('Stock mínimo no puede ser negativo');

    // Category lookup
    const categoryName = row['Categoría']?.toString().trim() || row['category']?.toString().trim();
    let categoryId: number | undefined;
    if (categoryName) {
      const foundCategory = categories.find(
        c => c.name.toLowerCase() === categoryName.toLowerCase()
      );
      if (foundCategory) {
        categoryId = foundCategory.id;
      }
    }

    // Active field
    const activeValue = row['Activo (S/N)']?.toString().toUpperCase().trim() || row['isActive']?.toString().toUpperCase().trim() || 'S';
    const isActive = activeValue === 'S' || activeValue === 'SI' || activeValue === 'YES' || activeValue === 'TRUE' || activeValue === '1';

    return {
      rowIndex,
      name: name || '',
      code: code || '',
      description: row['Descripción']?.toString().trim() || row['description']?.toString().trim() || '',
      category: categoryName,
      categoryId,
      unit,
      costPrice,
      currentStock,
      minStock,
      weight,
      volume,
      packagingType: row['Tipo Envase']?.toString().trim() || row['packagingType']?.toString().trim() || '',
      unitsPerPackage,
      areaUnit: areaUnit || undefined,
      unitsPerArea,
      location: row['Ubicación']?.toString().trim() || row['location']?.toString().trim() || '',
      isActive,
      isValid: errors.length === 0,
      errors,
    };
  }, [categories]);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 0 });

        if (jsonData.length === 0) {
          toast.error('El archivo está vacío o no tiene el formato correcto');
          return;
        }

        // Validate each row
        const validatedRows: ImportRow[] = jsonData.map((row: any, index: number) =>
          validateRow(row, index + 2) // +2 because Excel rows start at 1 and we skip header
        );

        setImportData(validatedRows);
        setStep('preview');

        const validCount = validatedRows.filter(r => r.isValid).length;
        const invalidCount = validatedRows.filter(r => !r.isValid).length;

        if (invalidCount > 0) {
          toast.warning(`${invalidCount} fila(s) con errores de ${validatedRows.length} total`);
        } else {
          toast.success(`${validCount} productos listos para importar`);
        }
      } catch (error) {
        console.error('Error parsing file:', error);
        toast.error('Error al leer el archivo. Verifica que sea un Excel válido.');
      }
    };

    reader.onerror = () => {
      toast.error('Error al leer el archivo');
    };

    reader.readAsBinaryString(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [validateRow]);

  // Remove row from import
  const removeRow = useCallback((rowIndex: number) => {
    setImportData(prev => prev.filter(r => r.rowIndex !== rowIndex));
  }, []);

  // Execute import
  const executeImport = useCallback(async () => {
    const validRows = importData.filter(r => r.isValid);

    if (validRows.length === 0) {
      toast.error('No hay productos válidos para importar');
      return;
    }

    setImporting(true);
    setStep('importing');
    setImportProgress(0);

    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];

      try {
        // First, create category if needed
        let categoryId = row.categoryId;
        if (row.category && !categoryId) {
          try {
            const catResponse = await fetch('/api/categories', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: row.category }),
            });

            if (catResponse.ok) {
              const newCat = await catResponse.json();
              categoryId = newCat.id;
            }
          } catch (e) {
            console.log('Category creation failed, will use default');
          }
        }

        // Create product
        const response = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: row.name,
            code: row.code,
            description: row.description || '',
            categoryId: categoryId || 1, // Default category
            unit: row.unit || 'unidad',
            costPrice: row.costPrice || 0,
            currentStock: row.currentStock || 0,
            minStock: row.minStock || 0,
            weight: row.weight || 0,
            volume: row.volume || 0,
            packagingType: row.packagingType || '',
            unitsPerPackage: row.unitsPerPackage || 0,
            areaUnit: row.areaUnit || '',
            unitsPerArea: row.unitsPerArea || 0,
            location: row.location || '',
            isActive: row.isActive ?? true,
            costType: 'MANUAL',
          }),
        });

        if (response.ok) {
          results.success++;
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
          results.failed++;
          results.errors.push(`Fila ${row.rowIndex}: ${errorData.error || 'Error al crear producto'}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Fila ${row.rowIndex}: Error de conexión`);
      }

      setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    setImportResults(results);
    setImporting(false);
    setStep('complete');

    if (results.success > 0) {
      toast.success(`${results.success} producto(s) importado(s) correctamente`);
      onImportComplete?.();
    }

    if (results.failed > 0) {
      toast.error(`${results.failed} producto(s) fallaron`);
    }
  }, [importData, onImportComplete]);

  // Reset dialog
  const resetDialog = useCallback(() => {
    setStep('upload');
    setImportData([]);
    setImportProgress(0);
    setImportResults({ success: 0, failed: 0, errors: [] });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleClose = useCallback(() => {
    resetDialog();
    onOpenChange(false);
  }, [resetDialog, onOpenChange]);

  const validCount = importData.filter(r => r.isValid).length;
  const invalidCount = importData.filter(r => !r.isValid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="xl" className="max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar Productos desde Excel
          </DialogTitle>
          <DialogDescription>
            Carga múltiples productos a la vez usando un archivo Excel
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex-1 overflow-y-auto">
          {/* Step: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Download Template Card */}
              <Card className="border-dashed">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Download className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">Plantilla de Importación</h4>
                      <p className="text-sm text-muted-foreground">
                        Descarga la plantilla Excel con las columnas requeridas y ejemplos
                      </p>
                    </div>
                    <Button variant="outline" onClick={downloadTemplate}>
                      <Download className="w-4 h-4 mr-2" />
                      Descargar Plantilla
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Upload Card */}
              <Card className="border-2 border-dashed border-primary/30 hover:border-primary/50 transition-colors">
                <CardContent className="p-8">
                  <div className="text-center">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <h4 className="text-lg font-medium mb-2">Subir Archivo Excel</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Arrastra tu archivo aquí o haz clic para seleccionar
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2" />
                      Seleccionar Archivo
                    </Button>
                    <p className="text-xs text-muted-foreground mt-3">
                      Formatos aceptados: .xlsx, .xls
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Info Card */}
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium mb-1">Campos obligatorios:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Nombre del producto</li>
                        <li>Código / SKU único</li>
                      </ul>
                      <p className="mt-2">
                        Las categorías que no existan serán creadas automáticamente.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="font-medium">{validCount} válidos</span>
                </div>
                {invalidCount > 0 && (
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-destructive" />
                    <span className="font-medium">{invalidCount} con errores</span>
                  </div>
                )}
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={resetDialog}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Cargar otro archivo
                </Button>
              </div>

              {/* Data Table */}
              <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-[60px]">Fila</TableHead>
                      <TableHead className="w-[80px]">Estado</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="w-[60px]">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importData.map((row) => (
                      <TableRow key={row.rowIndex} className={!row.isValid ? 'bg-destructive/5' : ''}>
                        <TableCell className="font-mono text-sm">{row.rowIndex}</TableCell>
                        <TableCell>
                          {row.isValid ? (
                            <Badge variant="default" className="bg-green-500">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="w-3 h-3 mr-1" />
                              Error
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{row.code || '-'}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{row.name || '-'}</p>
                            {row.errors.length > 0 && (
                              <div className="text-xs text-destructive mt-1">
                                {row.errors.join(', ')}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {row.category || 'Sin categoría'}
                            {row.category && !row.categoryId && (
                              <Badge variant="outline" className="text-xs">Nueva</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${(row.costPrice || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.currentStock || 0}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => removeRow(row.rowIndex)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* Step: Importing */}
          {step === 'importing' && (
            <div className="space-y-6 py-8">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                <h4 className="text-lg font-medium mb-2">Importando productos...</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Por favor espera mientras se crean los productos
                </p>
              </div>

              <div className="max-w-md mx-auto space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Progreso</span>
                  <span>{importProgress}%</span>
                </div>
                <Progress value={importProgress} className="h-2" />
              </div>
            </div>
          )}

          {/* Step: Complete */}
          {step === 'complete' && (
            <div className="space-y-6 py-8">
              <div className="text-center">
                <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
                  importResults.failed === 0 ? 'bg-green-500/10' : 'bg-orange-500/10'
                }`}>
                  {importResults.failed === 0 ? (
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-orange-500" />
                  )}
                </div>
                <h4 className="text-lg font-medium mb-2">
                  {importResults.failed === 0 ? 'Importación completada' : 'Importación con errores'}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {importResults.success} producto(s) importado(s) correctamente
                  {importResults.failed > 0 && `, ${importResults.failed} fallaron`}
                </p>
              </div>

              {/* Results Summary */}
              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                <Card className="p-4 text-center">
                  <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold">{importResults.success}</p>
                  <p className="text-xs text-muted-foreground">Exitosos</p>
                </Card>
                <Card className="p-4 text-center">
                  <XCircle className="w-6 h-6 text-destructive mx-auto mb-2" />
                  <p className="text-2xl font-bold">{importResults.failed}</p>
                  <p className="text-xs text-muted-foreground">Fallidos</p>
                </Card>
              </div>

              {/* Error List */}
              {importResults.errors.length > 0 && (
                <Card className="bg-destructive/5 max-w-lg mx-auto">
                  <CardContent className="p-4">
                    <h5 className="font-medium text-sm mb-2">Errores:</h5>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      {importResults.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                      {importResults.errors.length > 5 && (
                        <li>... y {importResults.errors.length - 5} más</li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter className="border-t pt-4">
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={executeImport}
                disabled={validCount === 0}
              >
                <Upload className="w-4 h-4 mr-2" />
                Importar {validCount} Producto(s)
              </Button>
            </>
          )}

          {step === 'importing' && (
            <Button variant="outline" disabled>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Importando...
            </Button>
          )}

          {step === 'complete' && (
            <>
              <Button variant="outline" onClick={resetDialog}>
                Importar más
              </Button>
              <Button onClick={handleClose}>
                Cerrar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
