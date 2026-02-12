# Plan: Sistema de Conciliación Bancaria Semi-Automática

## Estado Actual del Codebase

### Lo que YA existe:
- **Tablas en BD** (via SQL migrations, NO en schema.prisma):
  - `bank_statements` - extractos importados
  - `bank_statement_items` - ítems individuales del extracto
  - `treasury_movements` - movimientos de tesorería unificados
- **BankMovement** en schema.prisma - campos `conciliado`, `conciliadoAt`, `conciliadoBy` ya presentes
- **BankAccount** - campos `saldoContable` y `saldoBancario` ya presentes
- **5 API routes** en `app/api/tesoreria/conciliacion/` (route.ts, [id]/route.ts, [id]/match/route.ts, [id]/auto-match/route.ts, sugerencias/route.ts)
- **Servicios**: `reconciliation-matcher.ts`, `bank-reconciliation-ml.ts`, `validation-schemas.ts`
- **Página**: `app/administracion/tesoreria/conciliacion/page.tsx` - lista extractos + detalle básico
- **Librerías instaladas**: @dnd-kit, jspdf + autotable, xlsx, date-fns, zod

### Lo que FALTA (gaps identificados):
1. **Modelos Prisma** para BankStatement, BankStatementItem, TreasuryMovement (existen como tablas SQL pero NO como modelos Prisma → código usa `prisma.$queryRaw`)
2. **UI de matching manual** - no hay interfaz drag-and-drop ni matching interactivo
3. **Vista de dos columnas** comparando movimientos contables vs bancarios
4. **Importación robusta** de Excel (.xlsx) - solo CSV básico implementado
5. **Reporte PDF** de conciliación
6. **Justificación de diferencias** - workflow para partidas pendientes
7. **Endpoint POST conciliar** específico por banco (la tarea pide `/bancos/[id]/conciliar`)

---

## Plan de Implementación

### Fase 1: Modelos Prisma (schema.prisma)
> **Archivos**: `project/prisma/schema.prisma`

**1.1** Agregar modelo `TreasuryMovement` al schema.prisma que mapee a tabla existente `treasury_movements`:
```prisma
model TreasuryMovement {
  id                Int       @id @default(autoincrement())
  fecha             DateTime  @db.Date
  fechaValor        DateTime? @db.Date
  tipo              TreasuryMovementType
  medio             PaymentMedium
  monto             Decimal   @db.Decimal(15, 2)
  moneda            String    @default("ARS") @db.VarChar(3)
  accountType       TreasuryAccountType
  cashAccountId     Int?
  bankAccountId     Int?
  referenceType     String?   @db.VarChar(50)
  referenceId       Int?
  chequeId          Int?
  descripcion       String?
  numeroComprobante String?   @db.VarChar(100)
  conciliado        Boolean   @default(false)
  conciliadoAt      DateTime?
  conciliadoBy      Int?
  estado            TreasuryMovementStatus @default(PENDIENTE)
  reversaDeId       Int?
  reversadoPorId    Int?
  docType           DocType   @default(T1)
  companyId         Int
  createdBy         Int?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  comprobanteUrl    String?

  // Relaciones
  company         Company      @relation(fields: [companyId], references: [id], onDelete: Cascade)
  bankAccount     BankAccount? @relation(fields: [bankAccountId], references: [id])
  conciliadoByUser User?       @relation("TreasuryMovConciliadoBy", fields: [conciliadoBy], references: [id])
  createdByUser   User?        @relation("TreasuryMovCreatedBy", fields: [createdBy], references: [id])
  statementItems  BankStatementItem[]

  @@index([companyId])
  @@index([bankAccountId])
  @@index([fecha])
  @@index([conciliado])
  @@index([companyId, docType])
  @@map("treasury_movements")
}
```

