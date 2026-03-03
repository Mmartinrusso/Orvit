# Frontend Design System — Orvit

> **Fuente de verdad del frontend.** Actualizar cada vez que se agreguen tokens, patrones o componentes nuevos.
> Última actualización: 2026-03-01 (v2 — agrega TaskCard, BoardColumn, TaskCalendarStrip)

---

## 1. Tipografía

| Uso | Size | Weight | Color |
|-----|------|--------|-------|
| Título de modal/panel | `18px` | `600` | `#111827` |
| Título de sección | `15–16px` | `600–700` | `#111827` |
| Subtítulo / label de campo | `12–13px` | `500–600` | `#9CA3AF` |
| Cuerpo de texto | `13–15px` | `400–500` | `#374151` |
| Descripción de card | `13px` | `400` | `#6B7280` |
| Metadato / tiempo | `11–12px` | `400–500` | `#9CA3AF` |
| Badge / chip label | `11–12px` | `600` | (según badge) |
| Input text | `14px` | `400` | `#111827` |
| Placeholder | `14px` | `400` | `#9CA3AF` |
| Sección header uppercase | `10px` | `700` | `#9CA3AF`, `letterSpacing: 0.06em` |

**Font family:** `'Inter', system-ui, -apple-system, sans-serif` (globals.css)

---

## 2. Colores principales

### Grises neutros (más usados)
| Token | Hex | Uso típico |
|-------|-----|------------|
| `#111827` | Negro oscuro | Títulos, texto importante, botones primarios |
| `#374151` | Gris oscuro | Cuerpo de texto |
| `#6B7280` | Gris medio | Texto secundario, labels |
| `#9CA3AF` | Gris claro | Metadatos, placeholders, iconos inactivos |
| `#D1D5DB` | Gris borde hover | Borde de card en hover |
| `#E4E4E8` | Borde estándar | Bordes de inputs, separadores |
| `#E5E7EB` | Borde ligero | Bordes de cards y botones |
| `#F0F0F4` | Fondo sutil | Hover de items de lista |
| `#F3F4F6` | Fondo muted | Badges neutros, fondos de sección |
| `#F8F8FA` | Fondo muy sutil | Hover de filas de actividad |
| `#FAFAFA` | Fondo input | Background de inputs en reposo |
| `#FFFFFF` | Blanco | Cards, modales, paneles |

### Acento — Morado (purple)
| Rol | Hex |
|-----|-----|
| Primary purple | `#7C3AED` |
| Purple hover | `#6D28D9` |
| Purple muted bg | `#EDE9FE` |
| Purple muted text | `#7C3AED` |
| Purple deep | `#4C1D95` |

### Status semánticos
| Estado | Bg | Text | Uso |
|--------|-----|------|-----|
| Éxito / Completada | `#ECFDF5` | `#059669` | Check, completado |
| Warning / Alta prioridad | `#FFFBEB` | `#D97706` | Prioridad alta |
| Peligro / Error | `#FEE2E2` | `#DC2626` | Eliminar, Vencida, Inactiva, CANCELLED |
| Info | `#EEF2FF` | `#6366F1` | Status changes |
| Purple activity | `#EDE9FE` | `#7C3AED` | Creación, creador |

---

## 3. Chips y Badges

### Priority chip
```
baja:  bg #F3F4F6 · text #6B7280 · "Baja"
media: bg #EDE9FE · text #7C3AED · "Media"
alta:  bg #FFFBEB · text #D97706 · "Alta"
```
Estilos comunes: `fontSize 11–12px`, `fontWeight 600`, `padding 2–3px 8–10px`, `borderRadius 999px`

### Status chip (tareas regulares)
```
PENDING:    bg #F3F4F6 · text #6B7280
IN_PROGRESS: bg #EEF2FF · text #6366F1
COMPLETED:  bg #ECFDF5 · text #059669
CANCELLED:  bg #FEE2E2 · text #DC2626
```

