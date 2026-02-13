# PLAN DE MEJORAS MÓDULO VENTAS - SISTEMA CONFIGURABLE POR EMPRESA

## 🎯 OBJETIVO
Transformar el módulo de ventas en un sistema 100% configurable mediante templates que se adapte a CUALQUIER tipo de empresa, manteniendo el sistema dual T1/T2 (Formal/Informal).

---

## 📊 ANÁLISIS ACTUAL

### ✅ LO QUE FUNCIONA BIEN
- 50+ modelos Prisma bien estructurados
- 144 rutas API funcionales
- Sistema dual T1/T2 implementado
- State machine básica
- Validación de crédito con ViewMode
- 89 componentes frontend
- Configuración centralizada (SalesConfig)
- Sistema de aprobaciones multi-nivel
- Auditoría completa

### ⚠️ PROBLEMAS CRÍTICOS IDENTIFICADOS

#### 1. HARDCODING MASIVO
```typescript
// lib/ventas/commission-calculator.ts
const baseCommission = orden.seller?.commissionRate || 3; // ❌ Hardcoded
const MARGEN_MINIMO = 15;                                  // ❌ Hardcoded
const MONTO_ALTO = 500000;                                 // ❌ Hardcoded

// lib/ventas/approval-service.ts
const MARGEN_MINIMO = 15;                                  // ❌ Hardcoded
const MONTO_ALTO = 500000;                                 // ❌ Hardcoded
```

#### 2. CONFIGURACIÓN INSUFICIENTE
- SalesConfig existe pero es limitado
- No hay templates de documentos configurables
- Workflows hardcodeados en el código
- Campos obligatorios poco flexibles
- Reglas de negocio no configurables por industria

#### 3. VALIDACIONES INCOMPLETAS
- Crédito no se valida antes de confirmar orden
- Stock no se reserva correctamente
- Márgenes no se validan según configuración
- Duplicados no se detectan
- AFIP no valida CUIT/fechas correctamente

#### 4. FALTA DE TEMPLATES POR INDUSTRIA
- No hay perfiles predefinidos (construcción, retail, industrial, etc.)
- Cada empresa debe configurar todo manualmente
- No hay mejores prácticas incorporadas

---

## 🚀 PLAN DE MEJORAS - FASE POR FASE

### FASE 1: CONFIGURACIÓN AVANZADA POR EMPRESA (CRITICAL) ⚡

#### 1.1 Expandir SalesConfig con Templates
**Archivo**: `prisma/schema.prisma`

```prisma
model CompanyTemplate {
  id          Int      @id @default(autoincrement())
  companyId   Int
  nombre      String   // "Construcción Industrial", "Retail B2C", "Distribuidora B2B"
  industria   IndustryType // CONSTRUCCION, RETAIL, MANUFACTURA, DISTRIBUCION, SERVICIOS
  isActive    Boolean  @default(true)

  // Configuración del template
  config      Json     // Todo el JSON de configuración

  // Campos obligatorios por documento
  camposObligatoriosCliente    Json
  camposObligatoriosCotizacion Json
  camposObligatoriosOrden      Json
  camposObligatoriosEntrega    Json
  camposObligatoriosFactura    Json

  // Workflows configurables
  workflowCotizacion Json
  workflowOrden      Json
  workflowEntrega    Json
  workflowFactura    Json
  workflowPago       Json

  // Validaciones por industria
  validacionesCredito Json
  validacionesStock   Json
  validacionesMargen  Json
  validacionesPrecios Json

  // Términos y condiciones por documento
  terminosYCondicionesCotizacion String?
  terminosYCondicionesOrden      String?
  terminosYCondicionesFactura    String?

  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@unique([companyId, nombre])
  @@index([companyId])
  @@index([industria])
}

enum IndustryType {
  CONSTRUCCION
  RETAIL
  MANUFACTURA
  DISTRIBUCION
  SERVICIOS
  AGRO
  TECNOLOGIA
  ALIMENTOS
  TEXTIL
  AUTOMOTRIZ
  FARMACEUTICA
  OTRO
}
```

#### 1.2 BusinessRules Configurables
**Archivo**: `prisma/schema.prisma`

