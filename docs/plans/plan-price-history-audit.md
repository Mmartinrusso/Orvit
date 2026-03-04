# Plan: Auditoría Completa de Cambios de Precios

## Resumen
Implementar sistema de auditoría que registre todo cambio de precio (tanto en `Product.salePrice` como en `SalesPriceListItem.precioUnitario`), con historial consultable, reporte de auditoría y alertas por cambios excesivos.

---

## Paso 1: Modelo Prisma `SalesPriceLog`

**Archivo:** `project/prisma/schema.prisma`

Crear modelo siguiendo el patrón exacto de `ProductCostLog` (línea 2343):

```prisma
model SalesPriceLog {
  id        String @id @default(cuid())
  productId String
  companyId Int

  // Contexto del cambio
  priceListId    Int?    // null = cambio en Product.salePrice directo
  priceListItemId Int?   // referencia al item específico

  // Valores del cambio
  previousPrice  Float?
  newPrice       Float
  currency       String  @default("ARS")

  // Porcentaje anterior/nuevo (solo para items de lista)
  previousPercent Float?
  newPercent      Float?

  // Cambio porcentual calculado
  changePercent   Float?  // ((new - old) / old) * 100

  // Origen del cambio
  changeSource   String  // 'MANUAL', 'BULK_UPDATE', 'IMPORT', 'FORMULA'

  // Metadata
  createdAt   DateTime @default(now())
  createdById Int
  notes       String?

  // Relations
  product   Product        @relation(fields: [productId], references: [id], onDelete: Cascade)
  company   Company        @relation(fields: [companyId], references: [id], onDelete: Cascade)
  createdBy User           @relation("SalesPriceLogUser", fields: [createdById], references: [id])
  priceList SalesPriceList? @relation(fields: [priceListId], references: [id], onDelete: SetNull)

  @@index([productId])
  @@index([companyId, createdAt(sort: Desc)])
  @@index([priceListId])
  @@index([changeSource])
  @@index([createdById])
  @@map("SalesPriceLog")
}
```

**Relaciones a agregar:**
- En `Product` (línea ~2315, después de `priceListItems`): `salesPriceLogs SalesPriceLog[]`
- En `Company` (línea ~161, zona ventas): `salesPriceLogs SalesPriceLog[]`
- En `User` (línea ~500, zona ventas): `salesPriceLogsCreated SalesPriceLog[] @relation("SalesPriceLogUser")`
- En `SalesPriceList` (línea ~9860): `priceLogs SalesPriceLog[]`

**Razón de un solo modelo:** Unificar `Product.salePrice` y `SalesPriceListItem.precioUnitario` en una sola tabla simplifica queries de auditoría. El campo `priceListId` null/no-null diferencia entre ambos.

---

## Paso 2: Migración Prisma

Ejecutar:
```bash
cd project && npx prisma db push
```

(El proyecto usa `db push` en lugar de migraciones formales, como se observa en el workflow existente.)

---

## Paso 3: Registrar cambios en listas de precios

**Archivo:** `project/app/api/ventas/listas-precios/[id]/items/route.ts`

En la función `POST` (que también hace update cuando el item ya existe):

### Rama Prisma ORM (líneas 119-133):
Antes del `update` en línea 121, obtener `existing.precioUnitario` (ya lo tenemos en `existing`). Después del update:
```typescript
// Registrar cambio de precio
if (existing) {
  const oldPrice = parseFloat(existing.precioUnitario?.toString() || '0');
  const newPriceValue = parseFloat(precioUnitario);
  if (oldPrice !== newPriceValue) {
    const changePercent = oldPrice > 0 ? ((newPriceValue - oldPrice) / oldPrice) * 100 : null;
    await (prisma as any).salesPriceLog.create({
      data: {
        productId: existing.productId,
        companyId: user!.companyId,
        priceListId: listId,
        priceListItemId: existing.id,
        previousPrice: oldPrice,
        newPrice: newPriceValue,
        changePercent,
        changeSource: 'MANUAL',
        createdById: user!.id,
      }
    });
  }
}
```

