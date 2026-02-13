# Cambios Fin de Semana - Sistema ORVIT

**Fecha:** Enero 2026
**Versión:** Sistema de Gestión Integral

---

## Resumen Ejecutivo

Este documento detalla todas las mejoras y nuevas funcionalidades implementadas en los módulos de **Compras**, **Ventas** y el nuevo módulo de **Tesorería**, junto con mejoras generales del sistema.

---

## 1. NUEVO MÓDULO: TESORERÍA

### 1.1 Descripción General

Se implementó un módulo completo de Tesorería que centraliza la gestión de fondos (efectivo, bancos, cheques) integrando los flujos de Compras y Ventas.

### 1.2 Estructura de Navegación

```
/administracion/tesoreria/
├── page.tsx                 # Dashboard principal (posición consolidada)
├── cajas/page.tsx           # Gestión de cajas de efectivo
├── bancos/page.tsx          # Gestión de cuentas bancarias
├── cheques/page.tsx         # Cartera de cheques
├── transferencias/page.tsx  # Transferencias internas
└── flujo-caja/page.tsx      # Proyección de flujo de caja
```

### 1.3 Modelos de Base de Datos Creados

#### CashAccount (Cajas de Efectivo)
```prisma
model CashAccount {
  id          Int      @id @default(autoincrement())
  companyId   Int
  codigo      String   @db.VarChar(20)
  nombre      String   @db.VarChar(100)
  moneda      String   @default("ARS")  // ARS, USD
  saldoActual Decimal  @default(0)
  isActive    Boolean  @default(true)
  esDefault   Boolean  @default(false)
}
```

#### CashMovement (Movimientos de Caja)
```prisma
model CashMovement {
  id            Int      @id @default(autoincrement())
  cashAccountId Int
  tipo          CashMovementType
  ingreso       Decimal
  egreso        Decimal
  saldoAnterior Decimal
  saldoPosterior Decimal
  fecha         DateTime
  docType       DocType  @default(T1)  // Soporta ViewMode
}

enum CashMovementType {
  INGRESO_COBRO
  EGRESO_PAGO
  INGRESO_DEPOSITO
  EGRESO_RETIRO
  INGRESO_CAMBIO
  EGRESO_CAMBIO
  AJUSTE_POSITIVO
  AJUSTE_NEGATIVO
  TRANSFERENCIA_IN
  TRANSFERENCIA_OUT
}
```

#### BankAccount (Cuentas Bancarias)
```prisma
model BankAccount {
  id           Int      @id @default(autoincrement())
  codigo       String   @db.VarChar(20)
  nombre       String   @db.VarChar(100)
  banco        String   @db.VarChar(100)
  tipoCuenta   String   // CC, CA
  numeroCuenta String
  cbu          String?
  alias        String?
  moneda       String   @default("ARS")
  saldoContable Decimal @default(0)
  saldoBancario Decimal @default(0)
}
```

#### BankMovement (Movimientos Bancarios)
```prisma
model BankMovement {
  id            Int      @id @default(autoincrement())
  bankAccountId Int
  tipo          BankMovementType
  ingreso       Decimal
  egreso        Decimal
  fecha         DateTime
  conciliado    Boolean  @default(false)
  // NO tiene docType - siempre se considera T1 (rastro electrónico)
}

enum BankMovementType {
  TRANSFERENCIA_IN
  TRANSFERENCIA_OUT
  DEPOSITO_EFECTIVO
  DEPOSITO_CHEQUE
  DEBITO_CHEQUE
  DEBITO_AUTOMATICO
  CREDITO_AUTOMATICO
  COMISION
  IMPUESTO
  INTERES
  AJUSTE
}
```