### Frecuencia (FixedTasks) — FREQ_COLUMNS tokens
```
diaria:     pillBg #EDF4F0 · pillBorder #C2D4C8 · label #305848 · icon/dot #508070
semanal:    pillBg #EEF3F8 · pillBorder #CCDAE8 · label #3A5878 · icon/dot #5880A8
quincenal:  pillBg #F5F2EA · pillBorder #DED5B0 · label #685C30 · icon/dot #8A7840
mensual:    pillBg #F3EFF8 · pillBorder #D8CBE8 · label #584878 · icon/dot #806898
trimestral: pillBg #FAF0EB · pillBorder #E8D0C0 · label #784838 · icon/dot #A86848
semestral:  pillBg #EBF4F4 · pillBorder #B8D8D8 · label #305858 · icon/dot #508080
anual:      pillBg #F0EEF8 · pillBorder #C8C4D8 · label #484858 · icon/dot #686878
```

---

## 4. Borders y Shadows

| Elemento | Border | Border-radius | Shadow |
|----------|--------|---------------|--------|
| Card principal | `1px solid #E5E7EB` | `8–10px` | `0 1px 3px rgba(0,0,0,.05)` |
| Card hover | `1px solid #D1D5DB` | — | `0 2px 8px rgba(0,0,0,.06)` |
| Modal / Panel | `1.5px solid #D8D8DE` | `8px` | `0 4px 32px rgba(0,0,0,.12)` |
| Input reposo | `1px solid #E5E7EB` | `8–9px` | — |
| Input focus | `1.5px solid #7C3AED` | — | — |
| Input focus (sutil) | `1px solid #9CA3AF` | — | — |
| Button outline | `1px solid #E5E7EB` | `8–9px` | — |
| Droppable DnD | `2px dashed #7C3AED` | `12px` | — |
| KPI card | `1px solid #EBEBEB` | `12px` | `0 1px 4px rgba(0,0,0,.04)` |
| Subtask row | `1px solid #E4E4E8` | `8px` | — |

---

## 5. Botones

### Primario negro (CTA principal)
```css
background: #111827;  color: #FFF;  borderRadius: 10px;
padding: 8px 18px;    fontSize: 13–14px;  fontWeight: 600;
hover → background: #1a1a1a
```

### Primario purple (FixedTasks CTA)
```css
background: #7C3AED;  color: #FFF;  borderRadius: 9px;  height: 38px;
hover → background: #6D28D9
```

### Outline neutro
```css
border: 1px solid #E5E7EB;  background: #FFF;  color: #374151;
borderRadius: 9px;  height: 38px;
hover → background: #F4F4F6
```

### Danger (eliminar)
```css
Hover state: background #FEE2E2;  color #DC2626
```

### Icon action (22×22px)
```css
height/width: 22px;  borderRadius: 6px;  border: none;
Ejecutar:  bg #EDE9FE · color #7C3AED · hover → bg #7C3AED · color #FFF
Editar:    bg #F0F0F0 · color #9CA3AF · hover → bg #E0E0E0 · color #6B7280
Eliminar:  bg #F0F0F0 · color #9CA3AF · hover → bg #FEE2E2 · color #DC2626
```

---

## 6. Inputs y Formularios

```css
/* Input base */
height: 38–40px;
border: 1.5px solid #E4E4E8;
borderRadius: 9px;
background: #FAFAFA;
fontSize: 14px;  color: #111827;
padding: 0 12px;

/* Focus */
border-color: #7C3AED;  background: #FFFFFF;

/* Textarea */
border: 1.5px solid #E4E4E8;
borderRadius: 9px;  background: #FAFAFA;
padding: 10px 12px;  fontSize: 14px;  resize: vertical;
```

### Sección con header en formularios
```css
/* Section header */
fontSize: 10px;  fontWeight: 700;  color: #9CA3AF;
textTransform: uppercase;  letterSpacing: 0.06em;
marginBottom: 10px;
```

---

## 7. Tabs (TaskDetailPanel / InboxView)

```css
/* Tab bar wrapper */
display: flex;  gap: 4px;  marginBottom: 14px;
background: #F4F4F6;  borderRadius: 8px;  padding: 3px;

/* Tab button */
flex: 1;  padding: 6px 12px;  border: none;  cursor: pointer;
borderRadius: 6px;  fontSize: 12px;  fontWeight: 600;
letterSpacing: -0.01em;  transition: 150ms;

/* Active tab */
background: #FFF;  color: #111827;
boxShadow: 0 1px 3px rgba(0,0,0,.08);

/* Inactive tab */
background: transparent;  color: #9CA3AF;

/* Tab content animation */
@keyframes tab-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
animation: tab-fade-in 200ms cubic-bezier(0.22,1,0.36,1) both;
```

---

