# Workflow Rules — ORVIT Claude Code Sessions

Estas reglas aplican a cada sesión de Claude Code en este proyecto. Complementan las guidelines existentes en `frontend-guidelines.md`.

---

## Regla 1: Log Diario de Sesión

### Cuándo aplicar
- Al **inicio de cada sesión**: crear o abrir el log del día en `.claude/daily-logs/YYYY-MM-DD.md`
- Al **completar trabajo significativo**: actualizar el log antes de pasar a la siguiente tarea
- Al **cerrar la sesión**: escribir la sección "Next Session"

### Ubicación de logs
```
/Users/martinrusso10/Orvit/Orvit/.claude/daily-logs/YYYY-MM-DD.md
```
Template: `/Users/martinrusso10/Orvit/Orvit/.claude/daily-logs/_template.md`

### Estructura del log — DOS secciones obligatorias

Cada log tiene dos partes separadas por `---`:

**1. 📋 RESUMEN EJECUTIVO** — en lenguaje simple, sin términos técnicos
- Pensado para ser pegado en Notion y compartido con stakeholders no técnicos
- **UN SOLO bloque por día** — se extiende acumulativamente, nunca se crea un segundo bloque
- **Organizado por módulo/sector** (Ventas, Mantenimiento, Nóminas, General...), NO por sesión
- Solo aparece lo que está completo — sin sección de pendientes en el resumen ejecutivo
- Los pendientes van únicamente en el Log Técnico (sección "Next Session")
- Leer el log del día actual antes de escribir para extender el bloque existente
- Tabla de estado por módulo al final (✅ Completo / 🔄 En progreso)

**2. 🛠️ LOG TÉCNICO** — detalle de ingeniería para Claude Code

| Sección | Qué incluir |
|---------|-------------|
| **What Was Done** | Tareas completadas con resultado; en progreso con estado actual |
| **Files Modified** | Cada archivo creado, modificado o eliminado con motivo de una línea |
| **Decisions Made** | Cualquier decisión no obvia: por qué esta aproximación, qué alternativas se consideraron |
| **Issues Encountered** | Bugs, bloqueos, hallazgos inesperados — y su resolución |
| **Skills Used** | Qué skills de `.claude/skills/` se aplicaron y cómo |
| **Next Session** | Pendientes concretos para no perder contexto entre sesiones |

### Formato para tracking de archivos
```
| `orvit-v1/app/api/feature/route.ts` | created | Implementa endpoint X para feature Y |
| `orvit-v1/lib/utils.ts` | modified | Agregado helper formatCurrency |
| `orvit-v1/scripts/old-script.js` | deleted | Reemplazado por migración en prisma/ |
```

### Si no existe el log del día
Crearlo desde el template. Completar "Session Overview" antes de hacer cualquier trabajo.

---

## Regla 2: Workflow Skills-First

### Cuándo aplicar
Antes de iniciar **cualquier tarea no trivial** (crear feature, debuggear, escribir tests, refactorizar, code review).

### Proceso

**Paso 1 — Revisar skills disponibles**

Los skills están en:
```
/Users/martinrusso10/Orvit/Orvit/.claude/skills/
```

Skills disponibles:

| Skill | Cuándo usar |
|-------|-------------|
| `orvit-frontend` | Componentes UI, Tailwind, shadcn/ui, páginas, modales, KPIs |
| `orvit-api` | API routes, TanStack Query, Prisma queries, caché |
| `orvit-prisma` | Schema Prisma, migraciones, modelos, relaciones |
| `orvit-forms` | Formularios con react-hook-form + Zod + Dialog/Sheet |
| `orvit-tables` | Tablas de datos con filtros, sorting, paginación, CSV |
| `orvit-maintenance` | Mantenimiento, checklists, work orders, health score |
| `orvit-permissions` | Permisos, roles, guards en rutas o componentes |
| `orvit-charts` | Gráficos, dashboards, Chart.js, Recharts |
| `orvit-test` | Tests con Vitest |
| `orvit-discord` | Discord bot standalone, notificaciones, DMs |
| `orvit-agx` | Pipeline AGX, generación de código con IA |
| `commit` | Crear un commit con formato estándar |
| `pr` | Crear un Pull Request con formato estándar |
| `vercel-composition-patterns` | Patrones de composición React |
| `vercel-react-best-practices` | Performance optimization React/Next.js |
| `web-design-guidelines` | Auditoría de UI/UX |

**Paso 2 — Aplicar skills que coincidan**

Si un skill coincide con la tarea, leerlo antes de empezar y seguir su guía. Una tarea puede aplicar múltiples skills (ej: crear un endpoint nuevo aplica `orvit-api` + `commit`).

**Paso 3 — Registrar en el log diario**

Después de usar un skill, agregarlo a la sección "Skills Used" del log del día.

**Paso 4 — Identificar mejoras**

Después de usar un skill, preguntarse: "¿Encontré algo no cubierto por este skill? ¿Algo incorrecto u obsoleto?" Si sí, anotarlo en el log bajo "Issues Encountered" con el prefijo `[SKILL IMPROVEMENT]`.

### Ejemplo de entrada para mejora de skill
```
## Issues Encountered
- **[SKILL IMPROVEMENT] orvit-api**: El skill no menciona el método `serverCache.invalidatePattern()`
  introducido en lib/cache.ts. La invalidación por patrón es ahora el enfoque preferido.
  **Resolution**: Open — el skill debería actualizarse.
```

---

## Convenciones Generales

- Los archivos de log usan formato ISO 8601: `YYYY-MM-DD.md`
- Todas las rutas en logs usan paths relativos a `/Users/martinrusso10/Orvit/Orvit/` o prefijadas con `orvit-v1/`
- Entradas concisas: 1-3 oraciones por ítem es suficiente
- Nunca eliminar logs de días anteriores — forman el historial del proyecto
