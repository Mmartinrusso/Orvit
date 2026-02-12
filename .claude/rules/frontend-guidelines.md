# Frontend Development Guidelines - ORVIT Style

## Filosofía General

### Principios Core
1. **Funcionalidad primero, estética después** - Asegurar que todo funcione antes de embellecer
2. **Consistencia > Creatividad** - Seguir patrones existentes del codebase
3. **Feedback inmediato** - El usuario siempre debe saber qué está pasando
4. **Progresividad** - Empezar simple, agregar complejidad solo si es necesario

---

## Stack Técnico

```
- React 18+ con Next.js App Router
- TypeScript estricto
- Tailwind CSS para estilos
- shadcn/ui para componentes base
- Lucide React para íconos
- Sonner para toasts
- date-fns para fechas (con locale 'es')
```

---

## Estructura de Componentes

### Orden de Código en Componentes
```tsx
export default function MiComponente() {
  // 1. Contexts
  const { currentCompany } = useCompany();

  // 2. Custom Hooks
  const { data, loading, error } = useMiHook();

  // 3. Estados locales (agrupados por función)
  // - Estados de UI
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDialog, setShowDialog] = useState(false);

  // - Estados de datos
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);

  // - Estados de selección múltiple
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // 4. Efectos (useEffect)
  useEffect(() => { /* cargar datos */ }, [dependencies]);

  // 5. Memos y cálculos derivados
  const stats = useMemo(() => ({ /* ... */ }), [data]);
  const filteredItems = useMemo(() => { /* ... */ }, [items, filters]);

  // 6. Handlers (agrupados por tipo)
  // - CRUD handlers
  const handleCreate = async () => { /* ... */ };
  const handleUpdate = async () => { /* ... */ };
  const handleDelete = async () => { /* ... */ };

  // - Bulk action handlers
  const handleBulkActivate = async () => { /* ... */ };
  const handleBulkDelete = async () => { /* ... */ };

  // - UI handlers
  const handleViewItem = (item) => { /* ... */ };
  const toggleSelection = (id: number) => { /* ... */ };

  // 7. Helper functions
  const formatValue = (value: number) => { /* ... */ };
  const getStatusInfo = (status: string) => { /* ... */ };

  // 8. Loading state
  if (loading) return <LoadingSpinner />;

  // 9. Render
  return (
    <TooltipProvider>
      {/* ... */}
    </TooltipProvider>
  );
}
```

---

## Sistema de Colores Dinámicos

### Configuración de Colores del Usuario
```tsx
interface UserColorPreferences {
  themeName: string;
  chart1: string;  // Primario - Azul/Indigo
  chart2: string;  // Secundario - Violeta
  chart3: string;  // Terciario - Rosa/Magenta
  chart4: string;  // Advertencia - Ámbar/Naranja
  chart5: string;  // Éxito - Verde/Esmeralda
  chart6: string;  // Info - Cyan/Turquesa
  kpiPositive: string;  // Verde para positivos
  kpiNegative: string;  // Rojo para negativos
  kpiNeutral: string;   // Gris para neutrales
}

const DEFAULT_COLORS: UserColorPreferences = {
  themeName: 'Predeterminado',
  chart1: '#6366f1',
  chart2: '#8b5cf6',
  chart3: '#ec4899',
  chart4: '#f59e0b',
  chart5: '#10b981',
  chart6: '#06b6d4',
  kpiPositive: '#10b981',
  kpiNegative: '#ef4444',
  kpiNeutral: '#64748b',
};
```

### Uso de Colores con Opacidad
```tsx
// Fondo con opacidad (15 = ~9% opacidad)
style={{ backgroundColor: `${userColors.chart1}15` }}

// Fondo más visible (20 = ~12%)
style={{ backgroundColor: `${userColors.chart4}20` }}

// Borde con opacidad (40 = ~25%)
style={{ borderColor: `${userColors.chart4}40` }}

// Fondo muy sutil (08 = ~3%)
style={{ backgroundColor: `${userColors.chart4}08` }}
```

### Patrón para Íconos con Fondo
```tsx
<div
  className="h-10 w-10 rounded-full flex items-center justify-center"
  style={{ backgroundColor: `${userColors.chart1}15` }}
>
  <BookOpen className="h-5 w-5" style={{ color: userColors.chart1 }} />
</div>
```

---

## Patrones de UI

### 1. KPI Cards
```tsx
<Card>
  <CardContent className="p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          Título del KPI
        </p>
        <p className="text-2xl font-bold">{valor}</p>
        <p className="text-xs text-muted-foreground mt-1">
          <span className="font-medium" style={{ color: userColors.kpiPositive }}>
            {subvalor}
          </span> descripción
        </p>
      </div>
      <div
        className="h-10 w-10 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${userColors.chart1}15` }}
      >
        <Icon className="h-5 w-5" style={{ color: userColors.chart1 }} />
      </div>
    </div>
  </CardContent>
</Card>
```

### 2. Barras de Progreso
```tsx
{/* Barra simple */}
<div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
  <div
    className="h-full rounded-full transition-all"
    style={{
      backgroundColor: userColors.chart1,
      width: `${(value / total) * 100}%`
    }}
  />
