'use client';

import React, { useState } from 'react';
import { cn, formatNumber } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/contexts/CompanyContext';
import { Upload, FileText, CheckCircle, AlertCircle, Download, Info, Loader2 } from 'lucide-react';

interface UploadResult {
  success: boolean;
  message: string;
  results: {
    created: number;
    updated: number;
    errors: string[];
    employees: Array<{
      nombre: string;
      rol: string;
      categoria: string;
      salario_bruto: number;
    }>;
  };
}

export default function UploadPayroll() {
  const { currentCompany } = useCompany();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [templateType, setTemplateType] = useState<'employees' | 'salaries'>('employees');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !currentCompany) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Seleccionar endpoint según el tipo de plantilla
      const endpoint = templateType === 'employees' 
        ? `/api/employees/upload-payroll?companyId=${currentCompany.id}`
        : `/api/employees/upload-salary?companyId=${currentCompany.id}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
        setShowResult(true);
        setFile(null);
        // Reset file input
        const fileInput = document.getElementById('payroll-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        const errorData = await response.json();
        setResult({
          success: false,
          message: errorData.error || 'Error al procesar la planilla',
          results: { created: 0, updated: 0, errors: [errorData.error || 'Error desconocido'], employees: [] }
        });
        setShowResult(true);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setResult({
        success: false,
        message: 'Error de conexión con el servidor',
        results: { created: 0, updated: 0, errors: ['Error de conexión'], employees: [] }
      });
      setShowResult(true);
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = async () => {
    if (templateType === 'employees') {
      // Plantilla simple para empleados
      const csvContent = `nombre;rol;categoria
