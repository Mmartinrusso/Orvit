---
name: orvit-frontend
description: Frontend conventions para Orvit/Mawir. Usar cuando se crean o modifican componentes React, páginas, UI, Tailwind, shadcn/ui, formularios, diálogos, tablas, KPIs, vistas kanban o listas. Aplica estilo Vercel V0.
---

# Frontend Orvit — Estilo Vercel V0

## Filosofía: Vercel V0

Construir UI como lo hace V0: **shadcn/ui como base, Tailwind puro, TypeScript estricto, sin CSS custom**. El diseño es limpio, minimalista, moderno y con feedback inmediato.

**Reglas de oro:**
1. Usar siempre componentes shadcn/ui antes de crear uno nuevo
2. `cn()` de `lib/utils` para clases condicionales — nunca concatenar strings
3. Tailwind classes únicamente — cero CSS custom
4. Lucide React para íconos — sin otras librerías
5. Sonner para toasts — `toast.loading` → `toast.success/error` con mismo id
6. Funcionalidad primero, luego estética

---

## Stack

```
React 18 + Next.js App Router + TypeScript
Tailwind CSS · shadcn/ui · Lucide React · Sonner · date-fns (locale 'es')
TanStack Query v5 (@tanstack/react-query)
```

---

## Estructura de componente (orden obligatorio)

```tsx
'use client'; // solo si tiene estado o eventos

import { cn } from '@/lib/utils';
// shadcn/ui imports
// lucide-react imports
// hooks internos

export default function MiComponente({ prop }: Props) {
  // 1. Contexts
  const { currentCompany } = useCompany();

  // 2. Hooks de datos
  const { data, isLoading } = useMiHook();

  // 3. Estados UI
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDialog, setShowDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // 4. Efectos
  useEffect(() => {}, []);

  // 5. Memos
  const filtered = useMemo(() => data?.filter(...), [data]);

  // 6. Handlers
  const handleCreate = async () => {};
  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar? Esta acción no se puede deshacer.')) return;
    try {
      toast.loading('Eliminando...', { id: 'del' });
      await deleteItem(id);
      toast.success('Eliminado', { id: 'del' });
    } catch {
      toast.error('Error al eliminar', { id: 'del' });
    }
  };

  // 7. Loading state
  if (isLoading) return <LoadingSpinner />;

  // 8. Render
  return (
    <TooltipProvider>
      {/* contenido */}
    </TooltipProvider>
  );
}
```

---

## Sistema de Colores Dinámicos

```tsx
// El usuario configura su paleta; siempre consumir desde userColors
interface UserColorPreferences {
  chart1: string;  // Azul/Indigo — primario
  chart2: string;  // Violeta
  chart3: string;  // Rosa/Magenta
  chart4: string;  // Ámbar/Naranja — advertencia
  chart5: string;  // Verde/Esmeralda — éxito
  chart6: string;  // Cyan/Turquesa
  kpiPositive: string;  // #10b981
  kpiNegative: string;  // #ef4444
  kpiNeutral: string;   // #64748b
}

// Opacidad hex: 08=3% · 15=9% · 20=12% · 40=25% · 80=50%
// Fondo suave:    style={{ backgroundColor: `${userColors.chart1}15` }}
// Borde suave:    style={{ borderColor: `${userColors.chart4}40` }}
// Ícono:         style={{ color: userColors.chart1 }}
```

---

## Patrones shadcn/ui + V0

### KPI Card
```tsx
<Card>
  <CardContent className="p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Título</p>
        <p className="text-2xl font-bold">{valor}</p>
        <p className="text-xs text-muted-foreground mt-1">
          <span className="font-medium" style={{ color: userColors.kpiPositive }}>+12%</span> vs mes anterior
        </p>
      </div>
      <div className="h-10 w-10 rounded-full flex items-center justify-center"
           style={{ backgroundColor: `${userColors.chart1}15` }}>
        <TrendingUp className="h-5 w-5" style={{ color: userColors.chart1 }} />
      </div>
    </div>
  </CardContent>
</Card>
```