**1.2** Agregar modelo `BankStatement`:
```prisma
model BankStatement {
  id               Int       @id @default(autoincrement())
  bankAccountId    Int
  periodo          String    @db.VarChar(7) // YYYY-MM
  fechaImportacion DateTime  @default(now())
  archivoOriginal  String?
  saldoInicial     Decimal   @db.Decimal(15, 2)
  totalDebitos     Decimal   @default(0) @db.Decimal(15, 2)
  totalCreditos    Decimal   @default(0) @db.Decimal(15, 2)
  saldoFinal       Decimal   @db.Decimal(15, 2)
  totalItems       Int       @default(0)
  itemsConciliados Int       @default(0)
  itemsPendientes  Int       @default(0)
  itemsSuspense    Int       @default(0)
  estado           ReconciliationStatus @default(PENDIENTE)
  cerradoAt        DateTime?
  cerradoPor       Int?
  toleranciaMonto  Decimal   @default(0.01) @db.Decimal(15, 2)
  toleranciaDias   Int       @default(3)
  docType          DocType   @default(T1)
  companyId        Int
  createdBy        Int?
  createdAt        DateTime  @default(now())

  // Relaciones
  bankAccount     BankAccount @relation(fields: [bankAccountId], references: [id], onDelete: Restrict)
  company         Company     @relation(fields: [companyId], references: [id], onDelete: Cascade)
  cerradoPorUser  User?       @relation("StatementCerradoPor", fields: [cerradoPor], references: [id])
  createdByUser   User?       @relation("StatementCreatedBy", fields: [createdBy], references: [id])
  items           BankStatementItem[]

  @@index([companyId])
  @@index([companyId, docType])
  @@index([estado])
  @@map("bank_statements")
}
```

**1.3** Agregar modelo `BankStatementItem`:
```prisma
model BankStatementItem {
  id                  Int       @id @default(autoincrement())
  statementId         Int
  lineNumber          Int
  fecha               DateTime  @db.Date
  fechaValor          DateTime? @db.Date
  descripcion         String
  referencia          String?   @db.VarChar(100)
  debito              Decimal   @default(0) @db.Decimal(15, 2)
  credito             Decimal   @default(0) @db.Decimal(15, 2)
  saldo               Decimal   @db.Decimal(15, 2)
  conciliado          Boolean   @default(false)
  treasuryMovementId  Int?
  conciliadoAt        DateTime?
  conciliadoBy        Int?
  matchType           MatchType?
  matchConfidence     Float?
  esSuspense          Boolean   @default(false)
  suspenseNotas       String?
  suspenseResuelto    Boolean   @default(false)

  // Relaciones
  statement          BankStatement     @relation(fields: [statementId], references: [id], onDelete: Cascade)
  treasuryMovement   TreasuryMovement? @relation(fields: [treasuryMovementId], references: [id], onDelete: SetNull)
  conciliadoByUser   User?             @relation("StatementItemConciliadoBy", fields: [conciliadoBy], references: [id])

  @@index([statementId])
  @@index([conciliado])
  @@index([esSuspense])
  @@map("bank_statement_items")
}
```

**1.4** Agregar enums faltantes (si no existen):
```prisma
enum ReconciliationStatus {
  PENDIENTE
  EN_PROCESO
  COMPLETADA
  CON_DIFERENCIAS
  CERRADA
}

enum MatchType {
  EXACT
  FUZZY
  REFERENCE
  MANUAL
}

enum TreasuryMovementType {
  INGRESO
  EGRESO
  TRANSFERENCIA_INTERNA
  AJUSTE
}

enum TreasuryMovementStatus {
  PENDIENTE
  CONFIRMADO
  REVERSADO
}

enum TreasuryAccountType {
  CASH
  BANK
  CHECK_PORTFOLIO
}

enum PaymentMedium {
  EFECTIVO
  TRANSFERENCIA
  CHEQUE_TERCERO
  CHEQUE_PROPIO
  ECHEQ
  TARJETA_CREDITO
  TARJETA_DEBITO
  DEPOSITO
  COMISION
  INTERES
  AJUSTE
}
```

**1.5** Agregar relaciones inversas en modelos existentes (BankAccount, Company, User) apuntando a los nuevos modelos.

**1.6** Correr `prisma db pull` para verificar alineación con BD existente, luego `prisma generate`.