```prisma
model SalesBusinessRule {
  id          Int      @id @default(autoincrement())
  companyId   Int
  nombre      String
  descripcion String?
  tipo        RuleType
  prioridad   Int      @default(0)
  isActive    Boolean  @default(true)

  // Condiciones (JSON con estructura flexible)
  condiciones Json

  // Acciones a tomar
  accion      RuleAction
  parametros  Json

  // Enforcement
  enforcement EnforcementLevel
  mensaje     String?  // Mensaje a mostrar al usuario

  // Aplicable a
  aplicaA     String[] // ["COTIZACION", "ORDEN", "FACTURA"]

  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([companyId, isActive])
  @@index([tipo])
}

enum RuleType {
  CREDITO_LIMIT
  STOCK_VALIDATION
  MARGIN_VALIDATION
  PRICE_VALIDATION
  DUPLICATE_PREVENTION
  DISCOUNT_LIMIT
  PAYMENT_TERMS
  DELIVERY_WINDOW
  APPROVAL_REQUIRED
  CUSTOM
}

enum RuleAction {
  BLOCK          // Bloquear operación
  WARN           // Advertir pero permitir
  REQUIRE_APPROVAL // Requerir aprobación
  AUTO_ADJUST    // Ajustar automáticamente
  LOG_ONLY       // Solo registrar
}

enum EnforcementLevel {
  STRICT   // No se puede omitir
  WARNING  // Se puede omitir con advertencia
  DISABLED // Regla deshabilitada
}
```

#### 1.3 Pricing Strategies Configurables
**Archivo**: `prisma/schema.prisma`

```prisma
model PricingStrategy {
  id          Int      @id @default(autoincrement())
  companyId   Int
  nombre      String
  descripcion String?
  isDefault   Boolean  @default(false)
  isActive    Boolean  @default(true)

  // Tipo de estrategia
  tipo        PricingType

  // Configuración (JSON flexible)
  config      Json

  // Prioridad de aplicación
  prioridad   Int      @default(0)

  // Aplicable a
  aplicaClientes    String[] // IDs o tags de clientes
  aplicaProductos   String[] // IDs o categorías
  aplicaZonas       String[] // IDs de zonas

  // Validez temporal
  validoDesde DateTime?
  validoHasta DateTime?

  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([companyId, isActive])
  @@index([tipo])
}

enum PricingType {
  FIXED_PRICE      // Precio fijo de lista
  COST_PLUS        // Costo + margen
  MARKET_BASED     // Basado en mercado
  VOLUME_DISCOUNT  // Descuento por volumen
  TIERED          // Por escalas
  DYNAMIC         // Dinámico (oferta/demanda)
  NEGOTIATED      // Negociado
  CONTRACT        // Por contrato
}
```

#### 1.4 Document Templates
**Archivo**: `prisma/schema.prisma`

```prisma
model DocumentTemplate {
  id          Int      @id @default(autoincrement())
  companyId   Int
  tipo        DocumentType
  nombre      String
  descripcion String?

  // Template HTML/React/PDF
  templateHtml     String?  @db.Text
  templateReact    String?  @db.Text
  templatePdfProps Json?

  // Estilos CSS
  styles      Json?

  // Variables disponibles
  variables   Json

  // Condiciones de uso
  aplicaDocType    String[] // ["T1", "T2"]
  aplicaClientes   String[] // Tags o IDs

  isDefault   Boolean  @default(false)
  isActive    Boolean  @default(true)

  company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([companyId, tipo, nombre])
  @@index([companyId, tipo])
}

enum DocumentType {
  COTIZACION
  ORDEN_VENTA
  REMITO
  FACTURA
  RECIBO
  NOTA_CREDITO
  NOTA_DEBITO
  ESTADO_CUENTA
  COMPROBANTE_ENTREGA
}
```

---

### FASE 2: SISTEMA DE VALIDACIONES DINÁMICAS (HIGH) 🔒

#### 2.1 Validation Engine
**Archivo nuevo**: `lib/ventas/validation-engine.ts`

```typescript
interface ValidationRule {
  id: string;
  nombre: string;
  tipo: RuleType;
  condiciones: ValidationCondition[];
  accion: RuleAction;
  enforcement: EnforcementLevel;
  mensaje: string;
}

interface ValidationCondition {
  campo: string;
  operador: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains' | 'custom';
  valor: any;
  customValidator?: (value: any, context: any) => boolean;
}

class ValidationEngine {
  async validate(
    entityType: 'COTIZACION' | 'ORDEN' | 'FACTURA',
    entity: any,
    context: ValidationContext
  ): Promise<ValidationResult> {
    // 1. Cargar reglas activas para esta empresa
    const rules = await this.loadRules(context.companyId, entityType);

    // 2. Aplicar reglas en orden de prioridad
    const results: ValidationResult[] = [];
    for (const rule of rules) {
      const result = await this.applyRule(rule, entity, context);
      results.push(result);

      // Si es STRICT y falla, detener
      if (rule.enforcement === 'STRICT' && !result.valid) {
        break;
      }
    }

    return this.mergeResults(results);
  }
}
```