## 8. Activities Timeline

```css
/* Contenedor de cada item */
display: flex;  gap: 10px;

/* Columna izquierda (32px) */
width: 32px;  display: flex;  flexDirection: column;  alignItems: center;

/* Dot */
width: 10px;  height: 10px;  borderRadius: 50%;
background: #111827;  border: 2px solid #FFF;
boxShadow: 0 0 0 1.5px #D8D8DE;  flexShrink: 0;

/* Línea vertical */
width: 1.5px;  flex: 1;  background: #E4E4E8;  minHeight: 12px;

/* Activity icon box */
width: 26px;  height: 26px;  borderRadius: 8px;
display: flex;  alignItems: center;  justifyContent: center;

/* Row hover */
padding: 6px 8px;  borderRadius: 8px;
hover → background: #F8F8FA;  border: 1px solid #E4E4E8;

/* Text sizes */
Activity text: 13px · regular
User: fontWeight 600
Time: 12px · color #9CA3AF · flexShrink 0 · whiteSpace nowrap
Date label: 12px · fontWeight 700 · color #111827
```

### ACTIVITY_CFG colors
```
create:   bg #EDE9FE · icon #7C3AED
status:   bg #EEF2FF · icon #6366F1
assign:   bg #ECFDF5 · icon #059669
comment:  bg #FFFBEB · icon #D97706
priority: bg #FFF1F2 · icon #DC2626
attach:   bg #F0F9FF · icon #0EA5E9
```

---

## 9. Comments (bubble design)

```css
/* Avatar */
width/height: 32px;  borderRadius: 50%;  background: #EDE9FE;  color: #7C3AED;

/* Author name */
fontSize: 13px;  fontWeight: 700;  color: #111827;

/* Timestamp */
fontSize: 11px;  color: #9CA3AF;

/* Bubble */
background: #F7F8FA;  border: 1px solid #E4E4E8;
borderRadius: 2px 12px 12px 12px;
padding: 8px 12px;  fontSize: 13px;  color: #374151;  lineHeight: 1.6;

/* Comment input */
border: 1.5px solid #E4E4E8;  → focus: border #7C3AED;
background: #FAFAFA;  borderRadius: 10px;

/* Toolbar (below textarea) */
background: #F4F4F6;  borderTop: 1px solid #E8E8EC;
padding: 6px 10px;  display: flex;  gap: 6px;
```

---

## 10. Sheet (panel lateral derecho — Synchro style)

```css
/* Overlay */
position: fixed;  inset: 0;  background: rgba(0,0,0,0.45);  zIndex: 200;

/* Panel */
position: absolute;  top: 0;  right: 0;  bottom: 0;
width: 500–580px;  background: #FFF;
boxShadow: -8px 0 40px rgba(0,0,0,0.12);
display: flex;  flexDirection: column;  overflow: hidden;

/* Animation slide-in */
@keyframes sheet-slide-in {
  from { opacity: 0; transform: translateX(40px); }
  to   { opacity: 1; transform: translateX(0); }
}
animation: 280ms cubic-bezier(0.22,1,0.36,1)

/* Header */
padding: 20px 24px 16px;
borderBottom: 1px solid #F0F0F4;
display: flex;  alignItems: flex-start;  gap: 12px;

/* Footer sticky */
padding: 16px 24px;  borderTop: 1px solid #F0F0F4;
display: flex;  gap: 10px;  justifyContent: flex-end;
```

---

## 11. KPI Cards

```css
/* Wrapper */
flex: 1 1 160px;  background: #FFFFFF;
border: 1px solid #EBEBEB;  borderRadius: 12px;
padding: 16px 20px;
boxShadow: 0 1px 4px rgba(0,0,0,.04);

/* Label */
fontSize: 12px;  fontWeight: 500;  color: #9CA3AF;
letterSpacing: 0.01em;  marginBottom: 6px;

/* Value */
fontSize: 28px;  fontWeight: 700;  color: #111827;  lineHeight: 1;

/* Icon box */
height: 40px;  width: 40px;  borderRadius: 10px;
background: {accent}18 or #F3F4F6;

/* Animation */
@keyframes kpi-in {
  from { opacity: 0; transform: translateY(10px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
animationDelay: index * 65ms;
```

---

## 12. Animaciones usadas

