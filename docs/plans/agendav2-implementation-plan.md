# AgendaV2 — Plan de Implementación

> **Estado**: Implementado (ver daily-logs para detalle de cada sesión)

**Goal:** Módulo completo de gestión de tareas para ORVIT — reemplaza la agenda anterior con un sistema moderno tipo Asana/Linear con vistas kanban, tareas fijas, comentarios con @menciones, subtareas y actividad.

**Architecture:** Panel de detalle deslizable (sheet) sobre vista kanban/lista. Sidebar contextual que se transforma cuando el usuario entra al módulo de Agenda. API REST en `/api/agenda/` con TanStack Query en el frontend.

**Tech Stack:** Next.js 13 App Router, React 18, TanStack Query v5, Prisma, shadcn/ui, Tailwind CSS, date-fns

---

## Módulos Implementados

### 1. Vistas principales (`AgendaV2Page.tsx`)

| Vista | Componente | Estado |
|-------|-----------|--------|
| Dashboard | `DashboardView.tsx` | ✅ |
| Bandeja (Inbox) | `InboxView.tsx` | ✅ |
| Kanban (Board) | `BoardView.tsx` | ✅ |
| Portfolio | `PortfolioView.tsx` | ✅ |
| Reportes | `ReportingView.tsx` | ✅ |
| Tareas Fijas | `FixedTasksView.tsx` | ✅ |

### 2. Panel de Detalle de Tarea (`TaskDetailPanel.tsx`)

**Tabs:**
- **Subtareas**: Lista editable inline con `SubtaskList.tsx`
- **Comentarios**: Thread con edición/borrado + `MentionInput` para @menciones
- **Actividades**: Timeline de cambios (placeholder — sin datos reales aún)

**Funcionalidades:**
- Header con título editable, prioridad, estado, asignado, fecha
- Adjuntos con preview por tipo de archivo (`FileTypeIcon`)
- Animación de apertura (`modal-unfold`)
- Expandible a ancho completo
- Duplicar tarea desde el dropdown del header
- Favorito (estrella)

### 3. Sistema de Comentarios

| Componente | Archivo | Función |
|-----------|---------|---------|
| Thread | `TaskCommentThread.tsx` | Render de comentarios con edición/borrado inline |
| Input | `MentionInput.tsx` | Textarea con @menciones, dropdown de usuarios, Cmd+Enter |

**API:**
- `GET /api/agenda/tasks/[id]/comments` — lista comentarios
- `POST /api/agenda/tasks/[id]/comments` — crear comentario (con `mentionedUserIds`)
- `PUT /api/agenda/tasks/[id]/comments/[commentId]` — editar
- `DELETE /api/agenda/tasks/[id]/comments/[commentId]` — borrar

### 4. Subtareas

**API:**
- `GET /api/agenda/tasks/[id]/subtasks`
- `POST /api/agenda/tasks/[id]/subtasks`
- `PATCH /api/agenda/tasks/[id]/subtasks/[subtaskId]`
- `DELETE /api/agenda/tasks/[id]/subtasks/[subtaskId]`

### 5. Tareas Fijas (`FixedTask`)

| Componente | Función |
|-----------|---------|
| `FixedTasksView.tsx` | Vista principal con cards de tareas fijas |
| `FixedTaskDetailSheet.tsx` | Panel de detalle (frecuencia, prioridad, historial) |
| `FixedTaskFormSheet.tsx` | Crear/editar tarea fija |

**Task execution modal** (`task-execution-modal.tsx`): Rediseñado para coincidir con el estilo de FixedTaskDetailSheet. Controles +/− de tiempo, botón completar con fondo `#111827`.

### 6. Features de Board (Kanban)

- **Duplicar tarea**: Desde menú de card o TaskDetailPanel. Crea copia con "(copia)" en el nombre, estado PENDING.
- **Bulk status change**: Barra flotante con dropdown de cambio de estado masivo.
- **Counter de filtros**: Badge negro en header cuando hay filtros activos.

### 7. Actividad de Tareas (`ActivityLogger`)

**Archivo:** `lib/agenda/activity-logger.ts`

**API:** `GET /api/agenda/tasks/[id]/activity`

Registra eventos: `create`, `status`, `assign`, `comment`, `priority`, `attach`.

---

## Estructura de Archivos