### Toolbar con búsqueda, filtros y toggle de vista
```tsx
<div className="flex items-center gap-3 flex-wrap">
  {/* Búsqueda */}
  <div className="relative flex-1 min-w-[250px]">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
    {search && (
      <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearch('')}>
        <X className="h-4 w-4" />
      </Button>
    )}
  </div>

  {/* Filtro */}
  <Select value={filter} onValueChange={setFilter}>
    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Todos</SelectItem>
    </SelectContent>
  </Select>

  {/* Toggle vista */}
  <div className="flex border rounded-lg p-1 gap-1">
    {(['grid', 'list'] as const).map(mode => (
      <Tooltip key={mode}>
        <TooltipTrigger asChild>
          <Button variant={viewMode === mode ? 'secondary' : 'ghost'} size="sm" className="h-8 w-8 p-0"
                  onClick={() => setViewMode(mode)}>
            {mode === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Vista {mode}</TooltipContent>
      </Tooltip>
    ))}
  </div>
</div>
```

### Card seleccionable (V0 style)
```tsx
<Card className={cn(
  "group relative overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer border",
  !item.isActive && "opacity-60 bg-muted/30",
  selected && "ring-2 ring-primary"
)} onClick={() => selectionMode ? toggle(item.id) : view(item)}>
  {/* Borde izquierdo de estado */}
  <div className={cn("absolute left-0 top-0 bottom-0 w-1",
    item.isActive ? "bg-green-500" : "bg-gray-300")} />
  <CardContent className="p-4 pl-5">
    {/* contenido */}
  </CardContent>
</Card>
```

### Barra de progreso
```tsx
{/* Simple */}
<div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
  <div className="h-full rounded-full transition-all"
       style={{ backgroundColor: userColors.chart1, width: `${pct}%` }} />
</div>

{/* Apilada */}
<div className="h-3 w-full rounded-full overflow-hidden flex">
  {segments.map(s => (
    <div key={s.label} style={{ backgroundColor: s.color, width: `${s.pct}%` }} />
  ))}
</div>
```

### Bulk Actions Bar
```tsx
{selectionMode && (
  <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg border">
    <Checkbox checked={selectedIds.length === items.length}
              onCheckedChange={selectAll} />
    <span className="text-sm text-muted-foreground">
      {selectedIds.length === 0 ? 'Seleccionar todos' : `${selectedIds.length} seleccionado(s)`}
    </span>
    {selectedIds.length > 0 && (
      <div className="flex gap-2 ml-auto">
        <Button variant="outline" size="sm" onClick={handleBulkActivate}>
          <CheckCircle2 className="h-4 w-4 text-green-600 mr-1" /> Activar
        </Button>
        <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={handleBulkDelete}>
          <Trash2 className="h-4 w-4 mr-1" /> Eliminar
        </Button>
      </div>
    )}
  </div>
)}
```

### Empty State
```tsx
<Card className="flex-1 flex items-center justify-center min-h-[300px]">
  <div className="text-center py-12">
    <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
      <FileX className="h-8 w-8 text-muted-foreground" />
    </div>
    <h3 className="text-lg font-medium mb-1">No hay elementos</h3>
    <p className="text-sm text-muted-foreground mb-4">Creá el primero para comenzar</p>
    <Button onClick={() => setShowDialog(true)}>
      <Plus className="h-4 w-4 mr-2" /> Crear
    </Button>
  </div>
</Card>
```

### Loading State
```tsx
<div className="flex items-center justify-center h-64">
  <div className="flex flex-col items-center gap-3">
    <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
    <p className="text-sm text-muted-foreground">Cargando...</p>
  </div>
</div>
```

---

## Grids responsivos

```tsx
// KPIs
<div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
// Cards
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
```

---

## Naming conventions

```
Estados UI:     showDialog, isEditing, viewMode, selectionMode
Estados datos:  items, selectedItem, formData
Handlers:       handleCreate/Update/Delete, handleBulkX, toggleSelection, handleExportCSV
```

---

## Anti-patterns

- ❌ Colores hardcodeados cuando hay `userColors`
- ❌ `alert()` — usar `confirm()` solo para destructivos, toast para feedback
- ❌ `stopPropagation` olvidado en elementos dentro de cards clickeables
- ❌ Fetch sin loading state
- ❌ CSS custom cuando Tailwind puede hacerlo
- ❌ Componente nuevo cuando existe uno en shadcn/ui