### Rama raw SQL (líneas 159-165):
Misma lógica pero con `prisma.$executeRaw` para insertar en `"SalesPriceLog"`.

### Alerta por cambio excesivo:
Si `Math.abs(changePercent) > umbral`, incluir campo `alert: true` en response para que el frontend muestre warning. El umbral se obtiene de `SalesConfig` o se usa un default de 20%.

---

## Paso 4: Registrar cambios en Product.salePrice

**Archivo:** `project/app/api/ventas/productos/[id]/route.ts`

En la función `PUT` (línea 61), después de obtener `existing` (línea 70) y antes del `prisma.product.update` (línea 115):

```typescript
// Detectar cambio de salePrice
const oldSalePrice = existing.salePrice;
const newSalePrice = salePrice !== undefined ? (salePrice ? parseFloat(salePrice) : null) : undefined;

// Después del update exitoso:
if (newSalePrice !== undefined && oldSalePrice !== newSalePrice && newSalePrice !== null) {
  const changePercent = oldSalePrice && oldSalePrice > 0
    ? ((newSalePrice - oldSalePrice) / oldSalePrice) * 100
    : null;
  await prisma.salesPriceLog.create({
    data: {
      productId: id,
      companyId: user!.companyId,
      priceListId: null, // cambio directo en producto
      previousPrice: oldSalePrice,
      newPrice: newSalePrice,
      currency: existing.saleCurrency || 'ARS',
      changePercent,
      changeSource: 'MANUAL',
      createdById: user!.id,
    }
  });
}
```

---

## Paso 5: Endpoint GET historial de precios por producto

**Archivo nuevo:** `project/app/api/ventas/productos/[id]/price-history/route.ts`

Siguiendo el patrón exacto de `/api/products/[id]/cost-history/route.ts`:

```typescript
// GET /api/ventas/productos/[id]/price-history
// Auth: requirePermission(VENTAS_PERMISSIONS.PRODUCTOS_VIEW)
// Query params: limit (default 50), offset (default 0)
// Response: { product, logs, stats, total, limit, offset }
```

- Consulta `salesPriceLog` filtrando por `productId` + `companyId`
- Include `createdBy: { select: { id, name } }` y `priceList: { select: { id, nombre } }`
- Stats: min, max, avg, totalChanges, firstRecord, lastRecord
- Cada log incluye `changePercent` calculado

---

## Paso 6: Componente frontend `ProductPriceHistory`

**Archivo nuevo:** `project/components/ventas/product-price-history.tsx`

Clonar estructura de `product-cost-history.tsx` (316 líneas) adaptando:

- Props: `{ open, onOpenChange, productId, productName, currentPrice, currency }`
- Fetch a `/api/ventas/productos/${productId}/price-history`
- Stats cards: Precio Min, Precio Max, Precio Promedio, Total Cambios
- Logs list con:
  - Badge de origen: "Lista: [nombre]" o "Precio directo"
  - Badge de source: MANUAL, BULK_UPDATE, etc.
  - Color coding: rojo (aumento), verde (disminución)
  - Nombre del usuario que hizo el cambio
  - Fecha y hora
  - Porcentaje de cambio

---

## Paso 7: Integrar en modal de detalle de producto

**Archivo:** `project/components/ventas/product-detail-modal.tsx`

1. Import `ProductPriceHistory` (línea 43, junto a `ProductCostHistory`)
2. Agregar state `showPriceHistory` (línea 71, junto a `showCostHistory`)
3. En tab "pricing" (línea 421-429), después del botón "Ver Historial de Costos", agregar:
```tsx
<Button
  variant="outline"
  className="w-full"
  onClick={() => setShowPriceHistory(true)}
>
  <History className="w-4 h-4 mr-2" />
  Ver Historial de Precios de Venta
</Button>
```
4. En zona de modales (línea 615-622), agregar:
```tsx
<ProductPriceHistory
  open={showPriceHistory}
  onOpenChange={setShowPriceHistory}
  productId={product.id}
  productName={product.name}
  currentPrice={product.salePrice}
  currency={saleCurrency}
/>
```

---

## Paso 8: Reporte de auditoría de precios

