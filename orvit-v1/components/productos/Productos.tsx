'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProductos, Product, ProductCategory } from '@/hooks/use-productos';
import { useSubcategories, ProductSubcategory } from '@/hooks/use-subcategories';
import { useCompany } from '@/contexts/CompanyContext';
import { Plus, Edit, Trash2, Eye, Package, Tag, DollarSign, TrendingUp, AlertTriangle, Power, PowerOff, Upload, Download, FileSpreadsheet, CheckCircle, BookOpen } from 'lucide-react';
import { NotesDialog } from '@/components/ui/NotesDialog';

// ✅ OPTIMIZACIÓN: Desactivar logs en producción
const DEBUG = false; // Desactivado para mejor rendimiento
const log = DEBUG ? console.log.bind(console) : () => {};

export default function Productos() {
  const { currentCompany } = useCompany();
  const {
    categories,
    products,
    loading,
    error,
    createCategory,
    createProduct,
    updateProduct,
    deleteProduct,
    refreshData,
  } = useProductos();

  // Estados para categorías
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: ''
  });

  // Estados para subcategorías
  const [showSubcategoryDialog, setShowSubcategoryDialog] = useState(false);
  const [subcategoryForm, setSubcategoryForm] = useState({
    name: '',
    description: '',
    categoryId: ''
  });

  // Estados para productos
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    sku: '',
    categoryId: '',
    subcategoryId: ''
  });

  const {
    subcategories,
    createSubcategory,
    fetchSubcategories,
  } = useSubcategories(currentCompany?.id, parseInt(productForm.categoryId) || undefined);

  // Estados para detalles del producto
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  
  // Estado para filtro de productos
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  // Estados para carga masiva
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<any>(null);

  // Estado para notas
  const [showNotesDialog, setShowNotesDialog] = useState(false);

  // Las subcategorías se cargan automáticamente cuando cambia categoryId en el hook

  // Función para crear categoría
  const handleCreateCategory = async () => {
    if (!categoryForm.name.trim()) return;

    try {
      await createCategory({
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || undefined
      });
      
      setCategoryForm({ name: '', description: '' });
      setShowCategoryDialog(false);
    } catch (error) {
      alert(`Error al crear categoría: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  // Función para crear subcategoría
  const handleCreateSubcategory = async () => {
    if (!subcategoryForm.name.trim() || !subcategoryForm.categoryId || !currentCompany) return;

    try {
      await createSubcategory({
        name: subcategoryForm.name.trim(),
        description: subcategoryForm.description.trim() || undefined,
        categoryId: parseInt(subcategoryForm.categoryId),
        companyId: currentCompany.id
      });
      
      setSubcategoryForm({ name: '', description: '', categoryId: '' });
      setShowSubcategoryDialog(false);
    } catch (error) {
      alert(`Error al crear subcategoría: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  // Función para crear producto
  const handleCreateProduct = async () => {
    if (!productForm.name || !productForm.sku || !productForm.categoryId) {
      alert('Nombre, SKU y categoría son requeridos');
      return;
    }

    try {
      await createProduct({
        name: productForm.name.trim(),
        description: productForm.description.trim() || undefined,
        sku: productForm.sku.trim(),
        categoryId: parseInt(productForm.categoryId),
        subcategoryId: productForm.subcategoryId ? parseInt(productForm.subcategoryId) : undefined
      });
      
      setProductForm({
        name: '',
        description: '',
        sku: '',
        categoryId: '',
        subcategoryId: ''
      });
      setShowProductDialog(false);
    } catch (error) {
      alert(`Error al crear producto: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  // Función para editar producto
  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || '',
      sku: product.sku,
      categoryId: product.categoryId.toString(),
      subcategoryId: product.subcategoryId?.toString() || ''
    });
    setShowProductDialog(true);
  };

  // Función para actualizar producto
  const handleUpdateProduct = async () => {
    if (!editingProduct || !productForm.name || !productForm.sku || !productForm.categoryId) {
      alert('Nombre, SKU y categoría son requeridos');
      return;
    }

    try {
      await updateProduct(editingProduct.id, {
        name: productForm.name.trim(),
        description: productForm.description.trim() || undefined,
        sku: productForm.sku.trim(),
        categoryId: parseInt(productForm.categoryId),
        subcategoryId: productForm.subcategoryId ? parseInt(productForm.subcategoryId) : undefined
      });
      
      setEditingProduct(null);
      setProductForm({
        name: '',
        description: '',
        sku: '',
        categoryId: '',
        subcategoryId: ''
      });
      setShowProductDialog(false);
    } catch (error) {
      alert(`Error al actualizar producto: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  // Función para eliminar producto
  const handleDeleteProduct = async (productId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este producto?')) return;

    try {
      await deleteProduct(productId);
    } catch (error) {
      alert(`Error al eliminar producto: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  // Función para cambiar estado del producto
  const handleToggleProductStatus = async (product: Product) => {
    try {
      await updateProduct(product.id, {
        name: product.name,
        description: product.description || '',
        sku: product.sku,
        categoryId: product.categoryId,
        subcategoryId: product.subcategoryId,
        isActive: !product.isActive
      });
    } catch (error) {
      alert(`Error al cambiar estado del producto: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  // Función para ver detalles del producto
  const handleViewDetails = (product: Product) => {
    setSelectedProduct(product);
    setShowDetailsDialog(true);
  };

  // Función para cerrar diálogos
  const closeDialogs = () => {
    setShowCategoryDialog(false);
    setShowProductDialog(false);
    setShowDetailsDialog(false);
    setEditingProduct(null);
    setCategoryForm({ name: '', description: '' });
    setProductForm({
      name: '',
      description: '',
      sku: '',
      categoryId: ''
    });
  };

  // Funciones para carga masiva
  const downloadTemplate = () => {
    if (!currentCompany) return;

    const headers = ['nombre', 'sku', 'categoria', 'subcategoria', 'descripcion'];
    const csvContent = '\uFEFF' + headers.join(';') + '\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `plantilla_productos_${currentCompany.name}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadResults(null);
    }
  };

  const handleBulkUpload = async () => {
    if (!uploadFile || !currentCompany) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('companyId', currentCompany.id.toString());

      const response = await fetch('/api/products/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      log('📊 Resultado de carga masiva:', result);

      if (response.ok) {
        setUploadResults(result);
        await refreshData(); // Recargar la lista de productos
      } else {
        console.error('❌ Error en carga masiva:', result);
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Error:', error);
      alert('Error al subir el archivo');
    } finally {
      setUploading(false);
    }
  };

  // Estadísticas
  const totalProducts = products.length;
  const activeProducts = products.filter(p => p.isActive).length;
  const inactiveProducts = products.filter(p => !p.isActive).length;
  
  // Productos filtrados
  const filteredProducts = showOnlyActive ? products.filter(p => p.isActive) : products;

  // Función para formatear moneda
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Cargando productos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-foreground">Productos</h1>
          <p className="text-sm text-muted-foreground">Gestiona tu catálogo de productos</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCategoryDialog(true)} variant="outline" size="sm">
            <Tag className="h-4 w-4 mr-2" />
            Categoría
          </Button>
          <Button onClick={() => setShowSubcategoryDialog(true)} variant="outline" size="sm">
            <Tag className="h-4 w-4 mr-2" />
            Subcategoría
          </Button>
          <Button onClick={downloadTemplate} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Plantilla
          </Button>
          <Button onClick={() => setShowBulkUploadDialog(true)} variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Carga Masiva
          </Button>
          <Button onClick={() => setShowNotesDialog(true)} variant="outline" size="sm" className="text-amber-700 hover:text-amber-800 hover:bg-amber-50">
            <BookOpen className="h-4 w-4 mr-2" />
            Notas
          </Button>
          <Button onClick={() => setShowProductDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Producto
          </Button>
        </div>
      </div>

             {/* Estadísticas */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Productos</p>
                <p className="text-2xl font-bold">{totalProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
                 <Card>
           <CardContent className="p-4">
             <div className="flex items-center space-x-2">
               <TrendingUp className="h-4 w-4 text-green-600" />
               <div>
                 <p className="text-sm font-medium text-muted-foreground">Productos Activos</p>
                 <p className="text-2xl font-bold">{activeProducts}</p>
               </div>
             </div>
           </CardContent>
         </Card>
         
         <Card>
           <CardContent className="p-4">
             <div className="flex items-center space-x-2">
               <AlertTriangle className="h-4 w-4 text-orange-600" />
               <div>
                 <p className="text-sm font-medium text-muted-foreground">Productos Inactivos</p>
                 <p className="text-2xl font-bold">{inactiveProducts}</p>
               </div>
             </div>
           </CardContent>
         </Card>
        
                 <Card>
           <CardContent className="p-4">
             <div className="flex items-center space-x-2">
               <Tag className="h-4 w-4 text-purple-600" />
               <div>
                 <p className="text-sm font-medium text-muted-foreground">Total Categorías</p>
                 <p className="text-2xl font-bold">{categories.length}</p>
               </div>
             </div>
           </CardContent>
         </Card>
        

      </div>

             {/* Lista de Productos */}
       <Card>
         <CardHeader>
           <div className="flex items-center justify-between">
             <CardTitle>Catálogo de Productos</CardTitle>
             <div className="flex items-center gap-2">
               <label className="flex items-center gap-2 text-sm">
                 <input
                   type="checkbox"
                   checked={showOnlyActive}
                   onChange={(e) => setShowOnlyActive(e.target.checked)}
                   className="rounded"
                 />
                 Solo productos activos
               </label>
             </div>
           </div>
         </CardHeader>
         <CardContent>
                     {filteredProducts.length === 0 ? (
             <div className="text-center py-8 text-muted-foreground">
               {products.length === 0 
                 ? 'No hay productos creados. Crea tu primer producto para comenzar.'
                 : showOnlyActive 
                   ? 'No hay productos activos.'
                   : 'No hay productos para mostrar.'
               }
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {filteredProducts.map((product) => {
                 log('🔍 Producto en render:', product);
                 return (
                <Card key={product.id} className="group relative">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{product.name}</h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          {product.description || 'Sin descripción'}
                        </p>
                                                 <div className="space-y-1">
                           <div className="flex items-center gap-2 flex-wrap">
                             <Badge variant="outline" className="text-xs">
                               {product.sku}
                             </Badge>
                             <Badge variant="secondary" className="text-xs">
                               {product.categoryName}
                             </Badge>
                             {product.subcategoryName && (
                               <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                 {product.subcategoryName}
                               </Badge>
                             )}
                             <Badge variant={product.isActive ? "default" : "secondary"} className="text-xs">
                               {product.isActive ? 'Activo' : 'Inactivo'}
                             </Badge>
                           </div>
                           <div className="flex items-center gap-4 text-sm">
                             <span className="text-green-600 font-medium">
                               {formatCurrency(product.unitPrice)}
                             </span>
                           </div>
                         </div>
                      </div>
                      
                                             {/* Botones de acción (solo visibles en hover) */}
                       <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 flex gap-1">
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => handleViewDetails(product)}
                         >
                           <Eye className="h-4 w-4" />
                         </Button>
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => handleEditProduct(product)}
                         >
                           <Edit className="h-4 w-4" />
                         </Button>
                         <Button
                           variant="outline"
                           size="sm"
                           className={product.isActive ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50" : "text-green-600 hover:text-green-700 hover:bg-green-50"}
                           onClick={() => handleToggleProductStatus(product)}
                           title={product.isActive ? "Desactivar producto" : "Activar producto"}
                         >
                           {product.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                         </Button>
                         <Button
                           variant="outline"
                           size="sm"
                           className="text-red-600 hover:text-red-700 hover:bg-red-50"
                           onClick={() => handleDeleteProduct(product.id)}
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </div>
                    </div>
                    
                    
                  </CardContent>
                </Card>
                 );
               })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Crear/Editar Categoria */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Crear Nueva Categoria</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nombre</label>
                <Input
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="Ej: Materia Prima"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Descripcion</label>
                <Textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  placeholder="Descripcion de la categoria"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs}>Cancelar</Button>
            <Button onClick={handleCreateCategory}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Crear/Editar Producto */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Producto' : 'Crear Nuevo Producto'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nombre *</label>
                  <Input
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="Nombre del producto"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">SKU *</label>
                  <Input
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    placeholder="Codigo unico"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Descripcion</label>
                <Textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="Descripcion del producto"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Categoria *</label>
                <Select value={productForm.categoryId} onValueChange={(value) => setProductForm({ ...productForm, categoryId: value, subcategoryId: '' })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Subcategoria (Opcional)</label>
                <Select
                  value={productForm.subcategoryId}
                  onValueChange={(value) => setProductForm({ ...productForm, subcategoryId: value })}
                  disabled={!productForm.categoryId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar subcategoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {productForm.categoryId && subcategories
                      .filter(sub => sub.categoryId === parseInt(productForm.categoryId))
                      .map((sub) => (
                        <SelectItem key={sub.id} value={sub.id.toString()}>
                          {sub.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {productForm.categoryId && subcategories.filter(sub => sub.categoryId === parseInt(productForm.categoryId)).length === 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    No hay subcategorias para esta categoria.
                    <button
                      type="button"
                      onClick={() => setShowSubcategoryDialog(true)}
                      className="text-blue-600 hover:underline ml-1"
                    >
                      Crear una
                    </button>
                  </p>
                )}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs}>Cancelar</Button>
            <Button onClick={editingProduct ? handleUpdateProduct : handleCreateProduct}>
              {editingProduct ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalles del Producto */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Detalles del Producto</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <>
              <DialogBody>
                <div className="space-y-6">
                  {/* Informacion basica */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">{selectedProduct.name}</h3>
                      <p className="text-muted-foreground">{selectedProduct.description || 'Sin descripcion'}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-lg px-3 py-1">
                        {selectedProduct.sku}
                      </Badge>
                    </div>
                  </div>

                  {/* Categoria */}
                  <div>
                    <h4 className="font-medium mb-2">Categoria</h4>
                    <Badge variant="secondary">{selectedProduct.categoryName}</Badge>
                    {selectedProduct.categoryDescription && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedProduct.categoryDescription}
                      </p>
                    )}
                  </div>

                  {/* Precios y costos */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Precio de Venta</h4>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(selectedProduct.unitPrice)}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Costo Unitario</h4>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(selectedProduct.unitCost)}
                      </p>
                    </div>
                  </div>

                  {/* Informacion adicional */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Margen</h4>
                      <p className="text-lg font-semibold text-blue-600">
                        {formatCurrency(selectedProduct.unitPrice - selectedProduct.unitCost)}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Costo Unitario</h4>
                      <p className="text-lg font-semibold text-red-600">
                        {formatCurrency(selectedProduct.unitCost)}
                      </p>
                    </div>
                  </div>

                  {/* Estado */}
                  <div>
                    <h4 className="font-medium mb-2">Estado</h4>
                    <Badge variant={selectedProduct.isActive ? "default" : "secondary"}>
                      {selectedProduct.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </div>

                  {/* Fechas */}
                  <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium">Creado:</span> {new Date(selectedProduct.createdAt).toLocaleDateString('es-AR')}
                    </div>
                    <div>
                      <span className="font-medium">Actualizado:</span> {new Date(selectedProduct.updatedAt).toLocaleDateString('es-AR')}
                    </div>
                  </div>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                  Cerrar
                </Button>
                <Button
                  onClick={() => {
                    setShowDetailsDialog(false);
                    handleEditProduct(selectedProduct);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Producto
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Crear Subcategoria */}
      <Dialog open={showSubcategoryDialog} onOpenChange={setShowSubcategoryDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Crear Nueva Subcategoria</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Categoria *</label>
                <Select value={subcategoryForm.categoryId} onValueChange={(value) => setSubcategoryForm({ ...subcategoryForm, categoryId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Nombre *</label>
                <Input
                  value={subcategoryForm.name}
                  onChange={(e) => setSubcategoryForm({ ...subcategoryForm, name: e.target.value })}
                  placeholder="Ej: Viguetas Pretensadas"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Descripcion</label>
                <Textarea
                  value={subcategoryForm.description}
                  onChange={(e) => setSubcategoryForm({ ...subcategoryForm, description: e.target.value })}
                  placeholder="Descripcion de la subcategoria"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubcategoryDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateSubcategory}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Carga Masiva */}
      <Dialog open={showBulkUploadDialog} onOpenChange={setShowBulkUploadDialog}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Carga Masiva de Productos</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-6">
            {/* Instrucciones */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">📋 Instrucciones:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Descarga la plantilla CSV para ver el formato correcto</li>
                <li>• Completa los campos requeridos: nombre, sku, categoria</li>
                <li>• Los campos opcionales son: subcategoria, descripcion</li>
                <li>• Si el SKU ya existe, se actualizará el producto</li>
                <li>• Si el SKU no existe, se creará un nuevo producto</li>
                <li>• Los precios y stock se pueden configurar después individualmente</li>
                <li>• La subcategoría debe existir en la categoría especificada</li>
              </ul>
            </div>

            {/* Botón para descargar plantilla */}
            <div className="flex justify-center">
              <Button onClick={downloadTemplate} variant="outline" className="w-full">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Descargar Plantilla CSV
              </Button>
            </div>

            {/* Selector de archivo */}
            <div>
              <label className="block text-sm font-medium mb-2">Seleccionar archivo CSV</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
              {uploadFile && (
                <p className="text-sm text-green-600 mt-1">
                  ✅ Archivo seleccionado: {uploadFile.name}
                </p>
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
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Cargar Productos
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowBulkUploadDialog(false)}>
                Cancelar
              </Button>
            </div>

            {/* Resultados */}
            {uploadResults && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-semibold">{uploadResults.message}</span>
                </div>

                {/* Resumen */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-2xl font-bold text-blue-600">{uploadResults.summary.total}</div>
                    <div className="text-sm text-gray-600">Total</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-2xl font-bold text-green-600">{uploadResults.summary.success}</div>
                    <div className="text-sm text-gray-600">Exitosos</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-2xl font-bold text-red-600">{uploadResults.summary.errors}</div>
                    <div className="text-sm text-gray-600">Errores</div>
                  </div>
                </div>

                {/* Errores */}
                {uploadResults.errors && uploadResults.errors.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-red-600 mb-2">❌ Errores encontrados:</h4>
                    <div className="max-h-40 overflow-y-auto bg-red-50 p-3 rounded text-sm">
                      {uploadResults.errors.map((error: string, index: number) => (
                        <div key={index} className="text-red-700">
                          {index + 1}. {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Productos procesados */}
                {uploadResults.results && uploadResults.results.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-green-600 mb-2">✅ Productos procesados:</h4>
                    <div className="max-h-40 overflow-y-auto bg-green-50 p-3 rounded text-sm">
                      {uploadResults.results.slice(0, 10).map((result: any, index: number) => (
                        <div key={index} className="text-green-700">
                          {result.action === 'created' ? '🆕' : '🔄'} {result.product} ({result.sku})
                        </div>
                      ))}
                      {uploadResults.results.length > 10 && (
                        <div className="text-gray-500 italic">
                          ... y {uploadResults.results.length - 10} más
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Dialog: Notas */}
      <NotesDialog
        open={showNotesDialog}
        onOpenChange={setShowNotesDialog}
        moduleName="Productos"
        storageKey="productos_notes"
      />
    </div>
  );
}
