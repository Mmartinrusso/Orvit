# ORVIT Design System — Componentes

Extraído exclusivamente de `components/agendav2/` — el módulo Agenda es la referencia canónica del diseño actualizado.

---

## 1. Paleta de Colores

### 1.1 Colores Neutros

| Token | Hex | Uso |
|-------|-----|-----|
| `text-primary` | `#111827` | Títulos, texto principal, botones primarios |
| `text-secondary` | `#374151` | Texto secundario, descripciones |
| `text-tertiary` | `#6B7280` | Labels, metadata, timestamps |
| `text-muted` | `#9CA3AF` | Placeholders, iconos inactivos |
| `border-light` | `#D1D5DB` | Bordes sutiles, checkboxes |
| `border-standard` | `#E4E4E8` | Bordes de cards, separadores |
| `border-dark` | `#D8D8DE` | Bordes de cards con énfasis |
| `bg-subtle` | `#F3F4F6` | Fondos de chips, tags, badges |
| `bg-surface` | `#F5F5F5` | Sidebar, paneles secundarios |
| `bg-input` | `#FAFAFA` | Fondos de inputs |
| `bg-card` | `#FFFFFF` | Cards, paneles principales |
| `bg-hover` | `#F0F0F4` | Hover en items de lista |

### 1.2 Colores de Estado

| Estado | Hex | Uso |
|--------|-----|-----|
| `status-pending` | `#9CA3AF` | Tareas pendientes (gris) |
| `status-in-progress` | `#7C3AED` | En progreso (púrpura/indigo) |
| `status-waiting` | `#D97706` | En espera (ámbar) |
| `status-completed` | `#059669` | Completado (verde) |
| `status-cancelled` | `#E5E7EB` | Cancelado (gris claro) |

### 1.3 Colores de Prioridad

| Prioridad | Background | Texto |
|-----------|-----------|-------|
| `LOW` | `#F3F4F6` | `#6B7280` |
| `MEDIUM` | `#EFF6FF` | `#1D4ED8` |
| `HIGH` | `#FEF3C7` | `#D97706` |
| `URGENT` | `#FEE2E2` | `#DC2626` |

### 1.4 Color Primario (Accent)

- **Primary**: `#7C3AED` (púrpura/indigo)
- **Primary hover**: `rgba(124, 58, 237, 0.04)` (fondo sutil)
- **Primary light**: `#F5F3FF` (fondo seleccionado)
- **Avatar fallback**: bg `#EDE9FE`, text `#7C3AED`

### 1.5 Colores de Charts (Agenda Reportes)

En la vista Reportes de Agenda, los gráficos usan colores fijos del tema:
- **Bar chart (Actividad)**: gris claro (Creadas) + verde (Completadas)
- **Horizontal bars (Estado)**: gris oscuro `#374151` (barras de distribución)
- **Pie chart (Prioridad)**: `#7C3AED` (Media), colores de prioridad para cada nivel
- **Progress bars (Personas)**: `#7C3AED` (primary)

Los KPI cards en Reportes/Portfolio usan iconos con colores de estado fijos (no dinámicos).

---

## 2. Tipografía

### 2.1 Escala de Tamaños

| Token | Tamaño | Uso |
|-------|--------|-----|
| `text-title` | 18px / 600 | Títulos de cards (TaskCard) |
| `text-heading` | 28px (text-2xl) / 700 | Headers de sección |
| `text-body` | 13-14px / 400 | Texto de cuerpo, navegación sidebar |
| `text-label` | 12px / 500 | Labels, subtítulos, notas |
| `text-caption` | 10-11px / 500 | Metadata, contadores, fechas |
| `text-tiny` | 7-8px / 700 | Iniciales en avatares, badges mini |

### 2.2 Line Heights

| Contexto | Line Height |
|----------|-------------|
| Títulos | `1.2` – `1.3` |
| Mobile títulos | `1.35` |
| Cuerpo | `1.4` |
| Descripciones largas | `1.55` |

### 2.3 Truncado

- Títulos: `line-clamp-2` (máx 2 líneas)
- Descripciones: `line-clamp-2`
- Items de lista: `truncate` (1 línea)

---

## 3. Espaciado

### 3.1 Padding

| Contexto | Valor |
|----------|-------|
| Cards internos | `16px 18px` (TaskCard), `p-4` (KPI cards) |
| Sidebar secciones | `px-4 pt-5 pb-4` |
| Inputs | `px-3 py-2` |
| Botones | `px-3 py-1.5` (sm), `px-4 py-2` (default) |
| Subtask items | `8px 12px` |
| Drop zones | `6px 4px` |

