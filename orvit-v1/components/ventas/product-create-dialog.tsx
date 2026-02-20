'use client';

import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { cn } from '@/lib/utils';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Loader2,
  Package,
  Plus,
  Factory,
  ShoppingCart,
  Pencil,
  DollarSign,
  Warehouse,
  Info,
  Scale,
  Truck,
  Box,
  Search,
  Image as ImageIcon,
  X,
  Upload,
  TrendingUp,
  Barcode,
  Tag,
  Edit3,
  Save,
  FileText,
  FolderOpen,
  Building2,
  Check,
  MapPin,
  BarChart3,
} from 'lucide-react';
import { Product, Category } from '@/lib/types/sales';
import { useCompany } from '@/contexts/CompanyContext';
import { MarginIndicator, MarginValue, MarginBar } from './margin-indicator';
import { TagInput } from '@/components/ui/tag-input';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiClient } from '@/hooks/use-api-client';
import { apiRequest } from '@/lib/api-client';

// Lazy load analytics tab
const ProductAnalyticsTab = lazy(() =>
  import('./analytics/product-analytics-tab').then(mod => ({ default: mod.ProductAnalyticsTab }))
);

// Interfaz extendida de categoria con subcategorias
interface CategoryWithChildren extends Category {
  children?: Category[];
  parent?: { id: number; name: string } | null;
}

// Schema de validacion
const productSchema = z.object({
  // Informacion basica
  name: z.string().min(1, 'El nombre es requerido'),
  code: z.string().min(1, 'El codigo es requerido'),
  description: z.string().optional().default(''),
  categoryId: z.coerce.number().min(1, 'Selecciona una categoria'),
  unit: z.string().min(1, 'Selecciona una unidad'),
  isActive: z.boolean().default(true),
  supplierId: z.string().optional(),

  // Costos
  costType: z.enum(['PRODUCTION', 'PURCHASE', 'MANUAL']).default('MANUAL'),
  costPrice: z.coerce.number().min(0, 'El costo debe ser mayor o igual a 0').optional(),
  costCurrency: z.string().default('ARS'),
  recipeId: z.string().optional(),
  purchaseInputId: z.string().optional(),

  // Precios de venta y margen
  salePrice: z.coerce.number().min(0).optional().nullable(),
  saleCurrency: z.string().default('ARS'),
  marginMin: z.coerce.number().min(0).max(100).optional().nullable(),
  marginMax: z.coerce.number().min(0).max(100).optional().nullable(),

  // Códigos adicionales
  barcode: z.string().max(50).optional(),
  sku: z.string().max(50).optional(),

  // Stock
  currentStock: z.coerce.number().min(0, 'El stock debe ser mayor o igual a 0').optional(),
  minStock: z.coerce.number().min(0, 'El stock minimo debe ser mayor o igual a 0').optional(),
  location: z.string().optional().default(''),

  // Especificaciones
  weight: z.coerce.number().min(0).optional(),
  volume: z.coerce.number().min(0).optional(),

  // Conversion de unidades
  unitsPerArea: z.coerce.number().min(0).optional(),
  areaUnit: z.string().optional(),

  // Envasado
  packagingId: z.string().optional(),
  unitsPerPackage: z.coerce.number().min(0).optional(),

  // Imagen
  images: z.array(z.string()).optional(),

  // Trazabilidad
  trackBatches: z.boolean().default(false),
  trackExpiration: z.boolean().default(false),

  // Tags
  tags: z.array(z.string()).optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductCreated?: (product: Product) => void;
}

// Tipos de costo
const COST_TYPES = [
  {
    id: 'MANUAL',
    name: 'Manual',
    description: 'El costo se ingresa manualmente',
    icon: Pencil,
    color: 'text-warning-muted-foreground',
  },
  {
    id: 'PURCHASE',
    name: 'Compra',
    description: 'Se actualiza al registrar compras',
    icon: ShoppingCart,
    color: 'text-success',
  },
  {
    id: 'PRODUCTION',
    name: 'Produccion',
    description: 'Se calcula desde una receta',
    icon: Factory,
    color: 'text-info-muted-foreground',
  },
] as const;

// Unidades de medida
const UNIT_OPTIONS = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'metro', label: 'Metro' },
  { value: 'metro2', label: 'Metro cuadrado' },
  { value: 'metro3', label: 'Metro cubico' },
  { value: 'kilogramo', label: 'Kilogramo' },
  { value: 'tonelada', label: 'Tonelada' },
  { value: 'litro', label: 'Litro' },
  { value: 'bolsa', label: 'Bolsa' },
  { value: 'pallet', label: 'Pallet' },
  { value: 'caja', label: 'Caja' },
];

// Unidades de area para conversion
const AREA_UNITS = [
  { value: 'metro2', label: 'Metro cuadrado (m2)' },
  { value: 'metro3', label: 'Metro cubico (m3)' },
  { value: 'metro_lineal', label: 'Metro Lineal' },
];

// Monedas disponibles
const CURRENCY_OPTIONS = [
  { value: 'ARS', label: 'Pesos ($)', symbol: '$' },
  { value: 'USD', label: 'Dolares (USD)', symbol: 'US$' },
  { value: 'EUR', label: 'Euros (€)', symbol: '€' },
];

interface Supplier {
  id: string;
  name: string;
  razon_social?: string;
  cuit?: string;
}

interface Recipe {
  id: string;
  name: string;
  description?: string;
}

interface PurchaseProduct {
  id: string;
  name: string;
  currentPrice?: number;
}

interface PackagingType {
  id: string;
  name: string;
}

// Configuración de campos habilitados (desde API)
interface FormConfig {
  enabledFields: Record<string, boolean>;
  isLoaded: boolean;
}

// Botón para eliminar campo en modo edición
function FieldRemoveButton({
  featureId,
  featureName,
  isImportant = false,
  onRemove
}: {
  featureId: string;
  featureName: string;
  isImportant?: boolean;
  onRemove: (featureId: string, featureName: string, isImportant: boolean) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
      onClick={() => onRemove(featureId, featureName, isImportant)}
      title={`Ocultar ${featureName}`}
    >
      <X className="h-3.5 w-3.5" />
    </Button>
  );
}

