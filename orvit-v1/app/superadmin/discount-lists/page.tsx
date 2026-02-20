'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, List, Package, Users, ChevronRight } from 'lucide-react';
import { useConfirm } from '@/components/ui/confirm-dialog-provider';

interface Company {
  id: number;
  name: string;
}

interface Category {
  id: number;
  name: string;
}

interface Product {
  id: string;
  code: string;
  name: string;
}

interface DiscountListRubro {
  id: string;
  categoryId: number;
  categoryName: string;
  serieDesde: number;
  serieHasta: number;
  descuento1: number | null;
  descuento2: number | null;
  descuentoPago: number | null;
  comision: number | null;
  isActive: boolean;
}

interface DiscountListProduct {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  descuento: number;
  isActive: boolean;
}

interface DiscountList {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  rubroDiscounts: DiscountListRubro[];
  productDiscounts: DiscountListProduct[];
  _count: { clients: number };
}

export default function DiscountListsPage() {
  const confirm = useConfirm();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [discountLists, setDiscountLists] = useState<DiscountList[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedList, setSelectedList] = useState<DiscountList | null>(null);

  // Dialog states
  const [showListDialog, setShowListDialog] = useState(false);
  const [showRubroDialog, setShowRubroDialog] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [editingList, setEditingList] = useState<DiscountList | null>(null);
  const [editingRubro, setEditingRubro] = useState<DiscountListRubro | null>(null);
  const [editingProduct, setEditingProduct] = useState<DiscountListProduct | null>(null);

  // Form states
  const [listName, setListName] = useState('');
  const [listDescription, setListDescription] = useState('');
  const [rubroForm, setRubroForm] = useState({
    categoryId: '',
    categoryName: '',
    serieDesde: 0,
    serieHasta: 0,
    descuento1: '',
    descuento2: '',
    descuentoPago: '',
    comision: '',
  });
  const [productForm, setProductForm] = useState({
    productId: '',
    productCode: '',
    productName: '',
    descuento: '',
  });

  // Cargar empresas
  useEffect(() => {
    fetch('/api/companies')
      .then(res => res.json())
      .then(data => setCompanies(data || []))
      .catch(() => setCompanies([]));
  }, []);

  // Cargar listas cuando se selecciona empresa
  useEffect(() => {
    if (selectedCompany) {
      loadLists();
      loadCategories();
      loadProducts();
    }
  }, [selectedCompany]);

  const loadLists = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/superadmin/discount-lists?companyId=${selectedCompany}`);
      const data = await res.json();
      setDiscountLists(data || []);
    } catch (error) {
      console.error('Error cargando listas:', error);
      setDiscountLists([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await fetch(`/api/categories?companyId=${selectedCompany}`);
      const data = await res.json();
      setCategories(data || []);
    } catch (error) {
      setCategories([]);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await fetch(`/api/products?companyId=${selectedCompany}`);
      const data = await res.json();
      setProducts(data || []);
    } catch (error) {
      setProducts([]);
    }
  };

  // CRUD Listas
  const handleSaveList = async () => {
    if (!listName.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    setIsLoading(true);
    try {
      const url = editingList
        ? `/api/superadmin/discount-lists/${editingList.id}`
        : '/api/superadmin/discount-lists';
      const method = editingList ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: listName.trim(),
          description: listDescription.trim() || null,
          companyId: selectedCompany,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al guardar');
      }

      toast.success(editingList ? 'Lista actualizada' : 'Lista creada');
      setShowListDialog(false);
      resetListForm();
      loadLists();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteList = async (list: DiscountList) => {
    const ok = await confirm({
      title: 'Eliminar lista',
      description: `¿Eliminar lista "${list.name}"?`,
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/superadmin/discount-lists/${list.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al eliminar');
      }

      toast.success('Lista eliminada');
      if (selectedList?.id === list.id) {
        setSelectedList(null);
      }
      loadLists();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // CRUD Rubros
  const handleSaveRubro = async () => {
    if (!rubroForm.categoryId) {
      toast.error('Selecciona un rubro');
      return;
    }

    setIsLoading(true);
    try {
      const url = `/api/superadmin/discount-lists/${selectedList?.id}/rubros`;
      const method = editingRubro ? 'PUT' : 'POST';

      const body = editingRubro
        ? {
            rubroId: editingRubro.id,
            ...rubroForm,
            descuento1: rubroForm.descuento1 ? parseFloat(rubroForm.descuento1) : null,
            descuento2: rubroForm.descuento2 ? parseFloat(rubroForm.descuento2) : null,
            descuentoPago: rubroForm.descuentoPago ? parseFloat(rubroForm.descuentoPago) : null,
            comision: rubroForm.comision ? parseFloat(rubroForm.comision) : null,
          }
        : {
            categoryId: rubroForm.categoryId,
            categoryName: rubroForm.categoryName,
            serieDesde: rubroForm.serieDesde,
            serieHasta: rubroForm.serieHasta,
            descuento1: rubroForm.descuento1 ? parseFloat(rubroForm.descuento1) : null,
            descuento2: rubroForm.descuento2 ? parseFloat(rubroForm.descuento2) : null,
            descuentoPago: rubroForm.descuentoPago ? parseFloat(rubroForm.descuentoPago) : null,
            comision: rubroForm.comision ? parseFloat(rubroForm.comision) : null,
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al guardar');
      }

      toast.success(editingRubro ? 'Descuento actualizado' : 'Descuento agregado');
      setShowRubroDialog(false);
      resetRubroForm();
      loadLists();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRubro = async (rubro: DiscountListRubro) => {
    const ok = await confirm({
      title: 'Eliminar descuento',
      description: '¿Eliminar este descuento?',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const res = await fetch(
        `/api/superadmin/discount-lists/${selectedList?.id}/rubros?rubroId=${rubro.id}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al eliminar');
      }

      toast.success('Descuento eliminado');
      loadLists();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // CRUD Productos
  const handleSaveProduct = async () => {
    if (!productForm.productId || !productForm.descuento) {
      toast.error('Selecciona un producto y especifica el descuento');
      return;
    }

    setIsLoading(true);
    try {
      const url = `/api/superadmin/discount-lists/${selectedList?.id}/products`;
      const method = editingProduct ? 'PUT' : 'POST';

      const body = editingProduct
        ? {
            productDiscountId: editingProduct.id,
            descuento: parseFloat(productForm.descuento),
          }
        : {
            productId: productForm.productId,
            productCode: productForm.productCode,
            productName: productForm.productName,
            descuento: parseFloat(productForm.descuento),
          };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al guardar');
      }

      toast.success(editingProduct ? 'Descuento actualizado' : 'Descuento agregado');
      setShowProductDialog(false);
      resetProductForm();
      loadLists();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProduct = async (product: DiscountListProduct) => {
    const ok = await confirm({
      title: 'Eliminar descuento',
      description: '¿Eliminar este descuento?',
      confirmText: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const res = await fetch(
        `/api/superadmin/discount-lists/${selectedList?.id}/products?productDiscountId=${product.id}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Error al eliminar');
      }

      toast.success('Descuento eliminado');
      loadLists();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // Reset forms
  const resetListForm = () => {
    setListName('');
    setListDescription('');
    setEditingList(null);
  };

  const resetRubroForm = () => {
    setRubroForm({
      categoryId: '',
      categoryName: '',
      serieDesde: 0,
      serieHasta: 0,
      descuento1: '',
      descuento2: '',
      descuentoPago: '',
      comision: '',
    });
    setEditingRubro(null);
  };

  const resetProductForm = () => {
    setProductForm({
      productId: '',
      productCode: '',
      productName: '',
      descuento: '',
    });
    setEditingProduct(null);
  };

  // Open edit dialogs
  const openEditList = (list: DiscountList) => {
    setEditingList(list);
    setListName(list.name);
    setListDescription(list.description || '');
    setShowListDialog(true);
  };

  const openEditRubro = (rubro: DiscountListRubro) => {
    setEditingRubro(rubro);
    setRubroForm({
      categoryId: rubro.categoryId.toString(),
      categoryName: rubro.categoryName,
      serieDesde: rubro.serieDesde,
      serieHasta: rubro.serieHasta,
      descuento1: rubro.descuento1?.toString() || '',
      descuento2: rubro.descuento2?.toString() || '',
      descuentoPago: rubro.descuentoPago?.toString() || '',
      comision: rubro.comision?.toString() || '',
    });
    setShowRubroDialog(true);
  };

  const openEditProduct = (product: DiscountListProduct) => {
    setEditingProduct(product);
    setProductForm({
      productId: product.productId,
      productCode: product.productCode,
      productName: product.productName,
      descuento: product.descuento.toString(),
    });
    setShowProductDialog(true);
  };

  // Actualizar selectedList cuando cambian las listas
  useEffect(() => {
    if (selectedList) {
      const updated = discountLists.find(l => l.id === selectedList.id);
      if (updated) {
        setSelectedList(updated);
      }
    }
  }, [discountLists]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Listas de Descuentos</h1>
          <p className="text-muted-foreground">
            Gestiona las listas de descuentos por rubro y producto
          </p>
        </div>
      </div>

      {/* Selector de empresa */}
      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Empresa</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecciona una empresa" />
            </SelectTrigger>
            <SelectContent>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id.toString()}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedCompany && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de listas de descuentos */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <List className="w-5 h-5" />
                Listas
              </CardTitle>
              <Button
                size="sm"
                onClick={() => {
                  resetListForm();
                  setShowListDialog(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" />
                Nueva
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : discountLists.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No hay listas de descuentos
                </p>
              ) : (
                <div className="space-y-2">
                  {discountLists.map((list) => (
                    <div
                      key={list.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedList?.id === list.id
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => setSelectedList(list)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium flex items-center gap-2">
                            {list.name}
                            {!list.isActive && (
                              <Badge variant="secondary">Inactiva</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {list._count?.clients || 0} clientes
                            </span>
                            <span>{list.rubroDiscounts?.length || 0} rubros</span>
                            <span>{list.productDiscounts?.length || 0} productos</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detalle de lista seleccionada */}
          <Card className="lg:col-span-2">
            {selectedList ? (
              <>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{selectedList.name}</CardTitle>
                    <CardDescription>
                      {selectedList.description || 'Sin descripción'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditList(selectedList)}
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteList(selectedList)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Eliminar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="rubros" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="rubros">
                        Descuentos por Rubro ({selectedList.rubroDiscounts?.length || 0})
                      </TabsTrigger>
                      <TabsTrigger value="productos">
                        Descuentos por Producto ({selectedList.productDiscounts?.length || 0})
                      </TabsTrigger>
                    </TabsList>

                    {/* Tab Rubros */}
                    <TabsContent value="rubros" className="space-y-4">
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => {
                            resetRubroForm();
                            setShowRubroDialog(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Agregar Rubro
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Rubro</TableHead>
                            <TableHead className="text-center">Serie</TableHead>
                            <TableHead className="text-right">Dto.1</TableHead>
                            <TableHead className="text-right">Dto.2</TableHead>
                            <TableHead className="text-right">Dto.Pago</TableHead>
                            <TableHead className="text-right">Comisión</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedList.rubroDiscounts?.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground">
                                No hay descuentos por rubro
                              </TableCell>
                            </TableRow>
                          ) : (
                            selectedList.rubroDiscounts?.map((rubro) => (
                              <TableRow key={rubro.id}>
                                <TableCell className="font-medium">{rubro.categoryName}</TableCell>
                                <TableCell className="text-center">
                                  {rubro.serieDesde}-{rubro.serieHasta}
                                </TableCell>
                                <TableCell className="text-right">
                                  {rubro.descuento1 ? `${rubro.descuento1}%` : '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {rubro.descuento2 ? `${rubro.descuento2}%` : '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {rubro.descuentoPago ? `${rubro.descuentoPago}%` : '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                  {rubro.comision ? `${rubro.comision}%` : '-'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1 justify-end">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openEditRubro(rubro)}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteRubro(rubro)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    {/* Tab Productos */}
                    <TabsContent value="productos" className="space-y-4">
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={() => {
                            resetProductForm();
                            setShowProductDialog(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Agregar Producto
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead className="text-right">Descuento</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedList.productDiscounts?.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-muted-foreground">
                                No hay descuentos por producto
                              </TableCell>
                            </TableRow>
                          ) : (
                            selectedList.productDiscounts?.map((product) => (
                              <TableRow key={product.id}>
                                <TableCell className="font-mono">{product.productCode}</TableCell>
                                <TableCell>{product.productName}</TableCell>
                                <TableCell className="text-right font-medium">
                                  {product.descuento}%
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1 justify-end">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => openEditProduct(product)}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteProduct(product)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex items-center justify-center h-96 text-muted-foreground">
                Selecciona una lista para ver sus descuentos
              </CardContent>
            )}
          </Card>
        </div>
      )}

      {/* Dialog: Nueva/Editar Lista */}
      <Dialog open={showListDialog} onOpenChange={setShowListDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{editingList ? 'Editar Lista' : 'Nueva Lista de Descuentos'}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div>
                <Label htmlFor="listName">Nombre *</Label>
                <Input
                  id="listName"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="Ej: Lista Mayorista"
                />
              </div>
              <div>
                <Label htmlFor="listDescription">Descripción</Label>
                <Input
                  id="listDescription"
                  value={listDescription}
                  onChange={(e) => setListDescription(e.target.value)}
                  placeholder="Descripción opcional"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowListDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveList} disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingList ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Agregar/Editar Rubro */}
      <Dialog open={showRubroDialog} onOpenChange={setShowRubroDialog}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              {editingRubro ? 'Editar Descuento por Rubro' : 'Agregar Descuento por Rubro'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div>
                <Label>Rubro/Categoría *</Label>
                <Select
                  value={rubroForm.categoryId}
                  onValueChange={(value) => {
                    const cat = categories.find(c => c.id.toString() === value);
                    setRubroForm({
                      ...rubroForm,
                      categoryId: value,
                      categoryName: cat?.name || '',
                    });
                  }}
                  disabled={!!editingRubro}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un rubro" />
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Serie Desde</Label>
                  <Input
                    type="number"
                    value={rubroForm.serieDesde}
                    onChange={(e) => setRubroForm({ ...rubroForm, serieDesde: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Serie Hasta</Label>
                  <Input
                    type="number"
                    value={rubroForm.serieHasta}
                    onChange={(e) => setRubroForm({ ...rubroForm, serieHasta: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Dto.1 (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={rubroForm.descuento1}
                    onChange={(e) => setRubroForm({ ...rubroForm, descuento1: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Dto.2 (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={rubroForm.descuento2}
                    onChange={(e) => setRubroForm({ ...rubroForm, descuento2: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Dto.Pago (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={rubroForm.descuentoPago}
                    onChange={(e) => setRubroForm({ ...rubroForm, descuentoPago: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Comisión (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={rubroForm.comision}
                    onChange={(e) => setRubroForm({ ...rubroForm, comision: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRubroDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRubro} disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingRubro ? 'Guardar' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Agregar/Editar Producto */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Descuento por Producto' : 'Agregar Descuento por Producto'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div>
                <Label>Producto *</Label>
                <Select
                  value={productForm.productId}
                  onValueChange={(value) => {
                    const prod = products.find(p => p.id === value);
                    setProductForm({
                      ...productForm,
                      productId: value,
                      productCode: prod?.code || '',
                      productName: prod?.name || '',
                    });
                  }}
                  disabled={!!editingProduct}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((prod) => (
                      <SelectItem key={prod.id} value={prod.id}>
                        {prod.code} - {prod.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Descuento (%) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={productForm.descuento}
                  onChange={(e) => setProductForm({ ...productForm, descuento: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProductDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveProduct} disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingProduct ? 'Guardar' : 'Agregar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