| Nombre | Keyframe | Timing | Uso |
|--------|----------|--------|-----|
| `kpi-in` | `opacity 0→1, translateY 10→0, scale 0.97→1` | `300ms ease(0.22,1,0.36,1)` | KPI cards |
| `col-in` | `opacity 0→1, translateY 16→0` | `340ms ease(0.22,1,0.36,1)` | Columnas kanban |
| `ftcard-in` | `opacity 0→1, translateY -8→0, scale 0.98→1` | `300ms ease(0.22,1,0.36,1)` | Cards de fixed tasks |
| `filter-row-in` | `opacity 0→1, translateY -6→0` | `280ms delay 180ms` | Barra de filtros |
| `filter-popup-in` | `opacity 0→1, translateY -6→0, scale 0.98→1` | `180ms` | Popover filtros |
| `sheet-slide-in` | `opacity 0→1, translateX 40→0` | `280ms ease(0.22,1,0.36,1)` | Sheets laterales |
| `tab-fade` | `opacity 0→1, translateY 4→0` | `200ms ease(0.22,1,0.36,1)` | Cambio de tabs |
| `inbox-panel-in` | `opacity 0→1, translateX 12→0` | `220ms ease(0.22,1,0.36,1)` | InboxView panel change |
| `subtask-in` | `opacity 0→1, translateY -6→0` | `200ms` | Nueva subtarea |
| `checkbox-pop` | `scale 1→1.5→0.85→1` | `200ms` | Check de subtarea |

---

## 13. Assignee box (patrón recurrente)

```css
/* Caja de responsable en cards */
display: flex;  alignItems: center;  gap: 8px;
padding: 8px 10px;  background: #F9FAFB;
borderRadius: 8px;  border: 1px solid #F3F4F6;

/* Avatar */
height: 26px;  width: 26px;
background: #EDE9FE;  color: #7C3AED;
fontSize: 10px;  fontWeight: 700;

/* Name */
fontSize: 13px;  fontWeight: 500;  color: #111827;
overflow: hidden;  textOverflow: ellipsis;  whiteSpace: nowrap;

/* Department / role */
fontSize: 11px;  color: #9CA3AF;
```

---

## 14. Popover de Filtros (patrón)

```css
position: absolute;  top: calc(100% + 6px);  left: 0;
width: 280px;  background: #FFFFFF;
border: 1px solid #E8E8E8;  borderRadius: 14px;
boxShadow: 0 8px 24px rgba(0,0,0,.10);
zIndex: 50;  padding: 14px;

/* Separador entre secciones */
height: 1px;  background: #F0F0F0;  marginBottom: 14px;

/* Filter button activo */
border: 1px solid #7C3AED;  background: #7C3AED;  color: #FFF;

/* Filter button inactivo */
border: 1px solid #E5E7EB;  background: #FFF;  color: #6B7280;
```

---

## 15. Empty States

```css
display: flex;  flexDirection: column;  alignItems: center;
justifyContent: center;  padding: 80px 20px;  gap: 16px;

/* Icon container */
width: 64px;  height: 64px;  borderRadius: 20px;
background: #F0F0F0;

/* Icon */
color: #C0C0C8;  h-7 w-7;

/* Title */
fontSize: 16px;  fontWeight: 700;  color: #111827;

/* Subtitle */
fontSize: 13px;  color: #9CA3AF;  marginTop: 4px;
```

---

## 16. Skeleton / Loading

```css
/* Skeleton base */
className="animate-pulse"
background: #E8E8E8;
borderRadius: same as real element;
```

---

## 17. Archivos clave

| Componente | Ruta |
|------------|------|
| Design tokens / CSS vars | `app/globals.css` |
| TaskDetailPanel (referencia máxima) | `components/agendav2/TaskDetailPanel.tsx` |
| InboxView | `components/agendav2/InboxView.tsx` |
| FixedTasksView (kanban, DnD, filtros) | `components/agendav2/FixedTasksView.tsx` |
| FixedTaskFormSheet (sheet crear/editar) | `components/agendav2/FixedTaskFormSheet.tsx` |
| FixedTaskDetailSheet (sheet detalle) | `components/agendav2/FixedTaskDetailSheet.tsx` |
| SubtaskList | `components/agendav2/SubtaskList.tsx` |
| BoardView (Kanban regular) | `components/agendav2/BoardView.tsx` |
| BoardColumn | `components/agendav2/BoardColumn.tsx` |
| TaskCard | `components/agendav2/TaskCard.tsx` |
| create-fixed-task-modal (agendav1) | `components/tasks/create-fixed-task-modal.tsx` |
| globals.css | `app/globals.css` |

