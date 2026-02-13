/**
 * Configuración de funcionalidades del formulario de productos
 *
 * Similar al sistema de clientes, cada empresa puede habilitar/deshabilitar estas funcionalidades
 * El superadmin define cuántas funcionalidades máximas puede tener cada empresa
 */

export interface ProductFormFeature {
  id: string;
  name: string;
  description: string;
  category: 'basic' | 'costs' | 'pricing' | 'stock' | 'specifications' | 'packaging' | 'advanced';
  fields: string[]; // Campos del formulario que incluye
  isCore?: boolean; // Si es true, siempre está habilitado (no se puede desactivar)
}

export const PRODUCT_FORM_FEATURES: ProductFormFeature[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // BÁSICOS (siempre habilitados, no se pueden desactivar)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'basicInfo',
    name: 'Información Básica',
    description: 'Nombre, código, categoría, unidad (campos obligatorios)',
    category: 'basic',
    fields: ['name', 'code', 'categoryId', 'unit'],
    isCore: true,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // BÁSICOS OPCIONALES
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'description',
    name: 'Descripción',
    description: 'Descripción del producto',
    category: 'basic',
    fields: ['description'],
  },
  {
    id: 'supplier',
    name: 'Proveedor',
    description: 'Proveedor principal del producto',
    category: 'basic',
    fields: ['supplierId'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // COSTOS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'costType',
    name: 'Tipo de Costo',
    description: 'Manual, Compra o Producción',
    category: 'costs',
    fields: ['costType'],
  },
  {
    id: 'costPrice',
    name: 'Precio de Costo',
    description: 'Precio de costo y moneda',
    category: 'costs',
    fields: ['costPrice', 'costCurrency'],
  },
  {
    id: 'recipe',
    name: 'Receta de Producción',
    description: 'Receta para calcular costo de producción',
    category: 'costs',
    fields: ['recipeId'],
  },
  {
    id: 'purchaseProduct',
    name: 'Producto de Compra',
    description: 'Producto de compra para actualizar costo',
    category: 'costs',
    fields: ['purchaseInputId'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PRECIOS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'salePrice',
    name: 'Precio de Venta',
    description: 'Precio de venta y moneda',
    category: 'pricing',
    fields: ['salePrice', 'saleCurrency'],
  },
  {
    id: 'margin',
    name: 'Márgenes',
    description: 'Margen mínimo y máximo',
    category: 'pricing',
    fields: ['marginMin', 'marginMax'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // CÓDIGOS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'barcode',
    name: 'Código de Barras',
    description: 'Código de barras del producto',
    category: 'basic',
    fields: ['barcode'],
  },
  {
    id: 'sku',
    name: 'SKU',
    description: 'Stock Keeping Unit',
    category: 'basic',
    fields: ['sku'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // STOCK
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'currentStock',
    name: 'Stock Actual',
    description: 'Cantidad actual en stock',
    category: 'stock',
    fields: ['currentStock'],
  },
  {
    id: 'minStock',
    name: 'Stock Mínimo',
    description: 'Stock mínimo para alertas',
    category: 'stock',
    fields: ['minStock'],
  },
  {
    id: 'location',
    name: 'Ubicación',
    description: 'Ubicación física en almacén',
    category: 'stock',
    fields: ['location'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ESPECIFICACIONES
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'weight',
    name: 'Peso',
    description: 'Peso del producto',
    category: 'specifications',
    fields: ['weight'],
  },
  {
    id: 'volume',
    name: 'Volumen',
    description: 'Volumen del producto',
    category: 'specifications',
    fields: ['volume'],
  },
  {
    id: 'areaConversion',
    name: 'Conversión por Área',
    description: 'Unidades por área (m²)',
    category: 'specifications',
    fields: ['unitsPerArea', 'areaUnit'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ENVASADO
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'packaging',
    name: 'Tipo de Envasado',
    description: 'Tipo de envasado del producto',
    category: 'packaging',
    fields: ['packagingTypeId'],
  },
  {
    id: 'unitsPerPackage',
    name: 'Unidades por Paquete',
    description: 'Cantidad de unidades por paquete',
    category: 'packaging',
    fields: ['unitsPerPackage'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // AVANZADO
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'images',
    name: 'Imágenes',
    description: 'Imágenes del producto',
    category: 'advanced',
    fields: ['images'],
  },
  {
    id: 'traceability',
    name: 'Trazabilidad',
    description: 'Seguimiento de lotes y vencimientos',
    category: 'advanced',
    fields: ['trackBatches', 'trackExpiration'],
  },
  {
    id: 'tags',
    name: 'Etiquetas',
    description: 'Etiquetas para clasificación',
    category: 'advanced',
    fields: ['tags'],
  },
];

// Categorías para agrupar en la UI
export const FEATURE_CATEGORIES = [
  { id: 'basic', name: 'Básico', description: 'Campos esenciales' },
  { id: 'costs', name: 'Costos', description: 'Información de costos' },
  { id: 'pricing', name: 'Precios', description: 'Precios y márgenes' },
  { id: 'stock', name: 'Stock', description: 'Control de inventario' },
  { id: 'specifications', name: 'Especificaciones', description: 'Medidas y dimensiones' },
  { id: 'packaging', name: 'Envasado', description: 'Información de empaque' },
  { id: 'advanced', name: 'Avanzado', description: 'Funciones adicionales' },
];

// Configuración por defecto
export const DEFAULT_ENABLED_FEATURES: Record<string, boolean> = {
  // Básicos siempre true (isCore)
  basicInfo: true,

  // Opcionales por defecto activados
  description: true,
  costType: true,
  costPrice: true,
  salePrice: true,
  margin: true,
  barcode: true,
  currentStock: true,
  minStock: true,
  location: true,

  // Opcionales por defecto desactivados
  supplier: false,
  recipe: false,
  purchaseProduct: false,
  sku: false,
  weight: false,
  volume: false,
  areaConversion: false,
  packaging: false,
  unitsPerPackage: false,
  images: false,
  traceability: false,
  tags: false,
};

// Helper para obtener features habilitadas
export function getEnabledFeatures(config: Record<string, boolean>): ProductFormFeature[] {
  return PRODUCT_FORM_FEATURES.filter(f => f.isCore || config[f.id]);
}

// Helper para obtener todos los campos habilitados
export function getEnabledFields(config: Record<string, boolean>): string[] {
  const enabledFeatures = getEnabledFeatures(config);
  return enabledFeatures.flatMap(f => f.fields);
}

// Helper para contar features opcionales habilitadas
export function countEnabledOptionalFeatures(config: Record<string, boolean>): number {
  return PRODUCT_FORM_FEATURES.filter(f => !f.isCore && config[f.id]).length;
}

// Helper para verificar si una feature puede habilitarse (respetando límite)
export function canEnableFeature(
  config: Record<string, boolean>,
  featureId: string,
  maxFeatures: number | null
): boolean {
  if (maxFeatures === null) return true;
  const currentCount = countEnabledOptionalFeatures(config);
  const feature = PRODUCT_FORM_FEATURES.find(f => f.id === featureId);
  if (!feature || feature.isCore) return true;
  if (config[featureId]) return true; // Ya está habilitada
  return currentCount < maxFeatures;
}