#### Cheque (Cartera Unificada)
```prisma
model Cheque {
  id            Int           @id @default(autoincrement())
  origen        ChequeOrigen  // RECIBIDO, EMITIDO
  tipo          ChequeTipo    // FISICO, ECHEQ
  numero        String
  banco         String
  titular       String
  importe       Decimal
  fechaEmision      DateTime
  fechaVencimiento  DateTime
  estado            ChequeEstado
  docType           DocType @default(T1)  // ECHEQ siempre T1
}

enum ChequeOrigen {
  RECIBIDO   // De cliente
  EMITIDO    // A proveedor
}

enum ChequeEstado {
  CARTERA
  DEPOSITADO
  COBRADO
  RECHAZADO
  ENDOSADO
  ANULADO
  VENCIDO
}
```

#### TreasuryTransfer (Transferencias Internas)
```prisma
model TreasuryTransfer {
  id              Int      @id @default(autoincrement())
  numero          String
  origenCajaId    Int?
  origenBancoId   Int?
  destinoCajaId   Int?
  destinoBancoId  Int?
  importe         Decimal
  moneda          String
  fecha           DateTime
  estado          TransferStatus
}
```

### 1.4 APIs Implementadas

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/tesoreria/cajas` | GET | Listar cajas con saldos |
| `/api/tesoreria/cajas` | POST | Crear nueva caja |
| `/api/tesoreria/bancos` | GET | Listar cuentas bancarias |
| `/api/tesoreria/bancos` | POST | Crear cuenta bancaria |
| `/api/tesoreria/cheques` | GET | Cartera de cheques |
| `/api/tesoreria/cheques/[id]` | PATCH | Acciones: depositar, cobrar, rechazar, endosar |
| `/api/tesoreria/transferencias` | POST | Realizar transferencia interna |
| `/api/tesoreria/posicion` | GET | Posición consolidada |
| `/api/tesoreria/flujo-caja` | GET | Proyección de flujo de caja |

### 1.5 Páginas Frontend Creadas

#### Dashboard de Tesorería (`/administracion/tesoreria`)
- KPIs de posición actual (Cajas, Bancos, Cheques, Total)
- Próximos vencimientos (cheques y facturas)
- Gráfico de flujo de caja proyectado

#### Cajas de Efectivo (`/administracion/tesoreria/cajas`)
- Lista de cajas con saldos por moneda (ARS/USD)
- Crear nueva caja (código, nombre, moneda)
- Ver movimientos por caja
- Acciones: Ingreso/Egreso manual
- Soporte ViewMode: muestra saldo T1 y Total en modo extendido

#### Cuentas Bancarias (`/administracion/tesoreria/bancos`)
- Lista de cuentas con saldos contable vs bancario
- Crear cuenta (banco, tipo, CBU, alias)
- Bancos argentinos precargados:
  - Banco Nación, Provincia, Galicia, Santander, BBVA
  - Macro, HSBC, ICBC, Credicoop, Patagonia
  - Ciudad, Supervielle, Comafi, Brubank, Ualá, Mercado Pago
- Indicador de diferencia de conciliación

#### Cartera de Cheques (`/administracion/tesoreria/cheques`)
- Lista unificada (recibidos de clientes + emitidos a proveedores)
- Filtros por estado y origen
- KPIs por estado (Cartera, Depositados, Cobrados, etc.)
- Acciones: Depositar, Endosar, Cobrar, Rechazar, Anular
- Soporte ViewMode para cheques físicos

#### Transferencias Internas (`/administracion/tesoreria/transferencias`)
- Formulario para transferir entre cajas y bancos
- Selección de origen (Caja/Banco) y destino
- Historial de transferencias realizadas

#### Flujo de Caja (`/administracion/tesoreria/flujo-caja`)
- Proyección a 7, 14 o 30 días
- KPIs: Posición actual, Ingresos proyectados, Egresos proyectados, Saldo proyectado
- Tabla diaria con ingresos, egresos y saldo acumulado
- Alertas de déficit y saldo bajo
- Detalle de cheques por cobrar y pagos pendientes

### 1.6 Reglas de ViewMode en Tesorería

| Componente | T1 (Documentado) | T2 (Extendido) | Razón |
|------------|------------------|----------------|-------|
| Caja ARS/USD | ✓ | ✓ | Efectivo físico no rastrea |
| CashMovement | ✓ | ✓ | Hereda de operación |
| BankAccount | ✓ | ✗ | Rastro electrónico |
| BankMovement | ✓ | ✗ | Rastro electrónico |
| Cheque FISICO | ✓ | ✓ | Papel físico |
| Cheque ECHEQ | ✓ | ✗ | Rastro electrónico |

---

## 2. MÓDULO DE COMPRAS - Mejoras

### 2.1 Integración con Tesorería

Los pagos a proveedores ahora generan automáticamente:
- `CashMovement` cuando hay pago en efectivo
- `BankMovement` cuando hay transferencia
- `Cheque` (EMITIDO) cuando se usan cheques propios
- Actualización de cheques de terceros (ENDOSADO) cuando se endosan

### 2.2 Campos Agregados

```prisma
model PurchaseReceipt {
  // ... campos existentes
  docType  DocType  @default(T1)  // Soporte ViewMode
}

