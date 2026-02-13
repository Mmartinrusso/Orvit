/**
 * Configuración de funcionalidades del formulario de clientes
 *
 * Cada empresa puede habilitar/deshabilitar estas funcionalidades
 * El superadmin define cuántas funcionalidades máximas puede tener cada empresa
 */

export interface ClientFormFeature {
  id: string;
  name: string;
  description: string;
  category: 'basic' | 'contact' | 'financial' | 'commercial' | 'tax' | 'advanced';
  fields: string[]; // Campos del formulario que incluye
  isCore?: boolean; // Si es true, siempre está habilitado (no se puede desactivar)
}

export const CLIENT_FORM_FEATURES: ClientFormFeature[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // BÁSICOS (siempre habilitados, no se pueden desactivar)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'basicIdentification',
    name: 'Identificación Básica',
    description: 'Razón social, nombre fantasía, email (campos obligatorios)',
    category: 'basic',
    fields: ['legalName', 'name', 'email'],
    isCore: true,
  },
  {
    id: 'basicTax',
    name: 'Datos Fiscales',
    description: 'CUIT y condición fiscal',
    category: 'basic',
    fields: ['cuit', 'taxCondition'],
    isCore: true,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // BÁSICOS OPCIONALES
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'basicAddress',
    name: 'Dirección y Código Postal',
    description: 'Dirección y código postal',
    category: 'basic',
    fields: ['address', 'postalCode'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // CONTACTO (opcionales)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'phone',
    name: 'Teléfonos',
    description: 'Teléfono principal y alternativo',
    category: 'contact',
    fields: ['phone', 'alternatePhone'],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Número de WhatsApp del cliente',
    category: 'contact',
    fields: ['whatsapp'],
  },
  {
    id: 'contactPerson',
    name: 'Contacto Principal',
    description: 'Nombre del contacto principal',
    category: 'contact',
    fields: ['contactPerson'],
  },
  {
    id: 'extendedAddress',
    name: 'Dirección Extendida',
    description: 'Ciudad, provincia y zona de reparto',
    category: 'contact',
    fields: ['city', 'province', 'deliveryZoneId'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // CLASIFICACIÓN
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'clientType',
    name: 'Tipo de Cliente',
    description: 'Clasificación por tipo de cliente',
    category: 'commercial',
    fields: ['clientTypeId'],
  },
  {
    id: 'seller',
    name: 'Vendedor Asignado',
    description: 'Vendedor responsable del cliente',
    category: 'commercial',
    fields: ['sellerId'],
  },
  {
    id: 'businessSector',
    name: 'Rubro / Sector',
    description: 'Rubro o sector comercial del cliente',
    category: 'commercial',
    fields: ['businessSectorId'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // FINANCIERO
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'saleCondition',
    name: 'Condición de Venta',
    description: 'Contado, cuenta corriente, etc.',
    category: 'financial',
    fields: ['saleCondition', 'paymentTerms'],
  },
  {
    id: 'creditLimit',
    name: 'Límite de Crédito',
    description: 'Límite de crédito y días mercadería pendiente',
    category: 'financial',
    fields: ['creditLimit', 'merchandisePendingDays'],
  },
  {
    id: 'checkManagement',
    name: 'Gestión de Cheques',
    description: 'Días de cheque, tope de cheques',
    category: 'financial',
    fields: ['checkTerms', 'hasCheckLimit', 'checkLimitType', 'checkLimit'],
  },
  {
    id: 'invoiceConfig',
    name: 'Configuración de Facturación',
    description: 'Días vencimiento facturas, tipo condición venta (T1/T2/Mixto)',
    category: 'financial',
    fields: ['invoiceDueDays', 'tipoCondicionVenta', 'porcentajeFormal'],
  },
  {
    id: 'temporalOverrides',
    name: 'Cambios Temporales de Límites',
    description: 'Overrides temporales de límites de crédito',
    category: 'financial',
    fields: ['creditLimitOverride', 'creditLimitOverrideDays', 'tempCreditLimit'],
  },
  {
    id: 'extraBonus',
    name: 'Bonificación Extra',
    description: 'Bonificaciones comerciales especiales',
    category: 'financial',
    fields: ['extraBonusDescription'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // COMERCIAL / LOGÍSTICA
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'transport',
    name: 'Empresa de Transporte',
    description: 'Transporte asignado para entregas',
    category: 'commercial',
    fields: ['transportCompanyId'],
  },
  {
    id: 'settlementPeriod',
    name: 'Período de Liquidación',
    description: 'Semanal, quincenal o mensual',
    category: 'commercial',
    fields: ['settlementPeriod'],
  },
  {
    id: 'priceLists',
    name: 'Listas de Precios',
    description: 'Lista de precios y descuentos asignada',
    category: 'commercial',
    fields: ['defaultPriceListId', 'discountListId'],
  },
  {
    id: 'purchaseOrder',
    name: 'Orden de Compra',
    description: 'Exigir orden de compra para ventas',
    category: 'commercial',
    fields: ['requiresPurchaseOrder'],
  },
  {
    id: 'deliveryBlock',
    name: 'Bloqueo de Entregas',
    description: 'Permite bloquear entregas al cliente',
    category: 'commercial',
    fields: ['isDeliveryBlocked', 'deliveryBlockedReason'],
  },
  {
    id: 'visitDeliveryDays',
    name: 'Días de Visita/Entrega',
    description: 'Configurar días de visita del vendedor y de entrega',
    category: 'commercial',
    fields: ['visitDays', 'deliveryDays'],
  },
  {
    id: 'quickNote',
    name: 'Nota Rápida',
    description: 'Nota visible al vender a este cliente',
    category: 'commercial',
    fields: ['quickNote', 'quickNoteExpiry'],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // IMPUESTOS / EXENCIONES
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'taxDetails',
    name: 'Datos Impositivos Extendidos',
    description: 'Ingresos brutos, fecha inicio actividad',
    category: 'tax',
    fields: ['grossIncome', 'activityStartDate'],
  },
  {
    id: 'municipalRetention',
    name: 'Retención Municipal',
    description: 'Tipo de retención municipal',
    category: 'tax',
    fields: ['municipalRetentionType'],
  },
  {
    id: 'taxExemptions',
    name: 'Exenciones Impositivas',
    description: 'Exenciones de IVA, IIBB y municipales',
    category: 'tax',
    fields: [
      'isVatPerceptionExempt', 'vatPerceptionExemptUntil', 'vatPerceptionExemptCertificate',
      'isVatRetentionExempt', 'vatRetentionExemptUntil',
      'isGrossIncomeExempt', 'grossIncomeExemptUntil',
      'isMunicipalExempt', 'municipalExemptUntil'
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // AVANZADO
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'subclients',
    name: 'Subclientes',
    description: 'Permite definir relaciones padre-hijo entre clientes',
    category: 'advanced',
    fields: ['parentClientId'],
  },
  {
    id: 'observations',
    name: 'Observaciones',
    description: 'Campo de observaciones generales',
    category: 'advanced',
    fields: ['observations'],
  },
];

// Categorías para agrupar en la UI
export const FEATURE_CATEGORIES = [
  { id: 'basic', name: 'Básico', description: 'Campos esenciales (siempre activos)' },
  { id: 'contact', name: 'Contacto', description: 'Información de contacto' },
  { id: 'commercial', name: 'Comercial', description: 'Clasificación y logística' },
  { id: 'financial', name: 'Financiero', description: 'Crédito y pagos' },
  { id: 'tax', name: 'Impuestos', description: 'Datos fiscales y exenciones' },
  { id: 'advanced', name: 'Avanzado', description: 'Funciones adicionales' },
];

// Configuración por defecto (solo features opcionales)
export const DEFAULT_ENABLED_FEATURES: Record<string, boolean> = {
  // Básicos siempre true (isCore)
  basicIdentification: true,
  basicAddress: true,
  basicTax: true,
  // Opcionales por defecto activados
  phone: true,
  contactPerson: true,
  extendedAddress: true,
  clientType: true,
  seller: true,
  saleCondition: true,
  creditLimit: true,
  priceLists: true,
  observations: true,
  // Opcionales por defecto desactivados
  whatsapp: false,
  businessSector: false,
  checkManagement: false,
  invoiceConfig: false,
  temporalOverrides: false,
  transport: false,
  settlementPeriod: false,
  purchaseOrder: false,
  deliveryBlock: false,
  visitDeliveryDays: false,
  quickNote: false,
  taxDetails: false,
  municipalRetention: false,
  taxExemptions: false,
  subclients: false,
};

// Helper para obtener features habilitadas
export function getEnabledFeatures(config: Record<string, boolean>): ClientFormFeature[] {
  return CLIENT_FORM_FEATURES.filter(f => f.isCore || config[f.id]);
}

// Helper para obtener todos los campos habilitados
export function getEnabledFields(config: Record<string, boolean>): string[] {
  const enabledFeatures = getEnabledFeatures(config);
  return enabledFeatures.flatMap(f => f.fields);
}

// Helper para contar features opcionales habilitadas
export function countEnabledOptionalFeatures(config: Record<string, boolean>): number {
  return CLIENT_FORM_FEATURES.filter(f => !f.isCore && config[f.id]).length;
}

// Helper para verificar si una feature puede habilitarse (respetando límite)
export function canEnableFeature(
  config: Record<string, boolean>,
  featureId: string,
  maxFeatures: number | null
): boolean {
  if (maxFeatures === null) return true;
  const currentCount = countEnabledOptionalFeatures(config);
  const feature = CLIENT_FORM_FEATURES.find(f => f.id === featureId);
  if (!feature || feature.isCore) return true;
  if (config[featureId]) return true; // Ya está habilitada
  return currentCount < maxFeatures;
}
