# Chat Compras - Resumen del Módulo

## Última sesión: 2026-01-09

### Archivos principales trabajados:
- `app/administracion/compras/proveedores/[id]/page.tsx` - Página detalle de proveedor
- `components/compras/comprobante-form-modal.tsx` - Modal de comprobantes
- `lib/pdf/account-statement-pdf.ts` - Generador PDF estado de cuenta

---

## Tabs de la Página de Proveedor

La página ahora tiene **5 tabs**:

| # | Tab | Value | Icono | Descripción |
|---|-----|-------|-------|-------------|
| 1 | Información | `general` | Info | Datos del proveedor, contacto, bancarios |
| 2 | Cuenta Corriente | `cuentas` | CreditCard | Estado de cuenta, facturas, pagos |
| 3 | Items/Precios | `items` | Package | Catálogo de items del proveedor |
| 4 | Órdenes de Compra | `ordenes` | ClipboardList | OC emitidas a este proveedor |
| 5 | Recepciones | `recepciones` | Truck | Recepciones de mercadería |

### Tab Items/Precios (Mejorado v2)
- Lista de items que el proveedor ofrece con **historial de precios**
- **Barra de búsqueda**: Buscar por nombre, código o item del sistema
- **Ordenamiento**: Por nombre, precio, última compra, o variación %
- **Filtros avanzados** (colapsables):
  - Filtro por variación: Todos, Subió, Bajó, Alta variación (>10%)
  - Contador de filtros activos en botón
  - Indicador de resultados filtrados ("Mostrando X de Y items")
- **Columnas**:
  - Nombre (con unidad y item del sistema)
  - Código proveedor
  - Precio actual
  - Variación % (badge verde/rojo con ícono TrendingUp/Down)
  - Última compra (fecha)
  - Cantidad de compras
- **Click en fila**: Abre modal de detalle mejorado (size="xl"):
  - **Estadísticas resumen** (5 cards):
    - Precio Actual (destacado con color primario)
    - Mínimo (verde)
    - Máximo (rojo)
    - Promedio
    - Variación Total desde primera compra (con icono trending)
  - **Info adicional**: Unidad (badge), Código (badge), Item sistema
  - **Filtro de período** en gráfico: Todos, 3 meses, 6 meses, 12 meses
  - **Gráfico de evolución mejorado**:
    - Barras coloreadas: verde=bajó, rojo=subió, azul=actual
    - Eje Y con valores en miles ($XXk)
    - Tooltip con precio, fecha y variación vs anterior
    - Leyenda de colores
    - Filtra por período seleccionado
  - **Tabla de historial mejorada**:
    - Columna "Variación" con diferencia absoluta y % en badge
    - Primera fila destacada con badge "Última"
    - Fechas formateadas (dd/mmm/yy)
  - **Calculadora de Costo** (nueva):
    - Input de cantidad
    - Muestra costo total a precio actual, mínimo, máximo y promedio
  - **Exportar PDF**: Botón para descargar historial de precios en PDF
- **Endpoint mejorado**: `/api/compras/proveedores/[id]/items`
  - Soporta: `search`, `sortBy`, `sortDir`, `variacion`, `limit`, `offset`, `historyLimit`
  - Retorna header `X-Total-Count` con total de registros

Estados agregados:
```typescript
// Búsqueda y ordenamiento
const [itemsSearchTerm, setItemsSearchTerm] = useState('');
const [itemsSortField, setItemsSortField] = useState<'nombre' | 'precioUnitario' | 'ultimaCompra' | 'variacion'>('nombre');
const [itemsSortDirection, setItemsSortDirection] = useState<'asc' | 'desc'>('asc');
const [selectedItemDetalle, setSelectedItemDetalle] = useState<...>(null);
const [isItemDetalleOpen, setIsItemDetalleOpen] = useState(false);

// Filtros avanzados
const [itemsFilterVariacion, setItemsFilterVariacion] = useState<'todos' | 'subio' | 'bajo' | 'alto'>('todos');
const [itemsShowFilters, setItemsShowFilters] = useState(false);

// Modal: filtros y calculadora
const [modalDateRange, setModalDateRange] = useState<'todos' | '3m' | '6m' | '12m'>('todos');
const [calculadoraCantidad, setCalculadoraCantidad] = useState<string>('1');
```

Funciones:
- `itemsFiltradosOrdenados` - useMemo que filtra por búsqueda y variación, luego ordena
- `generarItemPriceHistoryPDF()` - Genera PDF con historial de precios del item

### Tab Órdenes de Compra
- Listado de OC del proveedor
- Muestra: N° OC, fecha, estado (badge coloreado), cantidad items, total
- Botones: "Ver Todas" (link a listado completo), "Nueva OC" (con proveedor preseleccionado)
- Endpoint: `/api/compras/ordenes-compra?proveedorId=X`

### Tab Recepciones
- Listado de recepciones del proveedor
- Muestra: N° recepción, fecha, N° remito, OC relacionada (link), depósito, estado, items
- Botones: "Ver Todas", "Nueva Recepción"
- Endpoint: `/api/compras/recepciones?proveedorId=X`