model PurchaseOrder {
  docType  DocType  @default(T1)
}

model GoodsReceipt {
  docType  DocType  @default(T1)
}

model PaymentOrder {
  docType  DocType  @default(T1)
  // Relaciones con Tesorería
  cashMovements  CashMovement[]
  bankMovements  BankMovement[]
  chequesEmitidos Cheque[] @relation("ChequePaymentOrder")
}
```

### 2.3 Stock con ViewMode

El stock ahora se calcula on-the-fly según el modo de visualización:
- Modo Standard (S): Solo suma movimientos T1
- Modo Extended (E): Suma todos los movimientos

---

## 3. MÓDULO DE VENTAS - Mejoras

### 3.1 Sistema de Cobros Mejorado

#### API `/api/ventas/pagos`

**GET** - Listar pagos:
- Soporta parámetros `status` y `estado` para compatibilidad
- Filtros por cliente, fecha, búsqueda
- Incluye allocations, cheques y datos del creador

**POST** - Registrar cobro:
- Múltiples métodos de pago simultáneos:
  - Efectivo
  - Transferencia
  - Cheques de terceros
  - Cheques propios
  - Tarjeta de crédito/débito
  - Otros medios
- Retenciones (IVA, Ganancias, Ingresos Brutos)
- Aplicación a múltiples facturas
- Registro automático en cuenta corriente (ClientLedgerEntry)
- Actualización de deuda del cliente

### 3.2 Integración con Tesorería

Los cobros de clientes ahora generan automáticamente:
- `CashMovement` (INGRESO_COBRO) cuando hay efectivo
- `BankMovement` (TRANSFERENCIA_IN) cuando hay transferencia
- `Cheque` (RECIBIDO) cuando se reciben cheques

### 3.3 Campos en ClientPayment

```prisma
model ClientPayment {
  // Montos por método
  totalPago       Decimal
  efectivo        Decimal
  transferencia   Decimal
  chequesTerceros Decimal
  chequesPropios  Decimal
  tarjetaCredito  Decimal
  tarjetaDebito   Decimal
  otrosMedios     Decimal

  // Retenciones
  retIVA       Decimal
  retGanancias Decimal
  retIngBrutos Decimal

  // Estado
  estado ClientPaymentStatus  // PENDIENTE, CONFIRMADO, RECHAZADO, ANULADO

  // Datos bancarios
  bancoOrigen     String?
  numeroOperacion String?

  // ViewMode
  docType DocType @default(T1)

  // Relaciones con Tesorería
  cashMovements    CashMovement[]
  bankMovements    BankMovement[]
  chequesRecibidos Cheque[] @relation("ChequeClientPayment")
}
```

---

## 4. SISTEMA VIEWMODE (T1/T2)

### 4.1 Concepto

ViewMode es un sistema para gestionar la visibilidad de operaciones según su tipo de documentación:
- **T1 (Tipo 1)**: Documentos estándar, fiscalmente válidos
- **T2 (Tipo 2)**: Documentos extendidos, sin respaldo fiscal

### 4.2 Nomenclatura Ofuscada

| Concepto Real | Nombre en Código |
|---------------|------------------|
| FiscalScope | ViewMode |
| fiscalStatus | docType |
| FISCAL | T1 |
| NO_FISCAL | T2 |
| Cookie | `_vm` |
| Header | `X-VM` |

### 4.3 Arquitectura

```
                    ┌─────────────────┐
                    │   Middleware    │
                    │  (Lee cookie)   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        ┌─────────┐    ┌─────────┐    ┌─────────┐
        │  API    │    │  API    │    │  API    │
        │ Compras │    │ Ventas  │    │Tesorería│
        └────┬────┘    └────┬────┘    └────┬────┘
             │              │              │
             ▼              ▼              ▼
        ┌─────────────────────────────────────┐
        │         applyViewMode()             │
        │  (Filtra por docType según modo)    │
        └─────────────────────────────────────┘