#### 2.2 Pre-Transaction Validators
**Archivo nuevo**: `lib/ventas/pre-transaction-validators.ts`

```typescript
// Validar ANTES de confirmar orden
export async function validateOrderConfirmation(
  orderId: number,
  context: ValidationContext
): Promise<ValidationResult> {
  const validators = [
    validateCreditLimit,
    validateStockAvailability,
    validateMinimumMargin,
    validateDuplicateOrder,
    validateClientStatus,
    validateProductPrices,
    validateApprovals,
  ];

  for (const validator of validators) {
    const result = await validator(orderId, context);
    if (!result.valid && result.severity === 'ERROR') {
      return result;
    }
  }

  return { valid: true };
}

// Validar crédito disponible
async function validateCreditLimit(
  orderId: number,
  context: ValidationContext
): Promise<ValidationResult> {
  const orden = await prisma.sale.findUnique({
    where: { id: orderId },
    include: { client: true }
  });

  // Usar credit-validator con reglas configurables
  const creditResult = await CreditValidator.validate(
    orden.clientId,
    orden.total,
    context
  );

  return creditResult;
}
```

---

### FASE 3: TEMPLATES PRECONSTRUIDOS POR INDUSTRIA (MEDIUM) 🏭

#### 3.1 Seeds de Templates
**Archivo nuevo**: `prisma/seeds/industry-templates.ts`

```typescript
export const TEMPLATES_CONSTRUCCION = {
  nombre: "Construcción Industrial",
  industria: "CONSTRUCCION",
  config: {
    // Validaciones específicas de construcción
    validarCertificadosObra: true,
    validarCapacidadCarga: true,
    requiereCroquis: true,

    // Términos de pago comunes
    terminosPagoDefault: "30-60-90 días",
    permitePagoObra: true,

    // Entregas
    requiereProgramacionEntrega: true,
    horariosEntregaPermitidos: ["06:00-18:00"],

    // Documentación
    requiereRemito: true,
    requiereCertificadoCalidad: true,
  },
  camposObligatoriosCliente: {
    required: ["legalName", "cuit", "address", "obra"],
    optional: ["email", "phone"],
  },
  camposObligatoriosCotizacion: {
    required: ["items", "lugarEntrega", "condicionesPago"],
    optional: ["validoHasta", "notas"],
  },
  workflowOrden: {
    estados: [
      "BORRADOR",
      "PENDIENTE_APROBACION", // Si monto > límite
      "CONFIRMADA",
      "EN_PREPARACION",
      "LISTA_DESPACHO",
      "DESPACHADA",
      "ENTREGADA",
      "FACTURADA",
      "COMPLETADA"
    ],
    transiciones: {
      BORRADOR: ["PENDIENTE_APROBACION", "CONFIRMADA"],
      PENDIENTE_APROBACION: ["CONFIRMADA", "BORRADOR"],
      CONFIRMADA: ["EN_PREPARACION"],
      // ... etc
    },
    aprobaciones: {
      PENDIENTE_APROBACION: {
        condicion: "total > 500000",
        niveles: 2,
        roles: ["GERENTE_VENTAS", "GERENTE_GENERAL"]
      }
    }
  },
  validacionesCredito: {
    validarLimite: true,
    bloquearSiExcede: false, // Permitir pero con aprobación
    diasGracia: 5,
    permitirSobregiro: 0.10 // 10%
  },
  validacionesStock: {
    validarDisponibilidad: true,
    permitirVentaSinStock: false,
    reservarEnCotizacion: false,
    reservarEnOrden: true
  },
  validacionesMargen: {
    margenMinimo: 15,
    margenRecomendado: 25,
    alertarSiMenorA: 20
  }
};

export const TEMPLATES_RETAIL = {
  nombre: "Retail B2C",
  industria: "RETAIL",
  config: {
    // Ventas rápidas
    requiereAprobacion: false,
    ventaDirecta: true,

    // Pagos inmediatos
    terminosPagoDefault: "CONTADO",
    aceptaTarjetas: true,
    aceptaEfectivo: true,

    // Sin crédito
    creditoHabilitado: false,

    // Stock en tiempo real
    mostrarStockCliente: true,
    actualizarStockInmediato: true,
  },
  workflowOrden: {
    estados: ["CONFIRMADA", "FACTURADA", "ENTREGADA", "COMPLETADA"],
    transiciones: {
      CONFIRMADA: ["FACTURADA"],
      FACTURADA: ["ENTREGADA"],
      ENTREGADA: ["COMPLETADA"]
    }
  },
  validacionesStock: {
    validarDisponibilidad: true,
    permitirVentaSinStock: false,
    reservarEnOrden: true,
    liberarSiNoPaga: true,
    tiempoReserva: 30 // minutos
  }
};

export const TEMPLATES_DISTRIBUCION = {
  nombre: "Distribuidora B2B",
  industria: "DISTRIBUCION",
  config: {
    // Crédito extenso
    creditoHabilitado: true,
    diasCreditoDefault: 30,

    // Descuentos por volumen
    descuentosVolumetricos: true,
    descuentosPorPago: true,

    // Múltiples entregas
    permiteParciales: true,
    rutasOptimizadas: true,

    // Facturación flexible
    facturaConsolidada: true, // Múltiples entregas en una factura
    frecuenciaFacturacion: "SEMANAL"
  }
};
```

