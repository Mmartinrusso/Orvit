# AgendaV2 — Mejoras de Funcionalidad y Frontend

**Fecha:** 2026-03-03
**Estado:** Aprobado
**Enfoque:** Mobile-first design, desktop follows

---

## Contexto

AgendaV2 (`components/agendav2/`) es el módulo de gestión de tareas de Orvit. Está completamente implementado pero hay tres problemas principales:

1. La página principal (`app/administracion/agenda/page.tsx`) aún usa la versión vieja (`components/agenda/` — v1) y `TareasContent`. AgendaV2 existe pero no está conectado.
2. El sistema de comentarios tiene la estructura pero no renderiza correctamente.
3. No hay diseño mobile — el sidebar de 244px fijo rompe en pantallas chicas.

---

## Alcance

### Eje 1 — Migración y limpieza
- Conectar `app/administracion/agenda/page.tsx` a `AgendaV2Page`
- Eliminar `components/agenda/` (15 archivos, v1)
- Verificar que nada más importe de la v1

### Eje 2 — Mobile (diseño propio, no adaptación de desktop)

**Estilo visual:** Soft UI / neumorphism light
- Fondo: `#F5F3EF` (off-white/beige)
- Cards: `#FFFFFF` con `box-shadow: 0 2px 8px rgba(0,0,0,0.06)`
- Border radius: 16–20px en cards, 999px en pills
- Typography: 14–16px semibold títulos, 12–13px labels, 11–12px muted
- FAB color: `#06b6d4` (celeste)

**Estructura de pantallas:**

_Home (Today view):_
- Top bar: Avatar · Month picker pill · Bell icon
- Week strip horizontal con DayPill (default | active)
- Sección "Pinned projects" — grid 2 columnas con ProjectCard
- Sección "Today's tasks" — TaskCards con ProgressRing + checkbox + contador subtareas/comentarios
- Bottom navigation fija: Home · Mis Tareas · FAB `+` · Dashboard · Perfil

_Task Detail:_
- Pantalla completa con push navigation (no modal)
- Header con back arrow + título
- Campos inline editables: Estado, Prioridad, Fecha
- Secciones: Descripción, Subtareas, Comentarios
- Input sticky al fondo para comentar

_Crear tarea:_
- Bottom sheet con campos mínimos: título, estado, prioridad, fecha
- El resto se edita desde el task detail

_Drawer izquierdo (☰):_
- Muestra el contenido del `AgendaV2Sidebar` actual
- Header con "← Volver" que regresa al sidebar global de la app

**Swipe actions en task cards:**
- Swipe izquierda → cambiar estado
- Swipe derecha → cambiar prioridad

### Eje 3 — Sidebar contextual

El sidebar global de la app se transforma cuando el usuario navega a `/administracion/agenda`:

- **Estado global:** muestra los módulos del sistema (Mantenimiento, Agenda, Costos, etc.)
- **Estado Agenda:** muestra el `AgendaV2Sidebar` existente sin cambios de contenido
- **Transición:** fade + slide 150ms
- **Volver:** botón "← Agenda" en el header del sidebar regresa al estado global
- **Mobile:** mismo comportamiento — el drawer contextual muestra AgendaV2Sidebar

_Implementación:_ el sidebar lee la ruta activa y cambia de contexto. En `app/administracion/agenda/layout.tsx` se puede setear un provider que indique el contexto activo.

### Eje 4 — Sistema de comentarios

**Fix lo roto (D):**
- Renderizar comentarios existentes correctamente: autor, avatar, fecha relativa, texto
- Editar comentario propio (inline, con confirmación al guardar)
- Eliminar comentario propio (confirmación inline mini)
- Adjuntar archivos en comentarios

**Agregar @menciones (B):**
- Al escribir `@` en el input, aparece dropdown con miembros de la empresa
- Mención se renderiza como chip resaltado en el comentario
- Al enviar, genera notificación Discord + in-app para el usuario mencionado