Juan Pérez;Operador;Operarios
María García;Supervisor;Supervisores
Carlos López;Mecánico;Técnicos`;
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'plantilla_empleados_nuevos.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // Para sueldos, obtener empleados existentes con sus últimos sueldos
      try {
        const response = await fetch(`/api/employees/export-salaries?companyId=${currentCompany?.id}`);
        if (response.ok) {
          const blob = await response.blob();
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute('download', 'plantilla_sueldos_mensuales.csv');
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } else {
          console.error('Error al obtener empleados');
        }
      } catch (error) {
        console.error('Error al descargar plantilla de sueldos:', error);
      }
    }
  };

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">Selecciona una empresa para continuar</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Cargar Planilla de Empleados</h1>
        <Badge variant="outline" className="text-sm">
          {currentCompany.name}
        </Badge>
      </div>

      {/* Selector de tipo de plantilla */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Info className="h-5 w-5" />
            <span>Tipo de Plantilla</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                className={cn('p-4 border rounded-lg cursor-pointer transition-colors',
                  templateType === 'employees'
                    ? 'border-info bg-info-muted'
                    : 'border-border hover:border-border'
                )}
                onClick={() => setTemplateType('employees')}
              >
                <h4 className="font-semibold text-lg mb-2">👥 Crear Empleados</h4>
                <p className="text-sm text-foreground mb-3">
                  Para registrar nuevos empleados (sin sueldos)
                </p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">nombre*</Badge>
                  <Badge variant="outline">rol*</Badge>
                  <Badge variant="outline">categoria*</Badge>
                </div>
              </div>
              
              <div 
                className={cn('p-4 border rounded-lg cursor-pointer transition-colors',
                  templateType === 'salaries'
                    ? 'border-success bg-success-muted'
                    : 'border-border hover:border-border'
                )}
                onClick={() => setTemplateType('salaries')}
              >
                <h4 className="font-semibold text-lg mb-2">💰 Registrar Sueldos</h4>
                <p className="text-sm text-foreground mb-3">
                  Descarga empleados existentes con sus últimos sueldos
                </p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">nombre_empleado*</Badge>
                  <Badge variant="outline">sueldo*</Badge>
                  <Badge variant="outline">mes_imputacion*</Badge>
                </div>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Descargar Plantilla {templateType === 'employees' ? 'de Empleados' : 'de Sueldos'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Información específica del tipo seleccionado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Info className="h-5 w-5" />
            <span>Instrucciones - {templateType === 'employees' ? 'Crear Empleados' : 'Registrar Sueldos'}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {templateType === 'employees' ? (
              <>
                <div className="p-3 border rounded-lg bg-warning-muted">
                  <h5 className="text-sm font-medium mb-2 text-warning-muted-foreground">⚠️ Para Crear Empleados:</h5>
                  <ul className="text-xs text-warning-muted-foreground space-y-1 list-disc list-inside">
                    <li><strong>categoria</strong> debe ser una categoría que ya existe en el sistema</li>
                    <li>Los sueldos se asignan después usando la plantilla de sueldos</li>
                    <li>Si el empleado ya existe, se actualizará con los nuevos datos</li>
                    <li>El archivo puede usar <strong>coma (,)</strong> o <strong>punto y coma (;)</strong> como separador</li>
                  </ul>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 border rounded-lg bg-success-muted">
                  <h5 className="text-sm font-medium mb-2 text-success-muted-foreground">💰 Para Registrar Sueldos:</h5>
                  <ul className="text-xs text-success-muted-foreground space-y-1 list-disc list-inside">
                    <li>La plantilla incluye <strong>todos los empleados activos</strong> con sus últimos sueldos</li>
                    <li>Modifica solo la columna <strong>sueldo</strong> según necesites</li>
                    <li>El <strong>mes_imputacion</strong> viene prellenado con el mes actual</li>
                    <li>Si un empleado no tiene sueldo previo, la columna estará vacía</li>
                    <li>Si ya existe un sueldo para ese empleado en ese mes, se actualizará</li>
                    <li>El archivo puede usar <strong>coma (,)</strong> o <strong>punto y coma (;)</strong> como separador</li>
                  </ul>
                </div>
              </>
            )}
            
            <div className="p-3 border rounded-lg bg-info-muted">
              <h5 className="text-sm font-medium mb-2 text-info-muted-foreground">💡 Consejo para abrir en Excel:</h5>
              <ul className="text-xs text-info-muted-foreground space-y-1 list-disc list-inside">
                <li>Descarga la plantilla y ábrela con <strong>Bloc de notas</strong> o <strong>WordPad</strong></li>
                <li>Guárdala con extensión <strong>.csv</strong></li>
                <li>En Excel: <strong>Datos → Obtener datos → Desde archivo → Desde texto/CSV</strong></li>
                <li>Selecciona el archivo y elige <strong>Punto y coma (;)</strong> como delimitador</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cargar archivo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Cargar Planilla</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="payroll-file">
                Seleccionar archivo CSV - {templateType === 'employees' ? 'Plantilla de Empleados' : 'Plantilla de Sueldos'}
              </Label>
              <Input
                id="payroll-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="mt-1"
              />
            </div>
            
            {file && (
              <div className="flex items-center space-x-2 p-3 border rounded-lg bg-success-muted">
                <FileText className="h-4 w-4 text-success" />
                <span className="text-sm text-success-muted-foreground">
                  Archivo seleccionado: {file.name} ({formatNumber(file.size / 1024, 1)} KB)
                </span>
              </div>
            )}

            <Button 
              onClick={handleUpload} 
              disabled={!file || uploading}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {templateType === 'employees' ? 'Cargar Empleados' : 'Cargar Sueldos'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal de resultados */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              {result?.success ? (
                <CheckCircle className="h-5 w-5 text-success" />
              ) : (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
              <span>Resultado de la Carga</span>
            </DialogTitle>
            <DialogDescription>
              {result?.message}
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 border rounded-lg bg-success-muted">
                  <div className="text-2xl font-bold text-success">
                    {result.results.created}
                  </div>
                  <div className="text-sm text-success-muted-foreground">
                    {templateType === 'employees' ? 'Empleados Creados' : 'Sueldos Registrados'}
                  </div>
                </div>
                
                <div className="text-center p-3 border rounded-lg bg-info-muted">
                  <div className="text-2xl font-bold text-info-muted-foreground">
                    {result.results.updated}
                  </div>
                  <div className="text-sm text-info-muted-foreground">
                    {templateType === 'employees' ? 'Empleados Actualizados' : 'Sueldos Actualizados'}
                  </div>
                </div>

                <div className="text-center p-3 border rounded-lg bg-destructive/10">
                  <div className="text-2xl font-bold text-destructive">
                    {result.results.errors.length}
                  </div>
                  <div className="text-sm text-destructive">Errores</div>
                </div>
              </div>

              {/* Lista de elementos procesados */}
              {result.results.employees && result.results.employees.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">
                    {templateType === 'employees' ? 'Empleados Procesados:' : 'Sueldos Procesados:'}
                  </h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {result.results.employees.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-2 border rounded text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium">{item.nombre || item.nombre_empleado}</span>
                          {templateType === 'employees' && (
                            <span className="text-xs text-muted-foreground">{item.rol}</span>
                          )}
                          {templateType === 'salaries' && (
                            <span className="text-xs text-muted-foreground">Mes: {item.mes}</span>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          {templateType === 'employees' && (
                            <Badge variant="outline">{item.categoria}</Badge>
                          )}
                          {templateType === 'salaries' && (
                            <span className="text-muted-foreground">
                              ${item.sueldo.toLocaleString('es-AR')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errores */}
              {result.results.errors.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 text-destructive">Errores encontrados:</h4>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {result.results.errors.map((error, index) => (
                      <div key={index} className="text-sm text-destructive p-2 bg-destructive/10 border border-destructive/30 rounded">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowResult(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