</div>

{/* Barra apilada */}
<div className="h-3 w-full rounded-full overflow-hidden flex">
  <div style={{ backgroundColor: color1, width: `${pct1}%` }} />
  <div style={{ backgroundColor: color2, width: `${pct2}%` }} />
  <div style={{ backgroundColor: color3, width: `${pct3}%` }} />
</div>

{/* Gradiente Min-Max */}
<div
  className="h-2 w-full rounded-full"
  style={{
    background: `linear-gradient(to right, ${userColors.kpiPositive}40, ${userColors.chart4}40, ${userColors.kpiNegative}40)`
  }}
/>
```

### 3. Alertas/Warnings Card
```tsx
<Card style={hasWarnings ? {
  borderColor: `${userColors.chart4}50`,
  backgroundColor: `${userColors.chart4}08`
} : {}}>
  <CardContent className="p-4">
    <div className="flex items-center justify-between mb-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">
        Alertas
      </p>
      {hasWarnings && (
        <Badge style={{
          backgroundColor: `${userColors.chart4}20`,
          color: userColors.chart4
        }}>
          {count}
        </Badge>
      )}
    </div>
    {!hasWarnings ? (
      <div className="flex items-center gap-2" style={{ color: userColors.kpiPositive }}>
        <Target className="h-4 w-4" />
        <span className="text-sm font-medium">Todo en orden</span>
      </div>
    ) : (
      <div className="space-y-2">
        {/* Lista de alertas */}
      </div>
    )}
  </CardContent>
</Card>
```

### 4. Top N Lists
```tsx
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm flex items-center gap-2">
      <Icon className="h-4 w-4" style={{ color: userColors.chart5 }} />
      Top 5 Items
    </CardTitle>
  </CardHeader>
  <CardContent className="pt-0">
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={item.id}
          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
          onClick={() => handleView(item)}
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-muted-foreground w-5">
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-medium truncate max-w-[200px]">
                {item.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.subtitle}
              </p>
            </div>
          </div>
          <span className="font-semibold" style={{ color: userColors.chart5 }}>
            {formatValue(item.value)}
          </span>
        </div>
      ))}
    </div>
  </CardContent>
</Card>
```

---

## Toolbar Pattern

```tsx
<div className="flex items-center gap-4 flex-wrap">
  {/* Search */}
  <div className="relative flex-1 min-w-[250px]">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input
      placeholder="Buscar..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="pl-10 bg-background"
    />
    {searchTerm && (
      <Button
        variant="ghost"
        size="sm"
        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
        onClick={() => setSearchTerm('')}
      >
        <X className="h-4 w-4" />
      </Button>
    )}
  </div>

  {/* Filters */}
  <Select value={filter} onValueChange={setFilter}>
    <SelectTrigger className="w-[140px]">
      <SelectValue placeholder="Filtro" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Todos</SelectItem>
      {/* ... */}
    </SelectContent>
  </Select>

  {/* Sort Dropdown */}
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm" className="gap-2">
        <ArrowUpDown className="h-4 w-4" />
        Ordenar
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => setSortBy('name')}>
        Por nombre {sortBy === 'name' && '✓'}
      </DropdownMenuItem>
      {/* ... */}
    </DropdownMenuContent>
  </DropdownMenu>

  {/* View Toggle */}
  <div className="flex border rounded-lg p-1 gap-1">
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setViewMode('grid')}
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Vista grilla</TooltipContent>
    </Tooltip>
    {/* ... más vistas */}
  </div>

  {/* Selection Mode Toggle */}
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant={selectionMode ? 'secondary' : 'outline'}
        size="sm"
        className="gap-2"
        onClick={() => {
          setSelectionMode(!selectionMode);
          setSelectedIds([]);
        }}
      >
        <CheckSquare className="h-4 w-4" />
        {selectionMode ? 'Cancelar' : 'Seleccionar'}
      </Button>
    </TooltipTrigger>
    <TooltipContent>Modo selección múltiple</TooltipContent>
  </Tooltip>

  {/* Export */}
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
        <Download className="h-4 w-4" />
        Exportar
      </Button>
    </TooltipTrigger>
    <TooltipContent>Exportar a CSV</TooltipContent>
  </Tooltip>
</div>
```

---

## Bulk Actions Bar

```tsx
{selectionMode && (
  <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border">
    <div className="flex items-center gap-2">
      <Checkbox
        checked={selectedIds.length === items.length && items.length > 0}
        onCheckedChange={selectAll}
      />
      <span className="text-sm text-muted-foreground">
        {selectedIds.length === 0
          ? 'Seleccionar todas'
          : `${selectedIds.length} seleccionada${selectedIds.length !== 1 ? 's' : ''}`}
      </span>
    </div>
    {selectedIds.length > 0 && (
      <div className="flex items-center gap-2 ml-auto">
        <Button variant="outline" size="sm" className="gap-1" onClick={handleBulkActivate}>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          Activar
        </Button>
        <Button variant="outline" size="sm" className="gap-1" onClick={handleBulkDeactivate}>
          <XCircle className="h-4 w-4 text-amber-600" />
          Desactivar
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 text-red-600 hover:bg-red-50"
          onClick={handleBulkDelete}
        >
          <Trash2 className="h-4 w-4" />
          Eliminar
        </Button>
      </div>
    )}
  </div>
)}
```

---

## Cards con Selección

```tsx
<Card
  className={cn(
    "group relative overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer border",
    !item.isActive && "opacity-60 bg-muted/30",
    selectionMode && selectedIds.includes(item.id) && "ring-2 ring-primary"
  )}
  onClick={() => {
    if (selectionMode) {
      toggleSelection(item.id);
    } else {
      handleView(item);
    }
  }}