> **NOTA**: NO correr `prisma migrate` ya que las tablas ya existen en BD. Solo necesitamos que el schema.prisma refleje lo que ya hay.

---

### Fase 2: Endpoint POST /api/tesoreria/bancos/[id]/conciliar
> **Archivo nuevo**: `project/app/api/tesoreria/bancos/[id]/conciliar/route.ts`

**2.1** Crear endpoint POST que:
- Reciba `{ movementIds: number[], saldoBancarioReal: number, notas?: string }`
- Valide con Zod (agregar schema en `validation-schemas.ts`)
- Verifique permiso `tesoreria.conciliacion.match`
- En transacción Prisma:
  - Marque cada BankMovement como `conciliado: true`, `conciliadoAt: now()`, `conciliadoBy: userId`
  - Actualice `BankAccount.saldoBancario` con el saldo real informado
  - Calcule diferencia = `saldoBancario - saldoContable`
  - Si hay diferencia, registre en respuesta (no auto-crear ajuste, dejar al usuario decidir)
- Soporte idempotencia
- Retorne: `{ conciliados: number, saldoBancario, saldoContable, diferencia, movementsUpdated: [] }`

**2.2** Agregar schema de validación:
```typescript
export const conciliarBancoSchema = z.object({
  movementIds: z.array(z.number().int().positive()).min(1),
  saldoBancarioReal: z.number(),
  notas: z.string().optional(),
});
```

---

### Fase 3: Migrar API routes existentes de $queryRaw a Prisma Client
> **Archivos**: Los 5 routes en `app/api/tesoreria/conciliacion/`

**3.1** Refactorizar `conciliacion/route.ts` (GET y POST):
- Reemplazar `$queryRaw` con `prisma.bankStatement.findMany()` / `prisma.bankStatement.create()`
- Mantener misma interfaz de respuesta

**3.2** Refactorizar `conciliacion/[id]/route.ts` (GET, PATCH, DELETE):
- Usar `prisma.bankStatement.findUnique({ include: { items: true } })`
- PATCH para close/reopen/updateTolerances con `prisma.bankStatement.update()`

**3.3** Refactorizar `conciliacion/[id]/match/route.ts`:
- Usar `prisma.bankStatementItem.update()` para matching
- Transacciones con `prisma.$transaction()`

**3.4** Refactorizar `conciliacion/[id]/auto-match/route.ts`:
- Actualizar `reconciliation-matcher.ts` para usar Prisma Client

**3.5** Refactorizar `conciliacion/sugerencias/route.ts`:
- Actualizar queries de sugerencias

> **Nota**: Esta fase es de calidad/mantenimiento. Si urge el frontend, puede posponerse y mantener $queryRaw temporalmente.

---

### Fase 4: Componente BankReconciliation.tsx (UI principal)
> **Archivo nuevo**: `project/components/tesoreria/BankReconciliation.tsx`

**4.1** Layout de dos columnas:
```
┌──────────────────────────────────────────────────────┐
│ Header: Banco | Período | Saldo Inicial | Estado     │
├─────────────────────────┬────────────────────────────┤
│ MOVIMIENTOS CONTABLES   │ MOVIMIENTOS BANCARIOS      │
│ (BankMovement de BD)    │ (BankStatementItem import) │
│                         │                            │
│ ☐ 15/01 Transf IN 5000 │ ☐ 15/01 TRF 5000.00       │
│ ☐ 16/01 Comisión -150  │ ☐ 16/01 COM -150.00       │
│ ☐ 18/01 Depósito 3200  │ ☐ 18/01 DEP 3200.00       │
│ ☐ 20/01 Débito -800    │   20/01 ??? -800.50 ⚠️     │
│                         │   22/01 INT +12.30 (nuevo) │
├─────────────────────────┴────────────────────────────┤
│ MATCHES REALIZADOS                                   │
│ ✓ Transf IN 5000 ↔ TRF 5000.00 (EXACT, 98%)       │
│ ✓ Comisión -150 ↔ COM -150.00 (REFERENCE, 85%)     │
├──────────────────────────────────────────────────────┤
│ RESUMEN                                              │
│ Conciliados: 3/5 | Diferencia: $12.80 | Suspense: 1 │
│ [Auto-Match] [Cerrar Conciliación]                   │
└──────────────────────────────────────────────────────┘
```