---

### FASE 4: INTERFAZ DE CONFIGURACIÓN INTUITIVA (MEDIUM) 🎨

#### 4.1 Wizard de Configuración Inicial
**Archivo nuevo**: `app/administracion/ventas/configuracion/wizard/page.tsx`

```typescript
// Step 1: Seleccionar industria
<IndustrySelector
  onSelect={(industria) => {
    // Cargar template base
    const template = INDUSTRY_TEMPLATES[industria];
    setConfig(template);
  }}
/>

// Step 2: Personalizar campos obligatorios
<RequiredFieldsConfigurator
  entityType="CLIENTE"
  defaultFields={config.camposObligatoriosCliente}
  onChange={updateConfig}
/>

// Step 3: Configurar workflows
<WorkflowBuilder
  documentType="ORDEN"
  states={config.workflowOrden.estados}
  transitions={config.workflowOrden.transiciones}
  onChange={updateWorkflow}
/>

// Step 4: Configurar validaciones
<ValidationRulesBuilder
  rules={config.validaciones}
  onChange={updateValidations}
/>

// Step 5: Templates de documentos
<DocumentTemplateSelector
  documentType="FACTURA"
  templates={availableTemplates}
  onChange={selectTemplate}
/>
```

#### 4.2 Visual Workflow Builder
**Componente nuevo**: `components/ventas/workflow-builder.tsx`

```typescript
import ReactFlow from 'reactflow';

export function WorkflowBuilder({ documentType, onChange }) {
  const [nodes, setNodes] = useState([
    { id: 'BORRADOR', data: { label: 'Borrador' } },
    { id: 'CONFIRMADA', data: { label: 'Confirmada' } },
    // ...
  ]);

  const [edges, setEdges] = useState([
    { id: 'e1', source: 'BORRADOR', target: 'CONFIRMADA' },
    // ...
  ]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={(changes) => {
        // Actualizar estados
      }}
      onEdgesChange={(changes) => {
        // Actualizar transiciones
      }}
    />
  );
}
```

---

### FASE 5: MIGRAR HARDCODING A CONFIGURACIÓN (CRITICAL) 🔧

#### 5.1 Mover Comisiones a Configuración
**Archivo**: `lib/ventas/commission-calculator.ts`

```typescript
// ANTES (Hardcoded):
const baseCommission = orden.seller?.commissionRate || 3;
const MARGEN_MINIMO = 15;

// DESPUÉS (Configurable):
export async function calculateCommission(orden: Sale, config: SalesConfig) {
  // Obtener tasa base de configuración
  const baseCommission = config.commissionRateDefault || 3;

  // Obtener margen mínimo de reglas de negocio
  const marginRule = await prisma.salesBusinessRule.findFirst({
    where: {
      companyId: orden.companyId,
      tipo: 'MARGIN_VALIDATION',
      isActive: true
    }
  });

  const margenMinimo = marginRule?.parametros?.margenMinimo || 15;

  // Calcular con valores configurables
  let commission = baseCommission;

  // Bonos por volumen (configurables)
  if (orden.total > config.commissionVolumeThreshold1) {
    commission += config.commissionVolumeBonus1;
  }

  // Bonos por margen (configurables)
  const margen = (orden.margenBruto / orden.subtotal) * 100;
  if (margen > config.commissionMarginThreshold) {
    commission += config.commissionMarginBonus;
  }

  return commission;
}
```

#### 5.2 Agregar a SalesConfig
**Archivo**: `prisma/schema.prisma` - Expandir SalesConfig

