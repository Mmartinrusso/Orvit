# Cambios: Sistema T2 y Flujo OC-Factura

## Fecha: 2026-01-26

## Resumen

Este documento describe los cambios realizados para corregir el sistema de documentos T2 (base de datos secundaria) y el flujo de carga de facturas desde órdenes de compra.

---

## 1. Corrección del Sistema T2

### Problema
Los documentos T2 (PPT, comprobantes adicionales) se estaban creando en la base de datos principal en lugar de la base de datos T2 secundaria.

### Solución

#### 1.1 Resolución de módulos
- **Archivo renombrado**: `lib/view-mode.ts` → `lib/view-mode-legacy.ts`
- **Razón**: Existía conflicto entre el archivo `view-mode.ts` y la carpeta `view-mode/`. Node.js resolvía al archivo en lugar de la carpeta, causando error `shouldQueryT2 is not a function`.

#### 1.2 Corrección de nombres de campos
- **Archivo**: `lib/view-mode/t2-enrichment.ts`
- **Cambio**: `razonSocial` → `razon_social` (snake_case para coincidir con el modelo de Prisma)

#### 1.3 Creación de comprobantes T2 en BD correcta
- **Archivo**: `app/api/compras/ordenes-compra/[id]/completar/route.ts`
- **Cambio**: Cuando `docType === 'T2'`, ahora se crea el comprobante en `prismaT2.t2PurchaseReceipt` en lugar de la BD principal.

#### 1.4 Creación de órdenes de pago T2 en BD correcta
- **Archivo**: `app/api/compras/ordenes-pago/route.ts`
- **Cambio**: Cuando `requestedDocType === 'T2'`, ahora se crea la orden en `prismaT2.t2PaymentOrder` en lugar de la BD principal.

#### 1.5 Eliminación de comprobantes T2
- **Archivo**: `app/api/compras/comprobantes/[id]/route.ts`
- **Cambio**: El endpoint DELETE ahora busca primero en T1, y si no encuentra, busca y elimina en T2.

---

## 2. Corrección del Flujo OC-Factura

### Problema
Al "completar" una OC cargando la factura:
1. Se marcaba la OC como COMPLETADA (incorrecto - la mercadería no se recibió aún)
2. Se ponía `fechaEntregaReal` (incorrecto - no hubo entrega)
3. No se podía volver a cargar una factura si se borraba la anterior

### Solución

#### 2.1 No cambiar estado de OC al cargar factura
- **Archivo**: `app/api/compras/ordenes-compra/[id]/completar/route.ts`
- **Cambios**:
  - Ya NO se cambia el estado de la OC a COMPLETADA
  - Ya NO se pone `fechaEntregaReal`
  - Ya NO se marca el PurchaseRequest como COMPLETADA
  - Solo se crea el comprobante y el MatchResult

#### 2.2 Flujo correcto ahora
1. **OC creada** → estado APROBADA/ENVIADA_PROVEEDOR/CONFIRMADA
2. **Factura cargada** → se crea PurchaseReceipt + MatchResult (OC mantiene su estado)
3. **Mercadería recibida** → se crea GoodsReceipt (proceso separado con remito)
4. **Todo completo** → recién ahí se puede marcar COMPLETADA

#### 2.3 Eliminación de factura revierte OC
- **Archivo**: `app/api/compras/comprobantes/[id]/route.ts`
- **Cambios al DELETE**:
  - Busca OCs vinculadas via MatchResult
  - Si la OC estaba COMPLETADA, la revierte a CONFIRMADA
  - Limpia `fechaEntregaReal`
  - Agrega comentario de trazabilidad
  - Elimina el MatchResult
  - Permite volver a cargar una factura para la misma OC

---

## 3. Optimización de Conexiones a BD

### Problema
Error "Too many database connections opened" al usar ambas bases de datos (T1 y T2).

### Solución
- **Archivos**: `lib/prisma.ts`, `lib/prisma-t2.ts`
- **Cambio**: Agregado `connection_limit` en desarrollo:
  - BD Principal: máximo 5 conexiones
  - BD T2: máximo 3 conexiones

---

## 4. Archivos Modificados

### APIs
- `app/api/compras/ordenes-compra/[id]/completar/route.ts`
- `app/api/compras/ordenes-pago/route.ts`
- `app/api/compras/comprobantes/[id]/route.ts`

### Bibliotecas
- `lib/prisma.ts`
- `lib/prisma-t2.ts`
- `lib/view-mode/t2-enrichment.ts`
- `lib/view-mode.ts` → `lib/view-mode-legacy.ts`

---

## 5. Notas Importantes

1. **T2 siempre en BD secundaria**: Los documentos T2 NUNCA deben guardarse en la BD principal.

2. **Flujo de recepción separado**: La recepción de mercadería (remito/GoodsReceipt) es un proceso separado de la carga de factura.

3. **Estado COMPLETADA**: Solo se debe usar cuando:
   - Hay factura cargada (PurchaseReceipt)
   - Hay mercadería recibida (GoodsReceipt)

4. **Regenerar cliente T2**: Si hay problemas con T2, ejecutar:
   ```bash
   npx prisma generate --schema=prisma/schema-t2.prisma
   ```

5. **Reiniciar servidor**: Después de cambios en Prisma o conexiones, reiniciar Next.js.