>
  {/* Left border accent */}
  <div className={cn(
    "absolute left-0 top-0 bottom-0 w-1",
    item.isActive ? "bg-green-500" : "bg-gray-300"
  )} />

  <CardContent className="p-4">
    <div className="flex items-start justify-between mb-3">
      {selectionMode && (
        <div className="mr-2" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedIds.includes(item.id)}
            onCheckedChange={() => toggleSelection(item.id)}
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-base truncate">{item.name}</h3>
        <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
      </div>
      {!selectionMode && (
        <DropdownMenu>
          {/* Menú de acciones */}
        </DropdownMenu>
      )}
    </div>
    {/* Resto del contenido */}
  </CardContent>
</Card>
```

---

## Feedback Patterns

### Toast Notifications
```tsx
// Loading
toast.loading('Procesando...', { id: 'action' });

// Success (reemplaza loading)
toast.success('Operación exitosa', { id: 'action' });

// Error (reemplaza loading)
toast.error('Error al procesar', { id: 'action' });

// Info
toast.info('Funcionalidad próximamente');
```

### Confirmaciones Destructivas
```tsx
const handleDelete = async (id: number) => {
  if (!confirm('¿Eliminar este elemento? Esta acción no se puede deshacer.')) return;

  try {
    toast.loading('Eliminando...', { id: 'delete' });
    await deleteItem(id);
    toast.success('Elemento eliminado', { id: 'delete' });
    refreshData();
  } catch {
    toast.error('Error al eliminar', { id: 'delete' });
  }
};
```

### Loading States
```tsx
if (loading) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <Icon className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">Cargando datos...</p>
      </div>
    </div>
  );
}
```

---

## Empty States

```tsx
{items.length === 0 ? (
  <Card className="flex-1 flex items-center justify-center">
    <div className="text-center py-12">
      <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
        <BookOpen className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-1">No hay elementos</h3>
      <p className="text-muted-foreground text-sm mb-4">
        Crea tu primer elemento para comenzar
      </p>
      <Button onClick={() => setShowCreateDialog(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Crear primer elemento
      </Button>
    </div>
  </Card>
) : (
  /* Lista de items */
)}
```

---

## Export Functions

### CSV Export
```tsx
const handleExportCSV = () => {
  const headers = ['Nombre', 'Tipo', 'Valor', 'Estado'];
  const rows = items.map(item => [
    item.name,
    item.type,
    item.value,
    item.isActive ? 'Activo' : 'Inactivo'
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `export_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  toast.success('Archivo CSV descargado');
};
```

### Copy to Clipboard
```tsx
const handleCopy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  } catch {
    toast.error('No se pudo copiar');
  }
};
```

---

## Responsive Design

### Grid Patterns
```tsx
// KPIs
<div className="grid grid-cols-2 md:grid-cols-5 gap-4">

// Cards principales
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">

// Items grid
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
```

### Mobile Considerations
```tsx
// Toolbar wrap en mobile
<div className="flex items-center gap-4 flex-wrap">

// Texto truncado
<p className="truncate max-w-[200px]">

// Min-width para search
<div className="relative flex-1 min-w-[250px]">
```

---

## Naming Conventions

### Variables de Estado
```tsx
// UI states
showDialog, showSheet, isEditing, isLoading
viewMode, activeSection, activeTab
selectionMode, selectedIds

// Data states
items, selectedItem, editingItem
searchTerm, filterValue, sortBy

// Form states
formData, formErrors, isSubmitting
```

### Handlers
```tsx
// CRUD
handleCreate, handleUpdate, handleDelete
handleSave, handleCancel

// Navigation/View
handleView, handleEdit, handleSelect

// Bulk
handleBulkActivate, handleBulkDeactivate, handleBulkDelete

// Toggle
toggleSelection, toggleActive, toggleView

// Export/Copy
handleExportCSV, handleCopyToClipboard
```

---

## Anti-Patterns a Evitar

1. **NO usar colores hardcodeados** cuando hay sistema de colores del usuario
2. **NO hacer fetch sin loading state**
3. **NO eliminar sin confirmación**
4. **NO usar alert()** - usar toast o confirm
5. **NO olvidar stopPropagation** en elementos clickeables dentro de cards clickeables
6. **NO mezclar estilos inline y clases** innecesariamente
7. **NO crear componentes nuevos** si existe uno similar en el codebase
8. **NO ignorar estados vacíos** - siempre mostrar empty state apropiado