```

### 4.4 Rutas Siempre T1 (Reportes Fiscales)

```typescript
const ALWAYS_T1_ROUTES = [
  '/api/arca',
  '/api/compras/reportes/libro-iva',
  '/api/compras/reportes/iva-compras',
  '/api/compras/reportes/percepciones',
  '/api/compras/exportar/afip',
  '/api/compras/exportar/contable',
];
```

---

## 5. PERMISOS NUEVOS

### 5.1 Permisos de Tesorería

```typescript
// Tesorería
| 'treasury.view'           // Ver posición y movimientos
| 'treasury.manage_cash'    // Gestionar cajas
| 'treasury.manage_bank'    // Gestionar bancos
| 'treasury.manage_cheque'  // Gestionar cheques
| 'treasury.transfer'       // Realizar transferencias
| 'treasury.reconcile'      // Conciliar cuentas
| 'treasury.reports'        // Ver reportes
```

### 5.2 Permisos de ViewMode

```typescript
// ViewMode
| 'view.extended'     // Puede activar modo E
| 'view.create_t2'    // Puede crear documentos T2
| 'view.config'       // Puede configurar
| 'view.logs'         // Puede ver logs (solo SUPERADMIN)
```

---

## 6. MIGRACIONES DE BASE DE DATOS

### 6.1 Migración Principal de Tesorería

```sql
-- Archivo: 003_treasury_module.sql

-- Enums
CREATE TYPE "CashMovementType" AS ENUM (...);
CREATE TYPE "BankMovementType" AS ENUM (...);
CREATE TYPE "ChequeOrigen" AS ENUM ('RECIBIDO', 'EMITIDO');
CREATE TYPE "ChequeTipo" AS ENUM ('FISICO', 'ECHEQ');
CREATE TYPE "ChequeEstado" AS ENUM (...);
CREATE TYPE "TransferStatus" AS ENUM (...);

-- Tablas
CREATE TABLE "cash_accounts" (...);
CREATE TABLE "cash_movements" (...);
CREATE TABLE "bank_accounts" (...);
CREATE TABLE "bank_movements" (...);
CREATE TABLE "cheques" (...);
CREATE TABLE "treasury_transfers" (...);
```

---

## 7. ARCHIVOS CREADOS/MODIFICADOS

### 7.1 Archivos Nuevos

| Archivo | Descripción |
|---------|-------------|
| `app/administracion/tesoreria/page.tsx` | Dashboard tesorería |
| `app/administracion/tesoreria/cajas/page.tsx` | Gestión de cajas |
| `app/administracion/tesoreria/bancos/page.tsx` | Gestión de bancos |
| `app/administracion/tesoreria/cheques/page.tsx` | Cartera de cheques |
| `app/administracion/tesoreria/transferencias/page.tsx` | Transferencias |
| `app/administracion/tesoreria/flujo-caja/page.tsx` | Flujo de caja |
| `app/api/tesoreria/cajas/route.ts` | API cajas |
| `app/api/tesoreria/bancos/route.ts` | API bancos |
| `app/api/tesoreria/cheques/route.ts` | API cheques |
| `app/api/tesoreria/posicion/route.ts` | API posición |
| `prisma/migrations/003_treasury_module.sql` | Migración SQL |

### 7.2 Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `prisma/schema.prisma` | Nuevos modelos de Tesorería, DocType en modelos existentes |
| `lib/permissions.ts` | Permisos de treasury.* y view.* |
| `app/api/ventas/pagos/route.ts` | Integración con tesorería, soporte status/estado |
| `app/api/compras/ordenes-pago/route.ts` | Integración con tesorería |
| `components/layout/Sidebar.tsx` | Nueva sección Tesorería |

---

## 8. CONFIGURACIÓN REQUERIDA

### 8.1 Variables de Entorno

No se requieren nuevas variables de entorno para Tesorería.

### 8.2 Ejecución de Migraciones

```bash
# Generar cliente Prisma
npm run prisma:generate