### 3.2 Gap (entre elementos)

| Gap | Uso |
|-----|-----|
| `gap-1` (4px) | Iconos + texto inline |
| `gap-2` (8px) | Items en toolbar, badges |
| `gap-3` (12px) | Columnas de kanban |
| `gap-4` (16px) | Cards en grid, sidebar + content |
| `gap-8` (32px) | Secciones principales |

---

## 4. Bordes y Sombras

### 4.1 Border Radius

| Token | Valor | Uso |
|-------|-------|-----|
| `radius-xs` | `4px` | Checkboxes, botones pequeños |
| `radius-sm` | `6px` | Inputs, dropdowns |
| `radius-md` | `8px` | Cards, badges de status, botones |
| `radius-lg` | `10px` | Paneles expandidos, subtask items |
| `radius-xl` | `12px` | Botón crear tarea sidebar |
| `radius-pill` | `999px` | Avatares, chips circulares |
| `radius-2xl` | Tailwind `2xl` | Cards mobile |

### 4.2 Box Shadow

| Token | Valor | Uso |
|-------|-------|-----|
| `shadow-subtle` | `0 1px 2px rgba(0,0,0,.08)` | Botones, elementos flotantes menores |
| `shadow-card` | `0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.07)` | Cards en reposo |
| `shadow-card-hover` | `0 2px 8px rgba(0,0,0,.08), 0 8px 28px rgba(0,0,0,.10)` | Cards on hover |
| `shadow-dropdown` | `0 4px 16px rgba(0,0,0,.10)` | Dropdowns, popovers |
| `shadow-mobile` | `0 2px 8px rgba(0,0,0,0.06)` | Cards mobile |

### 4.3 Bordes

- Cards: `1px solid #E4E4E8` (default) → `1px solid #D8D8E0` (hover)
- Inputs: `1px solid #D1D5DB`
- Sidebar: `1px solid #E4E4E8` (borde derecho)
- Drag active: `2px dashed #7C3AED`
- Subtask expanded: `1px solid #059669`

---

## 5. Componentes Base (shadcn/ui)

Lista de componentes shadcn/ui usados en el proyecto:

| Componente | Uso principal |
|-----------|---------------|
| `Avatar` | Usuarios asignados, comentarios, sidebar |
| `Badge` | Contadores, estados, etiquetas |
| `Button` | Acciones, toolbars, formularios |
| `Card` | Contenedores de contenido (KPIs, detalles, settings) |
| `Checkbox` | Subtareas, selección múltiple |
| `Dialog` | Modales de creación/edición |
| `DropdownMenu` | Menús contextuales (3 puntos), acciones |
| `Input` | Campos de texto, búsqueda |
| `Label` | Labels de formulario |
| `Popover` | Calendarios, pickers |
| `ScrollArea` | Listas scrolleables, paneles |
| `Select` | Selectores de filtro, opciones |
| `Separator` | Divisores horizontales |
| `Sheet` | Paneles laterales (detalles de tarea) |
| `Tabs` | Navegación por vistas (lista, kanban, dashboard) |
| `Textarea` | Comentarios, descripciones |
| `Tooltip` | Información contextual |
| `AlertDialog` | Confirmaciones destructivas (eliminar) |
| `Calendar` | Selector de fecha |

---

## 6. Componentes Compuestos

### 6.1 TaskCard (Card de Tarea)

**Estructura:**
```
┌─────────────────────────────────────┐
│ ● status-dot   14 Mar   ⋯ menu     │  ← Row 1: status + fecha + menú
│                                     │
│ Título de la tarea (max 2 líneas)   │  ← Row 2: título 18px/600
│                                     │
│ Descripción opcional (max 2 lín.)   │  ← Row 3: descripción 13px/400 text-tertiary
│                                     │
│ ████████░░░░░ 3/5                   │  ← Row 4: barra subtareas segmentada
│                                     │
│ 💬 4        👤 JD  👤 ME           │  ← Row 5: comentarios + avatares
└─────────────────────────────────────┘
```

**Especificaciones:**
- Background: `#FFFFFF`, border: `1px solid #D8D8DE`
- Padding: `16px 18px`
- Border radius: `8px`
- Shadow: `shadow-card` → `shadow-card-hover` on hover
- Animación entrada: `card-cascade-in` 1300ms (batch load) o `card-new-in` 420ms (nueva)
- Seleccionado: bg `#F5F3FF`, border `#7C3AED`
- Status dot: `8px` circle con color del estado
- Subtask bar: segmentos de `#111827` (done) y `#E4E4E8` (pending)
- Hover: muestra botones de acción rápida

