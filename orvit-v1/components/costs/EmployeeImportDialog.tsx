'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCompany } from '@/contexts/CompanyContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogBody,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { 
  Upload, 
  Download, 
  Users, 
  Loader2, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

const ImportFormSchema = z.object({
  file: z.any().refine((file) => file instanceof File, 'Archivo requerido'),
});

type ImportFormInput = z.infer<typeof ImportFormSchema>;

interface ImportResult {
  success: boolean;
  totalRows: number;
  validRows: number;
  errors: Array<{
    row: number;
    error: string;
    data?: any;
  }>;
  employeesCreated: number;
  employeesUpdated: number;
  historyRecords: number;
  message?: string;
}

interface EmployeeImportDialogProps {
  children?: React.ReactNode;
  onImportCompleted?: () => void;
}

export function EmployeeImportDialog({ children, onImportCompleted }: EmployeeImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { currentCompany } = useCompany();

  const form = useForm<ImportFormInput>({
    resolver: zodResolver(ImportFormSchema),
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      form.setValue('file', file);
      setImportResult(null);
    }
  };

  const downloadTemplate = () => {
    // Crear plantilla Excel
    const template = [
      {
        documentOrCode: '12345678',
        name: 'Juan Pérez',
        role: 'Operario',
        grossSalary: 450000,
        payrollTaxes: 135000,
        effectiveFrom: '2024-01-01'
      },
      {
        documentOrCode: '87654321',
        name: 'María García',
        role: 'Supervisora',
        grossSalary: 650000,
        payrollTaxes: 195000,
        effectiveFrom: '2024-01-01'
      }
    ];

    const csvContent = [
      'documentOrCode,name,role,grossSalary,payrollTaxes,effectiveFrom',
      ...template.map(row => 
        `${row.documentOrCode},"${row.name}","${row.role}",${row.grossSalary},${row.payrollTaxes},${row.effectiveFrom}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_empleados.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onSubmit = async (data: ImportFormInput) => {
    if (!currentCompany) {
      toast.error('No hay empresa seleccionada');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setImportResult(null);

      const formData = new FormData();
      formData.append('file', data.file);

      // Simular progreso
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch(`/api/employees/import?companyId=${currentCompany.id}`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result = await response.json();
      setImportResult(result);

      if (result.success) {
        toast.success(result.message || 'Importación completada exitosamente');
        onImportCompleted?.();
      } else {
        toast.error(result.message || 'Error en la importación');
      }

    } catch (error) {
      console.error('Error importing employees:', error);
      toast.error('Error al procesar archivo');
      setImportResult({
        success: false,
        totalRows: 0,
        validRows: 0,
        errors: [{ row: 0, error: 'Error de conexión' }],
        employeesCreated: 0,
        employeesUpdated: 0,
        historyRecords: 0,
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const resetForm = () => {
    form.reset();
    setSelectedFile(null);
    setImportResult(null);
    setUploadProgress(0);
  };

  const closeDialog = () => {
    setOpen(false);
    setTimeout(resetForm, 300); // Reset after animation
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Importar Excel/CSV
          </Button>
        )}
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Users className="h-5 w-5" />
            Importar Empleados
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Cargue un archivo Excel o CSV con datos de empleados.
            Se creará automáticamente el historial de sueldos y se calcularán los porcentajes de aumento.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        <div className="space-y-6">
          {/* Plantilla */}
          <div className="p-4 bg-muted/10 rounded-lg border border-border/30">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-foreground">Formato Requerido</h4>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-3 w-3 mr-2" />
                Descargar Plantilla
              </Button>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Columnas requeridas:</strong></p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li><code>documentOrCode</code> - DNI/CUIL/Código único del empleado</li>
                <li><code>name</code> - Nombre completo</li>
                <li><code>role</code> - Cargo/Puesto</li>
                <li><code>grossSalary</code> - Salario bruto (número)</li>
                <li><code>payrollTaxes</code> - Cargas patronales (número)</li>
                <li><code>effectiveFrom</code> - Fecha efectiva (YYYY-MM-DD)</li>
              </ul>
              <div className="mt-2 p-2 bg-info-muted border border-info-muted rounded text-info-muted-foreground">
                <strong>Nota:</strong> Si el empleado ya existe, se agregará un nuevo registro de historial y se calculará el % de aumento automáticamente.
              </div>
            </div>
          </div>

          {/* Upload Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="file"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Archivo</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleFileChange}
                          className="bg-background border-input file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                        />
                        {selectedFile && (
                          <div className="mt-2 flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            <span className="text-sm text-foreground">{selectedFile.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {(selectedFile.size / 1024).toFixed(1)} KB
                            </Badge>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription className="text-muted-foreground">
                      Archivos Excel (.xlsx, .xls) o CSV. Máximo 5MB.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      Procesando archivo... {uploadProgress}%
                    </span>
                  </div>
                  <Progress value={uploadProgress} className="w-full" />
                </div>
              )}

              {/* Results */}
              {importResult && (
                <div className="space-y-3">
                  <Alert className={importResult.success ? 'border-success-muted bg-success-muted' : 'border-destructive/30 bg-destructive/10'}>
                    <div className="flex items-center gap-2">
                      {importResult.success ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                      <AlertDescription className={importResult.success ? 'text-success' : 'text-destructive'}>
                        {importResult.message || (importResult.success ? 'Importación exitosa' : 'Error en la importación')}
                      </AlertDescription>
                    </div>
                  </Alert>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Filas totales:</span>
                        <Badge variant="outline">{importResult.totalRows}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Filas válidas:</span>
                        <Badge variant="outline">{importResult.validRows}</Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Empleados nuevos:</span>
                        <Badge className="bg-success-muted text-success">{importResult.employeesCreated}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Empleados actualizados:</span>
                        <Badge className="bg-info-muted text-info-muted-foreground">{importResult.employeesUpdated}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center p-2 bg-muted/10 rounded">
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">
                        Registros de historial creados: <strong>{importResult.historyRecords}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Errores */}
                  {importResult.errors.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="font-medium text-foreground flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning-muted-foreground" />
                        Errores Encontrados ({importResult.errors.length})
                      </h5>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {importResult.errors.slice(0, 5).map((error, index) => (
                          <div key={index} className="text-xs p-2 bg-destructive/10 border border-destructive/30 rounded">
                            <span className="font-medium">Fila {error.row}:</span> {error.error}
                          </div>
                        ))}
                        {importResult.errors.length > 5 && (
                          <div className="text-xs text-muted-foreground text-center">
                            ... y {importResult.errors.length - 5} errores más
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={closeDialog}
                >
                  {importResult?.success ? 'Cerrar' : 'Cancelar'}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isUploading || !selectedFile}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar Empleados
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
          </div>
          </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