```
components/agendav2/
├── AgendaV2Page.tsx          # Controlador principal — routing de vistas
├── AgendaV2Sidebar.tsx       # Sidebar contextual (transforma al entrar a Agenda)
├── BoardView.tsx             # Vista kanban con drag-and-drop, filtros, bulk actions
├── BoardColumn.tsx           # Columna individual del kanban
├── TaskCard.tsx              # Card de tarea en kanban
├── TaskDetailPanel.tsx       # Panel de detalle deslizable (sheet)
├── TaskCommentThread.tsx     # Thread de comentarios con edit/delete inline
├── MentionInput.tsx          # Input de comentario con @menciones
├── SubtaskList.tsx           # Lista de subtareas editable inline
├── CreateTaskModal.tsx       # Modal creación de tarea
├── CreateGroupModal.tsx      # Modal creación de grupo/proyecto
├── DashboardView.tsx         # Vista dashboard con KPIs
├── InboxView.tsx             # Vista bandeja de entrada
├── PortfolioView.tsx         # Vista portfolio
├── ReportingView.tsx         # Vista reportes
├── FixedTasksView.tsx        # Vista tareas fijas
├── FixedTaskDetailSheet.tsx  # Panel detalle tarea fija
├── FixedTaskFormSheet.tsx    # Formulario crear/editar tarea fija
├── TaskCalendarStrip.tsx     # Strip de calendario para filtro por fecha
└── index.ts                  # Re-exports

app/api/agenda/
├── tasks/
│   ├── route.ts              # GET (list) + POST (create)
│   ├── [id]/
│   │   ├── route.ts          # GET + PATCH + DELETE
│   │   ├── comments/
│   │   │   ├── route.ts      # GET + POST
│   │   │   └── [commentId]/route.ts  # PUT + DELETE
│   │   ├── subtasks/route.ts # GET + POST + PATCH + DELETE
│   │   ├── activity/route.ts # GET activities
│   │   └── duplicate/route.ts # POST duplicate
│   └── bulk/route.ts         # PATCH bulk status change
└── reminders/route.ts        # Reminders cron

lib/agenda/
├── types.ts                  # AgendaTask, AgendaTaskStatus, Priority, helpers
├── api.ts                    # Funciones de API client (fetch wrappers)
└── activity-logger.ts        # Logger de actividad de tareas
```

---

## Modelos Prisma Relacionados

```
Task               — Tarea principal
TaskGroup          — Grupo/proyecto de tareas
TaskSubtask        — Subtarea de una tarea
TaskComment        — Comentario en una tarea
TaskActivity       — Entrada de actividad/historial
FixedTask          — Tarea recurrente
FixedTaskExecution — Ejecución de tarea fija
```

---

## Pendientes / Issues Conocidos

### Bug Crítico — SWC Compile Error en `TaskDetailPanel.tsx`

**Estado:** Activo — bloquea el render del frontend en dev

**Error:**
```
× Expression expected
   ╭─[TaskDetailPanel.tsx:381:1]
 ─ <>
   · ─
× Expected ',', got '{'   (cascade del primer error)
```

**Root cause identificado:** El error es específico del parser SWC de Next.js 13.5.1 (no es un error de TypeScript — `tsc --noEmit` retorna 0 errores). El error se introdujo en el commit `3d89601` que:
- Cambió `function submitComment()` → `async function submitComment(content: string, mentionedUserIds?: number[]): Promise<void>`
- Agregó `import { MentionInput } from './MentionInput'`
- Reemplazó el form de comentario manual con `<MentionInput>`
- Removió variables de estado del form manual

**Versión que compila OK:** commit `e82fabe` (en `/tmp/TaskDetailPanel_e82fabe.tsx`)
**Versión que falla:** commit `3d89601` (HEAD)

**Próximo paso:** Bisección incremental — aplicar cada cambio de `e82fabe` → `3d89601` uno a la vez para aislar el cambio exacto que rompe la compilación.

**Hipótesis más probable:** La función `async function submitComment(...)` con `Promise<void>` como return type, combinada con la importación de `MentionInput`, causa ambigüedad en el parser TSX de SWC sobre si `<void>` o `<M...` son JSX.

---

## Sesiones de Desarrollo

| Fecha | Log | Trabajo |
|-------|-----|---------|
| 2026-03-03 | `.claude/daily-logs/2026-03-03.md` | Duplicar tarea, bulk status, counter filtros, rediseño TaskExecutionModal |
| Anterior | Versiones previas | Construcción del módulo base, vistas, sidebar contextual, comentarios, subtareas |