---

## 18. Hooks de datos principales

| Hook | Qué devuelve |
|------|-------------|
| `useFixedTasks()` | `{ tasks, loading, createTask, updateTask, deleteTask, refetch }` |
| `useUsers()` | `{ users, loading, error }` — lista de usuarios con `type` + `id` |
| `useAuth()` | `{ user }` — usuario logueado con `id`, `name`, `role` |
| `useCompany()` | `{ currentCompany }` — empresa activa |
| `useAgendaTasks()` | tareas regulares de la agenda |

---

## 20. TaskCard — Kanban card (tareas regulares)

```css
/* Wrapper */
background: #FFFFFF;  (selected: #F5F3FF)
border: 1.5px solid #D8D8DE;  (selected: #7C3AED)
borderRadius: 8px;
padding: 16px 18px;
boxShadow: 0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.07);

/* Hover */
boxShadow: 0 2px 8px rgba(0,0,0,.08), 0 8px 28px rgba(0,0,0,.10);
borderColor: #D8D8E0;

/* Animation */
@keyframes card-cascade-in {
  from { transform: translate(-10px,-10px); opacity: 0; }
  to   { transform: translate(0,0);         opacity: 1; }
}
duration: 1300ms cubic-bezier(0.22,1,0.36,1)
delay: (colIndex + cardIndex) * 110ms

/* Row 1 — status dot + date */
Status dot: width/height 7px, borderRadius 50%
Date: fontSize 13px · color #6B7280 (overdue → #DC2626)
Divider: border-top 1px solid #E4E4E8, marginBottom 12px

/* Row 2 — Title */
fontSize: 18px;  fontWeight: 600;  color: #111827;
letterSpacing: -0.02em;  lineHeight: 1.3;

/* Row 3 — Description */
fontSize: 13px;  color: #6B7280;  lineHeight: 1.55;

/* Row 4 — Subtask progress box */
border: 1px solid #D8D8DE;  borderRadius: 8px;
padding: 10px 12px;

/* Segmented bar */
height: 5px;  borderRadius: 999px;
done → #111827;  pending → #E4E4E8;
gap: 3px between segments;

/* Row 5 — Footer */
borderTop: 1px solid #E4E4E8;  paddingTop: 12px;
Comments/Links: fontSize 13px · color #6B7280 · gap 14px between

/* Avatars */
height/width: 26px;  border: 2px solid #FFFFFF;
boxShadow: 0 1px 3px rgba(0,0,0,.10);
overlap: marginLeft -7px (stacked)

/* Select checkbox */
width/height: 18px;  borderRadius: 5px;
inactive: border 2px solid #D1D5DB · bg #FFFFFF
active:   border + bg #7C3AED · check icon white
```

### STATUS_DOT colors (top row del TaskCard)
```
PENDING:     #9CA3AF
IN_PROGRESS: #7C3AED
WAITING:     #D97706
COMPLETED:   #059669
CANCELLED:   #E5E7EB
```

### PRIORITY_COLOR (para calendar pills — valores string uppercase)
```
LOW:    #9CA3AF
MEDIUM: #7C3AED
HIGH:   #D97706
URGENT: #DC2626
```

---

## 21. BoardColumn — columnas del Kanban

```css
/* Column header — outer container */
background: #F3F4F6;  borderRadius: 10px;  marginBottom: 12px;
padding: 5px 6px 5px 8px;
display: flex;  alignItems: center;  gap: 6px;

/* Inner colored pill (icon + label) */
padding: 3px 9px;  borderRadius: 7px;
border: 1px solid {pillBorder};  background: {pillBg};
fontSize: 13px;  fontWeight: 600;  color: {labelColor};

/* Cards drop area */
borderRadius: 12px;  padding: 6px 4px;  minHeight: 160px;
isOver → background rgba(124,58,237,0.04) · border 2px dashed #7C3AED
gap: 10px entre cards;

/* Empty state */
border: 1.5px dashed #E5E7EB;  borderRadius: 12px;
hover → background #F9FAFB;
texto → fontSize 11px · color #9C9CAA
```