### 6.2 BoardColumn (Columna Kanban)

**Estructura:**
```
┌────── COLUMNA ──────┐
│ [🔵] Por hacer   12  │  ← Header: badge + título + count + menú + crear
│ ████░░░░░░░░░░░░░░░ │  ← Barra progreso (3px)
│                      │
│ ┌──── TaskCard ────┐ │
│ │                  │ │
│ └──────────────────┘ │
│ ┌──── TaskCard ────┐ │
│ │                  │ │
│ └──────────────────┘ │
│                      │
│ [- - - Drop zone - ]│  ← Drag over: dashed border púrpura
└──────────────────────┘
```

**Especificaciones:**
- Badge: `30x30px`, border radius `8px`, color por status
- Progress bar: `3px` height, bg `#F0F0F0`, fill = color status
- Drop zone: min-height `160px`, on drag: `rgba(124,58,237,0.04)` bg + `2px dashed #7C3AED`
- Delete animation: `card-delete-out` 300ms (slide right + scale down)
- Gap entre cards: `6px 4px`

### 6.3 SubtaskList

**Estructura:**
```
┌───────────────────────────────────┐
│ ☐ Subtarea pendiente              │  ← Checkbox + texto
│ ☑ Subtarea completada             │  ← Verde #059669 con check blanco
│ ▼ Subtarea expandida              │
│   ┌──────────────────────────┐    │
│   │ 📝 Nota...   [Guardar]  │    │  ← Panel de nota inline
│   └──────────────────────────┘    │
│   👤 Asignado: Juan              │  ← Assignee picker
│ + Agregar subtarea                │  ← Input inline
└───────────────────────────────────┘
```

**Especificaciones:**
- Item padding: `8px 12px`, border radius `10px`
- Checkbox: `16x16px`, border `1.5px solid #D1D5DB`, radius `4px`
- Checkbox checked: bg `#059669`, animación `checkbox-pop` 350ms
- Drag: border cambia a `#059669`
- Nota save button: bg `#111827` (active) o `#E4E4E8` (inactive)
- Drag-and-drop: dnd-kit sortable

### 6.4 AgendaV2Sidebar

**Estructura:**
```
┌─── 244px ───┐
│ 👤 Avatar    │  ← User profile
│ Juan Pérez   │
│ juan@co.com  │
│              │
│ [+ Crear]    │  ← bg #111827, text white, radius 12px
│              │
│ Dashboard    │  ← Nav items
│ ▶ Mis Tareas │  ← Active: bg #EDEDED, text #111827
│ Bandeja      │
│ Tareas Fijas │
│ Reportes     │
│ Portfolio    │
│              │
│ ▼ Grupos     │  ← Collapsible section
│  ● Diseño 3  │  ← Color dot + nombre + count
│  ● Backend 5 │
│              │
│ ▼ Proyectos  │  ← Collapsible section
│  🚀 Sprint 1 │  ← Icon + nombre + avatares
│              │
│ 👥 Invitar   │  ← Bottom actions
│ ❓ Ayuda     │
└──────────────┘
```

**Especificaciones:**
- Width: `244px` fijo
- Background: `#F5F5F5`
- Border: `1px solid #E4E4E8` (derecho)
- Nav item hover: `#EEEEEE`
- Nav item active: bg `#EDEDED`, text `#111827`, font-weight 600
- Badge activo: bg `#111827` text white
- Badge inactivo: bg `#F3F4F6` text `#6B7280`
- Create button: bg `#111827`, text white 13px/600, radius `12px`, shadow `0 1px 2px rgba(0,0,0,.12)`

### 6.5 TaskCommentThread

**Estructura:**
```
┌───────────────────────────────────┐
│ 👤 Juan Pérez    hace 2 min  ✏️🗑 │  ← Avatar + nombre + fecha + acciones (hover)
│ Comentario de texto...            │
│                                   │
│ 👤 María López   hace 1 hora     │
│ Otro comentario...  (editado)     │  ← Indicador "(editado)" si fue modificado
│                                   │
│ ┌─────────────────────────────┐   │
│ │ Escribe un comentario... @  │   │  ← MentionInput
│ │                    📎  ➤    │   │  ← Adjuntar + Enviar
│ └─────────────────────────────┘   │
└───────────────────────────────────┘
```