# Aplicar migraciones
npm run prisma:migrate

# O push directo (desarrollo)
npx prisma db push
```

### 8.3 Seed Inicial (Opcional)

```bash
# Crear caja y banco por defecto
npx prisma db seed
```

---

## 9. PRÓXIMOS PASOS (TODO)

### 9.1 Pendiente de Implementación

- [ ] Conciliación bancaria automatizada
- [ ] Importación de extractos bancarios (Excel/OFX)
- [ ] Alertas de vencimientos por email
- [ ] Dashboard de KPIs de tesorería
- [ ] Reportes de flujo de caja histórico
- [ ] Integración con ECHEQ (Banco Central)

### 9.2 Flujo de Aprobación de Cobros (Futuro)

Se diseñó pero no se implementó aún un sistema de aprobación para cobros:
- Efectivo puro → auto-aprueba
- Cheques/Transferencias → requiere aprobación de supervisor

---

## 10. NOTAS TÉCNICAS

### 10.1 Compatibilidad de API

La API de pagos soporta tanto `status` como `estado` como parámetro de filtro para mantener compatibilidad con el frontend existente.

### 10.2 Transacciones

Todas las operaciones de cobro/pago se ejecutan dentro de transacciones Prisma (`$transaction`) para garantizar consistencia.

### 10.3 Auditoría

Se mantiene registro de auditoría usando `logSalesCreation` para todos los cobros creados.

---

## 11. NUEVO MÓDULO: SUPERADMIN

### 11.1 Descripción General

Sistema de administración para SUPERADMIN que permite gestionar módulos, empresas, usuarios globales y configuración del sistema.

### 11.2 Sistema de Módulos por Empresa

Cada empresa puede tener habilitados/deshabilitados diferentes módulos del sistema.

#### Modelos de Base de Datos

```prisma
model Module {
  id          String   @id @default(cuid())
  key         String   @unique  // "ventas_cotizaciones", "compras_ordenes"
  name        String
  description String?
  category    ModuleCategory  // VENTAS, COMPRAS, MANTENIMIENTO, etc.
  icon        String?
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  dependencies String[]
  companies   CompanyModule[]
  @@map("modules")
}

model CompanyModule {
  id          String   @id @default(cuid())
  companyId   Int
  moduleId    String
  isEnabled   Boolean  @default(true)
  enabledAt   DateTime @default(now())
  enabledBy   Int?
  config      Json?
  @@unique([companyId, moduleId])
  @@map("company_modules")
}

model CompanyTemplate {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  icon        String?
  color       String?
  moduleKeys  String[]
  config      Json?
  isDefault   Boolean  @default(false)
  isActive    Boolean  @default(true)
  usageCount  Int      @default(0)
  @@map("company_templates")
}