### COLUMN_CONFIG tokens (tareas regulares)
```
PENDING:     label "Por hacer"   · icon CircleDot    · iconColor #9CA3AF · pillBg #F3F4F6  · pillBorder #E5E7EB · labelColor #6B7280  · dot #9CA3AF
IN_PROGRESS: label "En progreso" · icon Loader2      · iconColor #7C3AED · pillBg #F5F3FF  · pillBorder #DDD6FE · labelColor #5B21B6  · dot #7C3AED
WAITING:     label "En revisión" · icon Asterisk     · iconColor #D97706 · pillBg #FFFBEB  · pillBorder #FDE68A · labelColor #92400E  · dot #D97706
COMPLETED:   label "Completado"  · icon ClipboardCheck · iconColor #059669 · pillBg #ECFDF5 · pillBorder #A7F3D0 · labelColor #065F46 · dot #059669
CANCELLED:   label "Cancelado"   · icon Circle       · iconColor #9CA3AF · pillBg #F3F4F6  · pillBorder #E5E7EB · labelColor #6B7280  · dot #9CA3AF
```

---

## 22. TaskCalendarStrip

```css
/* Outer container */
background: #FFFFFF;
border: 1.5px solid #D8D8DE;
borderRadius: 8px;
boxShadow: 0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.07);

/* Header */
padding: 14px 20px;  fontSize: 14px;  fontWeight: 600;  color: #111827;

/* Grid — 8 columns */
gridTemplateColumns: repeat(8, 1fr);
borderLeft (between cols): 1px solid #E4E4E8;
minHeight: 190px per column;

/* Date header in each column */
padding: 10px 6px 8px;  textAlign: center;  borderBottom: 1px solid #E4E4E8;
fontSize: 12px;
active/today: fontWeight 700 · color #111827
inactive:     fontWeight 500 · color #9CA3AF

/* Active column vertical line */
width: 2px;  background: #111827;
animation: scaleY transition 600ms (transformOrigin bottom)

/* Active column dot (top) */
width: 8px;  height: 8px;  borderRadius: 50%;  background: #111827;

/* Weekend hatching */
opacity: 0.06;
backgroundImage: repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 1px, transparent 8px);

/* Dimmed columns (when one column active) */
opacity: 0.3;  transition: opacity 300ms ease;

/* Task pills */
padding: 5px 8px;  borderRadius: 8px;
fontSize: 11px;  fontWeight: 500;
borderLeft: 3px solid {PRIORITY_COLOR}
active (today) → bg #111827 · color #FFF · boxShadow 0 2px 8px rgba(0,0,0,.18)
inactive       → bg #FFFFFF · color #374151 · border 1px solid #EDEDED · opacity 0.75

/* "+N más" label */
fontSize: 9px;  color: #9CA3AF;

/* NavBtn */
height/width: 28px;  borderRadius: 8px;  color: #9CA3AF;
hover → background #F4F4F6 · color #6B7280
```

### Stagger offsets por columna (COL_STAGGER)
```
[35, 8, 25, 0, 40, 0, 6, 28]  — paddingTop extra para scatter visual
Pill animation delay: bottom pill first → up: pillDelay = 250 + (pillCount-1-pillIdx) * 140ms
```

---

## 23. Subvistas del Board (BoardView)

| Subvista | Key | Descripción |
|----------|-----|-------------|
| Kanban | `'kanban'` | Columnas por estado con DnD |
| Cronograma | `'timeline'` | TaskCalendarStrip expandido |
| Spreadsheet | `'spreadsheet'` | Lista tabular (no implementado visualmente aún) |

**Selector de subvista:**
```css
display: flex;  background: #F4F4F6;  borderRadius: 8px;  padding: 3px;  gap: 4px;
Active tab: bg #FFF · boxShadow 0 1px 3px rgba(0,0,0,.08) · color #111827
Inactive tab: bg transparent · color #9CA3AF
```

---

## 24. Select Mode (bulk actions)

```css
/* Checkbox en card */
width: 18px;  height: 18px;  borderRadius: 5px;
unchecked: border 2px solid #D1D5DB · bg #FFFFFF
checked:   border + bg #7C3AED · Check icon white

/* Bulk action bar (aparece cuando hay selección) */
background: #111827;  color: #FFFFFF;
borderRadius: 12px;  padding: 10px 16px;
Mostrar: número de items · botón Eliminar (FEE2E2/DC2626) · botón Cancelar (outline)
```