**4.2** Funcionalidades del componente:
- Recibir `statementId` y `bankAccountId` como props
- Fetch paralelo: movimientos contables (BankMovement) + ítems del extracto (BankStatementItem)
- Mostrar en dos columnas scrolleables sincronizadas
- Checkboxes para selección múltiple en ambas columnas
- Botón "Vincular seleccionados" para match manual
- Badges de estado: conciliado (verde), pendiente (amarillo), suspense (rojo)
- KPIs arriba: Total items, Conciliados, Pendientes, Diferencia

**4.3** Match manual (sin drag-and-drop inicialmente):
- Usuario selecciona 1 ítem en columna izquierda + 1 ítem en columna derecha
- Click "Vincular" → POST a `/conciliacion/[id]/match` con action: "match"
- Mostrar confianza calculada y diferencia de monto si hay
- Si diferencia > tolerancia, pedir confirmación

> **Decisión**: Usar selección con checkbox en vez de drag-and-drop para MVP. DnD se puede agregar después como mejora de UX. Razón: es más accesible, funciona en mobile, y es más simple de implementar.

**4.4** Acciones sobre ítems:
- **Desvincular**: Quitar match existente (action: "unmatch")
- **Marcar suspense**: Ítem bancario sin contraparte (con campo de notas)
- **Crear movimiento**: Desde ítem suspense, crear BankMovement nuevo

---

### Fase 5: Matching Manual Interactivo (mejora a Fase 4)
> **Archivos**: `project/components/tesoreria/BankReconciliation.tsx` (extender)

**5.1** Agregar sugerencias automáticas:
- Al seleccionar un ítem en una columna, resaltar candidatos en la otra
- Usar endpoint `/sugerencias` para obtener matches probables
- Mostrar score de confianza junto a cada sugerencia

**5.2** Match por lote:
- Botón "Auto-Match" que llama a `/[id]/auto-match`
- Mostrar progreso y resultados
- Permitir revisar y deshacer matches automáticos

**5.3** Filtros en las columnas:
- Solo pendientes / Solo conciliados / Todos
- Rango de fechas
- Rango de montos
- Búsqueda por descripción

---

### Fase 6: Importación de Extractos (CSV/Excel)
> **Archivos**: Mejorar dialog de importación en page.tsx o crear `ImportBankStatement.tsx`

**6.1** Mejorar importación CSV:
- Usar `xlsx` library (ya instalada) para parsear CSV y XLSX
- Soportar múltiples formatos de CSV (`;` y `,` como separador)
- Auto-detectar formato de fecha (DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY)
- Validación con preview de primeras 5 filas antes de importar
- Manejo de errores por fila con reporte

**6.2** Agregar importación Excel (.xlsx):
- Selector de hoja si el archivo tiene múltiples hojas
- Mapeo de columnas configurable (drag headers a campos)
- Preview con tabla editable antes de confirmar

**6.3** Formatos bancarios argentinos predefinidos:
- Template para Banco Nación, Galicia, Santander, BBVA, Macro
- Auto-detección de banco por formato de archivo
- Mapeo automático de columnas según banco

---

### Fase 7: Cierre y Justificación de Diferencias
> **Archivos**: Extender `BankReconciliation.tsx` + API route `[id]/route.ts`

**7.1** Workflow de cierre:
1. Usuario clickea "Cerrar Conciliación"
2. Sistema calcula: ítems pendientes, diferencia total, ítems suspense
3. Si hay diferencias:
   - Mostrar dialog con resumen de partidas no conciliadas
   - Requerir justificación por cada partida o grupo
   - Campo de texto + categoría (Comisión bancaria, Error, Timing, Otro)
4. Guardar justificaciones
5. Cambiar estado a COMPLETADA o CON_DIFERENCIAS según corresponda

