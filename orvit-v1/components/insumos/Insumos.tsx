'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInsumos, Supplier, Supply, SupplyPrice, SupplyHistory } from '@/hooks/use-insumos';
import { SupplyPriceDetailModal } from './SupplyPriceDetailModal';
import { Plus, Edit, Trash2, Eye, Package, Tag, DollarSign, TrendingUp, TrendingDown, AlertTriangle, Power, PowerOff, Calendar, Building2, Upload, Download, BarChart3, Activity, Minus, BookOpen, Loader2 } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';
import { toast } from 'sonner';

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Insumos() {
  const confirm = useConfirm();
  const {
    suppliers,
    supplies,
    prices,
    history,
    loading,
    error,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    createSupply,
    updateSupply,
    deleteSupply,
    registerPrice,
    updatePrice,
    bulkUploadPrices,
    fetchHistory,
    refreshData,
  } = useInsumos();

  // Estados para proveedores
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: ''
  });

    // Estados para insumos
  const [showSupplyDialog, setShowSupplyDialog] = useState(false);
  const [editingSupply, setEditingSupply] = useState<Supply | null>(null);
      const [supplyForm, setSupplyForm] = useState({
      name: '',
      unitMeasure: 'TN',
      supplierId: '0'
    });

  // Estados para precios
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  const [editingPrice, setEditingPrice] = useState<SupplyPrice | null>(null);
  const [priceForm, setPriceForm] = useState({
    supplyId: '',
    fecha_imputacion: new Date().toISOString().slice(0, 7), // YYYY-MM por defecto
    pricePerUnit: '',
    freightCost: '',
    notes: ''
  });

  // Estados para filtros
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [selectedSupply, setSelectedSupply] = useState<Supply | null>(null);
  const [showPricesDialog, setShowPricesDialog] = useState(false);
  const [supplyPrices, setSupplyPrices] = useState<SupplyPrice[]>([]);
  
  // Estados para modal de detalles de precios
  const [showPriceDetailModal, setShowPriceDetailModal] = useState(false);
  const [selectedSupplyForDetails, setSelectedSupplyForDetails] = useState<Supply | null>(null);

  // Estados para carga masiva
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<any>(null);

  // Estados para notas de insumos
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [notesContent, setNotesContent] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Función para crear proveedor
  const handleCreateSupplier = async () => {
    if (!supplierForm.name.trim()) return;

    try {
      await createSupplier({
        name: supplierForm.name.trim(),
        contactPerson: supplierForm.contactPerson.trim() || undefined,
        phone: supplierForm.phone.trim() || undefined,
        email: supplierForm.email.trim() || undefined,
        address: supplierForm.address.trim() || undefined
      });
      
      setSupplierForm({
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: ''
      });
      setShowSupplierDialog(false);
      // Los datos se refrescan automáticamente en el hook
    } catch (error) {
      toast.error(`Error al crear proveedor: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

      // Función para crear insumo
  const handleCreateSupply = async () => {
    if (!supplyForm.name || !supplyForm.unitMeasure) {
      toast.warning('Nombre y unidad de medida son requeridos');
      return;
    }

    try {
      if (editingSupply) {
        // Actualizar insumo existente
        await updateSupply(editingSupply.id, {
          name: supplyForm.name.trim(),
          unitMeasure: supplyForm.unitMeasure,
          supplierId: supplyForm.supplierId && supplyForm.supplierId !== "0" ? parseInt(supplyForm.supplierId) : undefined,
          isActive: editingSupply.isActive
        });
      } else {
        // Crear nuevo insumo
        await createSupply({
          name: supplyForm.name.trim(),
          unitMeasure: supplyForm.unitMeasure,
          supplierId: supplyForm.supplierId && supplyForm.supplierId !== "0" ? parseInt(supplyForm.supplierId) : undefined
        });
      }
      
      setSupplyForm({
        name: '',
        unitMeasure: 'TN',
        supplierId: '0'
      });
      setEditingSupply(null);
      setShowSupplyDialog(false);
      // Los datos se refrescan automáticamente en el hook
    } catch (error) {
      toast.error(`Error al ${editingSupply ? 'actualizar' : 'crear'} insumo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  // Función para editar insumo
  const handleEditSupply = (supply: Supply) => {
    setEditingSupply(supply);
    setSupplyForm({
      name: supply.name,
      unitMeasure: supply.unitMeasure,
      supplierId: supply.supplierId ? supply.supplierId.toString() : '0'
    });
    setShowSupplyDialog(true);
  };

  // Función para eliminar insumo
  const handleDeleteSupply = async (supplyId: number) => {
    const ok = await confirm({
      title: 'Eliminar insumo',
      description: '¿Estás seguro de que quieres eliminar este insumo? ADVERTENCIA: Se eliminarán TODOS los precios registrados y el historial asociado.',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await deleteSupply(supplyId);
      // Si llega aquí, la eliminación fue exitosa
      toast.success('Insumo eliminado exitosamente con todos sus precios e historial');
      // Los datos se refrescan automáticamente en el hook
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      toast.error(`Error al eliminar insumo: ${errorMessage}`);
    }
  };

  // Función para generar datos del gráfico de precios
  const generatePriceChartData = (priceList: SupplyPrice[]) => {
    if (priceList.length < 2) {
      return null;
    }

    // Ordenar precios por fecha
    const sortedPrices = [...priceList].sort((a, b) => 
      new Date(a.monthYear).getTime() - new Date(b.monthYear).getTime()
    );

    const labels = sortedPrices.map(price => {
      const date = new Date(price.monthYear);
      return date.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
    });

    const prices = sortedPrices.map(price => price.pricePerUnit);

    // Calcular colores de los puntos basados en cambios
    const pointColors = [];
    const pointBorderColors = [];
    
    for (let i = 0; i < sortedPrices.length; i++) {
      if (i === 0) {
        // Primer punto en azul
        pointColors.push('rgba(59, 130, 246, 0.8)');
        pointBorderColors.push('rgba(59, 130, 246, 1)');
      } else {
        const current = sortedPrices[i].pricePerUnit;
        const previous = sortedPrices[i - 1].pricePerUnit;
        const change = current - previous;
        
        if (change > 0) {
          // Aumento - verde
          pointColors.push('rgba(34, 197, 94, 0.8)');
          pointBorderColors.push('rgba(34, 197, 94, 1)');
        } else if (change < 0) {
          // Disminución - rojo
          pointColors.push('rgba(239, 68, 68, 0.8)');
          pointBorderColors.push('rgba(239, 68, 68, 1)');
        } else {
          // Sin cambio - gris
          pointColors.push('rgba(107, 114, 128, 0.8)');
          pointBorderColors.push('rgba(107, 114, 128, 1)');
        }
      }
    }

    return {
      labels,
      datasets: [
        {
          label: 'Precio por Unidad',
          data: prices,
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          pointBackgroundColor: pointColors,
          pointBorderColor: pointBorderColors,
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
          fill: true,
          tension: 0.4,
        }
      ]
    };
  };

  // Función para calcular estadísticas de tendencias de precios
  const calculatePriceTrends = (priceList: SupplyPrice[]) => {
    if (priceList.length < 2) {
      return {
        hasTrend: false,
        message: 'Se necesitan al menos 2 precios para calcular tendencias'
      };
    }

    // Ordenar precios por fecha
    const sortedPrices = [...priceList].sort((a, b) => 
      new Date(a.monthYear).getTime() - new Date(b.monthYear).getTime()
    );

    const trends = [];
    let totalIncrease = 0;
    let totalDecrease = 0;
    let stableCount = 0;

    for (let i = 1; i < sortedPrices.length; i++) {
      const current = sortedPrices[i];
      const previous = sortedPrices[i - 1];
      
      const difference = current.pricePerUnit - previous.pricePerUnit;
      const percentageChange = (difference / previous.pricePerUnit) * 100;
      
      const trend = {
        month: current.monthYear,
        previousPrice: previous.pricePerUnit,
        currentPrice: current.pricePerUnit,
        difference: difference,
        percentageChange: percentageChange,
        type: difference > 0 ? 'increase' : difference < 0 ? 'decrease' : 'stable'
      };

      trends.push(trend);

      if (difference > 0) {
        totalIncrease += difference;
      } else if (difference < 0) {
        totalDecrease += Math.abs(difference);
      } else {
        stableCount++;
      }
    }

    // Calcular estadísticas generales
    const firstPrice = sortedPrices[0].pricePerUnit;
    const lastPrice = sortedPrices[sortedPrices.length - 1].pricePerUnit;
    const totalChange = lastPrice - firstPrice;
    const totalPercentageChange = (totalChange / firstPrice) * 100;

    // Determinar tendencia general
    let generalTrend = 'stable';
    if (totalPercentageChange > 5) {
      generalTrend = 'increasing';
    } else if (totalPercentageChange < -5) {
      generalTrend = 'decreasing';
    }

    return {
      hasTrend: true,
      trends,
      generalTrend,
      totalChange,
      totalPercentageChange,
      totalIncrease,
      totalDecrease,
      stableCount,
      firstPrice,
      lastPrice,
      priceCount: sortedPrices.length
    };
  };

  // Opciones del gráfico
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const value = context.parsed.y;
            const formattedValue = new Intl.NumberFormat('es-AR', {
              style: 'currency',
              currency: 'ARS',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(value);
            
            // Calcular cambio porcentual si no es el primer punto
            if (context.dataIndex > 0) {
              const previousValue = context.dataset.data[context.dataIndex - 1];
              const change = value - previousValue;
              const percentageChange = (change / previousValue) * 100;
              
              return [
                `Precio: ${formattedValue}`,
                `Cambio: ${change >= 0 ? '+' : ''}${percentageChange.toFixed(1)}%`
              ];
            }
            
            return `Precio: ${formattedValue}`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Mes'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Precio ($)'
        },
        ticks: {
          callback: function(value: any) {
            return new Intl.NumberFormat('es-AR', {
              style: 'currency',
              currency: 'ARS',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            }).format(value);
          }
        }
      }
    }
  };

  // Función para ver precios de un insumo - ahora abre el análisis completo
  const handleViewPrices = async (supply: Supply) => {
    setSelectedSupplyForDetails(supply);
    
    // Cargar historial ANTES de abrir el modal
    await fetchHistory(supply.id);
    
    // Esperar un momento para que los datos se actualicen
    setTimeout(() => {
      setShowPriceDetailModal(true);
    }, 100);
  };


  // Función para editar precio
  const handleEditPrice = (price: SupplyPrice) => {
    setEditingPrice(price);
    
    // Usar fecha_imputacion directamente
    setPriceForm({
      supplyId: price.supplyId.toString(),
      fecha_imputacion: price.fecha_imputacion || new Date().toISOString().slice(0, 7),
      pricePerUnit: price.pricePerUnit.toString(),
      freightCost: (price as any).freightCost?.toString() || '0',
      notes: price.notes || ''
    });
    setShowPriceDialog(true);
  };



  // Función para registrar precio
  const handleRegisterPrice = async () => {
    if (!priceForm.supplyId || !priceForm.fecha_imputacion || !priceForm.pricePerUnit) {
      toast.warning('Insumo, mes de imputación y precio son requeridos');
      return;
    }

    try {
      if (editingPrice) {
        // Actualizar precio existente
        await updatePrice(editingPrice.id, {
          pricePerUnit: parseFloat(priceForm.pricePerUnit),
          freightCost: parseFloat(priceForm.freightCost || '0'),
          notes: priceForm.notes.trim() || undefined
        });
      } else {
        // Crear nuevo precio
        await registerPrice({
          supplyId: parseInt(priceForm.supplyId),
          fecha_imputacion: priceForm.fecha_imputacion,
          pricePerUnit: parseFloat(priceForm.pricePerUnit),
          freightCost: parseFloat(priceForm.freightCost || '0'),
          notes: priceForm.notes.trim() || undefined
        });
      }
      
      setPriceForm({
        supplyId: '',
        fecha_imputacion: new Date().toISOString().slice(0, 7),
        pricePerUnit: '',
        freightCost: '',
        notes: ''
      });
      setEditingPrice(null);
      setShowPriceDialog(false);
      // Los datos se refrescan automáticamente en el hook
    } catch (error) {
      toast.error(`Error al ${editingPrice ? 'actualizar' : 'registrar'} precio: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  // Función para cerrar diálogos
  const closeDialogs = () => {
    setShowSupplierDialog(false);
    setShowSupplyDialog(false);
    setShowPriceDialog(false);
    setShowPricesDialog(false);
    setShowBulkUploadDialog(false);
    setEditingSupply(null);
    setEditingPrice(null);
    setSelectedSupply(null);
    setUploadFile(null);
    setUploadResults(null);
    setSupplierForm({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: ''
    });
    setSupplyForm({
      name: '',
      unitMeasure: 'TN',
      supplierId: '0'
    });
    setPriceForm({
      supplyId: '',
      fecha_imputacion: new Date().toISOString().slice(0, 7),
      pricePerUnit: '',
      notes: ''
    });
  };

  // Función para descargar plantilla CSV
  const handleDownloadTemplate = () => {
    const headers = ['Nombre del Insumo', 'Mes-Año (YYYY-MM)', 'Precio por Unidad', 'Notas (opcional)'];
    
    // Obtener el mes actual para usar como ejemplo
    const currentDate = new Date();
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Crear contenido CSV con separadores más claros para Excel
    let csvContent = '';
    
    // Agregar encabezados con separadores claros
    csvContent += headers.join(';') + '\n';
    
    // Agregar insumos existentes con su último precio
    const activeSupplies = supplies.filter(s => s.isActive);
    
    if (activeSupplies.length > 0) {
      // Agregar insumos existentes con su último precio
      activeSupplies.forEach(supply => {
        // Buscar el último precio de este insumo
        const supplyPrices = prices.filter(p => p.supplyId === supply.id);
        let lastPrice = 0;
        let lastMonth = currentMonth;
        
        if (supplyPrices.length > 0) {
          // Ordenar por fecha y tomar el más reciente
          const sortedPrices = supplyPrices.sort((a, b) => 
            new Date(b.monthYear).getTime() - new Date(a.monthYear).getTime()
          );
          lastPrice = sortedPrices[0].pricePerUnit;
          lastMonth = sortedPrices[0].monthYear;
        }
        
        csvContent += `${supply.name};${currentMonth};${lastPrice};\n`;
      });
      
      // Agregar línea separadora
      csvContent += '\n';
      csvContent += 'NUEVOS INSUMOS (agregar al final):\n';
      csvContent += 'Nuevo Insumo 1;2025-01;1500000;Precio de ejemplo\n';
      csvContent += 'Nuevo Insumo 2;2025-01;2000000;Precio de ejemplo\n';
    } else {
      // Si no hay insumos, mostrar ejemplos
      const sampleData = [
        ['Harina', currentMonth, '1500000', 'Precio de ejemplo'],
        ['Azúcar', currentMonth, '2000000', 'Precio de ejemplo'],
        ['Aceite', currentMonth, '3000000', ''],
        ['Sal', currentMonth, '800000', ''],
        ['Levadura', currentMonth, '2500000', 'Precio de ejemplo']
      ];
      
      sampleData.forEach(row => {
        csvContent += row.join(';') + '\n';
      });
    }
    
    // Agregar línea de instrucciones
    csvContent += '\n';
    csvContent += 'INSTRUCCIONES:\n';
    csvContent += '1. INSUMOS EXISTENTES: Los insumos listados arriba ya existen en el sistema\n';
    csvContent += '2. ÚLTIMOS PRECIOS: Se muestran los últimos precios registrados de cada insumo\n';
    csvContent += '3. NUEVOS INSUMOS: Agregar al final con nombres únicos\n';
    csvContent += '4. Nombre del Insumo: Debe coincidir exactamente con el nombre del insumo en el sistema\n';
    csvContent += '5. Mes-Año: Formato YYYY-MM (ejemplo: 2025-01 para enero 2025)\n';
    csvContent += '6. Precio por Unidad: Solo números, sin puntos ni comas (ejemplo: 1500000)\n';
    csvContent += '7. Notas: Campo opcional para comentarios adicionales\n';
    csvContent += '8. No modificar la primera fila (encabezados)\n';
    csvContent += '9. Un precio por línea\n';
    csvContent += '10. Guardar como archivo CSV\n';
    csvContent += '11. IMPORTANTE: Usar punto y coma (;) como separador de columnas\n';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_precios_insumos.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Función para manejar carga masiva
  const handleBulkUpload = async () => {
    if (!uploadFile) {
      toast.warning('Por favor selecciona un archivo');
      return;
    }

    setUploading(true);
    try {
      const result = await bulkUploadPrices(uploadFile);
      setUploadResults(result);
      toast.success(`Carga masiva completada: ${result.summary.success} exitosos, ${result.summary.errors} errores`);
    } catch (error) {
      toast.error(`Error en la carga masiva: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setUploading(false);
    }
  };

  // Estadísticas
  const totalSupplies = supplies.length;
  const activeSupplies = supplies.filter(s => s.isActive).length;
  const inactiveSupplies = supplies.filter(s => !s.isActive).length;
  const totalSuppliers = suppliers.length;
  
  // Insumos filtrados
  const filteredSupplies = showOnlyActive ? supplies.filter(s => s.isActive) : supplies;

  // Función para formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Función para calcular el precio total (precio + flete)
  const getTotalPrice = (price: any) => {
    const basePrice = price.pricePerUnit || 0;
    const freightCost = price.freightCost || 0;
    return basePrice + freightCost;
  };

  // Función para formatear fecha - SOLUCIÓN SIMPLE Y DIRECTA
  const formatDate = (dateString: string) => {
    try {
      // Si es una fecha en formato YYYY-MM-DD, extraer solo YYYY-MM
      if (dateString.includes('-')) {
        const [year, month] = dateString.split('-');
        if (year && month) {
          const monthNum = parseInt(month);
          const yearNum = parseInt(year);
          
          // Crear fecha directamente sin compensaciones
          const date = new Date(yearNum, monthNum - 1, 1);
          return date.toLocaleDateString('es-AR', {
            year: 'numeric',
            month: 'long'
          });
        }
      }
      
      // Fallback: intentar parsear como fecha normal
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Fecha inválida';
      }
      
      return date.toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'long'
      });
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Cargando insumos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-foreground">Insumos</h1>
          <p className="text-sm text-muted-foreground">Gestiona tus insumos y precios por tonelada</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowSupplierDialog(true)} variant="outline" size="sm">
            <Building2 className="h-4 w-4 mr-2" />
            Proveedor
          </Button>
          <Button onClick={() => setShowSupplyDialog(true)} variant="outline" size="sm">
            <Package className="h-4 w-4 mr-2" />
            Insumo
          </Button>
          <Button onClick={() => setShowPriceDialog(true)} size="sm">
            <DollarSign className="h-4 w-4 mr-2" />
            Registrar Precio
          </Button>
          <Button onClick={() => {
            const savedNotes = localStorage.getItem('insumos_notes') || '';
            setNotesContent(savedNotes);
            setIsEditingNotes(false);
            setShowNotesDialog(true);
          }} variant="outline" size="sm" className="text-warning-muted-foreground hover:text-warning-muted-foreground hover:bg-warning-muted">
            <BookOpen className="h-4 w-4 mr-2" />
            Notas
          </Button>
          <Button onClick={() => setShowBulkUploadDialog(true)} variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Carga Masiva
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-info-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Insumos</p>
                <p className="text-2xl font-bold">{totalSupplies}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-success" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Insumos Activos</p>
                <p className="text-2xl font-bold">{activeSupplies}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Building2 className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Proveedores</p>
                <p className="text-2xl font-bold">{totalSuppliers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-warning-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Precios Registrados</p>
                <p className="text-2xl font-bold">{prices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>


      </div>

      {/* Tabs principales */}
      <Tabs defaultValue="insumos" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="insumos">Insumos</TabsTrigger>
          <TabsTrigger value="precios">Precios</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        {/* Tab: Insumos */}
        <TabsContent value="insumos" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Catálogo de Insumos</CardTitle>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={showOnlyActive}
                      onChange={(e) => setShowOnlyActive(e.target.checked)}
                      className="rounded"
                    />
                    Solo insumos activos
                  </label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredSupplies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {supplies.length === 0 
                    ? 'No hay insumos creados. Crea tu primer insumo para comenzar.'
                    : showOnlyActive 
                      ? 'No hay insumos activos.'
                      : 'No hay insumos para mostrar.'
                  }
                </div>
              ) : (
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {filteredSupplies.map((supply) => (
                     <Card key={supply.id} className="group relative">
                       <CardContent className="p-4">
                         <div className="flex items-start justify-between mb-3">
                           <div className="flex-1">
                             <h3 className="font-semibold text-lg">{supply.name}</h3>
                             <div className="space-y-1">
                               <div className="flex items-center gap-2">
                                 <Badge variant="outline" className="text-xs">
                                   {supply.unitMeasure}
                                 </Badge>
                                 <Badge variant={supply.isActive ? "default" : "secondary"} className="text-xs">
                                   {supply.isActive ? 'Activo' : 'Inactivo'}
                                 </Badge>
                               </div>
                               {supply.supplierName && (
                                 <div className="text-sm text-muted-foreground">
                                   Proveedor: {supply.supplierName}
                                 </div>
                               )}
                             </div>
                           </div>
                           
                                                       {/* Botones de acción (solo visibles en hover) */}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditSupply(supply)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewPrices(supply)}
                                title="Ver precios registrados"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteSupply(supply.id)}
                                title="Eliminar insumo"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                         </div>
                       </CardContent>
                     </Card>
                   ))}
                 </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Precios */}
        <TabsContent value="precios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Precios Mensuales</CardTitle>
            </CardHeader>
            <CardContent>
              {prices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay precios registrados. Registra el primer precio para comenzar.
                </div>
              ) : (
                <div className="space-y-4">
                  {prices.map((price) => (
                    <div key={price.id} className="flex items-center justify-between p-4 border rounded-lg group">
                      <div>
                        <h4 className="font-medium">{price.supplyName}</h4>
                        <p className="text-sm text-muted-foreground">
                          {price.supplierName} • {price.unitMeasure}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(price.monthYear)} • {price.notes || 'Sin notas'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-lg font-bold text-success">
                            {formatCurrency((price as any).totalPrice || getTotalPrice(price))}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Precio: {formatCurrency(price.pricePerUnit)}
                            {(price as any).freightCost > 0 && (
                              <span> + Flete: {formatCurrency((price as any).freightCost)}</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Registrado: {new Date(price.createdAt).toLocaleDateString('es-AR')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const supply = supplies.find(s => s.id === price.supplyId);
                              if (supply) handleViewPrices(supply);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditPrice(price)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Historial */}
        <TabsContent value="historial" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de Cambios</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay historial de cambios. Los cambios se registrarán automáticamente.
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{entry.supplyName}</h4>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(entry.monthYear)} • {entry.unitMeasure}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {entry.changeType === 'precio_registrado' ? 'Nuevo precio' : 'Precio actualizado'}
                        </p>
                        {entry.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        {entry.oldPrice && (
                          <p className="text-sm text-destructive line-through">
                            {formatCurrency(entry.oldPrice)}
                          </p>
                        )}
                        <p className="text-lg font-bold text-success">
                          {formatCurrency(entry.newPrice || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleDateString('es-AR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Crear Proveedor */}
      <Dialog open={showSupplierDialog} onOpenChange={setShowSupplierDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Proveedor</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nombre *</label>
              <Input
                value={supplierForm.name}
                onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                placeholder="Nombre del proveedor"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Persona de Contacto</label>
                <Input
                  value={supplierForm.contactPerson}
                  onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                  placeholder="Nombre del contacto"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Teléfono</label>
                <Input
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  placeholder="+54 11 1234-5678"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <Input
                value={supplierForm.email}
                onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                placeholder="proveedor@email.com"
                type="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Dirección</label>
              <Textarea
                value={supplierForm.address}
                onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                placeholder="Dirección del proveedor"
              />
            </div>
          </DialogBody>
          <DialogFooter>
              <Button variant="outline" onClick={closeDialogs}>Cancelar</Button>
              <Button onClick={handleCreateSupplier}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Crear Insumo */}
      <Dialog open={showSupplyDialog} onOpenChange={setShowSupplyDialog}>
        <DialogContent>
                   <DialogHeader>
           <DialogTitle>
             {editingSupply ? 'Editar Insumo' : 'Crear Nuevo Insumo'}
           </DialogTitle>
         </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nombre *</label>
              <Input
                value={supplyForm.name}
                onChange={(e) => setSupplyForm({ ...supplyForm, name: e.target.value })}
                placeholder="Nombre del insumo"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Unidad de Medida *</label>
                <Select value={supplyForm.unitMeasure} onValueChange={(value) => setSupplyForm({ ...supplyForm, unitMeasure: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TN">Tonelada (TN)</SelectItem>
                    <SelectItem value="KG">Kilogramo (KG)</SelectItem>
                    <SelectItem value="L">Litro (L)</SelectItem>
                    <SelectItem value="M3">Metro Cúbico (M³)</SelectItem>
                    <SelectItem value="M2">Metro Cuadrado (M²)</SelectItem>
                    <SelectItem value="UN">Unidad (UN)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Proveedor</label>
                <Select value={supplyForm.supplierId} onValueChange={(value) => setSupplyForm({ ...supplyForm, supplierId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                                     <SelectContent>
                     <SelectItem value="0">Sin proveedor</SelectItem>
                     {suppliers.map((supplier) => (
                       <SelectItem key={supplier.id} value={supplier.id.toString()}>
                         {supplier.name}
                       </SelectItem>
                     ))}
                   </SelectContent>
                </Select>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
              <Button variant="outline" onClick={closeDialogs}>Cancelar</Button>
              <Button onClick={handleCreateSupply}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Registrar Precio */}
      <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPrice ? 'Editar Precio' : 'Registrar Precio Mensual'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Insumo *</label>
              <Select value={priceForm.supplyId} onValueChange={(value) => setPriceForm({ ...priceForm, supplyId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar insumo" />
                </SelectTrigger>
                <SelectContent>
                  {supplies.filter(s => s.isActive).map((supply) => (
                    <SelectItem key={supply.id} value={supply.id.toString()}>
                      {supply.name} ({supply.unitMeasure})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Mes de Imputación *</label>
                <Select 
                  value={priceForm.fecha_imputacion}
                  onValueChange={(value) => setPriceForm({ ...priceForm, fecha_imputacion: value })}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {(() => {
                        if (!priceForm.fecha_imputacion) return 'Seleccionar mes';
                        const [year, month] = priceForm.fecha_imputacion.split('-');
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
                <label className="block text-sm font-medium mb-2">Precio por TN *</label>
                <Input
                  type="number"
                  value={priceForm.pricePerUnit}
                  onChange={(e) => setPriceForm({ ...priceForm, pricePerUnit: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Costo de Flete</label>
                <Input
                  type="number"
                  value={priceForm.freightCost}
                  onChange={(e) => setPriceForm({ ...priceForm, freightCost: e.target.value })}
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Notas</label>
              <Textarea
                value={priceForm.notes}
                onChange={(e) => setPriceForm({ ...priceForm, notes: e.target.value })}
                placeholder="Notas adicionales sobre el precio"
              />
            </div>
          </DialogBody>
          <DialogFooter>
                <Button variant="outline" onClick={closeDialogs}>Cancelar</Button>
                <Button onClick={handleRegisterPrice}>
                  {editingPrice ? 'Actualizar Precio' : 'Registrar Precio'}
                </Button>
          </DialogFooter>
         </DialogContent>
       </Dialog>

               {/* Dialog: Ver Precios del Insumo */}
        <Dialog open={showPricesDialog} onOpenChange={setShowPricesDialog}>
          <DialogContent size="lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Precios de: {selectedSupply?.name}
              </DialogTitle>
            </DialogHeader>
            <DialogBody>
            <div className="space-y-6">
              {supplyPrices.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  Este insumo no tiene precios registrados.
                </div>
              ) : (
                <>
                  {/* Estadísticas de Tendencias */}
                  {(() => {
                    const trendData = calculatePriceTrends(supplyPrices);
                    
                    if (!trendData.hasTrend) {
                      return (
                        <div className="bg-warning-muted p-4 rounded-lg border border-warning-muted">
                          <div className="flex items-center gap-2 text-warning-muted-foreground">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm font-medium">{trendData.message}</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {/* Resumen de Tendencias */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Card className="bg-gradient-to-r from-info-muted to-info-muted/80 border-info-muted">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-info-muted-foreground" />
                                <span className="text-sm font-medium text-info-muted-foreground">Tendencia General</span>
                              </div>
                              <div className="mt-2 flex items-center gap-2">
                                {trendData.generalTrend === 'increasing' && <TrendingUp className="h-5 w-5 text-success" />}
                                {trendData.generalTrend === 'decreasing' && <TrendingDown className="h-5 w-5 text-destructive" />}
                                {trendData.generalTrend === 'stable' && <Minus className="h-5 w-5 text-muted-foreground" />}
                                <span className={cn('font-bold', trendData.generalTrend === 'increasing' ? 'text-success' : trendData.generalTrend === 'decreasing' ? 'text-destructive' : 'text-muted-foreground')}>
                                  {trendData.generalTrend === 'increasing' ? 'Subiendo' :
                                   trendData.generalTrend === 'decreasing' ? 'Bajando' : 'Estable'}
                                </span>
                              </div>
                              <div className="text-xs text-info-muted-foreground mt-1">
                                {trendData.totalPercentageChange > 0 ? '+' : ''}{trendData.totalPercentageChange.toFixed(1)}% total
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-gradient-to-r from-success-muted to-success-muted/80 border-success-muted">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-success" />
                                <span className="text-sm font-medium text-success-muted-foreground">Cambio Total</span>
                              </div>
                              <div className="mt-2">
                                <div className={cn('font-bold', trendData.totalChange >= 0 ? 'text-success' : 'text-destructive')}>
                                  {trendData.totalChange >= 0 ? '+' : ''}{formatCurrency(trendData.totalChange)}
                                </div>
                                <div className="text-xs text-success">
                                  {formatCurrency(trendData.firstPrice)} → {formatCurrency(trendData.lastPrice)}
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-purple-600" />
                                <span className="text-sm font-medium text-purple-800">Estadísticas</span>
                              </div>
                              <div className="mt-2 text-xs text-purple-600 space-y-1">
                                <div>📈 Aumentos: {trendData.trends.filter(t => t.type === 'increase').length}</div>
                                <div>📉 Bajadas: {trendData.trends.filter(t => t.type === 'decrease').length}</div>
                                <div>➖ Estables: {trendData.stableCount}</div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Gráfico de Tendencias */}
                        {(() => {
                          const chartData = generatePriceChartData(supplyPrices);
                          
                          if (!chartData) {
                            return (
                              <div className="bg-warning-muted p-4 rounded-lg border border-warning-muted">
                                <div className="flex items-center gap-2 text-warning-muted-foreground">
                                  <AlertTriangle className="h-4 w-4" />
                                  <span className="text-sm font-medium">Se necesitan al menos 2 precios para mostrar el gráfico</span>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                  <BarChart3 className="h-5 w-5" />
                                  Evolución de Precios
                                </CardTitle>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded-full bg-info-muted0"></div>
                                    <span>Inicio</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded-full bg-success-muted0"></div>
                                    <span>Aumento</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded-full bg-destructive/100"></div>
                                    <span>Disminución</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 rounded-full bg-muted-foreground"></div>
                                    <span>Sin cambio</span>
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="h-80 w-full">
                                  <Line data={chartData} options={chartOptions} />
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })()}

                        {/* Detalle de Cambios por Mes */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Cambios Mensuales</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {trendData.trends.map((trend, index) => (
                                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      {trend.type === 'increase' && <TrendingUp className="h-4 w-4 text-success" />}
                                      {trend.type === 'decrease' && <TrendingDown className="h-4 w-4 text-destructive" />}
                                      {trend.type === 'stable' && <Minus className="h-4 w-4 text-muted-foreground" />}
                                      <span className="font-medium">{formatDate(trend.month)}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {formatCurrency(trend.previousPrice)} → {formatCurrency(trend.currentPrice)}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className={cn('font-bold', trend.type === 'increase' ? 'text-success' : trend.type === 'decrease' ? 'text-destructive' : 'text-muted-foreground')}>
                                      {trend.difference >= 0 ? '+' : ''}{formatCurrency(trend.difference)}
                                    </div>
                                    <div className={cn('text-xs', trend.type === 'increase' ? 'text-success' : trend.type === 'decrease' ? 'text-destructive' : 'text-muted-foreground')}>
                                      {trend.percentageChange >= 0 ? '+' : ''}{trend.percentageChange.toFixed(1)}%
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })()}

                  {/* Lista de Precios */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Historial de Precios</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Este insumo tiene {supplyPrices.length} precio(s) registrado(s).
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {supplyPrices.map((price) => (
                          <div key={price.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium">{formatDate(price.monthYear)}</p>
                              {price.notes && (
                                <p className="text-xs text-muted-foreground">{price.notes}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-success">
                                {formatCurrency((price as any).totalPrice || getTotalPrice(price))}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Precio: {formatCurrency(price.pricePerUnit)}
                                {(price as any).freightCost > 0 && (
                                  <span> + Flete: {formatCurrency((price as any).freightCost)}</span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(price.createdAt).toLocaleDateString('es-AR')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={closeDialogs} className="flex-1">
                  Cerrar
                </Button>
              </div>
            </div>
            </DialogBody>
          </DialogContent>
        </Dialog>

        {/* Dialog: Carga Masiva de Precios */}
        <Dialog open={showBulkUploadDialog} onOpenChange={setShowBulkUploadDialog}>
          <DialogContent size="md">
            <DialogHeader>
              <DialogTitle>Carga Masiva de Precios</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
                             {/* Instrucciones */}
               <div className="bg-info-muted p-4 rounded-lg">
                 <h4 className="font-semibold text-foreground mb-2">📋 Instrucciones:</h4>
                                   <ul className="text-sm text-info-muted-foreground space-y-1">
                    <li>• Descarga la plantilla CSV para ver el formato correcto</li>
                    <li>• El archivo tiene 4 columnas separadas por punto y coma (;): Nombre del Insumo; Mes-Año; Precio por Unidad; Notas</li>
                    <li>• <strong>INSUMOS EXISTENTES:</strong> La plantilla incluye todos los insumos ya creados en el sistema</li>
                    <li>• <strong>ÚLTIMOS PRECIOS:</strong> Se muestran los últimos precios registrados de cada insumo</li>
                    <li>• <strong>NUEVOS INSUMOS:</strong> Puedes agregar insumos nuevos al final del archivo</li>
                    <li>• El formato de fecha debe ser YYYY-MM (ejemplo: 2025-01 para enero 2025)</li>
                    <li>• Los precios se actualizarán si ya existen para ese mes, o se crearán si son nuevos</li>
                    <li>• Los insumos nuevos se crearán automáticamente si no existen en el sistema</li>
                    <li>• Cada precio va en una línea separada</li>
                    <li>• <strong>IMPORTANTE:</strong> Usar punto y coma (;) como separador para mejor compatibilidad con Excel</li>
                  </ul>
               </div>

              {/* Botón descargar plantilla */}
              <div className="text-center">
                <Button onClick={handleDownloadTemplate} variant="outline" className="mb-4">
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Plantilla CSV
                </Button>
              </div>

              {/* Selección de archivo */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Seleccionar archivo CSV:</label>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                </div>

                {uploadFile && (
                  <div className="text-sm text-success">
                    ✅ Archivo seleccionado: {uploadFile.name}
                  </div>
                )}
              </div>

              {/* Botón de carga */}
              <div className="flex gap-2">
                <Button 
                  onClick={handleBulkUpload} 
                  disabled={!uploadFile || uploading}
                  className="flex-1"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Cargar Precios
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={closeDialogs}>
                  Cancelar
                </Button>
              </div>

              {/* Resultados de la carga */}
              {uploadResults && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-3">📊 Resultados de la Carga:</h4>
                  
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-info-muted-foreground">{uploadResults.summary.total}</div>
                      <div className="text-sm text-muted-foreground">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-success">{uploadResults.summary.success}</div>
                      <div className="text-sm text-muted-foreground">Exitosos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-destructive">{uploadResults.summary.errors}</div>
                      <div className="text-sm text-muted-foreground">Errores</div>
                    </div>
                  </div>

                  {/* Lista de resultados */}
                  {uploadResults.results.length > 0 && (
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      <h5 className="font-medium text-sm">✅ Precios procesados:</h5>
                      {uploadResults.results.map((result: any, index: number) => (
                        <div key={index} className="text-xs bg-success-muted p-2 rounded">
                          <strong>{result.supplyName}</strong> - {result.monthYear}: {formatCurrency(result.price)} ({result.message})
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Lista de errores */}
                  {uploadResults.errors.length > 0 && (
                    <div className="max-h-40 overflow-y-auto space-y-2 mt-3">
                      <h5 className="font-medium text-sm text-destructive">❌ Errores encontrados:</h5>
                      {uploadResults.errors.map((error: string, index: number) => (
                        <div key={index} className="text-xs bg-destructive/10 p-2 rounded text-destructive">
                          {error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de detalles de precios */}
        <SupplyPriceDetailModal
          isOpen={showPriceDetailModal}
          onClose={() => setShowPriceDetailModal(false)}
          supply={selectedSupplyForDetails}
          priceRecords={selectedSupplyForDetails ? 
            history.filter(h => h.supplyId === selectedSupplyForDetails.id) : []
          }
        />

        {/* Dialog: Notas de Insumos */}
        <Dialog open={showNotesDialog} onOpenChange={(open) => {
          setShowNotesDialog(open);
          if (!open) {
            setIsEditingNotes(false);
            setNotesContent('');
          }
        }}>
          <DialogContent size="md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-warning-muted-foreground" />
                Notas de Insumos
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {isEditingNotes ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notas Generales</label>
                  <Textarea
                    value={notesContent}
                    onChange={(e) => setNotesContent(e.target.value)}
                    placeholder="Escribe notas generales sobre los insumos..."
                    rows={10}
                    className="min-h-[250px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Puedes agregar observaciones, recordatorios o cualquier información relevante sobre los insumos.
                  </p>
                </div>
              ) : (
                <>
                  {notesContent ? (
                    <div className="p-4 bg-warning-muted border border-warning-muted rounded-lg">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {notesContent}
                      </p>
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">
                        No hay notas registradas.
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Haz clic en &quot;Editar&quot; para agregar notas.
                      </p>
                    </div>
                  )}
                </>
              )}
              
              <div className="flex justify-end gap-2">
                {isEditingNotes ? (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsEditingNotes(false);
                        setNotesContent('');
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={() => {
                        // Guardar en localStorage por ahora
                        localStorage.setItem('insumos_notes', notesContent);
                        setIsEditingNotes(false);
                        toast.success('Notas guardadas exitosamente');
                      }}
                    >
                      Guardar
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        // Cargar notas guardadas
                        const savedNotes = localStorage.getItem('insumos_notes') || '';
                        setNotesContent(savedNotes);
                        setIsEditingNotes(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      {notesContent ? 'Editar' : 'Agregar Notas'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowNotesDialog(false)}
                    >
                      Cerrar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