**Especificaciones:**
- Acciones edit/delete visibles solo en hover y solo propios
- Timestamps: `date-fns` con locale `es` ("hace X minutos")
- Edición: textarea inline con Save/Cancel
- Eliminación: confirmación inline con Sí/No
- Mention: trigger `@`, dropdown máx 5 resultados
- Submit: `Ctrl+Enter`

### 6.6 KPI Card (Agenda Reportes/Portfolio)

**Estructura:**
```
┌───────────────────────────────────┐
│ TOTAL TAREAS           📊 icono  │  ← text-xs uppercase tracking-wider + icono con fondo
│ 1                                │  ← text-2xl/3xl font-bold
│ en tu agenda                     │  ← text-xs text-muted-foreground
└───────────────────────────────────┘
```

**Especificaciones:**
- Icono: `40x40px` rounded-full, bg sutil por tipo:
  - Total: azul/indigo bg + icono BarChart
  - Completadas: verde bg + icono CheckCircle
  - En progreso: naranja bg + icono TrendingUp
  - Vencidas: rojo bg + icono AlertCircle
- Valor: `text-2xl font-bold` o `text-3xl font-bold`
- Sub-texto: `text-xs text-muted-foreground`
- Grid: `grid-cols-2 md:grid-cols-4 gap-4`
- Border: `1px solid border`, rounded card standard

### 6.7 Toolbar (Agenda)

**Estructura Inbox:**
```
┌────────────────────────────────────────────────────────┐
│ [Ordenar por: Recientes ▼] │ [Filtrar por prioridad ▼] │ 🔍 Buscar en inbox...       │
└────────────────────────────────────────────────────────┘
│ [Todas 1] [Pendientes 1] [Completadas]                │  ← Tabs filtro
```

**Estructura Board:**
```
┌────────────────────────────────────────────────────────┐
│ Todas las tareas  │ [☐ Seleccionar] │ [≡ Lista] [|| Cronograma] [⊞ Kanban] │ [⚙] │
└────────────────────────────────────────────────────────┘
```

**Especificaciones:**
- Layout: `flex items-center gap-2`
- View toggles: grupo de botones con border container, activo = `variant="secondary"`
- Search (inbox): input con placeholder, inline en toolbar
- Sort/Filter: botones outline con texto descriptivo
- Tab filters: botones con badge count

### 6.8 Bulk Actions Bar (Agenda Board)

**Estructura:**
```
┌────────────────────────────────────────────────────────┐
│ ☑ 3 seleccionadas  │  [Cambiar estado ▼] [Cambiar prioridad ▼] [🗑 Eliminar]  │
└────────────────────────────────────────────────────────┘
```

**Especificaciones:**
- Aparece cuando `selectionMode = true` en la vista Board
- Background: `bg-muted/50`
- Border: `rounded-lg border`
- Padding: `p-3`
- Acciones alineadas a la derecha con `ml-auto`
- Eliminar: `text-red-600 hover:bg-red-50`
- Modo selección: toggle en toolbar con botón "Seleccionar tareas"

---

## 7. Componentes Mobile

### 7.1 TaskCardMobile

**Estructura:**
```
┌─────────────────────────────────────┐
│ Grupo nombre            ⭕ 67%      │  ← 11px slate + ProgressRing
│ Título de la tarea      ☐           │  ← 14px bold + checkbox
│ 📋 2/5   💬 3                      │  ← 11px slate metadata
└─────────────────────────────────────┘
```

**Especificaciones:**
- Padding: `14px 16px`
- Border radius: `2xl` (Tailwind)
- Shadow: `0 2px 8px rgba(0,0,0,0.06)`
- Group name: 11px `#94a3b8` (slate-400)
- Title: 14px `#0f172a` (slate-900), line-clamp-2

### 7.2 WeekStrip

**Estructura:**
```
┌──────────────────────────────────────┐
│  LUN  MAR  MIE  JUE  VIE  SAB  DOM │
│  24   25   [26]  27   28   29   30  │  ← [26] = seleccionado (fondo oscuro)
└──────────────────────────────────────┘
```

**Especificaciones:**
- Scroll horizontal
- Día labels: 10px uppercase `#94a3b8`
- Día seleccionado: bg `#0f172a`, text white, rounded-full
- Día actual: color `#06b6d4` (cyan)
- Día inactivo: `#64748b` (slate)

### 7.3 ProgressRing