enum ModuleCategory {
  VENTAS
  COMPRAS
  MANTENIMIENTO
  COSTOS
  ADMINISTRACION
  GENERAL
}
```

### 11.3 Estructura de Navegación SUPERADMIN

```
/superadmin/
├── page.tsx                 # Dashboard SUPERADMIN
├── companies/page.tsx       # Gestión de empresas
├── modules/page.tsx         # Gestión de módulos
├── templates/page.tsx       # Templates de empresa
├── users/page.tsx           # Usuarios globales
├── activity/page.tsx        # Log de actividad
├── billing/page.tsx         # Facturación
├── permissions/page.tsx     # Permisos globales
├── settings/page.tsx        # Configuración sistema
├── database/page.tsx        # Estado de BD
└── integrations/page.tsx    # Integraciones externas
```

### 11.4 APIs SUPERADMIN

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/superadmin/companies` | GET/POST | Listar/crear empresas |
| `/api/superadmin/companies/[id]/modules` | PUT | Gestionar módulos empresa |
| `/api/superadmin/modules` | GET | Listar todos los módulos |
| `/api/superadmin/templates` | GET/POST | Templates de empresa |
| `/api/superadmin/stats` | GET | Estadísticas globales |
| `/api/company/modules` | GET | Módulos de la empresa actual |

### 11.5 Context y Hooks

```typescript
// contexts/ModulesContext.tsx
const ModulesContext = createContext<{
  modules: Module[];
  isModuleEnabled: (key: string) => boolean;
  loading: boolean;
}>();

// hooks/use-modules.ts
function useModules() {
  const { modules, isModuleEnabled } = useContext(ModulesContext);
  return { modules, isModuleEnabled };
}
```

### 11.6 Módulos Incluidos (32 módulos)

| Categoría | Módulos |
|-----------|---------|
| VENTAS | cotizaciones, ordenes, facturacion, cobranzas, clientes, precios, acopios, comisiones |
| COMPRAS | ordenes, recepciones, proveedores, stock, cuentas_corrientes |
| MANTENIMIENTO | preventivo, correctivo, ordenes, maquinas, panol, unidades_moviles |
| COSTOS | dashboard, productos, laborales, indirectos |
| ADMINISTRACION | cargas, controles, tesoreria, usuarios, roles |
| GENERAL | dashboard, tareas, calendario, reportes |

### 11.7 Templates de Empresa

| Template | Descripción | Módulos |
|----------|-------------|---------|
| Industria Completa | Todos los módulos | 26 módulos |
| Comercio | Compra/venta sin manufactura | 14 módulos |
| Servicio Técnico | Mantenimiento y servicio | 12 módulos |
| Básico | Configuración mínima | 3 módulos |

---

## 12. MÓDULO DE VENTAS - Sistema Completo

### 12.1 Estructura de Navegación Ventas

```
/administracion/ventas/
├── page.tsx                    # Dashboard ventas
├── cotizaciones/page.tsx       # Cotizaciones
├── ordenes/page.tsx            # Órdenes de venta
├── entregas/page.tsx           # Entregas
├── facturas/page.tsx           # Facturación
├── cobranzas/page.tsx          # Cobranzas
├── cuenta-corriente/page.tsx   # Cuenta corriente clientes
└── reportes/page.tsx           # Reportes
```

### 12.2 Modelos de Ventas

```prisma
model Quote {
  id              Int         @id @default(autoincrement())
  numero          String
  clientId        String      // String porque Client.id es cuid
  sellerId        Int?
  estado          QuoteStatus @default(BORRADOR)
  fechaEmision    DateTime
  fechaValidez    DateTime
  subtotal        Decimal
  descuentoGlobal Decimal     @default(0)
  descuentoMonto  Decimal     @default(0)
  tasaIva         Decimal     @default(21)
  impuestos       Decimal
  total           Decimal
  // Costos ocultos (solo server-side)
  costoTotal       Decimal?
  margenBruto      Decimal?
  margenPorcentaje Decimal?
  docType         DocType     @default(T1)
  @@map("quotes")
}

model Sale {
  id              Int        @id @default(autoincrement())
  numero          String
  clientId        String     // String porque Client.id es cuid
  quoteId         Int?       @unique
  estado          SaleStatus @default(BORRADOR)
  fechaEmision    DateTime
  // ... similar a Quote
  @@map("sales")
}

enum QuoteStatus {
  BORRADOR
  ENVIADA
  EN_NEGOCIACION
  ACEPTADA
  CONVERTIDA
  PERDIDA
  VENCIDA
}

enum SaleStatus {
  BORRADOR
  CONFIRMADA
  EN_PREPARACION
  ENTREGADA
  FACTURADA
  COMPLETADA
  CANCELADA
}
```

