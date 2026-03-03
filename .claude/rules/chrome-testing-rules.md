# Regla: Testing funcional con Chrome DevTools MCP

## Principio fundamental

**NUNCA testear sin leer primero.** Antes de abrir Chrome, debés conocer TODAS las funcionalidades del módulo.

---

## Proceso obligatorio

### Paso 1 — Inventario completo de funcionalidades

Antes de cualquier interacción con Chrome DevTools:

1. **Leer TODOS los componentes** del módulo (usar Agent Explore si son muchos)
2. **Leer TODOS los endpoints API** relacionados
3. **Crear una checklist** de CADA funcionalidad testeable:
   - CRUD completo de cada entidad (crear, leer, editar, eliminar)
   - Cambios de estado (status, prioridad, asignación)
   - Acciones especiales (duplicar, completar, ejecutar, bulk actions)
   - Vistas/modos (kanban, lista, grilla, calendario)
   - Filtros y búsqueda
   - Interacciones (drag-and-drop, inline edit, modales)
   - Subtareas, comentarios, adjuntos
   - Empty states y edge cases

### Paso 2 — Crear TodoWrite con la checklist

Cada item de la checklist debe ser un task trackeable. Ejemplo:

```
- [ ] Crear tarea normal
- [ ] Editar tarea (cambiar título, descripción, fecha, prioridad)
- [ ] Eliminar tarea
- [ ] Cambiar status via menú
- [ ] Crear tarea fija (diaria, semanal, mensual)
- [ ] Editar tarea fija
- [ ] Ejecutar/completar tarea fija
- [ ] Eliminar tarea fija
- [ ] Crear subtarea
- [ ] Completar subtarea
- [ ] Eliminar subtarea
- [ ] Agregar comentario
- [ ] Editar comentario
- [ ] Eliminar comentario
- [ ] Crear grupo
- [ ] Filtrar por grupo
- [ ] Bulk actions (selección múltiple)
- [ ] Buscar tareas
- [ ] Vista Lista
- [ ] Vista Kanban
- [ ] Vista Dashboard
- [ ] Vista Reportes
- [ ] Vista Portfolio
- [ ] Vista Tareas Fijas
- [ ] Vista Bandeja
```

### Paso 3 — Testear sistemáticamente

- Seguir la checklist en orden
- Marcar cada item como completado o fallido
- Si algo falla: investigar, diagnosticar y arreglar ANTES de continuar
- Tomar screenshots de evidencia en pasos críticos

### Paso 4 — Verificar errores

Después de cada acción:
- Revisar `list_console_messages` para errores JS
- Revisar `list_network_requests` para 4xx/5xx
- Si hay error: inspeccionar el request con `get_network_request`

### Paso 5 — Cleanup

Al terminar:
- Eliminar datos de prueba creados durante el testing
- Restaurar estados originales si se modificaron datos existentes

---

## Anti-patterns

- **NO** empezar a clickear sin haber leído el código
- **NO** testear solo las funcionalidades obvias (crear/editar/eliminar)
- **NO** ignorar funcionalidades secundarias (subtareas, comentarios, filtros, vistas)
- **NO** asumir que algo funciona sin probarlo
- **NO** saltear el cleanup de datos de prueba
- **NO** testear un módulo parcialmente — si se testea, se testea TODO

---

## Tip para módulos grandes

Si el módulo tiene muchos componentes (>10 archivos), usar `Agent Explore` para obtener el inventario completo. No leer archivo por archivo manualmente — es lento y propenso a olvidar cosas.