**Especificaciones:**
- SVG circular con `stroke-dasharray`
- Size default: `36px`, strokeWidth: `3px`
- Track: `#E5E7EB`
- Progress: color configurable (default `#06b6d4`)
- Texto centro: porcentaje, bold, size = `ring_size * 0.27`
- Animación: `stroke-dashoffset 0.35s ease`

### 7.4 BottomNav

- 4-5 items con iconos
- Item activo: color primary, dot indicator
- Touch targets: mínimo 44x44px

---

## 8. Animaciones

### 8.1 Keyframes

| Nombre | Duración | Easing | Uso |
|--------|----------|--------|-----|
| `card-cascade-in` | 1300ms | `cubic-bezier(0.22,1,0.36,1)` | Carga inicial de cards |
| `card-new-in` | 420ms | `cubic-bezier(0.22,1,0.36,1)` | Nueva card creada |
| `card-delete-out` | 300ms | `cubic-bezier(0.4,0,1,1)` | Card eliminada (slide right) |
| `checkbox-pop` | 350ms | `cubic-bezier(0.22,1,0.36,1)` | Completar subtarea |
| `subtask-in` | — | ease | Nueva subtarea aparece |

### 8.2 Transiciones

| Duración | Uso |
|----------|-----|
| `120ms ease` | Color changes, hover básico |
| `150ms ease` | Opacity, background |
| `200ms ease` | All (general purpose) |
| `300ms ease` | Expansión, paneles |
| `350ms ease` | Stroke-dashoffset (ProgressRing) |

---

## 9. Layout Patterns

### 9.1 Grids Responsivos (Agenda)

| Contexto | Grid |
|----------|------|
| KPIs (Reportes/Portfolio) | `grid-cols-2 md:grid-cols-4 gap-4` |
| Charts (Reportes) | `grid-cols-1 md:grid-cols-2 gap-4` |
| Board columns | `flex` horizontal, cada columna `min-w-[280px]` |
| Tareas Fijas | `grid-cols-1 md:grid-cols-3 gap-4` (skeleton cards) |
| Portfolio grupos | `grid-cols-1 gap-3` (lista vertical) |

### 9.2 Layout Principal

```
┌─────────────────────────────────────────┐
│              Navbar (top)               │
├──────────┬──────────────────────────────┤
│          │                              │
│ Sidebar  │         Content              │
│  244px   │          flex-1              │
│          │                              │
│          │                              │
├──────────┴──────────────────────────────┤
│          BottomBar (mobile)             │
└─────────────────────────────────────────┘
```

### 9.3 Breakpoints

| Breakpoint | Ancho | Comportamiento |
|-----------|-------|----------------|
| Base | < 768px | Mobile: sidebar oculto, bottom nav visible |
| `md` | 768px | Sidebar visible, layouts expandidos |
| `lg` | 1024px | Paneles side-by-side |
| `xl` | 1280px | Full-width, 4+ columnas |

---

## 10. Iconos (Lucide React)

### 10.1 Iconos por Categoría

**Navegación:** LayoutDashboard, ClipboardList, Inbox, BarChart2, FolderKanban, BookOpen, Target
**Acciones:** Plus, Pencil, Trash2, Copy, ExternalLink, RefreshCw, Send, Download
**Status:** Circle, CircleDot, CheckCircle2, XCircle, Clock, Loader2, AlertCircle
**Contenido:** MessageSquare, Paperclip, FileText, Tag, Star, Sparkles, Calendar
**Usuarios:** User, Users, UserPlus, UserCheck, AtSign

### 10.2 Tamaños Estándar

| Contexto | Tamaño |
|----------|--------|
| Inline con texto | `h-3.5 w-3.5` (14px) |
| Botones small | `h-4 w-4` (16px) |
| Botones default | `h-5 w-5` (20px) |
| KPI iconos (en círculo) | `h-5 w-5` dentro de `h-10 w-10` container |
| Empty states | `h-8 w-8` (32px) |

---

## 11. Feedback Patterns

### 11.1 Toast Notifications (Sonner)

```typescript
toast.loading('Procesando...', { id: 'action' });   // Loading (reemplazable)
toast.success('Operación exitosa', { id: 'action' }); // Éxito (reemplaza loading)
toast.error('Error al procesar', { id: 'action' });   // Error (reemplaza loading)
toast.info('Funcionalidad próximamente');              // Info
```

### 11.2 Confirmaciones Destructivas

Usar `AlertDialog` de shadcn/ui (no `window.confirm()`):
- Título claro de la acción
- Descripción de consecuencias
- Botón cancelar (secondary) + Botón confirmar (destructive)