### 12.3 APIs de Ventas

| Endpoint | Descripción |
|----------|-------------|
| `/api/ventas/cotizaciones` | CRUD cotizaciones |
| `/api/ventas/cotizaciones/[id]` | Detalle/editar cotización |
| `/api/ventas/cotizaciones/[id]/enviar` | Enviar al cliente |
| `/api/ventas/cotizaciones/[id]/aprobar` | Aprobar cotización |
| `/api/ventas/cotizaciones/[id]/convertir` | Convertir a orden |
| `/api/ventas/ordenes` | CRUD órdenes de venta |
| `/api/ventas/ordenes/[id]/confirmar` | Confirmar orden |
| `/api/ventas/entregas` | Gestión de entregas |
| `/api/ventas/facturas` | Facturación |
| `/api/ventas/pagos` | Cobros de clientes |
| `/api/ventas/cuenta-corriente` | Cuenta corriente |
| `/api/ventas/dashboard` | Dashboard de ventas |

### 12.4 Sistema de Auditoría de Ventas

```typescript
// lib/ventas/audit-helper.ts
logSalesCreation()      // Registrar creación
logSalesStatusChange()  // Cambio de estado
logQuoteSent()          // Cotización enviada
logQuoteAccepted()      // Cotización aceptada
logQuoteConverted()     // Conversión a orden
logInvoiceEmitted()     // Factura emitida
logPaymentApplied()     // Pago aplicado
logLedgerEntry()        // Movimiento cuenta corriente

// lib/ventas/audit-config.ts
- Configuración de entidades auditables
- Colores y labels por tipo de acción
- Generación de mensajes human-readable
```

### 12.5 Seguridad de Márgenes

Los costos y márgenes **NUNCA** se exponen al frontend:

```typescript
// En API response
const cotizacionesSanitized = cotizaciones.map(cot => ({
  ...cot,
  costoTotal: undefined,      // Oculto
  margenBruto: undefined,     // Oculto
  margenPorcentaje: undefined // Oculto
}));
```

---

## 13. MÓDULO DE COMPRAS - Mejoras Adicionales

### 13.1 Dashboard de Compras

Nueva página de dashboard con:
- KPIs principales (OC pendientes, recepciones, pagos)
- Gráficos de compras por período
- Top proveedores
- Alertas de vencimientos

### 13.2 Nuevas Funcionalidades de Stock

```
/administracion/compras/stock/
├── page.tsx              # Dashboard stock
├── kardex/page.tsx       # Kardex por producto
├── ajustes/page.tsx      # Ajustes de inventario
├── reposicion/page.tsx   # Punto de reposición
└── transferencias/page.tsx # Transferencias entre depósitos
```

### 13.3 APIs Nuevas de Stock

| Endpoint | Descripción |
|----------|-------------|
| `/api/compras/stock/ajustes` | Ajustes de inventario |
| `/api/compras/stock/kpis` | KPIs de stock |
| `/api/compras/stock/reposicion` | Alertas de reposición |
| `/api/compras/stock/transferencias` | Transferencias |
| `/api/compras/stock/ubicaciones/[id]` | Ubicaciones |

### 13.4 Sistema de Auditoría de Compras

```typescript
// lib/compras/audit-helper.ts
logPurchaseCreation()
logStatusChange()
logReceptionConfirmed()
logPaymentCreated()
```

### 13.5 Generación de PDF

```typescript
// lib/pdf/purchase-order-pdf.ts
- Generación de PDF de orden de compra
- Logo de empresa
- Datos del proveedor
- Items con precios
- Condiciones comerciales
```

---

## 14. CORRECCIONES DE BASE DE DATOS

### 14.1 Tipos de ID Corregidos

Se corrigieron incompatibilidades de tipos en foreign keys:

| Modelo | Campo | Tipo Correcto |
|--------|-------|---------------|
| Quote | clientId | TEXT (cuid) |
| Quote | productId | TEXT (cuid) |
| Sale | clientId | TEXT (cuid) |
| SaleItem | productId | TEXT (cuid) |

### 14.2 Migraciones Ejecutadas

| Migración | Descripción |
|-----------|-------------|
| `fix_superadmin_final.sql` | Tablas modules, company_modules, company_templates |
| `sync_quotes_schema.sql` | Tablas quotes, quote_items, quote_versions |
| `sync_sales_schema.sql` | Tablas sales, sale_items, SalesAuditLog |

---

## 15. ARCHIVOS ADICIONALES CREADOS

### 15.1 Ventas

| Archivo | Descripción |
|---------|-------------|
| `lib/ventas/audit-helper.ts` | Helper de auditoría ventas |
| `lib/ventas/audit-config.ts` | Configuración de auditoría |
| `lib/types/sales.ts` | Tipos TypeScript de ventas |
| `components/ventas/cotizaciones-list.tsx` | Lista de cotizaciones |
| `components/ventas/ordenes-venta-list.tsx` | Lista de órdenes |
| `components/ventas/facturas-list.tsx` | Lista de facturas |
| `components/ventas/cobranzas-list.tsx` | Lista de cobranzas |

### 15.2 Compras

| Archivo | Descripción |
|---------|-------------|
| `lib/compras/audit-helper.ts` | Helper de auditoría compras |
| `lib/pdf/purchase-order-pdf.ts` | Generador PDF orden compra |
| `components/compras/dashboard/` | Componentes dashboard |
| `components/compras/stock/` | Componentes stock |
| `components/compras/orden-compra-detail-modal.tsx` | Modal detalle OC |
| `hooks/use-compras-dashboard.ts` | Hook dashboard compras |

### 15.3 SUPERADMIN

| Archivo | Descripción |
|---------|-------------|
| `app/superadmin/*.tsx` | Todas las páginas SUPERADMIN |
| `app/api/superadmin/*.ts` | APIs SUPERADMIN |
| `contexts/ModulesContext.tsx` | Context de módulos |
| `hooks/use-modules.ts` | Hook de módulos |
| `prisma/seed-modules.ts` | Seed de módulos |

### 15.4 UI Components

| Archivo | Descripción |
|---------|-------------|
| `components/ui/date-picker.tsx` | Date picker component |
| `components/view-mode/` | Componentes ViewMode |

---

## 16. FUNCIONES UTILITARIAS NUEVAS

```typescript
// lib/utils.ts
formatCurrency(amount, currency?)  // Formato moneda AR
formatNumber(number, decimals?)    // Formato número

// lib/permissions-helpers.ts
checkPermission()
hasModuleAccess()
```

---

## 17. CHANGELOG RESUMIDO

| Fecha | Cambio |
|-------|--------|
| Ene 2026 | Creación módulo Tesorería completo |
| Ene 2026 | Integración Compras-Tesorería |
| Ene 2026 | Integración Ventas-Tesorería |
| Ene 2026 | Sistema ViewMode (T1/T2) |
| Ene 2026 | **Módulo SUPERADMIN completo** |
| Ene 2026 | **Sistema de módulos por empresa** |
| Ene 2026 | **Sistema de ventas completo** (cotizaciones → órdenes → entregas → facturas → cobros) |
| Ene 2026 | **Dashboard de compras** |
| Ene 2026 | **Mejoras de stock** (kardex, ajustes, reposición) |
| Ene 2026 | **Sistema de auditoría ventas/compras** |
| Ene 2026 | **Corrección de tipos de ID** (cuid) |
| Ene 2026 | 12+ nuevos modelos de datos |
| Ene 2026 | 15+ nuevas páginas frontend |
| Ene 2026 | 30+ nuevos endpoints API |

---

**Documento actualizado:** Enero 2026
**Sistema ORVIT - Gestión Integral**
