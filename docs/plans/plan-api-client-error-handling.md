# Plan: Estandarizar manejo de errores en frontend

## Contexto

Actualmente hay ~63 componentes en `components/ventas/` que hacen `fetch()` directo con manejo de errores inconsistente. Los patrones varían: algunos hacen `try/catch` con `toast.error`, otros verifican `response.ok` silenciosamente, y ninguno diferencia tipos de error HTTP (401/403/400/500) ni maneja errores de red con opción de reintentar.

**API response format existente:** `{ error: string, requiredPermission?: string }` para errores, `{ data, pagination? }` para éxito.

**Dependencias existentes:** `sonner` para toasts, `lucide-react` para íconos, shadcn/ui para UI, TanStack Query v5 para hooks de datos.

---

## Paso 1: Crear `lib/api-client.ts`

**Archivo:** `project/lib/api-client.ts` (nuevo)

Función central `apiRequest<T>(url, options?)` que:

```typescript
// Tipos
type ApiErrorType = 'unauthorized' | 'forbidden' | 'validation' | 'not_found' | 'server' | 'network' | 'unknown';

interface ApiError {
  type: ApiErrorType;
  status: number;
  message: string;       // Mensaje user-friendly en español
  details?: string;      // Detalles del backend (ej: campo de validación)
  retryable: boolean;    // true para network/500
}

interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}
```

**Lógica de mapeo de errores:**
- `401` → type `'unauthorized'`, message `'Tu sesión ha expirado. Redirigiendo al login...'`, redirect a `/login` via `window.location.href`
- `403` → type `'forbidden'`, message `'No tienes permisos para esta acción'`
- `400` → type `'validation'`, message del backend `response.error` o `'Datos inválidos'`
- `404` → type `'not_found'`, message `'El recurso no fue encontrado'`
- `500` → type `'server'`, message `'Error del servidor. Intenta nuevamente'`, `retryable: true`
- Network error (fetch throws) → type `'network'`, message `'Error de conexión. Verifica tu internet e intenta nuevamente'`, `retryable: true`

**Implementación:**
- Wrapper alrededor de `fetch()` nativo
- Agrega `Content-Type: application/json` y `credentials: 'include'` por defecto
- Parsea JSON automáticamente
- Para 401: hace redirect a login (sin refresh - eso lo maneja el middleware/AuthContext)
- Retorna `{ data, error }` - nunca throws

---

## Paso 2: Crear `hooks/use-api-client.ts`

**Archivo:** `project/hooks/use-api-client.ts` (nuevo)

Hook `useApiClient()` que expone:

```typescript
interface UseApiClientReturn {
  request: <T>(url: string, options?: RequestInit) => Promise<ApiResponse<T>>;
  get: <T>(url: string) => Promise<ApiResponse<T>>;
  post: <T>(url: string, body: unknown) => Promise<ApiResponse<T>>;
  put: <T>(url: string, body: unknown) => Promise<ApiResponse<T>>;
  del: <T>(url: string) => Promise<ApiResponse<T>>;
  loading: boolean;
  error: ApiError | null;
  clearError: () => void;
}
```

**Características:**
- Trackea `loading` state internamente con `useState`
- Guarda último `error` en state para que el componente pueda renderizar `<ErrorMessage>`
- `clearError()` para limpiar manualmente
- Métodos shorthand (`get`, `post`, `put`, `del`) que llaman a `apiRequest` con el method correcto
- Muestra toast automático en errores (excepto 401 que redirige)
- Para errores `retryable`, el toast incluye hint de reintentar

---

## Paso 3: Crear `components/ui/ErrorMessage.tsx`

**Archivo:** `project/components/ui/ErrorMessage.tsx` (nuevo)

Componente que muestra errores inline con ícono, color y botón de reintentar:

```tsx
interface ErrorMessageProps {
  error: ApiError;
  onRetry?: () => void;   // Si se pasa, muestra botón "Reintentar"
  className?: string;
}
```

**Renderizado por tipo de error:**
- `forbidden` → ícono `ShieldX` (rojo), fondo `destructive/10`, texto del error
- `validation` → ícono `AlertCircle` (ámbar), fondo `warning/10`, muestra message + details si existen
- `server` → ícono `ServerCrash` (rojo), fondo `destructive/10`, botón "Reintentar"
- `network` → ícono `WifiOff` (naranja), fondo `warning/10`, botón "Reintentar"
- `not_found` → ícono `SearchX` (gris), fondo `muted`, mensaje

**Usa los colores del sistema** (`userColors` vía contexto) cuando estén disponibles, con fallback a clases Tailwind estándar.

**Basado en** el componente `Alert` existente de shadcn para mantener consistencia visual.

---

## Paso 4: Migrar componentes de ventas

**Estrategia:** Migración progresiva por prioridad. No se migran todos los 63 componentes de una vez — se migran los que tienen fetch directo con peor manejo de errores.

### Batch 1 — Componentes críticos con múltiples fetches (8 archivos)
Estos son los que más se benefician porque tienen manejo de errores inconsistente o silencioso:

1. **`client-form-dialog.tsx`** — 9 fetches paralelos sin error handling
2. **`payment-form.tsx`** — Múltiples fetches de cuentas/clientes
3. **`invoice-form-sheet.tsx`** — Creación de facturas
4. **`orden-confirm-dialog.tsx`** — Validación de órdenes
5. **`orden-edit-form.tsx`** — Edición de órdenes
6. **`product-create-dialog.tsx`** — Creación de productos
7. **`cotizaciones-dashboard.tsx`** — Dashboard de cotizaciones
8. **`ordenes-venta-list.tsx`** — Lista principal de órdenes

### Batch 2 — Componentes con operaciones CRUD (10-15 archivos)
Modales de edición, listas con delete, acciones bulk:
- `product-edit-modal.tsx`, `product-detail-modal.tsx`
- `credit-note-create-modal.tsx`, `collection-action-modal.tsx`
- `ordenes-bulk-actions.tsx`, `delivery-form-sheet.tsx`
- `load-order-form-modal.tsx`
- Componentes de configuración que hacen POST/PUT

### Batch 3 — Componentes de lectura (restantes)
Solo hacen GET para cargar datos. Menor prioridad pero se benefician del loading/error estandarizado.

### Patrón de migración por componente:

**Antes:**
```typescript
try {
  const response = await fetch('/api/ventas/ordenes');
  if (!response.ok) throw new Error('Error');
  const data = await response.json();
  setItems(data.data);
} catch (error) {
  console.error(error);
  toast.error('Error al cargar órdenes');
}
```

**Después:**
```typescript
const { get, loading, error, clearError } = useApiClient();

const loadData = async () => {
  const { data, error } = await get<{ data: Orden[] }>('/api/ventas/ordenes');
  if (data) setItems(data.data);
  // Error se muestra automáticamente via toast + se puede renderizar <ErrorMessage>
};

// En el render:
{error && <ErrorMessage error={error} onRetry={loadData} />}
```

---

## Paso 5: Mensajes específicos por contexto

En los handlers de componentes, agregar mensajes contextuales cuando el error genérico no es suficiente:

```typescript
// En orden-confirm-dialog.tsx
const { data, error } = await post('/api/ventas/ordenes/confirm', body);
if (error?.type === 'validation' && error.details?.includes('margen')) {
  // El backend ya envía "El margen está por debajo del mínimo" en error.message
  // Se muestra tal cual
}

// En cualquier componente con acciones protegidas
if (error?.type === 'forbidden') {
  // El mensaje estándar "No tienes permisos para esta acción" ya es correcto
}
```

Los mensajes vienen del backend en la mayoría de casos. El api-client solo agrega fallbacks cuando el backend no envía mensaje.

---

## Paso 6: Botón "Reintentar" en errores de red

Ya cubierto en el componente `ErrorMessage.tsx` (Paso 3). El prop `onRetry` se pasa en los componentes migrados:

```tsx
{error?.retryable && (
  <ErrorMessage error={error} onRetry={() => loadData()} />
)}
```

Para errores en toasts (cuando no hay ErrorMessage inline), el toast mostrará el mensaje pero sin botón de retry — el retry es solo en el componente inline.

---

## Archivos a crear (3)

| Archivo | Tamaño est. | Descripción |
|---------|-------------|-------------|
| `project/lib/api-client.ts` | ~80 líneas | Función `apiRequest` + tipos |
| `project/hooks/use-api-client.ts` | ~60 líneas | Hook con loading/error state |
| `project/components/ui/ErrorMessage.tsx` | ~70 líneas | Componente de error visual |

## Archivos a modificar (Batch 1 — 8 archivos)

| Archivo | Cambio |
|---------|--------|
| `components/ventas/client-form-dialog.tsx` | Reemplazar 9 fetches por `useApiClient` |
| `components/ventas/payment-form.tsx` | Reemplazar fetches de cuentas/clientes |
| `components/ventas/invoice-form-sheet.tsx` | Reemplazar fetch de creación |
| `components/ventas/orden-confirm-dialog.tsx` | Reemplazar fetch de validación |
| `components/ventas/orden-edit-form.tsx` | Reemplazar fetches de edición |
| `components/ventas/product-create-dialog.tsx` | Reemplazar fetch de creación |
| `components/ventas/cotizaciones-dashboard.tsx` | Reemplazar fetches de dashboard |
| `components/ventas/ordenes-venta-list.tsx` | Reemplazar fetches de listado |

---

## Decisiones de diseño

1. **`{ data, error }` en vez de throw** — Consistente, sin try/catch en cada componente, tipado seguro
2. **Toast automático en el hook** — Evita olvidar mostrar feedback. Se puede desabilitar con `{ silent: true }` si el componente quiere manejar el error manualmente (ej: mostrar inline)
3. **No reemplazar TanStack Query** — Los hooks existentes que usan TanStack Query (use-productos, use-insumos, etc.) se quedan. `useApiClient` es para fetches directos en componentes que no tienen hook dedicado
4. **Migración por batches** — Minimiza riesgo de regresiones. Batch 1 primero, verificar, luego batch 2
5. **401 redirect simple** — No intentar refresh desde el api-client. El AuthContext ya maneja refresh. Si un 401 llega al componente, la sesión ya expiró definitivamente
6. **Mensajes en español** — Todo el UI ya está en español, los mensajes de error deben ser consistentes
