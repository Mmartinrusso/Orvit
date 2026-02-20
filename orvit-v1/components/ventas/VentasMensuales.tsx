'use client';

// ✅ OPTIMIZACIÓN: Desactivar logs en producción
const DEBUG = false;
const log = DEBUG ? (...args: unknown[]) => { /* debug */ } : () => {};
const logError = DEBUG ? console.error.bind(console) : () => {};

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/contexts/CompanyContext';
import { DollarSign, Plus, Edit, TrendingUp, AlertTriangle, CheckCircle, Upload, Download, FileSpreadsheet, Trash2, BookOpen } from 'lucide-react';
import { NotesDialog } from '@/components/ui/NotesDialog';
import { useAdminCatalogs } from '@/hooks/use-admin-catalogs'; // ✨ OPTIMIZACIÓN
import { toast } from 'sonner';

interface SaleRecord {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  category_name: string;
  month: string;
  units_sold: number;
  unit_price: number;
  total_revenue: number;
  discount_percentage: number;
  discount_amount: number;
  net_revenue: number;
  observations: string;
  created_at: string;
  updated_at: string;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  category_name?: string;
  categoryId?: number;
  subcategoryName?: string;
  subcategoryId?: number;
  length?: number;
}

export default function VentasMensuales() {
  const { currentCompany } = useCompany();
  
  // ✨ OPTIMIZACIÓN: Usar catálogos consolidados
  const { data: catalogsData, isLoading: catalogsLoading } = useAdminCatalogs(
    currentCompany?.id ? parseInt(currentCompany.id.toString()) : null
  );
  
  const [saleRecords, setSaleRecords] = useState<SaleRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SaleRecord | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [categories, setCategories] = useState<Array<{id: number, name: string}>>([]);
  const [subcategories, setSubcategories] = useState<Array<{id: number, name: string, categoryId: number}>>([]);
  
  // Estados para carga masiva
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<any>(null);

  // Estados para eliminación
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<SaleRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Estado para notas
  const [showNotesDialog, setShowNotesDialog] = useState(false);

  const [formData, setFormData] = useState({
    productId: '',
    month: '',
    unitsSold: '',
    unitPrice: '',
    discountPercentage: '0',
    observations: ''
  });

  // Generar meses para el selector (últimos 12 meses)
  const generateMonths = () => {
    const months = [];
    const currentDate = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthStr = date.toISOString().slice(0, 7);
      months.push(monthStr);
    }
    return months;
  };

  const months = generateMonths();

  // ✨ OPTIMIZACIÓN: Actualizar cuando catalogsData está disponible
  useEffect(() => {
    if (currentCompany && catalogsData) {
      loadCategories();
      loadProducts();
    }
  }, [currentCompany, catalogsData]);

  useEffect(() => {
    if (currentCompany && products.length > 0) {
      loadSaleRecords();
    }
  }, [currentCompany, selectedMonth, selectedProduct, selectedCategory, selectedSubcategory, products]);

  useEffect(() => {
    if (currentCompany && selectedCategory !== 'all' && catalogsData) {
      loadSubcategories(parseInt(selectedCategory));
    } else {
      setSubcategories([]);
      setSelectedSubcategory('all');
    }
  }, [currentCompany, selectedCategory, catalogsData]);

  const loadCategories = async () => {
    // ✨ OPTIMIZACIÓN: Usar catálogos consolidados
    // ANTES: await fetch(`/api/productos/categorias?companyId=${currentCompany.id}`)
    // DESPUÉS: Usar catalogsData.categories
    if (!currentCompany || !catalogsData) return;
    
    try {
      const data = catalogsData.categories || [];
      setCategories(data.map((cat: any) => ({
        id: cat.id,
        name: cat.name
      })));
    } catch (error) {
      console.error('Error cargando categorías:', error);
    }
  };

  const loadSubcategories = async (categoryId: number) => {
    // ✨ OPTIMIZACIÓN: Usar catálogos consolidados
    // ANTES: await fetch(`/api/productos/subcategorias?companyId=...&categoryId=...`)
    // DESPUÉS: Usar catalogsData.subcategories
    if (!currentCompany || !catalogsData) return;
    
    try {
      const data = catalogsData.subcategories || [];
      const filtered = data.filter((sub: any) => sub.categoryId === categoryId);
      setSubcategories(filtered.map((sub: any) => ({
        id: sub.id,
        name: sub.name,
        categoryId: sub.categoryId
      })));
    } catch (error) {
      console.error('Error cargando subcategorías:', error);
    }
  };

  // Función para extraer metros del nombre de un producto
  const extractMetersFromName = (name: string): number => {
    const patterns = [
      /(\d+\.?\d*)\s*m\b/i,           // "4.50m", "6m", "3.5 m"
      /(\d+\.?\d*)\s*metro/i,         // "4.50metro", "6 metros"
      /(\d+\.?\d*)\s*mts/i,           // "4.50mts", "6 mts"
      /(\d+,\d+)\s*m\b/i,             // "4,50m" (coma decimal)
    ];

    for (const pattern of patterns) {
      const match = name.match(pattern);
      if (match) {
        const meterString = match[1].replace(',', '.');
        const meters = parseFloat(meterString);
        if (!isNaN(meters) && meters > 0) {
          return meters;
        }
      }
    }
    return 0;
  };

  const loadProducts = async () => {
    if (!currentCompany) return;
    
    try {
      // Usar el endpoint de productos directamente
      const response = await fetch(`/api/productos/productos?companyId=${currentCompany.id}`);
      if (response.ok) {
        const data = await response.json();
        // Traer TODOS los productos con información completa y ordenar viguetas por longitud
        const allProducts = data
          .map((p: any) => {
            const length = extractMetersFromName(p.name);
            return {
              id: parseInt(p.id),
              name: p.name,
              sku: p.sku,
              category_name: p.categoryName || 'Sin categoría',
              categoryId: p.categoryId ? parseInt(p.categoryId) : undefined,
              subcategoryName: p.subcategoryName,
              subcategoryId: p.subcategoryId ? parseInt(p.subcategoryId) : undefined,
              length: length
            };
          })
          .sort((a, b) => {
            // Si ambos son viguetas (tienen length > 0), ordenar por longitud
            if (a.length > 0 && b.length > 0) {
              return a.length - b.length;
            }
            // Si solo uno es vigueta, las viguetas van primero
            if (a.length > 0 && b.length === 0) return -1;
            if (a.length === 0 && b.length > 0) return 1;
            // Si ninguno es vigueta, ordenar alfabéticamente
            return a.name.localeCompare(b.name);
          });
        setProducts(allProducts);
        log('📊 Productos cargados para plantilla:', allProducts.length);
      }
    } catch (error) {
      console.error('Error cargando productos:', error);
    }
  };

  const loadSaleRecords = async () => {
    if (!currentCompany || products.length === 0) return;
    
    setLoading(true);
    try {
      let url = `/api/sales/monthly?companyId=${currentCompany.id}`;
      if (selectedMonth && selectedMonth !== 'all') url += `&month=${selectedMonth}`;
      
      const response = await fetch(url);
      if (response.ok) {
        let data = await response.json();
        let sales = data.sales || [];
        
        // Filtrar en el cliente por categoría, subcategoría y producto
        if (selectedCategory !== 'all') {
          const categoryId = parseInt(selectedCategory);
          sales = sales.filter((record: SaleRecord) => {
            const product = products.find(p => {
              const productId = typeof p.id === 'number' ? p.id : parseInt(p.id.toString());
              const recordId = typeof record.product_id === 'number' ? record.product_id : parseInt(record.product_id.toString());
              return productId === recordId;
            });
            return product?.categoryId === categoryId;
          });
        }
        
        if (selectedSubcategory !== 'all') {
          const subcategoryId = parseInt(selectedSubcategory);
          sales = sales.filter((record: SaleRecord) => {
            const product = products.find(p => {
              const productId = typeof p.id === 'number' ? p.id : parseInt(p.id.toString());
              const recordId = typeof record.product_id === 'number' ? record.product_id : parseInt(record.product_id.toString());
              return productId === recordId;
            });
            return product?.subcategoryId === subcategoryId;
          });
        }
        
        if (selectedProduct !== 'all') {
          const productId = parseInt(selectedProduct);
          sales = sales.filter((record: SaleRecord) => {
            const recordId = typeof record.product_id === 'number' ? record.product_id : parseInt(record.product_id.toString());
            return recordId === productId;
          });
        }
        
        // Ordenar registros: viguetas por longitud, resto alfabéticamente
        sales = sales.sort((a, b) => {
          const productA = products.find(p => {
            const productId = typeof p.id === 'number' ? p.id : parseInt(p.id.toString());
            const recordId = typeof a.product_id === 'number' ? a.product_id : parseInt(a.product_id.toString());
            return productId === recordId;
          });
          
          const productB = products.find(p => {
            const productId = typeof p.id === 'number' ? p.id : parseInt(p.id.toString());
            const recordId = typeof b.product_id === 'number' ? b.product_id : parseInt(b.product_id.toString());
            return productId === recordId;
          });
          
          // Si ambos son viguetas, ordenar por longitud
          if (productA?.length && productA.length > 0 && productB?.length && productB.length > 0) {
            return productA.length - productB.length;
          }
          
          // Si solo uno es vigueta, las viguetas van primero
          if (productA?.length && productA.length > 0 && (!productB?.length || productB.length === 0)) return -1;
          if ((!productA?.length || productA.length === 0) && productB?.length && productB.length > 0) return 1;
          
          // Si ninguno es vigueta, ordenar alfabéticamente por nombre de producto
          return a.product_name.localeCompare(b.product_name);
        });
        
        setSaleRecords(sales);
      }
    } catch (error) {
      console.error('Error cargando ventas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany) return;

    try {
      const response = await fetch(`/api/sales/monthly?companyId=${currentCompany.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: formData.productId,
          month: formData.month,
          unitsSold: parseInt(formData.unitsSold),
          unitPrice: parseFloat(formData.unitPrice),
          discountPercentage: parseFloat(formData.discountPercentage),
          observations: formData.observations
        })
      });

      if (response.ok) {
        setShowDialog(false);
        resetForm();
        loadSaleRecords();
      }
    } catch (error) {
      console.error('Error guardando ventas:', error);
    }
  };

  const handleEdit = (record: SaleRecord) => {
    setEditingRecord(record);
    setFormData({
      productId: record.product_id.toString(),
      month: record.month,
      unitsSold: record.units_sold.toString(),
      unitPrice: record.unit_price.toString(),
      discountPercentage: record.discount_percentage.toString(),
      observations: record.observations || ''
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setFormData({
      productId: '',
      month: '',
      unitsSold: '',
      unitPrice: '',
      discountPercentage: '0',
      observations: ''
    });
    setEditingRecord(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-AR').format(num);
  };

  // Funciones para carga masiva
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setUploadFile(file);
    } else {
      toast.warning('Por favor seleccione un archivo CSV válido');
    }
  };

  const handleBulkUpload = async () => {
    if (!uploadFile || !currentCompany) {
      toast.warning('Seleccione un archivo primero.');
      return;
    }

    log('🏢 Empresa actual:', currentCompany);
    log('📄 Archivo seleccionado:', uploadFile.name, uploadFile.size);

    setUploading(true);
    setUploadResults(null);
    
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('companyId', currentCompany.id.toString());

      log('📤 Enviando archivo:', uploadFile.name);
      log('📤 Company ID:', currentCompany.id);

      const response = await fetch('/api/sales/monthly/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `Error HTTP: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage += ` - ${errorData.error || errorData.message || 'Error desconocido'}`;
          console.error('🔍 Detalles del error del servidor:', errorData);
        } catch (e) {
          console.error('🔍 No se pudo parsear el error del servidor');
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      log('✅ Resultado:', result);
      
      setUploadResults(result);

      if (result.success && result.summary.success > 0) {
        toast.success(`${result.summary.success} registros procesados`);
        await loadSaleRecords();
        setShowBulkUploadDialog(false);
        setUploadFile(null);
        setUploadResults(null);
      } else if (result.errors && result.errors.length > 0) {
        toast.warning(`Errores encontrados: ${result.errors.length}. Revise la consola para detalles.`);
        console.warn('Errores:', result.errors.slice(0, 5));
      }
      
    } catch (error: any) {
      console.error('❌ Error:', error);
      toast.error(`Error: ${error.message}`);
      setUploadResults({
        success: false,
        error: error.message
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    if (products.length === 0) {
      toast.warning('No hay productos disponibles. Cargue productos primero.');
      return;
    }
    
    // Crear encabezados simples (sin descuento)
    const headers = ['nombre_producto', 'mes', 'unidades_vendidas', 'precio_unitario', 'observaciones'];
    
    // Crear filas con todos los productos
    const csvLines = [headers.join(';')];
    
    products.forEach(product => {
      csvLines.push(`${product.name};2025-09;100;1000;`);
    });
    
    const csvContent = '\uFEFF' + csvLines.join('\n');

    // Crear blob para descarga
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_ventas_mensuales.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Funciones para eliminación
  const handleDeleteClick = (record: SaleRecord) => {
    setRecordToDelete(record);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!recordToDelete || !currentCompany) return;

    setDeleting(true);
    try {
      const response = await fetch(
        `/api/sales/monthly?companyId=${currentCompany.id}&saleId=${recordToDelete.id}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        toast.success('Venta eliminada exitosamente');
        await loadSaleRecords(); // Recargar la lista
        setShowDeleteDialog(false);
        setRecordToDelete(null);
      } else {
        const error = await response.json();
        toast.error(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error eliminando venta:', error);
      toast.error('Error al eliminar la venta');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false);
    setRecordToDelete(null);
  };

  if (!currentCompany) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-muted-foreground">Selecciona una empresa para continuar</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium text-foreground">Ventas Mensuales</h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowNotesDialog(true)}
            variant="outline"
            size="sm"
            className="text-warning-muted-foreground hover:text-warning-muted-foreground hover:bg-warning-muted"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Notas
          </Button>
          <Badge variant="outline" className="text-sm">
            {currentCompany.name}
          </Badge>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Filtros</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filtros en una fila */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthFilter" className="text-sm font-medium">Mes</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
                  {months.map((month) => (
                    <SelectItem key={month} value={month}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="categoryFilter" className="text-sm font-medium">Categoría</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subcategoryFilter" className="text-sm font-medium">Subcategoría</Label>
                <Select 
                value={selectedSubcategory} 
                onValueChange={setSelectedSubcategory}
                disabled={selectedCategory === 'all'}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedCategory === 'all' ? 'Primero selecciona una categoría' : 'Todas las subcategorías'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las subcategorías</SelectItem>
                  {subcategories.map((subcategory) => (
                    <SelectItem key={subcategory.id} value={subcategory.id.toString()}>
                      {subcategory.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="productFilter" className="text-sm font-medium">Producto</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los productos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los productos</SelectItem>
                  {products
                    .filter(product => {
                      if (selectedCategory !== 'all' && product.categoryId?.toString() !== selectedCategory) return false;
                      if (selectedSubcategory !== 'all' && product.subcategoryId?.toString() !== selectedSubcategory) return false;
                      return true;
                    })
                    .sort((a, b) => {
                      // Si ambos son viguetas (tienen length > 0), ordenar por longitud
                      if (a.length && a.length > 0 && b.length && b.length > 0) {
                        return a.length - b.length;
                      }
                      // Si solo uno es vigueta, las viguetas van primero
                      if (a.length && a.length > 0 && (!b.length || b.length === 0)) return -1;
                      if ((!a.length || a.length === 0) && b.length && b.length > 0) return 1;
                      // Si ninguno es vigueta o no tienen length, mantener orden original
                      return 0;
                    })
                    .map((product) => (
                      <SelectItem key={product.id} value={product.id.toString()}>
                        {product.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              </div>
            </div>

            {/* Botones en una fila separada */}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button onClick={() => setShowDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Venta
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowBulkUploadDialog(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Carga Masiva
              </Button>
              <Button 
                variant="outline" 
                onClick={downloadTemplate}
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar Plantilla
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Ventas */}
      <div className="space-y-4">
        {saleRecords.map((record) => (
          <Card key={record.id} className="overflow-hidden">
            <CardHeader className="bg-muted">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-5 w-5 text-success" />
                  <div>
                    <CardTitle className="text-lg">{record.product_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      SKU: {record.sku} • Categoría: {record.category_name}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="mb-2">
                    {record.month}
                  </Badge>
                  <div className="text-sm text-muted-foreground">
                    Actualizado: {new Date(record.updated_at).toLocaleDateString('es-AR')}
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Estadísticas de Ventas */}
                <div className="space-y-4">
                  <h4 className="font-semibold">Estadísticas de Ventas</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 border rounded-lg bg-info-muted">
                      <div className="text-2xl font-bold text-info-muted-foreground">
                        {formatNumber(record.units_sold)}
                      </div>
                      <div className="text-sm text-info-muted-foreground">Unidades Vendidas</div>
                    </div>

                    <div className="text-center p-3 border rounded-lg bg-success-muted">
                      <div className="text-2xl font-bold text-success">
                        {formatCurrency(record.unit_price)}
                      </div>
                      <div className="text-sm text-success">Precio Unitario</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 border rounded-lg bg-warning-muted">
                      <div className="text-2xl font-bold text-warning-muted-foreground">
                        {formatCurrency(record.total_revenue)}
                      </div>
                      <div className="text-sm text-warning-muted-foreground">Ingresos Totales</div>
                    </div>
                    
                    <div className="text-center p-3 border rounded-lg bg-purple-50">
                      <div className="text-2xl font-bold text-purple-600">
                        {formatCurrency(record.net_revenue)}
                      </div>
                      <div className="text-sm text-purple-700">Ingresos Netos</div>
                    </div>
                  </div>

                  {/* Descuento */}
                  {record.discount_percentage > 0 && (
                    <div className="text-center p-3 border rounded-lg bg-destructive/10">
                      <div className="text-lg font-bold text-destructive">
                        {record.discount_percentage}%
                      </div>
                      <div className="text-sm text-destructive">Descuento ({formatCurrency(record.discount_amount)})</div>
                    </div>
                  )}
                </div>

                {/* Observaciones */}
                <div className="space-y-4">
                  <h4 className="font-semibold">Observaciones</h4>
                  {record.observations ? (
                    <div className="p-3 border rounded-lg bg-muted">
                      <p className="text-sm">{record.observations}</p>
                    </div>
                  ) : (
                    <div className="p-3 border rounded-lg bg-muted">
                      <p className="text-sm text-muted-foreground">Sin observaciones</p>
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="space-y-4">
                  <h4 className="font-semibold">Acciones</h4>
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => handleEdit(record)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="w-full"
                      onClick={() => handleDeleteClick(record)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {saleRecords.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-12">
            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay registros de ventas</h3>
            <p className="text-muted-foreground">
              Comienza cargando las ventas mensuales de tus productos
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modal para cargar/editar ventas */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? 'Editar Ventas' : 'Cargar Ventas Mensuales'}
            </DialogTitle>
            <DialogDescription>
              Registra las ventas reales mensuales para este producto
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="productId">Producto</Label>
              <Select 
                value={formData.productId} 
                onValueChange={(value) => setFormData({...formData, productId: value})}
                disabled={!!editingRecord}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id.toString()}>
                      {product.name} - {product.sku}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="month">Mes de Imputación</Label>
              <Select 
                value={formData.month} 
                onValueChange={(value) => setFormData({...formData, month: value})}
                disabled={!!editingRecord}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar mes de imputación" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month} value={month}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="unitsSold">Unidades Vendidas</Label>
                <Input
                  id="unitsSold"
                  type="number"
                  min="0"
                  value={formData.unitsSold}
                  onChange={(e) => setFormData({...formData, unitsSold: e.target.value})}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="unitPrice">Precio Unitario *</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({...formData, unitPrice: e.target.value})}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="discountPercentage">Descuento (%)</Label>
              <Input
                id="discountPercentage"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.discountPercentage}
                onChange={(e) => setFormData({...formData, discountPercentage: e.target.value})}
              />
            </div>

            <div>
              <Label htmlFor="observations">Observaciones</Label>
              <Textarea
                id="observations"
                placeholder="Observaciones sobre las ventas..."
                value={formData.observations}
                onChange={(e) => setFormData({...formData, observations: e.target.value})}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingRecord ? 'Actualizar' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal para carga masiva */}
      <Dialog open={showBulkUploadDialog} onOpenChange={setShowBulkUploadDialog}>
        <DialogContent size="default">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5" />
              <span>Carga Masiva de Ventas</span>
            </DialogTitle>
            <DialogDescription>
              Sube un archivo CSV con las ventas mensuales. Descarga la plantilla para ver el formato correcto con ejemplos de tus productos.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {!uploadResults && (
              <>
                <div>
                  <Label htmlFor="csvFile">Archivo CSV</Label>
                  <Input
                    id="csvFile"
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="mt-1"
                  />
                  {uploadFile && (
                    <p className="text-sm text-success mt-1">
                      ✓ Archivo seleccionado: {uploadFile.name}
                    </p>
                  )}
                </div>

                <div className="bg-info-muted p-3 rounded-md">
                  <div className="flex items-start space-x-2">
                    <FileSpreadsheet className="h-4 w-4 text-info-muted-foreground mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-foreground">Formato del archivo CSV:</p>
                      <ul className="text-info-muted-foreground mt-1 space-y-1">
                        <li>• <strong>nombre_producto</strong>: Nombre exacto del producto</li>
                        <li>• <strong>mes</strong>: Formato YYYY-MM (ej: 2024-01)</li>
                        <li>• <strong>unidades_vendidas</strong>: Número entero (ej: 100)</li>
                        <li>• <strong>precio_unitario</strong>: Precio con decimales (ej: 1500.00)</li>
                        <li>• <strong>descuento_porcentaje</strong>: Porcentaje (ej: 5.0)</li>
                        <li>• <strong>observaciones</strong>: Texto opcional</li>
                      </ul>
                      <p className="text-info-muted-foreground text-xs mt-2">
                        💡 <strong>Tip:</strong> Descarga la plantilla para ver TODOS tus productos con el formato correcto
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {uploadResults && (
              <div className="space-y-4">
                <div className={cn('p-4 rounded-md', uploadResults.success ? 'bg-success-muted' : 'bg-destructive/10')}>
                  <div className="flex items-center space-x-2">
                    {uploadResults.success ? (
                      <CheckCircle className="h-5 w-5 text-success" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    )}
                    <div>
                      <p className={cn('font-medium', uploadResults.success ? 'text-success' : 'text-destructive')}>
                        {uploadResults.message}
                      </p>
                      <p className={cn('text-sm', uploadResults.success ? 'text-success' : 'text-destructive')}>
                        Procesados: {uploadResults.summary?.processed || 0} | 
                        Errores: {uploadResults.summary?.errors || 0}
                      </p>
                    </div>
                  </div>
                </div>

                {uploadResults.errors && uploadResults.errors.length > 0 && (
                  <div className="bg-destructive/10 p-3 rounded-md max-h-32 overflow-y-auto">
                    <p className="text-sm font-medium text-destructive mb-2">Errores encontrados:</p>
                    <ul className="text-xs text-destructive space-y-1">
                      {uploadResults.errors.slice(0, 10).map((error: string, index: number) => (
                        <li key={index}>• {error}</li>
                      ))}
                      {uploadResults.errors.length > 10 && (
                        <li className="text-destructive">... y {uploadResults.errors.length - 10} errores más</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowBulkUploadDialog(false);
                setUploadFile(null);
                setUploadResults(null);
              }}
            >
              {uploadResults ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!uploadResults && (
              <Button 
                onClick={handleBulkUpload} 
                disabled={!uploadFile || uploading}
              >
                {uploading ? 'Procesando...' : 'Subir Archivo'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación para eliminar */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              <span>Confirmar Eliminación</span>
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar esta venta?
            </DialogDescription>
          </DialogHeader>
          
          {recordToDelete && (
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold">{recordToDelete.product_name}</h4>
              <p className="text-sm text-muted-foreground">
                Mes: {recordToDelete.month} | 
                Unidades: {formatNumber(recordToDelete.units_sold)} | 
                Total: {formatCurrency(recordToDelete.total_revenue)}
              </p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={handleDeleteCancel}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Notas */}
      <NotesDialog
        open={showNotesDialog}
        onOpenChange={setShowNotesDialog}
        moduleName="Ventas"
        storageKey="ventas_notes"
      />
    </div>
  );
}