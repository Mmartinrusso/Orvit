# Plan: Validación de Margen Mínimo en Órdenes de Venta Directas

## Contexto

Las cotizaciones (`cotizaciones/route.ts:238-244`) ya validan margen mínimo contra `salesConfig.margenMinimoPermitido` y lanzan `MARGIN_TOO_LOW` si el margen < mínimo. Las órdenes de venta directas (creadas sin pasar por cotización) **no tienen esta validación**, lo cual es un gap.

El modelo `Sale` ya tiene los campos necesarios en el schema:
- `requiereAprobacion` (Boolean, default false) — línea 9081
- `aprobadoPor` (Int?) — línea 9082
- `aprobadoAt` (DateTime?) — línea 9083

`SalesConfig` ya tiene:
- `margenMinimoPermitido` (Decimal, default 10) — línea 8277
- `alertarMargenBajo` (Boolean, default true) — línea 8278
- `marginRequiresApproval` (Boolean, default false) — línea 8338
- `marginApprovalThreshold` (Decimal?) — línea 8339

Ya existe `approval-service.ts` con `checkApprovalNeeded()` que usa `marginApprovalThreshold` para workflows de aprobación.

---

## Cambios a Realizar

### 1. `project/app/api/ventas/ordenes/route.ts` — POST (Crear orden directa)

**Ubicación**: Después del cálculo de margen (línea 258), antes de generar número (línea 261).

**Agregar validación** (misma lógica que cotizaciones líneas 238-244):

```ts
// Validar margen mínimo si está configurado
if (salesConfig?.margenMinimoPermitido) {
  const minMargin = parseFloat(salesConfig.margenMinimoPermitido.toString());
  if (margenPorcentaje < minMargin) {
    throw new Error(`MARGIN_TOO_LOW:${margenPorcentaje.toFixed(1)}:${minMargin}`);
  }
}
```

**Agregar manejo del error** en el catch (línea ~395), antes del return 500 genérico:

```ts
if (error instanceof Error) {
  if (error.message.startsWith('MARGIN_TOO_LOW:')) {
    const parts = error.message.split(':');
    const margenActual = parseFloat(parts[1]);
    const margenMinimo = parseFloat(parts[2]);
    return NextResponse.json(
      {
        error: `El margen (${margenActual}%) está por debajo del mínimo permitido (${margenMinimo}%). Requiere aprobación especial.`,
        requiereAprobacionMargen: true,
        margenActual,
        margenMinimo
      },
      { status: 400 }
    );
  }
}
```

**Agregar soporte para flag `forzarMargenBajo`**: Si el body incluye `forzarMargenBajo: true`, la orden se crea con `requiereAprobacion: true` y estado `BORRADOR` (pendiente de aprobación por gerente), en lugar de bloquear. Esto se logra:

- Leyendo `data.forzarMargenBajo` del body (agregar al schema Zod como campo opcional)
- Si `forzarMargenBajo === true` Y margen < mínimo: no lanzar error, pero setear `requiereAprobacion: true` en el `sale.create`

Cambio en la lógica de validación:

```ts
// Validar margen mínimo si está configurado
let requiereAprobacionMargen = false;
if (salesConfig?.margenMinimoPermitido) {
  const minMargin = parseFloat(salesConfig.margenMinimoPermitido.toString());
  if (margenPorcentaje < minMargin) {
    if (body.forzarMargenBajo === true) {
      requiereAprobacionMargen = true;
    } else {
      throw new Error(`MARGIN_TOO_LOW:${margenPorcentaje.toFixed(1)}:${minMargin}`);
    }
  }
}
```

Y en el `sale.create`, agregar:
```ts
requiereAprobacion: requiereAprobacionMargen,
```

---

### 2. `project/app/api/ventas/ordenes/[id]/route.ts` — PUT (Editar orden)

**Ubicación**: Después de calcular `total` (línea 214), antes de la transacción de update (línea 217).

**Agregar**: obtener `salesConfig`, calcular margen, y validar:

