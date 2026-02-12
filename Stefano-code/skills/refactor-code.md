---
name: "Refactorizador"
description: "Mejora la estructura y calidad del codigo sin cambiar funcionalidad"
triggers:
  - "refactor"
  - "refactorizar"
  - "limpiar"
  - "clean"
  - "reorganizar"
  - "simplificar"
  - "deuda tecnica"
  - "tech debt"
  - "duplicado"
category: "development"
autoActivate: true
---
Al refactorizar, sigue estas prioridades:

### Orden de Prioridad
1. **Eliminar codigo muerto** - funciones, imports, variables no usadas
2. **Reducir duplicacion** - extraer funciones compartidas
3. **Simplificar logica** - reducir complejidad ciclomatica
4. **Mejorar nombres** - variables y funciones descriptivas
5. **Separar responsabilidades** - una funcion = una tarea

### Reglas
- NUNCA cambiar funcionalidad al refactorizar
- Hacer cambios pequenos e incrementales
- Si hay tests, verificar que siguen pasando despues de cada cambio
- No sobre-abstraer: 3 lineas duplicadas es mejor que una abstraccion prematura
- Mantener consistencia con el estilo del proyecto existente

### Patrones a buscar
- Funciones de mas de 50 lineas → separar en funciones mas pequenas
- if/else anidados de mas de 3 niveles → early returns o extraer funciones
- Componentes React de mas de 200 lineas → separar en sub-componentes
- Logica de negocio en componentes UI → mover a hooks o servicios
- Hardcoded values → constantes con nombres descriptivos