export function ProductCreateDialog({
  open,
  onOpenChange,
  onProductCreated,
}: ProductCreateDialogProps) {
  const { currentCompany } = useCompany();
  const { get, post: apiPost, put: apiPut } = useApiClient({ silent: true });
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryWithChildren[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [purchaseProducts, setPurchaseProducts] = useState<PurchaseProduct[]>([]);
  const [packagings, setPackagingTypes] = useState<PackagingType[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState('basic');

  // Estados para busqueda
  const [supplierSearch, setSupplierSearch] = useState('');
  const [searchingSuppliers, setSearchingSuppliers] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Estado para crear categoria
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Estado para crear tipo de envase
  const [showNewPackaging, setShowNewPackaging] = useState(false);
  const [newPackagingName, setNewPackagingName] = useState('');
  const [creatingPackaging, setCreatingPackaging] = useState(false);

  // Estado para imagen
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Estado para subcategoria seleccionada
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  // Estado para categoria padre seleccionada (para mantener visible el selector de subcategorias)
  const [parentCategoryId, setParentCategoryId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Configuración de campos habilitados
  const [formConfig, setFormConfig] = useState<FormConfig>({
    enabledFields: {},
    isLoaded: false,
  });

  // Modo de edición de configuración
  const [isEditMode, setIsEditMode] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState<{ open: boolean; featureId: string; featureName: string } | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      categoryId: 0,
      unit: 'unidad',
      isActive: true,
      costType: 'MANUAL',
      costPrice: undefined,
      costCurrency: 'ARS',
      currentStock: undefined,
      minStock: undefined,
      location: '',
      weight: undefined,
      volume: undefined,
      unitsPerArea: undefined,
      areaUnit: '',
      packagingId: '',
      unitsPerPackage: undefined,
      images: [],
    },
  });

  const watchCostType = watch('costType');
  const watchCostCurrency = watch('costCurrency');
  const watchCostPrice = watch('costPrice');
  const watchName = watch('name');
  const watchUnit = watch('unit');
  const watchAreaUnit = watch('areaUnit');
  const watchCategoryId = watch('categoryId');

  // Obtener simbolo de moneda seleccionada
  const currencySymbol = CURRENCY_OPTIONS.find(c => c.value === watchCostCurrency)?.symbol || '$';

  // Obtener categorias padre (sin parentId) y subcategorias de la categoria seleccionada
  const parentCategories = categories.filter(c => !c.parent);
  // Usar parentCategoryId para obtener subcategorias (no watchCategoryId que puede ser la subcategoria)
  const selectedParentCategory = categories.find(c => c.id === parentCategoryId);
  const subcategories = selectedParentCategory?.children || [];

  // Helper para verificar si una funcionalidad está habilitada
  const isFeatureEnabled = (featureId: string): boolean => {
    if (!formConfig.isLoaded) return true; // Mientras carga, mostrar todo (fallback)
    return formConfig.enabledFields[featureId] === true; // Solo mostrar si explícitamente habilitado
  };

  // Helper para deshabilitar un campo
  const handleDisableField = async (featureId: string, featureName: string, isImportant: boolean = false) => {
    // Si es importante, pedir confirmación primero
    if (isImportant) {
      setConfirmDisable({ open: true, featureId, featureName });
      return;
    }

    // Si no es importante, deshabilitar directamente
    await toggleFeature(featureId, false);
  };

  // Toggle de feature
  const toggleFeature = async (featureId: string, enabled: boolean) => {
    const prevConfig = formConfig.enabledFields;
    const newConfig = { ...prevConfig, [featureId]: enabled };
    setFormConfig({ enabledFields: newConfig, isLoaded: true });

    const { error } = await apiPut('/api/ventas/product-form-config', { enabledFields: newConfig });
    if (error) {
      toast.error('Error al guardar configuración');
      setFormConfig({ enabledFields: prevConfig, isLoaded: true });
      return;
    }
    toast.success(enabled ? 'Campo habilitado' : 'Campo deshabilitado');
    await reloadConfig();
  };

  // Función para recargar la configuración
  const reloadConfig = async () => {
    const { data } = await get('/api/ventas/product-form-config');
    if (data) {
      setFormConfig({ enabledFields: data.enabledFields || {}, isLoaded: true });
    }
  };

  // Cargar datos iniciales
  useEffect(() => {
    if (open) {
      loadInitialData();
    }
  }, [open]);

  // Buscar proveedores cuando cambia el search
  useEffect(() => {
    if (supplierSearch.length >= 2) {
      searchSuppliers(supplierSearch);
    }
  }, [supplierSearch]);

  const loadInitialData = async () => {
    setLoadingData(true);

    const [categoriesRes, recipesRes, suppliersRes, packagingRes, configRes, inputsRes] = await Promise.all([
      get('/api/categories'),
      get('/api/recipes?active=true'),
      get('/api/compras/proveedores'),
      get('/api/packaging-types'),
      get('/api/ventas/product-form-config'),
      currentCompany?.id ? get(`/api/inputs?companyId=${currentCompany.id}&limit=100`) : Promise.resolve({ data: null, error: null }),
    ]);

    if (categoriesRes.data) setCategories(categoriesRes.data);
    if (recipesRes.data) setRecipes(recipesRes.data.recipes || []);
    if (inputsRes.data) setPurchaseProducts(inputsRes.data.inputs || []);
    if (suppliersRes.data) setSuppliers(Array.isArray(suppliersRes.data) ? suppliersRes.data : []);
    if (packagingRes.data) setPackagingTypes(packagingRes.data || []);
    if (configRes.data) {
      setFormConfig({ enabledFields: configRes.data.enabledFields || {}, isLoaded: true });
    } else {
      setFormConfig({ enabledFields: {}, isLoaded: true });
    }

    setLoadingData(false);
  };

  // Buscar proveedores
  const searchSuppliers = async (search: string) => {
    if (search.length < 2) return;

    setSearchingSuppliers(true);
    const { data } = await get(`/api/compras/proveedores?search=${encodeURIComponent(search)}`);
    if (data) setSuppliers(Array.isArray(data) ? data : []);
    setSearchingSuppliers(false);
  };

  // Crear nueva categoria
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Ingresa un nombre para la categoria');
      return;
    }

    setCreatingCategory(true);
    const { data: newCategory, error } = await apiPost('/api/categories', { name: newCategoryName.trim() });

    if (error) {
      toast.error(error.message);
      setCreatingCategory(false);
      return;
    }

    setCategories(prev => [...prev, newCategory]);
    setValue('categoryId', newCategory.id);
    setNewCategoryName('');
    setShowNewCategory(false);
    toast.success('Categoria creada correctamente');
    setCreatingCategory(false);
  };

  // Crear nuevo tipo de envase
  const handleCreatePackaging = async () => {
    if (!newPackagingName.trim()) {
      toast.error('Ingresa un nombre para el tipo de envase');
      return;
    }

    setCreatingPackaging(true);
    const { data: newPackaging, error } = await apiPost('/api/packaging-types', { name: newPackagingName.trim() });

    if (error) {
      toast.error(error.message);
      setCreatingPackaging(false);
      return;
    }

    setPackagingTypes(prev => [...prev, newPackaging]);
    setValue('packagingId', newPackaging.id);
    setNewPackagingName('');
    setShowNewPackaging(false);
    toast.success('Tipo de envase creado correctamente');
    setCreatingPackaging(false);
  };

  // Generar codigo automatico
  const generateCode = () => {
    if (watchName) {
      const prefix = watchName.substring(0, 3).toUpperCase();
      const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
      setValue('code', `${prefix}-${random}`);
    }
  };

  // Cuando cambia el producto de compra, actualizar el costo
  const handlePurchaseProductChange = (productId: string) => {
    const product = purchaseProducts.find(p => p.id === productId);
    if (product && product.currentPrice) {
      setValue('costPrice', product.currentPrice);
    }
  };

  // Subir imagen
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten archivos de imagen');
      return;
    }

    // Validar tamano (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar 5MB');
      return;
    }

    setUploadingImage(true);
    const formDataObj = new FormData();
    formDataObj.append('file', file);
    formDataObj.append('folder', 'products');

    // Use apiRequest directly for FormData (no JSON content-type)
    const { data: uploadData, error: uploadError } = await apiRequest('/api/upload', {
      method: 'POST',
      body: formDataObj,
    });

    if (uploadError) {
      toast.error(uploadError.message);
    } else if (uploadData) {
      setImagePreview(uploadData.url);
      setValue('images', [uploadData.url]);
      toast.success('Imagen subida correctamente');
    }

    setUploadingImage(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remover imagen
  const handleRemoveImage = () => {
    setImagePreview(null);
    setValue('images', []);
  };

  const onSubmit = async (data: ProductFormData) => {
    setIsLoading(true);

    // Validar categoria
    if (!data.categoryId || data.categoryId < 1) {
      toast.error('Selecciona una categoria');
      setActiveTab('basic');
      setIsLoading(false);
      return;
    }

    // Validar segun tipo de costo
    if (data.costType === 'PRODUCTION' && !data.recipeId) {
      toast.error('Selecciona una receta para productos de produccion');
      setActiveTab('cost');
      setIsLoading(false);
      return;
    }

    if (data.costType === 'PURCHASE' && !data.purchaseInputId) {
      toast.error('Selecciona un producto de compra');
      setActiveTab('cost');
      setIsLoading(false);
      return;
    }

    // Obtener nombre del tipo de envase si hay uno seleccionado
    const packaging = packagings.find(p => p.id === data.packagingId);

    const { data: newProduct, error } = await apiPost('/api/products', {
      name: data.name,
      code: data.code,
      description: data.description || '',
      categoryId: data.categoryId,
      unit: data.unit,
      costPrice: data.costPrice || 0,
      costCurrency: data.costCurrency || 'ARS',
      currentStock: data.currentStock || 0,
      minStock: data.minStock || 0,
      location: data.location || '',
      weight: data.weight || 0,
      volume: data.volume || 0,
      isActive: data.isActive,
      images: data.images || [],
      costType: data.costType,
      recipeId: data.costType === 'PRODUCTION' ? data.recipeId : undefined,
      purchaseInputId: data.costType === 'PURCHASE' ? data.purchaseInputId : undefined,
      blocksPerM2: data.areaUnit === 'metro2' ? data.unitsPerArea : undefined,
      packaging: packaging?.name || '',
      unitsPerPackage: data.unitsPerPackage || 0,
      salePrice: data.salePrice || null,
      saleCurrency: data.saleCurrency || 'ARS',
      marginMin: data.marginMin || null,
      marginMax: data.marginMax || null,
      barcode: data.barcode || null,
      sku: data.sku || null,
      trackBatches: data.trackBatches || false,
      trackExpiration: data.trackExpiration || false,
      tags: data.tags || [],
    });

    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return;
    }

    if (onProductCreated) {
      onProductCreated(newProduct);
    }

    toast.success('Producto creado correctamente');
    handleClose();
    setIsLoading(false);
  };

  const handleClose = () => {
    reset();
    setActiveTab('basic');
    setShowNewCategory(false);
    setNewCategoryName('');
    setShowNewPackaging(false);
    setNewPackagingName('');
    setSupplierSearch('');
    setSelectedSupplier(null);
    setImagePreview(null);
    // Resetear estados de categoria/subcategoria
    setSelectedSubcategoryId(null);
    setParentCategoryId(null);
    onOpenChange(false);
  };

  // Determinar si mostrar conversion de unidades
  const showUnitConversion = ['unidad', 'bolsa', 'caja', 'pallet'].includes(watchUnit);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Nuevo Producto
            </span>
            <div className="flex items-center gap-2">
              {isEditMode && (
                <span className="text-xs text-muted-foreground px-2 py-1 bg-warning-muted rounded">
                  Modo edición: Click en <X className="inline h-3 w-3" /> para ocultar campos
                </span>
              )}
              <Button
                type="button"
                variant={isEditMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsEditMode(!isEditMode)}
                className="gap-1.5"
              >
                {isEditMode ? (
                  <>
                    <Save className="h-4 w-4" />
                    Guardar
                  </>
                ) : (
                  <>
                    <Edit3 className="h-4 w-4" />
                    Configurar
                  </>
                )}
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription>
            Completa la informacion del producto. Los campos con * son obligatorios.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {loadingData ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form id="product-create-form" onSubmit={handleSubmit(onSubmit)}>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start overflow-x-auto mb-4">
                  <TabsTrigger value="basic" className="text-xs">
                    <Package className="w-3.5 h-3.5 mr-1.5" />
                    Basico
                  </TabsTrigger>
                  <TabsTrigger value="cost" className="text-xs">
                    <DollarSign className="w-3.5 h-3.5 mr-1.5" />
                    Costo
                  </TabsTrigger>
                  <TabsTrigger value="pricing" className="text-xs">
                    <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                    Venta
                  </TabsTrigger>
                  <TabsTrigger value="stock" className="text-xs">
                    <Warehouse className="w-3.5 h-3.5 mr-1.5" />
                    Stock
                  </TabsTrigger>
                  <TabsTrigger value="specs" className="text-xs">
                    <Scale className="w-3.5 h-3.5 mr-1.5" />
                    Medidas
                  </TabsTrigger>
                  <TabsTrigger value="advanced" className="text-xs">
                    <Barcode className="w-3.5 h-3.5 mr-1.5" />
                    Avanzado
                  </TabsTrigger>

                  {/* Analytics tab - solo en modo edición */}
                  {false /* create-only dialog */ && product?.id && (
                    <TabsTrigger value="analytics" className="text-xs">
                      <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                      Analytics
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* Tab: Informacion Basica */}
                <TabsContent value="basic" className="space-y-5 mt-0">
                  {/* Seccion Principal con Imagen y Datos Básicos */}
                  <div className="bg-muted/30 border rounded-lg p-4">
                    <div className="flex items-start gap-6">
                      {/* Imagen del producto - más prominente */}
                      {isFeatureEnabled('images') && (
                        <div className="flex-shrink-0">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm font-medium">Imagen</Label>
                            {isEditMode && (
                              <FieldRemoveButton
                                featureId="images"
                                featureName="Imagen del Producto"
                                onRemove={handleDisableField}
                              />
                            )}
                          </div>
                          <div className="relative w-32 h-32 border-2 border-dashed rounded-lg overflow-hidden bg-background hover:border-primary/50 transition-colors">
                            {imagePreview ? (
                              <>
                                <img
                                  src={imagePreview}
                                  alt="Preview"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={handleRemoveImage}
                                  className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 shadow-md transition-all"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingImage}
                                className="w-full h-full flex flex-col items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {uploadingImage ? (
                                  <Loader2 className="w-8 h-8 animate-spin" />
                                ) : (
                                  <>
                                    <ImageIcon className="w-10 h-10 mb-2" />
                                    <span className="text-xs font-medium">Subir imagen</span>
                                    <span className="text-xs text-muted-foreground mt-1">JPG, PNG</span>
                                  </>
                                )}
                              </button>
                            )}
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="hidden"
                            />
                          </div>
                        </div>
                      )}

                      {/* Información Principal */}
                      <div className="flex-1 space-y-4">
                        {/* Nombre del Producto - Full Width */}
                        <div>
                          <Label htmlFor="name" className="text-sm font-medium">
                            Nombre del Producto *
                          </Label>
                          <Input
                            id="name"
                            {...register('name')}
                            placeholder="Ej: Bloque Hormigon 20x20x40"
                            onBlur={generateCode}
                            className="font-medium"
                          />
                          {errors.name && (
                            <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
                          )}
                        </div>

                        {/* Código y Unidad en una fila */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="code" className="text-sm font-medium">
                              Código / SKU *
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                id="code"
                                {...register('code')}
                                placeholder="Ej: BLO-0001"
                                className="font-mono"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={generateCode}
                                title="Generar código automático"
                                className="flex-shrink-0"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            {errors.code && (
                              <p className="text-xs text-destructive mt-1">{errors.code.message}</p>
                            )}
                          </div>

                          <div>
                            <Label htmlFor="unit" className="text-sm font-medium">
                              Unidad de Medida *
                            </Label>
                            <Controller
                              name="unit"
                              control={control}
                              render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <SelectTrigger className={errors.unit ? 'border-destructive' : ''}>
                                    <SelectValue placeholder="Seleccionar unidad" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {UNIT_OPTIONS.map((unit) => (
                                      <SelectItem key={unit.value} value={unit.value}>
                                        {unit.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                            {errors.unit && (
                              <p className="text-xs text-destructive mt-1">{errors.unit.message}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Descripción */}
                  {isFeatureEnabled('description') && (
                    <div className="bg-muted/30 border rounded-lg p-4">
                      <Label htmlFor="description" className="flex items-center justify-between mb-2 text-sm font-medium">
                        <span className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Descripción Detallada
                        </span>
                        {isEditMode && (
                          <FieldRemoveButton
                            featureId="description"
                            featureName="Descripción Extendida"
                            onRemove={handleDisableField}
                          />
                        )}
                      </Label>
                      <Textarea
                        id="description"
                        {...register('description')}
                        placeholder="Agrega una descripción detallada del producto, características, usos, etc..."
                        rows={3}
                        className="resize-none"
                      />
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Esta descripción aparecerá en cotizaciones, presupuestos y fichas técnicas
                      </p>
                    </div>
                  )}

                  {/* Clasificación y Organización */}
                  <div className="bg-muted/30 border rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <FolderOpen className="w-4 h-4" />
                      Clasificación y Organización
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Categoria con opcion de crear nueva */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label htmlFor="categoryId" className="text-sm font-medium">Categoría *</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs -mr-2"
                            onClick={() => setShowNewCategory(!showNewCategory)}
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Nueva Categoría
                          </Button>
                        </div>

                        {showNewCategory ? (
                          <div className="flex gap-2">
                            <Input
                              placeholder="Nombre de la categoría"
                              value={newCategoryName}
                              onChange={(e) => setNewCategoryName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleCreateCategory();
                                }
                              }}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleCreateCategory}
                              disabled={creatingCategory}
                            >
                              {creatingCategory ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                'Crear'
                              )}
                            </Button>
                          </div>
                        ) : (
                          <Controller
                            name="categoryId"
                            control={control}
                            render={({ field }) => (
                              <Select
                                value={parentCategoryId ? parentCategoryId.toString() : ''}
                                onValueChange={(value) => {
                                  const catId = parseInt(value);
                                  field.onChange(catId);
                                  setParentCategoryId(catId);
                                  // Resetear subcategoria al cambiar categoria padre
                                  setSelectedSubcategoryId(null);
                                }}
                              >
                                <SelectTrigger className={errors.categoryId ? 'border-destructive' : ''}>
                                  <SelectValue placeholder="Seleccionar categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                  {parentCategories.length === 0 ? (
                                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                      No hay categorías. Crea una nueva.
                                    </div>
                                  ) : (
                                    parentCategories.map((cat) => (
                                      <SelectItem key={cat.id} value={cat.id.toString()}>
                                        {cat.name}
                                        {cat.children && cat.children.length > 0 && (
                                          <span className="text-muted-foreground ml-1.5 text-xs">
                                            ({cat.children.length} subcategorías)
                                          </span>
                                        )}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        )}
                        {errors.categoryId && (
                          <p className="text-xs text-destructive mt-1.5">{errors.categoryId.message}</p>
                        )}
                      </div>

                      {/* Subcategoria - solo aparece si la categoria seleccionada tiene subcategorias */}
                      {subcategories.length > 0 && (
                        <div>
                          <Label htmlFor="subcategoryId" className="text-sm font-medium mb-2 block">
                            Subcategoría
                          </Label>
                          <Select
                            value={selectedSubcategoryId || 'none'}
                            onValueChange={(value) => {
                              if (value && value !== 'none') {
                                setSelectedSubcategoryId(value);
                                // Actualizar categoryId al ID de la subcategoria
                                setValue('categoryId', parseInt(value));
                              } else {
                                setSelectedSubcategoryId(null);
                                // Restaurar categoryId a la categoria padre
                                if (parentCategoryId) {
                                  setValue('categoryId', parentCategoryId);
                                }
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar subcategoría (opcional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                <span className="text-muted-foreground">Sin subcategoría</span>
                              </SelectItem>
                              {subcategories.map((sub) => (
                                <SelectItem key={sub.id} value={sub.id.toString()}>
                                  {sub.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Opcional - Permite una clasificación más específica
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Proveedor */}
                  {isFeatureEnabled('supplier') && (
                    <div className="bg-muted/30 border rounded-lg p-4">
                      <Label htmlFor="supplierId" className="flex items-center justify-between mb-2 text-sm font-medium">
                        <span className="flex items-center gap-2">
                          <Truck className="w-4 h-4" />
                          Proveedor Principal
                        </span>
                        {isEditMode && (
                          <FieldRemoveButton
                            featureId="supplier"
                            featureName="Proveedor Principal"
                            onRemove={handleDisableField}
                          />
                        )}
                      </Label>
                      <Controller
                        name="supplierId"
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value || ''}
                            onValueChange={(value) => {
                              field.onChange(value);
                              const supplier = suppliers.find(s => s.id === value);
                              if (supplier) {
                                setSelectedSupplier(supplier);
                              }
                            }}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Seleccionar proveedor...">
                                {selectedSupplier ? (
                                  <div className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4 text-muted-foreground" />
                                    <span>{selectedSupplier.name}</span>
                                    {selectedSupplier.cuit && (
                                      <span className="text-xs text-muted-foreground">
                                        • {selectedSupplier.cuit}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  'Seleccionar proveedor...'
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <div className="px-2 pb-2 pt-1">
                                <div className="relative">
                                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                  <Input
                                    placeholder="Buscar por nombre o CUIT..."
                                    className="pl-8 h-9"
                                    value={supplierSearch}
                                    onChange={(e) => setSupplierSearch(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>
                              {searchingSuppliers ? (
                                <div className="flex items-center justify-center py-6">
                                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                </div>
                              ) : suppliers.length === 0 ? (
                                <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                                  No se encontraron proveedores
                                </div>
                              ) : (
                                suppliers.map((supplier) => (
                                  <SelectItem key={supplier.id} value={supplier.id}>
                                    <div className="flex items-center gap-2">
                                      <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                      <span className="flex-1">{supplier.name}</span>
                                      {supplier.cuit && (
                                        <span className="text-xs text-muted-foreground">
                                          {supplier.cuit}
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" />
                        Proveedor habitual para compras y control de stock
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Controller
                      name="isActive"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          id="isActive"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    <Label htmlFor="isActive">Producto activo</Label>
                  </div>
                </TabsContent>

                {/* Tab: Configuracion de Costo */}
                <TabsContent value="cost" className="space-y-5 mt-0">
                  {/* Tipo de Costo - Cards Clickeables */}
                  <div className="bg-muted/30 border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Método de Costeo *
                      </Label>
                    </div>
                    <Controller
                      name="costType"
                      control={control}
                      render={({ field }) => (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {COST_TYPES.map((type) => {
                            const Icon = type.icon;
                            const isSelected = field.value === type.id;
                            return (
                              <button
                                key={type.id}
                                type="button"
                                onClick={() => field.onChange(type.id)}
                                className={cn('group relative p-4 border-2 rounded-lg text-left transition-all', isSelected ? 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-sm' : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50')}
                              >
                                <div className="flex items-center gap-2.5 mb-2">
                                  <div className={cn('p-2 rounded-md', isSelected ? 'bg-primary/20' : 'bg-muted')}>
                                    <Icon className={cn('w-5 h-5', isSelected ? 'text-primary' : type.color)} />
                                  </div>
                                  <span className={cn('text-sm font-semibold', isSelected ? 'text-primary' : 'text-foreground')}>
                                    {type.name}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {type.description}
                                </p>
                                {isSelected && (
                                  <div className="absolute top-2 right-2">
                                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                      <Check className="w-3 h-3 text-primary-foreground" />
                                    </div>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    />
                    <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" />
                      Selecciona cómo se calculará el costo de este producto
                    </p>
                  </div>

                  {/* Campos condicionales segun tipo de costo */}
                  {watchCostType === 'MANUAL' && (
                    <div className="bg-gradient-to-br from-info-muted/50 to-muted/30 border border-info/50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-info-muted-foreground">
                        <Pencil className="w-4 h-4" />
                        Configuración de Costo Manual
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="costCurrency" className="text-sm font-medium mb-2 block">
                            Moneda
                          </Label>
                          <Controller
                            name="costCurrency"
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="bg-background">
                                  <SelectValue placeholder="Seleccionar moneda" />
                                </SelectTrigger>
                                <SelectContent>
                                  {CURRENCY_OPTIONS.map((currency) => (
                                    <SelectItem key={currency.value} value={currency.value}>
                                      {currency.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        <div>
                          <Label htmlFor="costPrice" className="text-sm font-medium mb-2 block">
                            Precio de Costo
                          </Label>
                          <div className="relative flex items-center">
                            <span className="absolute left-0 flex items-center justify-center h-full w-12 border-r bg-muted text-foreground font-semibold rounded-l-md text-sm">
                              {currencySymbol}
                            </span>
                            <Input
                              id="costPrice"
                              type="number"
                              step="0.01"
                              min="0"
                              {...register('costPrice')}
                              placeholder="0.00"
                              className="pl-14 font-mono text-base bg-background"
                            />
                          </div>
                          {errors.costPrice && (
                            <p className="text-xs text-destructive mt-1.5">{errors.costPrice.message}</p>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" />
                        Ingresa manualmente el costo unitario del producto
                      </p>
                    </div>
                  )}

                  {watchCostType === 'PURCHASE' && (
                    <div className="bg-gradient-to-br from-success-muted/50 to-muted/30 border border-success/50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-success">
                        <ShoppingCart className="w-4 h-4" />
                        Vinculación con Compras
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="purchaseInputId" className="text-sm font-medium mb-2 block">
                            Producto de Compra *
                          </Label>
                          <Controller
                            name="purchaseInputId"
                            control={control}
                            render={({ field }) => (
                              <Select
                                value={field.value || ''}
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  handlePurchaseProductChange(value);
                                }}
                              >
                                <SelectTrigger className="bg-background">
                                  <SelectValue placeholder="Seleccionar producto de compra" />
                                </SelectTrigger>
                                <SelectContent>
                                  {purchaseProducts.length === 0 ? (
                                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                                      No hay productos de compra disponibles
                                    </div>
                                  ) : (
                                    purchaseProducts.map((product) => (
                                      <SelectItem key={product.id} value={product.id}>
                                        <div className="flex items-center justify-between w-full">
                                          <span>{product.name}</span>
                                          {product.currentPrice && (
                                            <span className="text-muted-foreground ml-3 font-mono text-sm">
                                              ${Number(product.currentPrice).toFixed(2)}
                                            </span>
                                          )}
                                        </div>
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5" />
                            El costo se actualizará automáticamente con cada compra registrada
                          </p>
                        </div>

                        <div>
                          <Label htmlFor="costPrice" className="text-sm font-medium mb-2 block">
                            Costo Actual (Calculado)
                          </Label>
                          <div className="relative">
                            <Input
                              id="costPrice"
                              type="number"
                              step="0.01"
                              min="0"
                              {...register('costPrice')}
                              placeholder="Se calcula automáticamente"
                              disabled
                              className="bg-muted/50 font-mono text-base"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <div className="px-2 py-0.5 bg-success-muted text-success text-xs font-medium rounded">
                                AUTO
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {watchCostType === 'PRODUCTION' && (
                    <div className="bg-gradient-to-br from-purple-50/50 to-muted/30 border border-purple-200/50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-purple-900">
                        <Factory className="w-4 h-4" />
                        Cálculo por Receta de Producción
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="recipeId" className="text-sm font-medium mb-2 block">
                            Receta de Fabricación *
                          </Label>
                          <Controller
                            name="recipeId"
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value || ''} onValueChange={field.onChange}>
                                <SelectTrigger className="bg-background">
                                  <SelectValue placeholder="Seleccionar receta" />
                                </SelectTrigger>
                                <SelectContent>
                                  {recipes.length === 0 ? (
                                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                                      No hay recetas disponibles
                                    </div>
                                  ) : (
                                    recipes.map((recipe) => (
                                      <SelectItem key={recipe.id} value={recipe.id}>
                                        <div className="flex items-center gap-2">
                                          <Factory className="w-3.5 h-3.5 text-muted-foreground" />
                                          {recipe.name}
                                        </div>
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5" />
                            El costo se calculará sumando materias primas, mano de obra e insumos
                          </p>
                        </div>

                        <div className="bg-purple-100/50 border border-purple-200 rounded-lg p-3">
                          <div className="flex items-start gap-3">
                            <div className="p-1.5 bg-purple-200 rounded-md">
                              <TrendingUp className="w-4 h-4 text-purple-700" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-purple-900 mb-1">
                                Cálculo Automático
                              </p>
                              <p className="text-xs text-purple-700 leading-relaxed">
                                El sistema calculará el costo automáticamente basándose en la receta seleccionada. El cálculo incluye todos los insumos, materiales y tiempo de mano de obra definidos.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Precios de Venta */}
                <TabsContent value="pricing" className="space-y-5 mt-0">
                  {/* Precio de Venta - Sección Principal */}
                  {isFeatureEnabled('salePrice') && (
                    <div className="bg-gradient-to-br from-emerald-50/50 to-muted/30 border-2 border-emerald-200/50 rounded-lg p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-emerald-900">
                          <DollarSign className="w-4 h-4" />
                          Precio de Venta al Cliente
                        </h3>
                        {isEditMode && (
                          <FieldRemoveButton
                            featureId="salePrice"
                            featureName="Precio de Venta"
                            isImportant={true}
                            onRemove={handleDisableField}
                          />
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Input de Precio */}
                        <div>
                          <Label htmlFor="salePrice" className="text-sm font-medium mb-2 block">
                            Precio Unitario
                          </Label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                id="salePrice"
                                type="number"
                                min="0"
                                step="0.01"
                                {...register('salePrice')}
                                placeholder="0.00"
                                className="pl-9 text-lg font-semibold bg-background"
                              />
                            </div>
                            <Controller
                              name="saleCurrency"
                              control={control}
                              render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                  <SelectTrigger className="w-28 bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ARS">ARS</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                    <SelectItem value="EUR">EUR</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5" />
                            Precio base para cotizaciones y ventas
                          </p>
                        </div>

                        {/* Margen Visual */}
                        <div>
                          <Label className="text-sm font-medium mb-2 block">
                            Margen de Ganancia
                          </Label>
                          <div className="bg-background border-2 border-emerald-200 rounded-lg p-3">
                            {watchCostPrice && watchCostPrice > 0 && watch('salePrice') && (watch('salePrice') as number) > 0 ? (
                              <MarginIndicator
                                costPrice={watchCostPrice}
                                salePrice={watch('salePrice') as number}
                                costCurrency={watch('costCurrency')}
                                saleCurrency={watch('saleCurrency')}
                                marginMin={watch('marginMin') as number | undefined}
                                marginMax={watch('marginMax') as number | undefined}
                                size="md"
                              />
                            ) : (
                              <div className="text-center py-4">
                                <TrendingUp className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground">
                                  Configura costo y precio para<br />calcular el margen
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Limites de Margen */}
                  {isFeatureEnabled('margin') && (
                    <div className="bg-muted/30 border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Límites de Margen de Ganancia
                        </h3>
                        {isEditMode && (
                          <FieldRemoveButton
                            featureId="margin"
                            featureName="Límites de Margen"
                            onRemove={handleDisableField}
                          />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" />
                        Define rangos de margen para alertas y control de precios
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Margen Mínimo */}
                        <div className="bg-gradient-to-br from-destructive/10 to-background border border-destructive/20 rounded-lg p-3">
                          <Label htmlFor="marginMin" className="text-sm font-medium mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-destructive"></span>
                            Margen Mínimo (%)
                          </Label>
                          <div className="relative">
                            <Input
                              id="marginMin"
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              {...register('marginMin')}
                              placeholder="Ej: 15"
                              className="font-mono text-base bg-background"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                              %
                            </span>
                          </div>
                          <p className="text-xs text-destructive mt-2">
                            ⚠️ Alerta si el margen es menor a este valor
                          </p>
                        </div>

                        {/* Margen Máximo */}
                        <div className="bg-gradient-to-br from-info-muted/50 to-background border border-info/50 rounded-lg p-3">
                          <Label htmlFor="marginMax" className="text-sm font-medium mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-info"></span>
                            Margen Máximo (%)
                          </Label>
                          <div className="relative">
                            <Input
                              id="marginMax"
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              {...register('marginMax')}
                              placeholder="Ej: 50"
                              className="font-mono text-base bg-background"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                              %
                            </span>
                          </div>
                          <p className="text-xs text-info-muted-foreground mt-2">
                            📊 Alerta si el margen supera este valor
                          </p>
                        </div>
                      </div>

                      {/* Barra Visual de Margen */}
                      {watchCostPrice && watchCostPrice > 0 && watch('salePrice') && (watch('salePrice') as number) > 0 && (
                        <div className="mt-5 bg-background border rounded-lg p-4">
                          <Label className="mb-3 block text-sm font-medium">
                            Visualización del Margen Actual
                          </Label>
                          <MarginBar
                            current={((watch('salePrice') as number) - watchCostPrice) / watchCostPrice * 100}
                            min={watch('marginMin') as number | undefined}
                            max={watch('marginMax') as number | undefined}
                          />
                          <div className="flex justify-between items-center text-xs text-muted-foreground mt-2">
                            <span className="font-mono">0%</span>
                            <div className="flex gap-3">
                              {watch('marginMin') && (
                                <span className="text-destructive font-medium">
                                  Min: {watch('marginMin')}%
                                </span>
                              )}
                              {watch('marginMax') && (
                                <span className="text-info-muted-foreground font-medium">
                                  Max: {watch('marginMax')}%
                                </span>
                              )}
                            </div>
                            <span className="font-mono">100%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Stock */}
                <TabsContent value="stock" className="space-y-5 mt-0">
                  {/* Control de Inventario */}
                  {isFeatureEnabled('currentStock') && (
                    <div className="bg-muted/30 border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <Warehouse className="w-4 h-4" />
                          Control de Inventario
                        </h3>
                        {isEditMode && (
                          <FieldRemoveButton
                            featureId="currentStock"
                            featureName="Seguimiento de Stock"
                            isImportant={true}
                            onRemove={handleDisableField}
                          />
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Stock Actual */}
                        <div className="bg-gradient-to-br from-indigo-50/50 to-background border border-indigo-200/50 rounded-lg p-3">
                          <Label htmlFor="currentStock" className="text-sm font-medium mb-2 block">
                            Stock Actual
                          </Label>
                          <div className="relative">
                            <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="currentStock"
                              type="number"
                              min="0"
                              {...register('currentStock')}
                              placeholder="0"
                              className="pl-10 font-mono text-base bg-background"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                              {watch('unit') || 'unidades'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Cantidad disponible en inventario
                          </p>
                        </div>

                        {/* Stock Mínimo */}
                        <div className="bg-gradient-to-br from-warning-muted/50 to-background border border-warning/50 rounded-lg p-3">
                          <Label htmlFor="minStock" className="text-sm font-medium mb-2 block">
                            Stock Mínimo (Punto de Reorden)
                          </Label>
                          <div className="relative">
                            <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="minStock"
                              type="number"
                              min="0"
                              {...register('minStock')}
                              placeholder="0"
                              className="pl-10 font-mono text-base bg-background"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                              {watch('unit') || 'unidades'}
                            </span>
                          </div>
                          <p className="text-xs text-warning-muted-foreground mt-2">
                            ⚠️ Alerta cuando el stock caiga por debajo
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ubicación en Almacén */}
                  {isFeatureEnabled('location') && (
                    <div className="bg-muted/30 border rounded-lg p-4">
                      <Label htmlFor="location" className="flex items-center justify-between mb-2 text-sm font-medium">
                        <span className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          Ubicación en Almacén
                        </span>
                        {isEditMode && (
                          <FieldRemoveButton
                            featureId="location"
                            featureName="Ubicación en Almacén"
                            onRemove={handleDisableField}
                          />
                        )}
                      </Label>
                      <Input
                        id="location"
                        {...register('location')}
                        placeholder="Ej: Depósito A - Estantería 1 - Nivel 3"
                        className="font-medium"
                      />
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" />
                        Especifica la ubicación física del producto para facilitar su localización
                      </p>
                    </div>
                  )}

                  {/* Envasado / Presentación */}
                  {isFeatureEnabled('packaging') && (
                    <div className="bg-muted/30 border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          Envasado y Presentación
                        </h3>
                        {isEditMode && (
                          <FieldRemoveButton
                            featureId="packaging"
                            featureName="Tipo de Envase"
                            onRemove={handleDisableField}
                          />
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Tipo de Envase */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label htmlFor="packagingId" className="text-sm font-medium">
                              Tipo de Envase
                            </Label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs -mr-2"
                              onClick={() => setShowNewPackaging(!showNewPackaging)}
                            >
                              <Plus className="w-3.5 h-3.5 mr-1" />
                              Nuevo Tipo
                            </Button>
                          </div>

                          {showNewPackaging ? (
                            <div className="flex gap-2">
                              <Input
                                placeholder="Nombre del envase"
                                value={newPackagingName}
                                onChange={(e) => setNewPackagingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleCreatePackaging();
                                  }
                                }}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                size="sm"
                                onClick={handleCreatePackaging}
                                disabled={creatingPackaging}
                              >
                                {creatingPackaging ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  'Crear'
                                )}
                              </Button>
                            </div>
                          ) : (
                            <Controller
                              name="packagingId"
                              control={control}
                              render={({ field }) => (
                                <Select value={field.value || ''} onValueChange={field.onChange}>
                                  <SelectTrigger className="bg-background">
                                    <SelectValue placeholder="Seleccionar tipo de envase" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {packagings.length === 0 ? (
                                      <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                                        No hay tipos de envase. Crea uno nuevo.
                                      </div>
                                    ) : (
                                      packagings.map((pkg) => (
                                        <SelectItem key={pkg.id} value={pkg.id}>
                                          <div className="flex items-center gap-2">
                                            <Package className="w-3.5 h-3.5 text-muted-foreground" />
                                            {pkg.name}
                                          </div>
                                        </SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Formato de presentación del producto
                          </p>
                        </div>

                        {/* Unidades por Envase */}
                        <div>
                          <Label htmlFor="unitsPerPackage" className="text-sm font-medium mb-2 block">
                            Unidades por Envase
                          </Label>
                          <div className="relative">
                            <Box className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="unitsPerPackage"
                              type="number"
                              min="0"
                              {...register('unitsPerPackage')}
                              placeholder="0"
                              className="pl-10 font-mono text-base bg-background"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                              unidades
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Cantidad de unidades incluidas en cada envase
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Especificaciones / Medidas */}
                <TabsContent value="specs" className="space-y-5 mt-0">
                  {/* Dimensiones Físicas */}
                  <div className="bg-muted/30 border rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Scale className="w-4 h-4" />
                      Dimensiones Físicas
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" />
                      Especifica el peso y volumen para cálculos de logística y transporte
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Peso */}
                      <div className="bg-gradient-to-br from-slate-50/50 to-background border border-slate-200/50 rounded-lg p-3">
                        <Label htmlFor="weight" className="text-sm font-medium mb-2 block flex items-center gap-2">
                          <Scale className="w-3.5 h-3.5 text-muted-foreground" />
                          Peso por Unidad
                        </Label>
                        <div className="relative">
                          <Input
                            id="weight"
                            type="number"
                            step="0.01"
                            min="0"
                            {...register('weight')}
                            placeholder="0.00"
                            className="pr-12 font-mono text-base bg-background"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                            kg
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Peso en kilogramos
                        </p>
                      </div>

                      {/* Volumen */}
                      <div className="bg-gradient-to-br from-cyan-50/50 to-background border border-cyan-200/50 rounded-lg p-3">
                        <Label htmlFor="volume" className="text-sm font-medium mb-2 block flex items-center gap-2">
                          <Box className="w-3.5 h-3.5 text-muted-foreground" />
                          Volumen por Unidad
                        </Label>
                        <div className="relative">
                          <Input
                            id="volume"
                            type="number"
                            step="0.001"
                            min="0"
                            {...register('volume')}
                            placeholder="0.000"
                            className="pr-12 font-mono text-base bg-background"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                            m³
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Volumen en metros cúbicos
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Conversion de unidades */}
                  {showUnitConversion && (
                    <div className="bg-gradient-to-br from-violet-50/50 to-muted/30 border border-violet-200/50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-violet-900">
                        <Scale className="w-4 h-4" />
                        Conversión de Unidades
                      </h3>
                      <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" />
                        Define cuántas unidades del producto entran en una medida de área o volumen
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="areaUnit" className="text-sm font-medium mb-2 block">
                            Unidad de Referencia
                          </Label>
                          <Controller
                            name="areaUnit"
                            control={control}
                            render={({ field }) => (
                              <Select value={field.value || ''} onValueChange={field.onChange}>
                                <SelectTrigger className="bg-background">
                                  <SelectValue placeholder="Seleccionar unidad" />
                                </SelectTrigger>
                                <SelectContent>
                                  {AREA_UNITS.map((unit) => (
                                    <SelectItem key={unit.value} value={unit.value}>
                                      {unit.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          <p className="text-xs text-muted-foreground mt-2">
                            Selecciona m², m³ o metros lineales
                          </p>
                        </div>

                        <div>
                          <Label htmlFor="unitsPerArea" className="text-sm font-medium mb-2 block">
                            Unidades por {watchAreaUnit === 'metro2' ? 'm²' : watchAreaUnit === 'metro3' ? 'm³' : 'metro'}
                          </Label>
                          <div className="relative">
                            <Input
                              id="unitsPerArea"
                              type="number"
                              step="0.01"
                              min="0"
                              {...register('unitsPerArea')}
                              placeholder="0.00"
                              className="pr-16 font-mono text-base bg-background"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                              unidades
                            </span>
                          </div>
                          <p className="text-xs text-violet-600 mt-2">
                            Ej: 29 bloques por m²
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Avanzado */}
                <TabsContent value="advanced" className="space-y-5 mt-0">
                  {/* Codigos Adicionales */}
                  {(isFeatureEnabled('barcode') || isFeatureEnabled('sku')) && (
                    <div className="bg-muted/30 border rounded-lg p-4">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Barcode className="w-4 h-4" />
                        Códigos de Identificación
                      </h3>
                      <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" />
                        Códigos adicionales para identificación y trazabilidad
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {isFeatureEnabled('barcode') && (
                          <div className="bg-gradient-to-br from-orange-50/50 to-background border border-orange-200/50 rounded-lg p-3">
                            <Label htmlFor="barcode" className="flex items-center justify-between mb-2 text-sm font-medium">
                              <span className="flex items-center gap-2">
                                <Barcode className="w-3.5 h-3.5 text-muted-foreground" />
                                Código de Barras
                              </span>
                              {isEditMode && (
                                <FieldRemoveButton
                                  featureId="barcode"
                                  featureName="Código de Barras"
                                  onRemove={handleDisableField}
                                />
                              )}
                            </Label>
                            <Input
                              id="barcode"
                              {...register('barcode')}
                              placeholder="7790070000001"
                              maxLength={50}
                              className="font-mono bg-background"
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                              EAN-13, UPC, Code128, etc.
                            </p>
                          </div>
                        )}
                        {isFeatureEnabled('sku') && (
                          <div className="bg-gradient-to-br from-teal-50/50 to-background border border-teal-200/50 rounded-lg p-3">
                            <Label htmlFor="sku" className="flex items-center justify-between mb-2 text-sm font-medium">
                              <span className="flex items-center gap-2">
                                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                                SKU Alternativo
                              </span>
                              {isEditMode && (
                                <FieldRemoveButton
                                  featureId="sku"
                                  featureName="SKU Alternativo"
                                  onRemove={handleDisableField}
                                />
                              )}
                            </Label>
                            <Input
                              id="sku"
                              {...register('sku')}
                              placeholder="PROD-001-A"
                              maxLength={50}
                              className="font-mono bg-background"
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                              Código interno alternativo
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Etiquetas */}
                  {isFeatureEnabled('tags') && (
                    <div className="bg-muted/30 border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <Tag className="w-4 h-4" />
                          Etiquetas y Clasificación
                        </h3>
                        {isEditMode && (
                          <FieldRemoveButton
                            featureId="tags"
                            featureName="Etiquetas"
                            onRemove={handleDisableField}
                          />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" />
                        Agrega etiquetas para categorizar, filtrar y organizar productos fácilmente
                      </p>
                      <Controller
                        name="tags"
                        control={control}
                        render={({ field }) => (
                          <div className="bg-background border rounded-lg p-3">
                            <TagInput
                              value={field.value || []}
                              onChange={field.onChange}
                              placeholder="Escribe una etiqueta y presiona Enter..."
                              suggestions={['premium', 'oferta', 'nuevo', 'agotado', 'popular', 'exclusivo', 'importado', 'nacional']}
                              maxTags={10}
                            />
                          </div>
                        )}
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Máximo 10 etiquetas. Haz clic en las sugerencias o escribe las tuyas.
                      </p>
                    </div>
                  )}

                  {/* Trazabilidad */}
                  {isFeatureEnabled('traceability') && (
                    <div className="bg-gradient-to-br from-pink-50/50 to-muted/30 border border-pink-200/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold flex items-center gap-2 text-pink-900">
                          <Package className="w-4 h-4" />
                          Control de Trazabilidad
                        </h3>
                        {isEditMode && (
                          <FieldRemoveButton
                            featureId="traceability"
                            featureName="Trazabilidad"
                            onRemove={handleDisableField}
                          />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5" />
                        Activa opciones de seguimiento y trazabilidad para este producto
                      </p>

                      <div className="space-y-3">
                        {/* Seguimiento de Lotes */}
                        <div className="flex items-center justify-between p-4 bg-background border-2 border-pink-200/50 rounded-lg hover:border-pink-300 transition-colors">
                          <div className="flex-1">
                            <Label htmlFor="trackBatches" className="font-semibold text-sm cursor-pointer flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center">
                                <Package className="w-4 h-4 text-pink-600" />
                              </div>
                              Seguimiento de Lotes
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1.5 ml-10">
                              Registra número de lote/batch en cada movimiento de inventario
                            </p>
                          </div>
                          <Controller
                            name="trackBatches"
                            control={control}
                            render={({ field }) => (
                              <Switch
                                id="trackBatches"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            )}
                          />
                        </div>

                        {/* Control de Vencimiento */}
                        <div className="flex items-center justify-between p-4 bg-background border-2 border-pink-200/50 rounded-lg hover:border-pink-300 transition-colors">
                          <div className="flex-1">
                            <Label htmlFor="trackExpiration" className="font-semibold text-sm cursor-pointer flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center">
                                <TrendingUp className="w-4 h-4 text-pink-600" />
                              </div>
                              Control de Vencimiento
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1.5 ml-10">
                              Registra fecha de vencimiento en ingresos de stock para alertas automáticas
                            </p>
                          </div>
                          <Controller
                            name="trackExpiration"
                            control={control}
                            render={({ field }) => (
                              <Switch
                                id="trackExpiration"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Analytics Tab - Solo en modo edición */}
                {false /* create-only dialog */ && product?.id && (
                  <TabsContent value="analytics" className="space-y-4">
                    <Suspense fallback={<Skeleton className="h-64" />}>
                      <ProductAnalyticsTab productId={product.id} />
                    </Suspense>
                  </TabsContent>
                )}
              </Tabs>
            </form>
          )}
        </DialogBody>

        <DialogFooter className="border-t pt-4">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" form="product-create-form" disabled={isLoading || loadingData}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Crear Producto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Dialog de confirmación para campos importantes */}
    <AlertDialog open={confirmDisable?.open || false} onOpenChange={(open) => !open && setConfirmDisable(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Ocultar campo {confirmDisable?.featureName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Este campo es importante para la gestión de productos. ¿Estás seguro de que deseas ocultarlo?
            Podrás volver a habilitarlo desde el modo configuración.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              if (confirmDisable) {
                await toggleFeature(confirmDisable.featureId, false);
                setConfirmDisable(null);
              }
            }}
          >
            Sí, ocultar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