---

## 25. DropdownMenu en TaskCard / BoardColumn

```
Usa shadcn/ui DropdownMenu — className="w-44" para width 176px
Items: text-xs (12px)
Danger item: className="text-destructive focus:text-destructive"
```

---

## 26. CreateTaskModal — Modal creación/edición de tarea regular

Usa `shadcn Dialog` — mismo estilo document que `FixedTaskFormSheet` (título expandible + property rows).

### STATUS_OPTIONS (tareas regulares — CreateTaskModal)
```
PENDING:     label "Pendiente"   · icon Circle       · color #64748B · bg #F1F5F9 · animate pulse
IN_PROGRESS: label "En Progreso" · icon Loader2      · color #6366F1 · bg #EEF2FF · animate spin
WAITING:     label "En Revisión" · icon Clock        · color #D97706 · bg #FFFBEB
COMPLETED:   label "Completada"  · icon CheckCircle2 · color #16A34A · bg #F0FDF4
CANCELLED:   label "Cancelada"   · icon XCircle      · color #DC2626 · bg #FFF1F2
```

### PRIORITY_OPTIONS (tareas regulares — con URGENT)
```
LOW:    label "Baja"    · color #6B7280 · bgColor #F3F4F6
MEDIUM: label "Media"   · color #7C3AED · bgColor #EDE9FE
HIGH:   label "Alta"    · color #D97706 · bgColor #FFFBEB
URGENT: label "Urgente" · color #DC2626 · bgColor #FEF2F2
```
> **Diferencia clave**: las tareas fijas usan `baja/media/alta` (minúsculas). Las tareas regulares usan `LOW/MEDIUM/HIGH/URGENT` (mayúsculas).

### ASSIGNEE_CHIP_COLORS (pool rotatorio por índice)
```js
[
  { bg: '#D1FAE5', color: '#059669' },  // verde
  { bg: '#FEF3C7', color: '#D97706' },  // amarillo
  { bg: '#EDE9FE', color: '#7C3AED' },  // purple
  { bg: '#F9E4E2', color: '#C05060' },  // rosa
  { bg: '#EDE9FE', color: '#7C3AED' },  // purple (repeat)
]
```

### FILE_EXT_COLORS (adjuntos)
```js
pdf → #E24335 · fig/figma → #A259FF · doc/docx → #2D5AFF
xls/xlsx → #21A366 · png/jpg/jpeg/gif/webp → #FF9500
ppt/pptx → #FF6B35 · zip/rar → #8E8E93 · mp4/mov → #FF3B30
default  → #9CA3AF
```

### DEFAULT_TAGS
```
'Desarrollo', 'Marketing', 'Operaciones', 'Administración',
'Soporte', 'Finanzas', 'RRHH', 'Infraestructura', 'Ventas', 'Legal'
```

---

## 27. AgendaV2Sidebar

```css
/* Wrapper */
width: fija (definida por layout padre);
background: var(--sidebar-background);

/* Nav item activo */
background: var(--sidebar-primary);  color: var(--sidebar-primary-foreground);
borderRadius: 8px;

/* Nav item hover */
background: var(--sidebar-accent);

/* Nav item disabled */
opacity: 0.4;  cursor: not-allowed;

/* Group row */
display: flex;  alignItems: center;  gap: 8px;
padding: 5px 8px;  borderRadius: 8px;

/* Group color dot */
width: 8px;  height: 8px;  borderRadius: 50%;

/* Group selected → highlight pill */
background: {group.color}1A (15% opacity del color del grupo);

/* "+" button en sección */
opacity: 0 → 1 on hover de la sección;
```

### Vistas del sidebar (NAV_ITEMS)
```
dashboard   → "Dashboard"  · icon LayoutDashboard
board       → "My Task"    · icon ClipboardList
inbox       → "Inbox"      · icon Inbox
reporting   → "Reporting"  · icon BarChart2
portfolio   → "Portfolio"  · icon Briefcase
(null)      → "Accounts"   · icon BookOpen   · disabled
(null)      → "Goals"      · icon Target     · disabled
```

### ViewMode types
```ts
type ViewMode = 'board' | 'inbox' | 'dashboard' | 'reporting' | 'portfolio' | 'fixed-tasks'
```

---

## 28. FixedTaskDetailSheet — tabs Detalles/Instructivos/Historial