### 8a. Registrar en catálogo de reportes

**Archivo:** `project/app/api/ventas/reportes/route.ts` (línea ~76, antes del cierre del array)

Agregar:
```typescript
{
  id: 'auditoria-precios',
  nombre: 'Auditoría de Precios',
  descripcion: 'Historial de todos los cambios de precios con usuario, fecha y motivo',
  categoria: 'Auditoría',
  parametros: ['fechaDesde', 'fechaHasta', 'productoId', 'usuarioId', 'listaId'],
  icon: 'DollarSign',
},
```

### 8b. Endpoint del reporte

**Archivo nuevo:** `project/app/api/ventas/reportes/auditoria-precios/route.ts`

Siguiendo patrón de `ranking-productos/route.ts`:

```typescript
// GET /api/ventas/reportes/auditoria-precios
// Auth: requirePermission(VENTAS_PERMISSIONS.REPORTES_VIEW)
// Query params:
//   - fechaDesde, fechaHasta (required)
//   - productoId (optional) - filtrar por producto
//   - usuarioId (optional) - filtrar por quién hizo el cambio
//   - listaId (optional) - filtrar por lista de precios
//   - limite (default 100)
// Response: { cambios[], resumen, filtros }
```

Query `salesPriceLog` con:
- Include product (name, code), createdBy (name), priceList (nombre)
- Filtros por rango de fecha, producto, usuario, lista
- Resumen: total cambios, promedio cambio %, usuarios más activos, productos con más cambios
- Alertas: cambios que superan el umbral configurado

### 8c. Frontend del reporte

**Archivo:** `project/app/administracion/ventas/reportes/page.tsx`

Agregar en el switch/case de renderizado de resultados (donde se manejan `ranking-productos`, `ventas-periodo`, etc.):

- Sección para `auditoria-precios` con:
  - Tabla: Fecha, Producto, Lista, Precio Anterior, Precio Nuevo, Cambio %, Usuario
  - Color coding en columna de cambio %
  - Filtros: selector de producto, selector de usuario, rango de fechas
  - Badge de alerta para cambios que exceden umbral
  - Exportar CSV
- Agregar icono `DollarSign` al `iconMap` (línea 73)

---

## Paso 9: Sistema de alertas por cambio excesivo

Integrado en los pasos 3 y 4:

- **Umbral default:** 20% (configurable)
- **En API response:** Si `|changePercent| > umbral`, incluir `priceAlert: { percent, threshold }` en la respuesta
- **En frontend:** Toast de warning cuando se recibe `priceAlert`
  ```typescript
  toast.warning(`Cambio de precio significativo: ${percent.toFixed(1)}% (umbral: ${threshold}%)`);
  ```
- **En reporte:** Columna "Alerta" con badge rojo para cambios que exceden umbral

---

## Archivos a crear/modificar (resumen)

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `prisma/schema.prisma` | Modificar | Agregar modelo `SalesPriceLog` + relaciones |
| `app/api/ventas/listas-precios/[id]/items/route.ts` | Modificar | Log cambios en POST (update) |
| `app/api/ventas/productos/[id]/route.ts` | Modificar | Log cambios de salePrice en PUT |
| `app/api/ventas/productos/[id]/price-history/route.ts` | **Crear** | GET historial por producto |
| `components/ventas/product-price-history.tsx` | **Crear** | Componente modal historial |
| `components/ventas/product-detail-modal.tsx` | Modificar | Botón + modal de historial de precios |
| `app/api/ventas/reportes/route.ts` | Modificar | Agregar reporte al catálogo |
| `app/api/ventas/reportes/auditoria-precios/route.ts` | **Crear** | Endpoint reporte auditoría |
| `app/administracion/ventas/reportes/page.tsx` | Modificar | Renderizar reporte auditoría |

## Orden de implementación
1. Schema Prisma + migración (fundamento)
2. APIs de logging (pasos 3-4)
3. Endpoint de historial (paso 5)
4. Componente frontend historial (pasos 6-7)
5. Reporte de auditoría (paso 8)
6. Alertas (paso 9, integrado en pasos previos)