### Estados agregados para tabs:
```typescript
// Items del proveedor
const [itemsProveedor, setItemsProveedor] = useState<Array<{...}>>([]);
const [loadingItems, setLoadingItems] = useState(false);

// Recepciones
const [recepciones, setRecepciones] = useState<Array<{...}>>([]);
const [loadingRecepciones, setLoadingRecepciones] = useState(false);
```

### Funciones de carga:
- `loadItemsProveedor(proveedorId)` - Carga items del proveedor
- `loadRecepcionesProveedor(proveedorId)` - Carga recepciones del proveedor
- Los datos se cargan al seleccionar cada tab (lazy loading)

---

### Funcionalidades implementadas en Cuenta Corriente:

1. **Cargar Comprobante**: Modal que abre con proveedor pre-cargado (`defaultProveedorId` prop)

2. **Filtros rápidos por período**:
   - Todos, Hoy, Semana, Mes, Trimestre
   - Función `aplicarFiltroPeriodo`

3. **Toggle ver solo pendientes**: Switch `ccSoloPendientes`

4. **Filtros colapsables**: Estado `ccFiltrosVisibles` con botón toggle

5. **Ver Órdenes de Compra**: Modal con listado de OC del proveedor y link a página completa

6. **Timeline de movimientos**:
   - Combina facturas y pagos cronológicamente
   - Colapsable con `ccTimelineVisible`
   - useMemo `timelineMovimientos`

7. **Generar PDF Estado de Cuenta**:
   - Función `generarEstadoCuentaPDF`
   - Usa `lib/pdf/account-statement-pdf.ts`

8. **Imprimir Estado de Cuenta**: Función `imprimirEstadoCuenta`

9. **Mejoras en tablas**:
   - Columna días hasta vencimiento con badges coloreados
   - Iconos de método de pago (efectivo, transferencia, cheque, etc.)
   - Columna N° OP (Orden de Pago) en tabla de pagos
   - Tipografía normal (sin monospace) en números de factura

### Estados agregados:
```typescript
const [ccSoloPendientes, setCcSoloPendientes] = useState(false);
const [ccPeriodo, setCcPeriodo] = useState<'todos' | 'hoy' | 'semana' | 'mes' | 'trimestre'>('todos');
const [ccFiltrosVisibles, setCcFiltrosVisibles] = useState(true);
const [ccTimelineVisible, setCcTimelineVisible] = useState(true);
const [isOCModalOpen, setIsOCModalOpen] = useState(false);
const [isNuevoComprobanteModalOpen, setIsNuevoComprobanteModalOpen] = useState(false);
const [ordenesCompra, setOrdenesCompra] = useState<Array<...>>([]);
const [loadingOC, setLoadingOC] = useState(false);
```

### Funciones helper agregadas:
- `aplicarFiltroPeriodo(periodo)` - Aplica filtro de fecha rápido
- `getDiasVencimiento(vencimiento, saldo)` - Calcula días y retorna info para badge
- `loadOrdenesCompra()` - Carga OC del proveedor
- `generarEstadoCuentaPDF()` - Genera y descarga PDF
- `imprimirEstadoCuenta()` - Abre ventana de impresión

### Pendiente / Ideas futuras:
- Selección múltiple de facturas para pago masivo
- Gráfico de evolución de cuenta
- Alertas de vencimientos próximos
- Exportar a Excel

### Notas de estilo:
- N° OP sin badge/contorno, texto plano
- Números de factura sin fuente monospace
- Filtros y Timeline son colapsables

---

## Funcionalidad "Agregar Item" (Implementada 2026-01-09)

### Modal para crear nuevo item del proveedor
- Botón habilitado en el tab Items/Precios
- Modal con formulario:
  - Nombre del item (requerido)
  - Descripción (opcional)
  - Código del proveedor (opcional)
  - Unidad (select: UN, KG, LT, MT, M2, M3, CAJ, PAQ, ROL, BLS)
  - Precio unitario (opcional - se actualiza con facturas)

### Estados agregados:
```typescript
const [isNuevoItemOpen, setIsNuevoItemOpen] = useState(false);
const [isSubmittingItem, setIsSubmittingItem] = useState(false);
const [nuevoItemForm, setNuevoItemForm] = useState({
  nombre: '',
  descripcion: '',
  codigoProveedor: '',
  unidad: 'UN',
  precioUnitario: '',
});
```

### Función:
- `handleCrearItem()` - POST a `/api/compras/proveedores/[id]/items`
- Recarga automática de items después de crear

---

## Órdenes de Compra de Prueba (Seed 2026-01-09)

### Script de seed creado: `prisma/seed-ordenes-compra.ts`
- Ejecutar: `npm run seed:ordenes-compra`
- Crea 5 órdenes de compra con diferentes estados:
  - BORRADOR
  - APROBADA
  - ENVIADA_PROVEEDOR
  - CONFIRMADA
  - BORRADOR (emergencia)

### Datos de prueba creados:
- 12 items de catálogo (aceites, filtros, rodamientos, etc.)
- Items asignados a proveedores existentes
- OC con items y totales calculados (subtotal + IVA 21%)