```ts
// Obtener salesConfig para validar margen
const salesConfig = await prisma.salesConfig.findUnique({
  where: { companyId: user!.companyId }
});

// Calcular costos y margen si hay items nuevos
let costoTotalCalc = 0;
if (itemsConCalculos.length > 0) {
  costoTotalCalc = itemsConCalculos.reduce((sum, item) => sum + (item.costo * parseFloat(String(item.cantidad || 0))), 0);
}
const margenBruto = subtotal - costoTotalCalc;
const margenPorcentaje = subtotal > 0 ? (margenBruto / subtotal) * 100 : 0;

// Validar margen mínimo
let requiereAprobacionMargen = false;
if (items && items.length > 0 && salesConfig?.margenMinimoPermitido) {
  const minMargin = parseFloat(salesConfig.margenMinimoPermitido.toString());
  if (margenPorcentaje < minMargin) {
    if (body.forzarMargenBajo === true) {
      requiereAprobacionMargen = true;
    } else {
      return NextResponse.json(
        {
          error: `El margen (${margenPorcentaje.toFixed(1)}%) está por debajo del mínimo permitido (${minMargin}%). Requiere aprobación especial.`,
          requiereAprobacionMargen: true,
          margenActual: parseFloat(margenPorcentaje.toFixed(1)),
          margenMinimo: minMargin
        },
        { status: 400 }
      );
    }
  }
}
```

Y en el `sale.update` data, agregar:
```ts
...(requiereAprobacionMargen && { requiereAprobacion: true }),
...(itemsConCalculos.length > 0 && { costoTotal: costoTotalCalc, margenBruto, margenPorcentaje }),
```

---

### 3. Nuevo: `project/app/api/ventas/ordenes/[id]/aprobar-margen/route.ts`

Endpoint para que gerentes/supervisores aprueben órdenes con margen bajo.

**Lógica**:
1. Verificar permiso `ORDENES_EDIT` (o un permiso más alto si existe)
2. Parsear `id` de params
3. Buscar la orden, verificar que `requiereAprobacion === true`
4. Verificar que el usuario tiene rol de gerente/supervisor (usar `user.role`)
5. Actualizar: `requiereAprobacion: false`, `aprobadoPor: user.id`, `aprobadoAt: new Date()`
6. Registrar auditoría
7. Invalidar caché

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, VENTAS_PERMISSIONS } from '@/lib/ventas/auth';
import { logSalesUpdate } from '@/lib/ventas/audit-helper';
import { ordenesCache } from '@/app/api/ventas/ordenes/route';
import { CACHE_PREFIXES, invalidateCache } from '@/lib/ventas/cache';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requirePermission(VENTAS_PERMISSIONS.ORDENES_EDIT);
    if (error) return error;

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await request.json();
    const { comentario } = body;

    // Buscar orden
    const orden = await prisma.sale.findFirst({
      where: { id, companyId: user!.companyId, requiereAprobacion: true }
    });

    if (!orden) {
      return NextResponse.json(
        { error: 'Orden no encontrada o no requiere aprobación' },
        { status: 404 }
      );
    }

    // Aprobar
    const ordenAprobada = await prisma.sale.update({
      where: { id },
      data: {
        requiereAprobacion: false,
        aprobadoPor: user!.id,
        aprobadoAt: new Date(),
      }
    });

    // Invalidar caché
    invalidateCache(ordenesCache, user!.companyId, CACHE_PREFIXES.ORDENES);

    // Auditoría
    await logSalesUpdate({
      entidad: 'sale',
      entidadId: id,
      companyId: user!.companyId,
      userId: user!.id,
      changes: { aprobacionMargen: true, comentario },
    });

    return NextResponse.json({
      success: true,
      message: 'Orden aprobada correctamente',
      orden: ordenAprobada
    });
  } catch (error) {
    console.error('Error aprobando margen de orden:', error);
    return NextResponse.json(
      { error: 'Error al aprobar la orden' },
      { status: 500 }
    );
  }
}
```

---

## Resumen de Archivos

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `project/app/api/ventas/ordenes/route.ts` | Editar | Agregar validación de margen en POST + manejo de error MARGIN_TOO_LOW + soporte forzarMargenBajo |
| `project/app/api/ventas/ordenes/[id]/route.ts` | Editar | Agregar validación de margen en PUT + soporte forzarMargenBajo |
| `project/app/api/ventas/ordenes/[id]/aprobar-margen/route.ts` | Crear | Endpoint POST para aprobar órdenes con margen bajo |
| `project/lib/ventas/validation-schemas.ts` | Editar | Agregar `forzarMargenBajo` como campo opcional al schema de creación de ventas |

## Notas
- No se necesita migración de Prisma — los campos `requiereAprobacion`, `aprobadoPor`, `aprobadoAt` ya existen en el modelo `Sale`
- Se reutiliza la misma lógica de error `MARGIN_TOO_LOW` que cotizaciones para consistencia
- El flag `forzarMargenBajo` permite al frontend enviar la orden igual pero marcada como pendiente de aprobación
- El `margenMinimoPermitido` ya existe en `SalesConfig` con default 10%