_UI del input:_
```
[Avatar]  Escribir comentario...          📎 ↑
```
_Al escribir `@`:_
```
[Avatar]  @jua
          ┌───────────────────┐
          │ 👤 Juan Pérez     │
          │ 👤 Juana García   │
          └───────────────────┘
```

**No incluido en este sprint:** reacciones emoji, hilos de respuesta, comentarios internos vs públicos.

### Eje 5 — UX Polish

| Mejora | Detalle |
|--------|---------|
| Confirmaciones destructivas | `AlertDialog` al eliminar tarea; confirmación inline al eliminar comentario |
| Filtros persistentes | Guardar en `localStorage` por companyId; restaurar al volver; botón "Limpiar" visible solo si hay filtros activos |
| Optimistic updates | UI cambia inmediatamente al cambiar estado/prioridad; se revierte si el request falla |
| Skeleton loaders | Reemplazar spinner genérico por skeletons en cards |
| Drag & drop feedback | Card semi-transparente al arrastrar; columna destino resaltada; toast sutil al soltar |
| Quick actions en hover | Íconos de acción rápida en task cards al hacer hover (desktop) |
| Empty states con CTA | Cada vista vacía tiene mensaje + botón de acción específico |
| Fechas relativas | "Vence hoy", "Venció hace 2 días", "En 3 días" en lugar de fecha literal |

---

## Componentes nuevos a crear

| Componente | Descripción |
|------------|-------------|
| `components/agendav2/mobile/AgendaMobileLayout.tsx` | Layout raíz mobile con bottom nav |
| `components/agendav2/mobile/AgendaHomeScreen.tsx` | Home con week strip + projects + today tasks |
| `components/agendav2/mobile/WeekStrip.tsx` | Fila de días con DayPill |
| `components/agendav2/mobile/ProjectCard.tsx` | Card de proyecto para grid 2 cols |
| `components/agendav2/mobile/TaskCardMobile.tsx` | Card compacta con ProgressRing |
| `components/agendav2/mobile/ProgressRing.tsx` | Anillo de progreso circular |
| `components/agendav2/mobile/TaskDetailMobile.tsx` | Pantalla completa de task detail |
| `components/agendav2/mobile/BottomNav.tsx` | Bottom navigation con FAB central |
| `components/agendav2/mobile/AgendaDrawer.tsx` | Drawer izquierdo con AgendaV2Sidebar |
| `components/agendav2/TaskCommentThread.tsx` | Extracción del hilo de comentarios del TaskDetailPanel |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `app/administracion/agenda/page.tsx` | Reemplazar por AgendaV2Page |
| `components/layout/Navbar.tsx` (o sidebar global) | Soporte para contexto dinámico |
| `components/agendav2/TaskDetailPanel.tsx` | Extraer comentarios a TaskCommentThread; arreglar rendering |
| `components/agendav2/AgendaV2Page.tsx` | Detectar mobile y renderizar AgendaMobileLayout |

## Archivos a eliminar

- `components/agenda/` (carpeta completa — 15 archivos)

---

## Criterios de éxito

- [ ] La página `/administracion/agenda` carga AgendaV2 sin la v1
- [ ] En mobile (< 768px) se muestra el nuevo layout, no el desktop adaptado
- [ ] Los comentarios se renderizan correctamente y se pueden editar/eliminar
- [ ] @menciones notifica al usuario mencionado vía Discord + in-app
- [ ] El sidebar muestra AgendaV2Sidebar al entrar a Agenda
- [ ] Eliminar tarea muestra confirmación antes de proceder
- [ ] Los filtros se restauran al volver a Agenda

---

## Lo que NO se hace en este sprint

- Datos falsos en Dashboard/Timeline (deuda técnica separada)
- Refactor de estado (useReducer en AgendaV2Page)
- Paginación / virtualización
- Vistas faltantes (Reporting, Spreadsheet)
- Reacciones, hilos de respuesta en comentarios