### 11.3 Loading States

```
┌─────────────────────────┐
│     ╭─────╮             │
│     │ ⟳  │  spinner    │  ← h-12 w-12, border-4, animate-spin
│     ╰─────╯             │
│   Cargando datos...     │  ← text-sm text-muted-foreground
└─────────────────────────┘
```

Altura mínima: `h-64` con `flex items-center justify-center`.

### 11.4 Empty States

```
┌─────────────────────────┐
│      ╭──────╮           │
│      │ 📖  │           │  ← h-16 w-16 bg-muted rounded-full
│      ╰──────╯           │
│  No hay elementos       │  ← text-lg font-medium
│  Crea tu primer...      │  ← text-sm text-muted-foreground
│  [+ Crear elemento]     │  ← Button primario
└─────────────────────────┘
```

---

## 12. Patrones Anti (NO hacer)

1. **NO hacer fetch sin loading state** — siempre mostrar spinner o skeleton
2. **NO eliminar sin confirmación** — siempre usar `AlertDialog`
3. **NO usar `alert()`** — usar `toast` o `AlertDialog`
4. **NO olvidar `stopPropagation`** en elementos clickeables dentro de cards clickeables (ej: menú ⋯ dentro de TaskCard)
5. **NO crear componentes nuevos** si existe uno similar en agendav2/
6. **NO ignorar empty states** — siempre mostrar mensaje + CTA (ver Portfolio vacío como referencia)
7. **NO usar `= []` como default props** — hoistear a constante de módulo
8. **NO importar recharts sin `next/dynamic`** — lazy load siempre
9. **NO hacer queries Prisma secuenciales** cuando son independientes — usar `Promise.all()`
10. **NO anidar `<button>` dentro de `<button>`** — usar `<div role="button">` si necesitás clickeables anidados (bug activo en InboxView)

---

## 13. Vistas Verificadas (Chrome DevTools)

| Vista | Componentes principales | Estado |
|-------|------------------------|--------|
| **Mis Tareas** (Board) | CalendarTimeline + ViewToggle (Lista/Cronograma/Kanban) + BoardColumn[4] + TaskCard | OK |
| **Dashboard** | KPI Cards[4] + ActivityMap (heatmap) + ProjectCards + TeamSection + MilestoneChart + ActivityLog | OK |
| **Bandeja** | InboxView (split: lista izq + detalle der) + InboxItem + TaskDetailPanel | OK — bug: `<button>` nested |
| **Tareas Fijas** | FixedTasksView (grid skeleton cards con frecuencia) | OK |
| **Reportes** | KPI Cards[4] + BarChart (actividad) + HorizontalBars (estado) + PieChart (prioridad) + PersonRanking + CompletionRate | OK |
| **Portfolio** | KPI Cards[4] + ProjectsSection (empty state) + GroupsList (color dot + nombre + progress) | OK |

---

## 14. Árbol de Componentes — Agenda V2

```
AgendaV2Page
├── AgendaV2Sidebar
│   ├── UserProfile (Avatar + name)
│   ├── CreateTaskButton
│   ├── NavItems[]
│   ├── GroupSection (collapsible)
│   │   └── GroupRow[] (color dot + name + count)
│   └── ProjectSection (collapsible)
│       └── ProjectRow[] (icon + name + avatars)
│
├── AgendaV2HeaderContext (header bar)
│
└── ViewSwitch
    ├── BoardView
    │   ├── FilterPanel
    │   ├── BulkActionsBar (when selecting)
    │   └── BoardColumn[] (PENDING, IN_PROGRESS, WAITING, COMPLETED)
    │       └── TaskCard[] (draggable)
    │
    ├── InboxView (sorted task list)
    ├── DashboardView (Gantt + charts)
    ├── FixedTasksView (frequency columns)
    ├── ReportingView
    └── PortfolioView

TaskDetailPanel (Sheet/Drawer)
├── Header (title, status, priority, actions)
├── ContentGrid
│   ├── Left (70%)
│   │   ├── Description
│   │   ├── SubtaskList (drag-sortable)
│   │   ├── FileAttachments
│   │   └── TaskCommentThread
│   │       └── MentionInput
│   └── Right (30%)
│       ├── AssigneePicker
│       ├── DatePicker
│       ├── GroupSelector
│       └── ActivityLog

Mobile
├── AgendaMobileLayout
├── WeekStrip
├── TaskCardMobile[]
│   └── ProgressRing
├── TaskDetailMobile (full-screen)
└── BottomNav
```
