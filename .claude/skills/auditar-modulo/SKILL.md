---
name: auditar-modulo
description: Use when the user asks to audit a module, find missing features, discover gaps, or suggest improvements. Triggers on "auditar", "que le falta a", "que se puede mejorar", "funcionalidades faltantes", "gaps", or any request to analyze a module for completeness and improvement opportunities using Chrome DevTools MCP.
---

# Auditar Modulo — Descubrir funcionalidades faltantes y mejorar las existentes

## Overview

Proceso de auditoria de producto para un modulo de ORVIT. Combina lectura exhaustiva del codigo con navegacion en Chrome DevTools MCP para detectar **gaps funcionales** (lo que falta) y **mejoras** (lo que existe pero esta incompleto o se puede hacer mejor). Produce un reporte priorizado de hallazgos con acciones concretas.

## Cuando usar

- "Audita el modulo de ventas"
- "Que le falta a la agenda?"
- "Revisame compras y decime que se puede mejorar"
- "Quiero saber que funcionalidades faltan en mantenimiento"
- Cualquier pedido de descubrir gaps, funcionalidades faltantes, o mejoras en un modulo

## Flujo obligatorio

```
1. Inventario de codigo  -->  2. Checklist ideal  -->  3. Navegacion en Chrome  -->  4. Gap analysis  -->  5. Reporte priorizado
```

**Las 5 fases son obligatorias y en orden.**

---

## Fase 1 — Inventario exhaustivo del codigo

**Objetivo:** Saber EXACTAMENTE que tiene el modulo hoy.

1. **Identificar el modulo** — El usuario indica que modulo auditar
2. **Leer TODOS los componentes** del modulo:
   - Usar `Agent Explore` si hay >10 archivos
   - Pagina principal (`app/{ruta}/page.tsx`)
   - Todos los componentes (`components/{modulo}/`)
   - Layouts y wrappers
3. **Leer TODOS los endpoints API** relacionados (`app/api/{modulo}/`)
4. **Leer el modelo Prisma** — campos, relaciones, enums del modulo en `prisma/schema.prisma`
5. **Documentar el inventario** con `TaskCreate`:

Para cada entidad del modulo, anotar:

| Aspecto | Que buscar |
|---------|-----------|
| **CRUD** | Create, Read (lista + detalle), Update, Delete |
| **Vistas** | Lista, grilla, kanban, calendario, dashboard, reportes |
| **Filtros** | Por estado, fecha, usuario, busqueda texto, categorias |
| **Ordenamiento** | Por fecha, nombre, prioridad, monto |
| **Acciones** | Cambio de estado, asignacion, duplicar, archivar |
| **Bulk actions** | Seleccion multiple + acciones masivas |
| **Export** | CSV, Excel, PDF |
| **Subentidades** | Comentarios, adjuntos, historial, subtareas |
| **UX basica** | Loading states, empty states, confirmaciones destructivas, toasts |
| **Navegacion** | Deep links, breadcrumbs, back button, tabs/vistas con URL |
| **Permisos** | Guards en rutas, checks en botones, roles |
| **Mobile** | Layout responsive, componentes mobile-specific |

**Resultado:** Lista completa de "lo que TIENE el modulo hoy".

---

## Fase 2 — Construir checklist del modulo ideal

**Objetivo:** Definir que DEBERIA tener un modulo completo de este tipo.

1. **Usar como referencia** los mejores modulos de ORVIT (agenda, ventas, mantenimiento) para saber el nivel de completitud esperado
2. **Aplicar la tabla de la Fase 1** como checklist ideal — cada casilla deberia estar cubierta
3. **Agregar items especificos del dominio** — por ejemplo:
   - Ventas: pipeline visual, seguimiento de cotizaciones, margenes
   - Compras: 3-way matching, aprobaciones, recepciones parciales
   - Mantenimiento: health score, calendarios, checklists impresos
   - Agenda: vistas kanban/inbox/calendar, tareas fijas, portfolio
4. **Crear TaskCreate** con cada item del checklist ideal, marcando:
   - `[EXISTE]` — el modulo ya lo tiene
   - `[FALTA]` — no existe en el codigo
   - `[INCOMPLETO]` — existe parcialmente

**Resultado:** Checklist ideal con estado de cada item.

---

## Fase 3 — Navegar en Chrome para verificar

**Objetivo:** Confirmar en el browser lo que el codigo dice, y descubrir problemas que solo se ven en uso real.

### Credenciales

Las credenciales de login estan en `docs/credenciales.md`. Leer ese archivo antes de iniciar sesion.

### Proceso

1. **Navegar** a la URL del modulo con `navigate_page`
2. **Login** si es necesario (usar `fill_form` con credenciales de `docs/credenciales.md`)
3. **Recorrer CADA vista/pagina** del modulo:
   - `take_screenshot` de cada vista
   - Verificar que lo que muestra el UI coincide con lo que dice el codigo
   - Probar flujos criticos (crear, editar, eliminar, cambiar estado)
   - Revisar `list_console_messages` filtrado por `["error", "warn"]`
   - Revisar `list_network_requests` filtrado por `["fetch", "xhr"]` buscando 4xx/5xx
