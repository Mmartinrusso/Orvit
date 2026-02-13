# Mejoras del Módulo de Máquinas - Changelog

**Fecha:** 2026-01-19
**Versión:** 2.0.0

---

## Resumen

Se implementaron 8 mejoras principales en el módulo de máquinas (`/mantenimiento/maquinas`), abarcando frontend, backend, validaciones, UX y nuevas funcionalidades.

---

## 1. MachineDialog - Validaciones Cruzadas y Detección de Duplicados

### Archivos modificados:
- `components/maquinas/MachineDialog.tsx`
- `app/api/machines/check-duplicate/route.ts` (NUEVO)

### Cambios:
- **Validación de fechas cruzadas** con Zod `.refine()`:
  - Fecha de instalación no puede ser anterior a fecha de adquisición
  - Año de fabricación no puede ser futuro
  - Vencimiento de garantía no puede ser anterior a adquisición

- **Detección de duplicados en tiempo real**:
  - Verifica número de serie y código SAP al perder foco del campo
  - Muestra alerta si ya existe una máquina con esos datos
  - Nuevo endpoint API: `GET /api/machines/check-duplicate`

### Código clave:
```typescript
// Validación Zod
}).refine((data) => {
  if (data.installationDate && data.acquisitionDate) {
    return new Date(data.installationDate) >= new Date(data.acquisitionDate);
  }
  return true;
}, {
  message: 'La fecha de instalación no puede ser anterior a la fecha de adquisición',
  path: ['installationDate'],
})
```

---

## 2. MachineDetailDialog - Lazy Loading y Badges con Contadores

### Archivos modificados:
- `components/maquinas/MachineDetailDialog.tsx`

### Cambios:
- **Lazy loading de tabs**: Solo carga contenido cuando se visita la pestaña por primera vez
- **Badges con contadores** en tabs:
  - Mantenimiento: muestra cantidad de OTs
  - Fallas: muestra cantidad de fallas abiertas
  - Componentes: muestra cantidad de componentes

### Código clave:
```typescript
const [visitedTabs, setVisitedTabs] = useState<Set<string>>(() => new Set([initialTab]));

const handleTabChange = useCallback((tab: string) => {
  setActiveTab(tab);
  setVisitedTabs(prev => {
    if (prev.has(tab)) return prev;
    const newSet = new Set(prev);
    newSet.add(tab);
    return newSet;
  });
}, []);

// En el render:
{visitedTabs.has('maintenance') && (
  <HeavyMaintenanceContent />
)}
```

---

## 3. MachineGrid - View Modes y Ordenamiento

### Archivos modificados:
- `components/maquinas/MachineGrid.tsx`
- `app/mantenimiento/maquinas/page.tsx`

### Cambios:
- **3 modos de vista**:
  - Grid (tarjetas con imagen)
  - List (lista compacta horizontal)
  - Table (tabla con columnas)

- **Ordenamiento** por:
  - Nombre
  - Health Score
  - Estado
  - Fecha de actualización
  - Fecha de creación

- **Persistencia** en localStorage

### Tipos exportados:
```typescript
export type ViewMode = 'grid' | 'list' | 'table';
export type SortField = 'name' | 'healthScore' | 'status' | 'updatedAt' | 'createdAt';
export type SortOrder = 'asc' | 'desc';
```

---

## 4. ComponentDetailsModal - Health Score y Criticidad

### Archivos modificados:
- `components/maquinas/ComponentDetailsModal.tsx`
- `lib/types.ts`

### Cambios:
- **Nuevos campos en MachineComponent**:
  ```typescript
  criticality?: number;        // 1-10
  isSafetyCritical?: boolean;
  failureCount?: number;
  workOrderCount?: number;
  ```

- **Badges visuales** en el header del modal:
  - Badge de criticidad (1-10) con colores
  - Badge de "Crítico Seguridad" si aplica

- **Nueva sección "Criticidad y Seguridad"**:
  - Indicador circular de criticidad
  - Indicador de seguridad crítica
  - Contador de fallas
  - Contador de OTs
  - Alerta especial si es crítico para seguridad

---

## 5. Botones Copiar al Clipboard para IDs

### Archivos modificados:
- `components/maquinas/ComponentDetailsModal.tsx`
- `components/maquinas/MachineDetailsSection.tsx` (ya existía)

### Cambios:
- **ComponentDetailsModal**: Botón de copiar para ID del componente
- **MachineDetailsSection**: Ya tenía botones para ID, Serial, SAP, Asset Code

### Código:
```typescript
const copyToClipboard = async (text: string, label: string) => {
  await navigator.clipboard.writeText(text);
  toast({ title: 'Copiado', description: `${label} copiado al portapapeles` });
};
```

---

## 6. Alerta de Garantía (Warranty Countdown)

### Archivos modificados:
- `components/maquinas/MachineGrid.tsx`
- `components/maquinas/MachineDetailsSection.tsx`

### Cambios:

#### En MachineGrid:
- **Badge de garantía** en cada tarjeta:
  - Rojo: Garantía vencida
  - Ámbar: Vence en ≤30 días
  - Verde: Válida por ≤90 días
  - Sin badge si >90 días