**7.2** Modelo de justificación (agregar campos al BankStatementItem o crear tabla):
- Opción simple: usar `suspenseNotas` existente como justificación
- Las partidas con diferencia se marcan como `esSuspense: true` con nota explicativa

**7.3** Resumen post-cierre:
- Card con: período, banco, saldo inicial, saldo final, diferencia, % conciliado
- Lista de partidas justificadas
- Botón para reabrir si es necesario

---

### Fase 8: Reporte PDF de Conciliación
> **Archivo nuevo**: `project/lib/pdf/bank-reconciliation-pdf.ts`

**8.1** Generar PDF con jsPDF + autoTable (mismo patrón que `account-statement-pdf.ts`):

Secciones del PDF:
1. **Encabezado**: Logo empresa, título "Conciliación Bancaria", fecha
2. **Datos del banco**: Nombre, cuenta, CBU, período
3. **Resumen**:
   - Saldo según libros (contable)
   - Saldo según banco (extracto)
   - Diferencia
   - % conciliado
4. **Tabla de movimientos conciliados**: Fecha, Descripción, Monto Libros, Monto Banco, Diferencia, Tipo Match
5. **Partidas pendientes en libros**: Movimientos contables sin match en extracto
6. **Partidas pendientes en banco**: Ítems del extracto sin match contable
7. **Partidas en suspense**: Con notas de justificación
8. **Pie**: Total diferencias, firma/responsable, fecha de generación

**8.2** Agregar botón "Exportar PDF" en el componente BankReconciliation.

**8.3** Agregar endpoint opcional GET `/api/tesoreria/conciliacion/[id]/pdf` que genere server-side (para envío por email).

---

## Orden de Ejecución Recomendado

| # | Fase | Prioridad | Estimación |
|---|------|-----------|------------|
| 1 | Modelos Prisma | ALTA | Base para todo lo demás |
| 2 | Endpoint conciliar | ALTA | Backend core |
| 3 | Migrar routes a Prisma | MEDIA | Puede posponerse |
| 4 | BankReconciliation.tsx | ALTA | UI principal |
| 5 | Matching interactivo | ALTA | UX core del feature |
| 6 | Importación CSV/Excel | MEDIA | Mejora a existente |
| 7 | Cierre + justificación | ALTA | Workflow completo |
| 8 | Reporte PDF | MEDIA | Entregable final |

**Flujo sugerido**: 1 → 2 → 4+5 → 7 → 6 → 8 → 3

---

## Decisiones Arquitectónicas

1. **Checkbox vs Drag-and-Drop**: MVP usa checkboxes para matching manual. DnD como mejora futura.
2. **TreasuryMovement vs BankMovement**: Las tablas de BD usan `treasury_movements` como modelo unificado que el código actual referencia. Los modelos Prisma deben mapear a estas tablas existentes.
3. **No auto-crear ajustes**: Las diferencias se informan pero no se auto-generan movimientos de ajuste. El usuario decide.
4. **PDF client-side**: Generar PDF en el browser con jsPDF (como los existentes). Server-side solo si se necesita enviar por email.
5. **Reusar endpoints existentes**: La mayoría de la lógica de matching ya existe en los API routes. El componente nuevo los consume.

## Archivos a Crear/Modificar

### Crear:
- `project/app/api/tesoreria/bancos/[id]/conciliar/route.ts`
- `project/components/tesoreria/BankReconciliation.tsx`
- `project/lib/pdf/bank-reconciliation-pdf.ts`

### Modificar:
- `project/prisma/schema.prisma` (agregar 3 modelos + enums + relaciones)
- `project/lib/tesoreria/validation-schemas.ts` (agregar schema conciliar)
- `project/app/administracion/tesoreria/conciliacion/page.tsx` (integrar BankReconciliation, mejorar import)
- `project/lib/tesoreria/reconciliation-matcher.ts` (migrar de $queryRaw a Prisma si se hace Fase 3)
- `project/app/api/tesoreria/conciliacion/` routes (migrar a Prisma Client si se hace Fase 3)
