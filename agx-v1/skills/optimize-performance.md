---
name: "Optimizador de Rendimiento"
description: "Optimiza el rendimiento del codigo: queries, renders, bundle size, caching"
triggers:
  - "performance"
  - "rendimiento"
  - "lento"
  - "optimizar"
  - "optimizacion"
  - "velocidad"
  - "rapido"
  - "slow"
  - "cache"
category: "performance"
autoActivate: true
---
Al optimizar rendimiento, enfocate en:

### Base de Datos
- Indices faltantes en columnas usadas en WHERE, JOIN, ORDER BY
- Queries N+1 (usar include/join en lugar de queries separadas)
- Paginacion para endpoints que retornan muchos registros
- Seleccionar solo las columnas necesarias (no SELECT *)

### Frontend React
- Componentes que re-renderizan innecesariamente (usar React.memo, useMemo, useCallback)
- Listas largas sin virtualizacion
- Imagenes sin lazy loading
- Imports pesados que podrian ser dinamicos (dynamic import)
- Bundle splitting para rutas

### API/Backend
- Endpoints sin caching que podrian beneficiarse de cache
- Respuestas grandes que podrian paginarse
- Operaciones sincronas que podrian ser async
- Procesamiento batch en lugar de uno por uno

### Prioridad
1. Primero medir/identificar el cuello de botella real
2. Optimizar lo que mas impacta
3. No optimizar prematuramente
