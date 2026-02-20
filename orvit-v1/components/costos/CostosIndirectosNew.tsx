'use client';

import { useIndirectCostsNew } from '@/hooks/use-indirect-costs-new';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogBody } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CostoBaseDetailModal } from './CostoBaseDetailModal';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, X, Calendar, DollarSign, FileText, TrendingUp, BarChart3, Building2, Target, Activity, Zap, Eye, Info, BookOpen, Loader2 } from 'lucide-react';
import { NotesDialog } from '@/components/ui/NotesDialog';
import { useState } from 'react';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { toast } from 'sonner';

interface CostosIndirectosNewProps {
  companyId: string;
}

export function CostosIndirectosNew({ companyId }: CostosIndirectosNewProps) {
  const confirm = useConfirm();
  const {
    costosBase,
    registrosMensuales,
    historial,
    estadisticas,
    categorias,
    loading,
    error,
    createCostoBase,
    createRegistroMensual,
    deleteCostoBase,
    deleteRegistroMensual,
    updateCostoBase,
    refreshData
  } = useIndirectCostsNew({ companyId });

  const [showCostoBaseDialog, setShowCostoBaseDialog] = useState(false);
  const [showRegistroMensualDialog, setShowRegistroMensualDialog] = useState(false);
  const [selectedCostoBase, setSelectedCostoBase] = useState<string | null>(null);
     const [editingCosto, setEditingCosto] = useState<any>(null);
   const [showEditDialog, setShowEditDialog] = useState(false);
   const [editingRegistro, setEditingRegistro] = useState<any>(null);
   const [showEditRegistroDialog, setShowEditRegistroDialog] = useState(false);
   const [selectedCostoForDetails, setSelectedCostoForDetails] = useState<any>(null);
   const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
  const [bulkUploadFile, setBulkUploadFile] = useState<File | null>(null);
  const [bulkUploadPreview, setBulkUploadPreview] = useState<any[]>([]);
  const [bulkUploadLoading, setBulkUploadLoading] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);

  // Estados para formularios
  const [costoBaseForm, setCostoBaseForm] = useState({
    name: '',
    description: '',
    categoryId: ''
  });

  const [registroMensualForm, setRegistroMensualForm] = useState({
    costBaseId: '',
    month: new Date().toISOString().slice(0, 7), // YYYY-MM por defecto
    amount: '',
    status: 'paid', // Siempre pagado
    notes: ''
  });

     const [editForm, setEditForm] = useState({
     name: '',
     description: '',
     categoryId: ''
   });

  const [editRegistroForm, setEditRegistroForm] = useState({
    month: '',
    amount: '',
    status: 'pending',
    notes: ''
  });

  // Usar categorías reales del hook

  const handleCreateCostoBase = async () => {
    if (!costoBaseForm.name || !costoBaseForm.categoryId) return;

    const success = await createCostoBase({
      name: costoBaseForm.name,
      description: costoBaseForm.description,
      categoryId: costoBaseForm.categoryId
    });

    if (success) {
      setCostoBaseForm({ name: '', description: '', categoryId: '' });
      setShowCostoBaseDialog(false);
      // Actualizar estadísticas inmediatamente
      refreshData();
    }
  };

  const handleCreateRegistroMensual = async () => {
    if (!registroMensualForm.costBaseId || !registroMensualForm.month || !registroMensualForm.amount) return;

    const success = await createRegistroMensual({
      costBaseId: registroMensualForm.costBaseId,
      month: registroMensualForm.month,
      amount: parseFloat(registroMensualForm.amount),
      status: 'paid', // Siempre pagado
      notes: registroMensualForm.notes,
      dueDate: new Date().toISOString().split('T')[0] // Fecha de vencimiento por defecto
    });

    if (success) {
      setRegistroMensualForm({
        costBaseId: '',
        month: new Date().toISOString().slice(0, 7),
        amount: '',
        status: 'paid', // Siempre pagado
        notes: ''
      });
      setShowRegistroMensualDialog(false);
      // Actualizar estadísticas inmediatamente
      refreshData();
    }
  };

  const handleEditCosto = (costo: any) => {
    setEditingCosto(costo);
    setEditForm({
      name: costo.name,
      description: costo.description,
      categoryId: costo.categoryId
    });
    setShowEditDialog(true);
  };

     const handleUpdateCosto = async () => {
     if (!editingCosto || !editForm.name || !editForm.categoryId) return;

     const success = await updateCostoBase(editingCosto.id, {
       name: editForm.name,
       description: editForm.description,
       categoryId: editForm.categoryId
     });

     if (success) {
       setShowEditDialog(false);
       setEditingCosto(null);
       setEditForm({ name: '', description: '', categoryId: '' });
       // Actualizar datos inmediatamente
       refreshData();
     }
   };

   const handleEditRegistro = (registro: any) => {
     setEditingRegistro(registro);
    setEditRegistroForm({
      month: registro.month,
      amount: registro.amount.toString(),
      status: registro.status,
      notes: registro.notes || ''
    });
     setShowEditRegistroDialog(true);
   };

   const handleUpdateRegistro = async () => {
     if (!editingRegistro || !editRegistroForm.month || !editRegistroForm.amount) return;

     try {
       const response = await fetch(`/api/costos-indirectos/registros-mensuales/${editingRegistro.id}`, {
         method: 'PUT',
         headers: {
           'Content-Type': 'application/json',
         },
        body: JSON.stringify({
          fecha_imputacion: editRegistroForm.month,
          amount: parseFloat(editRegistroForm.amount),
          status: editRegistroForm.status,
          notes: editRegistroForm.notes || null,
          companyId
        })
       });

       if (response.ok) {
         setShowEditRegistroDialog(false);
         setEditingRegistro(null);
        setEditRegistroForm({
          month: '',
          amount: '',
          status: 'pending',
          notes: ''
        });
         refreshData();
       } else {
         const errorData = await response.json();
         toast.error(`Error al actualizar: ${errorData.error || 'Error desconocido'}`);
       }
     } catch (error) {
       console.error('Error al actualizar registro:', error);
       toast.error('Error al actualizar el registro');
     }
   };

  const handleDeleteCostoBase = async (costId: string) => {
    const ok = await confirm({
      title: 'Eliminar costo',
      description: '¿Estás seguro de que quieres eliminar este costo?',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    const success = await deleteCostoBase(costId);
    if (success) {
      // Actualizar datos inmediatamente
      refreshData();
    }
  };

  const handleDeleteRegistroMensual = async (recordId: string) => {
    const ok = await confirm({
      title: 'Eliminar registro mensual',
      description: '¿Estás seguro de que quieres eliminar este registro mensual?',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    const success = await deleteRegistroMensual(recordId);
    if (success) {
      // Actualizar datos inmediatamente
      refreshData();
    }
  };


  const handleViewDetails = (costo: any) => {
    setSelectedCostoForDetails(costo);
    setShowDetailsDialog(true);
  };

  const handleDownloadTemplate = () => {
    // Crear CSV template limpio solo con nombres de costos base
    const headers = [
      'nombre_costo',
      'mes',
      'monto',
      'notas'
    ];
    
    // Generar datos limpios usando solo los nombres de costos base
    let sampleData: string[][] = [];
    
    if (costosBase.length > 0) {
      // Usar costos base existentes - solo nombres, campos vacíos
      costosBase.forEach((costo) => {
        sampleData.push([
          costo.name || 'Sin nombre',
          '2025-08', // Ejemplo de formato de mes
          '', // Campo vacío para que el usuario ingrese el monto
          '' // Campo vacío para notas opcionales
        ]);
      });
    } else {
      // Datos de ejemplo si no hay costos en la base
      sampleData = [
        ['F-931', '2025-08', '', ''],
        ['Marketing', '2025-08', '', ''],
        ['Combustible', '2025-08', '', '']
      ];
    }
    
    // Crear contenido CSV con formato correcto usando punto y coma como separador
    let csvContent = '';
    
    // Agregar encabezados
    csvContent += headers.join(';') + '\n';
    
    // Agregar datos
    sampleData.forEach(row => {
      csvContent += row.join(';') + '\n';
    });
    
    // Crear y descargar el archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `plantilla_registros_mensuales_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    }).format(amount);
  };

     // Función para obtener estadísticas específicas de un costo
   const getCostoStats = (costoId: string) => {
     // Buscar el costo base en los datos de la API
     const costoBase = costosBase.find(c => c.id === costoId);
     const registrosDelCosto = registrosMensuales.filter(r => r.costBaseId === costoId);
     const historialDelCosto = historial.filter(h => h.costBaseId === costoId);
     
    // Usar datos de la API de costos base si están disponibles
    if (costoBase && costoBase.lastMonth && (costoBase.totalAmount > 0)) {
      // Buscar el último registro real para obtener el estado correcto
      const ultimoRegistroReal = registrosDelCosto.length > 0 
        ? registrosDelCosto.sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())[0]
        : null;
      
      // Usar totalAmount
      const ultimoMonto = Number(costoBase.totalAmount);
       
       return {
         totalAmount: ultimoMonto, // Solo el último monto, no la suma
         promedioMensual: ultimoMonto,
         totalRegistros: Number(costoBase.totalRecords),
         registrosPagados: registrosDelCosto.filter(r => r.status === 'paid').length,
         registrosPendientes: registrosDelCosto.filter(r => r.status === 'pending').length,
         historialEntries: historialDelCosto.length,
         ultimoRegistro: {
           month: costoBase.lastMonth,
           amount: ultimoMonto,
           status: ultimoRegistroReal?.status || 'paid'
         }
       };
     }
     
     // Fallback: calcular desde registros mensuales si no hay datos de la API
     const ultimoRegistro = registrosDelCosto.length > 0 
       ? registrosDelCosto.sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())[0]
       : null;
     
     const ultimoAmount = ultimoRegistro ? Number(ultimoRegistro.amount) : 0;
     const registrosPagados = registrosDelCosto.filter(r => r.status === 'paid').length;
     const registrosPendientes = registrosDelCosto.filter(r => r.status === 'pending').length;
     
     return {
       totalAmount: ultimoAmount,
       promedioMensual: ultimoAmount,
       totalRegistros: registrosDelCosto.length,
       registrosPagados,
       registrosPendientes,
       historialEntries: historialDelCosto.length,
       ultimoRegistro
     };
   };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setBulkUploadFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          const csv = e.target.result as string;
          const lines = csv.split('\n');
          const headers = lines[0].split(',');
          const data: any[] = [];
          for (let i = 1; i < lines.length; i++) {
            const row: { [key: string]: string } = {};
            const values = lines[i].split(',');
            for (let j = 0; j < headers.length; j++) {
              row[headers[j].trim()] = values[j]?.trim() || '';
            }
            data.push(row);
          }
          setBulkUploadPreview(data);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkUploadFile) return;

    setBulkUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', bulkUploadFile);
      formData.append('companyId', companyId);

      const response = await fetch('/api/costos/indirectos/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (result.success) {
        const message = result.errors && result.errors.length > 0 
          ? `Costos cargados exitosamente!\n\nRegistros procesados: ${result.results.length}\nErrores: ${result.errors.length}\n\nErrores:\n${result.errors.join('\n')}`
          : 'Costos mensuales cargados exitosamente!';
        
        toast.success(message);
        
        // Forzar actualización completa de datos
        await refreshData();
        
        setShowBulkUploadDialog(false);
        setBulkUploadFile(null);
        setBulkUploadPreview([]);
      } else {
        toast.error(`Error al cargar los costos: ${result.message || 'Desconocido'}`);
      }
    } catch (error) {
      console.error('Error al cargar masivamente:', error);
      toast.error('Error al cargar los costos masivamente. Verifica la consola.');
    } finally {
      setBulkUploadLoading(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center p-8">
      <Loader2 className="h-8 w-8 animate-spin text-foreground" />
    </div>
  );
  
  if (error) return (
    <div className="text-destructive p-4">Error: {error}</div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Costos Indirectos
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión de costos recurrentes con registros mensuales
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCostoBaseDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Costo
          </Button>
          <Button onClick={handleDownloadTemplate} variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Plantilla
          </Button>
          <Button onClick={() => setShowBulkUploadDialog(true)} variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Carga Masiva
          </Button>
          <Button onClick={() => setShowNotesDialog(true)} variant="outline" size="sm" className="text-warning-muted-foreground hover:text-warning-muted-foreground hover:bg-warning-muted">
            <BookOpen className="h-4 w-4 mr-2" />
            Notas
          </Button>
        </div>
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Costos Base</CardTitle>
            <Building2 className="h-4 w-4 text-info-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{costosBase.length}</div>
            <p className="text-xs text-muted-foreground">
              Costos recurrentes configurados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Registros</CardTitle>
            <FileText className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{registrosMensuales.length}</div>
            <p className="text-xs text-muted-foreground">
              Registros mensuales totales
            </p>
          </CardContent>
        </Card>

                 <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Total General</CardTitle>
             <DollarSign className="h-4 w-4 text-success" />
           </CardHeader>
           <CardContent>
             <div className="text-2xl font-bold">
               {formatCurrency(
                 costosBase.reduce((total, costo) => {
                   const registrosDelCosto = registrosMensuales.filter(r => r.costBaseId === costo.id);
                   
                   if (registrosDelCosto.length > 0) {
                     // Ordenar por mes y tomar el más reciente
                     const registrosOrdenados = registrosDelCosto.sort((a, b) => 
                       new Date(b.month).getTime() - new Date(a.month).getTime()
                     );
                     const ultimoRegistro = registrosOrdenados[0];
                     
                     // Convertir a número antes de sumar
                     return total + Number(ultimoRegistro.amount);
                   }
                   return total;
                 }, 0)
               )}
             </div>
             <p className="text-xs text-muted-foreground">
               Suma del último precio de cada costo
             </p>
           </CardContent>
         </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorías</CardTitle>
            <Target className="h-4 w-4 text-info-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categorias.length}</div>
            <p className="text-xs text-muted-foreground">
              Tipos de costos disponibles
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="costos" className="w-full">
        <TabsList className="w-full sm:w-fit bg-muted/40 border border-border rounded-md p-1 h-auto flex flex-wrap gap-1">
          <TabsTrigger value="costos" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">Costos Base</TabsTrigger>
          <TabsTrigger value="registros" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">Registros Mensuales</TabsTrigger>
          <TabsTrigger value="historial" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">Historial</TabsTrigger>
          <TabsTrigger value="estadisticas" className="text-xs font-normal h-7 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">Estadísticas</TabsTrigger>
        </TabsList>

        {/* Tab: Costos Base */}
        <TabsContent value="costos" className="space-y-4">
          <div className="grid gap-4">
            {costosBase.map((costo) => {
              const stats = getCostoStats(costo.id);
              return (
                <Card key={costo.id} className="group relative">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-info-muted rounded-lg flex items-center justify-center">
                          <FileText className="h-6 w-6 text-info-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-medium text-base">{costo.name}</h3>
                          <p className="text-sm text-muted-foreground">{costo.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary">{costo.categoryName}</Badge>
                            <Badge variant="outline">
                              {costo.categoryType === 'fixed' ? 'Fijo' : 
                               costo.categoryType === 'variable' ? 'Variable' : 
                               costo.categoryType}
                            </Badge>
                          </div>
                                                     {stats.ultimoRegistro && (
                             <div className="mt-2 p-2 bg-muted rounded-md">
                               <p className="text-xs text-muted-foreground font-medium">Último registro:</p>
                               <p className="text-sm text-foreground">
                                 {stats.ultimoRegistro.month} • {formatCurrency(stats.ultimoRegistro.amount)}
                                 {stats.ultimoRegistro.status === 'paid' ? (
                                   <Badge variant="default" className="ml-2 text-xs">Pagado</Badge>
                                 ) : (
                                   <Badge variant="destructive" className="ml-2 text-xs">Pendiente</Badge>
                                 )}
                               </p>
                             </div>
                           )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(costo)}
                          className="bg-info-muted hover:bg-info-muted text-info-muted-foreground border-info-muted"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver Detalles
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedCostoBase(costo.id);
                            setShowRegistroMensualDialog(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Registrar Mes
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditCosto(costo)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteCostoBase(costo.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab: Registros Mensuales */}
        <TabsContent value="registros" className="space-y-4">
          <div className="grid gap-4">
            {registrosMensuales.map((registro) => (
              <Card key={registro.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-success-muted rounded-lg flex items-center justify-center">
                        <Calendar className="h-6 w-6 text-success" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{registro.costName}</h3>
                        <p className="text-sm text-muted-foreground">{registro.month}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary">{registro.categoryName}</Badge>
                          <Badge variant={registro.status === 'paid' ? 'default' : 'destructive'}>
                            {registro.status === 'paid' ? 'Pagado' : 'Pendiente'}
                          </Badge>
                        </div>
                        <p className="text-lg font-semibold text-success mt-1">
                          {formatCurrency(registro.amount)}
                        </p>
                      </div>
                    </div>
                                         <div className="flex items-center gap-2">
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => handleEditRegistro(registro)}
                       >
                         <Edit className="h-4 w-4 mr-1" />
                         Editar
                       </Button>
                       <Button
                         variant="outline"
                         size="sm"
                         className="text-destructive hover:text-destructive hover:bg-destructive/10"
                         onClick={() => handleDeleteRegistroMensual(registro.id)}
                       >
                         <Trash2 className="h-4 w-4 mr-1" />
                         Eliminar
                       </Button>
                     </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab: Historial */}
        <TabsContent value="historial" className="space-y-4">
          <div className="grid gap-4">
            {historial.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-info-muted rounded-lg flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-info-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{entry.costName}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{entry.reason}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <Badge variant="secondary" className="text-xs">
                            {entry.changeType === 'created' ? 'Creado' : 
                             entry.changeType === 'updated' ? 'Actualizado' : 
                             entry.changeType === 'deleted' ? 'Eliminado' : 
                             entry.changeType === 'monthly_record_created' ? 'Registro Mensual Creado' :
                             entry.changeType === 'monthly_record_updated' ? 'Registro Mensual Actualizado' :
                             entry.changeType === 'monthly_record_deleted' ? 'Registro Mensual Eliminado' :
                             entry.changeType}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{entry.categoryName}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {new Date(entry.createdAt).toLocaleDateString('es-AR', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })} • {new Date(entry.createdAt).toLocaleTimeString('es-AR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab: Estadísticas */}
        <TabsContent value="estadisticas" className="space-y-6">
          {estadisticas && (
            <>
              {/* Resumen General */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Resumen General
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-info-muted-foreground">{estadisticas.general.totalCostosBase}</p>
                      <p className="text-sm text-muted-foreground">Costos Base</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-success">{estadisticas.general.totalRegistrosMensuales}</p>
                      <p className="text-sm text-muted-foreground">Registros</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-info-muted-foreground">{formatCurrency(estadisticas.general.totalGeneral)}</p>
                      <p className="text-sm text-muted-foreground">Total General</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-warning-muted-foreground">{estadisticas.general.totalCategorias}</p>
                      <p className="text-sm text-muted-foreground">Categorías</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Distribución por Categoría */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribución por Categoría</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {estadisticas.distribucionPorCategoria.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium">{cat.name}</p>
                          <p className="text-sm text-muted-foreground">{cat.type}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(cat.totalAmount)}</p>
                          <p className="text-sm text-muted-foreground">{cat.porcentaje.toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: Crear Costo Base */}
      <Dialog open={showCostoBaseDialog} onOpenChange={setShowCostoBaseDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Costo Base</DialogTitle>
          </DialogHeader>
          <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nombre</label>
              <Input
                value={costoBaseForm.name}
                onChange={(e) => setCostoBaseForm({ ...costoBaseForm, name: e.target.value })}
                placeholder="Ej: F-931"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Descripción</label>
              <Textarea
                value={costoBaseForm.description}
                onChange={(e) => setCostoBaseForm({ ...costoBaseForm, description: e.target.value })}
                placeholder="Descripción del costo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Categoría</label>
              <Select value={costoBaseForm.categoryId} onValueChange={(value) => setCostoBaseForm({ ...costoBaseForm, categoryId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateCostoBase} className="flex-1">Crear</Button>
              <Button variant="outline" onClick={() => setShowCostoBaseDialog(false)}>Cancelar</Button>
            </div>
          </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Dialog: Crear Registro Mensual */}
      <Dialog open={showRegistroMensualDialog} onOpenChange={setShowRegistroMensualDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Registrar Costo Mensual</DialogTitle>
          </DialogHeader>
          <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Costo Base</label>
              <Select 
                value={registroMensualForm.costBaseId} 
                onValueChange={(value) => setRegistroMensualForm({ ...registroMensualForm, costBaseId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar costo base" />
                </SelectTrigger>
                <SelectContent>
                  {costosBase.map((costo) => (
                    <SelectItem key={costo.id} value={costo.id}>
                      {costo.name} - {costo.categoryName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Mes de Imputación</label>
              <Select 
                value={registroMensualForm.month}
                onValueChange={(value) => setRegistroMensualForm({ ...registroMensualForm, month: value })}
              >
                <SelectTrigger>
                  <SelectValue>
                    {(() => {
                      if (!registroMensualForm.month) return 'Seleccionar mes';
                      const [year, month] = registroMensualForm.month.split('-');
                      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                      return date.toLocaleDateString('es-AR', { year: 'numeric', month: 'long' });
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => {
                    const monthNum = String(i + 1).padStart(2, '0');
                    const monthValue = `2025-${monthNum}`;
                    const date = new Date(2025, i, 1);
                    const monthName = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
                    return (
                      <SelectItem key={monthValue} value={monthValue}>
                        {monthName}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Monto</label>
              <Input
                type="number"
                value={registroMensualForm.amount}
                onChange={(e) => setRegistroMensualForm({ ...registroMensualForm, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Notas</label>
              <Textarea
                value={registroMensualForm.notes}
                onChange={(e) => setRegistroMensualForm({ ...registroMensualForm, notes: e.target.value })}
                placeholder="Notas adicionales"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateRegistroMensual} className="flex-1">Registrar</Button>
              <Button variant="outline" onClick={() => setShowRegistroMensualDialog(false)}>Cancelar</Button>
            </div>
          </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Costo */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Editar Costo Base</DialogTitle>
          </DialogHeader>
          <DialogBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nombre</label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Ej: F-931"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Descripción</label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Descripción del costo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Categoría</label>
              <Select value={editForm.categoryId} onValueChange={(value) => setEditForm({ ...editForm, categoryId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleUpdateCosto} className="flex-1">Actualizar</Button>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            </div>
          </div>
          </DialogBody>
        </DialogContent>
      </Dialog>


      {/* Dialog: Carga Masiva */}
      <Dialog open={showBulkUploadDialog} onOpenChange={setShowBulkUploadDialog}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-info-muted-foreground" />
              Carga Masiva de Registros Mensuales
            </DialogTitle>
          </DialogHeader>

          <DialogBody>
          <div className="space-y-6">
            {/* Instrucciones */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Instrucciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-info-muted rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-info-muted-foreground text-sm font-bold">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Descarga la plantilla CSV</p>
                    <p className="text-sm text-muted-foreground">Usa el botón &quot;Descargar Plantilla&quot; para obtener el formato correcto</p>
                  </div>
                </div>
                                 <div className="flex items-start gap-3">
                   <div className="w-6 h-6 bg-info-muted rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                     <span className="text-info-muted-foreground text-sm font-bold">2</span>
                   </div>
                                     <div>
                    <p className="font-medium">Llena la planilla</p>
                    <p className="text-sm text-muted-foreground">Completa con tus datos: nombre del costo base existente, mes, monto y notas. Solo crea registros mensuales de costos que ya existen</p>
                  </div>
                 </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-info-muted rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-info-muted-foreground text-sm font-bold">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Sube la planilla</p>
                    <p className="text-sm text-muted-foreground">Selecciona el archivo CSV y revisa la vista previa antes de confirmar</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Formato de la plantilla */}
            <Card>
              <CardHeader>
                <CardTitle>Formato de la Plantilla</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-border">
                                         <thead>
                       <tr className="bg-muted">
                         <th className="border border-border px-3 py-2 text-left text-sm font-medium">Columna</th>
                         <th className="border border-border px-3 py-2 text-left text-sm font-medium">Descripción</th>
                         <th className="border border-border px-3 py-2 text-left text-sm font-medium">Ejemplo</th>
                         <th className="border border-border px-3 py-2 text-left text-sm font-medium">Requerido</th>
                       </tr>
                     </thead>
                     <tbody>
                       <tr>
                         <td className="border border-border px-3 py-2 text-sm font-mono">nombre_costo</td>
                         <td className="border border-border px-3 py-2 text-sm">Nombre del costo base existente</td>
                         <td className="border border-border px-3 py-2 text-sm font-mono">F-931</td>
                         <td className="border border-border px-3 py-2 text-sm text-destructive font-medium">Sí</td>
                       </tr>
                       <tr>
                         <td className="border border-border px-3 py-2 text-sm font-mono">month</td>
                         <td className="border border-border px-3 py-2 text-sm">Mes de imputación en formato YYYY-MM</td>
                         <td className="border border-border px-3 py-2 text-sm font-mono">2025-01</td>
                         <td className="border border-border px-3 py-2 text-sm text-destructive font-medium">Sí</td>
                       </tr>
                       <tr>
                         <td className="border border-border px-3 py-2 text-sm font-mono">monto</td>
                         <td className="border border-border px-3 py-2 text-sm">Monto del costo (sin puntos ni comas)</td>
                         <td className="border border-border px-3 py-2 text-sm font-mono">1500000</td>
                         <td className="border border-border px-3 py-2 text-sm text-destructive font-medium">Sí</td>
                       </tr>
                       <tr>
                         <td className="border border-border px-3 py-2 text-sm font-mono">notas</td>
                         <td className="border border-border px-3 py-2 text-sm">Notas adicionales</td>
                         <td className="border border-border px-3 py-2 text-sm font-mono">Enero 2025</td>
                         <td className="border border-border px-3 py-2 text-sm text-muted-foreground">No</td>
                       </tr>
                     </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Subir archivo */}
            <Card>
              <CardHeader>
                <CardTitle>Subir Planilla</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Seleccionar archivo CSV</label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-info-muted file:text-info-muted-foreground hover:file:bg-info-muted"
                    />
                  </div>
                  
                  {bulkUploadFile && (
                    <div className="p-3 bg-success-muted border border-success-muted rounded-lg">
                      <p className="text-sm text-success">
                        <strong>Archivo seleccionado:</strong> {bulkUploadFile.name}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Vista previa */}
            {bulkUploadPreview.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Vista Previa ({bulkUploadPreview.length} registros)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-border">
                                           <thead>
                       <tr className="bg-muted">
                         <th className="border border-border px-3 py-2 text-left text-sm font-medium">Nombre Costo</th>
                         <th className="border border-border px-3 py-2 text-left text-sm font-medium">Mes de Imputación</th>
                         <th className="border border-border px-3 py-2 text-left text-sm font-medium">Monto</th>
                         <th className="border border-border px-3 py-2 text-left text-sm font-medium">Notas</th>
                       </tr>
                     </thead>
                     <tbody>
                       {bulkUploadPreview.slice(0, 5).map((row, index) => (
                         <tr key={index}>
                           <td className="border border-border px-3 py-2 text-sm">{row.nombre_costo}</td>
                           <td className="border border-border px-3 py-2 text-sm font-mono">{row.mes}</td>
                           <td className="border border-border px-3 py-2 text-sm font-mono">{row.monto}</td>
                           <td className="border border-border px-3 py-2 text-sm">{row.notas || '-'}</td>
                         </tr>
                       ))}
                       {bulkUploadPreview.length > 5 && (
                         <tr>
                           <td colSpan={4} className="border border-border px-3 py-2 text-sm text-center text-muted-foreground">
                             ... y {bulkUploadPreview.length - 5} registros más
                           </td>
                         </tr>
                       )}
                     </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Botones de acción */}
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowBulkUploadDialog(false)}
              >
                Cancelar
              </Button>
              {bulkUploadPreview.length > 0 && (
                <Button
                  onClick={handleBulkUpload}
                  disabled={bulkUploadLoading}
                  className="bg-info hover:bg-info/90"
                >
                  {bulkUploadLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Procesar {bulkUploadPreview.length} registros
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
          </DialogBody>
                 </DialogContent>
       </Dialog>

       {/* Dialog: Editar Registro Mensual */}
       <Dialog open={showEditRegistroDialog} onOpenChange={setShowEditRegistroDialog}>
         <DialogContent size="sm">
           <DialogHeader>
             <DialogTitle>Editar Registro Mensual</DialogTitle>
           </DialogHeader>
           <DialogBody>
           <div className="space-y-4">
             <div>
               <label className="block text-sm font-medium mb-2">Mes de Imputación</label>
               <Input
                 type="month"
                 value={editRegistroForm.month}
                 onChange={(e) => setEditRegistroForm({ ...editRegistroForm, month: e.target.value })}
               />
             </div>
             <div>
               <label className="block text-sm font-medium mb-2">Monto</label>
               <Input
                 type="number"
                 value={editRegistroForm.amount}
                 onChange={(e) => setEditRegistroForm({ ...editRegistroForm, amount: e.target.value })}
                 placeholder="0.00"
               />
             </div>
             <div>
               <label className="block text-sm font-medium mb-2">Estado</label>
               <Select value={editRegistroForm.status} onValueChange={(value) => setEditRegistroForm({ ...editRegistroForm, status: value })}>
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="pending">Pendiente</SelectItem>
                   <SelectItem value="paid">Pagado</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <div>
               <label className="block text-sm font-medium mb-2">Notas</label>
               <Textarea
                 value={editRegistroForm.notes}
                 onChange={(e) => setEditRegistroForm({ ...editRegistroForm, notes: e.target.value })}
                 placeholder="Notas adicionales"
               />
             </div>
             <div className="flex gap-2">
               <Button onClick={handleUpdateRegistro} className="flex-1">Actualizar</Button>
               <Button variant="outline" onClick={() => setShowEditRegistroDialog(false)}>Cancelar</Button>
             </div>
           </div>
           </DialogBody>
         </DialogContent>
       </Dialog>

       {/* Modal: Detalles del Costo con Gráficos */}
       {selectedCostoForDetails && (
         <CostoBaseDetailModal
           isOpen={showDetailsDialog}
           onClose={() => setShowDetailsDialog(false)}
           costo={selectedCostoForDetails}
           monthlyRecords={registrosMensuales
            .filter(r => r.costBaseId === selectedCostoForDetails.id)
            .map(r => ({
              id: r.id,
              month: r.month,
              amount: r.amount,
              status: r.status as 'paid' | 'pending',
              createdAt: r.createdAt
            }))}
        />
      )}

      {/* Dialog: Notas */}
      <NotesDialog
        open={showNotesDialog}
        onOpenChange={setShowNotesDialog}
        moduleName="Costos Indirectos"
        storageKey="costos_indirectos_notes"
      />
    </div>
  );
}