4. **Detectar problemas de UX en uso real:**
   - Carga lenta? (requests lentos, spinners largos, waterfalls)
   - Confusion de navegacion? (no saber donde estoy, back no funciona)
   - Acciones sin feedback? (click y no pasa nada visible)
   - Datos que no se refrescan? (crear algo y no aparece)
   - Responsive roto? (probar con `resize_page` a 375px y 768px)
5. **Anotar hallazgos** — actualizar los tasks con lo encontrado

### Herramientas Chrome DevTools MCP

| Herramienta | Uso en auditoria |
|-------------|-----------------|
| `take_screenshot` | Captura de cada vista para analizar |
| `take_snapshot` | Obtener UIDs antes de interactuar |
| `click` / `fill` / `fill_form` | Probar flujos criticos |
| `navigate_page` | Recorrer vistas |
| `resize_page` | Verificar responsive (375px mobile, 768px tablet) |
| `list_console_messages` | Detectar errores silenciosos |
| `list_network_requests` | Detectar requests lentos o fallidos |
| `get_network_request` | Inspeccionar request problematico |
| `evaluate_script` | Medir tiempos, contar elementos, verificar estado |

**Resultado:** Verificacion real de funcionalidades + problemas de UX descubiertos.

---

## Fase 4 — Gap analysis

**Objetivo:** Cruzar el inventario (Fase 1) con el ideal (Fase 2) y lo observado (Fase 3).

Clasificar cada hallazgo en una de estas categorias:

### Categorias de hallazgo

| Categoria | Descripcion | Ejemplo |
|-----------|------------|---------|
| **FALTA** | Funcionalidad que no existe y deberia | "No hay export CSV en la lista de ordenes" |
| **INCOMPLETO** | Existe pero le falta algo | "El filtro de fecha solo tiene 'hoy', falta rango custom" |
| **ROTO** | Existe pero no funciona bien | "El boton eliminar no pide confirmacion" |
| **UX POBRE** | Funciona pero la experiencia es mala | "No hay loading state al cargar la tabla, parece que no responde" |
| **MEJORA** | Oportunidad de mejora que agregaria valor | "Agregar vista kanban al pipeline de ventas" |

### Prioridades

| Prioridad | Criterio |
|-----------|---------|
| **P0 - Critico** | Bug o funcionalidad rota que afecta uso diario |
| **P1 - Alto** | Funcionalidad faltante que los usuarios necesitan |
| **P2 - Medio** | Mejora de UX o funcionalidad secundaria faltante |
| **P3 - Bajo** | Nice-to-have, polish, mejoras menores |

**Resultado:** Lista clasificada y priorizada de hallazgos.

---

## Fase 5 — Reporte final

Generar un reporte estructurado con este formato:

```markdown
# Auditoria: [Nombre del Modulo]
**Fecha:** YYYY-MM-DD
**Modulo:** [ruta en la app]

## Resumen
- Funcionalidades auditadas: X
- Existentes y OK: X
- Con problemas: X
- Faltantes: X
- Mejoras propuestas: X

## Hallazgos por prioridad

### P0 — Critico
| # | Categoria | Hallazgo | Accion recomendada |
|---|-----------|----------|-------------------|
| 1 | ROTO | ... | ... |

### P1 — Alto
| # | Categoria | Hallazgo | Accion recomendada |
|---|-----------|----------|-------------------|
| 1 | FALTA | ... | ... |

### P2 — Medio
...

### P3 — Bajo
...

## Funcionalidades OK (no requieren accion)
- [lista de lo que funciona bien]

## Siguiente paso recomendado
[que atacar primero y por que]
```

### Despues del reporte

1. **Preguntar al usuario** que quiere hacer:
   - Implementar los P0 ahora?
   - Crear un plan para los P1?
   - Solo guardar el reporte?
2. **Guardar el reporte** en `.claude/daily-logs/` como parte del log del dia

---

## Anti-patterns

- **NO** auditar sin leer el codigo primero — el codigo es la fuente de verdad
- **NO** solo listar lo que falta — tambien reconocer lo que funciona bien
- **NO** proponer mejoras sin verificar en Chrome — lo que parece faltar en el codigo puede existir de otra forma
- **NO** generar hallazgos vagos ("mejorar la UX") — cada hallazgo debe ser especifico y accionable
- **NO** priorizar todo como P0 — ser honesto con las prioridades
- **NO** ignorar el contexto del modulo — un modulo nuevo tiene gaps diferentes a uno maduro
- **NO** proponer features que no encajan con la arquitectura existente de ORVIT
- **NO** auditar y corregir al mismo tiempo — primero completar la auditoria, despues implementar