```prisma
model SalesConfig {
  // ... campos existentes ...

  // COMISIONES CONFIGURABLES
  commissionRateDefault      Decimal? @default(3) @db.Decimal(5,2)
  commissionVolumeThreshold1 Decimal? @default(100000) @db.Decimal(15,2)
  commissionVolumeBonus1     Decimal? @default(1) @db.Decimal(5,2)
  commissionVolumeThreshold2 Decimal? @default(500000) @db.Decimal(15,2)
  commissionVolumeBonus2     Decimal? @default(2) @db.Decimal(5,2)
  commissionMarginThreshold  Decimal? @default(25) @db.Decimal(5,2)
  commissionMarginBonus      Decimal? @default(1.5) @db.Decimal(5,2)

  // MÁRGENES CONFIGURABLES
  marginMinimo               Decimal? @default(15) @db.Decimal(5,2)
  marginRecomendado          Decimal? @default(25) @db.Decimal(5,2)
  marginAlerta               Decimal? @default(20) @db.Decimal(5,2)

  // MONTOS CONFIGURABLES
  montoAprobacionAlto        Decimal? @default(500000) @db.Decimal(15,2)
  montoAprobacionMuyAlto     Decimal? @default(1000000) @db.Decimal(15,2)

  // DESCUENTOS CONFIGURABLES
  descuentoMaxSinAprobacion  Decimal? @default(10) @db.Decimal(5,2)
  descuentoMaxConAprobacion  Decimal? @default(25) @db.Decimal(5,2)
}
```

---

## 📋 IMPLEMENTACIÓN PRIORIZADA

### SPRINT 1 (Esta semana) - CRITICAL
1. ✅ Crear modelo CompanyTemplate
2. ✅ Crear modelo SalesBusinessRule
3. ✅ Crear modelo PricingStrategy
4. ✅ Crear modelo DocumentTemplate
5. ✅ Migrar hardcoding a SalesConfig expandido
6. ✅ Crear validation-engine.ts
7. ✅ Seeds de templates por industria

### SPRINT 2 (Próxima semana) - HIGH
1. Implementar pre-transaction-validators.ts
2. Crear wizard de configuración inicial
3. Implementar visual workflow builder
4. Crear APIs de configuración de templates
5. Testing de validaciones

### SPRINT 3 (Siguiente) - MEDIUM
1. Portal de cliente con templates
2. PDF generator con templates
3. Email templates configurables
4. Dashboard por industria
5. Reportes configurables

### BACKLOG - LOW
1. Machine learning para pricing
2. Optimización de rutas avanzada
3. Integración con ERP externos
4. Predicción de demanda

---

## 🎯 OBJETIVOS DE ÉXITO

### Técnicos
- ✅ 0 valores hardcodeados en código de negocio
- ✅ 100% de reglas configurables por empresa
- ✅ Workflows visuales y editables
- ✅ Templates por industria listos para usar
- ✅ Validaciones dinámicas funcionando

### Usuario
- ✅ Setup inicial en < 10 minutos con wizard
- ✅ Cambios de configuración sin código
- ✅ Templates arrastra y suelta
- ✅ Documentación clara para cada industria

### Negocio
- ✅ Adaptable a cualquier industria
- ✅ Escalable a miles de empresas
- ✅ Mantenimiento reducido (menos código hardcodeado)
- ✅ Onboarding más rápido

---

## 📖 DOCUMENTACIÓN ADICIONAL

### Guías por Industria
- [ ] Guía: Configuración para Construcción
- [ ] Guía: Configuración para Retail
- [ ] Guía: Configuración para Distribución
- [ ] Guía: Configuración para Servicios
- [ ] Guía: Configuración para Manufactura

### Videos Tutoriales
- [ ] Video: Wizard de configuración inicial
- [ ] Video: Configurar workflows personalizados
- [ ] Video: Crear templates de documentos
- [ ] Video: Configurar reglas de negocio

---

## 🚧 PRÓXIMOS PASOS INMEDIATOS

1. **Crear migración de nuevos modelos** (CompanyTemplate, SalesBusinessRule, etc.)
2. **Expandir SalesConfig** con campos configurables
3. **Crear validation-engine.ts** básico
4. **Crear seeds de templates** para 3 industrias principales
5. **Migrar commission-calculator.ts** a usar configuración
6. **Actualizar approval-service.ts** a usar reglas configurables
7. **Testing exhaustivo** de nuevas funcionalidades

---

**Última actualización**: 2026-02-07
**Versión**: 2.0
**Autor**: Claude Code
