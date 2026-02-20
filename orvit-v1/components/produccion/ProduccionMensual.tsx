'use client';

// ✅ OPTIMIZACIÓN: Desactivar logs en producción
const DEBUG = false;
const log = DEBUG ? (...args: unknown[]) => { /* debug */ } : () => {};

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogBody } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useCompany } from '@/contexts/CompanyContext';
import { Package, Plus, Edit, Trash2, TrendingUp, AlertTriangle, CheckCircle, Upload, Download, FileSpreadsheet, BookOpen } from 'lucide-react';
import { NotesDialog } from '@/components/ui/NotesDialog';
import { toast } from 'sonner';

interface ProductionRecord {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  category_name: string;
  month: string;
  good_units: number;
  scrap_units: number;
  total_units: number;
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

export default function ProduccionMensual() {
  const { currentCompany } = useCompany();
  const [productionRecords, setProductionRecords] = useState<ProductionRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ProductionRecord | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [categories, setCategories] = useState<Array<{id: number, name: string}>>([]);
  const [subcategories, setSubcategories] = useState<Array<{id: number, name: string, categoryId: number}>>([]);
  
  // Estados para carga masiva
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  
  // Estado para notas
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<any>(null);

  const [formData, setFormData] = useState({
    productId: '',
    month: '',
    goodUnits: '',
    scrapUnits: '',
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

  useEffect(() => {
    if (currentCompany) {
      loadCategories();
      loadProducts();
    }
  }, [currentCompany]);

  useEffect(() => {
    if (currentCompany && products.length > 0) {
      loadProductionRecords();
    }
  }, [currentCompany, selectedMonth, selectedProduct, selectedCategory, selectedSubcategory, products]);

  useEffect(() => {
    if (currentCompany && selectedCategory !== 'all') {
      loadSubcategories(parseInt(selectedCategory));
    } else {
      setSubcategories([]);
      setSelectedSubcategory('all');
    }
  }, [currentCompany, selectedCategory]);

  const loadCategories = async () => {
    if (!currentCompany) return;
    
    try {
      const response = await fetch(`/api/productos/categorias?companyId=${currentCompany.id}`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Error cargando categorías:', error);
    }
  };

  const loadSubcategories = async (categoryId: number) => {
    if (!currentCompany) return;
    
    try {
      const response = await fetch(`/api/productos/subcategorias?companyId=${currentCompany.id}&categoryId=${categoryId}`);
      if (response.ok) {
        const data = await response.json();
        setSubcategories(data.map((sub: any) => ({
          id: sub.id,
          name: sub.name,
          categoryId: sub.categoryId
        })));
      }
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
      // Usar el endpoint de productos directamente (IGUAL QUE EN VENTAS)
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
        log('📊 Productos cargados:', allProducts.length, allProducts.slice(0, 3));
      }
    } catch (error) {
      console.error('Error cargando productos:', error);
    }
  };

  const loadProductionRecords = async () => {
    if (!currentCompany || products.length === 0) return;
    
    setLoading(true);
    try {
      let url = `/api/production/monthly?companyId=${currentCompany.id}`;
      if (selectedMonth && selectedMonth !== 'all') url += `&month=${selectedMonth}`;
      
      const response = await fetch(url);
      if (response.ok) {
        let data = await response.json();
        
        // Filtrar en el cliente por categoría, subcategoría y producto
        if (selectedCategory !== 'all') {
          const categoryId = parseInt(selectedCategory);
          data = data.filter((record: ProductionRecord) => {
            const recordId = typeof record.product_id === 'number' ? record.product_id : parseInt(record.product_id.toString());
            const product = products.find(p => p.id === recordId);
            return product?.categoryId === categoryId;
          });
        }
        
        if (selectedSubcategory !== 'all') {
          const subcategoryId = parseInt(selectedSubcategory);
          data = data.filter((record: ProductionRecord) => {
            const recordId = typeof record.product_id === 'number' ? record.product_id : parseInt(record.product_id.toString());
            const product = products.find(p => p.id === recordId);
            return product?.subcategoryId === subcategoryId;
          });
        }
        
        if (selectedProduct !== 'all') {
          const productId = parseInt(selectedProduct);
          data = data.filter((record: ProductionRecord) => {
            const recordId = typeof record.product_id === 'number' ? record.product_id : parseInt(record.product_id.toString());
            return recordId === productId;
          });
        }
        
        // Ordenar registros: viguetas por longitud, resto alfabéticamente
        data = data.sort((a, b) => {
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
        
        setProductionRecords(data);
      }
    } catch (error) {
      console.error('Error cargando producción:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany) return;

    // Validar que se haya seleccionado un producto y mes
    if (!formData.productId || !formData.month) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    // Convertir goodUnits y scrapUnits a números, tratando vacíos como 0
    const goodUnits = parseInt(formData.goodUnits) || 0;
    const scrapUnits = parseInt(formData.scrapUnits) || 0;

    // Validar que al menos haya unidades buenas o scrap
    if (goodUnits === 0 && scrapUnits === 0) {
      toast.error('Debes ingresar al menos unidades buenas o scrap');
      return;
    }

    // Obtener el nombre del producto
    const selectedProduct = products.find(p => p.id.toString() === formData.productId);
    if (!selectedProduct) {
      toast.error('Producto no encontrado');
      return;
    }

    try {
      const response = await fetch('/api/production/monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: currentCompany.id,
          productId: formData.productId,
          month: formData.month,
          goodUnits: goodUnits,
          scrapUnits: scrapUnits,
          observations: formData.observations
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || 'Error al guardar la producción');
        return;
      }

      toast.success('Producción guardada exitosamente');
      setShowDialog(false);
      resetForm();
      loadProductionRecords();
    } catch (error) {
      console.error('Error guardando producción:', error);
      toast.error('Error al guardar la producción');
    }
  };

  const handleEdit = (record: ProductionRecord) => {
    setEditingRecord(record);
    setFormData({
      productId: record.product_id.toString(),
      month: record.month,
      goodUnits: record.good_units.toString(),
      scrapUnits: record.scrap_units.toString(),
      observations: record.observations || ''
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setFormData({
      productId: '',
      month: '',
      goodUnits: '',
      scrapUnits: '',
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
  const downloadTemplate = () => {
    if (products.length === 0) {
      toast.warning('No hay productos disponibles. Cargue productos primero.');
      return;
    }
    
    // Crear encabezados simples (sin costo_unitario - se calcula automáticamente)
    const headers = ['nombre_producto', 'mes', 'cantidad_producida', 'observaciones'];
    
    // Crear filas con todos los productos
    const csvLines = [headers.join(';')];
    
    products.forEach(product => {
      csvLines.push(`${product.name};2025-09;0;`);
    });
    
    const csvContent = '\uFEFF' + csvLines.join('\n');

    // Crear blob para descarga
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_produccion_mensual.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setUploadFile(file);
        setUploadResults(null);
      } else {
        toast.warning('Por favor seleccione un archivo CSV válido');
      }
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

      const response = await fetch('/api/production/monthly/bulk-upload', {
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
        await loadProductionRecords();
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
    } finally {
      setUploading(false);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium text-foreground">Producción Mensual</h1>
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
                Cargar Producción
              </Button>
              <Button 
                variant="outline" 
                onClick={downloadTemplate}
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar Plantilla
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowBulkUploadDialog(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Carga Masiva
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Producción */}
      <div className="space-y-4">
        {productionRecords.map((record) => (
          <Card key={record.id} className="overflow-hidden">
            <CardHeader className="bg-muted">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Package className="h-5 w-5 text-primary" />
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
                {/* Estadísticas de Producción */}
                <div className="space-y-4">
                  <h4 className="font-semibold">Estadísticas de Producción</h4>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 border rounded-lg bg-success-muted">
                      <div className="text-2xl font-bold text-success">
                        {formatNumber(record.good_units)}
                      </div>
                      <div className="text-sm text-success-muted-foreground">Unidades Buenas</div>
                    </div>

                    <div className="text-center p-3 border rounded-lg bg-destructive/10">
                      <div className="text-2xl font-bold text-destructive">
                        {formatNumber(record.scrap_units)}
                      </div>
                      <div className="text-sm text-destructive">Scrap</div>
                    </div>

                    <div className="text-center p-3 border rounded-lg bg-info-muted">
                      <div className="text-2xl font-bold text-primary">
                        {formatNumber(record.total_units)}
                      </div>
                      <div className="text-sm text-info-muted-foreground">Total</div>
                    </div>
                  </div>

                  {/* Eficiencia */}
                  {record.total_units > 0 && (
                    <div className="text-center p-3 border rounded-lg">
                      <div className="text-lg font-bold text-primary">
                        {((record.good_units / record.total_units) * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Eficiencia</div>
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
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {productionRecords.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay registros de producción</h3>
            <p className="text-muted-foreground">
              Comienza cargando la producción mensual de tus productos
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modal para cargar/editar producción */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? 'Editar Producción' : 'Cargar Producción Mensual'}
            </DialogTitle>
            <DialogDescription>
              Registra la producción real mensual para este producto
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
                <Label htmlFor="goodUnits">Unidades Buenas</Label>
                <Input
                  id="goodUnits"
                  type="number"
                  min="0"
                  value={formData.goodUnits}
                  onChange={(e) => setFormData({...formData, goodUnits: e.target.value})}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="scrapUnits">Scrap</Label>
                <Input
                  id="scrapUnits"
                  type="number"
                  min="0"
                  value={formData.scrapUnits}
                  onChange={(e) => setFormData({...formData, scrapUnits: e.target.value})}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="observations">Observaciones</Label>
              <Textarea
                id="observations"
                placeholder="Observaciones sobre la producción..."
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

      {/* Diálogo de carga masiva */}
      <Dialog open={showBulkUploadDialog} onOpenChange={setShowBulkUploadDialog}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <FileSpreadsheet className="h-5 w-5" />
              <span>Carga Masiva de Producción</span>
            </DialogTitle>
            <DialogDescription>
              Sube un archivo CSV con los datos de producción mensual. 
              Puedes descargar la plantilla para ver el formato correcto.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Botón para descargar plantilla */}
            <div className="flex justify-center">
              <Button 
                variant="outline" 
                onClick={downloadTemplate}
                className="flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Descargar Plantilla CSV</span>
              </Button>
            </div>
            
            {/* Selector de archivo */}
            <div className="space-y-2">
              <Label htmlFor="upload-file">Seleccionar archivo CSV</Label>
              <Input
                id="upload-file"
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
              {uploadFile && (
                <div className="flex items-center space-x-2 text-sm text-success">
                  <CheckCircle className="h-4 w-4" />
                  <span>Archivo seleccionado: {uploadFile.name}</span>
                </div>
              )}
            </div>
            
            {/* Resultados de la carga */}
            {uploadResults && (
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Resultado de la carga:</h4>
                <div className="space-y-1 text-sm">
                  <div>✅ Registros procesados: {uploadResults.summary.success}</div>
                  <div>❌ Errores: {uploadResults.summary.errors}</div>
                  {uploadResults.errors && uploadResults.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium">Errores encontrados:</p>
                      <ul className="list-disc list-inside text-xs text-destructive max-h-20 overflow-y-auto">
                        {uploadResults.errors.slice(0, 5).map((error: string, index: number) => (
                          <li key={index}>{error}</li>
                        ))}
                        {uploadResults.errors.length > 5 && (
                          <li>... y {uploadResults.errors.length - 5} errores más</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowBulkUploadDialog(false);
                setUploadFile(null);
                setUploadResults(null);
              }}
            >
              Cerrar
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

      {/* Dialog: Notas */}
      <NotesDialog
        open={showNotesDialog}
        onOpenChange={setShowNotesDialog}
        moduleName="Producción"
        storageKey="produccion_notes"
      />
    </div>
  );
}