```
Tabs: ['Detalles', 'Instructivos', 'Historial']
Slide-in: mismo sheet-slide-in 280ms (mismo que FixedTaskFormSheet)

/* Detalles tab */
PropRow: icon (14px #9CA3AF) + label (13px #9CA3AF 148px width) + control
Frecuencia: pill con FREQ_CONF tokens (mismos que FixedTaskFormSheet)
Prioridad: chip con PRIORITY_CONF tokens (ver sección 3)
Assignee box: Avatar 30px + name 14px #111827 + department 12px #9CA3AF

/* Instructivos tab */
Lista con índice numerado (18×18px #E4E4EC/#9CA3AF box)
Título: 13px fontWeight 600 #111827
Content: 12px #6B7280 lineHeight 1.6
Attachments: link externo con ExternalLink icon

/* Historial tab */
Timeline de ejecuciones previas
executedBy: avatar + nombre
completedAt: fecha formato "d MMM yyyy · HH:mm"
actualTime: badge pill estilo muted
notes: texto 13px #6B7280 itálica
Empty: "Sin ejecuciones registradas" — mismo empty state pattern (sección 15)

/* Footer — acciones */
Ejecutar:  bg #EDE9FE · color #7C3AED  → hover bg #7C3AED · color #FFF
Editar:    outline neutro
Eliminar:  hover → bg #FEE2E2 · color #DC2626
```

---

## 29. DashboardView — layout y tokens

### Quick Actions
```css
display: flex;  gap: 10px;  wrap: wrap;
/* Cada card */
padding: 14px 16px;  borderRadius: 12px;  background: {bg};  color: {color};
icon: 18×18px;  label: 13px fontWeight 600;
hover → opacity 0.85;  cursor: pointer;
```
Quick action paletas:
```
"Enviar factura"     → bg #F2F2F4 · color #6B6B78
"Borrador propuesta" → bg #EEF2F8 · color #5880A8
"Crear contrato"     → bg #F5F3EB · color #8A7840
"Agregar formulario" → bg #EDF4F0 · color #508070
```

### KPI Cards (DashboardView)
```
Proyectos:    value · iconBg #EEF2FF · iconColor #4F46E5 · icon FolderKanban
Total Tareas: value · iconBg #F0FDF4 · iconColor #16A34A · icon ListTodo
En progreso:  value · iconBg #FFF7ED · iconColor #EA580C · icon Loader2
Completadas:  value · iconBg #ECFDF5 · iconColor #059669 · icon CheckCircle2
```

### Gantt/Timeline (Activity Map)
```css
/* Left label column */
width: 110px;  fontSize: 11px;  fontWeight: 600;
Project: color #6B7280
TaskName: color #111827

/* Bar */
borderRadius: 6px;  height: 36px;
Paletas de barras:
  green:  barBg #E6F5E0 · barText #2E7D32
  orange: barBg #FFF0E8 · barText #A0522D
  purple: barBg #EDE8FF · barText #5B4BD6

/* Progress fill */
background: barText (semitransparent);  height: 3px;

/* Today marker */
width: 2px;  background: #DC2626;  zIndex: 10;
top label: fontSize 9px · bg #DC2626 · color #FFF · borderRadius 4px;

/* Grid lines */
width: 1px;  background: #E4E4E8;  dashed;
active label: fontWeight 700 · color #111827
inactive:     color #9CA3AF
```

### Gantt scales
```
daily   → 8 horas (09:00–04:00 PM) — 7 intervals
weekly  → 7 días (Lun–Dom)
monthly → 4 semanas (Sem 1–4)
```

---

## 31. Convenciones de código

- **Inline styles > Tailwind** para componentes custom Synchro (más legible y preciso)
- **`line-clamp-N`** class para truncar texto en cards
- **`animate-pulse`** class de Tailwind para skeletons
- **Hover handlers inline** (`onMouseEnter/Leave`) en vez de `:hover` CSS cuando no hay acceso a stylesheet
- **`useSortable`** de `@dnd-kit/sortable` para cards draggables
- **`useDroppable`** de `@dnd-kit/core` para columnas drop targets
- **`CSS.Transform.toString(transform)`** para transformaciones DnD
- **Toasts** via `sonner` — `toast.success()`, `toast.error()`
- **`format(date, 'd MMM', { locale: es })`** para fechas cortas