#### En MachineDetailsSection:
- **Alerta prominente** al inicio si garantía vencida/por vencer
- **Nueva tarjeta "Garantía"** con:
  - Fecha de vencimiento
  - Días restantes
  - Proveedor
  - Cobertura

### Código clave:
```typescript
const getWarrantyBadge = (warrantyExpiration: Date | string | null | undefined) => {
  const daysUntilExpiration = differenceInDays(expirationDate, today);
  const isExpired = isPast(expirationDate);

  if (isExpired) return <Badge className="bg-red-500">Vencida</Badge>;
  if (daysUntilExpiration <= 30) return <Badge className="bg-amber-500">{daysUntilExpiration}d</Badge>;
  // ...
};
```

---

## 7. Filtros Avanzados (Sidebar Sheet)

### Archivos modificados:
- `app/mantenimiento/maquinas/page.tsx`

### Cambios:
- **Sheet lateral** con filtros avanzados:
  - **Slider de Health Score**: Rango mínimo-máximo (0-100)
  - **Checkboxes**:
    - Garantía por vencer (30 días)
    - Con fallas abiertas
    - Con OTs pendientes
  - **Filtro por marca**: Badges seleccionables
  - **Filtro por línea de producción**: Badges seleccionables

- **Contador de filtros activos** en el botón
- **Persistencia** en localStorage

### Estado:
```typescript
const [advancedFilters, setAdvancedFilters] = useState<{
  minHealthScore: number;
  maxHealthScore: number;
  hasWarrantyExpiring: boolean;
  hasOpenFailures: boolean;
  hasPendingWorkOrders: boolean;
  brands: string[];
  productionLines: string[];
}>();
```

---

## 8. Selección Múltiple y Favoritos

### Archivos modificados:
- `app/mantenimiento/maquinas/page.tsx`
- `components/maquinas/MachineGrid.tsx`

### Cambios:

#### Selección Múltiple:
- **Botón "Selección"** para activar modo multi-selección
- **Checkboxes** en cada tarjeta de máquina
- **Barra de acciones masivas**:
  - Contador de seleccionados
  - "Seleccionar todo"
  - "Limpiar"
  - "Agregar a favoritos"
  - "Eliminar" (con confirmación)

#### Favoritos:
- **Estrella** en cada tarjeta para marcar favoritos
- **Persistencia** en localStorage
- Feedback con toast al agregar/quitar

### Props nuevos en MachineGrid:
```typescript
isMultiSelectMode?: boolean;
selectedMachineIds?: Set<number>;
onToggleSelection?: (machineId: number) => void;
favorites?: Set<number>;
onToggleFavorite?: (machineId: number) => void;
```

---

## Archivos Creados

| Archivo | Descripción |
|---------|-------------|
| `app/api/machines/check-duplicate/route.ts` | API para verificar duplicados de serial/SAP |

---

## Archivos Modificados

| Archivo | Cambios Principales |
|---------|---------------------|
| `components/maquinas/MachineDialog.tsx` | Validaciones Zod, detección duplicados |
| `components/maquinas/MachineDetailDialog.tsx` | Lazy loading, badges con contadores |
| `components/maquinas/MachineGrid.tsx` | View modes, sorting, warranty badge, selección, favoritos |
| `components/maquinas/ComponentDetailsModal.tsx` | Criticidad, seguridad, copy button |
| `components/maquinas/MachineDetailsSection.tsx` | Alerta y tarjeta de garantía |
| `app/mantenimiento/maquinas/page.tsx` | View mode controls, filtros avanzados, selección múltiple |
| `lib/types.ts` | Campos de criticidad en MachineComponent |

---

## Dependencias de UI Utilizadas

- `Sheet`, `SheetContent`, `SheetHeader`, `SheetFooter` - Sidebar de filtros
- `Slider` - Rango de health score
- `Checkbox` - Filtros checkbox
- `Badge` - Indicadores visuales
- `DropdownMenu` - Menú de ordenamiento

---

## Persistencia en localStorage

| Key | Contenido |
|-----|-----------|
| `machines_view_mode` | 'grid' \| 'list' \| 'table' |
| `machines_sort_field` | Campo de ordenamiento |
| `machines_sort_order` | 'asc' \| 'desc' |
| `machines_advanced_filters` | Objeto JSON con filtros |
| `machines_favorites` | Array de IDs de favoritos |
| `machines_expanded_zones` | Array de IDs de zonas expandidas |
| `machines_filter_search` | Texto de búsqueda |
| `machines_filter_status` | Filtro de estado |
| `machines_filter_type` | Filtro de tipo |

---

## Notas de Implementación

1. **Performance**: El lazy loading de tabs evita renderizar contenido pesado hasta que sea necesario
2. **UX**: Todas las preferencias se persisten para mejorar la experiencia entre sesiones
3. **Responsive**: Los controles de view mode y filtros se ocultan en mobile (`hidden sm:flex`)
4. **Accesibilidad**: Tooltips en botones, estados visuales claros
5. **Consistencia**: Se mantiene el patrón de temas (light/dark/metal) existente
